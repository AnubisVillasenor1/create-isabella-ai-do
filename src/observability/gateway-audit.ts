/**
 * Gateway activity ledger (state: draft | engine-generated).
 *
 * A bounded, in-process ring of the multi-provider LLM gateway requests, mirroring the
 * "Recent Activity / Live Log Tail" panel of a local gateway. It is observability, NOT
 * an authority record: the durable, append-only evidence plane remains BookPI.
 *
 * Privacy invariant: every free-text preview stored here is passed through the validated
 * PII/secret redactor BEFORE it is kept, so raw prompts, bearer tokens and identifiers
 * never persist in memory exposed by the read route. The client key is a salted one-way
 * hash: enough to bucket a client, impossible to reverse to an IP.
 */
import { createHash } from 'node:crypto';
import { redactText } from '../privacy/pii-redactor';

export type GatewayProvider = 'openai' | 'anthropic' | 'google' | 'llama';

export interface GatewayAuditInput {
  readonly provider: GatewayProvider;
  readonly endpoint: string;
  readonly model: string;
  readonly status: number;
  readonly latencyMs: number;
  readonly ip: string | undefined;
  readonly prompt: string;
  readonly completion: string;
  readonly stream: boolean;
  readonly now?: number;
}

export interface GatewayAuditRecord {
  readonly ts: number;
  readonly provider: GatewayProvider;
  readonly endpoint: string;
  readonly model: string;
  readonly status: number;
  readonly latencyMs: number;
  readonly clientKey: string;
  readonly promptChars: number;
  readonly completionChars: number;
  readonly preview: string;
  readonly stream: boolean;
}

const PREVIEW_CHARS = 160;

/** Stable, non-reversible bucket for a client without storing the raw IP. */
export function hashClientKey(ip: string | undefined, salt: string): string {
  const normalized = (ip ?? 'unknown').trim();
  return createHash('sha256').update(`${salt}:${normalized}`).digest('hex').slice(0, 16);
}

export class GatewayAuditLog {
  private readonly entries: GatewayAuditRecord[] = [];

  constructor(
    private readonly maxEntries = 500,
    private readonly salt = 'isabella-gateway'
  ) {
    if (!Number.isInteger(maxEntries) || maxEntries < 1)
      throw new Error('AUDIT_MAX_ENTRIES_INVALID');
  }

  record(input: GatewayAuditInput): GatewayAuditRecord {
    const preview = redactText(input.prompt.slice(0, PREVIEW_CHARS)).text;
    const record: GatewayAuditRecord = {
      ts: input.now ?? Date.now(),
      provider: input.provider,
      endpoint: input.endpoint,
      model: input.model,
      status: input.status,
      latencyMs: input.latencyMs,
      clientKey: hashClientKey(input.ip, this.salt),
      promptChars: input.prompt.length,
      completionChars: input.completion.length,
      preview,
      stream: input.stream,
    };
    this.entries.push(record);
    if (this.entries.length > this.maxEntries)
      this.entries.splice(0, this.entries.length - this.maxEntries);
    return record;
  }

  /** Most-recent first, so a dashboard reads the newest activity without slicing. */
  recent(limit = 50): GatewayAuditRecord[] {
    const n = Math.max(0, Math.min(limit, this.entries.length));
    return this.entries.slice(this.entries.length - n).reverse();
  }

  size(): number {
    return this.entries.length;
  }
}
