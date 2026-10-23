/**
 * Catálogo de tools canónicas derivadas de los blueprints:
 * BookPI (Merkle + regalías), Atlas (documentos + eventos) e Isabella AI (librería).
 *
 * Cada tool es un contrato puro y determinista bajo gobernanza; ninguna ejecuta
 * efectos externos. Las operaciones sensibles (HSM, firma PQC, publicación) son
 * capas con autoridad externa y no se simulan aquí.
 */
import type { ToolDescriptor } from "./registry";
import {
  chunkBuffer,
  buildMerkleTree,
  generateMerkleProof,
  verifyChunkProof,
} from "../bookpi/merkle";
import { settleRoyalties, sharesAreBalanced, type FederationShare } from "../bookpi/royalties";
import {
  createCanonicalDocument,
  versionDocument,
  changeDocumentState,
  type CanonicalDocumentRecord,
  type DocumentState,
  type DocumentInput,
} from "../atlas/documents";
import { buildAtlasEvent, isKnownAtlasEventType, type AtlasEventName, type AtlasEventPayloads } from "../atlas/events";
import { listIsabellaModules, auditIsabellaModule, ISABELLA_API_GROUPS, ISABELLA_MODULE_IDS } from "../isabella/library";

function textOf(input: unknown, key: string): string {
  if (input && typeof input === "object" && key in input) return String((input as Record<string, unknown>)[key]);
  return "";
}

export const PROTOCOL_TOOLS: readonly ToolDescriptor[] = [
  {
    id: "bookpi_merkle_register",
    version: "1.0.0",
    methodId: "A.TWINS.E08_DATA.register_manuscript.v1.0.0.LOW.INSTITUTIONAL",
    owner: "bookpi-ledger",
    riskTier: "LOW",
    scopes: ["write:ledger", "execute:crypto"],
    description: "Fragmenta una obra (64 KiB), construye el árbol de Merkle y calcula la raíz criptográfica con compromiso ZK.",
    execute: async (input: unknown) => {
      const content = textOf(input, "content");
      if (!content) throw new Error("BOOKPI: content is required");
      const buffer = Buffer.from(content, "utf8");
      const { hashes } = chunkBuffer(buffer);
      const { root } = buildMerkleTree(hashes);
      return { merkleRoot: root, totalChunks: hashes.length, chunksHashes: hashes };
    },
  },
  {
    id: "bookpi_merkle_verify",
    version: "1.0.0",
    methodId: "A.TWINS.E08_DATA.verify_merkle.v1.0.0.LOW.INSTITUTIONAL",
    owner: "bookpi-ledger",
    riskTier: "LOW",
    scopes: ["read:ledger", "execute:crypto"],
    description: "Genera y verifica una prueba de inclusión de Merkle para un chunk de un manuscrito.",
    execute: async (input: unknown) => {
      const content = textOf(input, "content");
      const rawIndex = (input as { index?: unknown })?.index;
      const index = typeof rawIndex === "number" ? rawIndex : Number(rawIndex ?? 0);
      const { hashes } = chunkBuffer(Buffer.from(content, "utf8"));
      const proof = generateMerkleProof(hashes, index);
      return { proof, valid: verifyChunkProof(proof) };
    },
  },
  {
    id: "bookpi_royalty_settle",
    version: "1.0.0",
    methodId: "A.TWINS.E08_DATA.settle_royalties.v1.0.0.MEDIUM.INSTITUTIONAL",
    owner: "bookpi-ledger",
    riskTier: "MEDIUM",
    scopes: ["write:ledger", "execute:economy"],
    description: "Liquida regalías exactas en BigInt hacia las 7 federaciones, sin pérdidas por redondeo.",
    execute: async (input: unknown) => {
      const record = (input ?? {}) as { totalRevenueWei?: string | number; shares?: FederationShare[] };
      const total = BigInt(record.totalRevenueWei ?? 0);
      const shares = Array.isArray(record.shares) ? record.shares : [];
      if (!sharesAreBalanced(shares)) throw new Error("BOOKPI: federation shares must sum to 10000 basis points");
      return settleRoyalties(total, shares);
    },
  },
  {
    id: "atlas_document_create",
    version: "1.0.0",
    methodId: "A.TWINS.E08_DATA.create_document.v1.0.0.LOW.INSTITUTIONAL",
    owner: "atlas-registry",
    riskTier: "LOW",
    scopes: ["write:document", "read:patrimony"],
    description: "Crea un documento canónico Atlas con document_uid, hash canónico y estado draft.",
    execute: async (input: unknown) => createCanonicalDocument(input as DocumentInput),
  },
  {
    id: "atlas_document_version",
    version: "1.0.0",
    methodId: "A.TWINS.E08_DATA.version_document.v1.0.0.LOW.INSTITUTIONAL",
    owner: "atlas-registry",
    riskTier: "LOW",
    scopes: ["write:document"],
    description: "Versiona un documento Atlas calculando el hash canónico antes/después del cambio.",
    execute: async (input: unknown) => {
      const record = (input as { record?: CanonicalDocumentRecord }).record;
      const doc = (input as { doc?: DocumentInput }).doc;
      if (!record || !doc) throw new Error("ATLAS: record and doc are required");
      return versionDocument(record, doc);
    },
  },
  {
    id: "atlas_document_state",
    version: "1.0.0",
    methodId: "I.IDENTITY.E03_GOVERNANCE.change_document_state.v1.0.0.LOW.INSTITUTIONAL",
    owner: "atlas-registry",
    riskTier: "LOW",
    scopes: ["write:document", "read:governance"],
    description: "Cambia el estado de un documento Atlas respetando las transiciones permitidas.",
    execute: async (input: unknown) => {
      const record = (input as { record?: CanonicalDocumentRecord }).record;
      const newState = (input as { newState?: DocumentState }).newState;
      const reason = textOf(input, "reason");
      if (!record || !newState) throw new Error("ATLAS: record and newState are required");
      return changeDocumentState(record, newState, reason);
    },
  },
  {
    id: "atlas_event_build",
    version: "1.0.0",
    methodId: "A.TWINS.E08_DATA.build_event.v1.0.0.LOW.INSTITUTIONAL",
    owner: "atlas-bus",
    riskTier: "LOW",
    scopes: ["read:events", "write:ledger"],
    description: "Construye y valida uno de los 15 eventos canónicos Atlas con clave de idempotencia.",
    execute: async (input: unknown) => {
      const record = (input ?? {}) as { eventType?: string; payload?: unknown };
      if (!record.eventType || !isKnownAtlasEventType(record.eventType)) {
        throw new Error("ATLAS_EVENTS: unknown event type");
      }
      return buildAtlasEvent(
        record.eventType as AtlasEventName,
        (record.payload ?? {}) as AtlasEventPayloads[AtlasEventName],
      );
    },
  },
  {
    id: "isabella_library_catalog",
    version: "1.0.0",
    methodId: "I.IDENTITY.E00_IDENTITY.library_catalog.v1.0.0.LOW.INSTITUTIONAL",
    owner: "isabella-library",
    riskTier: "LOW",
    scopes: ["read:library"],
    description: "Devuelve el catálogo de módulos y grupos de API de la librería Isabella AI.",
    execute: async () => ({
      modules: listIsabellaModules(),
      apiGroups: ISABELLA_API_GROUPS,
      moduleIds: ISABELLA_MODULE_IDS,
    }),
  },
  {
    id: "isabella_module_audit",
    version: "1.0.0",
    methodId: "N.IDENTITY.E03_GOVERNANCE.audit_module.v1.0.0.LOW.INSTITUTIONAL",
    owner: "isabella-library",
    riskTier: "LOW",
    scopes: ["read:library", "audit:governance"],
    description: "Audita un módulo de la librería Isabella AI: límites declarados, salvaguardas y marcos de cumplimiento.",
    execute: async (input: unknown) => {
      const moduleId = textOf(input, "moduleId");
      if (!(ISABELLA_MODULE_IDS as readonly string[]).includes(moduleId)) {
        throw new Error(`ISABELLA: unknown module '${moduleId}'`);
      }
      return auditIsabellaModule(moduleId as (typeof ISABELLA_MODULE_IDS)[number]);
    },
  },
];