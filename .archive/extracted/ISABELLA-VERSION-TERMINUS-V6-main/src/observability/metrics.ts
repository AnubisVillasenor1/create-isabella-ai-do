import { createHash } from "node:crypto";

export interface MetricsSnapshot {
  readonly requestCount: number;
  readonly errorCount: number;
  readonly avgResponseTimeMs: number;
  readonly errorRate: number;
  readonly memoryUsageBytes: number;
  readonly memoryUsageMb: number;
  readonly p50ResponseTimeMs: number;
  readonly p95ResponseTimeMs: number;
  readonly uptimeMs: number;
  readonly collectedAt: string;
}

export interface RecordRequestOptions {
  readonly route?: string;
  readonly method?: string;
}

const DEFAULT_LATENCY_WINDOW = 1000;

export class MetricsRegistry {
  private requestCount = 0;
  private errorCount = 0;
  private readonly latencies: number[] = [];
  private readonly startedAt = Date.now();
  private readonly latencyWindowSize: number;

  constructor(latencyWindowSize = DEFAULT_LATENCY_WINDOW) {
    if (!Number.isInteger(latencyWindowSize) || latencyWindowSize < 100 || latencyWindowSize > 100_000) {
      throw new Error("METRICS: latencyWindowSize must be an integer between 100 and 100000");
    }
    this.latencyWindowSize = latencyWindowSize;
  }

  recordRequest(elapsedMs: number, options: RecordRequestOptions = {}): void {
    if (typeof elapsedMs !== "number" || !Number.isFinite(elapsedMs) || elapsedMs < 0) return;
    this.requestCount += 1;
    this.latencies.push(elapsedMs);
    if (this.latencies.length > this.latencyWindowSize) {
      this.latencies.splice(0, this.latencies.length - this.latencyWindowSize);
    }
    void options;
  }

  recordError(): void {
    this.errorCount += 1;
  }

  getSnapshot(): MetricsSnapshot {
    const total = this.latencies.length;
    const avg = total === 0 ? 0 : this.latencies.reduce((sum, value) => sum + value, 0) / total;
    const sorted = [...this.latencies].sort((a, b) => a - b);
    const memory = process.memoryUsage();
    const heapTotal = memory.heapTotal ?? 0;
    const memoryUsageBytes = heapTotal;
    return Object.freeze({
      requestCount: this.requestCount,
      errorCount: this.errorCount,
      avgResponseTimeMs: Number(avg.toFixed(2)),
      errorRate: this.requestCount === 0 ? 0 : Number((this.errorCount / this.requestCount).toFixed(4)),
      memoryUsageBytes,
      memoryUsageMb: Number((memoryUsageBytes / (1024 * 1024)).toFixed(2)),
      p50ResponseTimeMs: Number(percentile(sorted, 50).toFixed(2)),
      p95ResponseTimeMs: Number(percentile(sorted, 95).toFixed(2)),
      uptimeMs: Date.now() - this.startedAt,
      collectedAt: new Date().toISOString(),
    });
  }
}

export function createMetricsSnapshotHash(snapshot: MetricsSnapshot): string {
  return createHash("sha256").update(JSON.stringify(snapshot)).digest("hex").slice(0, 12);
}

function percentile(sortedValues: readonly number[], p: number): number {
  if (sortedValues.length === 0) return 0;
  const index = Math.min(sortedValues.length - 1, Math.max(0, Math.ceil((p / 100) * sortedValues.length) - 1));
  return sortedValues[index] ?? 0;
}
