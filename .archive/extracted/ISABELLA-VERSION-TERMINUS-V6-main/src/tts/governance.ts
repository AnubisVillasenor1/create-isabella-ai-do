/**
 * state: engine-generated
 * Governance for speech synthesis: anti-replay nonces with TTL, actor requirement (strict mode), size caps,
 * and a SHA3-512 evidence seal over the FULL normalized text digest (not a truncated prefix).
 * CAPABILITY ≠ AUTHORITY: passing this check only means the request is well-formed and not replayed.
 */
import { createHash } from "node:crypto";

export type GovernanceVerdict = { readonly allowed: true; readonly reason: "PASSED" } | { readonly allowed: false; readonly reason: "NONCE_REPLAY_DETECTED" | "ACTOR_ID_REQUIRED" | "TEXT_EMPTY" | "TEXT_TOO_LONG" | "NONCE_INVALID" };

export interface GovernorOptions { readonly strict?: boolean; readonly nonceTtlMs?: number; readonly maxNonces?: number; readonly maxChars?: number; readonly now?: () => number }

export class TtsGovernor {
  private readonly nonces = new Map<string, number>();
  private readonly strict: boolean;
  private readonly ttl: number;
  private readonly maxNonces: number;
  readonly maxChars: number;
  private readonly now: () => number;

  constructor(o: GovernorOptions = {}) {
    this.strict = o.strict ?? false;
    this.ttl = o.nonceTtlMs ?? 10 * 60_000;
    this.maxNonces = o.maxNonces ?? 10_000;
    this.maxChars = o.maxChars ?? 2_000;
    this.now = o.now ?? Date.now;
  }

  validate(input: { nonce?: string | undefined; actorId?: string | undefined; textLength: number }): GovernanceVerdict {
    if (input.textLength <= 0) return { allowed: false, reason: "TEXT_EMPTY" };
    if (input.textLength > this.maxChars) return { allowed: false, reason: "TEXT_TOO_LONG" };
    if (this.strict && !input.actorId) return { allowed: false, reason: "ACTOR_ID_REQUIRED" };
    if (input.nonce !== undefined) {
      if (!/^[\w-]{8,128}$/.test(input.nonce)) return { allowed: false, reason: "NONCE_INVALID" };
      this.sweep();
      const key = `${input.actorId ?? ""}|${input.nonce}`;
      if (this.nonces.has(key)) return { allowed: false, reason: "NONCE_REPLAY_DETECTED" };
      this.nonces.set(key, this.now() + this.ttl);
      if (this.nonces.size > this.maxNonces) { const oldest = this.nonces.keys().next().value; if (oldest !== undefined) this.nonces.delete(oldest); }
    }
    return { allowed: true, reason: "PASSED" };
  }

  private sweep(): void {
    const t = this.now();
    for (const [k, exp] of this.nonces) { if (exp <= t) this.nonces.delete(k); else break; }
  }
}

export function sealTtsEvidence(input: { traceId: string; normalizedText: string; backend: string; planDigest: string }): string {
  const textDigest = createHash("sha256").update(input.normalizedText, "utf8").digest("hex");
  return createHash("sha3-512").update(JSON.stringify({ traceId: input.traceId, textDigest, backend: input.backend, planDigest: input.planDigest }), "utf8").digest("hex");
}

export function digestJson(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value), "utf8").digest("hex");
}
