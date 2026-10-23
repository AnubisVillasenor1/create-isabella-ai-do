/**
 * Reintentos con backoff exponencial, jitter completo y deadline total (state: draft | engine-generated).
 *
 * - Jitter "full" (AWS Architecture Blog): delay = U(0, min(cap, base·2^n)); evita tormentas sincronizadas.
 * - El deadline es TOTAL: nunca se duerme más allá de lo que queda del presupuesto de tiempo.
 * - Solo se reintenta lo clasificado como transitorio; los errores permanentes salen de inmediato.
 * - Respeta AbortSignal. Reloj, sueño y aleatoriedad son inyectables (pruebas deterministas).
 * No ejecuta efectos por sí mismo: reintentar una operación NO idempotente es decisión del llamador.
 */
import { randomBytes } from "node:crypto";

export interface RetryOptions {
  readonly maxAttempts?: number;
  readonly baseDelayMs?: number;
  readonly maxDelayMs?: number;
  /** Presupuesto total en ms desde el primer intento. */
  readonly deadlineMs?: number;
  readonly isRetryable?: (error: unknown) => boolean;
  readonly signal?: AbortSignal;
  readonly now?: () => number;
  readonly sleep?: (ms: number, signal?: AbortSignal) => Promise<void>;
  /** Devuelve un número en [0,1). Por defecto CSPRNG. */
  readonly random?: () => number;
  readonly onRetry?: (info: { attempt: number; delayMs: number; error: unknown }) => void;
}

export class RetryExhaustedError extends Error {
  constructor(readonly attempts: number, readonly reason: "MAX_ATTEMPTS" | "DEADLINE" | "ABORTED", readonly lastError: unknown) {
    super(`RETRY: gave up after ${attempts} attempt(s) (${reason})`);
    this.name = "RetryExhaustedError";
  }
}

export function secureRandom(): number {
  const b = randomBytes(6);
  return (b.readUIntBE(0, 6) % 2 ** 48) / 2 ** 48;
}

export function backoffDelay(attempt: number, baseDelayMs: number, maxDelayMs: number, random: () => number): number {
  if (!Number.isInteger(attempt) || attempt < 1) throw new RangeError("RETRY: attempt must be an integer >= 1");
  const ceiling = Math.min(maxDelayMs, baseDelayMs * 2 ** Math.min(attempt - 1, 30));
  return Math.floor(random() * ceiling);
}

function defaultSleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(signal.reason);
      return;
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    const onAbort = (): void => {
      clearTimeout(timer);
      reject(signal?.reason);
    };
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

/** Errores de red/HTTP típicamente transitorios. 4xx (salvo 408/425/429) son permanentes. */
export function isTransientError(error: unknown): boolean {
  const e = error as { status?: unknown; statusCode?: unknown; code?: unknown } | null;
  if (e === null || typeof e !== "object") return false;
  const status = typeof e.status === "number" ? e.status : typeof e.statusCode === "number" ? e.statusCode : undefined;
  if (status !== undefined) return status === 408 || status === 425 || status === 429 || (status >= 500 && status <= 599);
  const code = typeof e.code === "string" ? e.code : "";
  return ["ECONNRESET", "ECONNREFUSED", "ETIMEDOUT", "EAI_AGAIN", "EPIPE", "ENOTFOUND", "UND_ERR_SOCKET", "UND_ERR_CONNECT_TIMEOUT"].includes(code);
}

export async function retry<T>(operation: (attempt: number) => Promise<T>, options: RetryOptions = {}): Promise<T> {
  const maxAttempts = options.maxAttempts ?? 4;
  const baseDelayMs = options.baseDelayMs ?? 100;
  const maxDelayMs = options.maxDelayMs ?? 5_000;
  const now = options.now ?? Date.now;
  const sleep = options.sleep ?? defaultSleep;
  const random = options.random ?? secureRandom;
  const isRetryable = options.isRetryable ?? isTransientError;
  if (!Number.isInteger(maxAttempts) || maxAttempts < 1 || maxAttempts > 20) throw new RangeError("RETRY: maxAttempts must be 1..20");
  if (!(baseDelayMs > 0) || !(maxDelayMs >= baseDelayMs)) throw new RangeError("RETRY: invalid delays");
  if (options.deadlineMs !== undefined && !(options.deadlineMs > 0)) throw new RangeError("RETRY: deadlineMs must be positive");
  const startedAt = now();
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    if (options.signal?.aborted) throw new RetryExhaustedError(attempt - 1, "ABORTED", lastError);
    try {
      return await operation(attempt);
    } catch (error) {
      lastError = error;
      if (!isRetryable(error)) throw error;
      if (attempt === maxAttempts) throw new RetryExhaustedError(attempt, "MAX_ATTEMPTS", error);
      const delayMs = backoffDelay(attempt, baseDelayMs, maxDelayMs, random);
      if (options.deadlineMs !== undefined && now() - startedAt + delayMs >= options.deadlineMs) {
        throw new RetryExhaustedError(attempt, "DEADLINE", error);
      }
      options.onRetry?.({ attempt, delayMs, error });
      try {
        await sleep(delayMs, options.signal);
      } catch {
        throw new RetryExhaustedError(attempt, "ABORTED", error);
      }
    }
  }
  throw new RetryExhaustedError(maxAttempts, "MAX_ATTEMPTS", lastError);
}
