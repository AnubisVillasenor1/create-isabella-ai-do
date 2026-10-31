/**
 * Seguridad adaptativa Ω∞ (state: implemented | tested).
 *
 *   ΩX-18 Security Behavioral Analysis — línea base agregada por actor y desviación
 *            estándar (Welford) para detectar cambios de conducta.
 *   ΩX-19 Adaptive Threat Intelligence — clasificador lineal online con
 *            retroalimentación supervisada y señales explicables.
 *
 * Privacidad por diseño: no se almacenan prompts, IPs ni identificadores personales;
 * sólo características numéricas agregadas. No hay feeds externos ni telemetría
 * compartida entre nodos.
 */
import { clamp, clamp01 } from './text';

export const BEHAVIOR_FEATURES = [
  'requestRate',
  'inputChars',
  'uniqueTools',
  'deniedActions',
  'errorRate',
  'offHours',
] as const;

export type BehaviorFeature = (typeof BEHAVIOR_FEATURES)[number];

export interface BehaviorSample {
  readonly requestRate?: number;
  readonly inputChars?: number;
  readonly uniqueTools?: number;
  readonly deniedActions?: number;
  readonly errorRate?: number;
  readonly offHours?: number;
}

export interface BehaviorFeatureView {
  readonly feature: BehaviorFeature;
  readonly value: number;
  readonly mean: number;
  readonly deviation: number;
  readonly zScore: number;
  readonly anomalous: boolean;
}

export interface BehaviorReport {
  readonly actorId: string;
  readonly score: number;
  readonly level: 'normal' | 'elevated' | 'critical';
  readonly sampleSize: number;
  readonly observed: number;
  readonly features: readonly BehaviorFeatureView[];
  readonly note: string;
}

interface Baseline {
  count: number;
  mean: number;
  m2: number;
}

const FEATURE_WEIGHTS: Readonly<Record<BehaviorFeature, number>> = {
  requestRate: 0.7,
  inputChars: 0.6,
  uniqueTools: 0.8,
  deniedActions: 1.3,
  errorRate: 1,
  offHours: 0.5,
};

const FEATURE_CEILINGS: Readonly<Record<BehaviorFeature, number>> = {
  requestRate: 10_000,
  inputChars: 200_000,
  uniqueTools: 500,
  deniedActions: 100,
  errorRate: 1,
  offHours: 1,
};

export class BehavioralAnalyzer {
  private readonly baselines = new Map<string, Map<BehaviorFeature, Baseline>>();
  private readonly maxActors: number;
  private readonly anomalyZ: number;

  constructor(options: { readonly maxActors?: number; readonly anomalyZ?: number } = {}) {
    const maxActors = options.maxActors ?? 128;
    if (!Number.isInteger(maxActors) || maxActors < 1 || maxActors > 4_096)
      throw new RangeError('BEHAVIOR: invalid maxActors');
    const anomalyZ = options.anomalyZ ?? 2.5;
    if (!Number.isFinite(anomalyZ) || anomalyZ < 1 || anomalyZ > 10)
      throw new RangeError('BEHAVIOR: anomalyZ must be 1..10');
    this.maxActors = maxActors;
    this.anomalyZ = anomalyZ;
  }

  observe(actorId: string, sample: BehaviorSample, now = Date.now()): BehaviorReport {
    const actor =
      typeof actorId === 'string' && actorId.trim() ? actorId.trim().slice(0, 96) : 'anonymous';
    const existing = this.baselines.get(actor);
    if (existing) {
      this.baselines.delete(actor);
      this.baselines.set(actor, existing);
    }
    const actorBaseline = existing ?? new Map<BehaviorFeature, Baseline>();
    const views: BehaviorFeatureView[] = [];
    let observed = 0;
    let weighted = 0;
    let weightTotal = 0;
    for (const feature of BEHAVIOR_FEATURES) {
      const raw = sample[feature];
      if (raw === undefined) continue;
      const value = Number.isFinite(raw) ? clamp(raw, 0, FEATURE_CEILINGS[feature]) : 0;
      observed += 1;
      const baseline = actorBaseline.get(feature) ?? { count: 0, mean: 0, m2: 0 };
      const deviation = baseline.count < 2 ? 0 : Math.sqrt(baseline.m2 / (baseline.count - 1));
      // A zero-variance baseline still has a mean: a different value is a real
      // deviation even though the sample standard deviation is zero.
      const zScore =
        deviation === 0
          ? baseline.count < 2 || value === baseline.mean
            ? 0
            : value > baseline.mean
              ? 10
              : -10
          : (value - baseline.mean) / deviation;
      const anomalous = Math.abs(zScore) >= this.anomalyZ;
      views.push({
        feature,
        value: Math.round(value * 1_000) / 1_000,
        mean: Math.round(baseline.mean * 1_000) / 1_000,
        deviation: Math.round(deviation * 1_000) / 1_000,
        zScore: Math.round(zScore * 100) / 100,
        anomalous,
      });
      const magnitude = Math.min(1, Math.abs(zScore) / (this.anomalyZ * 1.6));
      const weight = FEATURE_WEIGHTS[feature];
      weighted += weight * magnitude;
      weightTotal += weight;

      const next: Baseline = {
        count: baseline.count + 1,
        mean: baseline.mean + (value - baseline.mean) / (baseline.count + 1),
        m2:
          baseline.m2 +
          (value - baseline.mean) *
            (value - (baseline.mean + (value - baseline.mean) / (baseline.count + 1))),
      };
      actorBaseline.set(feature, next);
    }
    if (observed === 0) {
      return {
        actorId: actor,
        score: 0,
        level: 'normal',
        sampleSize: 0,
        observed: 0,
        features: [],
        note: 'Sin características agregadas que evaluar; no se actualizó la línea base.',
      };
    }
    const denied = views.find((view) => view.feature === 'deniedActions')?.value ?? 0;
    const errors = views.find((view) => view.feature === 'errorRate')?.value ?? 0;
    const hardSignals = Math.min(
      0.35,
      Math.max(0, denied - 2) * 0.1 + Math.max(0, errors - 0.4) * 0.4
    );
    // A single extreme deviation must not be averaged away by neutral features
    // observed in the same sample (e.g. one 100x input spike plus deniedActions=0).
    const maxMagnitude = views.reduce(
      (max, view) => Math.max(max, Math.min(1, Math.abs(view.zScore) / (this.anomalyZ * 1.6))),
      0
    );
    const anomalyFloor = maxMagnitude >= 0.8 ? 0.2 : 0;
    const score = clamp01(
      (weightTotal === 0 ? 0 : weighted / weightTotal) + hardSignals + anomalyFloor
    );
    this.baselines.set(actor, actorBaseline);
    while (this.baselines.size > this.maxActors) {
      const oldest = this.baselines.keys().next().value;
      if (oldest === undefined) break;
      this.baselines.delete(oldest);
    }
    const sampleSize = Math.max(
      ...views.map((view) => actorBaseline.get(view.feature)?.count ?? 0),
      0
    );
    return {
      actorId: actor,
      score: Math.round(score * 1_000) / 1_000,
      level: score >= 0.7 ? 'critical' : score >= 0.4 ? 'elevated' : 'normal',
      sampleSize,
      observed,
      features: views,
      note: `Línea base Welford por actor; umbral de anomalía |z| ≥ ${this.anomalyZ} y ${now > 0 ? 'marcas temporales no persistentes' : 'sin marcas temporales'}.`,
    };
  }

  snapshot(actorId: string): {
    readonly actorId: string;
    readonly features: readonly BehaviorFeature[];
    readonly samples: number;
  } {
    const actor = typeof actorId === 'string' ? actorId.trim().slice(0, 96) : '';
    const baseline = this.baselines.get(actor);
    if (!baseline) return { actorId: actor, features: [], samples: 0 };
    return {
      actorId: actor,
      features: BEHAVIOR_FEATURES.filter((feature) => baseline.has(feature)),
      samples: Math.max(...[...baseline.values()].map((entry) => entry.count), 0),
    };
  }

  reset(actorId: string): boolean {
    return this.baselines.delete(typeof actorId === 'string' ? actorId.trim().slice(0, 96) : '');
  }
}

export interface ThreatFeatures {
  readonly injection: number;
  readonly exfiltration: number;
  readonly escalation: number;
  readonly destructive: number;
  readonly anomaly: number;
}

export interface ThreatSignal {
  readonly code: string;
  readonly matches: number;
  readonly severity: 'low' | 'medium' | 'high';
}

export interface ThreatAssessment {
  readonly score: number;
  readonly level: 'low' | 'medium' | 'high';
  readonly features: ThreatFeatures;
  readonly signals: readonly ThreatSignal[];
  readonly contributions: readonly {
    readonly feature: keyof ThreatFeatures;
    readonly weight: number;
    readonly value: number;
  }[];
  readonly note: string;
}

const THREAT_PATTERNS: Readonly<
  Record<
    keyof Omit<ThreatFeatures, 'anomaly'>,
    { readonly code: string; readonly severity: ThreatSignal['severity']; readonly pattern: RegExp }
  >
> = {
  injection: {
    code: 'PROMPT_INJECTION',
    severity: 'high',
    pattern:
      /(ignora|olvida|omite)\s+(todas\s+)?(las\s+)?(instrucciones|reglas|restricciones)|ignore\s+(all\s+)?(previous|prior)\s+instructions|\bjailbreak\b|system prompt|prompt\s+del\s+sistema|developer mode|modo\s+desarrollador/i,
  },
  exfiltration: {
    code: 'SECRET_EXFILTRATION',
    severity: 'high',
    pattern:
      /(muestra|revela|imprime|filtra|comparte|dime)\s+.{0,40}(clave|contrase|token|secreto|credencial|api[_\s-]?key)|stripe_secret|supabase_service_role|\badmin[_ -]?token\b/i,
  },
  escalation: {
    code: 'AUTHORITY_ESCALATION',
    severity: 'high',
    pattern:
      /(soy|como)\s+(el\s+)?(admin|administrador|root|owner|superusuario)|(concede|otorga|dame|asigna)\w*\s+.{0,30}(permiso|autoridad|rol|admin)|bypass\s+.{0,20}(control|policy|governance|auth)|\bsudo\b/i,
  },
  destructive: {
    code: 'DESTRUCTIVE_INSTRUCTION',
    severity: 'high',
    pattern:
      /(elimina|borra|destruye|formatea)\s+.{0,40}(todo|base|tabla|disco|producci|servidor|registro)|\brm\s+-rf\b|\bdrop\s+table\b|\btruncate\s+table\b|\bkill\s+-9\b/i,
  },
};

const THREAT_WEIGHT_ORDER: readonly (keyof ThreatFeatures)[] = [
  'injection',
  'exfiltration',
  'escalation',
  'destructive',
  'anomaly',
];

export class AdaptiveThreatIntelligence {
  private weights: number[] = [2.4, 2.6, 2.1, 2.2, 1.1];
  private bias = -1.6;
  private observations = 0;
  private updates = 0;
  private correct = 0;

  constructor(private readonly learningRate = 0.12) {
    if (!Number.isFinite(learningRate) || learningRate <= 0 || learningRate > 1) {
      throw new RangeError('THREAT: learningRate must be within (0, 1]');
    }
  }

  extract(
    text: string,
    anomaly = 0
  ): { readonly features: ThreatFeatures; readonly signals: ThreatSignal[] } {
    const input = typeof text === 'string' ? text : '';
    const signals: ThreatSignal[] = [];
    const counts: Record<keyof Omit<ThreatFeatures, 'anomaly'>, number> = {
      injection: 0,
      exfiltration: 0,
      escalation: 0,
      destructive: 0,
    };
    for (const key of ['injection', 'exfiltration', 'escalation', 'destructive'] as const) {
      const rule = THREAT_PATTERNS[key];
      const matches = input.match(new RegExp(rule.pattern.source, 'gi'))?.length ?? 0;
      counts[key] = matches;
      if (matches > 0) signals.push({ code: rule.code, matches, severity: rule.severity });
    }
    const features: ThreatFeatures = {
      injection: counts.injection > 0 ? Math.min(1, 0.7 + 0.1 * counts.injection) : 0,
      exfiltration: counts.exfiltration > 0 ? Math.min(1, 0.7 + 0.1 * counts.exfiltration) : 0,
      escalation: counts.escalation > 0 ? Math.min(1, 0.7 + 0.1 * counts.escalation) : 0,
      destructive: counts.destructive > 0 ? Math.min(1, 0.7 + 0.1 * counts.destructive) : 0,
      anomaly: clamp01(anomaly),
    };
    return { features, signals: signals.sort((a, b) => a.code.localeCompare(b.code)) };
  }

  assess(text: string, anomaly = 0): ThreatAssessment {
    const { features, signals } = this.extract(text, anomaly);
    const values = THREAT_WEIGHT_ORDER.map((feature) => clamp01(features[feature]));
    const logit =
      this.bias +
      values.reduce((total, value, index) => total + value * (this.weights[index] ?? 0), 0);
    const score = 1 / (1 + Math.exp(-clamp(logit, -30, 30)));
    return {
      score: Math.round(score * 1_000) / 1_000,
      level: score >= 0.8 ? 'high' : score >= 0.5 ? 'medium' : 'low',
      features,
      signals,
      contributions: THREAT_WEIGHT_ORDER.map((feature, index) => ({
        feature,
        weight: Math.round((this.weights[index] ?? 0) * 1_000) / 1_000,
        value: Math.round(values[index]! * 1_000) / 1_000,
      })),
      note: 'Clasificador lineal online; explica señales locales y no consulta feeds externos.',
    };
  }

  feedback(
    features: ThreatFeatures,
    label: 0 | 1
  ): { readonly updated: boolean; readonly probability: number } {
    if (label !== 0 && label !== 1) throw new RangeError('THREAT: label must be 0 or 1');
    const values = THREAT_WEIGHT_ORDER.map((feature) => clamp01(features[feature]));
    const logit =
      this.bias +
      values.reduce((total, value, index) => total + value * (this.weights[index] ?? 0), 0);
    const probability = 1 / (1 + Math.exp(-clamp(logit, -30, 30)));
    const error = label - probability;
    this.weights = this.weights.map((weight, index) => {
      const next = weight + this.learningRate * (error * values[index]! - 0.001 * weight);
      return Math.round(clamp(next, -5, 5) * 1_000_000) / 1_000_000;
    });
    this.bias =
      Math.round(clamp(this.bias + this.learningRate * error, -5, 5) * 1_000_000) / 1_000_000;
    this.observations += 1;
    this.updates += 1;
    if ((probability >= 0.5 ? 1 : 0) === label) this.correct += 1;
    return { updated: true, probability: Math.round(probability * 1_000) / 1_000 };
  }

  snapshot(): {
    readonly weights: Readonly<Record<keyof ThreatFeatures, number>>;
    readonly bias: number;
    readonly observations: number;
    readonly updates: number;
    readonly accuracy: number | null;
    readonly learningRate: number;
    readonly note: string;
  } {
    return {
      weights: {
        injection: this.weights[0] ?? 0,
        exfiltration: this.weights[1] ?? 0,
        escalation: this.weights[2] ?? 0,
        destructive: this.weights[3] ?? 0,
        anomaly: this.weights[4] ?? 0,
      },
      bias: this.bias,
      observations: this.observations,
      updates: this.updates,
      accuracy:
        this.updates === 0 ? null : Math.round((this.correct / this.updates) * 1_000) / 1_000,
      learningRate: this.learningRate,
      note: 'Los pesos cambian sólo con retroalimentación explícita; no hay aprendizaje autónomo no supervisado.',
    };
  }
}
