/**
 * MOE SOBERANO — hashing determinista y replay (hash.ts).
 * state: draft | auto_generated (pendiente revisión humana).
 *
 * Cripto-agnóstico para el routing: SHA-256 (node:crypto) se usa SOLO como
 * hash determinista de integridad de artefactos y digest de replay. El gating
 * (router.ts) es matemática pura sin aleatoriedad ni dependencia de crypto.
 */
import { createHash } from "node:crypto";

export function sha256Hex(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

/**
 * Serialización canónica determinista (claves de objeto ordenadas) de modo
 * que dos estructuras equivalentes produzcan siempre la misma cadena.
 */
export function stableStringify(value: unknown): string {
  if (value === null) return "null";
  if (typeof value === "string") return JSON.stringify(value);
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (typeof value === "undefined") return "null";
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    const keys = Object.keys(record).sort();
    return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(record[k])}`).join(",")}}`;
  }
  throw new Error("MOE: stableStringify no soporta el tipo recibido");
}

export interface ReplayArtifactRef {
  readonly id: string;
  readonly version: string;
  readonly hash: string;
}

export interface ReplayContext {
  readonly gateDigest: string;
  readonly topK: number;
  readonly capacity: number;
  readonly artifacts: readonly ReplayArtifactRef[];
}

export function replayDigest(context: ReplayContext): string {
  return sha256Hex(`moe-replay-v1:${stableStringify(context)}`);
}