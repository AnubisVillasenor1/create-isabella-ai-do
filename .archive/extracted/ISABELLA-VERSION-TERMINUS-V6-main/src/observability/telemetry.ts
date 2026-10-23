export type MetricName =
  | "request_total"
  | "request_latency_ms"
  | "ttft_ms"
  | "tokens_per_second"
  | "cache_hit"
  | "speculative_acceptance"
  | "policy_denial"
  | "security_block"
  | "memory_recall"
  | "tool_execution";

export interface MetricPoint {
  name: MetricName;
  value: number;
  at: string;
  attributes: Readonly<Record<string, string | number | boolean>>;
}

export interface TraceSpan {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  name: string;
  startedAt: string;
  durationMs: number;
  status: "ok" | "error";
  attributes: Readonly<Record<string, string | number | boolean>>;
}

export interface TelemetrySink {
  metric(point: MetricPoint): void;
  span(span: TraceSpan): void;
}

export class InMemoryTelemetry implements TelemetrySink {
  readonly metrics: MetricPoint[] = [];
  readonly spans: TraceSpan[] = [];

  metric(point: MetricPoint): void { this.metrics.push(Object.freeze({ ...point })); }
  span(span: TraceSpan): void { this.spans.push(Object.freeze({ ...span })); }
}

export function percentile(values: readonly number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[index] ?? 0;
}

export interface SloSnapshot {
  samples: number;
  p50Ms: number;
  p95Ms: number;
  p99Ms: number;
  errorRate: number;
}

export function sloSnapshot(latenciesMs: readonly number[], errors: number): SloSnapshot {
  const samples = latenciesMs.length;
  return {
    samples,
    p50Ms: percentile(latenciesMs, 50),
    p95Ms: percentile(latenciesMs, 95),
    p99Ms: percentile(latenciesMs, 99),
    errorRate: samples === 0 ? 0 : errors / samples,
  };
}
