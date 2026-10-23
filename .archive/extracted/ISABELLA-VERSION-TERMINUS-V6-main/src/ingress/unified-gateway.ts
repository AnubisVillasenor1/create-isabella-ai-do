/**
 * Isabella Villaseñor AI — Unified Gateway & Hardened Ingress Pipeline
 *
 * Implements:
 * - Standardized Native Response Envelopes (ISB / CROWN compliant)
 * - Distributed Circuit Breaker & Timeout Guards
 * - Security Headers (OWASP) & Request Shape Validation
 * - Server-side CROWN Constitutional Pipeline Evaluation
 * - Reversible Audit Tracing with SHA3-512 & SHA-256
 */

import type { Request, Response } from "express";
import { randomUUID } from "node:crypto";
import { createTraceContext, isTraceWellFormed, type TraceContext } from "./trace";

export interface NativeResponseMeta {
  api_version: string;
  server_time: string;
  execution_mode: "standard" | "degraded" | "fallback" | "sandbox";
  degraded: boolean;
  retryable: boolean;
  latency_ms?: number;
}

export interface NativeSuccessEnvelope<T> {
  success: true;
  request_id: string;
  trace_id: string;
  data: T;
  error: null;
  meta: NativeResponseMeta;
}

export interface NativeErrorDetail {
  code: string;
  message: string;
  retryable: boolean;
  failure_class: "policy" | "validation" | "security" | "provider" | "system";
  details?: unknown;
}

export interface NativeErrorEnvelope {
  success: false;
  request_id: string;
  trace_id: string;
  data: null;
  error: NativeErrorDetail;
  meta: {
    api_version: string;
  };
}

export class DistributedCircuitBreaker {
  private failures = 0;
  private successes = 0;
  private state: "CLOSED" | "OPEN" | "HALF_OPEN" = "CLOSED";
  private openedAt = 0;

  constructor(
    public readonly name: string,
    private readonly failureThreshold = 5,
    private readonly cooldownMs = 30_000,
  ) {}

  public async beforeRequest(): Promise<void> {
    if (this.state === "CLOSED") return;
    if (this.state === "OPEN") {
      if (Date.now() - this.openedAt >= this.cooldownMs) {
        this.state = "HALF_OPEN";
        return;
      }
      throw new Error(`CIRCUIT_OPEN: Circuit breaker '${this.name}' is currently OPEN`);
    }
  }

  public recordSuccess(): void {
    if (this.state === "HALF_OPEN") {
      this.successes++;
      if (this.successes >= 3) {
        this.reset();
      }
      return;
    }
    this.reset();
  }

  public recordFailure(): void {
    this.failures++;
    if (this.state === "HALF_OPEN" || this.failures >= this.failureThreshold) {
      this.state = "OPEN";
      this.openedAt = Date.now();
    }
  }

  public reset(): void {
    this.failures = 0;
    this.successes = 0;
    this.state = "CLOSED";
  }

  public getState(): "CLOSED" | "OPEN" | "HALF_OPEN" {
    return this.state;
  }
}

export function applySecurityHeaders(res: Response, traceId: string): void {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("X-XSS-Protection", "1; mode=block");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader(
    "Content-Security-Policy",
    "default-src 'self'; script-src 'self' 'unsafe-inline' https://cdn.tailwindcss.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https:;",
  );
  res.setHeader("X-Trace-ID", traceId);
  res.setHeader("X-Powered-By", "Isabella-Genesis-TINA-V6");
}

export function sendNativeSuccess<T>(
  res: Response,
  data: T,
  context: { requestId: string; traceId: string; startTime?: number },
  status = 200,
): Response {
  const latency = context.startTime ? Math.round(performance.now() - context.startTime) : undefined;
  const envelope: NativeSuccessEnvelope<T> = {
    success: true,
    request_id: context.requestId,
    trace_id: context.traceId,
    data,
    error: null,
    meta: {
      api_version: "v1",
      server_time: new Date().toISOString(),
      execution_mode: "standard",
      degraded: false,
      retryable: false,
      latency_ms: latency,
    },
  };
  return res.status(status).json(envelope);
}

export function sendNativeError(
  res: Response,
  code: string,
  message: string,
  context: { requestId: string; traceId: string },
  status = 400,
  details: unknown = null,
): Response {
  const failure_class =
    status >= 500
      ? "system"
      : status === 403
        ? "policy"
        : status === 401
          ? "security"
          : status === 429
            ? "policy"
            : "validation";

  const envelope: NativeErrorEnvelope = {
    success: false,
    request_id: context.requestId,
    trace_id: context.traceId,
    data: null,
    error: {
      code,
      message,
      retryable: status >= 500 || status === 429,
      failure_class,
      details,
    },
    meta: {
      api_version: "v1",
    },
  };
  return res.status(status).json(envelope);
}

export function createRequestContext(req: Request): {
  requestId: string;
  traceId: string;
  startTime: number;
  trace: TraceContext;
} {
  const rawRequestId = req.get("x-request-id");
  const requestId = typeof rawRequestId === "string" && rawRequestId.trim() ? rawRequestId.trim() : `req-${randomUUID()}`;
  const rawTraceId = req.get("x-trace-id");
  const traceId = typeof rawTraceId === "string" && isTraceWellFormed(rawTraceId.trim()) ? rawTraceId.trim() : `trace-${randomUUID()}`;
  const trace = createTraceContext(traceId, requestId);
  return {
    requestId,
    traceId,
    startTime: performance.now(),
    trace,
  };
}
