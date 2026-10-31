import type {
  IKESEnginePersistencePort,
  IKESEngineSnapshot,
  KnowledgeClaim,
  KnowledgeSource,
} from './ikes';

export interface SupabaseIkesConfig {
  supabaseUrl: string;
  serviceRoleKey: string;
  requestTimeoutMs?: number;
  pageSize?: number;
}

interface SourceRow {
  source_id: string;
  uri: string;
  title: string;
  publisher: string | null;
  published_at: string | null;
  retrieved_at: string;
  content_hash: string;
  license: string | null;
}
interface ClaimRow {
  claim_id: string;
  subject: string;
  predicate: string;
  object_value: string;
  source_ids: string[];
  evidence_ids: string[];
  epistemic_state: KnowledgeClaim['epistemicState'];
  temporal_state: KnowledgeClaim['temporalState'];
  valid_from: string | null;
  valid_until: string | null;
  license: string | null;
  provenance: Record<string, string>;
  content_hash: string;
  version: number;
}

function safeHttpError(status: number): Error {
  return new Error(`IKES_SUPABASE_HTTP_${status}`);
}

export class SupabaseIkesPersistence implements IKESEnginePersistencePort {
  private readonly baseUrl: string;
  private readonly key: string;
  private readonly timeoutMs: number;
  private readonly pageSize: number;

  constructor(config: SupabaseIkesConfig) {
    const baseUrl = config.supabaseUrl.trim().replace(/\/+$/, '');
    const key = config.serviceRoleKey.trim();
    if (!/^https:\/\//i.test(baseUrl) || !key) throw new Error('IKES_SUPABASE_CONFIG_INVALID');
    this.baseUrl = baseUrl;
    this.key = key;
    this.timeoutMs = config.requestTimeoutMs ?? 2_000;
    this.pageSize = config.pageSize ?? 500;
    if (!Number.isInteger(this.timeoutMs) || this.timeoutMs < 250 || this.timeoutMs > 30_000) {
      throw new Error('IKES_SUPABASE_TIMEOUT_INVALID');
    }
    if (!Number.isInteger(this.pageSize) || this.pageSize < 1 || this.pageSize > 1000) {
      throw new Error('IKES_SUPABASE_PAGE_SIZE_INVALID');
    }
  }

  private async request<T>(table: string, query: string, init: RequestInit = {}): Promise<T> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const headers = new Headers(init.headers);
      headers.set('apikey', this.key);
      headers.set('authorization', `Bearer ${this.key}`);
      if (!headers.has('content-type')) headers.set('content-type', 'application/json');
      const response = await fetch(`${this.baseUrl}/rest/v1/${table}${query}`, {
        ...init,
        signal: controller.signal,
        headers,
      });
      if (!response.ok) throw safeHttpError(response.status);
      if (
        response.status === 204 ||
        (init.method === 'POST' && /return=minimal/iu.test(headers.get('prefer') ?? ''))
      ) {
        return undefined as T;
      }
      return (await response.json()) as T;
    } finally {
      clearTimeout(timeout);
    }
  }

  private async allRows<T>(table: string, select: string, order: string): Promise<T[]> {
    const all: T[] = [];
    for (let offset = 0; ; offset += this.pageSize) {
      const rows = await this.request<T[]>(
        table,
        `?select=${select}&order=${order}&limit=${this.pageSize}`,
        { headers: { Range: `${offset}-${offset + this.pageSize - 1}`, 'Range-Unit': 'items' } }
      );
      if (!Array.isArray(rows)) throw new Error('IKES_SUPABASE_RESPONSE_INVALID');
      all.push(...rows);
      if (rows.length < this.pageSize) return all;
      if (all.length >= 100_000) throw new Error('IKES_SUPABASE_SNAPSHOT_LIMIT_EXCEEDED');
    }
  }

  async load(): Promise<IKESEngineSnapshot> {
    const [sourceRows, claimRows] = await Promise.all([
      this.allRows<SourceRow>(
        'atlas_knowledge_sources',
        'source_id,uri,title,publisher,published_at,retrieved_at,content_hash,license',
        'source_id.asc'
      ),
      this.allRows<ClaimRow>(
        'atlas_knowledge_claims',
        'claim_id,subject,predicate,object_value,source_ids,evidence_ids,epistemic_state,temporal_state,valid_from,valid_until,license,provenance,content_hash,version',
        'claim_id.asc'
      ),
    ]);
    return {
      sources: sourceRows.map((row) => ({
        sourceId: row.source_id,
        uri: row.uri,
        title: row.title,
        ...(row.publisher ? { publisher: row.publisher } : {}),
        ...(row.published_at ? { publishedAt: row.published_at } : {}),
        retrievedAt: row.retrieved_at,
        contentHash: row.content_hash,
        ...(row.license ? { license: row.license } : {}),
      })),
      claims: claimRows.map((row) => ({
        claimId: row.claim_id,
        subject: row.subject,
        predicate: row.predicate,
        object: row.object_value,
        sourceIds: row.source_ids,
        evidenceIds: row.evidence_ids,
        epistemicState: row.epistemic_state,
        temporalState: row.temporal_state,
        ...(row.valid_from ? { validFrom: row.valid_from } : {}),
        ...(row.valid_until ? { validUntil: row.valid_until } : {}),
        ...(row.license ? { license: row.license } : {}),
        provenance: row.provenance ?? {},
        contentHash: row.content_hash,
        version: row.version,
      })),
    };
  }

  async saveSource(source: KnowledgeSource): Promise<void> {
    await this.request('atlas_knowledge_sources', '?on_conflict=source_id', {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify([
        {
          source_id: source.sourceId,
          uri: source.uri,
          title: source.title,
          publisher: source.publisher ?? null,
          published_at: source.publishedAt ?? null,
          retrieved_at: source.retrievedAt,
          content_hash: source.contentHash,
          license: source.license ?? null,
        },
      ]),
    });
  }

  async saveClaim(claim: KnowledgeClaim): Promise<void> {
    await this.request('atlas_knowledge_claims', '?on_conflict=claim_id', {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify([
        {
          claim_id: claim.claimId,
          subject: claim.subject,
          predicate: claim.predicate,
          object_value: claim.object,
          source_ids: claim.sourceIds,
          evidence_ids: claim.evidenceIds,
          epistemic_state: claim.epistemicState,
          temporal_state: claim.temporalState,
          valid_from: claim.validFrom ?? null,
          valid_until: claim.validUntil ?? null,
          license: claim.license ?? null,
          provenance: claim.provenance,
          content_hash: claim.contentHash,
          version: claim.version,
        },
      ]),
    });
  }

  async health(): Promise<{ healthy: boolean; reason: string }> {
    try {
      await Promise.all([
        this.request<unknown[]>('atlas_knowledge_sources', '?select=source_id&limit=1'),
        this.request<unknown[]>('atlas_knowledge_claims', '?select=claim_id&limit=1'),
      ]);
      return { healthy: true, reason: 'IKES source and claim tables are reachable.' };
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      const status = message.match(/IKES_SUPABASE_HTTP_(\d{3})/u)?.[1];
      return {
        healthy: false,
        reason: status
          ? `IKES persistence tables returned HTTP ${status}.`
          : 'IKES persistence health probe failed; inspect restricted server logs.',
      };
    }
  }
}

export function createSupabaseIkesPersistence(
  env: NodeJS.ProcessEnv = process.env
): SupabaseIkesPersistence | undefined {
  const supabaseUrl = env.SUPABASE_URL?.trim();
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!supabaseUrl || !serviceRoleKey) return undefined;
  return new SupabaseIkesPersistence({ supabaseUrl, serviceRoleKey });
}
