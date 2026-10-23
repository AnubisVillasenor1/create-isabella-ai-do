import { createHash, randomUUID } from "node:crypto";

export type ProposalReviewDecision = "REJECT" | "REQUEST_EVIDENCE";

export interface MemoryProposalInput {
  subject: string;
  predicate: string;
  object: string;
  sourceUri?: string | null;
}

export interface PendingMemoryProposal extends Required<Pick<MemoryProposalInput, "subject" | "predicate" | "object">> {
  id: string;
  sourceUri: string | null;
  proposalHash: string;
  submittedAt: string;
  status: "PENDING_ADMIN_REVIEW";
}

export interface MemoryProposalResolution {
  id: string;
  proposalId: string;
  decision: ProposalReviewDecision;
  note: string;
  reviewedBy: "service:genesis-admin-token";
  reviewedAt: string;
  resolutionHash: string;
}

export class MemoryProposalQueue {
  private readonly pending: PendingMemoryProposal[] = [];
  private readonly resolutions: MemoryProposalResolution[] = [];

  constructor(private readonly maxPending = 500, private readonly maxResolutions = 1000) {
    if (!Number.isSafeInteger(maxPending) || maxPending < 1) throw new Error("PROPOSAL_MAX_PENDING_INVALID");
    if (!Number.isSafeInteger(maxResolutions) || maxResolutions < 1) throw new Error("PROPOSAL_MAX_RESOLUTIONS_INVALID");
  }

  submit(input: MemoryProposalInput, now = new Date()): PendingMemoryProposal {
    const { subject, predicate, object } = input;
    if (![subject, predicate, object].every((value) => typeof value === "string" && value.trim())) {
      throw new Error("PROPOSAL_FIELDS_REQUIRED");
    }
    if (subject.length > 300 || predicate.length > 160 || object.length > 5000) {
      throw new Error("PROPOSAL_SIZE_LIMIT_EXCEEDED");
    }
    const sourceUri = typeof input.sourceUri === "string" && input.sourceUri.trim() ? input.sourceUri.trim() : null;
    if (sourceUri) {
      if (sourceUri.length > 2048) throw new Error("SOURCE_URI_SIZE_LIMIT_EXCEEDED");
      let parsed: URL;
      try { parsed = new URL(sourceUri); } catch { throw new Error("SOURCE_URI_INVALID"); }
      if (parsed.protocol !== "https:") throw new Error("SOURCE_URI_MUST_USE_HTTPS");
    }
    if (this.pending.length >= this.maxPending) throw new Error("PROPOSAL_REVIEW_QUEUE_FULL");

    const payload = {
      id: "proposal-" + randomUUID(),
      subject: subject.trim(),
      predicate: predicate.trim(),
      object: object.trim(),
      sourceUri,
      submittedAt: now.toISOString(),
      status: "PENDING_ADMIN_REVIEW" as const,
    };
    const proposalHash = createHash("sha256").update(JSON.stringify(payload), "utf8").digest("hex");
    const proposal: PendingMemoryProposal = Object.freeze({ ...payload, proposalHash });
    this.pending.push(proposal);
    return { ...proposal };
  }

  list(): readonly PendingMemoryProposal[] {
    return this.pending.map((proposal) => ({ ...proposal }));
  }

  resolve(proposalId: string, decision: ProposalReviewDecision, note = "", now = new Date()): MemoryProposalResolution {
    if (decision !== "REJECT" && decision !== "REQUEST_EVIDENCE") throw new Error("PROPOSAL_DECISION_NOT_ALLOWED");
    if (note.length > 500) throw new Error("PROPOSAL_REVIEW_NOTE_TOO_LONG");
    const index = this.pending.findIndex((proposal) => proposal.id === proposalId);
    if (index < 0) throw new Error("PROPOSAL_NOT_FOUND");
    const payload = {
      id: "resolution-" + randomUUID(),
      proposalId,
      decision,
      note: note.trim(),
      reviewedBy: "service:genesis-admin-token" as const,
      reviewedAt: now.toISOString(),
    };
    const resolutionHash = createHash("sha256").update(JSON.stringify(payload), "utf8").digest("hex");
    const resolution: MemoryProposalResolution = Object.freeze({ ...payload, resolutionHash });
    this.pending.splice(index, 1);
    this.resolutions.push(resolution);
    if (this.resolutions.length > this.maxResolutions) this.resolutions.splice(0, this.resolutions.length - this.maxResolutions);
    return { ...resolution };
  }

  snapshot() {
    return {
      status: "VOLATILE_REVIEW_QUEUE" as const,
      count: this.pending.length,
      proposals: this.list(),
      resolutionCount: this.resolutions.length,
      resolutions: this.resolutions.map((resolution) => ({ ...resolution })),
      persistence: "IN_MEMORY_ONLY" as const,
      canonicalMemoryMutated: false as const,
    };
  }
}

export const memoryProposalQueue = new MemoryProposalQueue();
