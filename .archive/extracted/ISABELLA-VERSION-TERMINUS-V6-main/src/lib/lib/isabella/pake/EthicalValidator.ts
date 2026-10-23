import { createHash } from "node:crypto";

export type EthicalSeverity = "info" | "warning" | "critical";

export interface EthicalFlag {
  code: string;
  severity: EthicalSeverity;
  message: string;
  evidence?: string;
}

export interface EthicalAuditResult {
  valid: boolean;
  score: number;
  threshold: number;
  flags: EthicalFlag[];
  hash: string;
  algorithm: "sha256";
  normalized: boolean;
  contentLength: number;
  auditedAt: string;
}

const DEFAULT_THRESHOLD = 0.6;
const MAX_CONTENT_LENGTH = 1_000_000;

/**
 * Cryptographic digest for integrity and provenance.
 *
 * This hash proves that the audited bytes can be compared later. It does not
 * prove that the content is ethical, true, safe, or immutable by itself.
 */
export function generateHash(value: string): string {
  if (typeof value !== "string") {
    throw new TypeError("content_must_be_string");
  }

  return createHash("sha256").update(value, "utf8").digest("hex");
}

function normalizeContent(content: string): string {
  return content
    .normalize("NFKC")
    .replace(/\u200B|\u200C|\u200D|\uFEFF/gu, "")
    .toLocaleLowerCase("und")
    .replace(/\s+/gu, " ")
    .trim();
}

function boundedScore(value: number): number {
  return Math.max(0, Math.min(1, Number(value.toFixed(6))));
}

function addFlag(
  flags: EthicalFlag[],
  code: string,
  severity: EthicalSeverity,
  message: string,
  evidence?: string,
): void {
  flags.push({ code, severity, message, evidence });
}

function containsAny(content: string, terms: readonly string[]): string | undefined {
  return terms.find((term) => content.includes(term));
}

/**
 * Deterministic lexical governance screen.
 *
 * This is not a complete ethics, fairness, legal, or safety assessment. It is
 * an early screening layer and must be followed by policy evaluation,
 * provenance checks, domain-specific review, and human approval for sensitive
 * content. A mention of "bias", "discrimination", or "secreto" is not by
 * itself proof that the content is harmful; it may be analytical or critical.
 */
export class EthicalValidator {
  public static auditContent(
    content: string,
    options: {
      threshold?: number;
      requireEthicalAnchors?: boolean;
      failOnCritical?: boolean;
    } = {},
  ): EthicalAuditResult {
    if (typeof content !== "string") {
      throw new TypeError("content_must_be_string");
    }

    if (content.length > MAX_CONTENT_LENGTH) {
      throw new RangeError("content_exceeds_maximum_length");
    }

    const threshold = options.threshold ?? DEFAULT_THRESHOLD;
    if (!Number.isFinite(threshold) || threshold < 0 || threshold > 1) {
      throw new RangeError("threshold_must_be_between_zero_and_one");
    }

    const normalized = normalizeContent(content);
    const flags: EthicalFlag[] = [];
    let score = 1;

    const opacityTerm = containsAny(normalized, [
      "ocultar información",
      "ocultar evidencia",
      "engañar al usuario",
      "falsear resultados",
      "borrar auditoría",
      "evadir controles",
      "revelar secreto",
    ]);

    if (opacityTerm) {
      addFlag(
        flags,
        "OPACITY_RISK",
        "critical",
        "El contenido sugiere ocultamiento, engaño o evasión de controles.",
        opacityTerm,
      );
      score -= 0.45;
    }

    const governanceTerm = containsAny(normalized, [
      "sin autorización",
      "sin consentimiento",
      "sin supervisión humana",
      "ignorar la política",
      "saltarse la seguridad",
      "ejecutar sin permiso",
    ]);

    if (governanceTerm) {
      addFlag(
        flags,
        "GOVERNANCE_RISK",
        "critical",
        "El contenido sugiere una operación fuera del modelo de autorización.",
        governanceTerm,
      );
      score -= 0.4;
    }

    const fairnessTerm = containsAny(normalized, [
      "discriminación",
      "excluir a un grupo",
      "inferiorizar",
      "perfiles prohibidos",
      "negar por idioma",
      "negar por origen",
    ]);

    if (fairnessTerm) {
      addFlag(
        flags,
        "FAIRNESS_RISK",
        "warning",
        "El contenido requiere revisión de sesgo, impacto y proporcionalidad.",
        fairnessTerm,
      );
      score -= 0.25;
    }

    const privacyTerm = containsAny(normalized, [
      "publicar datos personales",
      "exponer api key",
      "revelar token",
      "compartir contraseña",
      "filtrar información privada",
    ]);

    if (privacyTerm) {
      addFlag(
        flags,
        "PRIVACY_RISK",
        "critical",
        "El contenido sugiere exposición de datos personales o secretos.",
        privacyTerm,
      );
      score -= 0.5;
    }

    const anchors = [
      "ética",
      "transparencia",
      "bienestar",
      "gobernanza",
      "consentimiento",
      "supervisión humana",
      "derechos",
      "proveniencia",
    ];

    const hasEthicalAnchor = anchors.some((anchor) => normalized.includes(anchor));
    if ((options.requireEthicalAnchors ?? true) && !hasEthicalAnchor) {
      addFlag(
        flags,
        "MISSING_ETHICAL_CONTEXT",
        "info",
        "No se detectó un anclaje explícito de ética, transparencia, derechos o gobernanza.",
      );
      score -= 0.05;
    }

    const critical = flags.some((flag) => flag.severity === "critical");
    const valid = score >= threshold && (!(options.failOnCritical ?? true) || !critical);

    return {
      valid,
      score: boundedScore(score),
      threshold,
      flags,
      hash: generateHash(content),
      algorithm: "sha256",
      normalized: true,
      contentLength: content.length,
      auditedAt: new Date().toISOString(),
    };
  }

  // Legacy compat: retorna flags como string[] para código que espera string[]
  public static auditContentLegacy(content: string): {
    valid: boolean;
    score: number;
    flags: string[];
    hash: string;
  } {
    const result = this.auditContent(content);
    return {
      valid: result.valid,
      score: result.score,
      flags: result.flags.map((f) => f.message),
      hash: result.hash,
    };
  }
}
