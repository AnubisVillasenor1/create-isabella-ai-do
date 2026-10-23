import { resolveSkillInvocation } from "@/lib/skill-registry";
import { getIsabellaSkill, getRuntimeSkill, type IsabellaSkillId } from "@/lib/skills/registry";
import type { SkillContext, SkillResult } from "@/lib/skills/contracts";
import { CentralizedTelemetryService } from "@/lib/latam-aegis-x";

export type SkillExecutionContext = {
  requestId: string;
  traceId: string;
  actorId: string;
  tenantId: string;
  scope: string;
  locale?: string;
  history?: SkillContext["history"];
};

export type SkillExecutionOutcome =
  | {
      matched: false;
      blocked?: false;
      result: null;
    }
  | {
      matched: true;
      blocked?: false;
      result: SkillResult<unknown>;
      invocation: string;
    }
  | {
      matched: true;
      blocked: true;
      code: string;
      message: string;
      invocation: string;
      result?: null;
    };

function isValidSkillResult(value: unknown): value is SkillResult<unknown> {
  if (!value || typeof value !== "object") return false;
  const result = value as Record<string, unknown>;
  return (
    typeof result.skillId === "string" &&
    typeof result.summary === "string" &&
    Array.isArray(result.evidence) &&
    Array.isArray(result.warnings) &&
    Array.isArray(result.auditEvents) &&
    typeof result.data !== "undefined" &&
    ["SUCCESS", "PARTIAL", "BLOCKED", "ESCALATED", "FAILED"].includes(String(result.status))
  );
}

/**
 * Canonical conversational bridge:
 * @skill -> resolve -> scope/risk gate -> runtime execution -> schema validation -> audit.
 *
 * It deliberately does not invoke arbitrary tools from the model. Only skills
 * already present in the canonical registry can reach their runtime handler.
 */
export async function executeConversationalSkill(
  input: string,
  context: SkillExecutionContext,
): Promise<SkillExecutionOutcome> {
  const resolved = resolveSkillInvocation(input);
  if (!resolved) return { matched: false, result: null };

  if ("error" in resolved) {
    CentralizedTelemetryService.logEvent(
      "CROWN_GATEWAY",
      "CROWN_ROUTER",
      "SkillInvocationBlocked",
      { code: resolved.code, invocation: input.slice(0, 120), tenantId: context.tenantId },
      "warn",
      context.traceId,
      context.requestId,
    );
    return {
      matched: true,
      blocked: true,
      code: resolved.code,
      message: resolved.error,
      invocation: input,
    };
  }

  const { skill, prompt, invocation } = resolved;
  const missingScopes = skill.requiredScopes.filter(
    (required) => !context.scope.split(/\s+/).filter(Boolean).includes(required),
  );
  if (missingScopes.length) {
    const message = `Skill @${skill.id} requiere scopes no concedidos: ${missingScopes.join(", ")}`;
    CentralizedTelemetryService.logEvent(
      "CROWN_GATEWAY",
      "CROWN_CONSTITUTION",
      "SkillAuthorizationDenied",
      { skillId: skill.id, missingScopes, tenantId: context.tenantId },
      "security_incident",
      context.traceId,
      context.requestId,
    );
    return { matched: true, blocked: true, code: "SKILL_SCOPE_DENIED", message, invocation };
  }

  const registeredSkill = getIsabellaSkill(skill.id as IsabellaSkillId);
  const runtime = getRuntimeSkill(skill.id as IsabellaSkillId);
  if (!registeredSkill || !runtime) {
    return {
      matched: true,
      blocked: true,
      code: "SKILL_RUNTIME_NOT_FOUND",
      message: `Skill sin runtime: @${skill.id}`,
      invocation,
    };
  }

  const skillContext: SkillContext = {
    requestId: context.requestId,
    actorId: context.actorId,
    locale: context.locale ?? "es-MX",
    federation: runtime.federation,
    intent: skill.id,
    text: prompt,
    metadata: { tenantId: context.tenantId, invocation },
    history: context.history,
  };

  if (!runtime.canRun({ prompt }, skillContext)) {
    CentralizedTelemetryService.logEvent(
      "CROWN_GATEWAY",
      "CROWN_CONSTITUTION",
      "SkillCanRunDenied",
      { skillId: skill.id, tenantId: context.tenantId },
      "warn",
      context.traceId,
      context.requestId,
    );
    return {
      matched: true,
      blocked: true,
      code: "SKILL_CAN_RUN_DENIED",
      message: `El runtime de @${skill.id} rechazó la ejecución para este contexto.`,
      invocation,
    };
  }

  CentralizedTelemetryService.logEvent(
    "CROWN_GATEWAY",
    "CROWN_ROUTER",
    "SkillInvocationStarted",
    { skillId: skill.id, version: runtime.version, tenantId: context.tenantId },
    "info",
    context.traceId,
    context.requestId,
  );

  try {
    const result = await runtime.run({ prompt }, skillContext);
    if (!isValidSkillResult(result)) {
      CentralizedTelemetryService.logEvent(
        "CROWN_GATEWAY",
        "CROWN_CONSTITUTION",
        "SkillOutputValidationFailed",
        { skillId: skill.id, tenantId: context.tenantId },
        "error",
        context.traceId,
        context.requestId,
      );
      return {
        matched: true,
        blocked: true,
        code: "SKILL_OUTPUT_INVALID",
        message: `@${skill.id} produjo una salida que no cumple el contrato SkillResult.`,
        invocation,
      };
    }

    CentralizedTelemetryService.logEvent(
      "CROWN_GATEWAY",
      "CROWN_ROUTER",
      "SkillInvocationCompleted",
      {
        skillId: skill.id,
        status: result.status,
        evidenceCount: result.evidence.length,
        warningCount: result.warnings.length,
        tenantId: context.tenantId,
      },
      result.status === "FAILED" ? "error" : "info",
      context.traceId,
      context.requestId,
    );

    return { matched: true, result, invocation };
  } catch (error) {
    CentralizedTelemetryService.logEvent(
      "CROWN_GATEWAY",
      "CROWN_ROUTER",
      "SkillInvocationFailed",
      {
        skillId: skill.id,
        tenantId: context.tenantId,
        error: error instanceof Error ? error.message : "unknown",
      },
      "error",
      context.traceId,
      context.requestId,
    );
    return {
      matched: true,
      blocked: true,
      code: "SKILL_EXECUTION_FAILED",
      message: `La ejecución de @${skill.id} falló de forma controlada.`,
      invocation,
    };
  }
}
