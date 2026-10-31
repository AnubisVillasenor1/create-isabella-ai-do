// state: draft | engine-generated — pruebas del plan de redefinición reversible.
import { describe, expect, it } from 'vitest';
import { buildAdaptivePreset } from '../../src/tamv/adaptive';
import {
  LOUDNESS_TOLERANCE_DB,
  MAX_ONSETS_PER_SECOND,
  MIN_HIGH_BAND_RATIO,
  MIN_PHASE_COHERENCE,
  TARGET_LOUDNESS_DBFS,
  buildRedefinePlan,
  buildValidationGates,
  summarizeGates,
} from '../../src/tamv/plan';
import { getFactoryPreset } from '../../src/tamv/presets';
import { TAMV_PLAN_VERSION, type TamvAnalysis } from '../../src/tamv/types';
import { analysisOf, monoWav, noise, stereoWav, tone } from './fixtures';

const STAGE_IDS = [
  'source_analysis',
  'source_separation',
  'spatial_rebuild',
  'temporal_redefinition',
  'harmonic_reconstruction',
  'dynamic_optimization',
  'haptic_render',
  'quality_control',
];

const GATE_IDS = [
  'clipping',
  'phase_coherence',
  'spatial_localization',
  'haptic_sync',
  'target_loudness',
  'spectral_coverage',
];

function planFor(bytes: Uint8Array) {
  const analysis = analysisOf(bytes);
  return { analysis, plan: buildRedefinePlan(analysis, buildAdaptivePreset(analysis)) };
}

const monoPlan = planFor(monoWav(tone(220, 0.3)));
const loudPlan = planFor(monoWav(tone(220, 0.99)));
const widePlan = planFor(stereoWav(noise(0.2, 22_050, 3), noise(0.2, 22_050, 71)));

describe('TAMV plan · puertas de validación', () => {
  it('declara exactamente las seis puertas y sus cotas', () => {
    const gates = buildValidationGates(monoPlan.analysis);
    expect(Object.keys(gates).sort()).toEqual([
      'clipping',
      'hapticSync',
      'phaseCoherence',
      'spatialLocalization',
      'spectralCoverage',
      'targetLoudness',
    ]);
    expect(Object.values(gates).map((item) => item.id).sort()).toEqual([...GATE_IDS].sort());
    expect(gates.targetLoudness.threshold).toBe(LOUDNESS_TOLERANCE_DB);
    expect(gates.targetLoudness.description).toContain(String(TARGET_LOUDNESS_DBFS));
    expect(gates.phaseCoherence.threshold).toBe(MIN_PHASE_COHERENCE);
    expect(gates.hapticSync.threshold).toBe(MAX_ONSETS_PER_SECOND);
    expect(gates.spectralCoverage.threshold).toBe(MIN_HIGH_BAND_RATIO);
  });

  it('un WAV mono marca `unknown` en las puertas que exigen dos canales', () => {
    const gates = buildValidationGates(monoPlan.analysis);
    for (const gate of [gates.phaseCoherence, gates.spatialLocalization]) {
      expect(gate.state).toBe('unknown');
      expect(gate.observedValue).toBeNull();
      expect(gate.computedFromFeatures).toBe(false);
    }
    expect(monoPlan.analysis.features.stereoCorrelation).toBeNull();
  });

  it('el material en el techo suspende la puerta de clipping, no la esconde', () => {
    expect(buildValidationGates(monoPlan.analysis).clipping.state).toBe('pass');
    expect(buildValidationGates(loudPlan.analysis).clipping.state).toBe('fail');
    expect(buildValidationGates(loudPlan.analysis).clipping.observedValue).toBeLessThan(0);
  });

  it('la lejanía al objetivo de sonoridad suspende target_loudness', () => {
    const quiet = analysisOf(monoWav(tone(220, 0.02)));
    expect(quiet.features.rmsDbfs).toBeLessThan(TARGET_LOUDNESS_DBFS - LOUDNESS_TOLERANCE_DB);
    expect(buildValidationGates(quiet).targetLoudness.state).toBe('fail');
  });

  it('el estéreo desacoplado sí activa las puertas geométricas', () => {
    const gates = buildValidationGates(widePlan.analysis);
    expect(gates.phaseCoherence.computedFromFeatures).toBe(true);
    expect(gates.spatialLocalization.observedValue).not.toBeNull();
    expect(gates.spectralCoverage.state).toBe('pass');
  });
});

describe('TAMV plan · ocho etapas declaradas', () => {
  it('ninguna etapa ejecuta: el plan es una propuesta firmada, no un resultado', () => {
    const { plan } = monoPlan;
    expect(plan.stageCount).toBe(8);
    expect(plan.stages.map((item) => item.id)).toEqual(STAGE_IDS);
    expect(plan.stages.map((item) => item.order)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    for (const stage of plan.stages) {
      expect(stage.executionState).toBe('declared');
      expect(stage.audioRendered).toBe(false);
      expect(stage.inverse.length).toBeGreaterThan(0);
      expect(stage.note.length).toBeGreaterThan(0);
      expect(stage.gates.length).toBeGreaterThan(0);
    }
    expect(plan.authorizationPerformed).toBe(false);
    expect(plan.executionPerformed).toBe(false);
    expect(plan.planVersion).toBe(TAMV_PLAN_VERSION);
  });

  it('las dependencias apuntan a etapas ya declaradas, nunca a sí mismas ni al futuro', () => {
    const { plan } = monoPlan;
    const byId = new Map(plan.stages.map((item) => [item.id, item.order]));
    for (const stage of plan.stages) {
      for (const parent of stage.dependsOn) {
        expect(byId.has(parent)).toBe(true);
        expect((byId.get(parent) ?? 0) < stage.order).toBe(true);
      }
    }
  });

  it('siete de ocho son reversibles; la háptica no, y el plan lo dice', () => {
    const { plan } = monoPlan;
    expect(plan.reversiblyRecoverableStages).toBe(7);
    const haptic = plan.stages.find((item) => item.id === 'haptic_render');
    expect(haptic?.reversible).toBe(false);
    expect(plan.rollback.supported).toBe(true);
    expect(plan.rollback.strategy).toBe('compensating-action');
    expect(plan.rollback.reason).toContain('áptica');
  });

  it('el identificador y el digest salen del audio y del preset, no de un contador', () => {
    const { analysis, plan } = monoPlan;
    expect(plan.planId).toBe(`redefine_${analysis.source.sha256.slice(0, 12)}_${plan.presetId}`);
    expect(plan.sourceSha256).toBe(analysis.source.sha256);
    expect(plan.analysisId).toBe(analysis.analysisId);
    expect(plan.digest).toMatch(/^[0-9a-f]{64}$/);
    expect(buildRedefinePlan(analysis, buildAdaptivePreset(analysis)).digest).toBe(plan.digest);
  });

  it('cambiar el preset cambia el plan, sin tocar el análisis', () => {
    const { analysis, plan } = monoPlan;
    const factory = getFactoryPreset('broadcast_studio');
    expect(factory).not.toBeNull();
    const other = buildRedefinePlan(analysis, factory!);
    expect(other.presetId).toBe('broadcast_studio');
    expect(other.digest).not.toBe(plan.digest);
    expect(other.analysisId).toBe(plan.analysisId);
    expect(other.stages[2].parameters.width).toBe(factory!.spatialConfig.width);
  });
});

describe('TAMV plan · resumen de puertas', () => {
  it('el recuento cuadra con las puertas efectivamente colgadas', () => {
    const { plan } = monoPlan;
    const summary = summarizeGates(plan);
    const hung = plan.stages.reduce((total, item) => total + item.gates.length, 0);
    expect(summary.pass + summary.fail + summary.unknown).toBe(hung);
    expect(hung).toBe(15);
    for (const id of summary.blocking) {
      expect(GATE_IDS).toContain(id);
      const states = new Set(
        plan.stages.flatMap((item) => item.gates.filter((gate) => gate.id === id).map((gate) => gate.state))
      );
      expect(states.has('fail')).toBe(true);
    }
    expect(summary.blocking).toEqual([...summary.blocking].sort());
  });

  it('el plan mono bloquea por geometría desconocida y no por clipping', () => {
    const summary = summarizeGates(monoPlan.plan);
    expect(summary.unknown).toBe(4);
    expect(summary.blocking).not.toContain('clipping');
    expect(summarizeGates(loudPlan.plan).blocking).toContain('clipping');
  });
});

describe('TAMV plan · análisis irrefutable', () => {
  it('un TamvAnalysis de fixture no se acepta a medias: los ids coinciden con su fuente', () => {
    const { analysis }: { analysis: TamvAnalysis } = monoPlan;
    expect(analysis.features.frames).toBe(22_050);
    expect(analysis.recommendedPresetId.length).toBeGreaterThan(0);
    expect(analysis.limitations.some((item) => item.includes('No hay medidor LUFS'))).toBe(true);
  });
});
