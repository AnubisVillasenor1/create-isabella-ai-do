/**
 * REINA — fachada gobernada de adjudicación previa a la ejecución.
 *
 * state: draft | engine-generated (pendiente de revisión humana con nombre).
 *
 * Qué ES: un pipeline determinista y auditable que, ANTES de que otra capa actúe,
 * decide qué se necesita: kill switch → riesgo → autonomía → quórum, y sella cada
 * decisión en un log de transparencia (RFC 6962) con prueba de inclusión.
 * Qué NO ES: no ejecuta nada, no es consciente, no es AGI, no sustituye al mandato
 * formal de `terminus/mandate` ni la aprobación humana. Un veredicto PERMIT significa
 * "no hay impedimento detectado por estas reglas", no "ejecútese".
 *
 * Los hechos `humanApprovalVerified` y `quorum` deben ser establecidos por código
 * confiable del proceso (p. ej. verificando firmas con `QuorumSession`), nunca
 * copiados de una entrada HTTP.
 */
import { createHash } from "node:crypto";
import { TransparencyLog } from "../bookpi/transparency";
import { evaluateAutonomy, type AutonomyLevel, type ImpactClass } from "../governance/autonomy";
import { assessRisk, type RiskInputs, type RiskTier } from "../governance/risk-score";
import type { QuorumTally } from "../governance/quorum";
import { IdempotencyStore, requestFingerprint, type IdempotencyOutcome } from "../ingress/idempotency";
import type { KillSwitch } from "../security/kill-switch";

export const REINA_METHOD_ID = "N.IDENTITY.E03_GOVERNANCE.adjudicate_action.v1.0.0.HIGH.INSTITUTIONAL";

export type ReinaVerdict = "PERMIT" | "REQUIRE_CONFIRMATION" | "REQUIRE_QUORUM" | "REQUIRE_HUMAN_APPROVAL" | "DENY" | "HALTED";

export interface ReinaRequest {
  readonly requestId: string;
  readonly actor: string;
  readonly action: string;
  readonly scope: string;
  readonly impact: ImpactClass;
  readonly autonomyLevel: AutonomyLevel;
  readonly irreversible: boolean;
  readonly humanConfirmed: boolean;
  readonly dualControl: boolean;
  readonly timeLimitMs?: number;
  readonly rollbackPlan: boolean;
  readonly risk: RiskInputs;
  /** Solo código confiable: aprobación humana ya verificada (identidad + evidencia). */
  readonly humanApprovalVerified?: boolean;
  /** Solo código confiable: resultado de un `QuorumSession.tally()`. */
  readonly quorum?: QuorumTally | null;
  readonly idempotencyKey?: string;
}

export interface ReinaDecision {
  readonly requestId: string;
  readonly verdict: ReinaVerdict;
  readonly reasons: readonly string[];
  readonly riskScore: number | null;
  readonly riskTier: RiskTier | null;
  readonly methodId: string;
  readonly decidedAt: string;
  readonly evidence: { readonly logIndex: number; readonly leafHash: string; readonly treeSize: number; readonly rootHash: string };
}

export interface EvidenceRecord {
  readonly requestId: string;
  readonly verdict: ReinaVerdict;
  readonly riskTier: RiskTier | null;
  readonly decidedAt: string;
  readonly leafHash: string;
}

export interface ReinaOptions {
  readonly killSwitch: KillSwitch;
  readonly log?: TransparencyLog;
  readonly now?: () => number;
  /** Destino opcional de evidencia (p. ej. BookPI). Un fallo del sink NO cambia el veredicto. */
  readonly evidenceSink?: (record: EvidenceRecord) => void;
}

export class ReinaIdempotencyConflictError extends Error {
  constructor() {
    super("REINA: idempotency key reused with a different request");
    this.name = "ReinaIdempotencyConflictError";
  }
}

const IMPACTS: readonly ImpactClass[] = ["NEGLIGIBLE", "LOW", "MEDIUM", "HIGH", "CRITICAL"];
const LEVELS: readonly AutonomyLevel[] = ["A0", "A1", "A2", "A3", "A4", "A5"];

function digest(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function validate(req: ReinaRequest): string | null {
  if (typeof req.requestId !== "string" || req.requestId.length === 0 || req.requestId.length > 128) return "INVALID_REQUEST_ID";
  if (typeof req.actor !== "string" || req.actor.trim().length === 0) return "INVALID_ACTOR";
  if (typeof req.action !== "string" || req.action.trim().length === 0 || req.action.length > 256) return "INVALID_ACTION";
  if (typeof req.scope !== "string" || !/^[A-Za-z0-9_:.\-]{1,128}$/.test(req.scope)) return "INVALID_SCOPE";
  if (!IMPACTS.includes(req.impact)) return "INVALID_IMPACT";
  if (!LEVELS.includes(req.autonomyLevel)) return "INVALID_AUTONOMY_LEVEL";
  return null;
}

export class ReinaGovernor {
  readonly log: TransparencyLog;
  private readonly now: () => number;
  private readonly idem = new IdempotencyStore<ReinaDecision>();

  constructor(private readonly opts: ReinaOptions) {
    this.log = opts.log ?? new TransparencyLog();
    this.now = opts.now ?? Date.now;
  }

  async adjudicate(req: ReinaRequest): Promise<ReinaDecision> {
    if (req.idempotencyKey === undefined) return this.decide(req);
    const outcome: IdempotencyOutcome<ReinaDecision> = await this.idem.run(
      req.idempotencyKey,
      requestFingerprint("ADJUDICATE", "reina", { ...req, idempotencyKey: undefined }),
      async () => this.decide(req),
      this.now(),
    );
    if (outcome.kind === "CONFLICT") throw new ReinaIdempotencyConflictError();
    if (outcome.kind === "INVALID_KEY") return this.seal(req, "DENY", ["INVALID_IDEMPOTENCY_KEY"], null, null);
    return outcome.value;
  }

  private decide(req: ReinaRequest): ReinaDecision {
    const invalid = validate(req);
    if (invalid !== null) return this.seal(req, "DENY", [invalid], null, null);

    if (this.opts.killSwitch.isHalted(req.scope, this.now())) return this.seal(req, "HALTED", ["KILL_SWITCH_ENGAGED"], null, null);

    let assessment;
    try {
      assessment = assessRisk(req.risk);
    } catch {
      return this.seal(req, "DENY", ["INVALID_RISK_INPUTS"], null, null);
    }
    const { score, tier } = assessment;

    if (assessment.requiresHumanApproval && req.humanApprovalVerified !== true) {
      return this.seal(req, "REQUIRE_HUMAN_APPROVAL", ["EPIC_RISK_BLOCKED_UNTIL_HUMAN_APPROVAL"], score, tier);
    }

    const autonomy = evaluateAutonomy({
      level: req.autonomyLevel,
      impact: req.impact,
      irreversible: req.irreversible,
      humanConfirmed: req.humanConfirmed,
      dualControl: req.dualControl,
      rollbackPlan: req.rollbackPlan,
      ...(req.timeLimitMs !== undefined ? { timeLimitMs: req.timeLimitMs } : {}),
    });
    if (!autonomy.allowed) {
      return this.seal(req, autonomy.needsHuman ? "REQUIRE_CONFIRMATION" : "DENY", autonomy.reasons, score, tier);
    }

    const needsQuorum = tier === "RELEVANT_HEADS" || tier === "EPIC" || req.impact === "CRITICAL";
    if (needsQuorum) {
      const q = req.quorum;
      if (q === undefined || q === null || q.status === "PENDING") return this.seal(req, "REQUIRE_QUORUM", ["FEDERATED_QUORUM_REQUIRED"], score, tier);
      if (q.status !== "APPROVED") return this.seal(req, "DENY", [`QUORUM_${q.status}`], score, tier);
    }
    return this.seal(req, "PERMIT", ["NO_BLOCKING_RULE_MATCHED"], score, tier);
  }

  private seal(req: ReinaRequest, verdict: ReinaVerdict, reasons: readonly string[], riskScore: number | null, riskTier: RiskTier | null): ReinaDecision {
    const decidedAt = new Date(this.now()).toISOString();
    // La evidencia guarda huellas, no el actor/acción en claro (minimización de datos).
    const record = {
      requestId: typeof req.requestId === "string" ? req.requestId.slice(0, 128) : "invalid",
      actorDigest: digest(String(req.actor)),
      actionDigest: digest(String(req.action)),
      verdict,
      reasons,
      riskScore,
      riskTier,
      methodId: REINA_METHOD_ID,
      decidedAt,
    };
    const logIndex = this.log.append(JSON.stringify(record));
    const leafHash = this.log.leafHash(logIndex);
    const treeSize = this.log.size;
    const decision: ReinaDecision = {
      requestId: record.requestId,
      verdict,
      reasons,
      riskScore,
      riskTier,
      methodId: REINA_METHOD_ID,
      decidedAt,
      evidence: { logIndex, leafHash, treeSize, rootHash: this.log.rootHash(treeSize) },
    };
    try {
      this.opts.evidenceSink?.({ requestId: record.requestId, verdict, riskTier, decidedAt, leafHash });
    } catch {
      // el sink es best-effort: la decisión ya está sellada en el log de transparencia
    }
    return decision;
  }

  status(): {
    name: "REINA";
    state: "draft | engine-generated";
    claims: readonly string[];
    disclaimers: readonly string[];
    logSize: number;
    rootHash: string;
    killSwitch: ReturnType<KillSwitch["status"]>;
  } {
    return {
      name: "REINA",
      state: "draft | engine-generated",
      claims: [
        "Adjudica previo a la ejecución (kill switch, riesgo, autonomía A0-A5, quórum M-de-N).",
        "Sella cada decisión en un log Merkle RFC 6962 con pruebas de inclusión/consistencia.",
      ],
      disclaimers: [
        "No ejecuta acciones.",
        "No es conciencia, AGI ni autoridad: CAPABILITY ≠ AUTHORITY ≠ EXECUTION.",
        "El log es en memoria (volátil, no WORM, sin anclaje externo).",
        "Sin revisión humana con nombre: estado draft.",
      ],
      logSize: this.log.size,
      rootHash: this.log.rootHash(),
      killSwitch: this.opts.killSwitch.status(this.now()),
    };
  }
}
