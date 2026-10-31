import { describe, expect, it } from 'vitest';
import { generateKeyPairSync } from 'node:crypto';
import {
  BLACKOUT_METHOD_IDS,
  BlackoutController,
  GLOBAL_SCOPE,
  assessConstitutionalIntegrity,
  assertGovernableScope,
  createBlackoutGuard,
  evaluateBlackoutRequest,
  isSurvivorPath,
  scopeForPath,
  type BlackoutEvidenceEvent,
  type GovernableScope,
} from '../../src/governance/blackout';
import { KillSwitch, signKillCommand, type KillCommand } from '../../src/security/kill-switch';

/**
 * state: draft | engine-generated — pruebas del Modo Terminus Blackout.
 * Lo que se comprueba es la parte operativa: que la tabla ruta→alcance refleja las rutas que de
 * verdad existen, que el plano de control y el de evidencia sobreviven al apagado, que la lectura
 * no se cega, y que ningún halt se aplica o se levanta sin firma y sin evidencia.
 */

const NOW = Date.now() + 60_000;

function makeKillSwitch(keys = ['alice', 'bob']) {
  const pairs = new Map<string, ReturnType<typeof generateKeyPairSync>>();
  for (const issuer of keys) pairs.set(issuer, generateKeyPairSync('ed25519'));
  const authorizedKeys = new Map<string, ReturnType<typeof generateKeyPairSync>['publicKey']>();
  for (const [issuer, pair] of pairs) authorizedKeys.set(issuer, pair.publicKey);
  const ks = new KillSwitch({ authorizedKeys, maxDurationMs: 10_000 });
  let counter = 0;
  const command = (
    issuer: string,
    action: 'ENGAGE' | 'RELEASE',
    scope: string,
    at = NOW
  ): KillCommand => {
    const pair = pairs.get(issuer);
    if (pair === undefined) throw new Error(`unknown issuer ${issuer}`);
    counter += 1;
    return signKillCommand(pair.privateKey, {
      action,
      scope,
      issuer,
      issuedAt: new Date(at).toISOString(),
      nonce: `nonce-${counter}-blackout-test`,
      reason: 'prueba gobernada',
    });
  };
  return { ks, command };
}

function fakeRes() {
  const out: { statusCode?: number; body?: unknown } = {};
  const res = {
    status(code: number) {
      out.statusCode = code;
      return res;
    },
    json(body: unknown) {
      out.body = body;
      return res;
    },
  };
  return { out, res };
}

describe('governance/blackout — tabla ruta→alcance', () => {
  it('asigna el alcance a las superficies que egresan del nodo', () => {
    expect(scopeForPath('/api/v1/tools/execute')).toBe('AGENT_EXECUTION');
    expect(scopeForPath('/api/v1/hypercore/run')).toBe('AGENT_EXECUTION');
    expect(scopeForPath('/api/v1/cognition/route')).toBe('LLM_INFERENCE');
    expect(scopeForPath('/v1/chat/completions')).toBe('LLM_INFERENCE');
    expect(scopeForPath('/v1/messages')).toBe('LLM_INFERENCE');
    expect(scopeForPath('/api/v3/economy/settle')).toBe('PAYMENTS');
    expect(scopeForPath('/api/v1/revenue/settle')).toBe('PAYMENTS');
    expect(scopeForPath('/api/v1/federation/cross')).toBe('FEDERATION');
    expect(scopeForPath('/api/v3/omega/twins/federate')).toBe('FEDERATION');
  });

  it('da precedencia a la ruta específica: voz antes que lenguaje', () => {
    expect(scopeForPath('/api/v1/cognition/speech')).toBe('VOICE_SYNTHESIS');
    expect(scopeForPath('/api/v1/cognition/transcribe')).toBe('LLM_INFERENCE');
    expect(scopeForPath('/api/v1/tts/synthesize')).toBe('VOICE_SYNTHESIS');
  });

  it('deja fuera lo que no es superficie gobernable', () => {
    expect(scopeForPath('/api/v1/memory/query')).toBeNull();
    expect(scopeForPath('/platform')).toBeNull();
  });

  it('mantiene supervivientes el plano de evidencia, control y recuperación', () => {
    for (const path of [
      '/api/v1/governance/blackout/engage',
      '/api/v1/bookpi/events/admin',
      '/api/v1/evidence-graph/append',
      '/api/v1/audit/trail',
      '/api/v1/emergency/recover',
      '/api/v1/reina/adjudicate',
      '/api/v1/healthz',
      '/api/v1/status',
      '/api/v1/security/authenticate',
      '/api/v3/omega/constitution/evaluate',
    ]) {
      expect(isSurvivorPath(path)).toBe(true);
      expect(scopeForPath(path)).toBeNull();
    }
  });

  it('rechaza un alcance que no es gobernable en vez de halta nada', () => {
    expect(assertGovernableScope('LLM_INFERENCE')).toBe('LLM_INFERENCE');
    expect(assertGovernableScope(GLOBAL_SCOPE)).toBe(GLOBAL_SCOPE);
    expect(() => assertGovernableScope('LLM_INFERENSE')).toThrow(/no es gobernable/);
  });
});

describe('governance/blackout — evaluación por petición', () => {
  // El predicado modela `KillSwitch.isHalted(scope)`: un alcance haltado no implica que GLOBAL
  // lo esté. La cobertura de GLOBAL hacia abajo la añade el evaluador, no el predicado.
  const halted = new Set<GovernableScope>(['LLM_INFERENCE']);
  const isHalted = (scope: GovernableScope) => halted.has(scope);

  it('deniega la escritura en un alcance haltado', () => {
    expect(evaluateBlackoutRequest('POST', '/api/v1/cognition/route', isHalted)).toMatchObject({
      allowed: false,
      scope: 'LLM_INFERENCE',
      reason: 'HALTED',
    });
  });

  it('no cega la lectura: un apagado no oculta el estado a quien audita', () => {
    expect(evaluateBlackoutRequest('GET', '/api/v1/cognition/route', isHalted).allowed).toBe(true);
    expect(evaluateBlackoutRequest('HEAD', '/api/v3/economy/settle', isHalted).allowed).toBe(true);
  });

  it('respeta los supervivientes incluso bajo halt de alcance', () => {
    expect(
      evaluateBlackoutRequest('POST', '/api/v1/governance/blackout/engage', isHalted).allowed
    ).toBe(true);
  });

  it('el halt de un alcance no apaga los demás', () => {
    expect(evaluateBlackoutRequest('POST', '/api/v1/tools/execute', isHalted).allowed).toBe(true);
  });

  it('GLOBAL apaga todo lo gobernedor y deja vivos los supervivientes', () => {
    const globalOnly = (scope: GovernableScope) => scope === GLOBAL_SCOPE;
    expect(evaluateBlackoutRequest('POST', '/api/v1/tools/execute', globalOnly).allowed).toBe(
      false
    );
    expect(evaluateBlackoutRequest('POST', '/api/v1/bookpi/events/admin', globalOnly).allowed).toBe(
      true
    );
  });
});

describe('governance/blackout — guard Express', () => {
  it('responde 503 con el alcance y sella el rechazo una sola vez por ventana', () => {
    const { ks, command } = makeKillSwitch();
    ks.engage(command('alice', 'ENGAGE', 'LLM_INFERENCE'), NOW);
    const sealed: BlackoutEvidenceEvent[] = [];
    const guard = createBlackoutGuard({
      killSwitch: ks,
      recordEvidence: (event) => sealed.push(event),
      newEventId: () => 'evt-denial-1',
      evidenceWindowMs: 60_000,
    });

    const first = fakeRes();
    (guard as (r: unknown, s: unknown, n: unknown) => void)(
      { method: 'POST', path: '/api/v1/cognition/route', ip: '10.0.0.1' },
      first.res,
      () => {
        throw new Error('next() no debe llamarse en un alcance haltado');
      }
    );
    expect(first.out.statusCode).toBe(503);
    expect(first.out.body).toMatchObject({
      success: false,
      error: 'HALTED_BY_BLACKOUT',
      scope: 'LLM_INFERENCE',
    });
    expect(sealed).toHaveLength(1);
    expect(sealed[0]).toMatchObject({
      id: 'evt-denial-1',
      type: 'BLACKOUT_DENIAL',
      methodId: BLACKOUT_METHOD_IDS.halt,
      status: 'DENIED:LLM_INFERENCE',
    });

    const second = fakeRes();
    (guard as (r: unknown, s: unknown, n: unknown) => void)(
      { method: 'POST', path: '/api/v1/cognition/vision', ip: '10.0.0.2' },
      second.res,
      () => {
        throw new Error('next() no debe llamarse');
      }
    );
    expect(second.out.statusCode).toBe(503);
    expect(sealed).toHaveLength(1);
  });

  it('deja pasar cuando no hay halt', () => {
    const { ks } = makeKillSwitch();
    let passed = false;
    const guard = createBlackoutGuard({ killSwitch: ks });
    const { res } = fakeRes();
    (guard as (r: unknown, s: unknown, n: unknown) => void)(
      { method: 'POST', path: '/api/v1/cognition/route', ip: '10.0.0.1' },
      res,
      () => {
        passed = true;
      }
    );
    expect(passed).toBe(true);
  });
});

describe('governance/blackout — integridad constitucional', () => {
  const none = () => ({ valid: true, status: 'VERIFIED_IN_MEMORY_CHAIN', diagnostics: [] });

  it('CLEAN sin hallazgos', () => {
    const assessment = assessConstitutionalIntegrity({
      verifyLedger: none,
      readinessErrors: [],
      envHalted: false,
      halted: () => false,
    });
    expect(assessment.posture).toBe('CLEAN');
    expect(assessment.engagementSuggested).toBe(false);
  });

  it('cadena rota ⇒ CORRUPTED y recomienda GLOBAL', () => {
    const assessment = assessConstitutionalIntegrity({
      verifyLedger: () => ({
        valid: false,
        status: 'INTEGRITY_FAILURE',
        diagnostics: ['Chain broken at block #3'],
      }),
      readinessErrors: [],
      envHalted: false,
      halted: () => false,
    });
    expect(assessment.posture).toBe('CORRUPTED');
    expect(assessment.engagementSuggested).toBe(true);
    expect(assessment.recommendedScope).toBe(GLOBAL_SCOPE);
    expect(assessment.findings.map((f) => f.id)).toContain('BI-LEDGER-CHAIN-BROKEN');
  });

  it('verificación que lanza ⇒ CORRUPTED (no se pierde el hallazgo)', () => {
    const assessment = assessConstitutionalIntegrity({
      verifyLedger: () => {
        throw new Error('disk went away');
      },
      readinessErrors: [],
      envHalted: false,
      halted: () => false,
    });
    expect(assessment.posture).toBe('CORRUPTED');
    expect(assessment.findings.map((f) => f.id)).toContain('BI-LEDGER-VERIFY-THREW');
  });

  it('sin ledger es DEGRADED: capacidad de sellar ausente, no cadena rota', () => {
    const assessment = assessConstitutionalIntegrity({
      verifyLedger: null,
      readinessErrors: [],
      envHalted: false,
      halted: () => false,
    });
    expect(assessment.posture).toBe('DEGRADED');
    expect(assessment.engagementSuggested).toBe(false);
    expect(assessment.evidenceSealed).toBe(false);
  });

  it('bandera de entorno y hallazgos de despliegue se reportan y listan los halt', () => {
    const assessment = assessConstitutionalIntegrity({
      verifyLedger: none,
      readinessErrors: [{ id: 'PF-01', severity: 'ERROR', message: 'sin clave' }],
      envHalted: true,
      halted: (scope) => scope === 'PAYMENTS',
    });
    expect(assessment.posture).toBe('DEGRADED');
    expect(assessment.halted).toEqual(['PAYMENTS']);
    expect(assessment.findings.map((f) => f.id)).toEqual(
      expect.arrayContaining(['BI-ENV-KILL-SWITCH', 'PF-01'])
    );
  });
});

describe('governance/blackout — controlador con orden firmada', () => {
  function makeController(seal: (event: BlackoutEvidenceEvent) => void) {
    const { ks, command } = makeKillSwitch();
    const controller = new BlackoutController({
      killSwitch: ks,
      recordEvidence: seal,
      newEventId: () => 'evt-ctrl-1',
      now: () => NOW,
    });
    return { ks, command, controller };
  }

  it('apaga con firma válida y sella el apagado', () => {
    const sealed: BlackoutEvidenceEvent[] = [];
    const { ks, command, controller } = makeController((e) => sealed.push(e));
    const transition = controller.engage(command('alice', 'ENGAGE', 'LLM_INFERENCE'));
    expect(transition).toMatchObject({
      scope: 'LLM_INFERENCE',
      action: 'ENGAGE',
      issuer: 'alice',
      sealed: true,
    });
    expect(ks.isHalted('LLM_INFERENCE', NOW)).toBe(true);
    expect(sealed[0]).toMatchObject({
      type: 'BLACKOUT_ENGAGED',
      methodId: BLACKOUT_METHOD_IDS.engage,
      principal: 'kill-switch:alice',
      riskTier: 'CRITICAL',
    });
    expect(sealed[0]!.status.startsWith('halted:LLM_INFERENCE:')).toBe(true);
  });

  it('rechaza una orden sin firma válida y no apaga nada', () => {
    const sealed: BlackoutEvidenceEvent[] = [];
    const { ks, command, controller } = makeController((e) => sealed.push(e));
    const forged = { ...command('alice', 'ENGAGE', 'PAYMENTS'), reason: 'otro motivo' };
    expect(() => controller.engage(forged)).toThrow(/invalid signature/);
    expect(ks.isHalted('PAYMENTS', NOW)).toBe(false);
    expect(sealed).toHaveLength(0);
  });

  it('sin clave autorizada no hay apagado remoto (fail-closed por construcción)', () => {
    const ks = new KillSwitch({ authorizedKeys: new Map() });
    const controller = new BlackoutController({
      killSwitch: ks,
      recordEvidence: () => undefined,
      newEventId: () => 'evt-ctrl-2',
      now: () => NOW,
    });
    const { command } = makeKillSwitch();
    expect(() => controller.engage(command('alice', 'ENGAGE', 'GLOBAL'))).toThrow(
      /issuer not authorized/
    );
    expect(ks.isHalted('GLOBAL', NOW)).toBe(false);
  });

  it('si el libro falla, el halt se aplica igual y se declara sealed:false', () => {
    const { ks, command, controller } = makeController(() => {
      throw new Error('BOOKPI_MAINTENANCE_RECOVERY_REQUIRED');
    });
    const transition = controller.engage(command('alice', 'ENGAGE', 'FEDERATION'));
    expect(ks.isHalted('FEDERATION', NOW)).toBe(true);
    expect(transition.sealed).toBe(false);
    expect(transition.sealError).toContain('BOOKPI_MAINTENANCE_RECOVERY_REQUIRED');
  });

  it('levantar exige evidencia: si el sello falla, la capacidad sigue haltada', () => {
    const { ks, command, controller } = makeController(() => {
      throw new Error('ledger unavailable');
    });
    controller.engage(command('alice', 'ENGAGE', 'LLM_INFERENCE'));
    expect(() => controller.release([command('alice', 'RELEASE', 'LLM_INFERENCE')])).toThrow(
      /requires evidence in BookPI/
    );
    expect(ks.isHalted('LLM_INFERENCE', NOW)).toBe(true);
  });

  it('GLOBAL exige dos emisores distintos para reactivarse', () => {
    const sealed: BlackoutEvidenceEvent[] = [];
    const { ks, command, controller } = makeController((e) => sealed.push(e));
    controller.engage(command('alice', 'ENGAGE', 'GLOBAL'));
    expect(() => controller.release([command('alice', 'RELEASE', 'GLOBAL')])).toThrow(
      /requires 2 distinct issuers/
    );
    expect(ks.isHalted('GLOBAL', NOW)).toBe(true);
    const transition = controller.release([
      command('alice', 'RELEASE', 'GLOBAL'),
      command('bob', 'RELEASE', 'GLOBAL'),
    ]);
    expect(transition.sealed).toBe(true);
    expect(ks.isHalted('GLOBAL', NOW)).toBe(false);
  });

  it('rechaza un alcance que no existe en la lista cerrada', () => {
    const { command, controller } = makeController(() => undefined);
    expect(() => controller.engage(command('alice', 'ENGAGE', 'LLM_INFERENSE'))).toThrow(
      /no es gobernable/
    );
  });
});
