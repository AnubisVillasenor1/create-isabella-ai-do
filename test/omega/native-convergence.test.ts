// state: draft | engine-generated — Evidencia computacional de la convergencia nativa Ω∞.
// Un test verde demuestra capacidad computacional, NO autoridad ni producción (AGENTS.md §1).
import { describe, expect, it } from 'vitest';
import { InMemoryBookPiLedger } from '../../src/bookpi/ledger';
import { createCapabilityGate } from '../../src/crown/capability';
import { createPrincipal } from '../../src/identity/principal';
import {
  NATIVE_CAPABILITY_DESCRIPTORS,
  runNativeConvergence,
  type NativeConvergenceDeps,
  type NativeOperationRequest,
} from '../../src/omega/native';

const FIXED_CLOCK = () => '2026-01-01T00:00:00.000Z';

function makeDeps(): NativeConvergenceDeps {
  return {
    ledger: new InMemoryBookPiLedger(),
    capabilityGate: createCapabilityGate(NATIVE_CAPABILITY_DESCRIPTORS),
    clock: FIXED_CLOCK,
  };
}

function makeRequest(overrides: Partial<NativeOperationRequest> = {}): NativeOperationRequest {
  const principal = createPrincipal({ id: 'did:isabella:operator:1', kind: 'human', roles: ['operator'] });
  return {
    requestId: 'req-0001',
    principal,
    actorDid: 'did:isabella:operator:1',
    mandate: 'mandate: native-convergence-demo',
    policyVersion: 'policy-v1',
    humanOverrideAvailable: true,
    territory: 'MX',
    explanation: 'Demostración de convergencia nativa entre macrodominios.',
    recoveryPlan: 'rollback: no-op (sin efectos externos)',
    learningRecord: 'learning: primer sello nativo',
    economicJustification: 'Sin impacto económico en esta operación.',
    intent: {
      semanticIntent: 'Explicar la gobernanza de Isabella',
      culturalContext: 'gobierno comunidad territorio soberanía',
      emotionVector: { confianza: 0.8, cercanía: 0.4 },
      prosody: { f0_curve: [110, 112, 108], pauses_ms: [120, 80], breathing_points: [240] },
      targetVoiceDna: 'acoustic-dna:isabella:omega-mx',
    },
    ...overrides,
  };
}

describe('Ω∞ native convergence (legitimacy equation + fail-closed + BookPI evidence)', () => {
  it('ALLOW: una operación legítima completa recorre los macrodominios y sella evidencia', () => {
    const deps = makeDeps();
    const result = runNativeConvergence(deps, makeRequest());

    expect(result.status).toBe('ALLOW');
    expect(result.executionPerformed).toBe(true);
    expect(result.externalSideEffects).toBe('NONE');
    expect(result.legitimacy.product).toBe(1);
    expect(result.legitimacy.allowed).toBe(true);
    expect(result.legitimacy.missingFactors).toHaveLength(0);
    expect(result.legitimacy.constitution.allowed).toBe(true);
    expect(result.evidence.valid).toBe(true);
    expect(result.evidence.chainHead).not.toBeNull();

    const domains = result.hops.map((h) => h.domain);
    for (const required of ['GOVERNANCE', 'KNOWLEDGE', 'CORE', 'EXPERIENCE'] as const) {
      expect(domains).toContain(required);
    }
    // intent + decision + 4 hops como mínimo, todos encadenados y verificables.
    expect(result.evidence.events).toBeGreaterThanOrEqual(6);
  });

  it('DENY: si falta un factor de la ecuación (supervisión humana), se niega y aun así sella', () => {
    const deps = makeDeps();
    const result = runNativeConvergence(deps, makeRequest({ humanOverrideAvailable: false }));

    expect(result.status).toBe('DENY');
    expect(result.legitimacy.product).toBe(0);
    expect(result.legitimacy.missingFactors).toContain('humanOversight');
    expect(result.executionPerformed).toBe(false);
    // "Evidence before authority": la decisión negativa también queda registrada.
    expect(result.evidence.valid).toBe(true);
    expect(result.evidence.chainHead).not.toBeNull();
  });

  it('DENY: una liquidación económica sin aprobación humana no la ejecuta la máquina', () => {
    const deps = makeDeps();
    const result = runNativeConvergence(
      deps,
      makeRequest({ economic: { transactionId: 'txn-1', operation: 'settle', trustScore: 0.6, riskScore: 0.3 } })
    );

    const economyHop = result.hops.find((h) => h.domain === 'ECONOMY');
    expect(economyHop).toBeDefined();
    expect(economyHop?.status).toBe('DENY');
    expect(economyHop?.detail.crown_decision).toBe('DENY');
    expect(economyHop?.detail.money_moved).toBe(false);
    expect(result.legitimacy.missingFactors).toContain('governance');
    expect(result.status).toBe('DENY');
  });

  it('BLOCKED_ENVIRONMENT: la capa post-cuántica no fabrica firma; se marca bloqueada', () => {
    const deps = makeDeps();
    const result = runNativeConvergence(
      deps,
      makeRequest({ crypto: { operation: 'sign', payload: new Uint8Array([1, 2, 3, 4]) } })
    );

    const qsfHop = result.hops.find((h) => h.domain === 'IMMUNITY');
    expect(qsfHop).toBeDefined();
    expect(qsfHop?.status).toBe('BLOCKED_ENVIRONMENT');
    expect(qsfHop?.detail.pqc_provider).toContain('BLOCKED_ENVIRONMENT');
    expect(qsfHop?.detail.signature_present).toBe(false);
    expect(result.legitimacy.missingFactors).toContain('execution');
    expect(result.status).toBe('DENY');
  });

  it('determinismo: misma entrada y reloj fijo producen la misma traza y decisión', () => {
    const a = runNativeConvergence(makeDeps(), makeRequest());
    const b = runNativeConvergence(makeDeps(), makeRequest());

    expect(a.status).toBe(b.status);
    expect(a.legitimacy.product).toBe(b.legitimacy.product);
    expect(a.hops.map((h) => [h.domain, h.contract, h.methodId, h.status, h.evidenceId])).toEqual(
      b.hops.map((h) => [h.domain, h.contract, h.methodId, h.status, h.evidenceId])
    );
    expect(a.evidence.chainHead).toBe(b.evidence.chainHead);
  });

  it('integridad: el ledger BookPI de la ejecución nativa verifica la cadena', () => {
    const deps = makeDeps();
    runNativeConvergence(deps, makeRequest());
    expect(deps.ledger.verify().valid).toBe(true);
  });
});
