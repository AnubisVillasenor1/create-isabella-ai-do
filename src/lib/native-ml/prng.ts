// state: draft | engine-generated
//
// Deterministic, seedable pseudo-randomness. Every stochastic learner in this
// package (k-means++ init, random forests, isolation forests, stratified
// splits) draws from these generators so a run is byte-for-byte reproducible.
// A green metric here proves capability, never authority or production.

/** 32-bit integer hash of a string, used to derive stable seeds from identifiers. */
export function hashSeed(text: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

export type Rng = () => number;

/**
 * mulberry32: a compact, fast, fully deterministic PRNG. Returns floats in
 * [0, 1). Given the same seed the sequence is identical across runs and hosts.
 */
export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return function next(): number {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Integer in [min, max] inclusive. */
export function randInt(rng: Rng, min: number, max: number): number {
  if (!Number.isFinite(min) || !Number.isFinite(max) || max < min)
    throw new Error('invalid_rng_range');
  return min + Math.floor(rng() * (max - min + 1));
}

/** Fisher-Yates shuffle (returns a new array, seed-deterministic). */
export function shuffle<T>(items: readonly T[], rng: Rng): T[] {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = out[i]!;
    out[i] = out[j]!;
    out[j] = tmp;
  }
  return out;
}

/** A seeded sampler producing a deterministic permutation of [0, n). */
export function permutation(n: number, rng: Rng): number[] {
  if (!Number.isInteger(n) || n < 0) throw new Error('invalid_permutation_size');
  const base = Array.from({ length: n }, (_, i) => i);
  return shuffle(base, rng);
}

/**
 * Verifies that two independent training runs (as thunks) produce identical
 * serialized artifacts. Used to assert determinism of stochastic learners.
 */
export function isReproducible<T>(
  serialize: (value: T) => string,
  run: () => T,
  trials = 2
): boolean {
  if (trials < 2) throw new Error('reproducibility_requires_two_trials');
  const first = serialize(run());
  for (let i = 1; i < trials; i++) if (serialize(run()) !== first) return false;
  return true;
}
