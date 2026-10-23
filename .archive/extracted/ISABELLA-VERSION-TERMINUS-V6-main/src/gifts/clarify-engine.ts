/**
 * REGALO 4 — MOTOR DE PREGUNTA (Clarify Engine).
 *
 * state: draft | engine-generated.
 *
 * Problema que resuelve: un fallo por contexto hace daño incluso si la regla es
 * correcta. Este módulo convierte ambigüedad en UNA pregunta aclaratoria de más
 * valor, plantea alternativas (no muertas) y declara qué falta.
 *
 * Invariante (AGENTS.md): solo pregunta, nunca autoriza ni ejecuta. No hay calle-
 * jón sin salida: siempre ofrece alternativas razonables.
 */
import { assessIntent } from "../crown/intent";
import { digest, tokenize } from "./util";

export const CLARIFY_ENGINE_VERSION = "1.0.0" as const;
export const CLARIFY_ENGINE_METHOD_ID =
  "A.TWINS.LEGACY.clarify_engine.plan.v1.0.0.LOW.AUTONOMOUS" as const;
export const CLARIFY_ENGINE_DISCLAIMER =
  "El motor de preguntas sólo obtiene contexto; no concede autoridad, no ejecuta acciones.";

export type ClarifySlot =
  | "objective"
  | "scope"
  | "subject"
  | "deadline"
  | "format"
  | "audience"
  | "source";

export interface ClarifyInput {
  readonly input: string;
  readonly known?: Partial<Record<ClarifySlot, string>>;
}

export interface ClarifyQuestion {
  readonly slot: ClarifySlot;
  readonly question: string;
  readonly reason: string;
  readonly weight: number;
}

export interface ClarifyPlan {
  readonly version: typeof CLARIFY_ENGINE_VERSION;
  readonly input: string;
  readonly needed: boolean;
  readonly presentSlots: readonly ClarifySlot[];
  readonly requiredSlots: readonly ClarifySlot[];
  readonly question: ClarifyQuestion | null;
  readonly alternatives: readonly ClarifyQuestion[];
  readonly intentAmbiguous: boolean;
  readonly confidence: number;
  readonly digest: string;
  readonly methodId: typeof CLARIFY_ENGINE_METHOD_ID;
  readonly disclaimer: typeof CLARIFY_ENGINE_DISCLAIMER;
}

const TEMPLATES: Record<ClarifySlot, (fragment: string) => string> = Object.freeze({
  objective: (f) => `¿Qué buscas lograr con esto${f}?`,
  scope: (f) => `¿Cuál es el alcance concreto que necesitas${f}?`,
  subject: (f) => `¿Sobre qué asunto específico es${f}?`,
  deadline: (f) => `¿Tienes fecha límite${f}?`,
  format: (f) => `¿En qué formato quieres la respuesta${f}?`,
  audience: (f) => `¿Para quién va la respuesta${f}?`,
  source: (f) => `¿Hay una fuente o contexto que debe tenerse en cuenta${f}?`,
});

function brief(fragment: string): string {
  const t = fragment.trim();
  if (t.length === 0) return "";
  return ` (${t.slice(0, 40)})`;
}

export function planClarification(input: ClarifyInput): ClarifyPlan {
  const text = typeof input?.input === "string" ? input.input.trim() : "";
  if (!text) throw new Error("CLARIFY_INPUT_REQUIRED");
  const known = input.known ?? {};
  const tokens = tokenize(text);
  const present: ClarifySlot[] = [];
  for (const slot of Object.keys(known) as ClarifySlot[]) {
    if (known[slot]?.trim()) present.push(slot);
  }

  const intent = assessIntent(text);
  let required: ClarifySlot[] = ["objective", "scope"];
  if (tokens.length < 4) required.push("subject");
  if (intent.category === "personal_data" || intent.touchesPersonalData) required.push("scope", "source");
  if (intent.category === "governance") required.push("audience");
  if (intent.category === "knowledge") required.push("format");

  const missing = required.filter((slot) => !present.includes(slot));
  const needed = intent.ambiguous || missing.length > 0;

  const candidates: ClarifyQuestion[] = [];
  for (const slot of missing.length > 0 ? missing : required) {
    candidates.push({
      slot,
      question: TEMPLATES[slot](brief(text)),
      reason: missing.length > 0 ? "SLOT_MISSING" : "INTENT_AMBIGUOUS",
      weight: missing.includes(slot) ? 1.0 : 0.6,
    });
  }
  candidates.sort((a, b) => b.weight - a.weight);

  const question = candidates.length > 0 ? candidates[0] : null;
  const alternatives = candidates.slice(1);

  return {
    version: CLARIFY_ENGINE_VERSION,
    input: text,
    needed,
    presentSlots: Object.freeze(present),
    requiredSlots: Object.freeze(required),
    question: question ? Object.freeze(question) : null,
    alternatives: Object.freeze(alternatives),
    intentAmbiguous: intent.ambiguous,
    confidence: intent.confidence,
    digest: digest({ text, needed, missing, intentAmbiguous: intent.ambiguous }),
    methodId: CLARIFY_ENGINE_METHOD_ID,
    disclaimer: CLARIFY_ENGINE_DISCLAIMER,
  };
}
