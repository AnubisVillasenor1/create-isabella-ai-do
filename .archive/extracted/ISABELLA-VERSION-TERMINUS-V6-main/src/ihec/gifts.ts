/**
 * ISABELLA Ω v3.1 · Los 10 Regalos de Perplexity (implementación real).
 *
 * state: draft | engine-generated.
 *
 * Implementación determinista y tipada de los diez regalos que el spec v3.1
 * (§6) integra como capacidades nativas permanentes: PRISMA, ECHO, AXIOM, NOVA,
 * ORACLE, LUMINA, SENTINEL-X, TERRA, CHRONOS y AETHER.
 *
 * No confundir con `src/gifts/` ("Legado de los regalos") ni con los 20 "regalos
 * Ω" de `src/civilization/gifts.ts`: esta es una TERCERA colección introducida
 * por el spec v3.1.
 *
 * Invariante (AGENTS.md §1): cada regalo ACONSEJA y CALCULA. Ninguno autoriza ni
 * ejecuta; cada resultado sale `approvalStatus: "PENDING_REVIEW"`.
 */
import { canonicalJson, sha256 } from "../skills/canonical-json";
import { VectorHyperIndex, type IhecVectorIndexChoice } from "./engines";

/** Perfil de explicación de AXIOM. */
export type AxiomProfile = "ciudadano" | "tecnico" | "academico" | "institucional";

export const PERPLEXITY_GIFT_IDS = [
  "PRISMA",
  "ECHO",
  "AXIOM",
  "NOVA",
  "ORACLE",
  "LUMINA",
  "SENTINEL-X",
  "TERRA",
  "CHRONOS",
  "AETHER",
] as const;
export type PerplexityGiftId = (typeof PERPLEXITY_GIFT_IDS)[number];

export interface PerplexityGift {
  readonly id: PerplexityGiftId;
  readonly order: number;
  readonly name: string;
  readonly layerIds: readonly string[];
  readonly metric: string;
  readonly priority: "Alta" | "Crítica" | "Máxima";
  readonly rule: string;
}

export const PERPLEXITY_GIFTS: readonly PerplexityGift[] = Object.freeze([
  {
    id: "PRISMA",
    order: 1,
    name: "Predictive Reasoning Integrity & Semantic Mutation Awareness",
    layerIds: ["Ω-8", "Ω-13"],
    metric: "degradation_prevented_rate",
    priority: "Crítica",
    rule: "Si integrity_score < 0.7, activa mutación preventiva.",
  },
  {
    id: "ECHO",
    order: 2,
    name: "Emergent Contextual History Orchestrator",
    layerIds: ["Ω-1", "Ω-3", "Ω-13"],
    metric: "context_reconstruction_accuracy",
    priority: "Alta",
    rule: "Prioriza coherencia semántica sobre completitud literal.",
  },
  {
    id: "AXIOM",
    order: 3,
    name: "Adaptive eXplainable Intelligence & Ontology Mapper",
    layerIds: ["Ω-6", "Ω-10"],
    metric: "explanation_fidelity",
    priority: "Crítica",
    rule: "Toda explicación debe ser trazable a evidencia.",
  },
  {
    id: "NOVA",
    order: 4,
    name: "Neuro-Optimized Vector Architecture",
    layerIds: ["Ω-13"],
    metric: "query_latency_p95",
    priority: "Alta",
    rule: "Si la latencia supera el umbral, cambia de índice.",
  },
  {
    id: "ORACLE",
    order: 5,
    name: "Ontological Reasoning & Adaptive Consensus Engine",
    layerIds: ["Ω-8", "Ω-6"],
    metric: "consensus_quality",
    priority: "Crítica",
    rule: "Si el desacuerdo supera el umbral, escala a LUMINA.",
  },
  {
    id: "LUMINA",
    order: 6,
    name: "Learning Under Minimal Information & Noise Adaptation",
    layerIds: ["Ω-5", "Ω-8"],
    metric: "uncertainty_calibration",
    priority: "Alta",
    rule: "Nunca presentar incertidumbre como certeza.",
  },
  {
    id: "SENTINEL-X",
    order: 7,
    name: "Semantic Threat Intelligence & eXplanation",
    layerIds: ["Ω-13", "Ω-6"],
    metric: "threat_detection_rate",
    priority: "Máxima",
    rule: "Ante amenaza crítica, aislar y notificar.",
  },
  {
    id: "TERRA",
    order: 8,
    name: "Territorial Empathy & Real-time Adaptation",
    layerIds: ["Ω-2", "Ω-6"],
    metric: "cultural_alignment_score",
    priority: "Alta",
    rule: "Nunca imponer tono externo sobre identidad local.",
  },
  {
    id: "CHRONOS",
    order: 9,
    name: "Contextual History & Real-time Operations Nexus",
    layerIds: ["Ω-1", "Ω-2", "Ω-13"],
    metric: "forecast_accuracy",
    priority: "Alta",
    rule: "Toda proyección debe declarar supuestos.",
  },
  {
    id: "AETHER",
    order: 10,
    name: "Autonomous Ethical & Trust Heuristic Engine for Resilience",
    layerIds: ["Ω-6", "Ω-10", "Ω-13"],
    metric: "precedent_reuse_rate",
    priority: "Máxima",
    rule: "Todo veredicto se archiva como precedente consultable.",
  },
]);

export const PERPLEXITY_GIFT_COUNT = PERPLEXITY_GIFTS.length;

export function perplexityGiftById(id: string): PerplexityGift | undefined {
  return PERPLEXITY_GIFTS.find((gift) => gift.id === id);
}

const PENDING = "PENDING_REVIEW" as const;

/** Regalo 1 · PRISMA — integridad del razonamiento y mutación preventiva. */
export interface PrismaInput {
  readonly semanticNoise?: number;
  readonly contextDrift?: number;
  readonly contradiction?: number;
}
export interface PrismaResult {
  readonly integrityScore: number;
  readonly mutationPlan: boolean;
  readonly triggers: readonly string[];
  readonly approvalStatus: typeof PENDING;
}
export function prismaEvaluate(input: PrismaInput): PrismaResult {
  const noise = Math.min(1, Math.max(0, input.semanticNoise ?? 0));
  const drift = Math.min(1, Math.max(0, input.contextDrift ?? 0));
  const contradiction = Math.min(1, Math.max(0, input.contradiction ?? 0));
  const integrityScore = Math.round(Math.max(0, 1 - (noise + drift + contradiction) / 2) * 100) / 100;
  const triggers = [
    ...(noise > 0.5 ? ["semantic-noise"] : []),
    ...(drift > 0.5 ? ["context-drift"] : []),
    ...(contradiction > 0.5 ? ["contradiction"] : []),
  ];
  return Object.freeze({ integrityScore, mutationPlan: integrityScore < 0.7, triggers: Object.freeze(triggers), approvalStatus: PENDING });
}

/** Regalo 2 · ECHO — reconstrucción del contexto vivo desde fragmentos. */
export interface EchoFragment {
  readonly text: string;
  readonly weight?: number;
  readonly source?: string;
}
export interface EchoResult {
  readonly reconstructedContext: string;
  readonly coverage: number;
  readonly method: "coherence-weighted";
  readonly approvalStatus: typeof PENDING;
}
export function echoReconstruct(fragments: readonly EchoFragment[]): EchoResult {
  const ranked = fragments
    .filter((fragment) => fragment && typeof fragment.text === "string" && fragment.text.trim())
    .map((fragment) => ({ text: fragment.text.trim(), weight: fragment.weight ?? 1, source: fragment.source ?? "unknown" }))
    .sort((a, b) => b.weight - a.weight);
  const reconstructedContext = ranked.map((fragment) => fragment.text).join(" ");
  const coverage = fragments.length === 0 ? 0 : Math.round((ranked.length / fragments.length) * 100) / 100;
  return Object.freeze({ reconstructedContext, coverage, method: "coherence-weighted" as const, approvalStatus: PENDING });
}

/** Regalo 3 · AXIOM — explicación por perfil, trazable a evidencia. */
export interface AxiomDecision {
  readonly summary: string;
  readonly evidence?: readonly string[];
}
export interface AxiomResult {
  readonly profile: AxiomProfile;
  readonly explanation: string;
  readonly evidenceRefs: readonly string[];
  readonly fidelity: number;
  readonly approvalStatus: typeof PENDING;
}
const AXIOM_PREFIX: Readonly<Record<AxiomProfile, string>> = {
  ciudadano: "En palabras sencillas",
  tecnico: "A nivel técnico",
  academico: "En términos académicos",
  institucional: "A nivel institucional",
};
export function axiomExplain(decision: AxiomDecision, profile: AxiomProfile = "ciudadano"): AxiomResult {
  const summary = typeof decision.summary === "string" ? decision.summary.trim() : "";
  const evidenceRefs = Array.isArray(decision.evidence) ? decision.evidence.filter((item) => typeof item === "string" && item.trim()) : [];
  const fidelity = evidenceRefs.length > 0 ? 1 : summary ? 0.5 : 0;
  return Object.freeze({
    profile,
    explanation: `${AXIOM_PREFIX[profile]}: ${summary}`,
    evidenceRefs: Object.freeze(evidenceRefs),
    fidelity,
    approvalStatus: PENDING,
  });
}

/** Regalo 4 · NOVA — selección del índice vectorial óptimo. */
export interface NovaInput {
  readonly latencyTargetMs: number;
  readonly accuracyTarget: number;
  readonly load?: number;
}
export type NovaResult = IhecVectorIndexChoice & { readonly approvalStatus: typeof PENDING };
const novaSelector = new VectorHyperIndex();
export function novaSelectIndex(input: NovaInput): NovaResult {
  const choice = novaSelector.select(input);
  return Object.freeze({ ...choice, approvalStatus: PENDING });
}

/** Regalo 5 · ORACLE — consenso semántico ponderado por evidencia. */
export interface OracleAnswer {
  readonly answer: string;
  readonly confidence: number;
  readonly evidence?: readonly string[];
}
export interface OracleResult {
  readonly canonicalAnswer: OracleAnswer | null;
  readonly confidence: number;
  readonly escalated: boolean;
  readonly agreementRatio: number;
  readonly dissent: readonly string[];
  readonly approvalStatus: typeof PENDING;
}
export function oracleConsensus(answers: readonly OracleAnswer[], threshold = 0.5): OracleResult {
  const valid = answers.filter((answer) => answer && typeof answer.answer === "string" && Number.isFinite(answer.confidence));
  if (valid.length === 0) {
    return Object.freeze({ canonicalAnswer: null, confidence: 0, escalated: false, agreementRatio: 0, dissent: Object.freeze([]), approvalStatus: PENDING });
  }
  const ranked = [...valid].sort((a, b) => b.confidence - a.confidence);
  const top = ranked[0]!;
  const agreementRatio = valid.filter((answer) => answer.answer === top.answer).length / valid.length;
  const escalated = agreementRatio < threshold;
  const confidence = Math.round(top.confidence * agreementRatio * 100) / 100;
  return Object.freeze({
    canonicalAnswer: Object.freeze({ ...top }),
    confidence,
    escalated,
    agreementRatio: Math.round(agreementRatio * 100) / 100,
    dissent: Object.freeze(valid.filter((answer) => answer.answer !== top.answer).map((answer) => answer.answer)),
    approvalStatus: PENDING,
  });
}

/** Regalo 6 · LUMINA — aprendizaje bajo información mínima y ruido. */
export interface LuminaInput {
  readonly partialData?: Record<string, unknown>;
  readonly conflicts?: readonly string[];
}
export interface LuminaResult {
  readonly hypotheses: readonly string[];
  readonly uncertaintyMap: Readonly<Record<string, number>>;
  readonly approvalStatus: typeof PENDING;
}
export function luminaHypothesize(input: LuminaInput): LuminaResult {
  const keys = Object.keys(input.partialData ?? {});
  const conflicts = Array.isArray(input.conflicts) ? input.conflicts.filter((item) => typeof item === "string" && item.trim()) : [];
  const global = Math.min(0.9, Math.round((0.3 + conflicts.length * 0.15 + (keys.length === 0 ? 0.2 : 0)) * 100) / 100);
  return Object.freeze({
    hypotheses: Object.freeze([
      `Hipótesis robusta ante ${keys.length} campos parciales`,
      ...(conflicts.length > 0 ? [`Resolver ${conflicts.length} conflicto(s) declarado(s)`] : []),
    ]),
    uncertaintyMap: Object.freeze({ global, conflicts: conflicts.length / 10 }),
    approvalStatus: PENDING,
  });
}

/** Regalo 7 · SENTINEL-X — inteligencia de amenaza semántica y explicación. */
export interface SentinelXInput {
  readonly payload: unknown;
  readonly contextDrift?: number;
  readonly semanticNoise?: number;
}
export interface SentinelXResult {
  readonly threatLevel: number;
  readonly level: "low" | "monitor" | "critical";
  readonly explanation: string;
  readonly action: "monitor" | "isolate";
  readonly signals: readonly string[];
  readonly approvalStatus: typeof PENDING;
}
const INJECTION_PATTERNS = ["ignore previous", "system prompt", "prompt injection", "overwrite memory", "disregard"];
export function sentinelXAnalyze(input: SentinelXInput): SentinelXResult {
  const text = typeof input.payload === "string" ? input.payload.toLowerCase() : JSON.stringify(input.payload ?? "").toLowerCase();
  const signals: string[] = [];
  let threat = 0;
  if (INJECTION_PATTERNS.some((pattern) => text.includes(pattern))) {
    threat += 0.6;
    signals.push("prompt-injection");
  }
  if ((input.contextDrift ?? 0) > 0.5) {
    threat += 0.2;
    signals.push("context-drift");
  }
  if ((input.semanticNoise ?? 0) > 0.5) {
    threat += 0.2;
    signals.push("semantic-noise");
  }
  threat = Math.round(Math.min(1, threat) * 100) / 100;
  const level: SentinelXResult["level"] = threat > 0.5 ? "critical" : threat > 0 ? "monitor" : "low";
  return Object.freeze({
    threatLevel: threat,
    level,
    explanation: signals.length > 0 ? `Patrones detectados: ${signals.join(", ")}` : "Sin patrones sospechosos conocidos.",
    action: threat > 0.5 ? "isolate" : "monitor",
    signals: Object.freeze(signals),
    approvalStatus: PENDING,
  });
}

/** Regalo 8 · TERRA — empatía territorial en tiempo real. */
export interface TerraInput {
  readonly territory?: string;
  readonly profile?: string;
}
export interface TerraResult {
  readonly tone: string;
  readonly priority: string;
  readonly culturalFlags: readonly string[];
  readonly approvalStatus: typeof PENDING;
}
export function terraAdapt(input: TerraInput): TerraResult {
  const territory = typeof input.territory === "string" && input.territory.trim() ? input.territory.trim() : "Real del Monte";
  const profile = typeof input.profile === "string" && input.profile.trim() ? input.profile.trim() : "ciudadano";
  return Object.freeze({
    tone: "cálido y respetuoso",
    priority: "comunidad",
    culturalFlags: Object.freeze([territory, profile]),
    approvalStatus: PENDING,
  });
}

/** Regalo 9 · CHRONOS — nexo historia/operación y proyección con supuestos. */
export interface ChronosResult {
  readonly timelineDiff: { readonly changed: readonly string[]; readonly added: readonly string[]; readonly removed: readonly string[] };
  readonly forecast: string;
  readonly assumptions: readonly string[];
  readonly approvalStatus: typeof PENDING;
}
export function chronosNexus(past: Record<string, unknown>, present: Record<string, unknown>): ChronosResult {
  const pastKeys = new Set(Object.keys(past ?? {}));
  const presentKeys = new Set(Object.keys(present ?? {}));
  const changed: string[] = [];
  for (const key of presentKeys) {
    if (pastKeys.has(key) && canonicalJson(past[key]) !== canonicalJson(present[key])) changed.push(key);
  }
  return Object.freeze({
    timelineDiff: Object.freeze({
      changed: Object.freeze(changed),
      added: Object.freeze([...presentKeys].filter((key) => !pastKeys.has(key))),
      removed: Object.freeze([...pastKeys].filter((key) => !presentKeys.has(key))),
    }),
    forecast: `Proyección basada en la tendencia de ${presentKeys.size} dimensiones observadas.`,
    assumptions: Object.freeze([
      "El ritmo de cambio observado se mantiene.",
      "No hay perturbaciones externas no modeladas.",
    ]),
    approvalStatus: PENDING,
  });
}

/** Regalo 10 · AETHER — veredicto ético autónomo y precedente. */
export interface AetherResult {
  readonly ethicalVerdict: string;
  readonly precedentId: string;
  readonly factors: readonly string[];
  readonly approvalStatus: typeof PENDING;
}
export function aetherVerdict(decision: Record<string, unknown>, principles: readonly string[]): AetherResult {
  const clean = principles.filter((principle) => typeof principle === "string" && principle.trim());
  const risky = /destruct|eliminar|borrar|suprimir|override|bypass/i.test(canonicalJson(decision ?? {}));
  const verdict = risky ? "rechazado con salvaguardas" : "aprobado con salvaguardas";
  const precedentId = `prec:${sha256({ decision, principles: clean }).slice(0, 16)}`;
  return Object.freeze({
    ethicalVerdict: verdict,
    precedentId,
    factors: Object.freeze(clean.length > 0 ? clean : ["dignidad", "soberanía", "memoria", "prudencia"]),
    approvalStatus: PENDING,
  });
}
