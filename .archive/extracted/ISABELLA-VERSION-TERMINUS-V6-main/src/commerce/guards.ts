/** COMMERCE — guards de API: autenticación de servicio, acceso por rol/scoping y errores tipados. */

import { verifyBearerToken, type ApiTokenVerdict } from "../security/api-token";
import type { AuthContext, WorkspaceRole } from "./types";

export interface ApiErrorShape {
  error: {
    code: string;
    message: string;
    request_id: string;
    retryable: boolean;
    timestamp: string;
  };
}

export class ApiError extends Error {
  readonly code: string;
  readonly requestId: string;
  readonly retryable: boolean;
  readonly timestamp: string;
  readonly status: number;

  constructor(code: string, message: string, status: number, requestId: string, retryable = false) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
    this.requestId = requestId;
    this.retryable = retryable;
    this.timestamp = new Date().toISOString();
  }

  toShape(): ApiErrorShape {
    return {
      error: {
        code: this.code,
        message: this.message,
        request_id: this.requestId,
        retryable: this.retryable,
        timestamp: this.timestamp,
      },
    };
  }
}

export function formatAsApiError(
  err: Error,
  requestId: string,
  fallbackCode = "INTERNAL",
  _fallbackStatus = 500,
  retryable = false,
): ApiErrorShape {
  if (err instanceof ApiError) return err.toShape();
  return {
    error: {
      code: fallbackCode,
      message: "Error interno; no se exponen trazos ni secretos.",
      request_id: requestId,
      retryable,
      timestamp: new Date().toISOString(),
    },
  };
}

export function isAuthorizedBearer(
  authorizationHeader: string | undefined,
  expectedToken: string | undefined,
): ApiTokenVerdict {
  return verifyBearerToken(authorizationHeader, expectedToken);
}

export function requireServiceBearer(
  verdict: ApiTokenVerdict,
  requestId: string,
): void {
  if (verdict === "NOT_CONFIGURED") {
    throw new ApiError("SERVICE_AUTH_NOT_CONFIGURED", "Autenticación de servicio no configurada.", 503, requestId);
  }
  if (verdict !== "AUTHORIZED") {
    throw new ApiError("UNAUTHORIZED", "Token de servicio inválido.", 401, requestId);
  }
}

export function requireRevenueAccess(context: AuthContext | undefined, scope: string): void {
  if (!context) {
    throw new ApiError("UNAUTHENTICATED", "Contexto de autenticación ausente.", 401, "unknown");
  }
  const allowedRoles: readonly WorkspaceRole[] = ["owner", "admin", "operator"];
  if (!allowedRoles.includes(context.role)) {
    throw new ApiError("ROLE_NOT_ALLOWED", "El rol no permite esta operación.", 403, context.requestId);
  }
  if (context.planCode === "free") {
    throw new ApiError("PREMIUM_REQUIRED", "La operación requiere un plan PREMIUM o superior.", 402, context.requestId);
  }
  if (!context.scopes.includes(scope)) {
    throw new ApiError("SCOPE_REQUIRED", "Falta el scoping requerido para la operación.", 403, context.requestId);
  }
  if (context.riskLevel === "critical") {
    throw new ApiError("ACCOUNT_REVIEW_REQUIRED", "La cuenta requiere revisión antes de operar.", 403, context.requestId, true);
  }
}

export function normalizeRequestId(value: string | undefined, fallback: string): string {
  return value && value.length <= 128 ? value : fallback;
}