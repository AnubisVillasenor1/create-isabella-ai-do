/**
 * Constitutional Governance Fabric (CGF) — unifica CROWN/GAME OVER/EOCT/AEGIS/TERMINUS/BAM-R/UAGP (state: draft | engine-generated).
 *
 * Autoridad única de gobernanza: evalúa política + riesgo + aprobación y emite una decisión constitucional
 * (allow/deny/escalate) con dossier de evidencia. Compone; no duplica la lógica de los subsistemas.
 *
 * CAPABILITY ≠ AUTHORITY ≠ EXECUTION ≠ EVIDENCE ≠ LEARNING ≠ PRODUCTION.
 */
export type ConstitutionalDecision = "allow" | "deny" | "escalate";

export interface GovernanceInput {
  readonly actor: string;
  readonly action: string;
  readonly resource: string;
  readonly riskScore: number;
  readonly policyAllowed: boolean;
  readonly approvalGranted: boolean;
  readonly evidencePresent: boolean;
}

export interface GovernanceDossier {
  readonly id: string;
  readonly actor: string;
  readonly action: string;
  readonly resource: string;
  readonly decision: ConstitutionalDecision;
  readonly riskScore: number;
  readonly reasons: readonly string[];
  readonly timestamp: string;
}

export class ConstitutionalGovernanceFabric {
  private readonly dossiers: GovernanceDossier[] = [];
  private seq = 0;
  private readonly totals = { total: 0, allow: 0, deny: 0, escalate: 0 };

  /**
   * The in-process dossier cache is deliberately bounded. It is not the durable
   * audit ledger; production evidence must be persisted through BookPI separately.
   */
  constructor(private readonly maxDossiers = 10_000) {
    if (!Number.isSafeInteger(maxDossiers) || maxDossiers < 1) {
      throw new RangeError("CGF: maxDossiers must be a positive safe integer");
    }
  }

  evaluate(input: GovernanceInput): GovernanceDossier {
    if (typeof input.actor !== "string" || input.actor.trim().length === 0 || input.actor.length > 256) throw new RangeError("CGF: actor required or too long");
    if (typeof input.action !== "string" || input.action.trim().length === 0 || input.action.length > 256) throw new RangeError("CGF: action required or too long");
    if (typeof input.resource !== "string" || input.resource.trim().length === 0 || input.resource.length > 1024) throw new RangeError("CGF: resource required or too long");
    if (!Number.isFinite(input.riskScore) || input.riskScore < 0 || input.riskScore > 1) throw new RangeError("CGF: riskScore 0..1");
    if (typeof input.policyAllowed !== "boolean" || typeof input.approvalGranted !== "boolean" || typeof input.evidencePresent !== "boolean") {
      throw new RangeError("CGF: policy, approval and evidence flags must be booleans");
    }
    const reasons: string[] = [];
    let decision: ConstitutionalDecision = "allow";
    if (!input.policyAllowed) { decision = "deny"; reasons.push("POLICY_DENIED"); }
    if (input.riskScore >= 0.8) { decision = "escalate"; reasons.push("HIGH_RISK"); }
    if (!input.approvalGranted && input.riskScore >= 0.5) { decision = "escalate"; reasons.push("APPROVAL_REQUIRED"); }
    if (!input.evidencePresent) { decision = "deny"; reasons.push("EVIDENCE_MISSING"); }
    if (decision === "allow" && input.riskScore >= 0.3) { decision = "escalate"; reasons.push("MODERATE_RISK"); }
    const dossier: GovernanceDossier = {
      id: `dossier-${(this.seq += 1)}`, actor: input.actor, action: input.action, resource: input.resource,
      decision, riskScore: input.riskScore, reasons, timestamp: new Date().toISOString(),
    };
    this.dossiers.push(dossier);
    this.totals.total += 1;
    this.totals[dossier.decision] += 1;
    if (this.dossiers.length > this.maxDossiers) {
      this.dossiers.splice(0, this.dossiers.length - this.maxDossiers);
    }
    return dossier;
  }

  listDossiers(limit?: number): readonly GovernanceDossier[] {
    if (limit === undefined) return [...this.dossiers];
    if (!Number.isInteger(limit) || limit < 1) throw new RangeError("CGF: limit positive");
    return this.dossiers.slice(-limit);
  }

  byActor(actor: string): readonly GovernanceDossier[] { return this.dossiers.filter((d) => d.actor === actor); }
  byDecision(decision: ConstitutionalDecision): readonly GovernanceDossier[] { return this.dossiers.filter((d) => d.decision === decision); }

  /** Lifetime counters; dossier queries expose only the bounded in-process cache. */
  stats(): { total: number; allow: number; deny: number; escalate: number } {
    return { ...this.totals };
  }
}
