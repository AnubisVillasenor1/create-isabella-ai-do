/**
 * JWT algorithm allowlist (ISA-159).
 *
 * Parses ONLY the JOSE header — no JWT library, no signature verification — to
 * reject tokens whose `alg` is outside an explicit allowlist (default strict:
 * ES256, EdDSA). Rejects `alg: none`, malformed tokens/headers and unexpected
 * header parameters. Verification of the signature itself belongs elsewhere.
 */
export type JwtAlgorithmRejection =
  | "MALFORMED_TOKEN"
  | "MALFORMED_HEADER"
  | "ALG_MISSING"
  | "ALG_NONE"
  | "ALG_NOT_ALLOWED"
  | "UNEXPECTED_HEADER_PARAMETER";

export interface JwtAlgorithmPolicy {
  allowedAlgorithms: readonly string[];
  allowedHeaderParameters: readonly string[];
}

/** Strict default: asymmetric only, no `none`, no shared-secret HMAC. */
export const STRICT_JWT_ALGORITHM_POLICY: JwtAlgorithmPolicy = {
  allowedAlgorithms: ["ES256", "EdDSA"],
  allowedHeaderParameters: ["alg", "typ", "kid"],
};

export interface JwtAlgorithmAccepted {
  ok: true;
  algorithm: string;
  header: Record<string, unknown>;
}

export interface JwtAlgorithmRejected {
  ok: false;
  reason: JwtAlgorithmRejection;
  detail: string;
}

export type JwtAlgorithmVerdict = JwtAlgorithmAccepted | JwtAlgorithmRejected;

const BASE64URL = /^[A-Za-z0-9_-]+$/;

function reject(reason: JwtAlgorithmRejection, detail: string): JwtAlgorithmRejected {
  return { ok: false, reason, detail };
}

function decodeHeader(part: string): Record<string, unknown> | undefined {
  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(part, "base64url").toString("utf8"));
  } catch {
    return undefined;
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return undefined;
  return parsed as Record<string, unknown>;
}

/**
 * Validates the JOSE header of `token` against the allowlist policy.
 * Only the header is inspected; the payload and signature are ignored.
 */
export function verifyJwtAlgorithm(
  token: string,
  policy: Partial<JwtAlgorithmPolicy> = {},
): JwtAlgorithmVerdict {
  const allowedAlgorithms = policy.allowedAlgorithms ?? STRICT_JWT_ALGORITHM_POLICY.allowedAlgorithms;
  const allowedHeaderParameters =
    policy.allowedHeaderParameters ?? STRICT_JWT_ALGORITHM_POLICY.allowedHeaderParameters;
  const allowedHeaderSet = new Set(allowedHeaderParameters);

  if (typeof token !== "string") return reject("MALFORMED_TOKEN", "token must be a string");
  const parts = token.split(".");
  if (parts.length !== 3) return reject("MALFORMED_TOKEN", "expected three dot-separated segments");
  const [headerPart, payloadPart, signaturePart] = parts;
  if (
    headerPart === undefined ||
    payloadPart === undefined ||
    signaturePart === undefined ||
    !BASE64URL.test(headerPart) ||
    !BASE64URL.test(payloadPart) ||
    !BASE64URL.test(signaturePart)
  ) {
    return reject("MALFORMED_TOKEN", "segments must be non-empty base64url");
  }

  const header = decodeHeader(headerPart);
  if (header === undefined) return reject("MALFORMED_HEADER", "header is not a JSON object");

  const alg = header.alg;
  if (typeof alg !== "string" || alg.length === 0) {
    return reject("ALG_MISSING", "header.alg must be a non-empty string");
  }
  if (alg.toLowerCase() === "none") {
    return reject("ALG_NONE", "alg:none is never accepted");
  }
  if (!allowedAlgorithms.includes(alg)) {
    return reject("ALG_NOT_ALLOWED", `algorithm ${alg} is not in the allowlist`);
  }
  for (const key of Object.keys(header)) {
    if (!allowedHeaderSet.has(key)) {
      return reject("UNEXPECTED_HEADER_PARAMETER", `header parameter ${key} is not allowed`);
    }
  }

  return { ok: true, algorithm: alg, header };
}
