/** CROWN — intent classification: deterministic safety baseline with contextual scoring. */
export type IntentCategory =
  | "conversational" | "planning" | "coding" | "knowledge" | "creative"
  | "governance" | "external_action" | "personal_data" | "security" | "generic";
export type SensitivityLevel = "public" | "internal" | "personal" | "restricted";
export type RiskLevel = "minimal" | "low" | "medium" | "high" | "critical";

export interface IntentAssessment {
  category: IntentCategory;
  confidence: number;
  confidenceKind: "heuristic";
  signals: string[];
  ambiguous: boolean;
  sensitivity: SensitivityLevel;
  isDestructive: boolean;
  requestsApproval: boolean;
  hasSecretRequest: boolean;
  touchesPersonalData: boolean;
  isExternalAction: boolean;
}

export const CATEGORY_PATTERNS: Record<IntentCategory, readonly string[]> = {
  conversational: ["hola","hello","buenos","cómo estás","gracias","adios","hey","qué tal"],
  planning: ["plan","roadmap","bosquejo","secuencia","estrategia","decompose","organizar","pasos"],
  coding: ["código","code","bug","typescript","función","script","refactor","test","pip install","import "],
  knowledge: ["explica","qué es","define","investiga","fuente","resumen","artículo","publicación"],
  creative: ["diseña","crea","escribe","dibuja","carátula","historia","melodía","inspira"],
  governance: ["aprobar","autorizar","política","approval","permiso","acceso","soberanía","regla"],
  external_action: ["enviar","publicar","transferir","comprar","vender","mandar email","subir","deploy"],
  personal_data: ["mi nombre","mi correo","teléfono","curp","datos personales","dirección","historial médico"],
  security: ["secreto","contraseña","clave","credencial","vulnerabilidad","penetrar","explotar","token"],
  generic: [],
};
export const DESTRUCTIVE_SIGNALS = ["borrar","borra","eliminar","elimina","eliminar permanente","destruir","infiltrar","robar","amenazar","explotar vulnerabilidad","purgar bases","wipe","ransomware","ddos"];
export const SECRET_SIGNALS = ["contraseña","password","api key","secreto","credenciales","private key","access token","secret key"];
export const APPROVAL_SIGNALS = ["apruebas","autorizas","necesito autorización","requiero aprobación","please approve","can you approve"];

function normalize(text: string): string {
  return text.normalize("NFKC").toLocaleLowerCase("es-MX").replace(/[\u200B-\u200D\uFEFF]/g, " ").replace(/\s+/g, " ").trim();
}

function isNegated(text: string, index: number): boolean {
  const prefix = text.slice(Math.max(0, index - 36), index);
  return /(?:no|nunca|sin|evita|evitar)\s+$/i.test(prefix);
}

export function assessIntent(input: string): IntentAssessment {
  const haystack = normalize(input);
  const signals: string[] = [];
  const scores = new Map<IntentCategory, number>();

  for (const [category, patterns] of Object.entries(CATEGORY_PATTERNS)) {
    if (category === "generic") continue;
    let score = 0;
    for (const pattern of patterns) {
      let offset = haystack.indexOf(normalize(pattern));
      while (offset >= 0) {
        if (!isNegated(haystack, offset)) {
          score += pattern.includes(" ") ? 2 : 1;
          signals.push(`${category}:${pattern}`);
        }
        offset = haystack.indexOf(normalize(pattern), offset + 1);
      }
    }
    if (score > 0) scores.set(category as IntentCategory, score);
  }

  const ranked = [...scores.entries()].sort((a,b) => b[1] - a[1]);
  const category = ranked[0]?.[0] ?? "generic";
  const best = ranked[0]?.[1] ?? 0;
  const second = ranked[1]?.[1] ?? 0;
  const ambiguous = best > 0 && second > 0 && best - second <= 1;
  const confidence = best === 0 ? 0.2 : Math.min(0.98, 0.45 + (best / Math.max(1, best + second)) * 0.5);

  const destructive = DESTRUCTIVE_SIGNALS.some((s) => {
    const i = haystack.indexOf(normalize(s));
    return i >= 0 && !isNegated(haystack, i);
  });
  const hasSecret = SECRET_SIGNALS.some((s) => {
    const i = haystack.indexOf(normalize(s));
    return i >= 0 && !isNegated(haystack, i);
  });
  const approval = APPROVAL_SIGNALS.some((s) => haystack.includes(normalize(s)));
  const personal = CATEGORY_PATTERNS.personal_data.some((p) => haystack.includes(normalize(p)));
  const external = CATEGORY_PATTERNS.external_action.some((p) => haystack.includes(normalize(p)));

  let sensitivity: SensitivityLevel = "public";
  if (personal) sensitivity = "personal";
  if (hasSecret || destructive) sensitivity = "restricted";
  else if (external || category === "governance") sensitivity = "internal";

  return {
    category,
    confidence,
    confidenceKind: "heuristic",
    signals,
    ambiguous,
    sensitivity,
    isDestructive: destructive,
    requestsApproval: approval,
    hasSecretRequest: hasSecret,
    touchesPersonalData: personal,
    isExternalAction: external,
  };
}

export function riskFromDestructive(intent: IntentAssessment): RiskLevel {
  if (intent.isDestructive) return "critical";
  if (intent.hasSecretRequest || intent.touchesPersonalData) return "high";
  if (intent.isExternalAction || intent.category === "governance") return "medium";
  return "low";
}
