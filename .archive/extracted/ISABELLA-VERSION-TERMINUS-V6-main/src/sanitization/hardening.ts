/**
 * Sanitization hardening 2.0 — endurecimiento de la capa de sanitización.
 *
 * Extiende el pipeline base con detección más profunda sin alterar su contrato:
 * - Entropía de Shannon para secretos de alta aleatoriedad (no solo patrones).
 * - Detección de homóglifos y caracteres de ancho cero (evasión por Unicode).
 * - PII profunda: IBAN y tarjetas de crédito validadas por Luhn.
 * - Cuarentena con registro inmutable (hash + motivo), sin conservar el secreto.
 *
 * No ejecuta el archivo: decide. El material cuarentenado no se indexa.
 */
import { createHash } from "node:crypto";
import type { SanitizationFinding, SanitizationSeverity } from "./index";

export interface EntropyCandidate {
  token: string;
  entropy: number;
  start: number;
}

export interface HardeningResult {
  findings: SanitizationFinding[];
  quarantineRequired: boolean;
  zeroWidthCount: number;
  homoglyphCount: number;
  highEntropyTokens: number;
  luhnInvalidCards: number;
  maskedContent: string;
}

/** Entropía de Shannon por carácter (bits). */
export function shannonEntropy(value: string): number {
  if (value.length === 0) return 0;
  const counts = new Map<string, number>();
  for (const char of value) counts.set(char, (counts.get(char) ?? 0) + 1);
  let entropy = 0;
  for (const count of counts.values()) {
    const p = count / value.length;
    entropy -= p * Math.log2(p);
  }
  return entropy;
}

const SECRETISH = /[A-Za-z0-9+/_=-]{20,}/g;

/** Detecta tokens con alta entropía (probable secreto) sobre texto normalizado. */
export function findHighEntropyTokens(content: string, minEntropy = 3.5, minLength = 24): EntropyCandidate[] {
  const candidates: EntropyCandidate[] = [];
  for (const match of content.matchAll(SECRETISH)) {
    const token = match[0];
    if (token.length < minLength) continue;
    const entropy = shannonEntropy(token);
    if (entropy >= minEntropy) candidates.push({ token, entropy: Number(entropy.toFixed(4)), start: match.index ?? 0 });
  }
  return candidates;
}

const ZERO_WIDTH = /[\u200B-\u200D\u2060\uFEFF\u180E]/g;
const HOMOGLYPHS = /[\u0430-\u044F\u0391-\u03C9\u0400-\u04FF]/g; // cirílico/griego confundible

/** Detecta homóglifos y caracteres de ancho cero usados para evasión. */
export function detectUnicodeEvasion(content: string): { zeroWidth: number; homoglyphs: number } {
  return {
    zeroWidth: (content.match(ZERO_WIDTH) ?? []).length,
    homoglyphs: (content.match(HOMOGLYPHS) ?? []).length,
  };
}

function luhnValid(digits: string): boolean {
  const clean = digits.replace(/[\s-]/g, "");
  if (!/^\d{13,19}$/.test(clean)) return false;
  let sum = 0;
  let double = false;
  for (let i = clean.length - 1; i >= 0; i -= 1) {
    let digit = clean.charCodeAt(i) - 48;
    if (double) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
    double = !double;
  }
  return sum % 10 === 0;
}

const IBAN_RE = /\b[A-Z]{2}\d{2}[A-Z0-9]{11,30}\b/g;
const CARD_RE = /\b(?:\d[ -]?){13,19}\b/g;

/** Detecta y enmascara PII profunda (IBAN y tarjetas válidas por Luhn). */
export function detectDeepPII(content: string): { masked: string; ibans: number; cards: number; luhnInvalid: number } {
  let ibans = 0;
  let cards = 0;
  let luhnInvalid = 0;
  let masked = content.replace(IBAN_RE, (match) => {
    ibans += 1;
    return `${"*".repeat(Math.max(0, match.length - 4))}${match.slice(-4)}`;
  });
  masked = masked.replace(CARD_RE, (match) => {
    const digits = match.replace(/[\s-]/g, "");
    if (digits.length < 13) return match;
    if (!luhnValid(digits)) {
      luhnInvalid += 1;
      return match;
    }
    cards += 1;
    return `${"*".repeat(Math.max(0, match.length - 4))}${match.slice(-4)}`;
  });
  return { masked, ibans, cards, luhnInvalid };
}

function finding(kind: string, severity: SanitizationSeverity, evidence: string): SanitizationFinding {
  return { stage: "pii_secrets", kind, severity, evidence };
}

/**
 * Endurece la sanitización: aplica detección profunda sobre el contenido y decide
 * si requiere cuarentena. Nunca conserva el token secreto, solo su hash.
 */
export function hardenSanitization(content: string, minEntropy = 3.5): HardeningResult {
  const findings: SanitizationFinding[] = [];

  const evasion = detectUnicodeEvasion(content);
  if (evasion.zeroWidth > 0) {
    findings.push(finding("zero_width_evasion", "HIGH", `${evasion.zeroWidth} zero-width chars`));
  }
  if (evasion.homoglyphs > 0) {
    findings.push(finding("homoglyph_evasion", "MEDIUM", `${evasion.homoglyphs} confusable chars`));
  }

  const entropyCandidates = findHighEntropyTokens(content, minEntropy);
  for (const candidate of entropyCandidates) {
    // Solo se registra el hash, nunca el token en claro.
    const tokenHash = createHash("sha256").update(candidate.token).digest("hex").slice(0, 16);
    findings.push(finding("high_entropy_secret", "CRITICAL", `token:${tokenHash} entropy=${candidate.entropy}`));
  }

  const deep = detectDeepPII(content);
  if (deep.ibans > 0) findings.push(finding("iban", "HIGH", `${deep.ibans} IBAN masked`));
  if (deep.cards > 0) findings.push(finding("credit_card_luhn_valid", "HIGH", `${deep.cards} cards masked`));

  const quarantineRequired = findings.some((f) => f.severity === "CRITICAL") || evasion.zeroWidth > 0;

  return {
    findings,
    quarantineRequired,
    zeroWidthCount: evasion.zeroWidth,
    homoglyphCount: evasion.homoglyphs,
    highEntropyTokens: entropyCandidates.length,
    luhnInvalidCards: deep.luhnInvalid,
    maskedContent: deep.masked,
  };
}

export interface QuarantineRecord {
  quarantineId: string;
  contentHash: string;
  reasons: readonly string[];
  quarantinedAt: string;
}

/** Registro de cuarentena: conserva hash y motivo, nunca el contenido sensible. */
export function buildQuarantineRecord(content: string, findings: readonly SanitizationFinding[]): QuarantineRecord {
  const contentHash = createHash("sha3-512").update(content, "utf8").digest("hex");
  const reasons = findings.map((f) => `${f.stage}:${f.kind}`);
  return {
    quarantineId: `qrn_${contentHash.slice(0, 16)}`,
    contentHash,
    reasons,
    quarantinedAt: new Date().toISOString(),
  };
}