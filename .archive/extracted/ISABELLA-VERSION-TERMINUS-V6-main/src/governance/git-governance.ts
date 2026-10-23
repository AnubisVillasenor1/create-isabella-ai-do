/**
 * GIT_POLICY — operaciones Git seguras para las bibliotecas canónicas.
 *
 * Flujo obligatorio:
 *   inspect → propose → policy gate → user approval when required → execute → audit
 *
 * Las operaciones destructivas o con efectos externos (borrar ramas, worktrees
 * forzados, push, merge, PR) NO se ejecutan sin gate + aprobación. Este módulo
 * decide; no ejecuta. La ejecución corresponde al invocador autorizado.
 */

export const GIT_OPERATIONS = [
  "inspect",
  "list_branches",
  "delete_gone_branch",
  "force_delete_branch",
  "remove_worktree_force",
  "push",
  "merge",
  "open_pr",
  "commit",
] as const;

export type GitOperation = (typeof GIT_OPERATIONS)[number];

export type GitEffect = "READ_ONLY" | "LOCAL_MUTATION" | "EXTERNAL_EFFECT" | "DESTRUCTIVE";

export interface GitOperationProfile {
  operation: GitOperation;
  effect: GitEffect;
  requiresPolicyGate: boolean;
  requiresHumanApproval: boolean;
}

export const GIT_OPERATION_PROFILES: Readonly<Record<GitOperation, GitOperationProfile>> = Object.freeze({
  inspect: { operation: "inspect", effect: "READ_ONLY", requiresPolicyGate: false, requiresHumanApproval: false },
  list_branches: { operation: "list_branches", effect: "READ_ONLY", requiresPolicyGate: false, requiresHumanApproval: false },
  commit: { operation: "commit", effect: "LOCAL_MUTATION", requiresPolicyGate: true, requiresHumanApproval: false },
  delete_gone_branch: { operation: "delete_gone_branch", effect: "DESTRUCTIVE", requiresPolicyGate: true, requiresHumanApproval: true },
  force_delete_branch: { operation: "force_delete_branch", effect: "DESTRUCTIVE", requiresPolicyGate: true, requiresHumanApproval: true },
  remove_worktree_force: { operation: "remove_worktree_force", effect: "DESTRUCTIVE", requiresPolicyGate: true, requiresHumanApproval: true },
  push: { operation: "push", effect: "EXTERNAL_EFFECT", requiresPolicyGate: true, requiresHumanApproval: true },
  merge: { operation: "merge", effect: "EXTERNAL_EFFECT", requiresPolicyGate: true, requiresHumanApproval: true },
  open_pr: { operation: "open_pr", effect: "EXTERNAL_EFFECT", requiresPolicyGate: true, requiresHumanApproval: true },
});

export interface GitRepoState {
  currentBranch: string;
  /** ramas con trabajo no guardado (worktrees sucios). */
  dirtyWorktrees?: readonly string[];
  /** ramas con commits no fusionados. */
  unmergedBranches?: readonly string[];
  /** true si el diff fue revisado antes de un `git add .`. */
  diffReviewed?: boolean;
}

export interface GitOperationRequest {
  operation: GitOperation;
  targetBranch?: string;
  state: GitRepoState;
  /** resultado del policy gate (CROWN/ARGUS). */
  policyGateGranted?: boolean;
  /** aprobación humana explícita, si aplica. */
  humanApproved?: boolean;
}

export type GitDecision = "ALLOW" | "REQUIRE_APPROVAL" | "BLOCK";

export interface GitGovernanceVerdict {
  operation: GitOperation;
  effect: GitEffect;
  decision: GitDecision;
  reasons: readonly string[];
  /** pasos de auditoría BookPI sugeridos para la operación. */
  auditSteps: readonly string[];
}

/**
 * Decide si una operación Git puede ejecutarse. Fail-closed: sin gate o sin
 * aprobación, las operaciones destructivas/externas quedan BLOCK o REQUIRE_APPROVAL.
 * Nunca autoriza borrar la rama actual, worktrees con trabajo no guardado ni ramas
 * con commits no fusionados sin revisión.
 */
export function evaluateGitOperation(request: GitOperationRequest): GitGovernanceVerdict {
  const profile = GIT_OPERATION_PROFILES[request.operation];
  const reasons: string[] = [];
  let decision: GitDecision = "ALLOW";

  const destructive = profile.effect === "DESTRUCTIVE";
  const targetsCurrent = request.targetBranch !== undefined && request.targetBranch === request.state.currentBranch;

  if (destructive && targetsCurrent) {
    reasons.push("GIT_REFUSE_DELETE_CURRENT_BRANCH");
    decision = "BLOCK";
  }

  if (destructive && request.targetBranch !== undefined) {
    if ((request.state.dirtyWorktrees ?? []).includes(request.targetBranch)) {
      reasons.push("GIT_REFUSE_DIRTY_WORKTREE");
      decision = "BLOCK";
    }
    if ((request.state.unmergedBranches ?? []).includes(request.targetBranch)) {
      reasons.push("GIT_REFUSE_UNMERGED_BRANCH");
      decision = "BLOCK";
    }
  }

  if (request.operation === "commit" && request.state.diffReviewed === false) {
    reasons.push("GIT_REQUIRE_DIFF_REVIEW");
    decision = decision === "BLOCK" ? "BLOCK" : "REQUIRE_APPROVAL";
  }

  if (decision !== "BLOCK") {
    if (profile.requiresPolicyGate && request.policyGateGranted !== true) {
      reasons.push("GIT_POLICY_GATE_REQUIRED");
      decision = "BLOCK";
    } else if (profile.requiresHumanApproval && request.humanApproved !== true) {
      reasons.push("GIT_HUMAN_APPROVAL_REQUIRED");
      decision = "REQUIRE_APPROVAL";
    }
  }

  if (reasons.length === 0) reasons.push("GIT_OPERATION_ALLOWED");

  return {
    operation: request.operation,
    effect: profile.effect,
    decision,
    reasons: Object.freeze(reasons),
    auditSteps: Object.freeze(["inspect", "propose", "policy_gate", "execute", "audit"]),
  };
}
