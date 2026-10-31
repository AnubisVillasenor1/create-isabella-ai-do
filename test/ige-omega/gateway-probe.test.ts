import { describe, expect, it, vi } from "vitest";
import { probeIgeOmegaGateway } from "../../src/ige-omega/gateway-probe";

describe("IGE-OMEGA gateway health/readiness probe", () => {
  it("reports NOT_CONFIGURED without making a network request", async () => {
    const fetcher = vi.fn();
    const result = await probeIgeOmegaGateway({}, fetcher as unknown as typeof fetch);
    expect(result.status).toBe("NOT_CONFIGURED");
    expect(result.configured).toBe(false);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("requires both the public health contract and database readiness", async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ status: "ok", system: "IGE-OMEGA" }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ status: "ready", database: "reachable" }), { status: 200 }));
    const result = await probeIgeOmegaGateway({
      IGE_OMEGA_GATEWAY_URL: "http://127.0.0.1:8080",
      NODE_ENV: "test",
    }, fetcher as unknown as typeof fetch);
    expect(result.status).toBe("HEALTHY");
    expect(result.healthHttpStatus).toBe(200);
    expect(result.readinessHttpStatus).toBe(200);
    expect(result.integrationScope).toBe("health-readiness-probe-only");
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("does not declare healthy when the database-backed ready endpoint is unavailable", async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ status: "ok", system: "IGE-OMEGA" }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: "unavailable" }), { status: 503 }));
    const result = await probeIgeOmegaGateway({
      IGE_OMEGA_GATEWAY_URL: "http://localhost:8080/",
      NODE_ENV: "test",
    }, fetcher as unknown as typeof fetch);
    expect(result.status).toBe("DEGRADED");
    expect(result.readinessHttpStatus).toBe(503);
  });

  it("rejects insecure non-local HTTP URLs in production", async () => {
    const fetcher = vi.fn();
    const result = await probeIgeOmegaGateway({
      IGE_OMEGA_GATEWAY_URL: "http://gateway.example.com",
      NODE_ENV: "production",
    }, fetcher as unknown as typeof fetch);
    expect(result.status).toBe("DEGRADED");
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("rejects credentials, query strings and fragments in gateway URLs", async () => {
    const fetcher = vi.fn();
    const result = await probeIgeOmegaGateway({
      IGE_OMEGA_GATEWAY_URL: "https://user:pass@gateway.example.com?token=secret",
      NODE_ENV: "test",
    }, fetcher as unknown as typeof fetch);
    expect(result.status).toBe("DEGRADED");
    expect(result.reason).not.toContain("secret");
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("fails closed when the gateway health response exceeds the byte budget", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response("x".repeat(2_049), { status: 200 }));
    const result = await probeIgeOmegaGateway({
      IGE_OMEGA_GATEWAY_URL: "http://localhost:8080",
      NODE_ENV: "test",
    }, fetcher as unknown as typeof fetch);
    expect(result.status).toBe("DEGRADED");
    expect(result.reason).not.toContain("BODY_TOO_LARGE");
  });

  it("fails closed on malformed health JSON without leaking the response body", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response("private-secret-not-json", { status: 200 }));
    const result = await probeIgeOmegaGateway({
      IGE_OMEGA_GATEWAY_URL: "http://localhost:8080",
      NODE_ENV: "test",
    }, fetcher as unknown as typeof fetch);
    expect(result.status).toBe("DEGRADED");
    expect(result.reason).not.toContain("private-secret-not-json");
  });

  it("sanitizes network failures without exposing raw exception details", async () => {
    const fetcher = vi.fn().mockRejectedValue(new Error("private endpoint secret"));
    const result = await probeIgeOmegaGateway({
      IGE_OMEGA_GATEWAY_URL: "https://gateway.example.com",
      NODE_ENV: "test",
      IGE_OMEGA_GATEWAY_TIMEOUT_MS: "999999",
    }, fetcher as unknown as typeof fetch);
    expect(result.status).toBe("DEGRADED");
    expect(result.reason).not.toContain("private endpoint secret");
  });
});
