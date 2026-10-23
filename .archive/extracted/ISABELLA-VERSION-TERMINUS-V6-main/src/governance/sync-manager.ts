/**
 * SYNC_SPEC — coordinación concurrente de ingestión, LSP, índice, Git y BookPI.
 *
 * Primitivas: Lock, RLock, Semaphore, BoundedSemaphore, Condition, Event, Barrier.
 *
 * Reglas:
 *   - Análisis paralelo; mutación serializada por entity_id.
 *   - No mantener locks durante red, inferencia o Git remoto.
 *   - Idempotencia y timeout obligatorios.
 *   - Tenant, workspace y servicio forman el scope mínimo.
 *   - Git, índice y BookPI deben reconciliarse antes de release.
 *   - Locks en memoria NO son coordinación multi-host.
 *
 * Lifecycle: INITIAL → STARTED → STOPPING → SHUTDOWN.
 * Tokens deben tener scope, expiración, capacidades, revocación y auditoría.
 * Proxies no son autoridad epistemológica.
 */
import { randomUUID } from "node:crypto";

/* ------------------------------------------------------------------ */
/* Primitivas de coordinación asíncronas                              */
/* ------------------------------------------------------------------ */

/** Lock FIFO con timeout real, eliminación de waiters expirados y handoff atómico. */
export class Lock {
  private locked = false;
  private readonly queue: Array<{
    ownerId: string;
    resolve: () => void;
    timer: ReturnType<typeof setTimeout>;
  }> = [];
  private owner: string | null = null;
  private depth = 0;

  constructor(private readonly reentrant = false) {}

  async acquire(timeoutMs = 5000, ownerId: string = randomUUID()): Promise<string> {
    if (!Number.isFinite(timeoutMs) || timeoutMs < 0) throw new Error("SYNC: lock timeout must be >= 0");
    if (this.reentrant && this.locked && this.owner === ownerId) {
      this.depth += 1;
      return ownerId;
    }
    if (!this.locked && this.queue.length === 0) {
      this.locked = true;
      this.owner = ownerId;
      this.depth = 1;
      return ownerId;
    }
    return new Promise<string>((resolve, reject) => {
      let waiter!: { ownerId: string; resolve: () => void; timer: ReturnType<typeof setTimeout> };
      const timer = setTimeout(() => {
        const index = this.queue.indexOf(waiter);
        if (index >= 0) this.queue.splice(index, 1);
        reject(new Error("SYNC: lock acquire timeout"));
      }, timeoutMs);
      waiter = {
        ownerId,
        timer,
        resolve: () => {
          clearTimeout(timer);
          this.locked = true;
          this.owner = ownerId;
          this.depth = 1;
          resolve(ownerId);
        },
      };
      this.queue.push(waiter);
    });
  }

  release(ownerId: string): void {
    if (!this.locked) throw new Error("SYNC: lock not held");
    if (typeof ownerId !== "string" || ownerId.length === 0) throw new Error("SYNC: lock owner required");
    if (ownerId !== this.owner) throw new Error("SYNC: lock owner mismatch");
    if (this.reentrant && this.depth > 1) {
      this.depth -= 1;
      return;
    }
    const next = this.queue.shift();
    if (next) {
      next.resolve();
      return;
    }
    this.locked = false;
    this.owner = null;
    this.depth = 0;
  }

  isLocked(): boolean {
    return this.locked;
  }

  async runExclusive<T>(fn: () => Promise<T>, timeoutMs = 5000): Promise<T> {
    const ownerId = await this.acquire(timeoutMs);
    try {
      return await fn();
    } finally {
      this.release(ownerId);
    }
  }
}

export class RLock extends Lock {
  constructor() {
    super(true);
  }
}

/** Semáforo: entrega los permisos directamente a la cola y limpia timeouts. */
export class Semaphore {
  protected available: number;
  protected inUse = 0;
  private readonly queue: Array<{ resolve: () => void; reject: (error: Error) => void; timer: ReturnType<typeof setTimeout> }> = [];

  constructor(permits: number) {
    if (!Number.isInteger(permits) || permits < 1) throw new Error("SYNC: semaphore permits must be >= 1");
    this.available = permits;
  }

  async acquire(timeoutMs = 5000): Promise<void> {
    if (!Number.isFinite(timeoutMs) || timeoutMs < 0) throw new Error("SYNC: semaphore timeout must be >= 0");
    if (this.available > 0 && this.queue.length === 0) {
      this.available -= 1;
      this.inUse += 1;
      return;
    }
    await new Promise<void>((resolve, reject) => {
      const waiter = {
        resolve: () => { clearTimeout(waiter.timer); resolve(); },
        reject: (error: Error) => { clearTimeout(waiter.timer); reject(error); },
        timer: setTimeout(() => {
          const index = this.queue.indexOf(waiter);
          if (index >= 0) this.queue.splice(index, 1);
          reject(new Error("SYNC: semaphore acquire timeout"));
        }, timeoutMs),
      };
      this.queue.push(waiter);
    });
  }

  release(): void {
    const next = this.queue.shift();
    if (next) {
      next.resolve();
      return; // The active permit is transferred; inUse is unchanged.
    }
    if (this.inUse > 0) this.inUse -= 1;
    this.available += 1;
  }

  get availablePermits(): number {
    return this.available;
  }
}

/** BoundedSemaphore: no permite liberar más permisos de los adquiridos. */
export class BoundedSemaphore extends Semaphore {
  constructor(permits: number) {
    super(permits);
  }

  override release(): void {
    if (this.inUse <= 0) throw new Error("SYNC: bounded semaphore release overflow");
    super.release();
  }
}

/** Condition: los waiters se retiran al notificar o al agotar su ventana de polling. */
export class Condition {
  private readonly waiters: Array<() => void> = [];

  async waitFor(predicate: () => boolean, timeoutMs = 5000): Promise<void> {
    if (!Number.isFinite(timeoutMs) || timeoutMs < 0) throw new Error("SYNC: condition timeout must be >= 0");
    const deadline = Date.now() + timeoutMs;
    while (!predicate()) {
      const remaining = deadline - Date.now();
      if (remaining <= 0) throw new Error("SYNC: condition wait timeout");
      await new Promise<void>((resolve) => {
        let settled = false;
        let timer: ReturnType<typeof setTimeout>;
        const waiter = () => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          const index = this.waiters.indexOf(waiter);
          if (index >= 0) this.waiters.splice(index, 1);
          resolve();
        };
        timer = setTimeout(waiter, Math.min(5, remaining));
        this.waiters.push(waiter);
      });
    }
  }

  notifyAll(): void {
    const waiters = this.waiters.splice(0, this.waiters.length);
    for (const waiter of waiters) waiter();
  }
}

/** Event: señal de un solo disparo con timeout y cleanup de waiters. */
export class Event {
  private signalled = false;
  private readonly waiters: Array<() => void> = [];

  set(): void {
    this.signalled = true;
    this.notifyAll();
  }

  isSet(): boolean {
    return this.signalled;
  }

  async wait(timeoutMs = 5000): Promise<void> {
    if (this.signalled) return;
    if (!Number.isFinite(timeoutMs) || timeoutMs < 0) throw new Error("SYNC: event timeout must be >= 0");
    await new Promise<void>((resolve, reject) => {
      let settled = false;
      let timer: ReturnType<typeof setTimeout>;
      const remove = (waiter: () => void) => {
        const index = this.waiters.indexOf(waiter);
        if (index >= 0) this.waiters.splice(index, 1);
      };
      const waiter = () => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        remove(waiter);
        resolve();
      };
      timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        remove(waiter);
        reject(new Error("SYNC: event wait timeout"));
      }, timeoutMs);
      this.waiters.push(waiter);
    });
  }

  private notifyAll(): void {
    const waiters = this.waiters.splice(0, this.waiters.length);
    for (const waiter of waiters) waiter();
  }
}

/** Barrier reutilizable con generaciones; un timeout rompe solo la generación actual. */
export class Barrier {
  private waiting = 0;
  private generation = 0;
  private readonly waiters = new Map<number, Array<{ resolve: () => void; reject: (error: Error) => void; timer: ReturnType<typeof setTimeout> }>>();

  constructor(private readonly parties: number) {
    if (!Number.isInteger(parties) || parties < 1) throw new Error("SYNC: barrier parties must be >= 1");
  }

  async wait(timeoutMs = 5000): Promise<void> {
    if (!Number.isFinite(timeoutMs) || timeoutMs < 0) throw new Error("SYNC: barrier timeout must be >= 0");
    if (this.parties === 1) return;
    const generation = this.generation;
    this.waiting += 1;

    if (this.waiting === this.parties) {
      this.waiting = 0;
      this.generation += 1;
      const group = this.waiters.get(generation) ?? [];
      this.waiters.delete(generation);
      for (const waiter of group) {
        clearTimeout(waiter.timer);
        waiter.resolve();
      }
      return;
    }

    await new Promise<void>((resolve, reject) => {
      const waiter = {
        resolve,
        reject,
        timer: setTimeout(() => this.breakGeneration(generation), timeoutMs),
      };
      const group = this.waiters.get(generation) ?? [];
      group.push(waiter);
      this.waiters.set(generation, group);
    });
  }

  private breakGeneration(generation: number): void {
    const group = this.waiters.get(generation);
    if (!group) return;
    this.waiters.delete(generation);
    if (generation === this.generation) {
      this.waiting = 0;
      this.generation += 1;
    }
    for (const waiter of group) {
      clearTimeout(waiter.timer);
      waiter.reject(new Error("SYNC: barrier wait timeout; generation aborted"));
    }
  }
}

/* ------------------------------------------------------------------ */
/* Serialización de mutación por entidad                              */
/* ------------------------------------------------------------------ */

export interface SyncScope {
  tenantId: string;
  workspace: string;
  service: string;
}

export function scopeKey(scope: SyncScope): string {
  const parts = [scope.tenantId, scope.workspace, scope.service];
  if (parts.some((part) => typeof part !== "string" || !part.trim() || part.length > 256)) {
    throw new Error("SYNC: tenant/workspace/service scope required");
  }
  return parts.map((part) => `${part.length}:${part}`).join("|") + "|";
}

/**
 * Serializa la mutación por `entity_id` dentro de un scope mínimo (tenant/workspace/servicio).
 * El análisis puede ejecutarse en paralelo (ver `analyzeParallel`).
 */
export class EntityMutationManager {
  private readonly locks = new Map<string, RLock>();

  private key(scope: SyncScope, entityId: string): string {
    return `${scopeKey(scope)}::${entityId}`;
  }

  async mutate<T>(scope: SyncScope, entityId: string, fn: () => Promise<T>, timeoutMs = 5000): Promise<T> {
    if (!entityId.trim()) throw new Error("SYNC: entityId required");
    const key = this.key(scope, entityId);
    let lock = this.locks.get(key);
    if (!lock) {
      lock = new RLock();
      this.locks.set(key, lock);
    }
    return lock.runExclusive(fn, timeoutMs);
  }

  /** Análisis en paralelo; la decisión/mutación se serializa por entidad. */
  async analyzeParallel<T, R>(items: readonly T[], worker: (item: T, index: number) => Promise<R>): Promise<readonly R[]> {
    return Promise.all(items.map(worker));
  }

  /** Nunca se deben mantener locks durante red/inferencia/Git remoto. */
  assertNoLocksHeld(): void {
    for (const lock of this.locks.values()) {
      if (lock.isLocked()) throw new Error("SYNC: lock held during external call");
    }
  }
}

/* ------------------------------------------------------------------ */
/* Lifecycle y tokens de manager                                      */
/* ------------------------------------------------------------------ */

export const MANAGER_LIFECYCLE = ["INITIAL", "STARTED", "STOPPING", "SHUTDOWN"] as const;
export type ManagerLifecycleState = (typeof MANAGER_LIFECYCLE)[number];

const LIFECYCLE_TRANSITIONS: Readonly<Record<ManagerLifecycleState, readonly ManagerLifecycleState[]>> = {
  INITIAL: ["STARTED"],
  STARTED: ["STOPPING"],
  STOPPING: ["SHUTDOWN"],
  SHUTDOWN: [],
};

export function allowManagerLifecycleTransition(from: ManagerLifecycleState, to: ManagerLifecycleState): boolean {
  return LIFECYCLE_TRANSITIONS[from].includes(to);
}

export function assertManagerLifecycleTransition(from: ManagerLifecycleState, to: ManagerLifecycleState): void {
  if (!allowManagerLifecycleTransition(from, to)) {
    throw new Error(`SYNC: illegal lifecycle transition ${from} → ${to}`);
  }
}

export interface ManagerToken {
  tokenId: string;
  scope: SyncScope;
  capabilities: readonly string[];
  issuedAt: string;
  expiresAt: string;
  revoked: boolean;
  auditIds: readonly string[];
}

export function issueManagerToken(input: {
  scope: SyncScope;
  capabilities: readonly string[];
  ttlMs?: number;
  at?: string;
}): ManagerToken {
  if (input.capabilities.length === 0) throw new Error("SYNC: token requires capabilities");
  const issuedAt = input.at ?? new Date().toISOString();
  const expiresAt = new Date(new Date(issuedAt).getTime() + (input.ttlMs ?? 3_600_000)).toISOString();
  return Object.freeze({
    tokenId: `tok_${randomUUID()}`,
    scope: Object.freeze({ ...input.scope }),
    capabilities: Object.freeze([...input.capabilities]),
    issuedAt,
    expiresAt,
    revoked: false,
    auditIds: Object.freeze([] as string[]),
  });
}

// Revocation is process-local and volatile; it is not a durable or cross-host token service.
const revokedManagerTokenIds = new Map<string, number>();

export function tokenIsValid(token: ManagerToken, now = new Date()): boolean {
  const nowMs = now.getTime();
  for (const [id, expiresAt] of revokedManagerTokenIds) {
    if (expiresAt <= nowMs) revokedManagerTokenIds.delete(id);
  }
  const expiresAt = new Date(token.expiresAt).getTime();
  return !token.revoked &&
    !revokedManagerTokenIds.has(token.tokenId) &&
    Number.isFinite(expiresAt) &&
    expiresAt > nowMs;
}

export function revokeToken(token: ManagerToken): ManagerToken {
  const expiresAt = new Date(token.expiresAt).getTime();
  revokedManagerTokenIds.set(token.tokenId, Number.isFinite(expiresAt) ? expiresAt : Date.now());
  return Object.freeze({ ...token, revoked: true });
}

/* ------------------------------------------------------------------ */
/* Reconciliación previa a release                                    */
/* ------------------------------------------------------------------ */

export interface ReconciliationState {
  git: string;
  index: string;
  bookpi: string;
}

export interface ReconciliationReport {
  reconciled: boolean;
  divergent: readonly string[];
}

/**
 * Git, índice y BookPI deben reconciliarse antes de release: si sus marcas
 * divergen, no se publica.
 */
export function reconcileBeforeRelease(state: ReconciliationState): ReconciliationReport {
  const divergent: string[] = [];
  for (const key of ["git", "index", "bookpi"] as const) {
    if (typeof state[key] !== "string" || !state[key].trim()) divergent.push(`${key}:missing`);
  }
  if (state.git !== state.index) divergent.push("git≠index");
  if (state.index !== state.bookpi) divergent.push("index≠bookpi");
  if (state.git !== state.bookpi) divergent.push("git≠bookpi");
  return { reconciled: divergent.length === 0, divergent: Object.freeze(divergent) };
}
