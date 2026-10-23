/**
 * NATIVE COMPREHENSION — separación honesta entre comprensión determinista y
 * generación real (ISA-077).
 * state: draft | engine-generated (pendiente revisión humana).
 *
 * Este módulo es COMPRENSIÓN DETERMINISTA: normaliza, tokeniza y clasifica por
 * reglas estáticas. NO genera texto, NO infiere intención "real" de un modelo,
 * NO se etiqueta como comprensión semántica de una red neuronal. Un backend
 * generativo real se inyectaría explícitamente; sin él la generación queda
 * bloqueada (fail-closed) y la salida es siempre determinista.
 */
import { createHash } from "node:crypto";

export type GenerationStatus = "NONE" | "BLOCKED_ENVIRONMENT" | "AVAILABLE";
export type ComprehensionIntent = "QUERY" | "COMMAND" | "STATEMENT" | "UNKNOWN";

export interface NativeComprehensionInput {
  readonly id: string;
  readonly utterance: string;
}

export interface NativeComprehension {
  readonly id: string;
  readonly utteranceHash: string;
  readonly intent: ComprehensionIntent;
  readonly tokens: readonly string[];
  readonly mode: "DETERMINISTIC";
  readonly generation: GenerationStatus;
  readonly generatesText: false;
}

export interface ComprehensionPipeline {
  readonly comprehend: (input: NativeComprehensionInput) => NativeComprehension;
  readonly generationStatus: () => GenerationStatus;
}

const sha256Hex = (value: string): string => createHash("sha256").update(value, "utf8").digest("hex");

const tokenize = (text: string): readonly string[] => {
  return text
    .toLowerCase()
    .split(/[^a-z0-9áéíóúñü]+/)
    .filter((token) => token.length > 0);
};

const QUERY_KEYS = ["busca", "dame", "muestra", "list", "get", "query", "consulta", "estado"] as const;
const COMMAND_KEYS = ["crea", "borra", "elimina", "actualiza", "cambia", "publica", "set", "post", "delete", "update"] as const;

export function classifyIntent(tokens: readonly string[]): ComprehensionIntent {
  if (tokens.some((token) => (QUERY_KEYS as readonly string[]).includes(token))) return "QUERY";
  if (tokens.some((token) => (COMMAND_KEYS as readonly string[]).includes(token))) return "COMMAND";
  if (tokens.length === 0) return "UNKNOWN";
  return "STATEMENT";
}

export function comprehend(input: NativeComprehensionInput): NativeComprehension {
  const utterance = input.utterance.trim();
  if (utterance.length === 0) throw new Error("NATIVE_COMPREHENSION: utterance vacía");
  if (input.id.trim().length === 0) throw new Error("NATIVE_COMPREHENSION: id requerido");
  const toks = tokenize(utterance);
  return Object.freeze({
    id: input.id,
    utteranceHash: sha256Hex(utterance),
    intent: classifyIntent(toks),
    tokens: Object.freeze([...toks]),
    mode: "DETERMINISTIC" as const,
    generation: "NONE" as const,
    generatesText: false as const,
  });
}

export function createComprehensionPipeline(): ComprehensionPipeline {
  return Object.freeze({ comprehend, generationStatus: () => "NONE" as const });
}

export const DECLARED_COMPREHENSION_LIMITS: readonly string[] = Object.freeze([
  "Determinista por reglas: no hay pesos, logits ni red neuronal.",
  "No genera texto: generatesText es siempre false.",
  "La generación real requiere un backend inyectado y aprobación humana (AGENTS.md).",
  "Sin backend, la generación queda bloqueada (fail-closed / BLOCKED_ENVIRONMENT).",
]);