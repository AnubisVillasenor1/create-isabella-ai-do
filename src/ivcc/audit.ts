/**
 * Append-only audit chain for IVCC. Each event hashes its own fields plus the
 * previous hash, so silent edits or deletions break verification. Events carry
 * salted hashes and digests, never raw text, raw subjects or audio.
 */
import { canonicalJson, sha256Hex } from './util';
import type { AuditEvent, AuditEventType, IvccState } from './types';

export const AUDIT_GENESIS = 'GENESIS';

export interface AuditInput {
  readonly event: AuditEventType;
  readonly subjectHash: string | null;
  readonly actor: string;
  readonly detail: Readonly<Record<string, unknown>>;
  readonly at: string;
}

export function appendAudit(state: IvccState, input: AuditInput): AuditEvent {
  const previous = state.audit.at(-1);
  const seq = (previous?.seq ?? 0) + 1;
  const prevHash = previous?.hash ?? AUDIT_GENESIS;
  const base = {
    seq,
    at: input.at,
    event: input.event,
    subjectHash: input.subjectHash,
    actor: input.actor,
    detail: input.detail,
    prevHash,
  };
  const hash = sha256Hex(canonicalJson(base));
  const event: AuditEvent = { ...base, hash };
  state.audit.push(event);
  return event;
}

export function verifyAuditChain(events: readonly AuditEvent[]): boolean {
  let previousHash = AUDIT_GENESIS;
  for (let index = 0; index < events.length; index += 1) {
    const event = events[index]!;
    if (event.seq !== index + 1) return false;
    if (event.prevHash !== previousHash) return false;
    const base = {
      seq: event.seq,
      at: event.at,
      event: event.event,
      subjectHash: event.subjectHash,
      actor: event.actor,
      detail: event.detail,
      prevHash: event.prevHash,
    };
    if (sha256Hex(canonicalJson(base)) !== event.hash) return false;
    previousHash = event.hash;
  }
  return true;
}
