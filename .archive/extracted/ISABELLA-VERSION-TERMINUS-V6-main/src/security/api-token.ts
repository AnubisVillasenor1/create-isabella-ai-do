import { equalSecret } from "./secrets";

export type ApiTokenVerdict = "AUTHORIZED" | "NOT_CONFIGURED" | "INVALID";

/**
 * Validates a service bearer token without trusting identity or roles from the caller.
 * This is service authentication, not a replacement for per-user authorization.
 */
export function verifyBearerToken(
  authorizationHeader: string | undefined,
  expectedToken: string | undefined,
  minimumLength = 32,
): ApiTokenVerdict {
  if (!expectedToken || expectedToken.length < minimumLength) return "NOT_CONFIGURED";
  const prefix = "Bearer ";
  if (!authorizationHeader?.startsWith(prefix)) return "INVALID";
  const candidate = authorizationHeader.slice(prefix.length);
  return equalSecret(candidate, expectedToken) ? "AUTHORIZED" : "INVALID";
}
