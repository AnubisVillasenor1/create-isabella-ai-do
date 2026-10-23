/**
 * Governed Semantic Cache for HyperCore Ω² (state: draft).
 *
 * Reuse is gated by a governed cache key that binds normalized intent + policy
 * version + risk class + model version + data version + user/territory scope.
 * A hit NEVER grants authorization. Similarity matching is LEXICAL (token
 * Jaccard), not embedding-based, and only ever surfaces candidates for reuse —
 * the orchestrator re-verifies before delivering anything.
 */
import { canonicalJson, normalizeText, sha3Hex, tokenize } from "./canonical";
import type {
  HyperCoreCacheEntry,
  HyperCoreTask,
  RiskClass,
  SemanticMatch,
  VerifiedResponse,
} from "./types";

export interface CacheVersions {
  readonly policyVersion: string;
  readonly modelVersion: string;
  readonly dataVersion: string;
}

export interface GovernedSemanticCacheOptions {
  readonly similarityThreshold?: number;
  readonly now?: () => number;
}

export interface GovernedSemanticCache {
  buildKey(task: HyperCoreTask, versions: CacheVersions): string;
  lookup(task: HyperCoreTask, versions: CacheVersions): HyperCoreCacheEntry | null;
  findSimilar(task: HyperCoreTask, versions: CacheVersions): readonly SemanticMatch[];
  store(
    task: HyperCoreTask,
    response: VerifiedResponse,
    versions: CacheVersions,
    ttlSeconds: number,
    energyKwh: number,
  ): HyperCoreCacheEntry;
  size(): number;
  clear(): void;
}

function normalizeIntent(task: HyperCoreTask): string {
  return normalizeText(`${task.intent} ${task.domain}`);
}

function jaccard(a: readonly string[], b: readonly string[]): number {
  if (a.length === 0 && b.length === 0) return 1;
  const setA = new Set(a);
  const setB = new Set(b);
  let intersection = 0;
  for (const token of setA) if (setB.has(token)) intersection += 1;
  const union = setA.size + setB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

export function createGovernedSemanticCache(
  options: GovernedSemanticCacheOptions = {},
): GovernedSemanticCache {
  const now = options.now ?? (() => Date.now());
  const similarityThreshold = options.similarityThreshold ?? 0.93;
  const entries = new Map<string, HyperCoreCacheEntry>();

  function buildKey(task: HyperCoreTask, versions: CacheVersions): string {
    return sha3Hex(
      canonicalJson({
        normalizedIntent: normalizeIntent(task),
        policyVersion: versions.policyVersion,
        riskClass: task.risk,
        modelVersion: versions.modelVersion,
        dataVersion: versions.dataVersion,
        userScope: task.userScope ?? "global",
        territoryScope: task.territoryScope ?? "global",
      }),
    );
  }

  function isValid(entry: HyperCoreCacheEntry, versions: CacheVersions, risk: RiskClass): boolean {
    if (entry.expiresAt <= now()) return false;
    if (entry.policyVersion !== versions.policyVersion) return false;
    if (entry.modelVersion !== versions.modelVersion) return false;
    if (entry.dataVersion !== versions.dataVersion) return false;
    if (entry.riskClass !== risk) return false;
    return true;
  }

  function lookup(task: HyperCoreTask, versions: CacheVersions): HyperCoreCacheEntry | null {
    const key = buildKey(task, versions);
    const entry = entries.get(key);
    if (!entry) return null;
    if (!isValid(entry, versions, task.risk)) {
      entries.delete(key);
      return null;
    }
    return entry;
  }

  function findSimilar(task: HyperCoreTask, versions: CacheVersions): readonly SemanticMatch[] {
    const queryTokens = tokenize(`${normalizeIntent(task)} ${task.prompt}`);
    const matches: SemanticMatch[] = [];
    for (const [_key, entry] of entries) {
      if (!isValid(entry, versions, task.risk)) continue;
      const similarity = jaccard(queryTokens, tokenize(entry.normalizedIntent));
      if (similarity >= similarityThreshold) matches.push({ entry, similarity });
    }
    return Object.freeze(matches.sort((a, b) => b.similarity - a.similarity));
  }

  function store(
    task: HyperCoreTask,
    response: VerifiedResponse,
    versions: CacheVersions,
    ttlSeconds: number,
    energyKwh: number,
  ): HyperCoreCacheEntry {
    const key = buildKey(task, versions);
    const createdAt = now();
    const entry: HyperCoreCacheEntry = Object.freeze({
      key,
      normalizedIntent: normalizeIntent(task),
      response,
      policyVersion: versions.policyVersion,
      modelVersion: versions.modelVersion,
      dataVersion: versions.dataVersion,
      riskClass: task.risk,
      createdAt,
      expiresAt: createdAt + Math.max(0, ttlSeconds) * 1000,
      energyKwh,
    });
    entries.set(key, entry);
    return entry;
  }

  return {
    buildKey,
    lookup,
    findSimilar,
    store,
    size: () => entries.size,
    clear: () => entries.clear(),
  };
}
