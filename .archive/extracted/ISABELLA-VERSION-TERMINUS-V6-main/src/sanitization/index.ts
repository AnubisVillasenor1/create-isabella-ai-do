/**
 * SANITIZATION_POLICY — sanitización segura de documentos antes de deduplicación y admisión.
 *
 * Flujo canónico:
 *   raw → malware/file safety → format → encoding → metadata/content
 *   → PII/secrets → license → language → classification → fingerprints
 *
 * La sanitización NO altera el significado: el original se conserva inmutable
 * cuando la licencia lo permite; la versión normalizada se usa para análisis.
 * Los archivos sospechosos no se indexan ni ejecutan: se registran QUARANTINED.
 */
import { createHash } from "node:crypto";

export const SANITIZATION_STAGES = [
  "file_safety",
  "format",
  "encoding",
  "metadata",
  "pii_secrets",
  "license",
  "language",
  "classification",
  "fingerprints",
] as const;

export type SanitizationStage = (typeof SANITIZATION_STAGES)[number];

export type SanitizationStatus = "ADMITTED" | "QUARANTINED" | "REJECTED";

export type SanitizationSeverity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export interface SanitizationFinding {
  stage: SanitizationStage;
  kind: string;
  severity: SanitizationSeverity;
  evidence: string;
}

export interface SanitizationStageReport {
  stage: SanitizationStage;
  ok: boolean;
  detail: string;
}

export interface RawDocument {
  id: string;
  content: string;
  declaredFormat?: string;
  declaredEncoding?: string;
  license?: string;
  provenance?: { uri?: string; publisher?: string; retrievedAt?: string };
  maxBytes?: number;
}

export interface DocumentFingerprints {
  /** Identidad del contenido y metadatos de licencia/procedencia relevantes para preservación. */
  physical: string;
  /** ¿es esencialmente el mismo documento? */
  structural: string;
  /** ¿habla de la misma entidad y qué cambió? */
  semantic: string;
}

export interface SanitizedDocument {
  id: string;
  status: SanitizationStatus;
  normalizedContent: string;
  language: string;
  classification: string;
  license: string;
  fingerprints: DocumentFingerprints;
  findings: readonly SanitizationFinding[];
  maskedPII: number;
  secretsQuarantined: number;
  report: readonly SanitizationStageReport[];
}

const DEFAULT_MAX_BYTES = 32 * 1024 * 1024;

/** Accepted license identifiers for automatic admission. Proprietary/custom terms require a separate legal approval workflow. */
export const ALLOWED_AUTO_ADMISSION_LICENSES = Object.freeze([
  // Conservative defaults. CC-BY requires attribution fields not yet modeled by RawDocument.
  "MIT", "Apache-2.0", "BSD-2-Clause", "BSD-3-Clause", "ISC", "Unlicense", "CC0-1.0",
] as const);

export const LICENSES_REQUIRING_REVIEW = Object.freeze([
  "MPL-2.0", "GPL-3.0-only", "GPL-3.0-or-later", "AGPL-3.0-only",
  "CC-BY-4.0", "CC-BY-SA-4.0", "CC-BY-NC-4.0", "CC-BY-NC-SA-4.0",
  "CC-BY-ND-4.0", "CC-BY-NC-ND-4.0",
] as const);

const SECRET_PATTERNS: readonly { kind: string; pattern: RegExp }[] = [
  { kind: "private_key", pattern: /-----BEGIN (?:RSA |EC |OPENSSH |PGP )?PRIVATE KEY-----/ },
  { kind: "aws_access_key", pattern: /\bAKIA[0-9A-Z]{16}\b/ },
  { kind: "generic_api_key", pattern: /\b(?:api[_-]?key|access[_-]?token|secret[_-]?key)\b\s*[:=]\s*["']?[A-Za-z0-9._-]{16,}/i },
  { kind: "bearer_token", pattern: /\bBearer\s+[A-Za-z0-9._-]{20,}/ },
  { kind: "password_assignment", pattern: /\bpassword\b\s*[:=]\s*["'][^"']{6,}["']/i },
];

const PII_PATTERNS: readonly { kind: string; pattern: RegExp }[] = [
  { kind: "email", pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g },
  { kind: "curp", pattern: /\b[A-Z]{4}\d{6}[HM][A-Z]{5}[A-Z0-9]\d\b/g },
  { kind: "rfc", pattern: /\b[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}\b/g },
  { kind: "phone", pattern: /(?:\+?\d{1,3}[\s.-]?)?\(?\d{2,4}\)?[\s.-]?\d{3,4}[\s.-]?\d{3,4}\b/g },
];

const MALWARE_PATTERNS: readonly { kind: string; pattern: RegExp }[] = [
  { kind: "script_injection", pattern: /<script\b[^>]*>/i },
  { kind: "shell_pipe", pattern: /\b(?:curl|wget)\b[^\n|]{0,200}\|\s*(?:ba|z|k)?sh\b/i },
  { kind: "powershell_encoded", pattern: /powershell(?:\.exe)?\s+-(?:enc|encodedcommand)\b/i },
  { kind: "eval_obfuscation", pattern: /\beval\s*\(\s*(?:atob|base64|decodeURIComponent)\s*\(/i },
];

const SPANISH_STOPWORDS = ["el", "la", "de", "que", "los", "las", "una", "para", "con", "por", "del", "como"];
const ENGLISH_STOPWORDS = ["the", "of", "and", "to", "in", "that", "for", "with", "is", "as", "on", "this"];

function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function normalizeUnicode(content: string): string {
  return content.normalize("NFKC").replace(/[\u200B-\u200D\uFEFF]/g, "");
}

function detectControlChars(content: string): string[] {
  const matches = content.match(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g);
  return matches ?? [];
}

function structuralSkeleton(content: string): string {
  return content
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      if (/^#{1,6}\s/.test(line)) return "#heading";
      if (/^[-*+]\s/.test(line)) return "-item";
      if (/^\d+[.)]\s/.test(line)) return "1-item";
      if (/^```/.test(line)) return "```fence";
      return "para:" + String(line.length);
    })
    .join("|");
}

function semanticBag(content: string): string {
  const tokens = content
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9áéíóúñü\s]/gi, " ")
    .split(/\s+/)
    // Se conservan números cortos (p. ej. "12" vs "47"): una actualización de
    // cantidad es una afirmación distinta aunque la estructura sea idéntica.
    .filter((token) => token.length > 2 || /^\d+$/.test(token));
  const counts = new Map<string, number>();
  for (const token of tokens) counts.set(token, (counts.get(token) ?? 0) + 1);
  return [...counts.entries()]
    .sort((a, b) => (b[1] - a[1]) || a[0].localeCompare(b[0]))
    .slice(0, 64)
    .map(([token, count]) => `${token}:${count}`)
    .join(",");
}

function detectLanguage(content: string): string {
  const words = content.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "und";
  const sample = words.slice(0, 400);
  let spanish = 0;
  let english = 0;
  for (const word of sample) {
    if (SPANISH_STOPWORDS.includes(word)) spanish += 1;
    if (ENGLISH_STOPWORDS.includes(word)) english += 1;
  }
  if (spanish === 0 && english === 0) return "und";
  return spanish >= english ? "es" : "en";
}

function maskPII(content: string): { masked: string; count: number } {
  let masked = content;
  let count = 0;
  for (const { pattern } of PII_PATTERNS) {
    masked = masked.replace(pattern, (match) => {
      count += 1;
      const visible = match.slice(-2);
      return `${"*".repeat(Math.max(0, match.length - 2))}${visible}`;
    });
  }
  return { masked, count };
}

function classifyContent(content: string, secretHits: number, piiHits: number): string {
  if (secretHits > 0) return "restricted";
  if (piiHits > 0) return "personal";
  if (/\b(?:confidencial|internal only|no distribuir)\b/i.test(content)) return "internal";
  return "public";
}

/**
 * Ejecuta el pipeline de sanitización. Determinista y sin efectos externos:
 * el archivo sospechoso se marca QUARANTINED y nunca se indexa ni ejecuta.
 */
export function sanitizeDocument(raw: RawDocument): SanitizedDocument {
  if (!raw || typeof raw.id !== "string" || typeof raw.content !== "string") {
    throw new Error("SANITIZATION: id and content must be strings");
  }
  const safeId = raw.id.trim();
  if (!/^[A-Za-z0-9._:-]{1,128}$/.test(safeId)) throw new Error("SANITIZATION: id must be a safe 1-128 character identifier");
  if (raw.maxBytes !== undefined && (!Number.isSafeInteger(raw.maxBytes) || raw.maxBytes <= 0)) {
    throw new Error("SANITIZATION: maxBytes must be a positive safe integer");
  }
  const findings: SanitizationFinding[] = [];
  const report: SanitizationStageReport[] = [];
  const maxBytes = raw.maxBytes ?? DEFAULT_MAX_BYTES;

  // 1. file safety (malware / tamaño)
  const byteLength = Buffer.byteLength(raw.content, "utf8");
  let safetyOk = byteLength <= maxBytes;
  if (!safetyOk) {
    findings.push({ stage: "file_safety", kind: "size_exceeded", severity: "HIGH", evidence: `${byteLength} bytes` });
  }
  for (const { kind, pattern } of MALWARE_PATTERNS) {
    const match = raw.content.match(pattern);
    if (match) {
      findings.push({ stage: "file_safety", kind, severity: "CRITICAL", evidence: "[REDACTED]" });
      safetyOk = false;
    }
  }
  report.push({ stage: "file_safety", ok: safetyOk, detail: safetyOk ? "no unsafe content" : "unsafe content detected" });

  // 2. format
  const format = raw.declaredFormat ?? "text";
  const formatOk = format.length <= 32 && /^[a-z0-9][a-z0-9+._-]*$/i.test(format);
  report.push({ stage: "format", ok: formatOk, detail: formatOk ? `format=${format}` : "format metadata invalid" });

  // 3. encoding
  const controlChars = detectControlChars(raw.content);
  const declaredEncoding = raw.declaredEncoding ?? "utf-8";
  // This function receives a JavaScript string; it does not decode arbitrary
  // byte encodings. Only UTF-8 declarations can be represented honestly here.
  const encodingLabelValid = declaredEncoding.length <= 32 && /^[a-z0-9._-]+$/i.test(declaredEncoding);
  const encodingSupported = encodingLabelValid && ["utf-8", "utf8"].includes(declaredEncoding.toLowerCase());
  const encodingNameOk = encodingLabelValid && encodingSupported;
  const encodingOk = controlChars.length === 0 && encodingNameOk;
  if (controlChars.length > 0) {
    findings.push({ stage: "encoding", kind: "control_chars", severity: "MEDIUM", evidence: `${controlChars.length} control chars` });
  }
  if (!encodingLabelValid) {
    findings.push({ stage: "encoding", kind: "invalid_encoding_metadata", severity: "MEDIUM", evidence: "[REDACTED]" });
  } else if (!encodingSupported) {
    findings.push({ stage: "encoding", kind: "unsupported_encoding", severity: "MEDIUM", evidence: "[REDACTED]" });
  }
  report.push({ stage: "encoding", ok: encodingOk, detail: encodingOk ? `encoding=${declaredEncoding}` : "encoding metadata or control characters invalid" });

  // 4. metadata / content (normalización NFKC)
  const normalized = normalizeUnicode(raw.content);
  let metadataOk = false;
  try {
    const uri = typeof raw.provenance?.uri === "string" ? new URL(raw.provenance.uri) : null;
    metadataOk = Boolean(uri && (uri.protocol === "https:" || uri.protocol === "http:") &&
      typeof raw.provenance?.retrievedAt === "string" && Number.isFinite(Date.parse(raw.provenance.retrievedAt)));
  } catch { metadataOk = false; }
  if (!metadataOk) {
    findings.push({ stage: "metadata", kind: "missing_provenance", severity: "LOW", evidence: "provenance incomplete" });
  }
  report.push({ stage: "metadata", ok: metadataOk, detail: "NFKC normalized" });

  // 5. PII / secrets
  const secretMatches: string[] = [];
  for (const { kind, pattern } of SECRET_PATTERNS) {
    const match = normalized.match(pattern);
    if (match) {
      secretMatches.push(kind);
      findings.push({ stage: "pii_secrets", kind, severity: "CRITICAL", evidence: "[REDACTED]" });
    }
  }
  const secretRedacted = SECRET_PATTERNS.reduce((value, { pattern }) => {
    const flags = pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`;
    return value.replace(new RegExp(pattern.source, flags), "[REDACTED_SECRET]");
  }, normalized);
  const { masked, count: piiCount } = maskPII(secretRedacted);
  const piiOk = secretMatches.length === 0;
  report.push({ stage: "pii_secrets", ok: piiOk, detail: `${piiCount} PII masked, ${secretMatches.length} secrets` });

  // 6. license
  const license = typeof raw.license === "string" ? raw.license.trim() : "unknown";
  const licenseOk = license.length <= 100 && ALLOWED_AUTO_ADMISSION_LICENSES.includes(license as (typeof ALLOWED_AUTO_ADMISSION_LICENSES)[number]);
  if (!licenseOk) {
    const requiresReview = LICENSES_REQUIRING_REVIEW.includes(license as (typeof LICENSES_REQUIRING_REVIEW)[number]);
    const kind = license === "unknown" || !license
      ? "missing_license"
      : requiresReview ? "license_requires_review" : "license_not_allowlisted";
    findings.push({ stage: "license", kind, severity: "MEDIUM", evidence: "license missing, unknown, or not approved for automatic admission" });
  }
  report.push({ stage: "license", ok: licenseOk, detail: licenseOk ? `license=${license}` : "license missing or not allowlisted" });

  // 7. language
  const language = detectLanguage(masked);
  report.push({ stage: "language", ok: language !== "und", detail: `language=${language}` });

  // 8. classification
  const classification = classifyContent(masked, secretMatches.length, piiCount);
  report.push({ stage: "classification", ok: true, detail: `classification=${classification}` });

  // 9. fingerprints
  // Content equality alone is insufficient for deletion: the same text may have
  // different rights or provenance. Include stable metadata, but exclude retrievedAt
  // so a second fetch of the same source does not create a false difference.
  const physicalIdentity = {
    content: raw.content,
    declaredFormat: format.toLowerCase(),
    declaredEncoding: declaredEncoding.toLowerCase(),
    license: license.toLowerCase(),
    provenance: {
      uri: typeof raw.provenance?.uri === "string" ? raw.provenance.uri.trim() : null,
      publisher: typeof raw.provenance?.publisher === "string" ? raw.provenance.publisher.trim() : null,
    },
  };
  const fingerprints: DocumentFingerprints = Object.freeze({
    physical: sha256(JSON.stringify(physicalIdentity)),
    structural: sha256(structuralSkeleton(masked)),
    semantic: sha256(semanticBag(masked)),
  });
  report.push({ stage: "fingerprints", ok: true, detail: "physical+structural+semantic" });

  // Decisión: el secreto o el malware no se indexan ni ejecutan.
  const critical = findings.some((f) => f.severity === "CRITICAL");
  const status: SanitizationStatus = critical
    ? "QUARANTINED"
    : (!formatOk || !encodingOk || !licenseOk || !metadataOk ? "REJECTED" : "ADMITTED");

  return Object.freeze({
    id: safeId,
    status,
    normalizedContent: critical ? "[QUARANTINED: CONTENT WITHHELD]" : masked,
    language,
    classification,
    license: licenseOk ? license : "unknown_or_not_allowlisted",
    fingerprints,
    findings: Object.freeze(findings),
    maskedPII: piiCount,
    secretsQuarantined: secretMatches.length,
    report: Object.freeze(report),
  });
}

/** ¿Dos documentos son el mismo artefacto físico? Solo el hash físico lo decide. */
export function isPhysicalDuplicate(a: DocumentFingerprints, b: DocumentFingerprints): boolean {
  return a.physical === b.physical;
}

export type DuplicateVerdict =
  | "IDENTICAL_ARTIFACT"
  | "VERIFIED_DUPLICATE"
  | "LIKELY_UPDATE"
  | "ENRICHMENT"
  | "DISTINCT";

/**
 * Decide el vínculo entre dos documentos sin borrar por similitud semántica:
 * ante la duda, PRESERVE → CLASSIFY → LINK → VERSION.
 */
export function classifyDuplicateRelationship(a: DocumentFingerprints, b: DocumentFingerprints): DuplicateVerdict {
  if (a.physical === b.physical) return "IDENTICAL_ARTIFACT";

  // Structural and semantic fingerprints are intentionally lossy summaries.
  // Their equality cannot prove byte identity or justify deletion.
  if (a.structural === b.structural) return "LIKELY_UPDATE";
  if (a.semantic === b.semantic) return "ENRICHMENT";
  return "DISTINCT";
}
export * from "./hardening";
