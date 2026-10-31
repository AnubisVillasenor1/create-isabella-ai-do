import { describe, expect, it } from "vitest";
import { claimIsAuthoritative, verifyUiContext } from "../../src/companion/ui-context-guard";
import { createPrincipal } from "../../src/identity/principal";
import type { UiContextClaim } from "../../src/companion/ui-context-guard";

const verified = (admitted: boolean) =>
  Object.freeze({
    principal: createPrincipal({ id: "actor-1", kind: "human", tenantId: "tenant-9", roles: ["member"] }),
    pdp: Object.freeze({ effect: admitted ? ("ALLOW" as const) : ("DENY" as const), admitted }),
  });

describe("ui-context-guard (ISA-457/458)", () => {
  const claim: UiContextClaim = { tenantId: "tenant-9", actorId: "actor-1" };

  it("denies without a verified backend identity", () => {
    expect(verifyUiContext(undefined, claim).verdict).toBe("DENY_MISSING");
  });

  it("denies when the PDP does not admit", () => {
    expect(verifyUiContext(verified(false), claim).verdict).toBe("DENY_MISSING");
  });

  it("denies empty or incomplete UI claims", () => {
    expect(verifyUiContext(verified(true), undefined).verdict).toBe("DENY_EMPTY_CLAIM");
    expect(verifyUiContext(verified(true), { tenantId: "", actorId: "actor-1" }).verdict).toBe("DENY_EMPTY_CLAIM");
  });

  it("denies tenant/actor mismatch even for a valid claim", () => {
    const wrong = verifyUiContext(verified(true), { tenantId: "tenant-9", actorId: "intruder" });
    expect(wrong.verdict).toBe("DENY_MISMATCH");
    expect(verifyUiContext(verified(true), { tenantId: "tenant-999", actorId: "actor-1" }).verdict).toBe("DENY_MISMATCH");
  });

  it("allows only an exact match and never confers authority", () => {
    const verdict = verifyUiContext(verified(true), claim);
    expect(verdict.verdict).toBe("ALLOW_MATCH");
    expect(verdict.authoritative).toBe(false);
    expect(verdict.reason).toContain("NUNCA confiere autoridad");
  });

  it("claims are structurally never authoritative", () => {
    expect(claimIsAuthoritative(claim)).toBe(false);
    expect(claimIsAuthoritative(undefined)).toBe(false);
  });
});