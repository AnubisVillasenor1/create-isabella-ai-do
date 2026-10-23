/** INGRESS V6 — bounded normalization with body-budget enforcement. */
import { checkBodySize } from "./limits";

export interface RawIncoming {
  method: string; path: string; headers: Record<string, string>; query: Record<string, string>;
  body: unknown; remoteIp?: string; protocol: string;
}
export interface NormalizedRequest {
  requestId: string; traceId: string; methodId: string; tenantId?: string; principalId?: string;
  body: unknown; receivedAt: string; rawMethod: string; rawPath: string; headers: Record<string, string>;
}
export const MAX_HEADERS = 32;
export const MAX_QUERY_KEYS = 64;
export const MAX_HEADER_BYTES = 2 * 1024 * 1024;
export const DEFAULT_MAX_BODY_BYTES = 4 * 1024 * 1024;

export function sanitizeText(input: string, maxBytes = MAX_HEADER_BYTES): string {
  let out = input.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").trim();
  if (Buffer.byteLength(out, "utf8") <= maxBytes) return out;
  let end = Math.min(out.length, maxBytes);
  while (end > 0 && Buffer.byteLength(out.slice(0, end), "utf8") > maxBytes) end -= 1;
  return out.slice(0, end);
}
export function validateIngressShape(input: RawIncoming): void {
  if (!input || !input.method || !input.path) throw new Error("INGRESS: método y path son obligatorios (method and path are required)");
  const headerCount = Object.keys(input.headers ?? {}).length;
  if (headerCount > MAX_HEADERS) throw new Error(`INGRESS: demasiadas cabeceras (${headerCount}) (too many headers)`);
  const queryKeys = Object.keys(input.query ?? {}).length;
  if (queryKeys > MAX_QUERY_KEYS) throw new Error(`INGRESS: too many query keys (${queryKeys})`);
  const headerBytes = Object.values(input.headers ?? {}).reduce((sum, value) => sum + Buffer.byteLength(value, "utf8"), 0);
  if (headerBytes > MAX_HEADER_BYTES) throw new Error("INGRESS: header volume exceeds limit");
}
export function sanitizeHeaders(headers: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) out[key.toLowerCase()] = sanitizeText(value, 4096);
  return out;
}
export function normalizeIngress(
  input: RawIncoming,
  deps: { methodId: string; tenantId?: string; principalId?: string; maxBodyBytes?: number },
): NormalizedRequest {
  validateIngressShape(input);
  checkBodySize(input.body, deps.maxBodyBytes ?? DEFAULT_MAX_BODY_BYTES);
  return {
    requestId: crypto.randomUUID(), traceId: crypto.randomUUID(), methodId: deps.methodId,
    tenantId: deps.tenantId, principalId: deps.principalId, body: input.body,
    receivedAt: new Date().toISOString(), rawMethod: input.method.toUpperCase(), rawPath: sanitizeText(input.path, 8192),
    headers: sanitizeHeaders(input.headers ?? {}),
  };
}
