// state: draft | engine-generated — Evidencia computacional de la capa Ω∞ GENESIS.
// Un test verde demuestra capacidad computacional, NO autoridad ni producción (AGENTS.md §1).
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  GENESIS_LAYERS,
  isGenesisLayer,
  layerIndex,
  resolveLayerPath,
  macroDomainsForPath,
} from '../../src/omega/genesis/layers';
import { AdaptiveSemanticFastlane, tokenize } from '../../src/omega/genesis/fastlane-v2';
import {
  planCognitiveBudget,
  budgetTotal,
  normalizeToHundred,
  COGNITIVE_DIMENSIONS,
} from '../../src/omega/genesis/meta-orchestrator';
import { MicroAgentSociety, didForRole } from '../../src/omega/genesis/agent-society';
import { FractalExecutiveMemory, levelForHorizon, FEM_REGISTRY } from '../../src/omega/genesis/fem';
import { KnowledgeMesh } from '../../src/omega/genesis/knowledge-mesh';
import { runHybridReasoning } from '../../src/omega/genesis/hybrid-reasoning';
import { evaluateZeroTrust } from '../../src/omega/genesis/zero-trust';
import { runControlledEvolution } from '../../src/omega/genesis/controlled-evolution';
import { buildCognitiveTwin } from '../../src/omega/genesis/cognitive-twin';
import { CognitiveObservability } from '../../src/omega/genesis/observability';
import {
  GovernedToolRegistry,
  totalQuota,
  TOOL_TAXONOMY_TOTAL,
} from '../../src/omega/genesis/tool-expansion';
import { SkillEventBus, SKILL_CHANNELS } from '../../src/omega/genesis/event-bus';
import {
  checkGenesisContract,
  checkOpenApiDrift,
  checkAsyncApiDrift,
  deriveSkillContract,
  operationIdFor,
  GENESIS_SKILL_SLUGS,
} from '../../src/omega/genesis/spec-contract';
import { runGenesisTurn } from '../../src/omega/genesis/convergence';
import { InMemoryBookPiLedger } from '../../src/bookpi/ledger';

const FIXED_CLOCK = () => '2026-01-01T00:00:00.000Z';
const ALL_TRUST = {
  identityVerified: true,
  authorityGranted: true,
  contextValid: true,
  policyCompliant: true,
  evidencePresent: true,
};

describe('genesis/layers', () => {
  it('expone 12 capas con orden ascendente y guard de orden', () => {
    expect(GENESIS_LAYERS).toHaveLength(12);
    expect(isGenesisLayer('L7')).toBe(true);
    expect(isGenesisLayer('L12')).toBe(false);
    expect(layerIndex('L11')).toBe(11);
    expect(resolveLayerPath('L2', 'L4')).toEqual(['L2', 'L3', 'L4']);
    expect(() => resolveLayerPath('L5', 'L2')).toThrow('GENESIS_LAYER_ORDER_INVALID');
    expect(macroDomainsForPath(['L11']).length).toBeGreaterThan(0);
  });
});

describe('genesis/fastlane-v2', () => {
  it('tokeniza removiendo stopwords y normalizando', () => {
    const tokens = tokenize('el estado de la plataforma');
    expect(tokens).not.toContain('el');
    expect(tokens).toContain('estado');
  });

  it('usa una regla aprendida determinista cuando el regex no resuelve', () => {
    const lane = new AdaptiveSemanticFastlane();
    lane.addLearnedRule(/xyzzy/i, 'knowledge');
    const result = lane.evaluate('por favor activa xyzzy ahora');
    expect(result.isFastLane).toBe(true);
    expect(['learned_rule', 'regex', 'semantic_cache']).toContain(result.source);
  });

  it('fuera de toda ruta determinista difiere a la ruta gobernada', () => {
    const lane = new AdaptiveSemanticFastlane();
    const result = lane.evaluate('');
    expect(result.isFastLane).toBe(false);
    expect(result.reason).toContain('governed');
  });
});

describe('genesis/meta-orchestrator', () => {
  it('el presupuesto siempre suma exactamente 100', () => {
    for (const goal of ['scientific_policy', 'legal_review', 'creative_writing'] as const) {
      const plan = planCognitiveBudget(goal, { highStakes: true });
      expect(budgetTotal(plan.budget)).toBe(100);
    }
    expect(normalizeToHundred([1, 1, 1]).reduce((a, b) => a + b, 0)).toBe(100);
    expect(COGNITIVE_DIMENSIONS).toHaveLength(6);
  });
});

describe('genesis/agent-society', () => {
  it('registra, refuerza y selecciona por confianza acotada', () => {
    const society = new MicroAgentSociety();
    expect(society.size()).toBe(18);
    const did = didForRole('planner');
    const before = society.list().find((a) => a.did === did);
    expect(before?.trustScore).toBe(0.5);
    const after = society.recordOutcome(did, true, 0.1);
    expect(after.trustScore).toBeCloseTo(0.6, 5);
    const selection = society.selectByTrust(undefined, 3);
    expect(selection.agents).toHaveLength(3);
    expect(selection.weights.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 5);
  });
});

describe('genesis/fem', () => {
  it('enruta horizontes a niveles y escribe en el nivel correcto', () => {
    expect(levelForHorizon(0)).toBe(1);
    expect(levelForHorizon(FEM_REGISTRY[6].minHorizonMs)).toBe(6);
    const fem = new FractalExecutiveMemory(FIXED_CLOCK);
    const { level } = fem.write('m-1', 'hola', 3_600_000);
    expect(level).toBe(3);
    expect(fem.stats()[3]).toBe(1);
  });
});

describe('genesis/knowledge-mesh', () => {
  it('construye un grafo, recorre y detecta huecos', () => {
    const mesh = new KnowledgeMesh();
    mesh.addNode({ id: 'a', type: 'document', label: 'A' });
    mesh.addNode({ id: 'b', type: 'person', label: 'B' });
    mesh.addNode({ id: 'iso', type: 'entity', label: 'Iso' });
    mesh.addEdge({ from: 'a', to: 'b', relation: 'authored_by', strength: 0.8 });
    expect(mesh.traverse('a', 1).reached).toContain('b');
    expect(mesh.relationStrength('a', 'b')).toBeCloseTo(0.8, 5);
    expect(mesh.detectGaps().map((g) => g.nodeId)).toContain('iso');
    expect(() => mesh.addEdge({ from: 'a', to: 'zz', relation: 'references', strength: 1 })).toThrow(
      'MESH_EDGE_UNKNOWN_NODE'
    );
  });
});

describe('genesis/hybrid-reasoning', () => {
  it('SUPPORTED con evidencia suficiente y política', () => {
    const verdict = runHybridReasoning({
      question: '¿X es Y?',
      claims: [{ claimId: 'c1', text: 'X es Y', sourceIds: ['s1'] }],
      knownSourceIds: ['s1'],
      policyRef: 'omega.zero_trust',
    });
    expect(verdict.verdict).toBe('SUPPORTED');
    expect(verdict.confidence).toBeGreaterThan(0.5);
  });

  it('FAIL-CLOSED: sin respaldo conocido queda INSUFFICIENT', () => {
    const verdict = runHybridReasoning({
      question: '¿X es Y?',
      claims: [{ claimId: 'c1', text: 'X es Y', sourceIds: ['desconocida'] }],
      knownSourceIds: [],
      policyRef: 'omega.zero_trust',
    });
    expect(verdict.verdict).toBe('INSUFFICIENT');
    expect(verdict.confidence).toBeLessThanOrEqual(0.49);
  });
});

describe('genesis/zero-trust', () => {
  it('ALLOW solo si los cinco factores valen 1', () => {
    expect(evaluateZeroTrust(ALL_TRUST, FIXED_CLOCK).allowed).toBe(true);
    const denied = evaluateZeroTrust({ ...ALL_TRUST, evidencePresent: false }, FIXED_CLOCK);
    expect(denied.allowed).toBe(false);
    expect(denied.failedFactors).toContain('evidence');
  });
});

describe('genesis/controlled-evolution', () => {
  it('rechaza self-modification y no aplica sin autorización humana', () => {
    expect(
      runControlledEvolution({
        id: 'p1',
        description: 'cambio',
        kind: 'self-modification',
        reversible: true,
      }).applied
    ).toBe(false);
    expect(
      runControlledEvolution({ id: 'p2', description: 'x', kind: 'self-improvement', reversible: false })
        .applied
    ).toBe(false);
    const applied = runControlledEvolution({
      id: 'p3',
      description: 'mejora reversible',
      kind: 'self-improvement',
      reversible: true,
      humanAuthorizer: 'Humano A',
      approvalRef: 'approval-1',
    });
    expect(applied.applied).toBe(true);
  });
});

describe('genesis/cognitive-twin', () => {
  it('clasifica salud y produce huella determinista', () => {
    const healthy = buildCognitiveTwin(
      {
        availabilityRatio: 1,
        errorRate: 0,
        queueDepthRatio: 0,
        memoryUsageRatio: 0,
        trustMean: 1,
        policyCompliance: 1,
        evidenceChainValid: true,
      },
      FIXED_CLOCK
    );
    expect(healthy.health).toBe('HEALTHY');
    expect(healthy.fingerprint).toMatch(/^[0-9a-f]{64}$/);
    const critical = buildCognitiveTwin(
      {
        availabilityRatio: 0.5,
        errorRate: 0.9,
        queueDepthRatio: 0.9,
        memoryUsageRatio: 0.9,
        trustMean: 0.1,
        policyCompliance: 0.1,
        evidenceChainValid: false,
      },
      FIXED_CLOCK
    );
    expect(critical.health).toBe('CRITICAL');
  });
});

describe('genesis/observability', () => {
  it('agrega métricas cognitivas sobre observaciones', () => {
    const obs = new CognitiveObservability();
    obs.record({
      traceId: 't1',
      hallucinated: false,
      reasoningVerified: true,
      toolLatencyMs: 10,
      policyCompliant: true,
      risk: 'low',
      memoryConsistent: true,
    });
    obs.record({
      traceId: 't2',
      hallucinated: true,
      reasoningVerified: false,
      toolLatencyMs: 30,
      policyCompliant: false,
      risk: 'high',
      memoryConsistent: false,
    });
    const metrics = obs.compute();
    expect(metrics.turns).toBe(2);
    expect(metrics.hallucinationScore).toBeCloseTo(0.5, 5);
    expect(metrics.p95ToolLatencyMs).toBe(30);
    expect(obs.size()).toBe(2);
  });
});

describe('genesis/tool-expansion', () => {
  it('la taxonomía totaliza 250 y acota por dominio y riesgo', () => {
    expect(totalQuota()).toBe(TOOL_TAXONOMY_TOTAL);
    const reg = new GovernedToolRegistry();
    reg.add({ id: 't1', domain: 'investigacion', name: 'Buscar', risk: 'LOW' });
    expect(() => reg.add({ id: 't2', domain: 'desconocido', name: 'X', risk: 'LOW' })).toThrow(
      'TOOL_DOMAIN_UNKNOWN'
    );
    expect(() => reg.add({ id: 't3', domain: 'seguridad', name: 'P', risk: 'LOW' })).toThrow(
      'TOOL_RISK_BELOW_DOMAIN_FLOOR'
    );
    expect(reg.selectForDomain('investigacion', 5).length).toBe(1);
  });
});

describe('genesis/event-bus', () => {
  it('publica y entrega a suscriptores de un canal', () => {
    const bus = new SkillEventBus();
    const seen: string[] = [];
    bus.subscribe('isabella.orion.provenance', (e) => seen.push(e.eventId));
    const published = bus.publish({
      channel: 'isabella.orion.provenance',
      type: 'evaluated',
      traceId: 'trace-1',
      skillId: 'orion_provenance_orientation',
      payload: { ok: true },
      emittedAt: FIXED_CLOCK(),
    });
    expect(published.eventId).toMatch(/^[0-9a-f]{64}$/);
    expect(seen).toHaveLength(1);
    expect(bus.publishedCount()).toBe(1);
    expect(() => bus.publish({ ...published, channel: 'no.such' as never })).toThrow(
      'EVENT_BUS_UNKNOWN_CHANNEL'
    );
  });
});

describe('genesis/spec-contract', () => {
  it('el contrato derivado está libre de deriva interna', () => {
    const { specs } = deriveSkillContract();
    expect(specs).toHaveLength(GENESIS_SKILL_SLUGS.length);
    expect(checkGenesisContract().ok).toBe(true);
  });

  it('el OpenAPI publicado coincide con los operationIds canónicos', () => {
    const yaml = readFileSync(
      fileURLToPath(new URL('../../openapi/isabella_genesis_openapi.yaml', import.meta.url)),
      'utf8'
    );
    const ops = [...yaml.matchAll(/operationId:\s*([A-Za-z0-9_]+)/g)].map((m) => m[1] as string);
    expect(checkOpenApiDrift(ops).ok).toBe(true);
    expect(ops).toContain(operationIdFor('orion'));
  });

  it('el AsyncAPI publicado coincide con los canales canónicos', () => {
    const yaml = readFileSync(
      fileURLToPath(new URL('../../asyncapi/isabella_genesis_asyncapi.yaml', import.meta.url)),
      'utf8'
    );
    const channels = [...new Set(yaml.match(/isabella\.[a-z]+\.[a-z]+/g) ?? [])];
    expect(checkAsyncApiDrift(channels).ok).toBe(true);
    expect(channels.sort()).toEqual([...SKILL_CHANNELS].sort());
  });
});

describe('genesis/convergence', () => {
  it('un turno admitido recorre la pila y sella evidencia con ledger', () => {
    const ledger = new InMemoryBookPiLedger();
    const turn = runGenesisTurn(
      {
        traceId: 'turn-1',
        actorDid: 'did:isabella:operator:1',
        input: '¿X es Y?',
        goal: 'scientific_policy',
        zeroTrust: ALL_TRUST,
        claims: [{ claimId: 'c1', text: 'X es Y', sourceIds: ['s1'] }],
        knownSourceIds: ['s1'],
        policyRef: 'omega.zero_trust',
      },
      { ledger, clock: FIXED_CLOCK }
    );
    expect(turn.status).toBe('ALLOWED');
    expect(turn.reasoning?.verdict).toBe('SUPPORTED');
    expect(turn.memoryLevel).not.toBeNull();
    expect(turn.sealed).toBe(true);
    expect(turn.evidenceAnchor?.merkleRoot).toMatch(/^[0-9a-f]{64}$/);
    expect(turn.plan.budget && budgetTotal(turn.plan.budget)).toBe(100);
  });

  it('un turno denegado por Zero-Trust no sintetiza ni deja huella de memoria', () => {
    const turn = runGenesisTurn(
      {
        traceId: 'turn-2',
        actorDid: 'did:isabella:operator:1',
        input: 'cualquier cosa',
        goal: 'general_inquiry',
        zeroTrust: { ...ALL_TRUST, authorityGranted: false },
      },
      { clock: FIXED_CLOCK }
    );
    expect(turn.status).toBe('DENIED');
    expect(turn.reasoning).toBeNull();
    expect(turn.memoryLevel).toBeNull();
    expect(turn.sealed).toBe(false);
  });
});
