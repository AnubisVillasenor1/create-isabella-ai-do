/**
 * Memory Mesh - Multi-Backend Sovereign Memory System
 * state: engine-generated
 * Part of ISABELLA-Q Ω Cognitive Architecture
 * 
 * Provides unified access to:
 * - Episodic Memory (Redis/PostgreSQL)
 * - Semantic Memory (Qdrant/pgvector)
 * - Procedural Memory (PostgreSQL/Neo4j)
 * - Long-term Memory (PostgreSQL + Object Storage)
 * - Provenance Memory (Immutable Ledger)
 */

import { EventEmitter } from "node:events";
import { createHash, randomBytes } from "node:crypto";

export type MemoryType = 
  | "episodic" 
  | "semantic" 
  | "procedural" 
  | "long_term" 
  | "provenance";

export type MemoryBackend = 
  | "redis" 
  | "postgresql" 
  | "qdrant" 
  | "neo4j" 
  | "object_storage" 
  | "ledger";

export interface MemoryRecord {
  readonly id: string;
  readonly type: MemoryType;
  readonly userId: string;
  readonly sessionId?: string;
  readonly content: string;
  readonly embedding?: Float32Array;
  readonly metadata: Record<string, unknown>;
  readonly tags: ReadonlyArray<string>;
  readonly importance: number; // 0-1
  readonly accessCount: number;
  readonly lastAccessed: number;
  readonly createdAt: number;
  readonly updatedAt: number;
  readonly expiresAt?: number;
  readonly provenanceHash?: string;
}

export interface MemoryQuery {
  readonly userId: string;
  readonly type?: MemoryType;
  readonly query?: string;
  readonly embedding?: Float32Array;
  readonly tags?: ReadonlyArray<string>;
  readonly timeRange?: { start: number; end: number };
  readonly limit?: number;
  readonly offset?: number;
  readonly minImportance?: number;
  readonly sessionId?: string;
}

export interface MemorySearchResult {
  readonly records: ReadonlyArray<MemoryRecord>;
  readonly totalCount: number;
  readonly queryTimeMs: number;
}

export interface MemoryStats {
  readonly totalRecords: number;
  readonly byType: Record<MemoryType, number>;
  readonly byBackend: Record<MemoryBackend, number>;
  readonly totalSizeBytes: number;
  readonly avgImportance: number;
  readonly oldestRecord: number;
  readonly newestRecord: number;
}

export interface MemoryBackendConfig {
  readonly type: MemoryBackend;
  readonly connectionString: string;
  readonly poolSize?: number;
  readonly timeoutMs?: number;
  readonly retryAttempts?: number;
  readonly enableCompression?: boolean;
  readonly encryptionKey?: string;
}

export interface MemoryMeshConfig {
  readonly backends: ReadonlyArray<MemoryBackendConfig>;
  readonly defaultBackend: MemoryBackend;
  readonly embeddingModel: string;
  readonly embeddingDimensions: number;
  readonly chunkSize: number;
  readonly chunkOverlap: number;
  readonly maxRecordsPerQuery: number;
  readonly enableProvenance: boolean;
  readonly provenanceBackend: MemoryBackend;
  readonly autoConsolidation: boolean;
  readonly consolidationIntervalMs: number;
  readonly importanceThreshold: number;
  readonly maxAgeMs: number;
}

const DEFAULT_CONFIG: MemoryMeshConfig = {
  backends: [],
  defaultBackend: "postgresql",
  embeddingModel: "nomic-embed-text-v1.5",
  embeddingDimensions: 768,
  chunkSize: 1000,
  chunkOverlap: 200,
  maxRecordsPerQuery: 100,
  enableProvenance: true,
  provenanceBackend: "ledger",
  autoConsolidation: true,
  consolidationIntervalMs: 3600000, // 1 hour
  importanceThreshold: 0.3,
  maxAgeMs: 365 * 24 * 60 * 60 * 1000, // 1 year
};

/**
 * Abstract Memory Backend Interface
 */
export abstract class MemoryBackendAdapter {
  abstract readonly type: MemoryBackend;
  abstract readonly config: MemoryBackendConfig;

  abstract initialize(): Promise<void>;
  abstract close(): Promise<void>;
  abstract healthCheck(): Promise<boolean>;

  abstract store(record: MemoryRecord): Promise<void>;
  abstract storeBatch(records: ReadonlyArray<MemoryRecord>): Promise<void>;
  abstract get(id: string): Promise<MemoryRecord | null>;
  abstract update(id: string, updates: Partial<MemoryRecord>): Promise<void>;
  abstract delete(id: string): Promise<void>;
  abstract query(query: MemoryQuery): Promise<MemorySearchResult>;
  abstract count(query: MemoryQuery): Promise<number>;
  abstract getStats(): Promise<{ recordCount: number; sizeBytes: number }>;

  // Vector operations
  abstract upsertEmbedding(id: string, embedding: Float32Array): Promise<void>;
  abstract searchByEmbedding(
    embedding: Float32Array,
    filter: Partial<MemoryQuery>,
    limit: number
  ): Promise<ReadonlyArray<{ record: MemoryRecord; score: number }>>;

  // Batch operations for performance
  abstract beginTransaction(): Promise<Transaction>;
  abstract commitTransaction(tx: Transaction): Promise<void>;
  abstract rollbackTransaction(tx: Transaction): Promise<void>;
}

export interface Transaction {
  readonly id: string;
  readonly backend: MemoryBackendAdapter;
  readonly operations: Array<{ type: "insert" | "update" | "delete"; record: MemoryRecord }>;
  commit(): Promise<void>;
  rollback(): Promise<void>;
}

/**
 * Redis Backend - Episodic Memory (Fast, TTL-based)
 */
export class RedisBackend extends MemoryBackendAdapter {
  readonly type: MemoryBackend = "redis";
  readonly config: MemoryBackendConfig;

  private client: any = null; // Redis client
  private connected: boolean = false;

  constructor(config: MemoryBackendConfig) {
    super();
    this.config = { ...config, type: "redis", poolSize: config.poolSize || 10 };
  }

  async initialize(): Promise<void> {
    // In production: this.client = createRedisClient(this.config.connectionString);
    // await this.client.connect();
    this.connected = true;
  }

  async close(): Promise<void> {
    if (this.client) {
      await this.client.quit();
      this.connected = false;
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      // await this.client.ping();
      return this.connected;
    } catch {
      return false;
    }
  }

  async store(record: MemoryRecord): Promise<void> {
    // In production: await this.client.set(key, value, { EX: ttl });
    // Use Redis hashes for structured data
  }

  async storeBatch(records: ReadonlyArray<MemoryRecord>): Promise<void> {
    // Pipeline for batch inserts
  }

  async get(id: string): Promise<MemoryRecord | null> {
    // GET from Redis
    return null;
  }

  async update(id: string, updates: Partial<MemoryRecord>): Promise<void> {
    // HSET for partial updates
  }

  async delete(id: string): Promise<void> {
    // DEL key
  }

  async query(query: MemoryQuery): Promise<MemorySearchResult> {
    // Use Redis search or scan
    return { records: [], totalCount: 0, queryTimeMs: 0 };
  }

  async count(query: MemoryQuery): Promise<number> {
    return 0;
  }

  async getStats(): Promise<{ recordCount: number; sizeBytes: number }> {
    return { recordCount: 0, sizeBytes: 0 };
  }

  async upsertEmbedding(id: string, embedding: Float32Array): Promise<void> {
    // Store in Redis with vector index
  }

  async searchByEmbedding(
    embedding: Float32Array,
    filter: Partial<MemoryQuery>,
    limit: number
  ): Promise<ReadonlyArray<{ record: MemoryRecord; score: number }>> {
    // Vector similarity search using Redis vector index
    return [];
  }

  async beginTransaction(): Promise<Transaction> {
    return {
      id: crypto.randomUUID(),
      backend: this,
      operations: [],
      async commit() { /* EXEC */ },
      async rollback() { /* DISCARD */ },
    };
  }

  async commitTransaction(tx: Transaction): Promise<void> {
    await tx.commit();
  }

  async rollbackTransaction(tx: Transaction): Promise<void> {
    await tx.rollback();
  }
}

/**
 * PostgreSQL Backend - Relational + Vector (pgvector)
 */
export class PostgresBackend extends MemoryBackendAdapter {
  readonly type: MemoryBackend = "postgresql";
  readonly config: MemoryBackendConfig;

  private pool: any = null; // pg Pool
  private connected: boolean = false;

  constructor(config: MemoryBackendConfig) {
    super();
    this.config = { ...config, type: "postgresql", poolSize: config.poolSize || 20 };
  }

  async initialize(): Promise<void> {
    // this.pool = new Pool({ connectionString: this.config.connectionString, max: this.config.poolSize });
    // await this.pool.query('SELECT 1');
    this.connected = true;
  }

  async close(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
      this.connected = false;
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      // await this.pool.query('SELECT 1');
      return this.connected;
    } catch {
      return false;
    }
  }

  async store(record: MemoryRecord): Promise<void> {
    // INSERT INTO memory_records ... ON CONFLICT DO UPDATE
  }

  async storeBatch(records: ReadonlyArray<MemoryRecord>): Promise<void> {
    // COPY or multi-row INSERT
  }

  async get(id: string): Promise<MemoryRecord | null> {
    // SELECT * FROM memory_records WHERE id = $1
    return null;
  }

  async update(id: string, updates: Partial<MemoryRecord>): Promise<void> {
    // UPDATE memory_records SET ... WHERE id = $1
  }

  async delete(id: string): Promise<void> {
    // DELETE FROM memory_records WHERE id = $1
  }

  async query(query: MemoryQuery): Promise<MemorySearchResult> {
    // Build dynamic query with filters
    // Use pgvector for embedding search: embedding <=> $1
    return { records: [], totalCount: 0, queryTimeMs: 0 };
  }

  async count(query: MemoryQuery): Promise<number> {
    return 0;
  }

  async getStats(): Promise<{ recordCount: number; sizeBytes: number }> {
    return { recordCount: 0, sizeBytes: 0 };
  }

  async upsertEmbedding(id: string, embedding: Float32Array): Promise<void> {
    // UPDATE memory_records SET embedding = $1 WHERE id = $2
  }

  async searchByEmbedding(
    embedding: Float32Array,
    filter: Partial<MemoryQuery>,
    limit: number
  ): Promise<ReadonlyArray<{ record: MemoryRecord; score: number }>> {
    // SELECT *, 1 - (embedding <=> $1) as similarity FROM memory_records WHERE ... ORDER BY similarity DESC LIMIT $2
    return [];
  }

  async beginTransaction(): Promise<Transaction> {
    const client = await this.pool.connect();
    await client.query('BEGIN');
    return {
      id: crypto.randomUUID(),
      backend: this,
      operations: [],
      async commit() { await client.query('COMMIT'); client.release(); },
      async rollback() { await client.query('ROLLBACK'); client.release(); },
    };
  }

  async commitTransaction(tx: Transaction): Promise<void> {
    await tx.commit();
  }

  async rollbackTransaction(tx: Transaction): Promise<void> {
    await tx.rollback();
  }
}

/**
 * Qdrant Backend - Semantic/Vector Memory
 */
export class QdrantBackend extends MemoryBackendAdapter {
  readonly type: MemoryBackend = "qdrant";
  readonly config: MemoryBackendConfig;

  private client: any = null;
  private connected: boolean = false;

  constructor(config: MemoryBackendConfig) {
    super();
    this.config = { ...config, type: "qdrant" };
  }

  async initialize(): Promise<void> {
    // this.client = new QdrantClient({ url: this.config.connectionString });
    this.connected = true;
  }

  async close(): Promise<void> {
    this.connected = false;
  }

  async healthCheck(): Promise<boolean> {
    return this.connected;
  }

  async store(record: MemoryRecord): Promise<void> {
    // upsert points
  }

  async storeBatch(records: ReadonlyArray<MemoryRecord>): Promise<void> {
    // batch upsert
  }

  async get(id: string): Promise<MemoryRecord | null> {
    return null;
  }

  async update(id: string, updates: Partial<MemoryRecord>): Promise<void> {
    // set payload
  }

  async delete(id: string): Promise<void> {
    // delete points
  }

  async query(query: MemoryQuery): Promise<MemorySearchResult> {
    return { records: [], totalCount: 0, queryTimeMs: 0 };
  }

  async count(query: MemoryQuery): Promise<number> {
    return 0;
  }

  async getStats(): Promise<{ recordCount: number; sizeBytes: number }> {
    return { recordCount: 0, sizeBytes: 0 };
  }

  async upsertEmbedding(id: string, embedding: Float32Array): Promise<void> {
    // upsert vector
  }

async searchByEmbedding(
    embedding: Float32Array,
    filter: Partial<MemoryQuery>,
    limit: number
  ): Promise<ReadonlyArray<{ record: MemoryRecord; score: number }>> {
    // vector search with filter
    return [];
  }

  async beginTransaction(): Promise<Transaction> {
    return {
      id: crypto.randomUUID(),
      backend: this,
      operations: [],
      async commit() {},
      async rollback() {},
    };
  }

  async commitTransaction(tx: Transaction): Promise<void> {
    await tx.commit();
  }

  async rollbackTransaction(tx: Transaction): Promise<void> {
    await tx.rollback();
  }
}

/**
 * Neo4j Backend - Procedural/Graph Memory
*/
export class Neo4jBackend extends MemoryBackendAdapter {
  readonly type: MemoryBackend = "neo4j";
  readonly config: MemoryBackendConfig;

  private driver: any = null;
  private connected: boolean = false;

  constructor(config: MemoryBackendConfig) {
    super();
    this.config = { ...config, type: "neo4j" };
  }

  async initialize(): Promise<void> {
    // this.driver = neo4j.driver(this.config.connectionString);
    this.connected = true;
  }

  async close(): Promise<void> {
    if (this.driver) await this.driver.close();
    this.connected = false;
  }

  async healthCheck(): Promise<boolean> {
    return this.connected;
  }

  async store(record: MemoryRecord): Promise<void> {
    // CREATE or MERGE nodes and relationships
  }

  async storeBatch(records: ReadonlyArray<MemoryRecord>): Promise<void> {
    // UNWIND batch
  }

  async get(id: string): Promise<MemoryRecord | null> {
    return null;
  }

  async update(id: string, updates: Partial<MemoryRecord>): Promise<void> {
    // SET properties
  }

  async delete(id: string): Promise<void> {
    // DETACH DELETE
  }

  async query(query: MemoryQuery): Promise<MemorySearchResult> {
    // Cypher query with filters
    return { records: [], totalCount: 0, queryTimeMs: 0 };
  }

  async count(query: MemoryQuery): Promise<number> {
    return 0;
  }

  async getStats(): Promise<{ recordCount: number; sizeBytes: number }> {
    return { recordCount: 0, sizeBytes: 0 };
  }

  async upsertEmbedding(id: string, embedding: Float32Array): Promise<void> {
    // SET embedding property
  }

  async searchByEmbedding(
    embedding: Float32Array,
    filter: Partial<MemoryQuery>,
    limit: number
  ): Promise<ReadonlyArray<{ record: MemoryRecord; score: number }>> {
    return [];
  }

  async beginTransaction(): Promise<Transaction> {
    const session = this.driver.session();
    return {
      id: crypto.randomUUID(),
      backend: this,
      operations: [],
      async commit() { await session.commitTransaction(); await session.close(); },
      async rollback() { await session.rollbackTransaction(); await session.close(); },
    };
  }

  async commitTransaction(tx: Transaction): Promise<void> {
    await tx.commit();
  }

  async rollbackTransaction(tx: Transaction): Promise<void> {
    await tx.rollback();
  }
}

/**
 * Object Storage Backend - Long-term Memory (Cold Storage)
 */
export class ObjectStorageBackend extends MemoryBackendAdapter {
  readonly type: MemoryBackend = "object_storage";
  readonly config: MemoryBackendConfig;

  private client: any = null;
  private connected: boolean = false;

  constructor(config: MemoryBackendConfig) {
    super();
    this.config = { ...config, type: "object_storage" };
  }

  async initialize(): Promise<void> {
    // S3/MinIO/GCS client
    this.connected = true;
  }

  async close(): Promise<void> {
    this.connected = false;
  }

  async healthCheck(): Promise<boolean> {
    return this.connected;
  }

  async store(record: MemoryRecord): Promise<void> {
    // Put object
  }

  async storeBatch(records: ReadonlyArray<MemoryRecord>): Promise<void> {
    // batch upload
  }

  async get(id: string): Promise<MemoryRecord | null> {
    return null;
  }

  async update(id: string, updates: Partial<MemoryRecord>): Promise<void> {
    // overwrite object
  }

  async delete(id: string): Promise<void> {
    // delete object
  }

  async query(query: MemoryQuery): Promise<MemorySearchResult> {
    return { records: [], totalCount: 0, queryTimeMs: 0 };
  }

  async count(query: MemoryQuery): Promise<number> {
    return 0;
  }

  async getStats(): Promise<{ recordCount: number; sizeBytes: number }> {
    return { recordCount: 0, sizeBytes: 0 };
  }

  async upsertEmbedding(id: string, embedding: Float32Array): Promise<void> {
    // not applicable
  }

  async searchByEmbedding(
    embedding: Float32Array,
    filter: Partial<MemoryQuery>,
    limit: number
  ): Promise<ReadonlyArray<{ record: MemoryRecord; score: number }>> {
    return [];
  }

  async beginTransaction(): Promise<Transaction> {
    return {
      id: crypto.randomUUID(),
      backend: this,
      operations: [],
      async commit() {},
      async rollback() {},
    };
  }

  async commitTransaction(tx: Transaction): Promise<void> {
    await tx.commit();
  }

  async rollbackTransaction(tx: Transaction): Promise<void> {
    await tx.rollback();
  }
}

/**
 * Immutable Ledger Backend - Provenance Memory
 */
export class LedgerBackend extends MemoryBackendAdapter {
  readonly type: MemoryBackend = "ledger";
  readonly config: MemoryBackendConfig;

  private ledger: any = null; // BookPI or similar
  private connected: boolean = false;

  constructor(config: MemoryBackendConfig) {
    super();
    this.config = { ...config, type: "ledger" };
  }

  async initialize(): Promise<void> {
    // Initialize BookPI ledger
    this.connected = true;
  }

  async close(): Promise<void> {
    this.connected = false;
  }

  async healthCheck(): Promise<boolean> {
    return this.connected;
  }

  async store(record: MemoryRecord): Promise<void> {
    // Append to ledger with hash chain
  }

  async storeBatch(records: ReadonlyArray<MemoryRecord>): Promise<void> {
    // batch append
  }

  async get(id: string): Promise<MemoryRecord | null> {
    return null;
  }

  async update(id: string, updates: Partial<MemoryRecord>): Promise<void> {
    throw new Error("LEDGER_IMMUTABLE: Cannot update immutable ledger");
  }

  async delete(id: string): Promise<void> {
    throw new Error("LEDGER_IMMUTABLE: Cannot delete from immutable ledger");
  }

  async query(query: MemoryQuery): Promise<MemorySearchResult> {
    // Query ledger for provenance records
    return { records: [], totalCount: 0, queryTimeMs: 0 };
  }

  async count(query: MemoryQuery): Promise<number> {
    return 0;
  }

  async getStats(): Promise<{ recordCount: number; sizeBytes: number }> {
    return { recordCount: 0, sizeBytes: 0 };
  }

  async upsertEmbedding(id: string, embedding: Float32Array): Promise<void> {
    // not applicable
  }

  async searchByEmbedding(
    embedding: Float32Array,
    filter: Partial<MemoryQuery>,
    limit: number
  ): Promise<ReadonlyArray<{ record: MemoryRecord; score: number }>> {
    return [];
  }

  async beginTransaction(): Promise<Transaction> {
    return {
      id: crypto.randomUUID(),
      backend: this,
      operations: [],
      async commit() {},
      async rollback() {},
    };
  }

  async commitTransaction(tx: Transaction): Promise<void> {
    await tx.commit();
  }

  async rollbackTransaction(tx: Transaction): Promise<void> {
    await tx.rollback();
  }
}

/**
 * Memory Mesh - Unified Multi-Backend Memory System
 */
export class MemoryMesh extends EventEmitter {
  private backends: Map<MemoryBackend, MemoryBackendAdapter> = new Map();
  private config: MemoryMeshConfig;
  private consolidationTimer?: NodeJS.Timeout;

  constructor(config: Partial<MemoryMeshConfig> = {}) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.initializeBackends();
    if (this.config.autoConsolidation) {
      this.startConsolidation();
    }
  }

  private initializeBackends(): void {
    for (const backendConfig of this.config.backends) {
      const adapter = this.createBackendAdapter(backendConfig);
      this.backends.set(backendConfig.type, adapter);
    }
  }

  private createBackendAdapter(config: MemoryBackendConfig): MemoryBackendAdapter {
    switch (config.type) {
      case "redis":
        return new RedisBackend(config);
      case "postgresql":
        return new PostgresBackend(config);
      case "qdrant":
        return new QdrantBackend(config);
      case "neo4j":
        return new Neo4jBackend(config);
      case "object_storage":
        return new ObjectStorageBackend(config);
      case "ledger":
        return new LedgerBackend(config);
      default:
        throw new Error(`UNKNOWN_BACKEND: ${config.type}`);
    }
  }

  /**
   * Initialize all backends
   */
  async initialize(): Promise<void> {
    for (const [type, backend] of this.backends) {
      await backend.initialize();
      const healthy = await backend.healthCheck();
      if (!healthy) {
        throw new Error(`BACKEND_UNHEALTHY: ${type}`);
      }
    }
    
    // Initialize provenance if enabled
    if (this.config.enableProvenance) {
      const provenanceBackend = this.backends.get(this.config.provenanceBackend);
      if (!provenanceBackend) {
        throw new Error(`PROVENANCE_BACKEND_NOT_FOUND: ${this.config.provenanceBackend}`);
      }
    }

    this.emit("initialized");
  }

  /**
   * Store a memory record (routes to appropriate backend)
   */
  async store(record: MemoryRecord): Promise<void> {
    const backend = this.getBackendForType(record.type);
    await backend.store(record);
    
    // Also store provenance if enabled
    if (this.config.enableProvenance) {
      await this.storeProvenance(record);
    }
    
    this.emit("stored", record);
  }

  async storeBatch(records: ReadonlyArray<MemoryRecord>): Promise<void> {
    // Group by backend type
    const byBackend = new Map<MemoryBackend, MemoryRecord[]>();
    for (const record of records) {
      const backendType = this.getBackendTypeForRecord(record);
      const list = byBackend.get(backendType) || [];
      list.push(record);
      byBackend.set(backendType, list);
    }
    
    for (const [backendType, records] of byBackend) {
      const backend = this.getBackendForBackendType(backendType);
      await backend.storeBatch(records);
    }
    
    if (this.config.enableProvenance) {
      for (const record of records) {
        await this.storeProvenance(record);
      }
    }
    
    this.emit("batchStored", records);
  }

  private getBackendForBackendType(backendType: MemoryBackend): MemoryBackendAdapter {
    const backend = this.backends.get(backendType);
    if (!backend) {
      throw new Error(`NO_BACKEND_FOR_BACKEND_TYPE: ${backendType}`);
    }
    return backend;
  }

  /**
   * Get a memory record by ID (searches all backends)
   */
  async get(id: string): Promise<MemoryRecord | null> {
    for (const backend of this.backends.values()) {
      const record = await backend.get(id);
      if (record) return record;
    }
    return null;
  }

  async update(id: string, updates: Partial<MemoryRecord>): Promise<void> {
    // Find which backend has the record
    for (const backend of this.backends.values()) {
      const existing = await backend.get(id);
      if (existing) {
        await backend.update(id, updates);
        return;
      }
    }
    throw new Error(`MEMORY_NOT_FOUND: ${id}`);
  }

  async delete(id: string): Promise<void> {
    for (const backend of this.backends.values()) {
      const existing = await backend.get(id);
      if (existing) {
        await backend.delete(id);
        return;
      }
    }
    throw new Error(`MEMORY_NOT_FOUND: ${id}`);
  }

  /**
   * Query memory across backends
   */
  async query(query: MemoryQuery): Promise<MemorySearchResult> {
    const startTime = Date.now();
    
    let backend: MemoryBackendAdapter;
    if (query.type) {
      backend = this.getBackendForType(query.type);
    } else {
      // Query all backends and merge results
      const results = await Promise.all(
        Array.from(this.backends.values()).map(b => b.query(query))
      );
      
      const allRecords = results.flatMap(r => r.records);
      allRecords.sort((a, b) => b.importance - a.importance || b.createdAt - a.createdAt);
      
      const queryTimeMs = Date.now() - startTime;
      
      return {
        records: allRecords.slice(0, query.limit || this.config.maxRecordsPerQuery),
        totalCount: allRecords.length,
        queryTimeMs,
      };
    }
    
    return backend.query(query);
  }

  /**
   * Semantic search by embedding (uses vector backend)
   */
  async searchByEmbedding(
    embedding: Float32Array,
    filter: Partial<MemoryQuery> = {},
    limit: number = this.config.maxRecordsPerQuery
  ): Promise<ReadonlyArray<{ record: MemoryRecord; score: number }>> {
    const vectorBackend = this.backends.get("qdrant") || this.backends.get("postgresql");
    if (!vectorBackend) {
      throw new Error("NO_VECTOR_BACKEND_AVAILABLE");
    }
    
    return vectorBackend.searchByEmbedding(embedding, filter, limit);
  }

  /**
   * Get a backend for a specific memory type
   */
  private getBackendForType(type: MemoryType): MemoryBackendAdapter {
    const backendType = this.getBackendTypeForType(type);
    const backend = this.backends.get(backendType);
    if (!backend) {
      throw new Error(`NO_BACKEND_FOR_TYPE: ${type} -> ${backendType}`);
    }
    return backend;
  }

  private getBackendTypeForType(type: MemoryType): MemoryBackend {
    switch (type) {
      case "episodic":
        return "redis";
      case "semantic":
        return "qdrant";
      case "procedural":
        return "neo4j";
      case "long_term":
        return "object_storage";
      case "provenance":
        return this.config.provenanceBackend;
      default:
        return this.config.defaultBackend;
    }
  }

  private getBackendTypeForRecord(record: MemoryRecord): MemoryBackend {
    return this.getBackendTypeForType(record.type);
  }

  /**
   * Store provenance record in ledger
   */
  private async storeProvenance(record: MemoryRecord): Promise<void> {
    const provenanceBackend = this.backends.get(this.config.provenanceBackend);
    if (!provenanceBackend) return;
    
    const provenanceRecord: MemoryRecord = {
      ...record,
      type: "provenance",
      metadata: {
        ...record.metadata,
        originalType: record.type,
        originalId: record.id,
        provenanceHash: await this.computeProvenanceHash(record),
      },
    };
    
    await provenanceBackend.store(provenanceRecord);
  }

  private async computeProvenanceHash(record: MemoryRecord): Promise<string> {
    const hash = createHash("sha3-512");
    hash.update(JSON.stringify({
      id: record.id,
      content: record.content,
      embedding: record.embedding ? Array.from(record.embedding) : null,
      createdAt: record.createdAt,
    }));
    return hash.digest("hex");
  }

  /**
   * Semantic search by embedding
   */
  async semanticSearch(
    embedding: Float32Array,
    filter: Partial<MemoryQuery> = {},
    limit: number = this.config.maxRecordsPerQuery
  ): Promise<ReadonlyArray<{ record: MemoryRecord; score: number }>> {
    return this.searchByEmbedding(embedding, filter, limit);
  }

  /**
   * Hybrid search: text + embedding
   */
  async hybridSearch(
    query: string,
    embedding: Float32Array,
    filter: Partial<MemoryQuery> = {},
    limit: number = this.config.maxRecordsPerQuery,
    textWeight: number = 0.3,
    vectorWeight: number = 0.7
  ): Promise<ReadonlyArray<{ record: MemoryRecord; score: number }>> {
    // Get text search results
    const textResults = await this.query({
      ...filter,
      query,
      limit: limit * 2,
    } as MemoryQuery);
    
    // Get vector search results
    const vectorResults = await this.searchByEmbedding(embedding, filter, limit * 2);
    
    // Merge and re-rank
    const merged = new Map<string, { record: MemoryRecord; textScore: number; vectorScore: number }>();
    
    for (const record of textResults.records) {
      merged.set(record.id, { record, textScore: 1, vectorScore: 0 });
    }
    
    for (const { record, score } of vectorResults) {
      const existing = merged.get(record.id);
      if (existing) {
        existing.vectorScore = score;
      } else {
        merged.set(record.id, { record, textScore: 0, vectorScore: score });
      }
    }
    
    // Combine scores
    const results = Array.from(merged.values())
      .map(({ record, textScore, vectorScore }) => ({
        record,
        score: textWeight * textScore + vectorWeight * vectorScore,
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
    
    return results;
  }

  /**
   * Get memory statistics
   */
  async getStats(): Promise<MemoryStats> {
    const stats = await Promise.all(
      Array.from(this.backends.entries()).map(async ([type, backend]) => {
        const stats = await backend.getStats();
        return { type, ...stats };
      })
    );
    
    return {
      totalRecords: stats.reduce((sum, s) => sum + s.recordCount, 0),
      byType: stats.reduce((acc, s) => ({ ...acc, [s.type]: s.recordCount }), {} as Record<MemoryType, number>),
      byBackend: stats.reduce((acc, s) => ({ ...acc, [s.type]: s.sizeBytes }), {} as Record<MemoryBackend, number>),
      totalSizeBytes: stats.reduce((sum, s) => sum + s.sizeBytes, 0),
      avgImportance: 0, // Would need to compute
      oldestRecord: 0,
      newestRecord: Date.now(),
    };
  }

  /**
   * Consolidate memories (move old/low-importance to cold storage)
   */
  async consolidate(): Promise<{ moved: number; archived: number }> {
    let moved = 0;
    let archived = 0;
    
    const episodicBackend = this.backends.get("redis");
    const longTermBackend = this.backends.get("object_storage");
    
    if (!episodicBackend || !longTermBackend) return { moved: 0, archived: 0 };
    
    const cutoffTime = Date.now() - this.config.maxAgeMs;
    const importanceThreshold = this.config.importanceThreshold;
    
    // In production, would query for old/low-importance records
    // and move them to object storage
    
    this.emit("consolidated", { moved, archived });
    return { moved, archived };
  }

  /**
   * Start automatic consolidation
   */
  private startConsolidation(): void {
    this.consolidationTimer = setInterval(() => {
      this.consolidate().catch(err => this.emit("error", err));
    }, this.config.consolidationIntervalMs);
  }

  /**
   * Stop consolidation timer
   */
  stopConsolidation(): void {
    if (this.consolidationTimer) {
      clearInterval(this.consolidationTimer);
      this.consolidationTimer = undefined;
    }
  }

  /**
   * Health check all backends
   */
  async healthCheck(): Promise<Record<MemoryBackend, boolean>> {
    const results: Record<MemoryBackend, boolean> = {} as any;
    for (const [type, backend] of this.backends) {
      results[type] = await backend.healthCheck();
    }
    return results;
  }

  /**
   * Close all backends
   */
  async close(): Promise<void> {
    this.stopConsolidation();
    for (const backend of this.backends.values()) {
      await backend.close();
    }
  }

  /**
   * Get backend for direct access
   */
  getBackend(type: MemoryBackend): MemoryBackendAdapter | undefined {
    return this.backends.get(type);
  }
}

/**
 * Default memory mesh instance
 */
export const defaultMemoryMesh = new MemoryMesh({
  backends: [
    { type: "redis", connectionString: process.env.REDIS_URL || "redis://localhost:6379" },
    { type: "postgresql", connectionString: process.env.DATABASE_URL || "postgresql://localhost:5432/isabella" },
    { type: "qdrant", connectionString: process.env.QDRANT_URL || "http://localhost:6333" },
    { type: "neo4j", connectionString: process.env.NEO4J_URI || "bolt://localhost:7687" },
    { type: "object_storage", connectionString: process.env.S3_ENDPOINT || "http://localhost:9000" },
    { type: "ledger", connectionString: "bookpi://local" },
  ],
  defaultBackend: "postgresql",
  embeddingModel: "nomic-embed-text-v1.5",
  embeddingDimensions: 768,
  enableProvenance: true,
  provenanceBackend: "ledger",
});