/**
 * IHEC Cognitive Immune System (Ω-14) — sistema inmune cognitivo (state: draft | engine-generated).
 *
 * Sentinel, Recovery, Mutation, Adaptation, Self-Healing y Crisis Memory. Convierte cada fallo en un
 * anticuerpo cognitivo reutilizable. Crisis Memory almacena incidentes, postmortems, lecciones y patrones.
 *
 * CAPABILITY ≠ AUTHORITY ≠ EXECUTION ≠ EVIDENCE ≠ LEARNING ≠ PRODUCTION.
 */
export type ThreatSeverity = 'low' | 'medium' | 'high' | 'critical';

export interface CrisisRecord {
  readonly id: string;
  readonly incident: string;
  readonly severity: ThreatSeverity;
  readonly detectedAt: string;
  readonly resolvedAt?: string;
  readonly postmortem?: string;
  readonly lessons: readonly string[];
  readonly patterns: readonly string[];
  readonly antibody?: string;
}

export interface ThreatAssessment {
  readonly threat: string;
  readonly severity: ThreatSeverity;
  readonly score: number;
  readonly recommendedAction: 'monitor' | 'isolate' | 'recover' | 'escalate';
}

export class CognitiveImmuneSystem {
  private readonly crises = new Map<string, CrisisRecord>();
  private readonly antibodies = new Map<string, string>();
  private seq = 0;

  reportIncident(input: {
    incident: string;
    severity: ThreatSeverity;
    patterns?: readonly string[];
  }): CrisisRecord {
    if (typeof input.incident !== 'string' || input.incident.length === 0)
      throw new RangeError('IHEC: incident required');
    const id = `crisis-${(this.seq += 1)}`;
    const record: CrisisRecord = {
      id,
      incident: input.incident,
      severity: input.severity,
      detectedAt: new Date().toISOString(),
      lessons: [],
      patterns: [...(input.patterns ?? [])],
    };
    this.crises.set(id, record);
    return record;
  }

  resolve(id: string, postmortem: string, lessons: readonly string[] = []): CrisisRecord {
    const c = this.crises.get(id);
    if (c === undefined) throw new RangeError('IHEC: unknown crisis');
    const resolved: CrisisRecord = {
      ...c,
      resolvedAt: new Date().toISOString(),
      postmortem,
      lessons: [...lessons],
    };
    this.crises.set(id, resolved);
    // Ω-14: convierte el fallo en anticuerpo cognitivo
    const antibody = `antibody:${c.incident.slice(0, 40)}:${c.severity}`;
    this.antibodies.set(c.incident, antibody);
    this.crises.set(id, { ...resolved, antibody });
    return this.crises.get(id) as CrisisRecord;
  }

  assess(
    threat: string,
    indicators: { anomalyScore: number; blastRadius: number; recurrence: number }
  ): ThreatAssessment {
    if (typeof threat !== 'string' || threat.length === 0)
      throw new RangeError('IHEC: threat required');
    const score = Math.min(
      1,
      indicators.anomalyScore * 0.5 + indicators.blastRadius * 0.3 + indicators.recurrence * 0.2
    );
    let severity: ThreatSeverity = 'low';
    if (score >= 0.8) severity = 'critical';
    else if (score >= 0.6) severity = 'high';
    else if (score >= 0.3) severity = 'medium';
    let recommendedAction: ThreatAssessment['recommendedAction'] = 'monitor';
    if (severity === 'critical') recommendedAction = 'escalate';
    else if (severity === 'high') recommendedAction = 'isolate';
    else if (severity === 'medium') recommendedAction = 'recover';
    return { threat, severity, score, recommendedAction };
  }

  hasAntibody(incident: string): boolean {
    return this.antibodies.has(incident);
  }
  getAntibody(incident: string): string | undefined {
    return this.antibodies.get(incident);
  }

  selfHeal(id: string): { healed: boolean; antibody?: string } {
    const c = this.crises.get(id);
    if (c === undefined) return { healed: false };
    const antibody = this.antibodies.get(c.incident);
    if (antibody === undefined) return { healed: false };
    return { healed: true, antibody };
  }

  mutate(id: string, newPattern: string): CrisisRecord {
    const c = this.crises.get(id);
    if (c === undefined) throw new RangeError('IHEC: unknown crisis');
    const mutated: CrisisRecord = { ...c, patterns: [...c.patterns, newPattern] };
    this.crises.set(id, mutated);
    return mutated;
  }

  adapt(threshold: number): { adapted: boolean; newThreshold: number } {
    if (!Number.isFinite(threshold) || threshold < 0 || threshold > 1)
      throw new RangeError('IHEC: threshold 0..1');
    const newThreshold = Math.max(0.1, threshold * 0.9);
    return { adapted: true, newThreshold };
  }

  crisisMemory(): readonly CrisisRecord[] {
    return [...this.crises.values()];
  }
  openCrises(): readonly CrisisRecord[] {
    return [...this.crises.values()].filter((c) => c.resolvedAt === undefined);
  }

  stats(): { total: number; open: number; resolved: number; antibodies: number } {
    const all = [...this.crises.values()];
    return {
      total: all.length,
      open: all.filter((c) => c.resolvedAt === undefined).length,
      resolved: all.filter((c) => c.resolvedAt !== undefined).length,
      antibodies: this.antibodies.size,
    };
  }
}
