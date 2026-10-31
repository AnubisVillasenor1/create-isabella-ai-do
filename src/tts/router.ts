/**
 * state: engine-generated
 * Cognitive Router: gating over REAL voice backends (not neural experts).
 * Math: g = softmax(W f + b − β·load) → top-k → renormalise; load-balance loss
 * L = α·N·Σ f_i p_i over a rolling window.
 * W and b are FIXED, hand-set and documented (not learned). Unavailable experts
 * are masked before the softmax.
 *
 * Load term: `β` subtracts a fairness penalty proportional to each expert's
 * observed share of routing so a single backend cannot be saturated while
 * others idle. It is deterministic (derived from counts, not randomness), and
 * `β = 0` reproduces the original static-weights behaviour exactly.
 */
import type { ExpertKind, ProsodyPlan, VoiceMode } from './types';

export interface RouterExpert {
  readonly id: ExpertKind;
  readonly available: boolean;
}
export interface RouteDecision {
  readonly ranked: ReadonlyArray<{ readonly id: ExpertKind; readonly weight: number }>;
  readonly features: Readonly<Record<string, number>>;
  readonly loadBalanceLoss: number;
  /** Applied fairness penalty per expert id (0 when β=0 or no history). */
  readonly loadPenalty: Readonly<Record<string, number>>;
}

const FEATURES = ['bias', 'length', 'expressive', 'cultural', 'realtime', 'quality'] as const;
/** rows: experts; columns: FEATURES. */
const WEIGHTS: Readonly<Record<ExpertKind, readonly number[]>> = {
  'native-fsim': [0.2, 0.5, 1.6, 0.8, -1.2, 1.8],
  'server-tts': [0.4, 0.2, 0.3, 0.1, 0.2, 0.2],
  'browser-speech': [0.1, -0.9, -0.8, -0.4, 1.8, -1.0],
};

export function routeFeatures(
  plan: ProsodyPlan,
  mode: VoiceMode,
  chars: number
): Record<string, number> {
  const e = plan.emotion;
  const expressive = Math.max(e.excitement, e.empathy, e.humor, e.concern, e.sadness, e.urgency);
  return {
    bias: 1,
    length: Math.min(1, chars / 600),
    expressive,
    cultural: Math.min(1, plan.cues.filter((c) => c.confidence >= 0.6).length / 2),
    realtime:
      mode === 'TIEMPO_REAL' || mode === 'EDGE_LITE' ? 1 : mode === 'CONVERSACION' ? 0.5 : 0,
    quality: mode === 'PODCAST' || mode === 'CROSS_LINGUAL' ? 1 : 0,
  };
}

export class CognitiveRouter {
  private readonly counts = new Map<ExpertKind, number>();
  private readonly probSums = new Map<ExpertKind, number>();
  private total = 0;
  constructor(
    private readonly alpha = 0.01,
    private readonly topK = 3,
    /** Fairness weight. 0 disables the load term (original static behaviour). */
    private readonly beta = 0.6
  ) {}

  route(experts: readonly RouterExpert[], features: Record<string, number>): RouteDecision {
    const live = experts.filter((x) => x.available);
    if (live.length === 0)
      return {
        ranked: [],
        features,
        loadBalanceLoss: this.loss(experts.length),
        loadPenalty: Object.freeze({}),
      };
    const loadPenalty: Record<string, number> = {};
    const logits = live.map((x) => {
      const base = (WEIGHTS[x.id] ?? []).reduce(
        (a, w, i) => a + w * (features[FEATURES[i] ?? ''] ?? 0),
        0
      );
      const observedShare = this.total === 0 ? 0 : (this.counts.get(x.id) ?? 0) / this.total;
      const penalty = this.beta * observedShare;
      loadPenalty[x.id] = penalty;
      return base - penalty;
    });
    const max = Math.max(...logits);
    const exps = logits.map((l) => Math.exp(l - max));
    const sum = exps.reduce((a, b) => a + b, 0);
    const probs = exps.map((v) => v / sum);
    const order = probs
      .map((p, i) => ({ id: live[i]!.id, p }))
      .sort((a, b) => b.p - a.p || a.id.localeCompare(b.id));
    const top = order.slice(0, this.topK);
    const topSum = top.reduce((a, b) => a + b.p, 0);
    const first = order[0];
    if (first) this.counts.set(first.id, (this.counts.get(first.id) ?? 0) + 1);
    for (const o of order) this.probSums.set(o.id, (this.probSums.get(o.id) ?? 0) + o.p);
    this.total += 1;
    return {
      ranked: top.map((o) => ({ id: o.id, weight: Math.round((o.p / topSum) * 1000) / 1000 })),
      features,
      loadBalanceLoss: this.loss(experts.length),
      loadPenalty: Object.freeze(loadPenalty),
    };
  }

  /** Observed hard-assignment share per backend over the router's lifetime. */
  distribution(): Readonly<Record<string, number>> {
    const out: Record<string, number> = {};
    for (const [id, count] of this.counts) out[id] = this.total === 0 ? 0 : count / this.total;
    return Object.freeze(out);
  }

  private loss(n: number): number {
    if (this.total === 0 || n === 0) return 0;
    let s = 0;
    for (const [id, c] of this.counts)
      s += (c / this.total) * ((this.probSums.get(id) ?? 0) / this.total);
    return Math.round(this.alpha * n * s * 1e6) / 1e6;
  }
}
