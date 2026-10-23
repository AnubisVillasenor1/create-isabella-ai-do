/**
 * IGDS-v1 Document Seal — integrity + provenance for generated documents.
 *
 * state: draft | engine-generated (pending human review).
 * HONEST STATE: this module implements SHA-256 integrity, a real Ed25519
 * signature and a base32 compact identifier over bytes. It does NOT implement
 * RFC 3161 trusted timestamps, post-quantum (ML-DSA) signatures, C2PA or an
 * external registry check: those are represented as explicit "pending"/
 * "unsupported" markers and never faked.
 */
import { createHash } from "node:crypto";
import { canonicalJson } from "../bookpi/crypto";
import type { JsonValue } from "../bookpi/types";
import { verifyEd25519, type Ed25519Signer } from "./post-quantum";

export const DOCUMENT_SEAL_SCHEMA = "igds.document-seal.v1" as const;
export const DOCUMENT_SEAL_STATE = "draft" as const;
export const BOOKPI_GENESIS_SEAL_PREFIX = "SHA-ISABELLA-GENESIS-256-ED25519-" as const;

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export type DocumentSealIntegrity = "valid" | "invalid" | "missing";
export type DocumentSealSignatureStatus = "valid" | "invalid";
export type DocumentSealOptionalStatus = "not_present" | "unsupported" | "not_checked";

export interface DocumentSealContent {
  sha256: string;
  mediaType: string;
  bytes: number;
}

export interface DocumentSealDocumentInfo {
  id: string;
  title: string;
  mediaType: string;
  language?: string;
}

export interface DocumentSealSignerInfo {
  algorithm: "Ed25519";
  keyId: string;
  publicKeyPem: string;
}

export interface DocumentSealSignature {
  algorithm: "Ed25519";
  keyId: string;
  value: string;
}

export interface DocumentSealTimestamp {
  scheme: "RFC3161";
  status: "not_requested";
}

export interface DocumentSealWatermark {
  present: boolean;
  label: string;
  method: "text-metadata" | "none";
}

export interface DocumentSealManifest {
  schema: typeof DOCUMENT_SEAL_SCHEMA;
  state: typeof DOCUMENT_SEAL_STATE;
  sealId: string;
  compactId: string;
  createdAt: string;
  document: DocumentSealDocumentInfo;
  content: DocumentSealContent;
  signer: DocumentSealSignerInfo;
  signature: DocumentSealSignature;
  timestamp: DocumentSealTimestamp;
  watermark: DocumentSealWatermark;
  registry: { checked: false; evidence: "none" };
  hashChain: { algorithm: "sha256"; prevSealId: string | null };
}

export interface SealDocumentInput {
  document: { id: string; title: string; mediaType?: string; language?: string };
  bytes: Uint8Array;
  createdAt?: string;
  prevSealId?: string | null;
  generateWatermark?: boolean;
}

export interface VerifySealInput {
  manifest: DocumentSealManifest;
  bytes: Uint8Array;
  publicKeyPem: string;
}

export interface SealVerificationReport {
  valid: boolean;
  sealId: string;
  integrity: DocumentSealIntegrity;
  signature: DocumentSealSignatureStatus;
  registry: DocumentSealOptionalStatus;
  timestamp: DocumentSealOptionalStatus;
  watermark: "present" | "absent";
  issues: string[];
}

export function contentDigest(bytes: Uint8Array): string {
  return createHash("sha256").update(Buffer.from(bytes)).digest("hex");
}

export function base32Encode(bytes: Uint8Array): string {
  let bits = 0;
  let value = 0;
  let output = "";
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }
  return output;
}

export function base32Decode(text: string): Uint8Array {
  const clean = text.replace(/=+$/u, "").toUpperCase();
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const ch of clean) {
    const index = BASE32_ALPHABET.indexOf(ch);
    if (index === -1) throw new Error(`base32: carácter inválido '${ch}'.`);
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Uint8Array.from(out);
}

function compactSealId(digestHex: string): string {
  const encoded = base32Encode(Buffer.from(digestHex, "hex"));
  return encoded.match(/.{1,4}/g)?.join("-") ?? encoded;
}

function watermarkLabel(sealId: string): string {
  const tail = sealId.slice(-12).toUpperCase();
  return `ISABELLA-SEAL-${tail}`;
}

function sealDigest(
  document: DocumentSealDocumentInfo,
  content: DocumentSealContent,
  createdAt: string,
): string {
  return contentDigest(
    Buffer.from(
      canonicalJson({
        document: {
          id: document.id,
          title: document.title,
          mediaType: document.mediaType,
          ...(document.language ? { language: document.language } : {}),
        },
        content: { sha256: content.sha256, mediaType: content.mediaType, bytes: content.bytes },
        createdAt,
      } as unknown as JsonValue),
      "utf8",
    ),
  );
}

export async function sealDocument(
  input: SealDocumentInput,
  signer: Ed25519Signer,
): Promise<DocumentSealManifest> {
  const mediaType = input.document.mediaType ?? "application/octet-stream";
  const createdAt = input.createdAt ?? new Date().toISOString();
  const content: DocumentSealContent = {
    sha256: contentDigest(input.bytes),
    mediaType,
    bytes: input.bytes.length,
  };
  const document: DocumentSealDocumentInfo = {
    id: input.document.id,
    title: input.document.title,
    mediaType,
    ...(input.document.language ? { language: input.document.language } : {}),
  };

  const digest = sealDigest(document, content, createdAt);
  const sealId = `${BOOKPI_GENESIS_SEAL_PREFIX}${digest.toUpperCase()}`;
  const signature = await signer.sign(Buffer.from(digest, "hex"));
  const generateWatermark = input.generateWatermark ?? true;

  return {
    schema: DOCUMENT_SEAL_SCHEMA,
    state: DOCUMENT_SEAL_STATE,
    sealId,
    compactId: compactSealId(digest),
    createdAt,
    document,
    content,
    signer: { algorithm: "Ed25519", keyId: signer.keyId, publicKeyPem: signer.publicKeyPem() },
    signature: {
      algorithm: "Ed25519",
      keyId: signer.keyId,
      value: Buffer.from(signature).toString("base64url"),
    },
    timestamp: { scheme: "RFC3161", status: "not_requested" },
    watermark: generateWatermark
      ? { present: true, label: watermarkLabel(sealId), method: "text-metadata" }
      : { present: false, label: "", method: "none" },
    registry: { checked: false, evidence: "none" },
    hashChain: { algorithm: "sha256", prevSealId: input.prevSealId ?? null },
  };
}

export async function verifyDocumentSeal(input: VerifySealInput): Promise<SealVerificationReport> {
  const { manifest, bytes, publicKeyPem } = input;
  const issues: string[] = [];

  const actualDigest = contentDigest(bytes);
  let integrity: DocumentSealIntegrity = "valid";
  if (!manifest.content.sha256) {
    integrity = "missing";
    issues.push("El manifiesto no declara content.sha256.");
  } else if (actualDigest !== manifest.content.sha256) {
    integrity = "invalid";
    issues.push("El digest del contenido no coincide con el manifiesto.");
  }
  if (manifest.content.bytes !== bytes.length) {
    integrity = "invalid";
    issues.push("El tamaño de bytes no coincide con el manifiesto.");
  }

  const digest = manifest.sealId.startsWith(BOOKPI_GENESIS_SEAL_PREFIX)
    ? manifest.sealId.slice(BOOKPI_GENESIS_SEAL_PREFIX.length).toLowerCase()
    : "";
  if (!/^[0-9a-f]{64}$/.test(digest)) {
    issues.push("El sealId no sigue el formato SHA-ISABELLA-GENESIS-256-ED25519-<digest>.");
  }

  let signature: DocumentSealSignatureStatus = "invalid";
  if (!digest) {
    issues.push("No fue posible reconstruir el digest firmado.");
  } else {
    const verified = await verifyEd25519(
      publicKeyPem,
      Buffer.from(digest, "hex"),
      Buffer.from(manifest.signature.value, "base64url"),
    );
    signature = verified ? "valid" : "invalid";
    if (!verified) issues.push("La firma Ed25519 no es válida para la llave provista.");
  }

  const valid = integrity === "valid" && signature === "valid";

  return {
    valid,
    sealId: manifest.sealId,
    integrity,
    signature,
    registry: "not_checked",
    timestamp: "unsupported",
    watermark: manifest.watermark.present ? "present" : "absent",
    issues,
  };
}

export interface DocumentSealEnablement {
  state: typeof DOCUMENT_SEAL_STATE;
  implemented: string[];
  unsupported: { feature: string; detail: string }[];
}

export function documentSealEnablement(): DocumentSealEnablement {
  return {
    state: DOCUMENT_SEAL_STATE,
    implemented: [
      "sha256-content-integrity",
      "ed25519-signature",
      "base32-compact-id",
      "text-watermark-metadata",
    ],
    unsupported: [
      { feature: "rfc3161-timestamp", detail: "Requiere una TSA externa; no se simula." },
      { feature: "ml-dsa-signature", detail: "PQC requiere HSM/KMS; bloqueado en este repo." },
      { feature: "registry-check", detail: "No hay registro externo conectado; estado not_checked." },
      { feature: "c2pa", detail: "No implementado; declarado explícitamente." },
    ],
  };
}
