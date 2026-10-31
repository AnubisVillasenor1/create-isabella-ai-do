import { describe, expect, it } from "vitest";
import {
  ApiError,
  formatAsApiError,
  isAuthorizedBearer,
  normalizeRequestId,
  requireRevenueAccess,
  requireServiceBearer,
} from "../../src/commerce/guards";
import type { AuthContext } from "../../src/commerce/types";

const SERVICE_TOKEN = "service-token-0123456789-abcdefghijklmnop";

function baseContext(overrides: Partial<AuthContext> = {}): AuthContext {
  return {
    userId: "u1",
    workspaceId: "w1",
    role: "owner",
    planCode: "premium",
    subscriptionStatus: "active",
    riskLevel: "low",
    scopes: ["revenue:read"],
    requestId: "req_1",
    ...overrides,
  };
}

function expectCode(fn: () => void, code: string): void {
  try {
    fn();
    expect.unreachable();
  } catch (err) {
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).code).toBe(code);
  }
}

describe("commerce/guards", () => {
  it("permite acceso a ingresos para owner/admin/operator con plan y scoping", () => {
    expect(() => requireRevenueAccess(baseContext(), "revenue:read")).not.toThrow();
    expect(() =>
      requireRevenueAccess(baseContext({ role: "admin", scopes: ["revenue:read", "campaign:write"] }), "campaign:write"),
    ).not.toThrow();
  });

  it("exige plan PREMIUM o superior", () => {
    expectCode(() => requireRevenueAccess(baseContext({ planCode: "free" }), "revenue:read"), "PREMIUM_REQUIRED");
  });

  it("exige rol permitido", () => {
    expectCode(() => requireRevenueAccess(baseContext({ role: "viewer" }), "revenue:read"), "ROLE_NOT_ALLOWED");
  });

  it("exige scoping", () => {
    expectCode(() => requireRevenueAccess(baseContext({ scopes: ["profile:read"] }), "revenue:write"), "SCOPE_REQUIRED");
  });

  it("bloquea cuentas en revisión crítica", () => {
    expectCode(() => requireRevenueAccess(baseContext({ riskLevel: "critical" }), "revenue:read"), "ACCOUNT_REVIEW_REQUIRED");
  });

  it("exige contexto autenticado", () => {
    expectCode(() => requireRevenueAccess(undefined, "revenue:read"), "UNAUTHENTICATED");
  });

  it("los errores usan la forma {error:{code,message,request_id,retryable,timestamp}}", () => {
    try {
      requireRevenueAccess(baseContext({ planCode: "free" }), "revenue:read");
      expect.unreachable();
    } catch (err) {
      const shape = formatAsApiError(err as Error, "req_1");
      expect(shape.error.code).toBe("PREMIUM_REQUIRED");
      expect(shape.error.request_id).toBe("req_1");
      expect(shape.error.retryable).toBe(false);
      expect(shape.error.timestamp).toBeTruthy();
    }
  });

  it("no expone trazos de errores internos verificables", () => {
    const shape = formatAsApiError(new Error("token jwt_secret"), "req_x");
    expect(shape.error.code).toBe("INTERNAL");
    expect(shape.error.message).not.toContain("jwt_secret");
  });

  it("valida bearer de servicio", () => {
    expect(isAuthorizedBearer(`Bearer ${SERVICE_TOKEN}`, SERVICE_TOKEN)).toBe("AUTHORIZED");
    expect(isAuthorizedBearer("Bearer wrong", SERVICE_TOKEN)).toBe("INVALID");
    expect(isAuthorizedBearer(`Bearer ${SERVICE_TOKEN}`, undefined)).toBe("NOT_CONFIGURED");
    expect(() => requireServiceBearer("INVALID", "req_1")).toThrowError(ApiError);
    expectCode(() => requireServiceBearer("INVALID", "req_1"), "UNAUTHORIZED");
    expectCode(() => requireServiceBearer("NOT_CONFIGURED", "req_1"), "SERVICE_AUTH_NOT_CONFIGURED");
  });

  it("normaliza request id limitando su longitud", () => {
    expect(normalizeRequestId("abc", "fallback")).toBe("abc");
    expect(normalizeRequestId(undefined, "fallback")).toBe("fallback");
    expect(normalizeRequestId("x".repeat(200), "fallback")).toBe("fallback");
  });
});