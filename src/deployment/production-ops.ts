/**
 * Production operations — mejoras operacionales para producción y despliegue.
 *
 * Contratos deterministas de:
 * - Salud/readiness con degradación explícita.
 * - Rate limiting por token bucket (fail-closed ante exceso).
 * - Timeouts y circuit breaker para dependencias externas.
 * - Correlación (request_id/trace_id/span_id) y ventanas de mantenimiento.
 *
 * No ejecuta I/O ni toca la red: son políticas operativas puras.
 */
import { randomUUID } from 'node:crypto';

export type HealthStatus = 'healthy' | 'degraded' | 'unavailable';

export interface DependencyHealth {
  name: string;
  status: HealthStatus;
  latencyMs?: number;
  required: boolean;
}

export interface ProductionReadinessReport {
  status: HealthStatus;
  ready: boolean;
  blockers: readonly string[];
  checkedAt: string;
}

/**
 * Readiness: `unavailable` si falla una dependencia requerida; `degraded` si una
 * dependencia opcional falla. Fail-closed: solo `healthy` es `ready`.
 */
export function assessProductionReadiness(
  dependencies: readonly DependencyHealth[],
  now = new Date()
): ProductionReadinessReport {
  const blockers: string[] = [];
  let status: HealthStatus = 'healthy';

  // An empty dependency set is missing evidence, not proof of readiness.
  if (dependencies.length === 0) {
    return {
      status: 'unavailable',
      ready: false,
      blockers: ['dependencies:not-configured'],
      checkedAt: now.toISOString(),
    };
  }

  const seen = new Set<string>();
  for (const dep of dependencies) {
    const name = typeof dep?.name === 'string' ? dep.name.trim() : '';
    if (!name || seen.has(name)) {
      status = 'unavailable';
      blockers.push(!name ? 'dependency:invalid-name' : `dependency:duplicate:${name}`);
      continue;
    }
    seen.add(name);
    if (
      (dep.status !== 'healthy' && dep.status !== 'degraded' && dep.status !== 'unavailable') ||
      typeof dep.required !== 'boolean'
    ) {
      status = 'unavailable';
      blockers.push(`${name}:invalid-health-record`);
      continue;
    }

    if (dep.status === 'unavailable') {
      if (dep.required) {
        status = 'unavailable';
        blockers.push(`${name}:unavailable`);
      } else if (status === 'healthy') {
        status = 'degraded';
      }
    } else if (dep.status === 'degraded') {
      if (dep.required) blockers.push(`${name}:degraded`);
      if (status === 'healthy') status = 'degraded';
    }
  }
  return {
    status,
    ready: status === 'healthy' && blockers.length === 0,
    blockers,
    checkedAt: now.toISOString(),
  };
}

/* ------------------------------------------------------------------ */
/* Rate limiting (token bucket)                                       */
/* ------------------------------------------------------------------ */

export interface RateLimitDecision {
  allowed: boolean;
  remaining: number;
  retryAfterMs: number;
}

export class TokenBucket {
  private tokens: number;
  private lastRefill: number;

  constructor(
    private readonly capacity: number,
    private readonly refillPerMs: number,
    now = Date.now()
  ) {
    if (!Number.isSafeInteger(capacity) || capacity < 1) {
      throw new RangeError('OPS: token bucket capacity must be a positive safe integer');
    }
    if (!Number.isFinite(refillPerMs) || refillPerMs <= 0) {
      throw new RangeError('OPS: refill rate must be finite and > 0');
    }
    if (!Number.isFinite(now)) throw new RangeError('OPS: initial time must be finite');
    this.tokens = capacity;
    this.lastRefill = now;
  }

  tryConsume(cost = 1, now = Date.now()): RateLimitDecision {
    if (!Number.isFinite(cost) || cost < 1) {
      throw new RangeError('OPS: cost must be finite and >= 1');
    }
    if (cost > this.capacity) {
      throw new RangeError('OPS: cost cannot exceed token bucket capacity');
    }
    if (!Number.isFinite(now)) throw new RangeError('OPS: time must be finite');
    this.refill(now);
    if (this.tokens >= cost) {
      this.tokens -= cost;
      return { allowed: true, remaining: Math.floor(this.tokens), retryAfterMs: 0 };
    }
    const deficit = cost - this.tokens;
    return {
      allowed: false,
      remaining: Math.floor(this.tokens),
      retryAfterMs: Math.ceil(deficit / this.refillPerMs),
    };
  }

  private refill(now: number): void {
    // Clock regressions must not move the refill watermark backwards: doing so
    // would allow a later timestamp to count the same interval twice.
    if (now <= this.lastRefill) return;
    const elapsed = now - this.lastRefill;
    this.tokens = Math.min(this.capacity, this.tokens + elapsed * this.refillPerMs);
    this.lastRefill = now;
  }

  get available(): number {
    return Math.floor(this.tokens);
  }
}

/* ------------------------------------------------------------------ */
/* Circuit breaker                                                    */
/* ------------------------------------------------------------------ */

export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export interface CircuitBreakerOptions {
  failureThreshold?: number;
  openMs?: number;
}

export class CircuitBreaker {
  private state: CircuitState = 'CLOSED';
  private failures = 0;
  private openedAt = 0;
  private halfOpenProbeInFlight = false;
  private readonly failureThreshold: number;
  private readonly openMs: number;

  constructor(opts: CircuitBreakerOptions = {}) {
    this.failureThreshold = opts.failureThreshold ?? 5;
    this.openMs = opts.openMs ?? 30_000;
    if (!Number.isSafeInteger(this.failureThreshold) || this.failureThreshold < 1) {
      throw new RangeError('OPS: circuit breaker failureThreshold must be a positive safe integer');
    }
    if (!Number.isFinite(this.openMs) || this.openMs <= 0) {
      throw new RangeError('OPS: circuit breaker openMs must be finite and > 0');
    }
  }

  /** ¿Se permite intentar la llamada? Abre el circuito tras N fallos. */
  allow(now = Date.now()): boolean {
    if (!Number.isFinite(now)) throw new RangeError('OPS: circuit breaker time must be finite');
    if (this.state === 'OPEN') {
      if (now - this.openedAt >= this.openMs) {
        this.state = 'HALF_OPEN';
        this.halfOpenProbeInFlight = true;
        return true;
      }
      return false;
    }
    if (this.state === 'HALF_OPEN') {
      // Only one request may probe a recovering dependency at a time.
      if (this.halfOpenProbeInFlight) return false;
      this.halfOpenProbeInFlight = true;
    }
    return true;
  }

  recordSuccess(): void {
    this.failures = 0;
    this.state = 'CLOSED';
    this.halfOpenProbeInFlight = false;
  }

  recordFailure(now = Date.now()): void {
    if (!Number.isFinite(now)) throw new RangeError('OPS: circuit breaker time must be finite');
    this.failures += 1;
    if (this.state === 'HALF_OPEN' || this.failures >= this.failureThreshold) {
      this.state = 'OPEN';
      this.openedAt = now;
    }
    this.halfOpenProbeInFlight = false;
  }

  get currentState(): CircuitState {
    return this.state;
  }
}

/** Ejecuta con timeout; un timeout nunca se reporta como éxito. */
export async function withTimeout<T>(
  fn: () => Promise<T>,
  timeoutMs: number,
  label = 'operation'
): Promise<T> {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    throw new RangeError('OPS: timeoutMs must be finite and > 0');
  }
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      fn(),
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error(`OPS: ${label} timed out after ${timeoutMs}ms`)),
          timeoutMs
        );
        timer.unref?.();
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/* ------------------------------------------------------------------ */
/* Correlación                                                        */
/* ------------------------------------------------------------------ */

export interface CorrelationContext {
  requestId: string;
  traceId: string;
  spanId: string;
  parentSpanId?: string;
}

/** Crea un contexto de correlación; propaga traceId del padre si existe. */
export function createCorrelation(parent?: Partial<CorrelationContext>): CorrelationContext {
  return {
    requestId: parent?.requestId ?? randomUUID(),
    traceId: parent?.traceId ?? randomUUID(),
    spanId: randomUUID().slice(0, 16),
    parentSpanId: parent?.spanId,
  };
}

/* ------------------------------------------------------------------ */
/* Ventanas de mantenimiento                                          */
/* ------------------------------------------------------------------ */

export interface MaintenanceWindow {
  startsAt: string;
  endsAt: string;
  reason: string;
}

/** ¿Está activa la ventana de mantenimiento en `now`? */
export function isMaintenanceActive(
  windows: readonly MaintenanceWindow[],
  now = new Date()
): boolean {
  const t = now.getTime();
  if (!Number.isFinite(t))
    throw new RangeError('OPS: current maintenance-check time must be valid');

  return windows.some((window) => {
    const startsAt = new Date(window.startsAt).getTime();
    const endsAt = new Date(window.endsAt).getTime();
    if (!Number.isFinite(startsAt) || !Number.isFinite(endsAt) || startsAt > endsAt) {
      throw new RangeError(
        'OPS: maintenance windows must contain valid dates with startsAt <= endsAt'
      );
    }
    return t >= startsAt && t <= endsAt;
  });
}

export interface OpsSnapshot {
  readiness: ProductionReadinessReport;
  maintenanceActive: boolean;
  correlation: CorrelationContext;
}

/** Snapshot operativo coherente para health/readiness. */
export function buildOpsSnapshot(
  dependencies: readonly DependencyHealth[],
  windows: readonly MaintenanceWindow[] = [],
  now = new Date()
): OpsSnapshot {
  return {
    readiness: assessProductionReadiness(dependencies, now),
    maintenanceActive: isMaintenanceActive(windows, now),
    correlation: createCorrelation(),
  };
}
