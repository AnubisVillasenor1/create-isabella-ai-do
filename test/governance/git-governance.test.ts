import { describe, expect, it } from "vitest";
import { evaluateGitOperation } from "../../src/governance";

const state = { currentBranch: "main", dirtyWorktrees: ["wip"], unmergedBranches: ["feature"] };

describe("git governance", () => {
  it("allows read-only operations without gate", () => {
    const verdict = evaluateGitOperation({ operation: "inspect", state });
    expect(verdict.decision).toBe("ALLOW");
    expect(verdict.effect).toBe("READ_ONLY");
  });

  it("refuses deleting the current branch", () => {
    const verdict = evaluateGitOperation({ operation: "force_delete_branch", targetBranch: "main", state });
    expect(verdict.decision).toBe("BLOCK");
    expect(verdict.reasons).toContain("GIT_REFUSE_DELETE_CURRENT_BRANCH");
  });

  it("refuses dirty worktrees and unmerged branches", () => {
    const dirty = evaluateGitOperation({ operation: "force_delete_branch", targetBranch: "wip", state, policyGateGranted: true, humanApproved: true });
    expect(dirty.decision).toBe("BLOCK");
    const unmerged = evaluateGitOperation({ operation: "force_delete_branch", targetBranch: "feature", state, policyGateGranted: true, humanApproved: true });
    expect(unmerged.decision).toBe("BLOCK");
  });

  it("requires policy gate and human approval for push", () => {
    const noGate = evaluateGitOperation({ operation: "push", state });
    expect(noGate.decision).toBe("BLOCK");
    const gateNoApproval = evaluateGitOperation({ operation: "push", state, policyGateGranted: true });
    expect(gateNoApproval.decision).toBe("REQUIRE_APPROVAL");
    const approved = evaluateGitOperation({ operation: "push", state, policyGateGranted: true, humanApproved: true });
    expect(approved.decision).toBe("ALLOW");
  });
});
