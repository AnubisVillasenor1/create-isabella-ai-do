import type { RiskTier } from "../authority/method-id";
import type { ApprovalRef } from "../identity/approval";
import { verifyHumanApproval } from "../identity/approval";
import type { Principal } from "../identity/principal";
import { inspectAegisValue } from "../security/aegis";
import { sha256 } from "./canonical-json";
import { validateSchema } from "./schema-validator";
import type { EvidenceRef, SkillContract } from "./contracts";

export type { EvidenceRef, SkillContract } from "./contracts";

export interface SkillBudget {
  readonly maxLatencyMs?: number;
  readonly maxCalls?: number;
  readonly maxEnergyUnits?: number;
}

export interface SkillContext {
  requestId: string;
  traceId: string;
  input: unknown;
  signals: readonly string[];
  principal?: Principal;
  tenantId?: string;
  federationId?: string;
  grantedScopes?: readonly string[];
  budget?: SkillBudget;
}

export interface SkillAuthorization {
  approval?: ApprovalRef;
  contextHash?: string;
  policyVersion?: string;
}

export interface SkillDescriptor {
  id: string;
  version: string;
  methodId: string;
  riskTier: RiskTier;
  requiresEvidence: boolean;
  contract?: SkillContract;
  handler: (ctx: SkillContext) => Promise<unknown>;
}

export interface SkillInvocation {
  skillId: string;
  version: string;
  methodId: string;
  requestId: string;
  traceId: string;
  startedAt: string;
  completedAt: string;
  status: "ok" | "blocked" | "error";
  output?: unknown;
  reason?: string;
  evidence?: readonly EvidenceRef[];
}

const EXECUTION_MANIFEST_VERSION = "ISABELLA-SKILL-MANIFEST-v2";

export class SkillRegistry {
  private readonly skills = new Map<string, SkillDescriptor>();

  register(skill: SkillDescriptor): void {
    if (this.skills.has(skill.id)) throw new Error(`SKILLS: duplicate skill ${skill.id}`);
    if (!skill.id || !skill.version || !skill.methodId) throw new Error("SKILLS: descriptor metadata is incomplete.");
    if (skill.contract && skill.contract.authority.requiredScopes.length === 0) {
      throw new Error(`SKILLS: contract for ${skill.id} must declare at least one required scope.`);
    }
    this.skills.set(skill.id, Object.freeze({ ...skill }));
  }

  get(id: string): SkillDescriptor {
    const skill = this.skills.get(id);
    if (!skill) throw new Error(`SKILLS: unknown skill ${id}`);
    return skill;
  }

  has(id: string): boolean {
    return this.skills.has(id);
  }

  list(): readonly SkillDescriptor[] {
    return [...this.skills.values()];
  }

  /** Deterministic digest of the registered catalog (contract drift detection). */
  manifest(): string {
    return sha256(
      this.list()
        .map((skill) => ({ id: skill.id, version: skill.version, methodId: skill.methodId, riskTier: skill.riskTier }))
        .sort((left, right) => left.id.localeCompare(right.id)),
    );
  }

  async invoke(id: string, ctx: SkillContext, authorization: SkillAuthorization = {}): Promise<SkillInvocation> {
    const skill = this.get(id);
    const startedAt = new Date().toISOString();
    const contract = skill.contract;

    // 1. Scope enforcement (fail-closed whenever a contract declares scopes).
    if (contract) {
      const granted = ctx.grantedScopes ?? [];
      const missing = contract.authority.requiredScopes.filter((scope) => !granted.includes(scope));
      if (missing.length > 0) {
        return blockedInvocation(skill, ctx, startedAt, `missing required scopes: ${missing.join(", ")}`);
      }

      // 2. Input contract validation.
      const inputValidation = validateSchema(ctx.input, contract.inputSchema);
      if (!inputValidation.valid) {
        return blockedInvocation(skill, ctx, startedAt, `input contract violated at ${inputValidation.violations[0]?.path ?? "$"}`);
      }
    }

    // 3. Evidence policy.
    const evidenceRequired =
      skill.requiresEvidence || contract?.evidencePolicy.required === true || skill.riskTier === "HIGH" || skill.riskTier === "CRITICAL";
    if (evidenceRequired && ctx.signals.length === 0) {
      return blockedInvocation(skill, ctx, startedAt, "evidence required but no signals were provided");
    }

    // 4. AEGIS adversarial inspection (prompt-injection / non-serializable input).
    const aegis = inspectAegisValue(ctx.input);
    if (aegis.decision !== "ALLOW") {
      return blockedInvocation(skill, ctx, startedAt, `aegis decision ${aegis.decision}`);
    }

    // 5. Human approval / step-up for high-risk or step-up contracts.
    const requiresHumanApproval = contract?.authority.requiresStepUp === true || skill.riskTier === "HIGH" || skill.riskTier === "CRITICAL";
    if (requiresHumanApproval) {
      const principal = ctx.principal;
      const validApproval = Boolean(
        principal &&
          authorization.approval?.decision === "ALLOW" &&
          verifyHumanApproval(authorization.approval, {
            methodId: skill.methodId,
            action: `skill:${skill.id}`,
            resource: `skill:${skill.id}`,
            principalId: principal.id,
            contextHash: authorization.contextHash,
            policyVersion: authorization.policyVersion,
          }),
      );
      if (!validApproval) return blockedInvocation(skill, ctx, startedAt, "human approval required");
    }

    // 6. Execute.
    let output: unknown;
    try {
      output = await skill.handler(ctx);
    } catch {
      return errorInvocation(skill, ctx, startedAt, "handler threw during execution");
    }

    // 7. Post-execution verification: output contract + execution manifest.
    try {
      if (contract) {
        const outputValidation = validateSchema(output, contract.outputSchema);
        if (!outputValidation.valid) {
          return errorInvocation(skill, ctx, startedAt, `output contract violated at ${outputValidation.violations[0]?.path ?? "$"}`);
        }
      }

      const inputHash = `sha256:${sha256(ctx.input ?? null)}`;
      const outputHash = `sha256:${sha256(output ?? null)}`;
      const manifestHash = `sha256:${sha256({
        manifestVersion: EXECUTION_MANIFEST_VERSION,
        skillId: skill.id,
        skillVersion: skill.version,
        methodId: skill.methodId,
        tenantId: ctx.tenantId ?? null,
        federationId: ctx.federationId ?? null,
        traceId: ctx.traceId,
        inputHash,
        outputHash,
      })}`;

      return {
        skillId: skill.id,
        version: skill.version,
        methodId: skill.methodId,
        requestId: ctx.requestId,
        traceId: ctx.traceId,
        startedAt,
        completedAt: new Date().toISOString(),
        status: "ok",
        output,
        evidence: [
          { type: "input_digest", digest: inputHash },
          { type: "output_digest", digest: outputHash },
          { type: "execution_manifest", digest: manifestHash },
        ],
      };
    } catch {
      return errorInvocation(skill, ctx, startedAt, "execution manifest could not be sealed");
    }
  }
}

function blockedInvocation(skill: SkillDescriptor, ctx: SkillContext, startedAt: string, reason: string): SkillInvocation {
  return {
    skillId: skill.id,
    version: skill.version,
    methodId: skill.methodId,
    requestId: ctx.requestId,
    traceId: ctx.traceId,
    startedAt,
    completedAt: new Date().toISOString(),
    status: "blocked",
    reason,
  };
}

function errorInvocation(skill: SkillDescriptor, ctx: SkillContext, startedAt: string, reason: string): SkillInvocation {
  return {
    skillId: skill.id,
    version: skill.version,
    methodId: skill.methodId,
    requestId: ctx.requestId,
    traceId: ctx.traceId,
    startedAt,
    completedAt: new Date().toISOString(),
    status: "error",
    reason,
  };
}
