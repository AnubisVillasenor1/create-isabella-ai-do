/**
 * state: engine-generated
 * Shared latency budget for a provider fallback chain.
 *
 * Problem (AUD-13): the chat chain tried keyless → gateway → OpenRouter → up to 5 Hugging Face
 * models → N compatible providers sequentially, each with its own full timeout, so a degraded
 * network could stall a single reply for well over a minute before the honest local fallback.
 * A budget caps the WHOLE chain: every attempt gets min(per-attempt timeout, remaining budget)
 * and the chain stops trying new candidates once the budget is spent.
 * CAPABILITY ≠ AUTHORITY: a deadline only bounds waiting; it never grants or widens permissions.
 */
export interface DeadlineClock {
  now(): number;
}

export const SYSTEM_CLOCK: DeadlineClock = { now: () => Date.now() };

/** Floor so an attempt is never started with a uselessly small timeout. */
export const MIN_ATTEMPT_MS = 750;

export class DeadlineBudget {
  private readonly startedAt: number;

  constructor(
    private readonly totalMs: number,
    private readonly clock: DeadlineClock = SYSTEM_CLOCK,
    private readonly parentSignal?: AbortSignal
  ) {
    if (!Number.isFinite(totalMs) || totalMs <= 0)
      throw new Error('DEADLINE: totalMs must be a positive finite number');
    this.startedAt = clock.now();
  }

  elapsedMs(): number {
    return Math.max(0, this.clock.now() - this.startedAt);
  }

  remainingMs(): number {
    return Math.max(0, this.totalMs - this.elapsedMs());
  }

  /** True only when the caller disconnected/cancelled; timeout expiry is separate. */
  cancelled(): boolean {
    return this.parentSignal?.aborted ?? false;
  }

  /** True when the caller cancelled or no useful attempt window remains. */
  expired(): boolean {
    return this.cancelled() || this.remainingMs() < MIN_ATTEMPT_MS;
  }

  /** Timeout for the next attempt: never longer than the per-attempt cap nor the remaining budget. */
  attemptMs(perAttemptMs: number): number {
    if (!Number.isFinite(perAttemptMs) || perAttemptMs <= 0)
      throw new Error('DEADLINE: perAttemptMs must be positive');
    return Math.max(1, Math.min(perAttemptMs, this.remainingMs()));
  }

  signal(perAttemptMs: number): AbortSignal {
    const timeout = AbortSignal.timeout(this.attemptMs(perAttemptMs));
    return this.parentSignal ? AbortSignal.any([timeout, this.parentSignal]) : timeout;
  }
}

/** Parse a bounded millisecond value from an env-like string; invalid input falls back. */
export function boundedBudgetMs(
  raw: string | undefined,
  fallback: number,
  min: number,
  max: number
): number {
  const parsed = raw === undefined ? Number.NaN : Number(raw);
  const candidate = Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
  return Math.min(max, Math.max(min, Math.trunc(candidate)));
}

export interface HedgedTask<T> {
  readonly label: string;
  readonly run: () => Promise<T | null>;
}

export interface HedgedWinner<T> {
  readonly label: string;
  readonly value: T;
  readonly startedCount: number;
}

/**
 * Hedged first-success race (AUD-13b). Starts task 0; the next task starts when the previous one
 * finishes with null/throws (immediately) OR when `hedgeDelayMs` passes without a result (in parallel).
 * Resolves with the first non-null value; null when every task is exhausted or the budget expires.
 * Only use for providers where a duplicate in-flight request is acceptable (free tiers) — never for
 * actions with side effects. Losing tasks are not cancelled here; give them budget-bound signals.
 */
export function hedgedFirst<T>(
  tasks: readonly HedgedTask<T>[],
  hedgeDelayMs: number,
  budget?: DeadlineBudget
): Promise<HedgedWinner<T> | null> {
  if (!Number.isFinite(hedgeDelayMs) || hedgeDelayMs < 0)
    throw new Error('HEDGE: hedgeDelayMs must be >= 0');
  return new Promise((resolve) => {
    let started = 0;
    let finished = 0;
    let settled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const done = (winner: HedgedWinner<T> | null): void => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      resolve(winner);
    };
    const startNext = (): void => {
      if (settled) return;
      if (started >= tasks.length || budget?.expired()) {
        if (finished >= started) done(null);
        return;
      }
      const task = tasks[started++]!;
      if (timer) clearTimeout(timer);
      if (started < tasks.length) timer = setTimeout(startNext, hedgeDelayMs);
      task.run().then(
        (value) => {
          finished++;
          if (value !== null && value !== undefined)
            done({ label: task.label, value, startedCount: started });
          else {
            if (finished >= started && started >= tasks.length) done(null);
            else startNext();
          }
        },
        () => {
          finished++;
          if (finished >= started && started >= tasks.length) done(null);
          else startNext();
        }
      );
    };
    if (tasks.length === 0) done(null);
    else startNext();
  });
}
