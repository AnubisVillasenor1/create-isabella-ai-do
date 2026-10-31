// state: draft | engine-generated — pruebas de medición y clasificación TAMV.
import { describe, expect, it } from 'vitest';
import {
  BAND_BOUNDS,
  CLASSIFIER_THRESHOLDS,
  classifyContent,
  computeAudioFeatures,
  deriveEmotionalProfile,
  deriveSpatialComplexity,
  headroomDb,
} from '../../src/tamv/analysis';
import { TAMV_CLASSIFIER_VERSION } from '../../src/tamv/types';
import { analysisOf, features, interleave, monoWav, noise, tone } from './fixtures';

describe('TAMV análisis · sobre WAV real', () => {
  it('mide un tono mono sin inventar geometría estéreo', () => {
    const measured = computeAudioFeatures({
      samples: tone(440, 0.2),
      sampleRate: 22_050,
      channels: 1,
    });
    expect(measured.frames).toBe(22_050);
    expect(measured.durationMs).toBeCloseTo(1000, 0);
    expect(measured.peakDbfs).toBeCloseTo(-13.98, 1);
    expect(measured.rmsDbfs).toBeCloseTo(-17, 1);
    expect(measured.stereoCorrelation).toBeNull();
    expect(measured.sideEnergyProportion).toBeNull();
    expect(measured.midBandRatio).toBeGreaterThan(0.9);
  });

  it('un tono estacionario no registra transitorios (regresión del umbral de flujo)', () => {
    const measured = computeAudioFeatures({ samples: tone(440, 0.4), sampleRate: 22_050, channels: 1 });
    expect(measured.transientCount).toBe(0);
    expect(measured.transientDensityPerSecond).toBe(0);
  });

  it('distingue fase de desacoplamiento por la fracción lateral', () => {
    const inPhase = computeAudioFeatures({
      samples: interleave(tone(300, 0.2), tone(300, 0.2)),
      sampleRate: 22_050,
      channels: 2,
    });
    expect(inPhase.stereoCorrelation).toBeCloseTo(1, 3);
    expect(inPhase.sideEnergyProportion).toBeCloseTo(0, 3);

    const wide = computeAudioFeatures({
      samples: interleave(noise(0.15, 22_050, 11), noise(0.15, 22_050, 97)),
      sampleRate: 22_050,
      channels: 2,
    });
    expect(wide.sideEnergyProportion).toBeGreaterThan(0.3);
    expect(wide.sideEnergyProportion).toBeLessThan(0.7);
  });

  it('acepta un WAV por la ruta completa y deja el invariante en el objeto', () => {
    const analysis = analysisOf(monoWav(tone(220, 0.3)));
    expect(analysis.analysisId).toMatch(/^tamv_[0-9a-f]{16}$/);
    expect(analysis.source.sampleFormat).toBe('pcm');
    expect(analysis.authorizationPerformed).toBe(false);
    expect(analysis.executionPerformed).toBe(false);
    expect(analysis.limitations.length).toBeGreaterThan(0);
    expect(analysis.features.frames).toBe(22_050);
  });

  it('un material más corto que la FFT no divide por cero ni finge un espectro', () => {
    const measured = computeAudioFeatures({
      samples: tone(440, 0.3, 1024),
      sampleRate: 22_050,
      channels: 1,
    });
    expect(measured.spectralCentroidHz).toBe(0);
    expect(measured.spectralFlatness).toBe(0);
    expect(measured.highBandRatio).toBe(0);
    expect(measured.dynamicRangeDb).toBe(0);
    expect(measured.transientCount).toBe(0);
    expect(classifyContent(measured).contentType).toBe('unknown');
  });
});

describe('TAMV análisis · clasificador por reglas', () => {
  it('expone las cuatro etiquetas más unknown con puntajes no negativos', () => {
    const prediction = classifyContent(features());
    expect(prediction.classifierVersion).toBe(TAMV_CLASSIFIER_VERSION);
    expect(Object.keys(prediction.scores).sort()).toEqual(
      ['ambient', 'dialogue', 'music', 'sfx', 'unknown'].sort()
    );
    for (const value of Object.values(prediction.scores)) {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(1);
    }
    expect(prediction.confidence).toBeGreaterThanOrEqual(0);
    expect(prediction.confidence).toBeLessThanOrEqual(1);
  });

  it('reconoce material musical: denso en onsets, tonal y con pausas escasas', () => {
    const prediction = classifyContent(
      features({
        spectralFlatness: 0.05,
        transientDensityPerSecond: 8,
        lowBandRatio: 0.3,
        highBandRatio: 0.25,
        silenceRatio: 0,
        voiceBandDominance: 0.3,
        spectralCentroidHz: 1800,
      })
    );
    expect(prediction.contentType).toBe('music');
    expect(prediction.confidence).toBeGreaterThanOrEqual(CLASSIFIER_THRESHOLDS.minConfidence);
    expect(prediction.scores.music).toBeGreaterThan(prediction.scores.dialogue);
  });

  it('reconoce diálogo: banda de voz saturada, sin golpes y con pausas estructuradas', () => {
    const prediction = classifyContent(
      features({
        voiceBandDominance: 0.55,
        transientDensityPerSecond: 0,
        silenceRatio: 0.3,
        spectralFlatness: 0.2,
        spectralCentroidHz: 1800,
      })
    );
    expect(prediction.contentType).toBe('dialogue');
    expect(prediction.scores.dialogue).toBeGreaterThan(prediction.scores.music);
  });

  it('devuelve unknown cuando ningún perfil domina, en vez de forzar una etiqueta', () => {
    const prediction = classifyContent(features());
    expect(prediction.contentType).toBe('unknown');
    expect(prediction.confidence).toBeLessThan(CLASSIFIER_THRESHOLDS.minConfidence);
  });

  it('rechaza por duración, no por puntaje: un clip corto es unknown con sus puntajes visibles', () => {
    const prediction = classifyContent(features({ durationMs: 120 }));
    expect(prediction.contentType).toBe('unknown');
    expect(prediction.scores.music + prediction.scores.dialogue).toBeGreaterThan(0);
  });

  it('es determinista: el mismo input produce el mismo output byte a byte', () => {
    const input = features({ voiceBandDominance: 0.5 });
    expect(classifyContent(input)).toEqual(classifyContent(input));
  });
});

describe('TAMV análisis · perfil emocional y espacial', () => {
  it('asigna cada emoción por su regla, en el orden declarado', () => {
    expect(deriveEmotionalProfile(features())).toBe('energetic');
    expect(
      deriveEmotionalProfile(features({ transientDensityPerSecond: 1, crestFactorDb: 20, spectralCentroidHz: 3000 }))
    ).toBe('tense');
    expect(
      deriveEmotionalProfile(
        features({ transientDensityPerSecond: 1, crestFactorDb: 10, stereoCorrelation: 0.2, spectralCentroidHz: 1000 })
      )
    ).toBe('expansive');
    expect(
      deriveEmotionalProfile(features({ transientDensityPerSecond: 1, rmsDbfs: -30, dynamicRangeDb: 8 }))
    ).toBe('intimate');
    expect(
      deriveEmotionalProfile(features({ transientDensityPerSecond: 1, lowBandRatio: 0.5, spectralCentroidHz: 900 }))
    ).toBe('warm');
    expect(
      deriveEmotionalProfile(
        features({
          transientDensityPerSecond: 1,
          spectralFlatness: 0.2,
          spectralCentroidHz: 900,
          lowBandRatio: 0.2,
          crestFactorDb: 10,
          rmsDbfs: -20,
          stereoCorrelation: 0.6,
        })
      )
    ).toBe('reverent');
    expect(
      deriveEmotionalProfile(
        features({
          transientDensityPerSecond: 1,
          spectralFlatness: 0.9,
          spectralCentroidHz: 3000,
          lowBandRatio: 0.2,
          crestFactorDb: 10,
          rmsDbfs: -20,
          stereoCorrelation: 0.6,
        })
      )
    ).toBe('neutral');
  });

  it('el material mono nunca se lee como expansivo: null corta la regla', () => {
    expect(deriveEmotionalProfile(features({ stereoCorrelation: null, transientDensityPerSecond: 1 }))).not.toBe(
      'expansive'
    );
  });

  it('la complejidad espacial es monotónica con sus tres ejes', () => {
    expect(deriveSpatialComplexity(features({ spectralFlatness: 0, transientDensityPerSecond: 0, sideEnergyProportion: 0 }))).toBe(
      'minimal'
    );
    expect(deriveSpatialComplexity(features({ spectralFlatness: 0.2, transientDensityPerSecond: 0, sideEnergyProportion: 0.2 }))).toBe(
      'moderate'
    );
    expect(deriveSpatialComplexity(features({ spectralFlatness: 0.5, transientDensityPerSecond: 4, sideEnergyProportion: 0.2 }))).toBe(
      'rich'
    );
    expect(deriveSpatialComplexity(features({ spectralFlatness: 1, transientDensityPerSecond: 8, sideEnergyProportion: 0.4 }))).toBe(
      'dense'
    );
    expect(deriveSpatialComplexity(features({ spectralFlatness: 0, transientDensityPerSecond: 0, sideEnergyProportion: null }))).toBe(
      'minimal'
    );
  });

  it('el margen de clipping se mide contra el techo y se acota', () => {
    expect(headroomDb(features({ peakDbfs: -0.92 }))).toBeCloseTo(0.62, 2);
    // Material muy bajo: margen enorme, recortado a la cota superior.
    expect(headroomDb(features({ peakDbfs: -60 }))).toBe(24);
    // Material ya pasado del techo: margen negativo, sin anularse.
    expect(headroomDb(features({ peakDbfs: 3 }))).toBeCloseTo(-3.3, 2);
    expect(headroomDb(features({ peakDbfs: -1 }), -1)).toBe(0);
  });

  it('las bandas declaradas son las que usa el análisis', () => {
    expect(BAND_BOUNDS.lowHz).toBe(250);
    expect(BAND_BOUNDS.midHighHz).toBe(2000);
    expect(BAND_BOUNDS.voiceLowHz).toBeLessThan(BAND_BOUNDS.voiceHighHz);
    expect(CLASSIFIER_THRESHOLDS.minConfidence).toBeGreaterThan(0.25);
  });
});
