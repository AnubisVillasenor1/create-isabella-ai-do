import { describe, expect, it } from "vitest";
import {
  LIFECYCLE,
  STALE_UPVOTE_THRESHOLD,
  evaluateStale,
  evaluateClosure,
  evaluateTriage,
  adjudicateDuplicate,
  planLifecycleRun,
  type LifecycleIssue,
} from "../../src/governance";

const now = new Date("2026-02-01T00:00:00Z");

function issue(overrides: Partial<LifecycleIssue>): LifecycleIssue {
  return { number: 1, labels: [], updatedAt: "2026-01-01T00:00:00Z", createdAt: "2025-01-01T00:00:00Z", ...overrides };
}

describe("governed issue lifecycle", () => {
  it("exposes a single source of truth for labels and timeouts", () => {
    expect(LIFECYCLE.map((l) => l.label)).toEqual(["invalid", "needs-repro", "needs-info", "stale", "autoclose"]);
    expect(STALE_UPVOTE_THRESHOLD).toBe(15);
  });

  it("marks stale only when inactive and unprotected", () => {
    expect(evaluateStale(issue({}), now).markStale).toBe(true);
    expect(evaluateStale(issue({ updatedAt: "2026-01-31T00:00:00Z" }), now).markStale).toBe(false);
    expect(evaluateStale(issue({ upvotes: 20 }), now).markStale).toBe(false);
    expect(evaluateStale(issue({ locked: true }), now).markStale).toBe(false);
  });

  it("protects closure against human activity after the label", () => {
    const target = issue({ labels: ["stale"], updatedAt: "2025-12-01T00:00:00Z" });
    expect(evaluateClosure(target, "stale", "2025-12-01T00:00:00Z", now).close).toBe(true);
    const withHuman = issue({
      labels: ["stale"], updatedAt: "2025-12-01T00:00:00Z",
      humanComments: [{ at: "2025-12-15T00:00:00Z" }],
    });
    expect(evaluateClosure(withHuman, "stale", "2025-12-01T00:00:00Z", now).close).toBe(false);
  });

  it("triages deterministically and escalates controversial content", () => {
    const complete = evaluateTriage({
      title: "Crash on start",
      body: "version 1.0, os linux, logs attached. Steps to reproduce: run the binary.",
    }, now);
    expect(complete.addLabels).toEqual([]);
    const missing = evaluateTriage({ title: "It broke", body: "help" }, now);
    expect(missing.addLabels).toContain("needs-repro");
    const sensitive = evaluateTriage({ title: "Security vulnerability", body: "details" }, now);
    expect(sensitive.requiresHumanGate).toBe(true);
  });

  it("adjudicates duplicates fail-closed", () => {
    expect(adjudicateDuplicate({ issueNumber: 1, duplicateOf: 2, confidence: 0.95 }).action).toBe("CLOSE_DUPLICATE");
    expect(adjudicateDuplicate({ issueNumber: 1, duplicateOf: 2, confidence: 0.5 }).action).toBe("HOLD");
    expect(adjudicateDuplicate({ issueNumber: 1, duplicateOf: 2, confidence: 0.95, authorDisagreed: true }).action).toBe("ESCALATE");
  });

  it("escalates sensitive stale issues and never proposes their closure", () => {
    const plan = planLifecycleRun({
      issues: [issue({
        number: 99,
        labels: ["stale"],
        updatedAt: "2025-12-01T00:00:00Z",
        title: "Security vulnerability",
        body: "Potential credential disclosure",
      })],
      now,
    });
    expect(plan.humanGate).toContain(99);
    expect(plan.proposeClose).not.toContainEqual({ issue: 99, label: "stale" });
  });

  it("produces an inspect/propose plan without executing", () => {
    const plan = planLifecycleRun({
      issues: [issue({ number: 7, labels: ["stale"], updatedAt: "2025-12-01T00:00:00Z" })],
      now,
    });
    expect(plan.proposeClose).toContainEqual({ issue: 7, label: "stale" });
    expect(plan.markStale).toEqual([]);
  });
});
