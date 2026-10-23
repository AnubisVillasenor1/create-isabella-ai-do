/**
 * Bulkhead: límite de concurrencia con cola acotada y load shedding (state: draft | engine-generated).
 *
 * Aísla un recurso lento (p. ej. un proveedor LLM) para que no agote el proceso. Si la cola está llena
 * o la espera excede `queueTimeoutMs`, rechaza rápido (fail-fast) en vez de acumular latencia.
 * Las métricas son locales al proceso.
 */
export class BulkheadRejectedError extends Error {
  constructor(readonly reason: "QUEUE_FULL" | "QUEUE_TIMEOUT" | "CLOSED") {
    super(`BULKHEAD: rejected (${reason})`);
    this.name = "BulkheadRejectedError";
  }
}

export interface BulkheadOptions {
  readonly maxConcurrent: number;
  readonly maxQueue: number;
  readonly queueTimeoutMs: number;
}

export interface BulkheadStats {
  readonly active: number;
  readonly queued: number;
  readonly completed: number;
  readonly rejected: number;
}

interface Waiter {
  resolve: () => void;
  reject: (e: BulkheadRejectedError) => void;
  timer: ReturnType<typeof setTimeout>;
}

export class Bulkhead {
  private active = 0;
  private completed = 0;
  private rejected = 0;
  private closed = false;
  private readonly queue: Waiter[] = [];

  constructor(private readonly opts: BulkheadOptions) {
    if (!Number.isInteger(opts.maxConcurrent) || opts.maxConcurrent < 1) throw new RangeError("BULKHEAD: maxConcurrent must be >= 1");
    if (!Number.isInteger(opts.maxQueue) || opts.maxQueue < 0) throw new RangeError("BULKHEAD: maxQueue must be >= 0");
    if (!(opts.queueTimeoutMs > 0)) throw new RangeError("BULKHEAD: queueTimeoutMs must be > 0");
  }

  stats(): BulkheadStats {
    return { active: this.active, queued: this.queue.length, completed: this.completed, rejected: this.rejected };
  }

  private reject(reason: "QUEUE_FULL" | "QUEUE_TIMEOUT" | "CLOSED"): BulkheadRejectedError {
    this.rejected += 1;
    return new BulkheadRejectedError(reason);
  }

  private acquire(): Promise<void> {
    if (this.closed) return Promise.reject(this.reject("CLOSED"));
    if (this.active < this.opts.maxConcurrent) {
      this.active += 1;
      return Promise.resolve();
    }
    if (this.queue.length >= this.opts.maxQueue) return Promise.reject(this.reject("QUEUE_FULL"));
    return new Promise<void>((resolve, reject) => {
      const waiter: Waiter = {
        resolve,
        reject,
        timer: setTimeout(() => {
          const i = this.queue.indexOf(waiter);
          if (i >= 0) this.queue.splice(i, 1);
          reject(this.reject("QUEUE_TIMEOUT"));
        }, this.opts.queueTimeoutMs),
      };
      this.queue.push(waiter);
    });
  }

  private release(): void {
    this.completed += 1;
    const next = this.queue.shift();
    if (next !== undefined) {
      clearTimeout(next.timer);
      next.resolve(); // el permiso pasa directamente al siguiente: `active` no cambia
    } else {
      this.active -= 1;
    }
  }

  async run<T>(task: () => Promise<T>): Promise<T> {
    await this.acquire();
    try {
      return await task();
    } finally {
      this.release();
    }
  }

  /** Rechaza a los que esperan y a los nuevos; las tareas en curso terminan. */
  close(): void {
    this.closed = true;
    for (const w of this.queue.splice(0)) {
      clearTimeout(w.timer);
      w.reject(this.reject("CLOSED"));
    }
  }
}
