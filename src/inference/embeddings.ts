/**
 * Sovereign embeddings — deterministic, local, no external services.
 * Uses hashed bag-of-words with multiple hash functions to approximate semantic vectors.
 */
const DIM = 256;

function hashToken(token: string, seed: number): number {
  let h = seed;
  for (let i = 0; i < token.length; i++) {
    h = (h * 31 + token.charCodeAt(i)) >>> 0;
  }
  return h % DIM;
}

export function embed(text: string): Float32Array {
  const vec = new Float32Array(DIM);
  const tokens =
    text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .match(/[\p{L}\p{N}]{3,}/gu) ?? [];
  if (tokens.length === 0) return vec;
  for (const t of tokens) {
    for (let s = 0; s < 3; s++) {
      const idx = hashToken(t, s * 997 + 1);
      vec[idx] += 1 / (s + 1);
    }
  }
  // L2 normalize
  let norm = 0;
  for (let i = 0; i < DIM; i++) norm += vec[i] * vec[i];
  norm = Math.sqrt(norm) || 1;
  for (let i = 0; i < DIM; i++) vec[i] /= norm;
  return vec;
}

export function cosineSimilarity(a: Float32Array, b: Float32Array): number {
  let dot = 0;
  for (let i = 0; i < DIM; i++) dot += a[i] * b[i];
  return dot;
}
