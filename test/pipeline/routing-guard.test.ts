import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  PIPELINE_METRICS_NOT_INSTRUMENTED,
  PipelineOrchestrator,
  evaluateRoutingGuard,
} from '../../src/pipeline/hyper-turbo/hyper-turbo-pipelines';

/**
 * state: engine-generated — el ruteo "auto" vuelve a ser real y las métricas dejan de ser ceros.
 *
 * La versión anterior hacía `eval(condition.replace(/\binput\./g, ''))`: al borrar el prefijo,
 * `input.batchSize > 10` se evaluaba como la variable `batchSize`, inexistente, y el `catch`
 * devolvía `false`. Ninguna regla con campos se cumplía nunca. Estas pruebas fijan el
 * comportamiento que ahora sí existe y prohíben que vuelva a aparecer `eval`.
 */

describe('guard de ruteo sin eval', () => {
  it('resuelve comparaciones sobre campos reales de la entrada', () => {
    const input = {
      priority: 'critical',
      latencyBudget: 15,
      batchSize: 40,
      requireCitations: true,
    };
    expect(evaluateRoutingGuard("input.priority === 'critical'", input)).toBe(true);
    expect(evaluateRoutingGuard("input.priority === 'baja'", input)).toBe(false);
    expect(evaluateRoutingGuard('input.batchSize > 10', input)).toBe(true);
    expect(evaluateRoutingGuard('input.batchSize < 10', input)).toBe(false);
    expect(evaluateRoutingGuard('input.latencyBudget <= 15', input)).toBe(true);
    expect(evaluateRoutingGuard('input.requireCitations', input)).toBe(true);
  });

  it('respeta la precedencia && sobre ||', () => {
    const input = { complexity: 'simple', latencyBudget: 50, requireCitations: false };
    expect(
      evaluateRoutingGuard("input.complexity === 'simple' && input.latencyBudget < 100", input)
    ).toBe(true);
    expect(
      evaluateRoutingGuard("input.complexity === 'complex' || input.requireCitations", input)
    ).toBe(false);
    expect(
      evaluateRoutingGuard("input.complexity === 'complex' || input.latencyBudget < 100", input)
    ).toBe(true);
  });

  it('mantiene las literales booleanas y no ejecuta código', () => {
    expect(evaluateRoutingGuard('true', {})).toBe(true);
    expect(evaluateRoutingGuard('false', {})).toBe(false);
    let ejecutado = false;
    const bomba = 'globalThis.__marca = (ejecutado = true, 1)';
    expect(evaluateRoutingGuard(bomba, {})).toBe(false);
    expect(ejecutado).toBe(false);
    expect((globalThis as Record<string, unknown>).__marca).toBeUndefined();
  });

  it('los campos con puntos anidados se resuelven sin ReferenceError silencioso', () => {
    const input = { tenant: { tier: 'gold' } };
    expect(evaluateRoutingGuard("input.tenant.tier === 'gold'", input)).toBe(true);
    expect(evaluateRoutingGuard("input.tenant.missing === 'gold'", input)).toBe(false);
    expect(evaluateRoutingGuard('input.tenant.missing', input)).toBe(false);
  });

  it('el módulo ya no contiene eval', () => {
    const fuente = readFileSync(
      new URL('../../src/pipeline/hyper-turbo/hyper-turbo-pipelines.ts', import.meta.url),
      'utf-8'
    );
    expect(fuente).not.toMatch(/\beval\(/);
    expect(fuente).not.toMatch(/new Function\(/);
  });
});

describe('métricas reales del pipeline', () => {
  it('empieza en cero medido y declara lo que no instrumenta', () => {
    const orchestrator = new PipelineOrchestrator();
    const metrics = orchestrator.getMetrics();
    expect(metrics.autoRoutedTotal).toBe(0);
    expect(metrics.stageCalls).toBe(0);
    expect(metrics.errorRate).toBeNull();
    expect(metrics.avgLatencyMs).toBeNull();
    expect(metrics.p99HotLatencyMs).toBeNull();
    expect(metrics.notInstrumented).toEqual([...PIPELINE_METRICS_NOT_INSTRUMENTED]);
    expect(metrics.speculativeCacheSize).toBe(0);
    orchestrator.shutdown();
  });
});
