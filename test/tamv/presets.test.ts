// state: draft | engine-generated — pruebas del catálogo de presets de fábrica TAMV.
import { describe, expect, it } from 'vitest';
import {
  ACOUSTIC_ENVIRONMENT_GROUP,
  TAMV_FACTORY_PRESETS,
  TAMV_FACTORY_PRESET_IDS,
  getFactoryPreset,
  isFactoryPresetId,
  listFactoryPresets,
  matrixDistance,
  parsePresetMatrix,
  selectClosestFactoryPreset,
} from '../../src/tamv/presets';
import {
  ACOUSTIC_ENVIRONMENTS,
  CONTENT_TYPES,
  DSP_STAGE_KINDS,
  EMOTIONAL_PROFILES,
  HAPTIC_INTENSITIES,
  HAPTIC_PATTERNS,
  HAPTIC_SYNC_TRIGGERS,
  SPATIAL_COMPLEXITIES,
  TAMV_PRESET_SCHEMA_VERSION,
  type PresetMatrix,
} from '../../src/tamv/types';
import { features } from './fixtures';
import { derivePresetMatrix } from '../../src/tamv/adaptive';
import { classifyContent, deriveEmotionalProfile, deriveSpatialComplexity } from '../../src/tamv/analysis';

function matrixOf(overrides: Parameters<typeof features>[0] = {}): PresetMatrix {
  const measured = features(overrides);
  return derivePresetMatrix({
    features: measured,
    prediction: classifyContent(measured),
    emotion: deriveEmotionalProfile(measured),
    spatialComplexity: deriveSpatialComplexity(measured),
  });
}

describe('TAMV presets · catálogo', () => {
  it('once presets de fábrica, ids únicos y congruentes con el índice', () => {
    expect(TAMV_FACTORY_PRESETS).toHaveLength(11);
    expect(new Set(TAMV_FACTORY_PRESET_IDS).size).toBe(11);
    expect(listFactoryPresets()).toBe(TAMV_FACTORY_PRESETS);
    for (const id of TAMV_FACTORY_PRESET_IDS) {
      expect(isFactoryPresetId(id)).toBe(true);
      expect(getFactoryPreset(id)?.presetId).toBe(id);
    }
    expect(getFactoryPreset('no_existe')).toBeNull();
    expect(isFactoryPresetId('no_existe')).toBe(false);
    expect(getFactoryPreset('')).toBeNull();
  });

  it('cada preset declara ejes válidos, cadena ordenada y geometría acotada', () => {
    for (const preset of TAMV_FACTORY_PRESETS) {
      expect(preset.source).toBe('factory');
      expect(preset.schemaVersion).toBe(TAMV_PRESET_SCHEMA_VERSION);
      expect(preset.presetId).toMatch(/^[a-z0-9_]+$/);
      expect(EMOTIONAL_PROFILES).toContain(preset.matrix.emotion);
      expect(CONTENT_TYPES).toContain(preset.matrix.content);
      expect(ACOUSTIC_ENVIRONMENTS).toContain(preset.matrix.environment);
      expect(SPATIAL_COMPLEXITIES).toContain(preset.matrix.spatialComplexity);
      expect(HAPTIC_INTENSITIES).toContain(preset.matrix.hapticIntensity);
      expect(HAPTIC_PATTERNS).toContain(preset.haptic.pattern);
      expect(HAPTIC_SYNC_TRIGGERS).toContain(preset.haptic.syncTrigger);
      expect(preset.processingChain.length).toBeGreaterThan(0);
      expect(preset.processingChain.map((item) => item.order)).toEqual(
        preset.processingChain.map((item) => item.order).sort((a, b) => a - b)
      );
      for (const stage of preset.processingChain) expect(DSP_STAGE_KINDS).toContain(stage.kind);
      for (const value of [
        preset.spatialConfig.depth,
        preset.spatialConfig.height,
        preset.spatialConfig.focus,
        preset.spatialConfig.absorption,
        preset.spatialConfig.diffusion,
      ]) {
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThanOrEqual(1);
      }
      expect(preset.spatialConfig.width).toBeGreaterThanOrEqual(0);
      expect(preset.spatialConfig.width).toBeLessThanOrEqual(2);
      expect(preset.note.length).toBeGreaterThan(0);
    }
  });

  it('el agrupamiento acústico es total y dos entornos del mismo grupo cuestan cero', () => {
    const groups = new Set<string>();
    for (const environment of ACOUSTIC_ENVIRONMENTS) {
      const group = ACOUSTIC_ENVIRONMENT_GROUP[environment];
      expect(typeof group).toBe('string');
      expect(group.length).toBeGreaterThan(0);
      groups.add(group);
    }
    expect(groups.size).toBe(7);

    const base: PresetMatrix = {
      environment: 'cathedral',
      content: 'music',
      emotion: 'reverent',
      spatialComplexity: 'rich',
      hapticIntensity: 'moderate',
    };
    // jazz_club y broadcast_studio comparten grupo (indoor_small): el eje de entorno cuesta 0.
    expect(
      matrixDistance({ ...base, environment: 'jazz_club' }, { ...base, environment: 'broadcast_studio' })
    ).toBe(0);
    // concert_hall (indoor_large) es adyacente a indoor_vast: medio eje ponderado.
    expect(matrixDistance(base, { ...base, environment: 'concert_hall' })).toBeCloseTo(0.25 * 0.5, 6);
    // vr_space (synthetic) no es vecino de indoor_vast: el eje completo.
    expect(matrixDistance(base, { ...base, environment: 'vr_space' })).toBeCloseTo(0.25, 6);
    expect(matrixDistance(base, { ...base, environment: 'amphitheater' })).toBeCloseTo(0.25, 6);
  });
});

describe('TAMV presets · distancia y selección', () => {
  it('la distancia es nula consigo misma, simétrica y acotada en 0..1', () => {
    const samples = [
      matrixOf(),
      matrixOf({ transientDensityPerSecond: 0, spectralFlatness: 0.9 }),
      matrixOf({ stereoCorrelation: 0.1, spectralCentroidHz: 900 }),
    ];
    for (const a of samples) {
      expect(matrixDistance(a, a)).toBe(0);
      for (const b of samples) {
        const distance = matrixDistance(a, b);
        expect(distance).toBeCloseTo(matrixDistance(b, a), 10);
        expect(distance).toBeGreaterThanOrEqual(0);
        expect(distance).toBeLessThanOrEqual(1);
      }
    }
  });

  it('un contenido desconocido penaliza medio eje, no el eje entero', () => {
    const base: PresetMatrix = {
      environment: 'cathedral',
      content: 'music',
      emotion: 'reverent',
      spatialComplexity: 'rich',
      hapticIntensity: 'moderate',
    };
    const lost: PresetMatrix = { ...base, content: 'unknown' };
    const opposite: PresetMatrix = { ...base, content: 'dialogue' };
    expect(matrixDistance(lost, base)).toBeLessThan(matrixDistance(opposite, base));
    expect(matrixDistance(lost, base)).toBeCloseTo(0.3 * 0.5, 6);
    expect(matrixDistance(opposite, base)).toBeCloseTo(0.3, 6);
  });

  it('la selección devuelve siempre un mínimo global y es reproducible', () => {
    for (const target of [matrixOf(), matrixOf({ transientDensityPerSecond: 0, voiceBandDominance: 0.6 })]) {
      const chosen = selectClosestFactoryPreset(target);
      const chosenDistance = matrixDistance(target, chosen.matrix);
      for (const candidate of TAMV_FACTORY_PRESETS) {
        expect(matrixDistance(target, candidate.matrix)).toBeGreaterThanOrEqual(chosenDistance - 1e-12);
      }
      expect(selectClosestFactoryPreset(target).presetId).toBe(chosen.presetId);
    }
  });

  it('al pedir su propia matriz, cada preset gana o empata a distancia cero', () => {
    for (const preset of TAMV_FACTORY_PRESETS) {
      expect(matrixDistance(selectClosestFactoryPreset(preset.matrix).matrix, preset.matrix)).toBe(0);
    }
  });
});

describe('TAMV presets · validación de entrada externa', () => {
  const valid: PresetMatrix = {
    environment: 'cathedral',
    content: 'music',
    emotion: 'reverent',
    spatialComplexity: 'rich',
    hapticIntensity: 'moderate',
  };

  it('acepta una matriz completa y la normaliza', () => {
    expect(parsePresetMatrix(valid)).toEqual({ matrix: valid });
  });

  it('rechaza eje por eje con códigos estables', () => {
    expect(parsePresetMatrix(null)).toEqual({ error: 'TAMV_MATRIX_REQUIRED' });
    expect(parsePresetMatrix('cathedral')).toEqual({ error: 'TAMV_MATRIX_REQUIRED' });
    expect(parsePresetMatrix({ ...valid, environment: 'discoteca' })).toEqual({
      error: 'TAMV_MATRIX_ENVIRONMENT_INVALID',
    });
    expect(parsePresetMatrix({ ...valid, content: 42 })).toEqual({ error: 'TAMV_MATRIX_CONTENT_INVALID' });
    expect(parsePresetMatrix({ ...valid, emotion: 'gris' })).toEqual({ error: 'TAMV_MATRIX_EMOTION_INVALID' });
    expect(parsePresetMatrix({ ...valid, spatialComplexity: 'x' })).toEqual({
      error: 'TAMV_MATRIX_SPATIAL_COMPLEXITY_INVALID',
    });
    expect(parsePresetMatrix({ ...valid, hapticIntensity: 'extremo' })).toEqual({
      error: 'TAMV_MATRIX_HAPTIC_INTENSITY_INVALID',
    });
  });

  it('no deja pasar claves extra como si fueran válidas: se ignoran, no se copian', () => {
    const parsed = parsePresetMatrix({ ...valid, injected: { danger: true } });
    expect(parsed).toEqual({ matrix: valid });
  });
});
