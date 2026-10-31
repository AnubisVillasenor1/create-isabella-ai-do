/**
 * state: draft | engine-generated — TAMV Kaos Audio System: diagnóstico gobernado.
 *
 * Copyright (c) 2026 TAMV ONLINE ENTERPRISE — Edwin Oswaldo Castillo Trejo (Anubis Villaseñor).
 *
 * El monitor del documento especifica cuatro lecturas de hardware (temperatura de CPU, uso de
 * GPU, error de sincronía háptica, precisión espacial). Un Node serverless no puede leerlas:
 * aquí se devuelven con `measured: false` y su motivo, en lugar de un número inventado que
 * alguien confundaría con telemetría real. De las seis lecturas restantes se calculan hasta seis:
 * en material mono `stereo_phase_coherence` también se declara no medida, porque no existe el par
 * de canales que correlacionar.
 */
import { round } from '../ivcc/util';
import {
  ALERT_LEVELS,
  type AlertLevel,
  type MonitorMetric,
  type MonitorReading,
  type TamvAnalysis,
  type TamvMonitorReport,
} from './types';

export const MONITOR_THRESHOLDS = Object.freeze({
  analysisLatencyWarnMs: 1_500,
  analysisLatencyCriticalMs: 8_000,
  decodeIntegrityMinFrames: 2_048,
  clippingWarnDb: 0,
  phaseCoherenceMin: 0.5,
  centroidWarnHz: 15_000,
  silenceWarnRatio: 0.85,
} as const);

const UNMEASURED: Readonly<Record<string, { unit: string; reason: string }>> = Object.freeze({
  cpu_temperature: {
    unit: '°C',
    reason: 'Sin acceso a sensores térmicos desde una Function serverless de Node.',
  },
  gpu_utilization: {
    unit: 'percent',
    reason: 'El runtime no expone contadores GPU; este motor no usa GPU.',
  },
  haptic_sync_error: {
    unit: 'ms',
    reason: 'No hay actuador háptico conectado al proceso que pueda reportar desfase.',
  },
  spatial_accuracy: {
    unit: 'ratio',
    reason: 'Exige un medidor de localización con oyente/sonda; no existe en este runtime.',
  },
});

function levelFor(value: number, warn: number, critical: number, higherIsWorse = true): AlertLevel {
  const breach = higherIsWorse ? value >= critical : value <= critical;
  if (breach) return 'CRITICAL';
  return higherIsWorse ? (value >= warn ? 'WARNING' : 'INFO') : value <= warn ? 'WARNING' : 'INFO';
}

export function readMonitor(analysis: TamvAnalysis | null): TamvMonitorReport {
  const readings: MonitorReading[] = [];
  const pushUnmeasured = (metric: MonitorMetric): void => {
    const meta = UNMEASURED[metric];
    readings.push({
      metric,
      level: 'INFO',
      measured: false,
      value: null,
      unit: meta?.unit ?? 'unknown',
      threshold: null,
      reason: meta?.reason ?? 'Métrica no computable en este runtime.',
      autoCorrectable: false,
    });
  };

  if (analysis === null) {
    for (const metric of [
      'analysis_latency_ms',
      'decode_integrity',
      'clipping_risk_db',
      'stereo_phase_coherence',
      'spectral_centroid_hz',
      'silence_ratio',
    ] as const) {
      readings.push({
        metric,
        level: 'ERROR',
        measured: false,
        value: null,
        unit:
          metric === 'silence_ratio' || metric === 'stereo_phase_coherence' ? 'ratio' : 'unknown',
        threshold: null,
        reason: 'No hay análisis previo: el monitor no tiene nada que leer.',
        autoCorrectable: false,
      });
    }
    for (const metric of Object.keys(UNMEASURED) as MonitorMetric[]) pushUnmeasured(metric);
    return {
      createdAt: new Date().toISOString(),
      analysisId: null,
      readings,
      highestLevel: 'ERROR',
      measuredCount: 0,
      unmeasuredCount: readings.length,
    };
  }

  const features = analysis.features;

  readings.push({
    metric: 'analysis_latency_ms',
    level: levelFor(
      analysis.analysisLatencyMs,
      MONITOR_THRESHOLDS.analysisLatencyWarnMs,
      MONITOR_THRESHOLDS.analysisLatencyCriticalMs
    ),
    measured: true,
    value: round(analysis.analysisLatencyMs, 2),
    unit: 'ms',
    threshold: MONITOR_THRESHOLDS.analysisLatencyWarnMs,
    reason: null,
    autoCorrectable: false,
  });

  readings.push({
    metric: 'decode_integrity',
    level: features.frames >= MONITOR_THRESHOLDS.decodeIntegrityMinFrames ? 'INFO' : 'ERROR',
    measured: true,
    value: features.frames,
    unit: 'samples',
    threshold: MONITOR_THRESHOLDS.decodeIntegrityMinFrames,
    reason: null,
    autoCorrectable: false,
  });

  // Lectura directa del pico medido: cercanía al techo en dBFS.
  const peakDbfs = features.peakDbfs;
  readings.push({
    metric: 'clipping_risk_db',
    level:
      peakDbfs > -0.1
        ? 'CRITICAL'
        : peakDbfs >= MONITOR_THRESHOLDS.clippingWarnDb - 3
          ? 'WARNING'
          : 'INFO',
    measured: true,
    value: round(peakDbfs, 2),
    unit: 'dBFS',
    threshold: MONITOR_THRESHOLDS.clippingWarnDb,
    reason: null,
    autoCorrectable: true,
  });

  readings.push({
    metric: 'stereo_phase_coherence',
    level:
      features.stereoCorrelation === null
        ? 'INFO'
        : levelFor(features.stereoCorrelation, MONITOR_THRESHOLDS.phaseCoherenceMin, 0.1, false),
    measured: features.stereoCorrelation !== null,
    value: features.stereoCorrelation,
    unit: 'ratio',
    threshold: MONITOR_THRESHOLDS.phaseCoherenceMin,
    reason:
      features.stereoCorrelation === null
        ? 'Material mono: no hay par de canales que correlacionar.'
        : null,
    autoCorrectable: false,
  });

  readings.push({
    metric: 'spectral_centroid_hz',
    level: levelFor(features.spectralCentroidHz, MONITOR_THRESHOLDS.centroidWarnHz, 20_000),
    measured: true,
    value: features.spectralCentroidHz,
    unit: 'Hz',
    threshold: MONITOR_THRESHOLDS.centroidWarnHz,
    reason: null,
    autoCorrectable: false,
  });

  readings.push({
    metric: 'silence_ratio',
    level: features.silenceRatio >= MONITOR_THRESHOLDS.silenceWarnRatio ? 'WARNING' : 'INFO',
    measured: true,
    value: features.silenceRatio,
    unit: 'ratio',
    threshold: MONITOR_THRESHOLDS.silenceWarnRatio,
    reason: null,
    autoCorrectable: false,
  });

  for (const metric of Object.keys(UNMEASURED) as MonitorMetric[]) pushUnmeasured(metric);

  const rank = (level: AlertLevel): number => ALERT_LEVELS.indexOf(level);
  const highest = readings.reduce<AlertLevel | null>(
    (current, item) =>
      current === null || rank(item.level) > rank(current) ? item.level : current,
    null
  );

  return {
    createdAt: new Date().toISOString(),
    analysisId: analysis.analysisId,
    readings,
    highestLevel: highest,
    measuredCount: readings.filter((item) => item.measured).length,
    unmeasuredCount: readings.filter((item) => !item.measured).length,
  };
}
