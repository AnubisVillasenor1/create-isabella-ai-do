import { createHash } from "node:crypto";

export interface TerritoryPack {
  id: string;
  version: string;
  jurisdiction: string;
  locale: string;
  languages: readonly string[];
  policyIds: readonly string[];
  sourceIds: readonly string[];
  createdAt: string;
  contentHash: string;
}

export function createTerritoryPack(input: Omit<TerritoryPack, "contentHash">): TerritoryPack {
  const contentHash = createHash("sha256")
    .update(JSON.stringify(input), "utf8")
    .digest("hex");
  return Object.freeze({ ...input, contentHash });
}

export function verifyTerritoryPack(pack: TerritoryPack): boolean {
  const { contentHash, ...content } = pack;
  const expected = createHash("sha256").update(JSON.stringify(content), "utf8").digest("hex");
  return expected === contentHash;
}
