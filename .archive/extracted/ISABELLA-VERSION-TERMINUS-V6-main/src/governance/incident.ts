/**
 * Clasificación de incidentes S0–S3 y máquina de estados de respuesta con plazos.
 *
 * state: draft | engine-generated. Plazos según la spec: S0 contener <1 h, notificar
 * <24 h; S1 <4 h / <48 h; S2 contener <24 h; S3 siguiente sprint. La clasificación
 * es una PROPUESTA determinista de umbrales (supuesto documentado, arbitraje humano
 * pendiente); el estado lo mueve una persona o proceso autorizado, no este módulo.
 * La línea de tiempo está encadenada por hash (evidencia de integridad, no WORM).
 */
import { createHash } from "node:crypto";

export type Severity = "S0" | "S1" | "S2" | "S3";
export type IncidentState = "DETECTED" | "TRIAGED" | "CONTAINED" | "ERADICATED" | "RECOVERED" | "CLOSED";

export interface IncidentSignals {
  readonly personalDataExposed: boolean;
  readonly integrityCompromised: boolean;
  readonly activeExploitation: boolean;
  readonly availabilityImpactPct: number;
  readonly affectedSubjects: number;
  readonly privilegedCredentialsExposed: boolean;
}

export interface SeverityPolicy {
  readonly containWithinMs: number | null;
  readonly notifyWithinMs: number | null;
}

const H = 60 * 60 * 1000;
export const SEVERITY_POLICY: Readonly<Record<Severity, SeverityPolicy>> = {
  S0: { containWithinMs: 1 * H, notifyWithinMs: 24 * H },
  S1: { containWithinMs: 4 * H, notifyWithinMs: 48 * H },
  S2: { containWithinMs: 24 * H, notifyWithinMs: null },
  S3: { containWithinMs: null, notifyWithinMs: null },
};

export function classifyIncident(s: IncidentSignals): Severity {
  if (!Number.isFinite(s.availabilityImpactPct) || s.availabilityImpactPct < 0 || s.availabilityImpactPct > 100) {
    throw new RangeError("INCIDENT: availabilityImpactPct must be in [0,100]");
  }
  if (!Number.isInteger(s.affectedSubjects) || s.affectedSubjects < 0) throw new RangeError("INCIDENT: affectedSubjects must be a non-negative integer");
  if (s.privilegedCredentialsExposed || (s.activeExploitation && (s.personalDataExposed || s.integrityCompromised)) || s.availabilityImpactPct >= 80) return "S0";
  if (s.personalDataExposed || s.integrityCompromised || s.activeExploitation || s.availabilityImpactPct >= 30) return "S1";
  if (s.availabilityImpactPct >= 5 || s.affectedSubjects > 0) return "S2";
  return "S3";
}

const TRANSITIONS: Readonly<Record<IncidentState, readonly IncidentState[]>> = {
  DETECTED: ["TRIAGED"],
  TRIAGED: ["CONTAINED"],
  CONTAINED: ["ERADICATED"],
  ERADICATED: ["RECOVERED"],
  RECOVERED: ["CLOSED"],
  CLOSED: [],
};

export interface TimelineEntry {
  readonly at: string;
  readonly state: IncidentState;
  readonly actor: string;
  readonly note: string;
  readonly previousHash: string;
  readonly hash: string;
}

export interface DeadlineReport {
  readonly containOverdue: boolean;
  readonly notifyOverdue: boolean;
  readonly containDueAt: string | null;
  readonly notifyDueAt: string | null;
}

const ZERO = "0".repeat(64);

function entryHash(e: Omit<TimelineEntry, "hash">): string {
  return createHash("sha256").update(JSON.stringify([e.at, e.state, e.actor, e.note, e.previousHash])).digest("hex");
}

export class Incident {
  private current: IncidentState = "DETECTED";
  private readonly log: TimelineEntry[] = [];
  private notifiedAt: number | null = null;
  private containedAt: number | null = null;

  constructor(readonly id: string, readonly severity: Severity, readonly detectedAt: number, actor: string, note = "detected") {
    this.push("DETECTED", actor, note, detectedAt);
  }

  private push(state: IncidentState, actor: string, note: string, at: number): void {
    if (typeof actor !== "string" || actor.trim().length === 0) throw new Error("INCIDENT: actor is required");
    const previousHash = this.log[this.log.length - 1]?.hash ?? ZERO;
    const base = { at: new Date(at).toISOString(), state, actor: actor.trim(), note, previousHash };
    this.log.push({ ...base, hash: entryHash(base) });
  }

  get state(): IncidentState {
    return this.current;
  }

  timeline(): readonly TimelineEntry[] {
    return this.log.map((e) => ({ ...e }));
  }

  advance(to: IncidentState, actor: string, note: string, now: number = Date.now()): void {
    if (!TRANSITIONS[this.current].includes(to)) throw new Error(`INCIDENT: illegal transition ${this.current} -> ${to}`);
    if (to === "CLOSED" && note.trim().length === 0) throw new Error("INCIDENT: closing requires a post-mortem reference in note");
    this.push(to, actor, note, now);
    this.current = to;
    if (to === "CONTAINED") this.containedAt = now;
  }

  recordNotification(now: number = Date.now()): void {
    if (this.notifiedAt === null) this.notifiedAt = now;
  }

  deadlines(now: number = Date.now()): DeadlineReport {
    const p = SEVERITY_POLICY[this.severity];
    const containDue = p.containWithinMs === null ? null : this.detectedAt + p.containWithinMs;
    const notifyDue = p.notifyWithinMs === null ? null : this.detectedAt + p.notifyWithinMs;
    const containDone = this.containedAt !== null;
    const notifyDone = this.notifiedAt !== null;
    return {
      containOverdue: containDue !== null && (containDone ? (this.containedAt as number) > containDue : now > containDue),
      notifyOverdue: notifyDue !== null && (notifyDone ? (this.notifiedAt as number) > notifyDue : now > notifyDue),
      containDueAt: containDue === null ? null : new Date(containDue).toISOString(),
      notifyDueAt: notifyDue === null ? null : new Date(notifyDue).toISOString(),
    };
  }

  verifyTimeline(): boolean {
    let prev = ZERO;
    for (const e of this.log) {
      const { hash, ...rest } = e;
      if (e.previousHash !== prev || entryHash(rest) !== hash) return false;
      prev = hash;
    }
    return true;
  }
}
