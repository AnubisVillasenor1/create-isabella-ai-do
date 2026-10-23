import { createHash } from "node:crypto";
import type { EvidenceChain, EvidenceNode, EvidenceNodeType } from "./types";

const hash = (value: string | Uint8Array): string =>
  createHash("sha3-512").update(value).digest("hex");
const HASH_RE = /^[a-f0-9]{128}$/i;
const ID_RE = /^[A-Za-z0-9._:-]{1,128}$/;
const NODE_TYPES: readonly EvidenceNodeType[] = ["SOURCE", "PROMPT", "MODEL", "REVISION", "QUOTE"];

export function contentHash(content: string | Uint8Array): string {
  if (typeof content !== "string" && !(content instanceof Uint8Array)) {
    throw new Error("LITLE evidence: content must be text or bytes");
  }
  return hash(content);
}

function canonicalMetadata(metadata?: Readonly<Record<string, string>>): Readonly<Record<string, string>> | undefined {
  if (metadata === undefined) return undefined;
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    throw new Error("LITLE evidence: metadata must be a string map");
  }
  const entries = Object.entries(metadata);
  if (entries.length > 100 || entries.some(([key, value]) =>
    !key.trim() || key.length > 128 || typeof value !== "string" || value.length > 2048)) {
    throw new Error("LITLE evidence: metadata invalid or too large");
  }
  return Object.freeze(Object.fromEntries(entries.sort(([a], [b]) => a.localeCompare(b))));
}

export function createEvidenceNode(input: {
  id: string;
  type: EvidenceNodeType;
  content: string | Uint8Array;
  parentIds?: readonly string[];
  metadata?: Readonly<Record<string, string>>;
}): EvidenceNode {
  if (!input || typeof input.id !== "string" || !ID_RE.test(input.id.trim())) {
    throw new Error("LITLE evidence: invalid id");
  }
  if (!NODE_TYPES.includes(input.type)) throw new Error("LITLE evidence: invalid node type");
  const parentIds = [...(input.parentIds ?? [])].map((id) => {
    if (typeof id !== "string" || !ID_RE.test(id.trim())) throw new Error("LITLE evidence: invalid parent id");
    return id.trim();
  }).sort();
  if (new Set(parentIds).size !== parentIds.length) throw new Error("LITLE evidence: duplicate parent id");
  return Object.freeze({
    id: input.id.trim(),
    type: input.type,
    contentHash: contentHash(input.content),
    parentIds: Object.freeze(parentIds),
    ...(input.metadata ? { metadata: canonicalMetadata(input.metadata) } : {}),
  });
}

function nodeHash(node: EvidenceNode): string {
  return hash(JSON.stringify({
    id: node.id,
    type: node.type,
    contentHash: node.contentHash,
    parentIds: [...node.parentIds].sort(),
    metadata: node.metadata ?? {},
  }));
}

function canonicalizeNodes(nodes: readonly EvidenceNode[]): readonly EvidenceNode[] {
  if (!Array.isArray(nodes) || nodes.length > 10_000) throw new Error("LITLE evidence: invalid node collection");
  const canonical = nodes.map((node) => {
    if (!node || typeof node.id !== "string" || !ID_RE.test(node.id.trim())) {
      throw new Error("LITLE evidence: invalid node id");
    }
    if (!NODE_TYPES.includes(node.type)) throw new Error("LITLE evidence: invalid node type");
    if (typeof node.contentHash !== "string" || !HASH_RE.test(node.contentHash)) {
      throw new Error("LITLE evidence: invalid content hash");
    }
    if (!Array.isArray(node.parentIds)) throw new Error("LITLE evidence: parentIds must be an array");
    const parentIds = node.parentIds.map((id: string) => {
      if (typeof id !== "string" || !ID_RE.test(id.trim())) throw new Error("LITLE evidence: invalid parent id");
      return id.trim();
    }).sort();
    if (new Set(parentIds).size !== parentIds.length) throw new Error("LITLE evidence: duplicate parent id");
    if (parentIds.includes(node.id.trim())) throw new Error("LITLE evidence: self-parent cycle");
    const metadata = canonicalMetadata(node.metadata);
    return Object.freeze({
      id: node.id.trim(),
      type: node.type,
      contentHash: node.contentHash.toLowerCase(),
      parentIds: Object.freeze(parentIds),
      ...(metadata ? { metadata } : {}),
    });
  });
  if (new Set(canonical.map((node) => node.id)).size !== canonical.length) {
    throw new Error("LITLE evidence: duplicate node id");
  }
  const byId = new Map(canonical.map((node) => [node.id, node]));
  for (const node of canonical) {
    for (const parentId of node.parentIds) {
      if (!byId.has(parentId)) throw new Error("LITLE evidence: missing parent " + parentId);
    }
  }

  // Parent references form a DAG; cycles invalidate provenance semantics.
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const visit = (id: string): void => {
    if (visiting.has(id)) throw new Error("LITLE evidence: parent cycle detected");
    if (visited.has(id)) return;
    visiting.add(id);
    const node = byId.get(id);
    if (!node) throw new Error("LITLE evidence: missing node " + id);
    for (const parentId of node.parentIds) visit(parentId);
    visiting.delete(id);
    visited.add(id);
  };
  for (const node of canonical) visit(node.id);
  return Object.freeze(canonical.sort((a, b) => a.id.localeCompare(b.id)));
}

export function buildEvidenceChain(nodes: readonly EvidenceNode[]): EvidenceChain {
  const canonicalNodes = canonicalizeNodes(nodes);
  let layer = canonicalNodes.map(nodeHash);
  if (layer.length === 0) layer = [hash("LITLE:EVIDENCE:EMPTY")];
  while (layer.length > 1) {
    const next: string[] = [];
    for (let i = 0; i < layer.length; i += 2) {
      next.push(hash((layer[i] ?? "") + (layer[i + 1] ?? layer[i] ?? "")));
    }
    layer = next;
  }
  return Object.freeze({
    nodes: canonicalNodes,
    rootHash: layer[0] ?? hash("LITLE:EVIDENCE:EMPTY"),
    algorithm: "SHA3-512" as const,
  });
}

/** Verifies the submitted metadata tree/root, not the authenticity of the original source bytes. */
export function verifyEvidenceChain(chain: EvidenceChain): boolean {
  try {
    if (!chain || chain.algorithm !== "SHA3-512" || !Array.isArray(chain.nodes) ||
      chain.nodes.length === 0 || typeof chain.rootHash !== "string" || !HASH_RE.test(chain.rootHash)) {
      return false;
    }
    return buildEvidenceChain(chain.nodes).rootHash === chain.rootHash.toLowerCase();
  } catch {
    return false;
  }
}
