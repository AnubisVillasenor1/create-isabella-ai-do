/**
 * Quórum M-de-N federado con votos firmados Ed25519.
 *
 * state: draft | engine-generated (pendiente de revisión humana con nombre).
 *
 * Reglas (fail-closed): solo votan miembros del electorado registrado; un miembro
 * vota una sola vez (el primer voto es definitivo); la firma liga propuesta +
 * hash de la carga + decisión + votante; se exigen M votos de aprobación de M
 * FEDERACIONES DISTINTAS (un solo bloque no puede reunir el quórum); el proponente
 * no puede votar su propia propuesta (separación de funciones); la propuesta
 * expira. Un resultado APPROVED es una evidencia de decisión colectiva, NO ejecuta
 * nada (CAPABILITY ≠ AUTHORITY ≠ EXECUTION).
 */
import { createHash, sign as edSign, verify as edVerify, type KeyObject } from "node:crypto";

export type VoteDecision = "APPROVE" | "REJECT";
export type QuorumStatus = "PENDING" | "APPROVED" | "REJECTED" | "EXPIRED";

export interface Voter {
  readonly id: string;
  readonly federation: string;
  readonly publicKey: KeyObject;
}

export interface QuorumProposal {
  readonly id: string;
  readonly proposerId: string;
  readonly action: string;
  readonly payload: string;
  readonly threshold: number;
  readonly createdAt: Date;
  readonly expiresAt: Date;
}

export interface SignedVote {
  readonly proposalId: string;
  readonly voterId: string;
  readonly decision: VoteDecision;
  readonly signature: string;
}

export interface QuorumTally {
  readonly status: QuorumStatus;
  readonly approvals: number;
  readonly rejections: number;
  readonly approvingFederations: readonly string[];
  readonly threshold: number;
  readonly electorate: number;
}

export function payloadDigest(payload: string): string {
  return createHash("sha256").update(payload, "utf8").digest("hex");
}

export function voteMessage(proposalId: string, payloadHash: string, decision: VoteDecision, voterId: string): Buffer {
  return Buffer.from(`TAMV-VOTE-v1\n${proposalId}\n${payloadHash}\n${decision}\n${voterId}`, "utf8");
}

/** Firma un voto (lado del votante). */
export function signVote(privateKey: KeyObject, proposal: QuorumProposal, voterId: string, decision: VoteDecision): SignedVote {
  const sig = edSign(null, voteMessage(proposal.id, payloadDigest(proposal.payload), decision, voterId), privateKey);
  return { proposalId: proposal.id, voterId, decision, signature: sig.toString("base64") };
}

export class QuorumSession {
  private readonly voters = new Map<string, Voter>();
  private readonly votes = new Map<string, VoteDecision>();
  private readonly payloadHash: string;

  constructor(readonly proposal: QuorumProposal, electorate: readonly Voter[]) {
    if (!Number.isInteger(proposal.threshold) || proposal.threshold < 1) throw new RangeError("QUORUM: threshold must be an integer >= 1");
    if (!(proposal.expiresAt.getTime() > proposal.createdAt.getTime())) throw new RangeError("QUORUM: expiresAt must be after createdAt");
    for (const v of electorate) {
      if (this.voters.has(v.id)) throw new Error(`QUORUM: duplicate voter id ${v.id}`);
      this.voters.set(v.id, v);
    }
    const eligible = electorate.filter((v) => v.id !== proposal.proposerId);
    const federations = new Set(eligible.map((v) => v.federation));
    if (federations.size < proposal.threshold) {
      throw new Error("QUORUM: electorate has fewer distinct eligible federations than the threshold");
    }
    this.payloadHash = payloadDigest(proposal.payload);
  }

  /** Registra un voto verificado. Lanza ante cualquier irregularidad (no hay voto parcial). */
  cast(vote: SignedVote, now: Date = new Date()): QuorumTally {
    if (now.getTime() >= this.proposal.expiresAt.getTime()) throw new Error("QUORUM: proposal expired");
    if (vote.proposalId !== this.proposal.id) throw new Error("QUORUM: vote bound to a different proposal");
    if (vote.decision !== "APPROVE" && vote.decision !== "REJECT") throw new Error("QUORUM: invalid decision");
    const voter = this.voters.get(vote.voterId);
    if (voter === undefined) throw new Error("QUORUM: voter not in electorate");
    if (voter.id === this.proposal.proposerId) throw new Error("QUORUM: proposer cannot vote (separation of duties)");
    if (this.votes.has(voter.id)) throw new Error("QUORUM: voter already voted");
    let ok = false;
    try {
      ok = edVerify(null, voteMessage(vote.proposalId, this.payloadHash, vote.decision, vote.voterId), voter.publicKey, Buffer.from(vote.signature, "base64"));
    } catch {
      ok = false;
    }
    if (!ok) throw new Error("QUORUM: invalid vote signature");
    this.votes.set(voter.id, vote.decision);
    return this.tally(now);
  }

  tally(now: Date = new Date()): QuorumTally {
    let approvals = 0;
    let rejections = 0;
    const fed = new Set<string>();
    for (const [id, decision] of this.votes) {
      const voter = this.voters.get(id);
      if (voter === undefined) continue;
      if (decision === "APPROVE") {
        approvals += 1;
        fed.add(voter.federation);
      } else {
        rejections += 1;
      }
    }
    const eligibleFeds = new Set([...this.voters.values()].filter((v) => v.id !== this.proposal.proposerId).map((v) => v.federation));
    // Alcanzable = federaciones que ya aprobaron + federaciones con algún votante elegible pendiente.
    const pendingFeds = new Set<string>();
    for (const v of this.voters.values()) {
      if (v.id !== this.proposal.proposerId && !this.votes.has(v.id)) pendingFeds.add(v.federation);
    }
    const reachable = new Set([...fed, ...pendingFeds]);
    let status: QuorumStatus = "PENDING";
    if (fed.size >= this.proposal.threshold) status = "APPROVED";
    else if (reachable.size < this.proposal.threshold) status = "REJECTED";
    else if (now.getTime() >= this.proposal.expiresAt.getTime()) status = "EXPIRED";
    return { status, approvals, rejections, approvingFederations: [...fed].sort(), threshold: this.proposal.threshold, electorate: eligibleFeds.size };
  }
}
