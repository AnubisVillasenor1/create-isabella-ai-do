/**
 * Atlas canonical documents — identidad de documentos, canonicalización y
 * estados del ciclo de vida (Atlas Trascendence, núcleo de contratos).
 *
 * Esquema document_uid: ATLAS-DOC-{federation}-{namespace}-{ULID}-{hash_prefix}
 * Estados: draft → validated → published → archived.
 */
import { createHash, randomBytes } from "node:crypto";

export type DocumentState = "draft" | "validated" | "published" | "archived";

export const DOCUMENT_STATES: readonly DocumentState[] = ["draft", "validated", "published", "archived"];

const DOCUMENT_TRANSITIONS: Readonly<Record<DocumentState, readonly DocumentState[]>> = {
  draft: ["validated", "archived"],
  validated: ["published", "archived", "draft"],
  published: ["archived"],
  archived: [],
};

export function allowDocumentTransition(from: DocumentState, to: DocumentState): boolean {
  return DOCUMENT_TRANSITIONS[from].includes(to);
}

export interface DocumentInput {
  federation: string;
  namespace: string;
  title: string;
  content: string;
  metadata?: Readonly<Record<string, unknown>>;
}

export interface CanonicalDocument {
  title: string;
  content: string;
  namespace: string;
  metadata: Readonly<Record<string, unknown>>;
}

export interface CanonicalDocumentRecord extends CanonicalDocument {
  documentUid: string;
  version: number;
  state: DocumentState;
  canonicalHash: string;
}

const FEDERATION_RE = /^F[1-7]$/;
const NAMESPACE_RE = /^[A-Z][A-Z0-9]{1,15}$/;

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortValue);
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return Object.fromEntries(Object.keys(record).sort().map((key) => [key, sortValue(record[key])]));
  }
  return value;
}

/** Canonicaliza el documento (trim, whitespace normalizado, claves ordenadas). */
export function canonicalizeDocument(doc: DocumentInput): CanonicalDocument {
  if (!FEDERATION_RE.test(doc.federation)) throw new Error(`ATLAS: invalid federation '${doc.federation}' (expected F1..F7)`);
  if (!NAMESPACE_RE.test(doc.namespace)) throw new Error(`ATLAS: invalid namespace '${doc.namespace}'`);
  if (!doc.title.trim() || !doc.content.trim()) throw new Error("ATLAS: title and content are required");
  return {
    title: doc.title.trim(),
    content: normalizeWhitespace(doc.content),
    namespace: doc.namespace.toUpperCase(),
    metadata: sortValue(doc.metadata ?? {}) as Readonly<Record<string, unknown>>,
  };
}

/** Hash SHA-256 del documento canonicalizado. */
export function hashCanonicalDocument(doc: CanonicalDocument): string {
  return createHash("sha256").update(JSON.stringify(doc)).digest("hex");
}

const CROCKFORD = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

/**
 * ULID Crockford: 26 caracteres = 10 de tiempo (48 bits) + 16 aleatorios (80 bits).
 * El primer carácter de tiempo queda por debajo de '8' para no desbordar 128 bits.
 */
export function generateUlid(timeMs = Date.now()): string {
  let time = timeMs;
  const timeChars: string[] = new Array(10);
  for (let i = 9; i >= 0; i -= 1) {
    timeChars[i] = CROCKFORD[time % 32] ?? "0";
    time = Math.floor(time / 32);
  }
  // 80 bits aleatorios = 16 caracteres Crockford de 5 bits (16 * 5 = 80).
  const random = randomBytes(10);
  let accumulator = 0;
  let bits = 0;
  let randomPart = "";
  for (const byte of random) {
    accumulator = ((accumulator << 8) | byte) >>> 0;
    bits += 8;
    while (bits >= 5 && randomPart.length < 16) {
      bits -= 5;
      randomPart += CROCKFORD[(accumulator >>> bits) & 31] ?? "0";
    }
  }
  return timeChars.join("") + randomPart.slice(0, 16);
}

/** Construye el document_uid canónico. */
export function buildDocumentUid(input: {
  federation: string;
  namespace: string;
  canonicalHash: string;
  ulid?: string;
}): string {
  if (!FEDERATION_RE.test(input.federation)) throw new Error("ATLAS: invalid federation");
  if (!NAMESPACE_RE.test(input.namespace)) throw new Error("ATLAS: invalid namespace");
  const ulid = input.ulid ?? generateUlid();
  const hashPrefix = input.canonicalHash.slice(0, 8);
  return `ATLAS-DOC-${input.federation}-${input.namespace.toUpperCase()}-${ulid}-${hashPrefix}`;
}

/** Crea un registro documental canónico en estado draft, versión 1. */
export function createCanonicalDocument(doc: DocumentInput): CanonicalDocumentRecord {
  const canonical = canonicalizeDocument(doc);
  const canonicalHash = hashCanonicalDocument(canonical);
  const documentUid = buildDocumentUid({ federation: doc.federation, namespace: canonical.namespace, canonicalHash });
  return { ...canonical, documentUid, version: 1, state: "draft", canonicalHash };
}

export interface DocumentVersioning {
  documentUid: string;
  previousVersion: number;
  newVersion: number;
  canonicalHashBefore: string;
  canonicalHashAfter: string;
}

/** Versiona un documento canonicalizado; falla si el contenido no cambió. */
export function versionDocument(previous: CanonicalDocumentRecord, doc: DocumentInput): {
  record: CanonicalDocumentRecord;
  change: DocumentVersioning;
} {
  const canonical = canonicalizeDocument(doc);
  const canonicalHashAfter = hashCanonicalDocument(canonical);
  if (canonicalHashAfter === previous.canonicalHash) {
    throw new Error("ATLAS: versioning requires a content change");
  }
  const record: CanonicalDocumentRecord = {
    ...canonical,
    documentUid: previous.documentUid,
    version: previous.version + 1,
    state: previous.state,
    canonicalHash: canonicalHashAfter,
  };
  return {
    record,
    change: {
      documentUid: previous.documentUid,
      previousVersion: previous.version,
      newVersion: record.version,
      canonicalHashBefore: previous.canonicalHash,
      canonicalHashAfter,
    },
  };
}

/** Cambia el estado de un documento respetando las transiciones permitidas. */
export function changeDocumentState(
  record: CanonicalDocumentRecord,
  newState: DocumentState,
  reason: string,
): { record: CanonicalDocumentRecord; reason: string } {
  if (!allowDocumentTransition(record.state, newState)) {
    throw new Error(`ATLAS: illegal document transition ${record.state} → ${newState}`);
  }
  return { record: { ...record, state: newState }, reason };
}