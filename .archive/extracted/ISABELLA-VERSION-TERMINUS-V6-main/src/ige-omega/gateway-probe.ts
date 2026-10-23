export type IgeOmegaGatewayStatus = "HEALTHY" | "DEGRADED" | "NOT_CONFIGURED";

export interface IgeOmegaGatewayProbe {
  status: IgeOmegaGatewayStatus;
  configured: boolean;
  healthHttpStatus: number | null;
  readinessHttpStatus: number | null;
  reason: string;
  integrationScope: "health-readiness-probe-only";
}

type FetchLike = typeof fetch;

const MAX_TIMEOUT_MS = 5_000;
const MAX_PROBE_BODY_BYTES = 2_048;
const DEFAULT_TIMEOUT_MS = 1_500;

function safeBaseUrl(raw: string, production: boolean): URL | null {
  try {
    const url = new URL(raw);
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.search || url.hash) return null;
    const localHost = ["localhost", "127.0.0.1", "::1"].includes(url.hostname);
    if (production && url.protocol !== "https:" && !localHost) return null;
    url.pathname = url.pathname.endsWith("/") ? url.pathname : `${url.pathname}/`;
    return url;
  } catch {
    return null;
  }
}

async function readProbeJson(response: Response): Promise<Record<string, unknown>> {
  const declaredLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_PROBE_BODY_BYTES) {
    throw new Error("IGE_OMEGA_PROBE_BODY_TOO_LARGE");
  }
  const body = await response.text();
  if (new TextEncoder().encode(body).byteLength > MAX_PROBE_BODY_BYTES) {
    throw new Error("IGE_OMEGA_PROBE_BODY_TOO_LARGE");
  }
  let parsed: unknown;
  try { parsed = JSON.parse(body); }
  catch { throw new Error("IGE_OMEGA_PROBE_INVALID_JSON"); }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("IGE_OMEGA_PROBE_INVALID_JSON");
  }
  return parsed as Record<string, unknown>;
}

function timeoutFrom(env: NodeJS.ProcessEnv): number {
  const raw = env.IGE_OMEGA_GATEWAY_TIMEOUT_MS?.trim();
  if (!raw) return DEFAULT_TIMEOUT_MS;
  const value = Number(raw);
  return Number.isInteger(value) && value >= 100 && value <= MAX_TIMEOUT_MS
    ? value
    : DEFAULT_TIMEOUT_MS;
}

/**
 * Probes the optional Rust gateway without sending user content or bearer tokens.
 * This verifies only public health/readiness, not authenticated inference wiring.
 */
export async function probeIgeOmegaGateway(
  env: NodeJS.ProcessEnv = process.env,
  fetchImpl: FetchLike = fetch,
): Promise<IgeOmegaGatewayProbe> {
  const raw = env.IGE_OMEGA_GATEWAY_URL?.trim();
  if (!raw) {
    return {
      status: "NOT_CONFIGURED",
      configured: false,
      healthHttpStatus: null,
      readinessHttpStatus: null,
      reason: "IGE_OMEGA_GATEWAY_URL is not configured.",
      integrationScope: "health-readiness-probe-only",
    };
  }

  const baseUrl = safeBaseUrl(raw, env.NODE_ENV === "production");
  if (!baseUrl) {
    return {
      status: "DEGRADED",
      configured: true,
      healthHttpStatus: null,
      readinessHttpStatus: null,
      reason: "Gateway URL failed protocol or URL-safety validation.",
      integrationScope: "health-readiness-probe-only",
    };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutFrom(env));
  let healthHttpStatus: number | null = null;
  let readinessHttpStatus: number | null = null;
  try {
    const healthResponse = await fetchImpl(new URL("health", baseUrl), {
      method: "GET",
      headers: { accept: "application/json" },
      signal: controller.signal,
    });
    healthHttpStatus = healthResponse.status;
    if (!healthResponse.ok) {
      return {
        status: "DEGRADED",
        configured: true,
        healthHttpStatus,
        readinessHttpStatus,
        reason: "Gateway health endpoint returned a non-success status.",
        integrationScope: "health-readiness-probe-only",
      };
    }
    const health = await readProbeJson(healthResponse);
    if (health.status !== "ok" || health.system !== "IGE-OMEGA") {
      return {
        status: "DEGRADED",
        configured: true,
        healthHttpStatus,
        readinessHttpStatus,
        reason: "Gateway health response did not match the IGE-OMEGA contract.",
        integrationScope: "health-readiness-probe-only",
      };
    }

    const readyResponse = await fetchImpl(new URL("ready", baseUrl), {
      method: "GET",
      headers: { accept: "application/json" },
      signal: controller.signal,
    });
    readinessHttpStatus = readyResponse.status;
    if (!readyResponse.ok) {
      return {
        status: "DEGRADED",
        configured: true,
        healthHttpStatus,
        readinessHttpStatus,
        reason: "Gateway readiness endpoint is unavailable.",
        integrationScope: "health-readiness-probe-only",
      };
    }
    const readiness = await readProbeJson(readyResponse);
    if (readiness.status !== "ready" || readiness.database !== "reachable") {
      return {
        status: "DEGRADED",
        configured: true,
        healthHttpStatus,
        readinessHttpStatus,
        reason: "Gateway readiness response did not confirm database reachability.",
        integrationScope: "health-readiness-probe-only",
      };
    }
    return {
      status: "HEALTHY",
      configured: true,
      healthHttpStatus,
      readinessHttpStatus,
      reason: "Public health and readiness probes passed; authenticated inference bridging is not verified.",
      integrationScope: "health-readiness-probe-only",
    };
  } catch {
    return {
      status: "DEGRADED",
      configured: true,
      healthHttpStatus,
      readinessHttpStatus,
      reason: "Gateway health/readiness probe failed or timed out.",
      integrationScope: "health-readiness-probe-only",
    };
  } finally {
    clearTimeout(timer);
  }
}
