/**
 * state: draft | engine-generated — TAMV Kaos Audio System: plan de redefinición reversible.
 *
 * Copyright (c) 2026 TAMV ONLINE ENTERPRISE — Edwin Oswaldo Castillo Trejo (Anubis Villaseñor).
 *
 * Ocho etapas declaradas, cada una con su acción compensadora inversa y sus puertas de
 * validación. Es un plan, no un resultado: ninguna etapa ejecuta DSP y `audioRendered` es
 * literalmente `false` en las ocho. El `digest` firma el plan (evidencia de qué se propuso),
 * no un audio hipotético.
 */
import { canonicalJson, round, sha256Hex } from '../ivcc/util';
import { headroomDb } from './analysis';
import { adaptiveGainDb, derivePresetMatrix, hapticIntensityFromTransients } from './adaptive';
import {
  TAMV_ENGINE_VERSION,
  TAMV_PLAN_VERSION,
  type ParamValue,
  type RedefineStage,
  type TamvAnalysis,
  type TamvPreset,
  type TamvRedefinePlan,
  type ValidationGate,
} from './types';

export const TARGET_LOUDNESS_DBFS = -16;
export const LOUDNESS_TOLERANCE_DB = 3;
export const MIN_PHASE_COHERENCE = 0.5;
export const MAX_ONSETS_PER_SECOND = 12;
export const MIN_HIGH_BAND_RATIO = 0.02;

function gate(
  id: string,
  description: string,
  threshold: number,
  unit: string,
  observedValue: number | null,
  passWhen: (value: number) => boolean
): ValidationGate {
  if (observedValue === null) {
    return {
      id,
      description,
      threshold,
      unit,
      computedFromFeatures: false,
      observedValue: null,
      state: 'unknown',
    };
  }
  return {
    id,
    description,
    threshold,
    unit,
    computedFromFeatures: true,
    observedValue: round(observedValue, 4),
    state: passWhen(observedValue) ? 'pass' : 'fail',
  };
}

function stage(input: {
  readonly id: string;
  readonly order: number;
  readonly title: string;
  readonly domain: RedefineStage['domain'];
  readonly action: RedefineStage['action'];
  readonly dependsOn: readonly string[];
  readonly reversible: boolean;
  readonly inverse: string;
  readonly parameters: Readonly<Record<string, ParamValue>>;
  readonly gates: readonly ValidationGate[];
  readonly note: string;
}): RedefineStage {
  return Object.freeze({ ...input, executionState: 'declared', audioRendered: false });
}

export function buildValidationGates(
  analysis: TamvAnalysis
): Readonly<Record<string, ValidationGate>> {
  const features = analysis.features;
  const loudnessError = Math.abs(features.rmsDbfs - TARGET_LOUDNESS_DBFS);
  return Object.freeze({
    clipping: gate(
      'clipping',
      'Margen por debajo del techo tras la ganancia adaptativa.',
      0,
      'dB',
      headroomDb(analysis.features),
      (value) => value >= 0
    ),
    phaseCoherence: gate(
      'phase_coherence',
      'Correlación intercanal L/R: por debajo de 0.5 la reconstrucción espacial es insegura.',
      MIN_PHASE_COHERENCE,
      'ratio',
      features.stereoCorrelation,
      (value) => value >= MIN_PHASE_COHERENCE
    ),
    spatialLocalization: gate(
      'spatial_localization',
      'Fracción de energía en el canal lateral (M/S): 0 = mono real, sin geometría que reproyectar.',
      0.02,
      'proportion',
      features.sideEnergyProportion,
      (value) => value >= 0.02
    ),
    hapticSync: gate(
      'haptic_sync',
      'Densidad de onsets dentro de la ventana accionable por un actuador.',
      MAX_ONSETS_PER_SECOND,
      'onsets/s',
      features.transientDensityPerSecond,
      (value) => value <= MAX_ONSETS_PER_SECOND
    ),
    targetLoudness: gate(
      'target_loudness',
      `Error de RMS contra ${TARGET_LOUDNESS_DBFS} dBFS con tolerancia de ±${LOUDNESS_TOLERANCE_DB} dB.`,
      LOUDNESS_TOLERANCE_DB,
      'dB',
      loudnessError,
      (value) => value <= LOUDNESS_TOLERANCE_DB
    ),
    spectralCoverage: gate(
      'spectral_coverage',
      'Proporción de energía por encima de 2 kHz: una banda alta colapsada indica material filtrado.',
      MIN_HIGH_BAND_RATIO,
      'ratio',
      features.highBandRatio,
      (value) => value >= MIN_HIGH_BAND_RATIO
    ),
  });
}

export function buildRedefinePlan(analysis: TamvAnalysis, preset: TamvPreset): TamvRedefinePlan {
  const gates = buildValidationGates(analysis);
  const matrix = derivePresetMatrix(analysis);
  const spatial = preset.spatialConfig;
  const features = analysis.features;

  const stages: readonly RedefineStage[] = Object.freeze([
    stage({
      id: 'source_analysis',
      order: 1,
      title: 'Fuente: análisis estructural',
      domain: 'qc',
      action: 'analyze',
      dependsOn: [],
      reversible: true,
      inverse: 'Descartar las métricas derivadas; el PCM original queda intacto.',
      parameters: {
        sha256: analysis.source.sha256,
        sampleRate: features.sampleRate,
        channels: features.channels,
        centroidHz: features.spectralCentroidHz,
      },
      gates: [gates.spectralCoverage],
      note: 'Etapa ya ejecutada en este request: es medición, no transformación.',
    }),
    stage({
      id: 'source_separation',
      order: 2,
      title: 'Separación de fuentes',
      domain: 'spatial',
      action: 'separate',
      dependsOn: ['source_analysis'],
      reversible: true,
      inverse: 'Re-sumar las pistas separadas con la ganancia original registradas en el plan.',
      parameters: {
        elements: ['vocals', 'bass', 'drums', 'synths', 'ambience'],
        method: 'spectral_gating',
      },
      gates: [gates.spectralCoverage],
      note: 'Plan declarativo: Isabella no incluye un separador de fuentes; se requiere un motor externo.',
    }),
    stage({
      id: 'spatial_rebuild',
      order: 3,
      title: 'Reconstrucción del campo espacial',
      domain: 'spatial',
      action: 'transform',
      dependsOn: ['source_separation'],
      reversible: true,
      inverse: `Revertir a geometría neutra (width 1.00, depth 0.00, RT60 0.00 s).`,
      parameters: {
        width: spatial.width,
        depth: spatial.depth,
        height: spatial.height,
        focus: spatial.focus,
        rt60Seconds: spatial.roomSizeSeconds,
        environment: matrix.environment,
      },
      gates: [gates.spatialLocalization, gates.phaseCoherence],
      note: 'Sin HRTF ni renderer ambisonic en este runtime: los parámetros son objetivos para un downstream.',
    }),
    stage({
      id: 'temporal_redefinition',
      order: 4,
      title: 'Redefinición temporal',
      domain: 'temporal',
      action: 'transform',
      dependsOn: ['spatial_rebuild'],
      reversible: true,
      inverse: 'Aplicar el factor inverso (1 / timeStretch) y el tono inverso (-pitchSemitones).',
      parameters: { timeStretch: 1, pitchSemitones: 0, tempoMapping: 'preserve' },
      gates: [gates.clipping],
      note: 'Identidad por defecto: estirar tiempo exige un phase vocoder que Isabella no implementa.',
    }),
    stage({
      id: 'harmonic_reconstruction',
      order: 5,
      title: 'Reconstrucción armónica',
      domain: 'harmonic',
      action: 'transform',
      dependsOn: ['temporal_redefinition'],
      reversible: true,
      inverse: 'Restaurar el balance espectral medido en la etapa 1.',
      parameters: {
        centroidHz: features.spectralCentroidHz,
        flatness: features.spectralFlatness,
        formantPreservation: true,
      },
      gates: [gates.spectralCoverage],
      note: 'Modelado espectral declarado; no hay sintetizador por modelado en el runtime.',
    }),
    stage({
      id: 'dynamic_optimization',
      order: 6,
      title: 'Optimización dinámica',
      domain: 'dynamic',
      action: 'transform',
      dependsOn: ['harmonic_reconstruction'],
      reversible: true,
      inverse: `Anular la ganancia aplicada (-${round(adaptiveGainDb(features.rmsDbfs), 2)} dB) y restablecer el techo observado.`,
      parameters: {
        gainDb: round(adaptiveGainDb(features.rmsDbfs), 2),
        ceilingDbfs: -0.3,
        targetRmsDbfs: TARGET_LOUDNESS_DBFS,
        observedRmsDbfs: features.rmsDbfs,
      },
      gates: [gates.clipping, gates.targetLoudness],
      note: 'LUFS no se calcula: la puerta usa RMS medido y se declara aproximación.',
    }),
    stage({
      id: 'haptic_render',
      order: 7,
      title: 'Render háptico',
      domain: 'haptic',
      action: 'render',
      dependsOn: ['dynamic_optimization'],
      reversible: false,
      inverse: 'Apagar el actuador (no existe un "audio inverso" para vibración ya emitida).',
      parameters: {
        pattern: preset.haptic.pattern,
        intensity: hapticIntensityFromTransients(features.transientDensityPerSecond),
        syncTrigger: preset.haptic.syncTrigger,
        onsetsPerSecond: features.transientDensityPerSecond,
      },
      gates: [gates.hapticSync],
      note: 'Sin actuador ni driver háptico en el servidor: etapa no accionable en este despliegue.',
    }),
    stage({
      id: 'quality_control',
      order: 8,
      title: 'Control de calidad',
      domain: 'qc',
      action: 'verify',
      dependsOn: ['spatial_rebuild', 'dynamic_optimization', 'haptic_render'],
      reversible: true,
      inverse: 'No aplica: la etapa solo lee métricas.',
      parameters: {
        gateCount: 6,
        requiredPass: ['clipping', 'target_loudness', 'spectral_coverage'],
        recommendedPass: ['phase_coherence', 'spatial_localization', 'haptic_sync'],
      },
      gates: [
        gates.clipping,
        gates.phaseCoherence,
        gates.spatialLocalization,
        gates.hapticSync,
        gates.targetLoudness,
        gates.spectralCoverage,
      ],
      note: 'Las puertas se evalúan sobre el material de entrada; tras renderizar habría que re-medir.',
    }),
  ]);

  const planBody = {
    analysisId: analysis.analysisId,
    createdAt: analysis.createdAt,
    engineVersion: TAMV_ENGINE_VERSION,
    planVersion: TAMV_PLAN_VERSION,
    presetId: preset.presetId,
    sourceSha256: analysis.source.sha256,
    stages,
    rollback: {
      supported: true,
      strategy: 'compensating-action' as const,
      reason:
        'Cada etapa transformacional declara su acción compensadora inversa; la etapa háptica es irrevocable una vez emitida.',
    },
  };

  const reversiblyRecoverableStages = stages.filter((item) => item.reversible).length;

  return Object.freeze({
    planId: `redefine_${analysis.source.sha256.slice(0, 12)}_${preset.presetId}`,
    planVersion: TAMV_PLAN_VERSION,
    createdAt: analysis.createdAt,
    sourceSha256: analysis.source.sha256,
    analysisId: analysis.analysisId,
    presetId: preset.presetId,
    stages,
    rollback: planBody.rollback,
    stageCount: stages.length,
    reversiblyRecoverableStages,
    digest: sha256Hex(canonicalJson(planBody)),
    authorizationPerformed: false,
    executionPerformed: false,
  });
}

/** Resumen de puertas para UI/logs sin re-scanear el plan. */
export function summarizeGates(plan: TamvRedefinePlan): {
  readonly pass: number;
  readonly fail: number;
  readonly unknown: number;
  readonly blocking: readonly string[];
} {
  let pass = 0;
  let fail = 0;
  let unknown = 0;
  const blocking = new Set<string>();
  for (const item of plan.stages) {
    for (const gateItem of item.gates) {
      if (gateItem.state === 'pass') pass += 1;
      else if (gateItem.state === 'fail') {
        fail += 1;
        blocking.add(gateItem.id);
      } else unknown += 1;
    }
  }
  return { pass, fail, unknown, blocking: [...blocking].sort() };
}
