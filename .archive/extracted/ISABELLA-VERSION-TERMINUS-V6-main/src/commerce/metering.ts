/**
 * COMMERCE — usage metering (state: draft | engine-generated).
 *
 * In-memory usage counters bucketed per workspace, per quota key, per UTC day.
 * Bounded to avoid unbounded memory growth. This is the metering layer the
 * entitlement checks consult; a durable metering backend can implement the same
 * `UsageMeterPort` later.
 */
import type { QuotaKey } from "./types";

export interface UsageMeterOptions {
  readonly now?: () => Date;
  readonly maxKeys?: number;
}

export class UsageMeter {
  private readonly now: () => Date;
  private readonly maxKeys: number;
  private readonly buckets = new Map<string, number>();

  constructor(options: { now?: () => Date; maxKeys?: number } = {}) {
    this.now = options.now ?? (() => new Date());
    this.maxKeys = options.maxKeys ?? 10000;
  }

  private key(workspaceId: string, quotaKey: QuotaKey, day: string): string {
    return `${workspaceId}\u0000${quotaKey}\u0000${day}`;
  }

  increment(workspaceId: string, quotaKey: QuotaKey, amount = 1, at: Date = this.now()): number {
    if (amount <= 0) throw new Error("METER_AMOUNT_INVALID");
    const k = this.key(workspaceId, quotaKey, at.toISOString().slice(0, 10));
    const next = (this.buckets.get(k) ?? 0) + amount;
    this.buckets.set(k, next);
    if (this.buckets.size > this.maxKeys) this.evictOldest();
    return next;
  }

  getUsage(workspaceId: string, quotaKey: QuotaKey, at: Date = this.now()): number {
    return this.buckets.get(this.key(workspaceId, quotaKey, at.toISOString().slice(0, 10))) ?? 0;
  }

  snapshot(workspaceId: string, at: Date = this.now()): Partial<Record<QuotaKey, number>> {
    const day = at.toISOString().slice(0, 10);
    const out: Partial<Record<QuotaKey, number>> = {};
    for (const [k, value] of this.buckets) {
      const [wsId, quotaKey, bucketDay] = k.split("\u0000");
      if (wsId === workspaceId && bucketDay === day) out[quotaKey as QuotaKey] = value;
    }
    return out;
  }

  reset(workspaceId?: string, at: Date = this.now()): void {
    const day = at.toISOString().slice(0, 10);
    for (const k of [...this.buckets.keys()]) {
      const [wsId, , bucketDay] = k.split("\u0000");
      if (bucketDay === day && (workspaceId === undefined || wsId === workspaceId)) this.buckets.delete(k);
    }
  }

  private evictOldest(): void {
    const first = this.buckets.keys().next().value as string | undefined;
    if (first !== undefined) this.buckets.delete(first);
  }
}
