/**
 * REGALO 7 — DISYUNTOR DE PROVEEDORES (Provider Circuit Breaker).
 *
 * state: draft | engine-generated.
 *
 * Problema que resuelve: un proveedor de inferencia lento o caído no debe
 * arrastrar toda la respuesta. Este cortacircuitos por proveedor (CLOSED/OPEN/
 * HALF_OPEN) hace "fallar rápido" y ordena a los proveedores sanos al frente.
 *
 * Invariante (AGENTS.md): es una política de transporte; no concede autoridad ni
 * ejecuta llamadas. El reloj es inyectable para determinismo en tests.
 */
import { digest } from './util';

export const PROVIDER_BREAKER_VERSION = '1.0.0' as const;
export const PROVIDER_BREAKER_METHOD_ID =
  'A.TWINS.LEGACY.provider_breaker.observe.v1.0.0.LOW.AUTONOMOUS' as const;
export const PROVIDER_BREAKER_DISCLAIMER =
  'El disyuntor de proveedores es una política de resiliencia; no concede autoridad ni ejecuta llamadas.';

export type BreakerState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export interface ProviderBreakerOptions {
  readonly failureThreshold?: number;
  readonly openMs?: number;
  readonly halfOpenSuccesses?: number;
  readonly now?: () => number;
}

export interface ProviderState {
  readonly provider: string;
  readonly state: BreakerState;
  readonly failures: number;
  readonly consecutiveFailures: number;
  readonly halfOpenSuccesses: number;
  readonly openedAt: number | null;
}

interface InternalState {
  failures: number;
  consecutiveFailures: number;
  halfOpenSuccesses: number;
  openedAt: number | null;
  state: BreakerState;
}

const DEFAULT_FAILURE_THRESHOLD = 3;
const DEFAULT_OPEN_MS = 30_000;
const DEFAULT_HALF_OPEN_SUCCESSES = 1;

export class ProviderBreaker {
  private readonly failureThreshold: number;
  private readonly openMs: number;
  private readonly halfOpenSuccesses: number;
  private readonly now: () => number;
  private readonly providers = new Map<string, InternalState>();

  constructor(options: ProviderBreakerOptions = {}) {
    this.failureThreshold = options.failureThreshold ?? DEFAULT_FAILURE_THRESHOLD;
    this.openMs = options.openMs ?? DEFAULT_OPEN_MS;
    this.halfOpenSuccesses = options.halfOpenSuccesses ?? DEFAULT_HALF_OPEN_SUCCESSES;
    this.now = options.now ?? (() => Date.now());
  }

  private entry(provider: string): InternalState {
    const existing = this.providers.get(provider);
    if (existing) return existing;
    const fresh: InternalState = {
      failures: 0,
      consecutiveFailures: 0,
      halfOpenSuccesses: 0,
      openedAt: null,
      state: 'CLOSED',
    };
    this.providers.set(provider, fresh);
    return fresh;
  }

  /** Resuelve transiciones temporales (OPEN → HALF_OPEN) de forma determinista. */
  private resolve(provider: string): InternalState {
    const state = this.entry(provider);
    if (
      state.state === 'OPEN' &&
      state.openedAt !== null &&
      this.now() - state.openedAt >= this.openMs
    ) {
      state.state = 'HALF_OPEN';
      state.halfOpenSuccesses = 0;
    }
    return state;
  }

  allow(provider: string): boolean {
    const state = this.resolve(provider);
    return state.state !== 'OPEN';
  }

  recordSuccess(provider: string): ProviderState {
    const state = this.resolve(provider);
    state.consecutiveFailures = 0;
    if (state.state === 'HALF_OPEN') {
      state.halfOpenSuccesses += 1;
      if (state.halfOpenSuccesses >= this.halfOpenSuccesses) {
        state.state = 'CLOSED';
        state.openedAt = null;
        state.halfOpenSuccesses = 0;
      }
    }
    return this.stateOf(provider);
  }

  recordFailure(provider: string): ProviderState {
    const state = this.resolve(provider);
    state.failures += 1;
    state.consecutiveFailures += 1;
    if (state.state === 'HALF_OPEN' || state.consecutiveFailures >= this.failureThreshold) {
      state.state = 'OPEN';
      state.openedAt = this.now();
      state.halfOpenSuccesses = 0;
    }
    return this.stateOf(provider);
  }

  stateOf(provider: string): ProviderState {
    const state = this.resolve(provider);
    return {
      provider,
      state: state.state,
      failures: state.failures,
      consecutiveFailures: state.consecutiveFailures,
      halfOpenSuccesses: state.halfOpenSuccesses,
      openedAt: state.openedAt,
    };
  }

  /** Devuelve solo los proveedores admitidos, preservando el orden pedido. */
  available(providers: readonly string[]): readonly string[] {
    return providers.filter((provider) => this.allow(provider));
  }

  /** Ordena proveedores: sanos primero (orden estable); los OPEN van al final. */
  orderForRouting(providers: readonly string[]): readonly string[] {
    const healthy: string[] = [];
    const blocked: string[] = [];
    for (const provider of providers) {
      (this.allow(provider) ? healthy : blocked).push(provider);
    }
    return Object.freeze([...healthy, ...blocked]);
  }

  snapshot(): readonly ProviderState[] {
    return Object.freeze([...this.providers.keys()].map((provider) => this.stateOf(provider)));
  }

  digestOf(): string {
    return digest(this.snapshot());
  }
}
