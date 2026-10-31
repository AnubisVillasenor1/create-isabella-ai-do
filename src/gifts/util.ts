/**
 * LEGADO — utilidades compartidas de los regalos.
 *
 * state: draft | engine-generated.
 *
 * Primitivas deterministas (normalización, tokens, Jaccard, clamp, digest) que
 * evitan duplicar lógica entre los módulos de `src/gifts/`. Ninguna concede
 * autoridad ni ejecuta efectos: son funciones puras.
 */
import { sha256 } from '../skills/canonical-json';

/** Normaliza texto: NFKC, minúsculas, sin anchos invisibles ni signos. */
export function normalizeText(input: string): string {
  return input
    .normalize('NFKC')
    .toLocaleLowerCase('es-MX')
    .replace(/[\u200B-\u200D\uFEFF]/g, ' ')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Tokeniza normalizando; descarta tokens de longitud ≤ 1. */
export function tokenize(input: string): string[] {
  const normalized = normalizeText(input);
  if (!normalized) return [];
  return normalized.split(' ').filter((token) => token.length > 1);
}

/** Similitud de Jaccard entre dos conjuntos de tokens. */
export function jaccard(a: readonly string[], b: readonly string[]): number {
  if (a.length === 0 && b.length === 0) return 1;
  const setA = new Set(a);
  const setB = new Set(b);
  let intersection = 0;
  for (const token of setA) if (setB.has(token)) intersection += 1;
  const union = setA.size + setB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/** Digest canónico determinista (SHA-256 hexadecimal). */
export function digest(value: unknown): string {
  return sha256(value);
}

/** Redondeo a `decimals` decimales, estable ante coma flotante. */
export function round(value: number, decimals = 4): number {
  const factor = 10 ** decimals;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}
