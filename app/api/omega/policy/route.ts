import { evaluateGovernance, jsonResponse, safeTokenMatch, type RiskLevel } from "@/lib/isabella/omega/core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const risks = new Set<RiskLevel>(["low", "moderate", "high", "critical"]);

export async function POST(request: Request) {
  const expected = process.env.ISABELLA_OMEGA_API_TOKEN;
  const supplied = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? null;
  if (!safeTokenMatch(supplied, expected)) {
    return jsonResponse({ error: "unauthorized" }, 401);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: "invalid_json" }, 400);
  }
  if (!body || typeof body !== "object") return jsonResponse({ error: "invalid_body" }, 400);

  const input = body as Record<string, unknown>;
  if (typeof input.action !== "string" || input.action.length < 1 || input.action.length > 120) {
    return jsonResponse({ error: "invalid_action" }, 400);
  }
  const risk = input.risk;
  if (typeof risk !== "string" || !risks.has(risk as RiskLevel)) {
    return jsonResponse({ error: "invalid_risk" }, 400);
  }

  const decision = evaluateGovernance(input.action, risk as RiskLevel);
  return jsonResponse({
    ...decision,
    executionPerformed: false,
    evidenceRequired: true,
    evaluatedAt: new Date().toISOString(),
  }, decision.allowed ? 200 : 403);
}
