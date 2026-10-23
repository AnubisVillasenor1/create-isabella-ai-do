// ISABELLA Ω · Cognitive Civilization Runtime (CCR-1) HTTP surface — ejecuta el ciclo
// gobernado de 9 pasos (kernel → memoria → conocimiento → razonamiento → política →
// confianza → realidad → evolución → contrato) y devuelve la respuesta soberana.
//
// Invariante: el ciclo clasifica, explica y evidencia; NO autoriza ni ejecuta.
// state: draft | engine-generated.
import type { Application, Request, Response } from "express";
import type { FixedWindowRateLimiter } from "../security/rate-limit";
import type { CivilizationCycleInput, CivilizationCycleResult } from "../civilization";

export const CIVILIZATION_ROUTES_VERSION = "1.0.0" as const;

export interface CivilizationRouteDeps {
  readonly app: Application;
  readonly runCycle: (input: CivilizationCycleInput) => CivilizationCycleResult;
  readonly enforceRateLimit: (req: Request, res: Response, limiter: FixedWindowRateLimiter, bucket: string) => boolean;
  readonly rateLimiter: FixedWindowRateLimiter;
  /** Admin gate. When omitted, no token is required (development). */
  readonly authorizeAdmin?: (req: Request, res: Response) => boolean;
}

export function registerCivilizationRoutes(deps: CivilizationRouteDeps): void {
  const { app } = deps;

  app.post("/api/v1/civilization/cycle", (req, res) => {
    if (deps.authorizeAdmin && !deps.authorizeAdmin(req, res)) return;
    if (!deps.enforceRateLimit(req, res, deps.rateLimiter, "civilization-cycle")) return;
    try {
      const body = (req.body ?? {}) as Partial<CivilizationCycleInput>;
      const input = typeof body.input === "string" ? body.input : "";
      const result = deps.runCycle({
        input,
        ...(typeof body.principalId === "string" ? { principalId: body.principalId } : {}),
        ...(typeof body.federationId === "number" ? { federationId: body.federationId } : {}),
        ...(typeof body.territory === "string" ? { territory: body.territory } : {}),
        ...(typeof body.policyVersion === "string" ? { policyVersion: body.policyVersion } : {}),
        ...(typeof body.requiresTools === "boolean" ? { requiresTools: body.requiresTools } : {}),
        ...(typeof body.requiresMemory === "boolean" ? { requiresMemory: body.requiresMemory } : {}),
      });
      res.json({ success: true, authorizationPerformed: false, executionPerformed: false, cycle: result });
    } catch (err) {
      res.status(400).json({ success: false, error: err instanceof Error ? err.message : String(err) });
    }
  });
}
