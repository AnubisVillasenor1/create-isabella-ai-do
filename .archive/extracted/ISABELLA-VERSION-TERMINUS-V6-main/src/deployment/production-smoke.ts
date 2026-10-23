/**
 * Deployment smoke verification (ISA-371).
 *
 * Verifies a *running* deployment over HTTP — not the source tree. It decodes the
 * public contract that operators and orchestration depend on: liveness, security
 * headers, public health, and both readiness surfaces. It never throws on network
 * failure: an unreachable endpoint is reported as a failed check, not an exception.
 */

export interface DeploymentSmokeCheck {
  name: string;
  ok: boolean;
  status: number;
  detail: string;
}

export interface DeploymentSmokeResult {
  ok: boolean;
  baseUrl: string;
  checks: DeploymentSmokeCheck[];
}



export async function verifyDeployment(baseUrl: string, fetchImpl: typeof fetch = fetch): Promise<DeploymentSmokeResult> {
  const base = baseUrl.replace(/\/+$/, "");

  async function attempt(name: string, path: string, evaluate: (response: Response) => Promise<{ ok: boolean; detail: string }>): Promise<DeploymentSmokeCheck> {
    try {
      const response = await fetchImpl(`${base}${path}`, { signal: AbortSignal.timeout(8_000) });
      const outcome = await evaluate(response);
      return { name, ok: outcome.ok, status: response.status, detail: outcome.detail };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { name, ok: false, status: 0, detail: `${path} could not be reached: ${message}` };
    }
  }

  const checks: DeploymentSmokeCheck[] = [];

  checks.push(
    await attempt("liveness", "/health", async (response) => {
      const body = (await response.json().catch(() => null)) as { status?: unknown } | null;
      return {
        ok: response.status === 200 && body?.status === "healthy",
        detail: "GET /health must report status=healthy with HTTP 200.",
      };
    }),
  );

  checks.push(
    await attempt("security-headers", "/health", async (response) => ({
      ok:
        response.headers.get("x-content-type-options") === "nosniff" &&
        response.headers.get("x-frame-options") === "DENY" &&
        response.headers.get("referrer-policy") === "strict-origin-when-cross-origin",
      detail: "API responses must set MIME, framing and referrer protections.",
    })),
  );

  checks.push(
    await attempt("public-health", "/api/v1/health", async (response) => {
      const body = (await response.json().catch(() => null)) as { inferenceMode?: unknown } | null;
      return {
        ok: response.status === 200 && typeof body?.inferenceMode === "string",
        detail: "GET /api/v1/health must describe inference mode without exposing credentials.",
      };
    }),
  );

  checks.push(
    await attempt("deep-readiness", "/api/v1/healthz", async (response) => {
      const body = (await response.json().catch(() => null)) as { scope?: unknown; evidence?: unknown } | null;
      return {
        ok:
          (response.status === 200 || response.status === 503) &&
          body?.scope === "deep-dependency-readiness" &&
          Array.isArray(body?.evidence),
        detail: "GET /api/v1/healthz must answer 200/503 with deep dependency evidence.",
      };
    }),
  );

  return { ok: checks.every((check) => check.ok), baseUrl: base, checks };
}
