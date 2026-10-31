/**
 * state: engine-generated
 * Maps an unknown thrown value to a safe HTTP response. Upstream errors may carry arbitrary
 * `statusCode`/`type`/`message` fields (and provider payloads); none of them is trusted verbatim.
 */
export interface SafeHttpError {
  readonly status: number;
  readonly body: { readonly error: string; readonly message: string };
}

const TYPE_RE = /^[A-Z][A-Z0-9_]{2,39}$/;

export function toHttpError(error: unknown, fallbackType: string): SafeHttpError {
  const rec = typeof error === 'object' && error !== null ? (error as Record<string, unknown>) : {};
  const raw = rec.statusCode;
  const status =
    typeof raw === 'number' && Number.isInteger(raw) && raw >= 400 && raw <= 599 ? raw : 500;
  const type = typeof rec.type === 'string' && TYPE_RE.test(rec.type) ? rec.type : fallbackType;
  // 5xx: never reflect provider/internal text to the client; 4xx: short, single-line message.
  const message =
    status >= 500
      ? 'El proveedor multimodal no pudo completar la solicitud.'
      : (error instanceof Error ? error.message : String(error))
          .replace(/[\r\n]+/g, ' ')
          .slice(0, 200);
  return { status, body: { error: type, message } };
}

/** Log-safe description (no stack, no nested provider payload). */
export function describeError(error: unknown): string {
  return (error instanceof Error ? error.message : String(error))
    .replace(/[\r\n]+/g, ' ')
    .slice(0, 200);
}
