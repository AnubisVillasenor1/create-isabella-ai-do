export interface IntelligenceMetric {
  providerId: string;
  modelId: string;
  latencyMs: number;
  success: boolean;
  degraded: boolean;
  timestamp: string;
}
const samples: IntelligenceMetric[] = [];
const MAX_SAMPLES = 2000;
export function recordIntelligenceMetric(metric: IntelligenceMetric): void {
  samples.push({ ...metric });
  if (samples.length > MAX_SAMPLES) samples.splice(0, samples.length - MAX_SAMPLES);
}
export function snapshotIntelligenceMetrics(providerId?: string) {
  const filtered = providerId ? samples.filter((s) => s.providerId === providerId) : [...samples];
  const latencies = filtered.map((s) => s.latencyMs).sort((a, b) => a - b);
  const percentile = (p: number) =>
    latencies.length
      ? latencies[Math.min(latencies.length - 1, Math.floor((latencies.length - 1) * p))]
      : 0;
  const failures = filtered.filter((s) => !s.success).length;
  const degraded = filtered.filter((s) => s.degraded).length;
  return {
    sampleCount: filtered.length,
    p50: percentile(0.5),
    p95: percentile(0.95),
    p99: percentile(0.99),
    errorRate: filtered.length ? failures / filtered.length : 0,
    fallbackRate: filtered.length ? degraded / filtered.length : 0,
    realInferenceCount: filtered.filter((s) => s.success && !s.degraded).length,
  };
}
export function resetIntelligenceMetricsForTests(): void {
  samples.length = 0;
}
