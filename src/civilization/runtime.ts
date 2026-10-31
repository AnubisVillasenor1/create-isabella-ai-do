/**
 * ISABELLA Ω · COGNITIVE CIVILIZATION RUNTIME (CCR-1) — Ciclo gobernado.
 *
 * state: draft | engine-generated.
 *
 * Compone el ciclo de 9 pasos del spec CCR-1 (§5) sobre subsistemas REALES de este
 * repositorio. No fabrica motores que no existen: cada paso declara su estado
 * honesto (EXECUTED | PARTIAL | NOT_WIRED) y el resultado transporta simulación y
 * evolución `null`/`NOT_WIRED` cuando la capa correspondiente no está cableada.
 *
 *   Kernel (Ω-0) → Memoria (Ω-1) → Conocimiento (Ω-3) → Razonamiento (Ω-8) →
 *   Política (Ω-6) → Confianza (Ω-7) → Realidad (Ω-2) → Evolución (Ω-11) → Contrato
 *
 * Invariante (AGENTS.md §1): el ciclo CLASIFICA, EXPLICA y EVIDENCIA; NO autoriza
 * y NO ejecuta. `authorityPath` es siempre `FULL`.
 */
import { sha256 } from '../skills/canonical-json';
import { sha3_512Hex } from '../bookpi/crypto';
import { controlSummary } from '../evolution/catalog';
import type { EvolutionControl } from '../core/types';
import type {
  TrafficBand,
  TrafficLightInput,
  TrafficLightVerdict,
} from '../governance/traffic-light';
import type { CompanionSafetyVerdict } from '../companion/safety';
import type { VigiaVerdict } from '../security/vigia';
import type { KnowledgeClaim } from '../memory/ikes';
import { GENESIS_EXPERTS } from '../cognition/experts';
import type { ExpertPlan } from '../cognition/experts';
import type { DecisionExplanation } from '../cognition/explainability';
import type { HardeningResult } from '../sanitization/hardening';
import { layerSummary, type CivilizationLayerStatus } from './layers';
import {
  buildSovereignResponse,
  SOVEREIGN_CONTRACT_VERSION,
  type SovereignDecision,
  type SovereignEvolution,
  type SovereignResponse,
  type SovereignSimulation,
} from './contract';

type ExpertModule = (typeof GENESIS_EXPERTS)[number];

export const CIVILIZATION_METHOD_ID = 'A.TWINS.CCR1.run_cycle.v1.0.0.LOW.AUTONOMOUS' as const;
export const CIVILIZATION_POLICY_VERSION = 'ccr1-policy-draft' as const;

export const CIVILIZATION_DISCLAIMER =
  'El Ciclo de Civilización Ω clasifica, explica, evidencia y propone. NO autoriza, NO ejecuta y NO se declara verdad. Cada paso declara si está EXECUTED, PARTIAL o NOT_WIRED.' as const;

export type CivilizationStepStatus = 'EXECUTED' | 'PARTIAL' | 'NOT_WIRED' | 'ERROR';

export interface CivilizationStep {
  readonly id: string;
  readonly order: number;
  readonly layerId: string;
  readonly name: string;
  readonly status: CivilizationStepStatus;
  readonly detail: string;
}

export interface CivilizationCycleInput {
  readonly input: string;
  readonly principalId?: string;
  readonly federationId?: number;
  readonly territory?: string;
  readonly policyVersion?: string;
  readonly requiresTools?: boolean;
  readonly requiresMemory?: boolean;
}

export interface CivilizationDeps {
  readonly classifyFlow: (input: TrafficLightInput) => TrafficLightVerdict;
  readonly assessCompanionSafety: (input: string) => CompanionSafetyVerdict;
  readonly assessVigia: (input: string) => VigiaVerdict;
  readonly retrieveKnowledge: (query: string) => readonly KnowledgeClaim[];
  readonly planExperts: (ids: readonly ExpertModule[]) => ExpertPlan;
  readonly harden: (content: string) => HardeningResult;
  readonly explainPolicy: (
    decision: SovereignDecision,
    factors: readonly string[],
    evidenceRefs: readonly string[],
    policyVersion: string
  ) => DecisionExplanation;
  readonly evolutionControls: () => {
    readonly controls: readonly EvolutionControl[];
    readonly mode: string;
  };
  readonly publish: (input: { topic: string; type: string; payload: unknown }) => void;
}

export interface CivilizationCycleResult {
  readonly version: typeof SOVEREIGN_CONTRACT_VERSION;
  readonly requestId: string;
  readonly principalId: string;
  readonly at: string;
  readonly methodId: typeof CIVILIZATION_METHOD_ID;
  readonly band: TrafficBand;
  readonly route: string;
  readonly riskTier: string;
  /** Clasificación sin bloqueo (no es una autorización; ver `authorizationPerformed`). */
  readonly admitted: boolean;
  readonly response: SovereignResponse;
  readonly steps: readonly CivilizationStep[];
  readonly layerSummary: Record<CivilizationLayerStatus, number>;
  readonly authorityPath: 'FULL';
  readonly authorizationPerformed: false;
  readonly executionPerformed: false;
  readonly digest: string;
  readonly disclaimer: typeof CIVILIZATION_DISCLAIMER;
}

const BASE_CONFIDENCE: Record<TrafficBand, number> = {
  GREEN: 0.85,
  YELLOW: 0.7,
  ORANGE: 0.5,
  RED: 0.3,
};

const CORE_EXPERTS: readonly ExpertModule[] = [
  'E00_IDENTITY',
  'E03_GOVERNANCE',
  'E11_VERITAS',
  'E16_TRANSPARENCY',
  'E21_SYNTHESIS',
];
const GUARD_EXPERTS: readonly ExpertModule[] = [
  'E01_SECURITY',
  'E13_PRIVACY',
  'E14_COGNITIVE_SAFETY',
];

function step(
  id: string,
  order: number,
  layerId: string,
  name: string,
  status: CivilizationStepStatus,
  detail: string
): CivilizationStep {
  return Object.freeze({ id, order, layerId, name, status, detail });
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function decideFor(band: TrafficBand, blocked: boolean): SovereignDecision {
  if (blocked) return 'DENY';
  if (band === 'ORANGE' || band === 'RED') return 'REVIEW';
  return 'ALLOW';
}

/**
 * Ejecuta el ciclo de civilización Ω una sola vez. Determinista salvo por la marca
 * temporal y el `requestId` derivado de ella. Fail-closed: una entrada vacía se
 * rechaza; los pasos que fallan se registran como `ERROR` sin inventar resultados.
 */
export function runCivilizationCycle(
  deps: CivilizationDeps,
  rawInput: CivilizationCycleInput
): CivilizationCycleResult {
  const input = typeof rawInput?.input === 'string' ? rawInput.input.trim() : '';
  if (!input) throw new Error('CIVILIZATION_INPUT_REQUIRED');

  const principalId = rawInput.principalId?.trim() || 'human:anonymous';
  const policyVersion = rawInput.policyVersion?.trim() || CIVILIZATION_POLICY_VERSION;
  const at = new Date().toISOString();
  const requestId = `ccr1-${sha256({ input, principalId, at }).slice(0, 16)}`;
  const steps: CivilizationStep[] = [];

  // 1. Sovereign Kernel (Ω-0)
  const triage = deps.classifyFlow({
    input,
    principalId,
    ...(rawInput.federationId !== undefined ? { federationId: rawInput.federationId } : {}),
    ...(rawInput.territory ? { territory: rawInput.territory } : {}),
    requiresTools: rawInput.requiresTools === true,
    requiresMemory: rawInput.requiresMemory === true,
  });
  const companion = deps.assessCompanionSafety(input);
  const vigia = deps.assessVigia(input);
  steps.push(
    step(
      'sovereign-kernel',
      1,
      'Ω-0',
      'Sovereign Kernel',
      'EXECUTED',
      `banda ${triage.band}; companion=${companion.action}; vigia=${vigia.decision}`
    )
  );

  // 2. Cognitive Memory Mesh (Ω-1)
  let claims: readonly KnowledgeClaim[] = [];
  try {
    claims = deps.retrieveKnowledge(input);
    steps.push(
      step(
        'memory-mesh',
        2,
        'Ω-1',
        'Cognitive Memory Mesh',
        'EXECUTED',
        `${claims.length} reclamos recuperados`
      )
    );
  } catch (err) {
    steps.push(
      step(
        'memory-mesh',
        2,
        'Ω-1',
        'Cognitive Memory Mesh',
        'ERROR',
        err instanceof Error ? err.message : String(err)
      )
    );
  }

  // 3. Knowledge Fabric (Ω-3)
  const domains = Array.from(new Set(claims.map((c) => c.subject).filter((s) => s.trim()))).slice(
    0,
    8
  );
  steps.push(
    step(
      'knowledge-fabric',
      3,
      'Ω-3',
      'Planetary Knowledge Graph',
      'PARTIAL',
      `${domains.length} dominios derivados de claims; expansión de grafo NO cableada`
    )
  );

  // 4. Reasoning Mesh (Ω-8)
  const experts =
    triage.band === 'ORANGE' || triage.band === 'RED'
      ? [...CORE_EXPERTS, ...GUARD_EXPERTS]
      : [...CORE_EXPERTS];
  let expertPlan: ExpertPlan | null = null;
  try {
    expertPlan = deps.planExperts(experts);
    steps.push(
      step(
        'reasoning-mesh',
        4,
        'Ω-8',
        'Multi-Agent Federated Intelligence',
        'EXECUTED',
        `${expertPlan.selected.length} expertos planificados; ejecución vLLM SPECIFIED`
      )
    );
  } catch (err) {
    steps.push(
      step(
        'reasoning-mesh',
        4,
        'Ω-8',
        'Multi-Agent Federated Intelligence',
        'ERROR',
        err instanceof Error ? err.message : String(err)
      )
    );
  }

  // 5. Policy Engine (Ω-6)
  const blocked = companion.action === 'BLOCK' || vigia.decision === 'BLOCK';
  const decision = decideFor(triage.band, blocked);
  const factors = [
    `band:${triage.band}`,
    `risk:${triage.riskTier}`,
    `category:${triage.category}`,
    `companion:${companion.action}`,
    `vigia:${vigia.decision}`,
  ];
  const evidenceRefs = [`integrity:${sha3_512Hex(input).slice(0, 24)}`];
  const explanation = deps.explainPolicy(decision, factors, evidenceRefs, policyVersion);
  steps.push(
    step(
      'policy-engine',
      5,
      'Ω-6',
      'Civilization Policy Compiler',
      'PARTIAL',
      `decisión ${decision}; CROWN/permisos reales; compilador Rego NO cableado`
    )
  );

  // 6. Trust Engine (Ω-7)
  const hardening = deps.harden(input);
  const integrity = sha3_512Hex(input);
  const evidence = [
    `companion:${companion.action}`,
    `vigia:${vigia.decision}`,
    `policy:${explanation.decision}`,
    `integrity-sha3-512:${integrity.slice(0, 32)}`,
    `harden:findings=${hardening.findings.length}`,
    ...(hardening.quarantineRequired ? ['quarantine:required'] : []),
    ...claims.slice(0, 8).map((claim) => `claim:${claim.claimId}`),
  ];
  steps.push(
    step(
      'trust-engine',
      6,
      'Ω-7',
      'Trust Fabric',
      'EXECUTED',
      `SHA3-512 + ${hardening.findings.length} hallazgos de endurecimiento`
    )
  );

  // 7. Reality Engine (Ω-2)
  const simulation: SovereignSimulation | null = null;
  steps.push(
    step(
      'reality-engine',
      7,
      'Ω-2',
      'Reality Digital Twin',
      'NOT_WIRED',
      'motor de simulación/forecast no cableado'
    )
  );

  // 8. Evolution Engine (Ω-11)
  let evolution: SovereignEvolution | null = null;
  try {
    const fabric = deps.evolutionControls();
    const delta = controlSummary(fabric.controls);
    evolution = Object.freeze({
      mode: fabric.mode,
      controls: fabric.controls.length,
      delta: Object.freeze(delta),
      humanApprovalRequired: true as const,
    });
    steps.push(
      step(
        'evolution-engine',
        8,
        'Ω-11',
        'Self-Evolution Engine',
        'EXECUTED',
        `${fabric.controls.length} controles auditados; promoción a wired exige humano`
      )
    );
  } catch (err) {
    steps.push(
      step(
        'evolution-engine',
        8,
        'Ω-11',
        'Self-Evolution Engine',
        'ERROR',
        err instanceof Error ? err.message : String(err)
      )
    );
  }

  // 9. Response Contract
  let confidence = BASE_CONFIDENCE[triage.band];
  if (claims.length > 0) confidence += 0.05;
  if (hardening.quarantineRequired) confidence -= 0.1;
  if (vigia.decision === 'BLOCK') confidence -= 0.15;
  confidence = round2(clamp(confidence, 0.05, 0.95));

  const answer =
    `Ciclo de Civilización Ω: banda ${triage.band} (${triage.label}); ${claims.length} reclamos recuperados; ` +
    `decisión ${decision}; ${steps.length} pasos ejecutados. NO autoriza ni ejecuta.`;

  const response = buildSovereignResponse({
    answer,
    confidence,
    reasoningPath: steps.map((s) => `${s.id}:${s.status}`),
    usedKnowledgeDomains: domains.length ? domains : ['sin-dominios-recuperados'],
    evidence,
    simulation,
    evolution,
    policy: { decision, band: triage.band, policyVersion, authorityPath: 'FULL' },
  });

  steps.push(
    step(
      'response-contract',
      9,
      'Ω-0',
      'Sovereign Response Contract',
      'EXECUTED',
      `bookpiHash ${response.bookpiHash.slice(0, 16)}…`
    )
  );

  const digest = sha256({
    requestId,
    band: triage.band,
    decision,
    steps: steps.map((s) => `${s.id}:${s.status}`),
    bookpiHash: response.bookpiHash,
  });

  const result: CivilizationCycleResult = Object.freeze({
    version: SOVEREIGN_CONTRACT_VERSION,
    requestId,
    principalId,
    at,
    methodId: CIVILIZATION_METHOD_ID,
    band: triage.band,
    route: triage.route,
    riskTier: triage.riskTier,
    admitted: decision !== 'DENY',
    response,
    steps: Object.freeze(steps),
    layerSummary: layerSummary(),
    authorityPath: 'FULL',
    authorizationPerformed: false,
    executionPerformed: false,
    digest,
    disclaimer: CIVILIZATION_DISCLAIMER,
  });

  try {
    deps.publish({
      topic: 'civilization.cycle.completed',
      type: triage.band,
      payload: {
        requestId,
        band: triage.band,
        decision,
        admitted: result.admitted,
        digest,
        bookpiHash: response.bookpiHash,
      },
    });
  } catch {
    /* el bus en proceso es best-effort; el ciclo ya quedó evidenciado en el contrato. */
  }

  return result;
}
