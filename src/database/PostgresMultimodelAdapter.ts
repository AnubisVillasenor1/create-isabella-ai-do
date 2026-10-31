import { Pool, PoolClient, PoolConfig } from 'pg';

export interface CacheQueryResult {
  hit: boolean;
  response?: any;
  similarity?: number;
}

export interface VectorSearchResult {
  id: string;
  content: string;
  metadata: Record<string, any>;
  similarity: number;
}

export interface GraphQueryResult {
  a: any;
  r: any;
  b: any;
}

export interface LockResult {
  acquired: boolean;
}

export class PostgresMultimodelAdapter {
  private pool: Pool;
  private initialized: boolean = false;

  constructor(config: PoolConfig | string) {
    const poolConfig: PoolConfig =
      typeof config === 'string' ? { connectionString: config } : config;

    this.pool = new Pool({
      ...poolConfig,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });

    this.pool.on('error', (err) => {
      console.error('[PostgresMultimodelAdapter] Unexpected pool error:', err);
    });
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    const client = await this.pool.connect();
    try {
      // Cargar extensión AGE y crear grafo
      await client.query("LOAD 'age';");
      await client.query('SET search_path = ag_catalog, "$user", public;');
      await client.query("SELECT create_graph('isabella_knowledge_graph');");

      // Inicializar colas pgmq
      await client.query("SELECT pgmq.create('isabella_jobs');").catch(() => {});
      await client.query("SELECT pgmq.create('isabella_notifications');").catch(() => {});
      await client.query("SELECT pgmq.create('isabella_routing');").catch(() => {});

      this.initialized = true;
      console.log('[PostgresMultimodelAdapter] Initialized successfully');
    } finally {
      client.release();
    }
  }

  // ============================================================================
  // 1. CACHÉ SEMÁNTICA HNSW (<10ms)
  // ============================================================================

  async querySemanticCache(
    embedding: number[],
    threshold = 0.95
  ): Promise<{ hit: boolean; response?: any; similarity?: number }> {
    if (!this.initialized) await this.initialize();

    const vectorStr = `[${embedding.join(',')}]`;
    const sql = `
      SELECT id, response, 1 - (prompt_embedding <=> $1::vector) AS similarity
      FROM semantic_cache
      WHERE (expires_at IS NULL OR expires_at > NOW())
        AND (1 - (prompt_embedding <=> $1::vector)) >= $2
      ORDER BY similarity DESC
      LIMIT 1;
    `;
    const res = await this.pool.query(sql, [JSON.stringify(embedding), threshold]);
    if (res.rows.length > 0) {
      const hitRow = res.rows[0];
      // Incrementar contador de hits asíncronamente
      this.pool
        .query('UPDATE semantic_cache SET hit_count = hit_count + 1 WHERE id = $1', [hitRow.id])
        .catch(() => {});
      return { hit: true, response: hitRow.response, similarity: parseFloat(hitRow.similarity) };
    }
    return { hit: false };
  }

  async storeSemanticCache(
    promptRaw: string,
    embedding: number[],
    response: any,
    ttlSeconds = 86400
  ): Promise<void> {
    const sql = `
      INSERT INTO semantic_cache (prompt_raw, prompt_embedding, response, expires_at)
      VALUES ($1, $2::vector, $3, NOW() + ($4 || ' seconds')::INTERVAL)
      ON CONFLICT DO NOTHING;
    `;
    await this.pool.query(sql, [
      promptRaw,
      JSON.stringify(embedding),
      JSON.stringify(response),
      ttlSeconds,
    ]);
  }

  // ============================================================================
  // 2. CONSULTAS DE GRAFOS CON APACHE AGE
  // ============================================================================

  async queryGraph<T = any>(cypher: string): Promise<GraphQueryResult[]> {
    if (!this.initialized) await this.initialize();

    const client: PoolClient = await this.pool.connect();
    try {
      await client.query("LOAD 'age';");
      await client.query('SET search_path = ag_catalog, "$user", public;');
      const sql = `
        SELECT * FROM cypher('isabella_knowledge_graph', $$
          ${cypher}
        $$) AS (a agtype, r agtype, b agtype);
      `;
      const res = await client.query(sql);
      return res.rows.map((row) => ({ a: row.a, r: row.r, b: row.b }));
    } finally {
      client.release();
    }
  }

  async addGraphNode(label: string, properties: Record<string, any>): Promise<string> {
    const propsStr = JSON.stringify(properties).replace(/"/g, '\\"');
    const cypher = `CREATE (n:${label} ${propsStr}) RETURN id(n) as id`;
    const res = await this.queryGraph<{ id: string }>(cypher);
    return res[0]?.a?.id ?? res[0]?.a ?? '';
  }

  async addGraphEdge(
    sourceId: string,
    targetId: string,
    relationType: string,
    properties: Record<string, any> = {}
  ): Promise<void> {
    const propsStr =
      Object.keys(properties).length > 0
        ? ' ' + JSON.stringify(properties).replace(/"/g, '\\"')
        : '';
    const cypher = `MATCH (a), (b) WHERE id(a) = ${sourceId} AND id(b) = ${targetId} CREATE (a)-[r:${relationType}${propsStr}]->(b)`;
    await this.queryGraph(cypher);
  }

  // ============================================================================
  // 3. LOCKS CONSULTIVOS TRANSMISIONALES
  // ============================================================================

  async acquireLock(key: number, timeoutMs = 5000): Promise<LockResult> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const res = await client.query('SELECT pg_try_advisory_lock($1) AS locked', [key]);
      if (res.rows[0].locked) {
        await client.query('COMMIT');
        return { acquired: true };
      }
      await client.query('ROLLBACK');
      return { acquired: false };
    } finally {
      client.release();
    }
  }

  async releaseLock(key: number): Promise<LockResult> {
    const res = await this.pool.query('SELECT pg_advisory_unlock($1) AS unlocked', [key]);
    return { acquired: res.rows[0].unlocked };
  }

  async withLock<T>(key: number, fn: () => Promise<T>, timeoutMs = 30000): Promise<T> {
    const acquired = await this.acquireLock(key);
    if (!acquired) throw new Error(`Could not acquire lock ${key}`);
    try {
      return await fn();
    } finally {
      await this.releaseLock(key);
    }
  }

  // ============================================================================
  // 4. BÚSQUEDA VECTORIAL MEMORY MESH
  // ============================================================================

  async searchVectorMemory(embedding: number[], limit = 10): Promise<VectorSearchResult[]> {
    if (!this.initialized) await this.initialize();

    const sql = `
      SELECT m.id, m.content, m.metadata, 1 - (e.embedding <=> $1::vector) AS similarity
      FROM memory_objects m
      JOIN embeddings e ON e.memory_id = m.id
      ORDER BY e.embedding <=> $1::vector ASC
      LIMIT $2;
    `;
    const res = await this.pool.query(sql, [JSON.stringify(embedding), limit]);
    return res.rows.map((row) => ({
      id: row.id,
      content: row.content,
      metadata: row.metadata,
      similarity: parseFloat(row.similarity),
    }));
  }

  async addMemoryObject(
    namespace: string,
    content: string,
    metadata: Record<string, any>,
    embedding: number[]
  ): Promise<string> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      const objRes = await client.query(
        `INSERT INTO memory_objects (namespace, content, metadata) VALUES ($1, $2, $3) RETURNING id`,
        [namespace, content, JSON.stringify(metadata)]
      );
      const memoryId = objRes.rows[0].id;

      await client.query(`INSERT INTO embeddings (memory_id, embedding) VALUES ($1, $2::vector)`, [
        memoryId,
        JSON.stringify(embedding),
      ]);

      await client.query('COMMIT');
      return memoryId;
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  }

  // ============================================================================
  // 5. COLAS TRANSACCIONALES (pgmq)
  // ============================================================================

  async enqueueJob(queueName: string, payload: any): Promise<{ msg_id: number }> {
    const res = await this.pool.query('SELECT * FROM pgmq.send($1, $2)', [
      queueName,
      JSON.stringify(payload),
    ]);
    return { msg_id: res.rows[0].msg_id };
  }

  async readQueue(queueName: string, vt = 30, qty = 10): Promise<any[]> {
    const res = await this.pool.query('SELECT * FROM pgmq.read($1, $2, $3)', [queueName, vt, qty]);
    return res.rows;
  }

  async deleteFromQueue(queueName: string, msgId: number): Promise<boolean> {
    const res = await this.pool.query('SELECT pgmq.delete($1, $2)', [queueName, msgId]);
    return res.rows[0].pgmq_delete === 1;
  }

  async archiveMessage(queueName: string, msgId: number): Promise<boolean> {
    const res = await this.pool.query('SELECT pgmq.archive($1, $2)', [queueName, msgId]);
    return res.rows[0].pgmq_archive === 1;
  }

  // ============================================================================
  // 6. GOVERNANCE & AUDIT FABRIC
  // ============================================================================

  async createGovernor(name: string, role: string, publicKey: string): Promise<string> {
    const res = await this.pool.query(
      `INSERT INTO governors (name, role, public_key) VALUES ($1, $2, $3) RETURNING id`,
      [name, role, publicKey]
    );
    return res.rows[0].id;
  }

  async createPolicy(policyCode: string, regoDefinition: string, version: string): Promise<string> {
    const res = await this.pool.query(
      `INSERT INTO governance_policies (policy_code, rego_definition, version) VALUES ($1, $2, $3) RETURNING id`,
      [policyCode, regoDefinition, version]
    );
    return res.rows[0].id;
  }

  async recordVote(
    policyId: string,
    governorId: string,
    vote: string,
    signature: string
  ): Promise<void> {
    await this.pool.query(
      `INSERT INTO governance_votes (policy_id, governor_id, vote, signature) VALUES ($1, $2, $3, $4)`,
      [policyId, governorId, vote, signature]
    );
  }

  async recordAuditEvent(eventType: string, details: any): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      const prevHashRes = await client.query(
        `SELECT hash FROM audit_hash_chain ORDER BY id DESC LIMIT 1`
      );
      const prevHash = prevHashRes.rows[0]?.hash || '';

      const eventRes = await client.query(
        `INSERT INTO audit_events (actor, action, payload) VALUES ($1, $2, $3) RETURNING id`,
        ['system', eventType, JSON.stringify(details)]
      );
      const eventId = eventRes.rows[0].id;

      const hashInput = `${prevHash}${eventId}${JSON.stringify(details)}`;
      const hash = require('crypto').createHash('sha256').update(hashInput).digest('hex');

      await client.query(
        `INSERT INTO audit_hash_chain (event_id, prev_hash, hash) VALUES ($1, $2, $3)`,
        [eventId, prevHash, hash]
      );

      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  }

  // ============================================================================
  // 7. REVENUE FABRIC
  // ============================================================================

  async recordTransaction(
    accountFrom: string,
    accountTo: string,
    amount: number,
    currency: string,
    idempotencyKey: string
  ): Promise<string> {
    const res = await this.pool.query(
      `INSERT INTO transactions (account_from, account_to, amount, currency, idempotency_key) 
       VALUES ($1, $2, $3, $4, $5) 
       ON CONFLICT (idempotency_key) DO NOTHING 
       RETURNING id`,
      [accountFrom, accountTo, amount, currency, idempotencyKey]
    );
    return res.rows[0]?.id || '';
  }

  async recordRevenue(
    transactionId: string,
    revenueStream: string,
    netAmount: number
  ): Promise<void> {
    await this.pool.query(
      `INSERT INTO revenues (transaction_id, revenue_stream, net_amount) VALUES ($1, $2, $3)`,
      [transactionId, revenueStream, netAmount]
    );
  }

  async recordBillingEvent(agentId: string, eventType: string, cost: number): Promise<void> {
    await this.pool.query(
      `INSERT INTO billing_events (agent_id, event_type, cost) VALUES ($1, $2, $3)`,
      [agentId, eventType, cost]
    );
  }

  // ============================================================================
  // 8. AGENT RUNTIME
  // ============================================================================

  async createAgent(agentName: string, trustTier: string, config: any = {}): Promise<string> {
    const res = await this.pool.query(
      `INSERT INTO agents (agent_name, trust_tier, config) VALUES ($1, $2, $3) RETURNING id`,
      [agentName, trustTier, JSON.stringify(config)]
    );
    return res.rows[0].id;
  }

  async updateAgentStatus(agentId: string, status: string): Promise<void> {
    await this.pool.query(`UPDATE agents SET status = $1 WHERE id = $2`, [status, agentId]);
  }

  async recordAgentMetric(agentId: string, tokensUsed: number, latencyMs: number): Promise<void> {
    await this.pool.query(
      `INSERT INTO agent_metrics (agent_id, tokens_used, latency_ms) VALUES ($1, $2, $3)`,
      [agentId, tokensUsed, latencyMs]
    );
  }

  // ============================================================================
  // 9. MEMORY MESH
  // ============================================================================

  async addMemoryRelation(sourceId: string, targetId: string, relationType: string): Promise<void> {
    await this.pool.query(
      `INSERT INTO memory_relations (source_id, target_id, relation_type) VALUES ($1, $2, $3)`,
      [sourceId, targetId, relationType]
    );
  }

  async addMemoryTag(memoryId: string, tag: string): Promise<void> {
    await this.pool.query(`INSERT INTO memory_tags (memory_id, tag) VALUES ($1, $2)`, [
      memoryId,
      tag,
    ]);
  }

  async addMemoryVersion(memoryId: string, version: number, contentDelta: string): Promise<void> {
    await this.pool.query(
      `INSERT INTO memory_versions (memory_id, version, content_delta) VALUES ($1, $2, $3)`,
      [memoryId, version, contentDelta]
    );
  }

  // ============================================================================
  // 10. HYPERROUTER & ROUTING
  // ============================================================================

  async recordRoutingDecision(
    promptHash: string,
    complexityScore: number,
    selectedModel: string,
    executionTimeMs: number
  ): Promise<void> {
    await this.pool.query(
      `INSERT INTO routing_decisions (prompt_hash, complexity_score, selected_model, execution_time_ms) 
       VALUES ($1, $2, $3, $4)`,
      [promptHash, complexityScore, selectedModel, executionTimeMs]
    );
  }

  async updateRoutingMetrics(
    modelName: string,
    success: boolean,
    latencyMs: number
  ): Promise<void> {
    await this.pool.query(
      `
      INSERT INTO routing_metrics (model_name, success_count, failure_count, avg_latency_ms)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (model_name) DO UPDATE SET
        success_count = routing_metrics.success_count + EXCLUDED.success_count,
        failure_count = routing_metrics.failure_count + EXCLUDED.failure_count,
        avg_latency_ms = (routing_metrics.avg_latency_ms * routing_metrics.success_count + EXCLUDED.avg_latency_ms * EXCLUDED.success_count) 
                          / (routing_metrics.success_count + EXCLUDED.success_count)
    `,
      [modelName, success ? 1 : 0, success ? 0 : 1, latencyMs]
    );
  }

  async registerModel(
    modelName: string,
    provider: string,
    maxContextLength: number
  ): Promise<void> {
    await this.pool.query(
      `INSERT INTO model_registry (model_name, provider, max_context_length) VALUES ($1, $2, $3)
       ON CONFLICT (model_name) DO UPDATE SET provider = EXCLUDED.provider, max_context_length = EXCLUDED.max_context_length`,
      [modelName, provider, maxContextLength]
    );
  }

  // ============================================================================
  // 11. ARTIFACTS
  // ============================================================================

  async createArtifact(title: string, filePath: string, fileHash: string): Promise<string> {
    const res = await this.pool.query(
      `INSERT INTO artifacts (title, file_path, file_hash) VALUES ($1, $2, $3) RETURNING id`,
      [title, filePath, fileHash]
    );
    return res.rows[0].id;
  }

  async addArtifactVersion(
    artifactId: string,
    versionNumber: number,
    filePath: string
  ): Promise<void> {
    await this.pool.query(
      `INSERT INTO artifact_versions (artifact_id, version_number, file_path) VALUES ($1, $2, $3)`,
      [artifactId, versionNumber, filePath]
    );
  }

  async addArtifactMetadata(artifactId: string, metaKey: string, metaValue: string): Promise<void> {
    await this.pool.query(
      `INSERT INTO artifact_metadata (artifact_id, meta_key, meta_value) VALUES ($1, $2, $3)`,
      [artifactId, metaKey, metaValue]
    );
  }

  // ============================================================================
  // 12. HEALTH CHECK & CLEANUP
  // ============================================================================

  async healthCheck(): Promise<{ healthy: boolean; details: any }> {
    try {
      const client = await this.pool.connect();
      const res = await client.query('SELECT 1 as ok');
      client.release();

      const poolStats = {
        totalCount: this.pool.totalCount,
        idleCount: this.pool.idleCount,
        waitingCount: this.pool.waitingCount,
      };

      return { healthy: res.rows[0].ok === 1, details: { pool: poolStats } };
    } catch (e) {
      return { healthy: false, details: { error: String(e) } };
    }
  }

  async close(): Promise<void> {
    await this.pool.end();
    this.initialized = false;
  }
}

// Singleton para uso en toda la aplicación
let adapterInstance: PostgresMultimodelAdapter | null = null;

export function getPostgresMultimodelAdapter(
  config?: PoolConfig | string
): PostgresMultimodelAdapter {
  if (!adapterInstance && config) {
    adapterInstance = new PostgresMultimodelAdapter(config);
  }
  if (!adapterInstance) {
    throw new Error('PostgresMultimodelAdapter not initialized. Provide config on first call.');
  }
  return adapterInstance;
}

export async function initializePostgresAdapter(
  config: PoolConfig | string
): Promise<PostgresMultimodelAdapter> {
  adapterInstance = new PostgresMultimodelAdapter(config);
  await adapterInstance.initialize();
  return adapterInstance;
}
