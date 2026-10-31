/**
 * BookPI audit ledger retention — pure planning. state: draft | engine-generated.
 *
 * Retention is planning-only: it computes which events keep and which form an
 * archived prefix. It does NOT delete anything by itself. Physical pruning is an
 * explicit, human-approved operation (`DurableBookPiLedger.prune`) that writes
 * an archive + checkpoint first so the chain stays verifiable.
 */
import type { BookPiEvent } from './ledger';

export interface RetentionPolicy {
  /** Keep at most this many most-recent events. */
  maxEvents?: number;
  /** Archive events older than this many milliseconds. */
  maxAgeMs?: number;
  /** Reference time (ms since epoch); defaults to Date.now(). */
  now?: number;
}

export interface RetentionCheckpoint {
  archivedCount: number;
  lastArchivedHash: string | null;
  firstKeptSequence: number | null;
}

export interface RetentionPlan {
  kept: readonly BookPiEvent[];
  archived: readonly BookPiEvent[];
  checkpoint: RetentionCheckpoint | null;
}

export function planRetention(
  events: readonly BookPiEvent[],
  policy: RetentionPolicy
): RetentionPlan {
  const now = policy.now ?? Date.now();
  let cut = 0;

  if (policy.maxEvents !== undefined) {
    if (!Number.isInteger(policy.maxEvents) || policy.maxEvents < 0) {
      throw new Error('RETENTION_MAX_EVENTS_INVALID');
    }
    if (events.length > policy.maxEvents) cut = Math.max(cut, events.length - policy.maxEvents);
  }

  if (policy.maxAgeMs !== undefined) {
    if (!Number.isFinite(policy.maxAgeMs) || policy.maxAgeMs < 0) {
      throw new Error('RETENTION_MAX_AGE_INVALID');
    }
    const threshold = now - policy.maxAgeMs;
    let index = 0;
    while (index < events.length) {
      const event = events[index];
      if (!event || Date.parse(event.timestamp) >= threshold) break;
      index += 1;
    }
    cut = Math.max(cut, index);
  }

  const archived = Object.freeze(events.slice(0, cut).map((event) => Object.freeze({ ...event })));
  const kept = Object.freeze(events.slice(cut).map((event) => Object.freeze({ ...event })));

  const checkpoint: RetentionCheckpoint | null =
    archived.length > 0
      ? {
          archivedCount: archived.length,
          lastArchivedHash: archived.at(-1)?.hash ?? null,
          firstKeptSequence: kept.at(0)?.sequence ?? null,
        }
      : null;

  return { kept, archived, checkpoint };
}

/** Serialize an archived prefix to JSONL for offline storage. */
export function serializeArchive(archived: readonly BookPiEvent[]): string {
  return (
    archived.map((event) => JSON.stringify(event)).join('\n') + (archived.length > 0 ? '\n' : '')
  );
}
