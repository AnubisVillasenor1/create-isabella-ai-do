/** Identidad de correlación y trazabilidad (INGRESS — correlation / trace identity). */

export interface TraceContext {
  traceId: string;
  requestId: string;
  spans: Array<{ stage: string; startedAt: string; durationMs: number }>;
}

export function createTraceContext(traceId: string, requestId: string): TraceContext {
  return { traceId, requestId, spans: [] };
}

export function beginSpan(ctx: TraceContext, stage: string): { end: (durationMs?: number) => void } {
  const startedAt = new Date();
  let closed = false;
  return {
    end(durationMs?: number) {
      if (closed) {
        return;
      }
      closed = true;
      const ms = durationMs ?? Date.now() - startedAt.getTime();
      ctx.spans.push({ stage, startedAt: startedAt.toISOString(), durationMs: ms });
    },
  };
}

export function isTraceWellFormed(traceId: string): boolean {
  return /^[0-9a-fA-F-]{8,64}$/.test(traceId);
}

export function propagateTrace(header: string | undefined, fallback?: string): string {
  const source = header && isTraceWellFormed(header) ? header : fallback;
  return source ?? crypto.randomUUID();
}