import { randomUUID } from "node:crypto";
import { computeEventHash, computeEventIntegrity, eventCore, ZERO_HASH } from "./crypto";
import { bookPiSecret } from "../security/secrets";
import type { BookPiEventContext, BookPiEventCore, BookPiEventRecord, BookPiEventSeed } from "./types";

export const BOOKPI_INTEGRITY_ALGORITHM = "SHA3-512(secret:eventHash)";
export const BOOKPI_EVENT_HASH_ALGORITHM = "SHA-256(canonicalEventCore)";

export function buildBookPiEvent(
  seed: BookPiEventSeed,
  ctx: Partial<BookPiEventContext> = {},
): BookPiEventRecord {
  const secret = bookPiSecret(ctx.secret);
  const base: BookPiEventCore = {
    type: seed.header.type,
    id: randomUUID(),
    sequence: ctx.sequence ?? 1,
    prevHash: ctx.prevHash ?? ZERO_HASH,
    timestamp: ctx.timestamp ?? new Date().toISOString(),
    actorId: ctx.actorId,
    header: seed.header,
    payload: seed.payload,
    schemaVersion: seed.schemaVersion,
    meta: seed.meta ?? {},
  };
  const hash = computeEventHash(base);
  return { ...base, hash, integrity: computeEventIntegrity(hash, secret), canonical: eventCore(base) };
}
