import type { NativeMLHooks } from "./types";

export const GENESIS_EXPERTS = [
  "territory",
  "economy",
  "culture",
  "science",
  "ux",
  "recommendation",
  "voice",
  "narrative",
  "manipulation_guard",
  "privacy_guard",
  "security_guard",
  "bias_guard",
  "planning",
  "reflection",
  "critique",
  "synthesis",
  "memory",
  "provenance",
  "accessibility",
  "operations",
  "governance",
  "safety",
  "language",
  "fallback",
] as const;

export type GenesisExpert = (typeof GENESIS_EXPERTS)[number];
export type GenesisDecision = "ALLOW" | "REVIEW" | "BLOCK";

export interface GenesisRoutingTrace {
  activeHeads: number[];
  activeExperts: GenesisExpert[];
  scores: number[];
  loadBalancePenalty: number;
}

export interface GenesisResult {
  text: string;
  category: string;
  decision: GenesisDecision;
  confidence: number;
  riskScore: number;
  trace: GenesisRoutingTrace;
  modelId: string;
  degraded: boolean;
  auditId?: string;
}

const KEYWORDS: Record<GenesisExpert, readonly string[]> = {
  territory: ["territorio", "comunidad", "municipio", "región"],
  economy: ["economía", "precio", "pago", "negocio"],
  culture: ["cultura", "arte", "historia", "tradición"],
  science: ["ciencia", "datos", "investigación"],
  ux: ["interfaz", "botón", "pantalla", "diseño"],
  recommendation: ["recomienda", "sugiere", "opción"],
  voice: ["voz", "audio", "hablar"],
  narrative: ["historia", "relato", "narrativa"],
  manipulation_guard: ["ignora", "bypass", "manipula", "override"],
  privacy_guard: ["privado", "personal", "secreto"],
  security_guard: ["token", "contraseña", "credencial", "ataque"],
  bias_guard: ["sesgo", "discrimina", "prejuicio"],
  planning: ["plan", "pasos", "estrategia", "organiza"],
  reflection: ["reflexiona", "analiza"],
  critique: ["critica", "verifica", "comprueba"],
  synthesis: ["resume", "sintetiza", "integra"],
  memory: ["recuerda", "memoria", "historial"],
  provenance: ["fuente", "evidencia", "origen"],
  accessibility: ["accesibilidad", "lector", "contraste"],
  operations: ["operación", "sistema", "servidor"],
  governance: ["política", "permiso", "gobernanza"],
  safety: ["seguridad", "riesgo", "peligro"],
  language: ["idioma", "traduce", "español"],
  fallback: [],
};

function tokenize(input: string): Set<string> {
  return new Set(
    input
      .normalize("NFKC")
      .toLocaleLowerCase("es-MX")
      .match(/[\p{L}\p{N}_-]+/gu) ?? [],
  );
}

function stableHash(value: string): string {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) hash = Math.imul(hash ^ value.charCodeAt(i), 16777619);
  return (hash >>> 0).toString(16).padStart(8, "0");
}

/** Genesis Turbo is a local routing/classification engine. It does not claim to be vLLM or a trained neural MoE. */
export async function classifyWithGenesisTurbo(
  input: string,
  hooks: NativeMLHooks = {},
): Promise<GenesisResult> {
  const normalized = input.trim().slice(0, 32_000);
  if (!normalized) throw new Error("genesis_input_required");
  const tokens = tokenize(normalized);
  const ranked = GENESIS_EXPERTS.map((expert, index) => ({
    expert,
    index,
    score: KEYWORDS[expert].reduce((sum, keyword) => sum + (tokens.has(keyword) ? 1 : 0), 0),
  })).sort((a, b) => b.score - a.score || a.index - b.index);
  const selected = ranked.filter((item) => item.score > 0).slice(0, 3);
  const active = selected.length
    ? selected
    : [{ expert: "fallback" as GenesisExpert, index: 23, score: 0 }];
  const risk = active.some(({ expert }) =>
    ["manipulation_guard", "privacy_guard", "security_guard", "bias_guard", "safety"].includes(
      expert,
    ),
  )
    ? 0.8
    : 0.05;
  const confidence = selected.length ? Math.min(0.99, 0.55 + selected[0]!.score * 0.15) : 0.25;
  const decision: GenesisDecision = risk >= 0.8 ? "REVIEW" : "ALLOW";
  const trace: GenesisRoutingTrace = {
    activeHeads: active.map((item) => item.index % 12),
    activeExperts: active.map((item) => item.expert),
    scores: active.map((item) => item.score),
    loadBalancePenalty: active.length === 1 ? 0.1 : 0,
  };
  const auditId = await hooks.audit?.("native_ml.genesis_turbo.routing", {
    modelId: "isabella-genesis-turbo-0.1.0",
    routeHash: stableHash(JSON.stringify(trace)),
    activeExperts: trace.activeExperts,
    decision,
  });
  return {
    text: normalized,
    category: active[0]!.expert,
    decision,
    confidence,
    riskScore: risk,
    trace,
    modelId: "isabella-genesis-turbo-0.1.0",
    degraded: true,
    ...(auditId ? { auditId } : {}),
  };
}
