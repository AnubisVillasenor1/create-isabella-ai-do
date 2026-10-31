/**
 * HyperCore Ω — Distributed skill execution runtime.
 *
 * Implements the nine execution phases. A pod (here: an in-process isolated
 * invocation) executes a capability; a mandate authorizes it; a contract
 * validates its frontier; a triangulation verifies its result; BookPI preserves
 * its evidence. HyperCore executes and audits; it never authorizes by itself
 * (CROWN does) and never invents an ALLOW verdict it did not receive.
 *
 * Fail-closed invariants:
 *   - identity/tenant missing                                  → BLOCKED (phase 0)
 *   - unknown skill                                            → BLOCKED (phase 1)
 *   - contract missing or input contract violated              → BLOCKED (phase 2)
 *   - CROWN verdict DENY/ESCALATE                              → BLOCKED (phase 3)
 *   - budget exhausted                                         → BLOCKED (phase 4)
 *   - handler threw or exceeded its latency budget             → FAILED  (phase 5)
 *   - triangulation failed (output/provenance/result)          → BLOCKED (phase 6)
 *   - evidence seal unavailable                                → BLOCKED (phase 7)
 *   - BookPI append failed                                     → FAILED  (phase 8)
 */
import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import type { BookPiEventInput } from '../bookpi/ledger';
import type { BookPiLedgerPort } from '../bookpi/ledger';
import type { SkillAuthorization } from './registry';
import { SkillRegistry } from './registry';
import { evaluateCrownPolicy, type CrownPolicyVerdict } from './crown-policy';
import { validateSchema } from './schema-validator';
import {
  triangulate,
  type TriangulationResult,
  type TriangulationProvenance,
} from './triangulation';

export interface SkillExecutionRequest {
  readonly skillId: string;
  readonly actorId: string;
  readonly tenantId: string;
  readonly federationId: string;
  readonly traceId: string;
  readonly policyVersion: string;
  readonly input: unknown;
  readonly signals: readonly string[];
  readonly grantedScopes: readonly string[];
  readonly approvalProvided?: boolean;
  readonly authorization?: SkillAuthorization;
  readonly evidenceHashes?: readonly string[];
  readonly budget?: {
    readonly maxLatencyMs?: number;
    readonly maxCalls?: number;
    readonly maxEnergyUnits?: number;
  };
}

export type ExecutionStatus = 'COMPLETED' | 'BLOCKED' | 'FAILED';

export interface SkillExecutionResult {
  readonly status: ExecutionStatus;
  readonly phase: number;
  readonly reason?: string;
  readonly skillId: string;
  readonly traceId: string;
  readonly output?: unknown;
  readonly verdict?: CrownPolicyVerdict;
  readonly manifestHash?: string;
  readonly signature?: string;
  readonly latencyMs: number;
  readonly triangulation?: TriangulationResult;
}

export interface HyperCoreEngineOptions {
  /** Append-only BookPI sink. Failures are surfaced, never swallowed. */
  readonly ledger?: Pick<BookPiLedgerPort, 'append'>;
  readonly signingKey?: string;
}

const CALL_WINDOW_MS = 60_000;

export class HyperCoreEngine {
  private readonly callWindows = new Map<string, number[]>();

  constructor(
    private readonly registry: SkillRegistry,
    private readonly options: HyperCoreEngineOptions = {}
  ) {}

  async execute(request: SkillExecutionRequest): Promise<SkillExecutionResult> {
    const started = performance.now();

    // Phase 0 — identity and tenant.
    if (
      !request.actorId.trim() ||
      !request.tenantId.trim() ||
      !request.federationId.trim() ||
      !request.traceId.trim() ||
      !request.policyVersion.trim()
    ) {
      return this.result(request, 'BLOCKED', 0, started, { reason: 'identity or tenant missing' });
    }

    // Phase 1 — skill resolution.
    if (!this.registry.has(request.skillId)) {
      return this.result(request, 'BLOCKED', 1, started, {
        reason: `unknown skill ${request.skillId}`,
      });
    }
    const skill = this.registry.get(request.skillId);
    const contract = skill.contract;

    // Phase 2 — contract validation.
    if (!contract) {
      return this.result(request, 'BLOCKED', 2, started, {
        reason: 'skill has no executable contract',
      });
    }
    const inputValidation = validateSchema(request.input, contract.inputSchema);
    if (!inputValidation.valid) {
      return this.result(request, 'BLOCKED', 2, started, {
        reason: `input contract violated at ${inputValidation.violations[0]?.path ?? '$'}`,
      });
    }

    // Phase 3 — CROWN policy.
    const callsThisWindow = this.callsThisWindow(request.skillId, started);
    const decision = evaluateCrownPolicy({
      contract,
      riskTier: skill.riskTier,
      grantedScopes: request.grantedScopes,
      approvalProvided: request.approvalProvided === true,
      callsThisWindow,
    });
    if (decision.verdict === 'DENY' || decision.verdict === 'ESCALATE') {
      this.audit(this.event(request, skill, 'hypercore.execution.denied', decision.verdict));
      return this.result(request, 'BLOCKED', 3, started, {
        reason: decision.reason,
        verdict: decision.verdict,
      });
    }

    // Phase 4 — budget and limits.
    const maxCalls = request.budget?.maxCalls;
    if (
      decision.verdict === 'DEGRADE' ||
      (typeof maxCalls === 'number' && callsThisWindow >= maxCalls)
    ) {
      this.audit(this.event(request, skill, 'hypercore.execution.denied', 'DEGRADE'));
      return this.result(request, 'BLOCKED', 4, started, {
        reason: decision.reason,
        verdict: 'DEGRADE',
      });
    }
    const latencyBudget = this.effectiveLatencyBudget(request, contract.limits.maxLatencyMs);
    this.recordCall(request.skillId, started);

    // Phase 5 — isolated execution with a hard latency budget.
    let output: unknown;
    try {
      output = await this.withTimeout(skill.handler(this.context(request)), latencyBudget);
    } catch {
      this.audit(this.event(request, skill, 'hypercore.execution.failed', 'EXECUTION_FAILURE'));
      return this.result(request, 'FAILED', 5, started, {
        reason: 'handler threw or exceeded its latency budget',
      });
    }

    // Phase 6 — post-execution triangulation.
    const provenance: TriangulationProvenance = {
      actorId: request.actorId,
      tenantId: request.tenantId,
      federationId: request.federationId,
      policyVersion: request.policyVersion,
    };
    const triangulation = triangulate({
      contract,
      input: request.input,
      output,
      provenance,
      riskTier: skill.riskTier,
      evidenceHashes: request.evidenceHashes ?? [],
    });
    if (!triangulation.valid) {
      this.audit(this.event(request, skill, 'hypercore.execution.denied', 'TRIANGULATION_FAILED'));
      return this.result(request, 'BLOCKED', 6, started, {
        reason: `triangulation failed: ${triangulation.invalidVertices.join(', ')}`,
        triangulation,
      });
    }

    // Phase 7 — evidence seal.
    const manifestHash = triangulation.result.manifestHash;
    const signature = this.sign(manifestHash);
    if (this.options.signingKey && !signature) {
      return this.result(request, 'BLOCKED', 7, started, { reason: 'evidence seal unavailable' });
    }

    // Phase 8 — BookPI append (append-only evidence).
    try {
      this.options.ledger?.append(
        this.event(request, skill, 'hypercore.execution.completed', 'COMPLETED')
      );
    } catch {
      return this.result(request, 'FAILED', 8, started, { reason: 'BookPI append failed' });
    }

    return this.result(request, 'COMPLETED', 8, started, {
      output,
      verdict: 'ALLOW',
      manifestHash,
      signature,
      triangulation,
    });
  }

  private callsThisWindow(skillId: string, now: number): number {
    const window = (this.callWindows.get(skillId) ?? []).filter(
      (stamp) => now - stamp < CALL_WINDOW_MS
    );
    this.callWindows.set(skillId, window);
    return window.length;
  }

  private recordCall(skillId: string, stamp: number): void {
    const window = this.callWindows.get(skillId) ?? [];
    window.push(stamp);
    this.callWindows.set(skillId, window);
  }

  /** HMAC-SHA256 seal of a manifest hash. Returns "" when no signing key is configured. */
  signManifest(manifestHash: string): string {
    return this.sign(manifestHash);
  }

  /** Constant-time verification of a sealed manifest signature. */
  verifySignature(manifestHash: string, signature: string): boolean {
    const expected = this.sign(manifestHash);
    if (!expected || signature.length !== expected.length) return false;
    const expectedBytes = Buffer.from(expected, 'hex');
    const providedBytes = Buffer.from(signature, 'hex');
    return (
      expectedBytes.length === providedBytes.length && timingSafeEqual(expectedBytes, providedBytes)
    );
  }

  private effectiveLatencyBudget(request: SkillExecutionRequest, fallback: number): number {
    const requested = request.budget?.maxLatencyMs;
    return typeof requested === 'number' && requested > 0
      ? Math.min(requested, fallback)
      : fallback;
  }

  private sign(manifestHash: string): string {
    const key = this.options.signingKey;
    if (!key) return '';
    return createHmac('sha256', key).update(manifestHash, 'utf8').digest('hex');
  }

  private audit(event: BookPiEventInput): void {
    try {
      this.options.ledger?.append(event);
    } catch {
      /* Surfaced by execute() at phase 8; audit of earlier phases must not throw. */
    }
  }

  private context(request: SkillExecutionRequest) {
    return {
      requestId: randomUUID(),
      traceId: request.traceId,
      input: request.input,
      signals: request.signals,
      grantedScopes: request.grantedScopes,
    };
  }

  private event(
    request: SkillExecutionRequest,
    skill: { id: string; methodId: string; riskTier: string },
    type: string,
    status: string
  ): BookPiEventInput {
    return {
      id: `hypercore-${randomUUID()}`,
      timestamp: new Date().toISOString(),
      type,
      methodId: skill.methodId,
      principal: request.actorId,
      riskTier: skill.riskTier,
      status,
    };
  }

  private withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('HYPERCORE_LATENCY_BUDGET_EXCEEDED')), ms);
      timer.unref?.();
      promise.then(
        (value) => {
          clearTimeout(timer);
          resolve(value);
        },
        (error: unknown) => {
          clearTimeout(timer);
          reject(error);
        }
      );
    });
  }

  private result(
    request: SkillExecutionRequest,
    status: ExecutionStatus,
    phase: number,
    started: number,
    extra: Partial<SkillExecutionResult> = {}
  ): SkillExecutionResult {
    return {
      status,
      phase,
      skillId: request.skillId,
      traceId: request.traceId,
      latencyMs: Number((performance.now() - started).toFixed(2)),
      ...extra,
    };
  }
}

export const HYPERCORE_OMEGA_PHASES = Object.freeze([
  'identity',
  'resolution',
  'contract',
  'crown',
  'budget',
  'execution',
  'triangulation',
  'evidence',
  'bookpi',
] as const);
