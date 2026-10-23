/**
 * Paquete de evidencia verificable OFFLINE (state: draft | engine-generated).
 *
 * Exporta un tramo de la cadena BookPI con su raíz de Merkle RFC 6962 y, opcionalmente, un Signed Tree Head
 * Ed25519. `verifyEvidenceBundle` NO necesita el servidor: recalcula cada hash, los enlaces previousHash,
 * la secuencia, la raíz y la firma. Prueba integridad e internal consistency; NO prueba que los hechos
 * registrados sean verdaderos ni sustituye anclaje externo (RFC 3161) ni WORM (EVIDENCE ≠ TRUTH).
 */
import { createHash, type KeyObject } from "node:crypto";
import { TransparencyLog, verifySignedTreeHead, type SignedTreeHead } from "./transparency";
import type { BookPiEvent } from "./ledger";

export const EVIDENCE_BUNDLE_VERSION = "1.0.0";
export const BOOKPI_GENESIS = "0".repeat(64);

export interface EvidenceBundle {
  readonly version: string;
  readonly createdAt: string;
  readonly events: readonly BookPiEvent[];
  /** previousHash esperado del primer evento (genesis si el tramo empieza en 0). */
  readonly anchorPreviousHash: string;
  readonly chainHead: string | null;
  readonly merkle: { readonly scheme: "RFC6962-SHA256"; readonly size: number; readonly root: string };
  readonly signedTreeHead?: SignedTreeHead;
}

function chainHash(e: BookPiEvent): string {
  return createHash("sha256")
    .update(JSON.stringify({ id: e.id, timestamp: e.timestamp, type: e.type, methodId: e.methodId, principal: e.principal, riskTier: e.riskTier, status: e.status, previousHash: e.previousHash }))
    .digest("hex");
}

function merkleOf(events: readonly BookPiEvent[]): TransparencyLog {
  const log = new TransparencyLog();
  for (const e of events) log.append(Buffer.from(e.hash, "hex"));
  return log;
}

export function createEvidenceBundle(events: readonly BookPiEvent[], options: { signingKey?: KeyObject; now?: Date } = {}): EvidenceBundle {
  if (events.length === 0) throw new RangeError("EVIDENCE: cannot bundle an empty event list");
  const first = events[0] as BookPiEvent;
  const log = merkleOf(events);
  const now = options.now ?? new Date();
  const base = {
    version: EVIDENCE_BUNDLE_VERSION,
    createdAt: now.toISOString(),
    events: events.map((e) => ({ ...e })),
    anchorPreviousHash: first.previousHash,
    chainHead: (events[events.length - 1] as BookPiEvent).hash,
    merkle: { scheme: "RFC6962-SHA256" as const, size: log.size, root: log.rootHash() },
  };
  return options.signingKey === undefined ? base : { ...base, signedTreeHead: log.signTreeHead(options.signingKey, now) };
}

export interface BundleVerification {
  readonly valid: boolean;
  readonly signatureChecked: boolean;
  readonly reasons: readonly string[];
}

export function verifyEvidenceBundle(bundle: EvidenceBundle, options: { publicKey?: KeyObject; expectedHead?: string; requireSignature?: boolean } = {}): BundleVerification {
  const reasons: string[] = [];
  if (bundle.version !== EVIDENCE_BUNDLE_VERSION) reasons.push("UNSUPPORTED_VERSION");
  if (bundle.events.length === 0) reasons.push("EMPTY_BUNDLE");
  let prev = bundle.anchorPreviousHash;
  let expectedSeq: number | null = null;
  bundle.events.forEach((e, i) => {
    if (e.previousHash !== prev) reasons.push(`BROKEN_LINK@${i}`);
    if (chainHash(e) !== e.hash) reasons.push(`HASH_MISMATCH@${i}`);
    if (expectedSeq !== null && e.sequence !== expectedSeq) reasons.push(`SEQUENCE_GAP@${i}`);
    expectedSeq = e.sequence + 1;
    prev = e.hash;
  });
  const head = bundle.events.length > 0 ? (bundle.events[bundle.events.length - 1] as BookPiEvent).hash : null;
  if (bundle.chainHead !== head) reasons.push("CHAIN_HEAD_MISMATCH");
  if (options.expectedHead !== undefined && options.expectedHead !== head) reasons.push("UNEXPECTED_HEAD");
  if (bundle.events.length > 0) {
    const log = merkleOf(bundle.events);
    if (bundle.merkle.size !== log.size || bundle.merkle.root !== log.rootHash()) reasons.push("MERKLE_MISMATCH");
  }
  let signatureChecked = false;
  const sth = bundle.signedTreeHead;
  if (sth !== undefined) {
    if (sth.treeSize !== bundle.merkle.size || sth.rootHash !== bundle.merkle.root) reasons.push("STH_DOES_NOT_MATCH_BUNDLE");
    if (options.publicKey !== undefined) {
      signatureChecked = true;
      if (!verifySignedTreeHead(sth, options.publicKey)) reasons.push("STH_SIGNATURE_INVALID");
    }
  } else if (options.requireSignature === true) {
    reasons.push("SIGNATURE_REQUIRED");
  }
  if (options.requireSignature === true && options.publicKey === undefined) reasons.push("PUBLIC_KEY_REQUIRED");
  return { valid: reasons.length === 0, signatureChecked, reasons };
}
