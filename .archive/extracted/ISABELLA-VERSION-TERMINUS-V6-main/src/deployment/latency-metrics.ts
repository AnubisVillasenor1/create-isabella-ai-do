import { performance } from "node:perf_hooks";

export interface RouteLatencySummary {
  route: string;
  requests: number;
  sampled: number;
  serverErrors: number;
  p50Ms: number;
  p95Ms: number;
  p99Ms: number;
  maxMs: number;
}

interface Sample {
  durationMs: number;
  statusCode: number;
}

interface RouteBucket {
  samples: Sample[];
  cursor: number;
  total: number;
  serverErrors: number;
}

/**
 * Bounded in-process latency telemetry. Records are O(1); percentile sorting
 * happens only when snapshot() is requested. This is diagnostic, not distributed tracing.
 */
export class LatencyRegistry {
  private readonly routes = new Map<string, RouteBucket>();

  constructor(
    private readonly maxRoutes = 100,
    private readonly samplesPerRoute = 512,
  ) {
    if (!Number.isInteger(maxRoutes) || maxRoutes < 1) throw new Error("LATENCY_MAX_ROUTES_INVALID");
    if (!Number.isInteger(samplesPerRoute) || samplesPerRoute < 8) throw new Error("LATENCY_SAMPLE_CAPACITY_INVALID");
  }

  record(route: string, durationMs: number, statusCode: number): void {
    if (!Number.isFinite(durationMs) || durationMs < 0) return;
    if (!Number.isInteger(statusCode) || statusCode < 100 || statusCode > 599) return;
    const normalized = route.trim().slice(0, 160) || "unknown";
    let bucket = this.routes.get(normalized);
    if (!bucket) {
      // Reserve one bounded bucket for high-cardinality/unmatched routes.
      const key = this.routes.size < this.maxRoutes - 1 ? normalized : "__other__";
      bucket = this.routes.get(key);
      if (!bucket && this.routes.size < this.maxRoutes) {
        bucket = { samples: new Array(this.samplesPerRoute), cursor: 0, total: 0, serverErrors: 0 };
        this.routes.set(key, bucket);
      }
    }
    if (!bucket) return;
    bucket.samples[bucket.cursor] = { durationMs, statusCode };
    bucket.cursor = (bucket.cursor + 1) % this.samplesPerRoute;
    bucket.total += 1;
    if (statusCode >= 500) bucket.serverErrors += 1;
  }

  snapshot(): RouteLatencySummary[] {
    return [...this.routes.entries()].map(([route, bucket]) => {
      const samples = bucket.samples.filter((sample): sample is Sample => sample !== undefined);
      const sorted = samples.map((sample) => sample.durationMs).sort((a, b) => a - b);
      const percentile = (p: number) => sorted.length ? sorted[Math.min(sorted.length - 1, Math.ceil(p * sorted.length) - 1)]! : 0;
      return {
        route,
        requests: bucket.total,
        sampled: samples.length,
        serverErrors: bucket.serverErrors,
        p50Ms: percentile(0.50),
        p95Ms: percentile(0.95),
        p99Ms: percentile(0.99),
        maxMs: sorted.at(-1) ?? 0,
      };
    }).sort((a, b) => b.p95Ms - a.p95Ms);
  }

  static startTimer(): () => number {
    const started = performance.now();
    return () => Math.max(0, performance.now() - started);
  }
}
