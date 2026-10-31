// state: draft | engine-generated — pruebas de la derivación adaptativa de presets.
import { describe, expect, it } from 'vitest';
import {
  ENVIRONMENT_BY_EMOTION,
  TAMV_ADAPTIVE_GAIN_LIMIT_DB,
  TAMV_ADAPTIVE_TARGET_RMS_DBFS,
  adaptiveGainDb,
  buildAdaptivePreset,
  derivePresetMatrix,
  hapticIntensityFromTransients,
} from '../../src/tamv/adaptive';
import { classifyContent, headroomDb } from '../../src/tamv/analysis';
import { getFactoryPreset, selectClosestFactoryPreset } from '../../src/tamv/presets';
import {
  ACOUSTIC_ENVIRONMENTS,
  EMOTIONAL_PROFILES,
  HAPTIC_INTENSITIES,
  HAPTIC_PATTERNS,
  HAPTIC_SYNC_TRIGGERS,
  SPATIAL_COMPLEXITIES,
  TAMV_PRESET_SCHEMA_VERSION,
} from '../../src/tamv/types';
import { analysisOf, features, monoWav, noise, stereoWav, tone } from './fixtures';

function stageOf(preset: ReturnType<typeof buildAdaptivePreset>, kind: string) {
  return preset.processingChain.find((item) => item.kind === kind);
}

describe('TAMV adaptativo · reglas numéricas', () => {
  it('la ganancia va al objetivo de loudness y se recorta en ±12 dB', () => {
    expect(adaptiveGainDb(TAMV_ADAPTIVE_TARGET_RMS_DBFS)).toBe(0);
    expect(adaptiveGainDb(-22)).toBeCloseTo(6, 10);
    expect(adaptiveGainDb(-40)).toBe(TAMV_ADAPTIVE_GAIN_LIMIT_DB);
    expect(adaptiveGainDb(-4)).toBeCloseTo(-12, 10);
    expect(adaptiveGainDb(0)).toBe(-TAMV_ADAPTIVE_GAIN_LIMIT_DB);
    expect(adaptiveGainDb(Number.NaN)).toBe(0);
    expect(adaptiveGainDb(Number.POSITIVE_INFINITY)).toBe(0);
  });

  it('la intensidad háptica cambia exactamente en las cotas declaradas', () => {
    const ladder: Array<[number, string]> = [
      [0, 'none'],
      [0.49, 'none'],
      [0.5, 'subtle'],
      [1.99, 'subtle'],
      [2, 'moderate'],
      [3.99, 'moderate'],
      [4, 'strong'],
      [6.99, 'strong'],
      [7, 'immersive'],
      [24, 'immersive'],
    ];
    for (const [density, expected] of ladder) {
      expect(hapticIntensityFromTransients(density)).toBe(expected);
      expect(HAPTIC_INTENSITIES).toContain(expected);
    }
  });

  it('cada perfil emocional tiene entorno, sin huecos', () => {
    expect(Object.keys(ENVIRONMENT_BY_EMOTION).sort()).toEqual([...EMOTIONAL_PROFILES].sort());
    for (const environment of Object.values(ENVIRONMENT_BY_EMOTION)) {
      expect(ACOUSTIC_ENVIRONMENTS).toContain(environment);
    }
  });

  it('la matriz derivada es coherente con las reglas sueltas', () => {
    const measured = features({ transientDensityPerSecond: 5, sideEnergyProportion: 0.25 });
    const matrix = derivePresetMatrix({
      features: measured,
      prediction: classifyContent(measured),
      emotion: 'energetic',
      spatialComplexity: 'rich',
    });
    expect(matrix.environment).toBe(ENVIRONMENT_BY_EMOTION.energetic);
    expect(matrix.hapticIntensity).toBe(hapticIntensityFromTransients(5));
    expect(SPATIAL_COMPLEXITIES).toContain(matrix.spatialComplexity);
    // La matriz no adivina: un clip demasiado corto para clasificar conserva `unknown` y la
    // selección de fábrica lo penaliza de forma explícita en vez de inventar un género.
    const short = features({ durationMs: 100 });
    const shortMatrix = derivePresetMatrix({
      features: short,
      prediction: classifyContent(short),
      emotion: 'neutral',
      spatialComplexity: 'minimal',
    });
    expect(shortMatrix.content).toBe('unknown');
  });
});

describe('TAMV adaptativo · preset por archivo', () => {
  const analysis = analysisOf(monoWav(tone(220, 0.3)));

  it('el preset se identifica por el digest del audio y no por un contador', () => {
    const preset = buildAdaptivePreset(analysis);
    expect(preset.presetId).toBe(`adaptive_${analysis.source.sha256.slice(0, 12)}`);
    expect(preset.source).toBe('adaptive');
    expect(preset.schemaVersion).toBe(TAMV_PRESET_SCHEMA_VERSION);
    expect(preset.usageCount).toBe(0);
    expect(preset.userRating).toBeNull();
    expect(preset.note).toContain(analysis.analysisId);
    expect(HAPTIC_PATTERNS).toContain(preset.haptic.pattern);
    expect(HAPTIC_SYNC_TRIGGERS).toContain(preset.haptic.syncTrigger);
    expect(HAPTIC_INTENSITIES).toContain(preset.haptic.intensity);
  });

  it('la cadena heredada recibe ganancia, ancho y techo calculados sobre lo medido', () => {
    const preset = buildAdaptivePreset(analysis);
    const base = selectClosestFactoryPreset(derivePresetMatrix(analysis));

    expect(preset.processingChain).toHaveLength(base.processingChain.length);
    expect(Number(stageOf(preset, 'gain')?.parameters.gainDb)).toBeCloseTo(
      Number(adaptiveGainDb(analysis.features.rmsDbfs).toFixed(2)),
      6
    );
    expect(Number(stageOf(preset, 'width')?.parameters.factor)).toBe(preset.spatialConfig.width);
    const ceiling = Number(stageOf(preset, 'limiter')?.parameters.ceilingDbfs);
    expect(ceiling).toBeLessThanOrEqual(-0.3);
    expect(ceiling).toBeCloseTo(
      Math.min(-0.3, analysis.features.peakDbfs + Math.max(0, headroomDb(analysis.features))),
      6
    );
    expect(preset.matrix.environment).toBe(ENVIRONMENT_BY_EMOTION[analysis.emotion]);
  });

  it('el ancho crece con la complejidad espacial y el foco se compensa', () => {
    const narrow = buildAdaptivePreset(analysisOf(monoWav(tone(1000, 0.2))));
    const wide = buildAdaptivePreset(analysisOf(stereoWav(noise(0.2, 22_050, 5), noise(0.2, 22_050, 31))));
    expect(SPATIAL_COMPLEXITIES.indexOf(wide.matrix.spatialComplexity)).toBeGreaterThanOrEqual(
      SPATIAL_COMPLEXITIES.indexOf(narrow.matrix.spatialComplexity)
    );
    for (const preset of [narrow, wide]) {
      expect(preset.spatialConfig.width).toBeGreaterThan(0);
      expect(preset.spatialConfig.width).toBeLessThanOrEqual(2);
      expect(preset.spatialConfig.focus).toBeGreaterThanOrEqual(0);
      expect(preset.spatialConfig.focus).toBeLessThanOrEqual(1);
      expect(preset.spatialConfig.depth).toBeGreaterThanOrEqual(0);
      expect(preset.spatialConfig.depth).toBeLessThanOrEqual(1);
    }
  });

  it('es determinista: el mismo audio produce el mismo preset', () => {
    expect(buildAdaptivePreset(analysis)).toEqual(buildAdaptivePreset(analysis));
    const otra = analysisOf(monoWav(tone(440, 0.3)));
    expect(buildAdaptivePreset(otra).presetId).not.toBe(buildAdaptivePreset(analysis).presetId);
  });

  it('la clasificación del archivo manda sobre la etiqueta del preset, y no se registra como fábrica', () => {
    const preset = buildAdaptivePreset(analysis);
    expect(preset.classification).toBe(analysis.prediction.contentType);
    expect(getFactoryPreset(preset.presetId)).toBeNull();
  });
});
