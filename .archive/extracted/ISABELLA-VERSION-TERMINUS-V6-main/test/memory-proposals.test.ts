import { describe, expect, it } from "vitest";
import { MemoryProposalQueue } from "../src/memory/proposals";

describe("untrusted memory proposal queue", () => {
  it("bounds submissions and never claims canonical memory was mutated", () => {
    const queue = new MemoryProposalQueue(1, 2);
    const first = queue.submit({ subject: "S", predicate: "P", object: "O" });
    expect(first.status).toBe("PENDING_ADMIN_REVIEW");
    expect(queue.snapshot().canonicalMemoryMutated).toBe(false);
    expect(() => queue.submit({ subject: "S2", predicate: "P", object: "O" })).toThrow(/QUEUE_FULL/);
  });

  it("rejects non-HTTPS source references", () => {
    const queue = new MemoryProposalQueue();
    expect(() => queue.submit({ subject: "S", predicate: "P", object: "O", sourceUri: "http://example.org" }))
      .toThrow(/MUST_USE_HTTPS/);
  });

  it("resolves only reject/request-evidence decisions and preserves an audit hash", () => {
    const queue = new MemoryProposalQueue();
    const proposal = queue.submit({ subject: "S", predicate: "P", object: "O", sourceUri: "https://example.org/source" });
    const resolution = queue.resolve(proposal.id, "REQUEST_EVIDENCE", "Provide source document");
    expect(resolution.proposalId).toBe(proposal.id);
    expect(resolution.resolutionHash).toMatch(/^[a-f0-9]{64}$/);
    expect(queue.snapshot().count).toBe(0);
    expect(queue.snapshot().resolutionCount).toBe(1);
    expect(() => queue.resolve(proposal.id, "REJECT")).toThrow(/NOT_FOUND/);
  });
});
