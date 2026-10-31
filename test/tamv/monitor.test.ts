// state: draft | engine-generated — pruebas del monitor gobernado del motor TAMV.
import { describe, expect, it } from 'vitest';
import { MONITOR_THRESHOLDS, readMonitor } from '../../src/tamv/monitor';
import { ALERT_LEVELS, MONITOR_METRICS, type MonitorReading } from '../../src/tamv/types';
import { FIX_RATE, analysisOf, monoWav, stereoWav, tone } from './fixtures';

const HARDWARE_METRICS = ['cpu_temperature', 'gpu_utilization', 'haptic_sync_error', 'spatial_accuracy'];

function readingOf(report: ReturnType<typeof readMonitor>, metric: string): MonitorReading {
  const found = report.readings.find((item) => item.metric === metric);
  if (!found) throw new Error(`lectura ausente: ${metric}`);
  return found;
}

function levelRank(level: MonitorReading['level']): number {
  return ALERT_LEVELS.indexOf(level);
}

describe('TAMV monitor · sin análisis no hay nada que leer', () => {
  const report = readMonitor(null);

  it('cubre las diez métricas del documento y no mide ninguna', () => {
    expect(report.readings.map((item) => item.metric).sort()).toEqual([...MONITOR_METRICS].sort());
    expect(report.measuredCount).toBe(0);
    expect(report.unmeasuredCount).toBe(10);
    expect(report.highestLevel).toBe('ERROR');
    expect(report.analysisId).toBeNull();
  });

  it('las seis lecturas computables se marcan ERROR con motivo, no con un número inventado', () => {
    for (const metric of MONITOR_METRICS.filter((item) => !HARDWARE_METRICS.includes(item))) {
      const reading = readingOf(report, metric);
      expect(reading.level).toBe('ERROR');
      expect(reading.measured).toBe(false);
      expect(reading.value).toBeNull();
      expect(reading.reason).toContain('No hay análisis previo');
    }
  });

  it('es un instante con marca de tiempo parseable', () => {
    expect(Number.isNaN(Date.parse(report.createdAt))).toBe(false);
  });
});

describe('TAMV monitor · sobre análisis real', () => {
  const analysis = analysisOf(monoWav(tone(600, 0.3)));
  const report = readMonitor(analysis);

  it('mide cinco en mono y declara las cuatro de hardware como no medibles', () => {
    expect(report.readings).toHaveLength(10);
    // En mono no hay par de canales: `stereo_phase_coherence` se suma a las no medidas.
    expect(report.measuredCount).toBe(5);
    expect(report.unmeasuredCount).toBe(5);
    expect(report.analysisId).toBe(analysis.analysisId);
    for (const metric of HARDWARE_METRICS) {
      const reading = readingOf(report, metric);
      expect(reading.measured).toBe(false);
      expect(reading.value).toBeNull();
      expect(reading.threshold).toBeNull();
      expect(reading.reason!.length).toBeGreaterThan(10);
      expect(reading.autoCorrectable).toBe(false);
    }
  });

  it('con dos canales computables el monitor llega a las seis lecturas reales', () => {
    const stereo = readMonitor(analysisOf(stereoWav(tone(440, 0.2), tone(900, 0.2))));
    expect(stereo.measuredCount).toBe(6);
    expect(stereo.unmeasuredCount).toBe(4);
    expect(stereo.readings.filter((item) => !item.measured).map((item) => item.metric).sort()).toEqual([
      ...HARDWARE_METRICS,
    ]);
  });

  it('el riesgo de clipping se lee del pico medido y se anuncia corregible', () => {
    expect(readingOf(report, 'clipping_risk_db').value).toBeCloseTo(analysis.features.peakDbfs, 2);
    expect(readingOf(report, 'clipping_risk_db').autoCorrectable).toBe(true);
    const loud = readMonitor(analysisOf(monoWav(tone(600, 0.995))));
    expect(readingOf(loud, 'clipping_risk_db').level).toBe('CRITICAL');
  });

  it('una pista mono informa coherencia sin canal en vez de fabricar 1.0', () => {
    const coherence = readingOf(report, 'stereo_phase_coherence');
    expect(coherence.measured).toBe(false);
    expect(coherence.value).toBeNull();
    expect(coherence.reason).toContain('mono');
  });

  it('la latencia y la integridad del decodificado usan las cotas publicadas', () => {
    expect(readingOf(report, 'analysis_latency_ms').level).toBe('INFO');
    expect(readingOf(report, 'analysis_latency_ms').threshold).toBe(MONITOR_THRESHOLDS.analysisLatencyWarnMs);
    const integrity = readingOf(report, 'decode_integrity');
    expect(integrity.value).toBe(analysis.features.frames);
    expect(integrity.threshold).toBe(MONITOR_THRESHOLDS.decodeIntegrityMinFrames);
    expect(integrity.level).toBe('INFO');
  });

  it('un material casi mudo dispara la advertencia de silencio', () => {
    const frames = Math.floor(FIX_RATE * 4);
    const samples = new Float32Array(frames);
    samples.set(tone(440, 0.3, FIX_RATE / 5), 0);
    const mostlySilent = readMonitor(analysisOf(monoWav(samples)));
    const silence = readingOf(mostlySilent, 'silence_ratio');
    expect(silence.value).toBeGreaterThan(MONITOR_THRESHOLDS.silenceWarnRatio);
    expect(silence.level).toBe('WARNING');
    expect(mostlySilent.highestLevel).toBe('WARNING');
  });

  it('un desenfoque geométrico real se mide, no se declara ausente', () => {
    const stereo = readMonitor(analysisOf(stereoWav(tone(440, 0.2), tone(900, 0.2))));
    const coherence = readingOf(stereo, 'stereo_phase_coherence');
    expect(coherence.measured).toBe(true);
    expect(coherence.reason).toBeNull();
    expect(coherence.value).toBeCloseTo(0, 1);
  });

  it('highestLevel es el máximo real entre las lecturas', () => {
    const worst = report.readings.reduce(
      (current, item) => (levelRank(item.level) > levelRank(current) ? item.level : current),
      'INFO' as MonitorReading['level']
    );
    expect(report.highestLevel).toBe(worst);
  });
});
