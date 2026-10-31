// state: engine-generated — revisión humana pendiente.
/**
 * Respuestas de fallo sin detalles internos (SECURITY.md) pero correlacionables.
 *
 * Un `Error.message` de terceros puede llevar SQL, rutas absolutas, URIs de conexión o
 * fragmentos de cuerpo. Aquí sólo sale al cliente un código estable; el detalle se registra
 * en el proceso con el mismo `correlationId` que ve quien reporta el incidente.
 */

import { randomBytes } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

// Node normaliza las cabeceras entrantes a minúsculas; leer por 'X-Request-Id' daría
// siempre undefined y el id del cliente se descartaría en silencio.
const INCOMING_ID_HEADER = 'x-request-id';
const OUTGOING_ID_HEADER = 'X-Request-Id';
const REQUEST_ID_PATTERN = /^[A-Za-z0-9_-]{8,64}$/;
/** Códigos propios del sistema: SCREAMING_SNAKE. Un mensaje en prosa nunca coincide. */
const SAFE_CODE_PATTERN = /^[A-Z][A-Z0-9_]{2,63}$/;
/** `res.locals` es el canal tipado que ya usa el repo; aumentar `Request` requeriría
 * declarar `@types/express-serve-static-core` como dependencia directa. */
const REQUEST_ID_LOCAL = 'requestId';

function newCorrelationId(): string {
  return randomBytes(8).toString('hex');
}

/** Reutiliza el id del cliente sólo si es seguro para reflejarlo en cabeceras y logs. */
export function resolveCorrelationId(incoming: unknown): string {
  const value = Array.isArray(incoming) ? incoming[0] : incoming;
  if (typeof value === 'string' && REQUEST_ID_PATTERN.test(value)) return value;
  return newCorrelationId();
}

export function correlationIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  const id = resolveCorrelationId(req.headers[INCOMING_ID_HEADER]);
  res.locals[REQUEST_ID_LOCAL] = id;
  res.setHeader(OUTGOING_ID_HEADER, id);
  next();
}

/** Id ya emitido en la cabecera; si no hay middleware, lo genera y lo publica igual. */
export function correlationIdOf(res: Response): string {
  const existing = res.locals[REQUEST_ID_LOCAL];
  if (typeof existing === 'string') return existing;
  const id = newCorrelationId();
  res.locals[REQUEST_ID_LOCAL] = id;
  res.setHeader(OUTGOING_ID_HEADER, id);
  return id;
}

/**
 * El mensaje viaja a la salida sólo si es un código del sistema. Cualquier otro texto se
 * convierte en `codeFallback`, que es lo que el cliente puede depender de ver.
 */
export function failureCode(cause: unknown, codeFallback = 'REQUEST_FAILED'): string {
  const message = cause instanceof Error ? cause.message : typeof cause === 'string' ? cause : '';
  const trimmed = message.trim();
  return SAFE_CODE_PATTERN.test(trimmed) ? trimmed : codeFallback;
}

export interface FailureLogSink {
  (entry: { correlationId: string; status: number; code: string; cause: unknown }): void;
}

export function respondWithFailure(
  res: Response,
  status: number,
  cause: unknown,
  options?: { code?: string; log?: FailureLogSink }
): void {
  const code = options?.code ?? failureCode(cause);
  const correlationId = correlationIdOf(res);
  if (options?.log) options.log({ correlationId, status, code, cause });
  if (res.headersSent) return;
  res.status(status).json({ success: false, error: code, correlationId });
}
