// state: engine-generated — revisión humana pendiente.
/**
 * Red de seguridad contra abuso en rutas mutantes.
 *
 * El servidor ya limita las rutas caras una por una, pero una ruta nueva sin límite nacía
 * ilimitada: el inventario declaraba 60 mutantes sin control. Este middleware invierte el
 * defecto — todo `POST/PUT/PATCH/DELETE` bajo `/api/` queda limitado salvo lista explícita —
 * de modo que olvidar el límite por ruta deja de ser un fallo silencioso.
 *
 * Es un techo grueso (backstop), no el límite fino de cada superficie: las rutas con costo de
 * CPU mantienen su propio limiter más estricto y ambos se aplican.
 */

import type { NextFunction, Request, Response } from 'express';

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const DEFAULT_LIMIT_PER_MIN = 300;

export interface FixedWindowConsumer {
  consume(key: string, now?: number): { allowed: boolean; retryAfterMs: number };
}

/** `API_DEFAULT_RATE_LIMIT_PER_MIN` fuera de rango o ausente → techo por defecto, nunca cero. */
export function parseDefaultRateLimit(value: string | undefined): number {
  const raw = (value ?? '').trim();
  if (!/^\d{1,5}$/.test(raw)) return DEFAULT_LIMIT_PER_MIN;
  const parsed = Number(raw);
  return parsed >= 1 && parsed <= 100_000 ? parsed : DEFAULT_LIMIT_PER_MIN;
}

/**
 * Un bucket por ruta literal permitiría inflar el mapa con ids aleatorios hasta llenar
 * `maxKeys`, que es exactamente el fallo por capacidad que el limiter rechaza evaporando
 * cuotas ajenas. Los segmentos que parecen identificadores se colapsan a `:id`.
 */
export function normalizeRouteBucket(path: string): string {
  return path
    .split('/')
    .map((segment) => {
      if (!segment) return segment;
      if (/^\d+$/.test(segment)) return ':id';
      if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(segment))
        return ':id';
      if (/^[0-9a-f]{16,}$/i.test(segment)) return ':id';
      // Un identificador aleatorio casi siempre lleva dígitos; los segmentos alfabéticos
      // largos son nombres de ruta literales y no deben colapsarse.
      if (segment.length >= 24 && /\d/.test(segment) && /^[A-Za-z0-9_-]+$/.test(segment))
        return ':id';
      return segment;
    })
    .join('/');
}

export interface DefaultApiRateLimitDeps {
  readonly limiter: FixedWindowConsumer;
  /** Clave del cliente. Detrás de un balanceador sin `TRUST_PROXY`, `req.ip` es la del proxy. */
  readonly clientKey: (req: Request) => string;
  readonly exemptPaths?: readonly string[];
}

export function createDefaultApiRateLimit(deps: DefaultApiRateLimitDeps) {
  const exempt = new Set(deps.exemptPaths ?? []);
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!MUTATING_METHODS.has(req.method)) return next();
    if (!req.path.startsWith('/api/')) return next();
    if (exempt.has(req.path)) return next();
    const decision = deps.limiter.consume(
      normalizeRouteBucket(req.path) + ':' + deps.clientKey(req)
    );
    if (decision.allowed) return next();
    res.setHeader('Retry-After', String(Math.max(1, Math.ceil(decision.retryAfterMs / 1000))));
    res.status(429).json({
      success: false,
      error: 'RATE_LIMIT_EXCEEDED',
      scope: 'default-mutating-api',
      retryAfterMs: decision.retryAfterMs,
    });
  };
}
