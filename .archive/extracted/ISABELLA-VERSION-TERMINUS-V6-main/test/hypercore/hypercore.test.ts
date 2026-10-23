import { describe, expect, it } from "vitest";
import { createHyperCore } from "../../src/hypercore/hypercore";
import type { HyperCoreAuditor, HyperCoreExpert, HyperCoreTask } from "../../src/hypercore/types";

const task: HyperCoreTask = {
  taskId: "hc-task-1",
  intent: "generate api endpoint",
  domain: "code",
  risk: "low",
  prompt: "Generate an API endpoint for invoices.",
  contextTokens: 400,
  userScope: "user-1",
};

describe("HyperCore Ω² orchestrator (fail-closed)", () => {
  it("completes a verified low-risk task and records BookPI evidence", async () => {
    const core = createHyperCore();
    const result = await core.run(task);
    expect(result.status).toBe("COMPLETED");
    expect(result.verdict?.verdict).toBe("ALLOW");
    expect(result.response).not.toBeNull();
    expect(result.observation.bookpiTraceId).not.toBeNull();
    expect(result.disclaimer).toContain("does not authorize");
  });

  it("serves an identical request from the governed cache on the second run", async () => {
    const core = createHyperCore();
    const first = await core.run(task);
    const second = await core.run(task);
    expect(first.status).toBe("COMPLETED");
    expect(second.status).toBe("CACHE_HIT");
    expect(second.observation.cache).toBe("hit");
  });

  it("escalates when authorization is required but no CROWN port is wired", async () => {
    const core = createHyperCore();
    const result = await core.run({ ...task, taskId: "hc-auth-1", requiresAuthorization: true });
    expect(result.status).toBe("ESCALATED");
    expect(result.response).toBeNull();
    expect(result.reasons).toContain("AUTHORIZATION_REQUIRED");
  });

  it("denies when the CROWN authorizer refuses", async () => {
    const core = createHyperCore({
      authorizer: () => ({ authorized: false, authority: "CROWN", reason: "OUT_OF_SCOPE" }),
    });
    const result = await core.run({ ...task, taskId: "hc-auth-2", requiresAuthorization: true });
    expect(result.status).toBe("DENIED");
    expect(result.reasons.some((reason) => reason.startsWith("AUTHORIZATION_DENIED"))).toBe(true);
  });

  it("fails closed on expert timeout", async () => {
    const slow: HyperCoreExpert = {
      id: "slow-expert",
      domain: "code",
      costUnits: 1,
      latencyMs: 1000,
      energyKwh: 0.00001,
      run: () => new Promise(() => undefined) as unknown as Record<string, unknown>,
    };
    const core = createHyperCore({ experts: [slow], config: { timeoutMs: 5 } });
    const result = await core.run({ ...task, taskId: "hc-timeout-1" });
    expect(result.status).toBe("DENIED");
    expect(result.reasons.some((reason) => reason.startsWith("TIMEOUT"))).toBe(true);
  });

  it("fails closed on malformed expert output", async () => {
    const malformed: HyperCoreExpert = {
      id: "malformed-expert",
      domain: "code",
      costUnits: 1,
      latencyMs: 1,
      energyKwh: 0.00001,
      run: () => undefined as unknown as Record<string, unknown>,
    };
    const core = createHyperCore({ experts: [malformed] });
    const result = await core.run({ ...task, taskId: "hc-malformed-1" });
    expect(result.status).toBe("DENIED");
    expect(result.reasons.some((reason) => reason.startsWith("MALFORMED_OUTPUT"))).toBe(true);
  });

  it("denies with MISSING_AUDIT when the auditor fails", async () => {
    const auditor: HyperCoreAuditor = {
      record: () => {
        throw new Error("BOOKPI_DOWN");
      },
      verify: () => ({
        valid: false,
        blocksValidated: 0,
        storage: "VOLATILE_IN_MEMORY",
        durable: false,
        chainHead: null,
      }),
    };
    const core = createHyperCore({ auditor });
    const result = await core.run({ ...task, taskId: "hc-audit-1" });
    expect(result.status).toBe("DENIED");
    expect(result.response).toBeNull();
    expect(result.reasons).toContain("MISSING_AUDIT");
  });

  it("never authorizes: a cache hit still carries a BookPI trace and a disclaimer", async () => {
    const core = createHyperCore();
    await core.run(task);
    const hit = await core.run(task);
    expect(hit.observation.bookpiTraceId).not.toBeNull();
    expect(hit.disclaimer).toContain("Authorization is CROWN-only");
  });

  it("requires authorization for high/critical risk even when the task flag is false", async () => {
    let expertCalls = 0;
    const core = createHyperCore({
      experts: [{
        id: "spy-expert",
        domain: "code",
        costUnits: 1,
        latencyMs: 1,
        energyKwh: 0.00001,
        run: () => { expertCalls += 1; return { ok: true }; },
      }],
    });
    const result = await core.run({ ...task, taskId: "hc-critical-no-auth", risk: "critical", requiresAuthorization: false });
    expect(result.status).toBe("ESCALATED");
    expect(result.reasons).toContain("AUTHORIZATION_REQUIRED");
    expect(expertCalls).toBe(0);
  });

  it("rechecks CROWN authorization before serving a cached response", async () => {
    let calls = 0;
    const core = createHyperCore({
      authorizer: () => {
        calls += 1;
        return calls === 1
          ? { authorized: true, authority: "CROWN", reason: "APPROVED" }
          : { authorized: false, authority: "CROWN", reason: "REVOKED" };
      },
    });
    const authorizedTask = { ...task, taskId: "hc-cache-auth", requiresAuthorization: true };
    const first = await core.run(authorizedTask);
    expect(first.status).toBe("COMPLETED");
    const second = await core.run(authorizedTask);
    expect(second.status).toBe("DENIED");
    expect(second.reasons).toContain("AUTHORIZATION_DENIED:REVOKED");
    expect(calls).toBe(2);
  });


});
