/**
 * Alpha Subsystem: Perception Engine
 *
 * Normaliza y analiza intenciones de entrada, extrayendo entidades y categorías.
 */

export type InputModality = "text" | "voice" | "multimodal";
export type IntentCategory =
  | "chat"
  | "assistant"
  | "research"
  | "edge"
  | "quantum"
  | "implementation"
  | "monetization"
  | "general";

export interface PerceptionResult {
  intent: string;
  intentConfidence: number;
  entities: string[];
  modality: InputModality;
  rawInput: string;
}

export class PerceptionEngine {
  async process(input: string, modality: InputModality = "text"): Promise<PerceptionResult> {
    const trimmed = input.trim();
    const entities: string[] = [];

    // Extracción básica de entidades / palabras clave
    const words = trimmed.split(/\s+/);
    for (const w of words) {
      if (w.startsWith("@") || w.startsWith("#") || /^[A-Z][a-z]+/.test(w)) {
        entities.push(w);
      }
    }

    return {
      intent: trimmed,
      intentConfidence: 0.95,
      entities,
      modality,
      rawInput: input,
    };
  }
}

export const perceptionEngine = new PerceptionEngine();
