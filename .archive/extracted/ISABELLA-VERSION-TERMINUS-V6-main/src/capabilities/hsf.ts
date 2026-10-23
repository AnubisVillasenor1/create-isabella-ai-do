import { createHash, randomUUID } from "node:crypto";

export type CapabilityDomain =
  | "memory" | "execution" | "knowledge" | "collective" | "verification"
  | "architecture" | "digital-twin" | "strategy" | "quantum" | "integration";

export type CapabilityStatus = "ready" | "degraded" | "unavailable";

export interface CapabilityContext {
  requestId: string;
  traceId: string;
  principalId: string;
  role: string;
  policyVersion: string;
  metadata?: Readonly<Record<string, string>>;
}

export interface CapabilityDescriptor {
  id: string;
  version: string;
  domain: CapabilityDomain;
  description: string;
  riskTier: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  requiresAuthority: boolean;
}

export interface CapabilityProvider {
  descriptor: CapabilityDescriptor;
  health(): Promise<CapabilityStatus> | CapabilityStatus;
  execute(input: unknown, context: CapabilityContext): Promise<unknown>;
}

export interface CapabilityInvocation {
  requestId: string;
  traceId: string;
  capabilityId: string;
  version: string;
  status: "executed" | "rejected" | "unavailable" | "error";
  startedAt: string;
  completedAt: string;
  latencyMs: number;
  output?: unknown;
  error?: string;
}

export class CapabilityRegistry {
  private readonly providers = new Map<string, CapabilityProvider>();

  register(provider: CapabilityProvider): void {
    if (!provider.descriptor.id || !provider.descriptor.version) throw new Error("HSF_INVALID_DESCRIPTOR");
    if (this.providers.has(provider.descriptor.id)) throw new Error(`HSF_DUPLICATE_CAPABILITY:${provider.descriptor.id}`);
    const descriptor = Object.freeze({ ...provider.descriptor });
    const stored = Object.freeze({ ...provider, descriptor });
    this.providers.set(descriptor.id, stored);
  }

  get(id: string): CapabilityProvider {
    const provider = this.providers.get(id);
    if (!provider) throw new Error(`HSF_UNKNOWN_CAPABILITY:${id}`);
    return provider;
  }

  list(): readonly CapabilityDescriptor[] {
    return Object.freeze([...this.providers.values()].map((provider) => Object.freeze({ ...provider.descriptor })));
  }

  async health(): Promise<readonly (CapabilityDescriptor & { status: CapabilityStatus })[]> {
    return Promise.all([...this.providers.values()].map(async (p) => ({
      ...p.descriptor,
      status: await p.health(),
    })));
  }
}

export interface CapabilityGatewayPolicy {
  authorize(
    capabilityId: string,
    context: CapabilityContext,
    input: unknown,
    descriptor?: CapabilityDescriptor,
  ): Promise<{ granted: boolean; reason: string }>;
}

export class FailClosedCapabilityPolicy implements CapabilityGatewayPolicy {
  async authorize(capabilityId: string, context: CapabilityContext, _input: unknown, descriptor?: CapabilityDescriptor) {
    if (!capabilityId || !context.requestId || !context.traceId || !context.principalId || !context.role || !context.policyVersion) {
      return { granted: false, reason: "HSF_CONTEXT_INCOMPLETE" };
    }
    if (context.metadata?.authenticated !== "true" || context.metadata?.genesisGovernanceAdmitted !== "true") {
      return { granted: false, reason: "HSF_AUTHORIZATION_POLICY_NOT_CONFIGURED" };
    }
    if (!["operator", "admin"].includes(context.role)) {
      return { granted: false, reason: "HSF_ROLE_NOT_ALLOWED" };
    }
    if (descriptor && ["HIGH", "CRITICAL"].includes(descriptor.riskTier) &&
      context.metadata?.humanApprovalVerified !== "true") {
      return { granted: false, reason: "HSF_HUMAN_APPROVAL_REQUIRED" };
    }
    return { granted: true, reason: "GENESIS_GOVERNANCE_ADMITTED" };
  }
}

export class CapabilityGateway {
  constructor(
    private readonly registry: CapabilityRegistry,
    private readonly policy: CapabilityGatewayPolicy = new FailClosedCapabilityPolicy(),
  ) {}

  async invoke(capabilityId: string, input: unknown, context: CapabilityContext): Promise<CapabilityInvocation> {
    const requestId = context.requestId || randomUUID();
    const started = Date.now();
    const startedAt = new Date().toISOString();
    let provider: CapabilityProvider;
    try {
      provider = this.registry.get(capabilityId);
    } catch {
      return { requestId, traceId: context.traceId, capabilityId, version: "unknown", status: "rejected", startedAt, completedAt: new Date().toISOString(), latencyMs: Date.now() - started, error: "HSF_UNKNOWN_CAPABILITY" };
    }
    const authorization = await this.policy.authorize(capabilityId, context, input, provider.descriptor);
    if (!authorization.granted) {
      return { requestId, traceId: context.traceId, capabilityId, version: provider.descriptor.version, status: "rejected", startedAt, completedAt: new Date().toISOString(), latencyMs: Date.now() - started, error: authorization.reason };
    }
    const status = await provider.health();
    if (status !== "ready") {
      return {
        requestId, traceId: context.traceId, capabilityId, version: provider.descriptor.version,
        status: "unavailable", startedAt, completedAt: new Date().toISOString(), latencyMs: Date.now() - started,
        error: status === "degraded" ? "HSF_PROVIDER_DEGRADED_FAIL_CLOSED" : "HSF_PROVIDER_UNAVAILABLE",
      };
    }
    try {
      const output = await provider.execute(input, context);
      return { requestId, traceId: context.traceId, capabilityId, version: provider.descriptor.version, status: "executed", startedAt, completedAt: new Date().toISOString(), latencyMs: Date.now() - started, output };
    } catch (error) {
      return { requestId, traceId: context.traceId, capabilityId, version: provider.descriptor.version, status: "error", startedAt, completedAt: new Date().toISOString(), latencyMs: Date.now() - started, error: error instanceof Error ? error.message : "HSF_PROVIDER_ERROR" };
    }
  }
}

export interface MemoryRecord {
  id: string;
  text: string;
  namespace: string;
  createdAt: string;
  contentHash: string;
  version: number;
  relations: readonly string[];
  metadata?: Readonly<Record<string, string>>;
}

export interface MemoryFabric {
  write(record: Omit<MemoryRecord, "id" | "createdAt" | "contentHash" | "version">): MemoryRecord;
  retrieve(query: string, namespace?: string, limit?: number): readonly MemoryRecord[];
}

function cloneMemoryRecord(record: MemoryRecord): MemoryRecord {
  // Return detached mutable copies: callers may edit their view, never the stored record.
  return {
    ...record,
    relations: [...record.relations],
    ...(record.metadata ? { metadata: { ...record.metadata } } : {}),
  };
}

export class InMemoryMemoryFabric implements MemoryFabric {
  private readonly records: MemoryRecord[] = [];

  write(record: Omit<MemoryRecord, "id" | "createdAt" | "contentHash" | "version">): MemoryRecord {
    if (!record || typeof record.text !== "string" || !record.text.trim() || record.text.length > 1_000_000) {
      throw new Error("HSF_MEMORY_INVALID_TEXT");
    }
    if (typeof record.namespace !== "string" || !record.namespace.trim() || record.namespace.length > 128) {
      throw new Error("HSF_MEMORY_INVALID_NAMESPACE");
    }
    if (!Array.isArray(record.relations) || record.relations.some((value) => typeof value !== "string" || !value.trim())) {
      throw new Error("HSF_MEMORY_INVALID_RELATIONS");
    }
    const normalized = {
      text: record.text.trim(),
      namespace: record.namespace.trim(),
      relations: [...record.relations].map((value) => value.trim()),
      ...(record.metadata ? { metadata: { ...record.metadata } } : {}),
    };
    if (normalized.metadata && Object.entries(normalized.metadata).some(([key, value]) =>
      !key.trim() || typeof value !== "string" || key.length > 128 || value.length > 2048)) {
      throw new Error("HSF_MEMORY_INVALID_METADATA");
    }
    const contentHash = createHash("sha3-256").update(JSON.stringify(normalized)).digest("hex");
    const existing = this.records.find((item) => item.contentHash === contentHash);
    if (existing) return cloneMemoryRecord(existing);

    const next: MemoryRecord = Object.freeze({
      ...normalized,
      id: randomUUID(),
      createdAt: new Date().toISOString(),
      contentHash,
      version: 1,
      relations: Object.freeze([...normalized.relations]),
      ...(normalized.metadata ? { metadata: Object.freeze({ ...normalized.metadata }) } : {}),
    });
    this.records.push(next);
    return cloneMemoryRecord(next);
  }

  retrieve(query: string, namespace?: string, limit = 20): readonly MemoryRecord[] {
    if (typeof query !== "string") throw new Error("HSF_MEMORY_QUERY_INVALID");
    if (namespace !== undefined && (typeof namespace !== "string" || !namespace.trim())) {
      throw new Error("HSF_MEMORY_NAMESPACE_INVALID");
    }
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new Error("HSF_MEMORY_LIMIT_OUT_OF_RANGE");
    const q = query.toLowerCase().trim();
    return this.records
      .filter((record) => !namespace || record.namespace === namespace.trim())
      .map((record) => ({ record, score: q ? record.text.toLowerCase().split(q).length - 1 : 0 }))
      .filter(({ score }) => !q || score > 0)
      .sort((a, b) => b.score - a.score || b.record.createdAt.localeCompare(a.record.createdAt))
      .slice(0, limit)
      .map(({ record }) => cloneMemoryRecord(record));
  }
}

export interface ExecutionTask {
  id: string;
  type: string;
  input: unknown;
  scheduledAt: string;
  attempts: number;
  status: "queued" | "running" | "completed" | "failed";
}

export class ExecutionFabric {
  private readonly tasks = new Map<string, ExecutionTask>();
  async enqueue(type: string, input: unknown, scheduledAt = new Date().toISOString()): Promise<ExecutionTask> {
    const task: ExecutionTask = { id: randomUUID(), type, input, scheduledAt, attempts: 0, status: "queued" };
    this.tasks.set(task.id, task);
    return task;
  }
  get(id: string): ExecutionTask | undefined { return this.tasks.get(id); }
  list(): readonly ExecutionTask[] { return [...this.tasks.values()]; }
}

export interface KnowledgeArtifact {
  id: string;
  title: string;
  content: string;
  source: string;
  contentHash: string;
  ingestedAt: string;
  status: "PENDING_REVIEW";
}

/**
 * HSF ingestion is a proposal, not automatic epistemic admission.
 * No license/provenance verifier is wired into this class; therefore it must
 * never label newly supplied material "accepted".
 */
export class KnowledgeFabric {
  private readonly artifacts = new Map<string, KnowledgeArtifact>();

  ingest(input: { title: string; content: string; source: string }): KnowledgeArtifact {
    if (!input || ![input.title, input.content, input.source].every(
      (value) => typeof value === "string" && value.trim(),
    )) throw new Error("KNOWLEDGE_INVALID_ARTIFACT");
    if (input.title.length > 300 || input.content.length > 1_000_000 || input.source.length > 2048) {
      throw new Error("KNOWLEDGE_ARTIFACT_SIZE_LIMIT_EXCEEDED");
    }
    const contentHash = createHash("sha3-256").update(input.content, "utf8").digest("hex");
    const id = `knowledge:${contentHash.slice(0, 24)}`;
    const existing = this.artifacts.get(id);
    if (existing) return { ...existing };
    const artifact: KnowledgeArtifact = Object.freeze({
      id,
      title: input.title.trim(),
      content: input.content,
      source: input.source.trim(),
      contentHash,
      ingestedAt: new Date().toISOString(),
      status: "PENDING_REVIEW",
    });
    this.artifacts.set(id, artifact);
    return { ...artifact };
  }

  get(id: string): KnowledgeArtifact | undefined {
    const artifact = this.artifacts.get(id);
    return artifact ? { ...artifact } : undefined;
  }

  list(): readonly KnowledgeArtifact[] {
    return [...this.artifacts.values()].map((artifact) => ({ ...artifact }));
  }
}

export interface ExpertAssessment {
  expertId: string;
  verdict: string;
  confidence: number;
  evidence: readonly string[];
}

export interface ConsensusResult {
  verdict: string;
  /** Heuristic agreement score, not a calibrated probability. */
  confidence: number;
  confidenceType: "HEURISTIC_AGREEMENT_SCORE";
  participants: number;
  agreementRatio: number;
  dissent: readonly string[];
}

export function consensus(results: readonly ExpertAssessment[]): ConsensusResult {
  if (results.length === 0) {
    return { verdict: "NO_CONSENSUS", confidence: 0, confidenceType: "HEURISTIC_AGREEMENT_SCORE", participants: 0, agreementRatio: 0, dissent: [] };
  }
  for (const result of results) {
    if (!result || typeof result.expertId !== "string" || !result.expertId.trim() ||
      typeof result.verdict !== "string" || !result.verdict.trim() ||
      !Number.isFinite(result.confidence) || result.confidence < 0 || result.confidence > 1 ||
      !Array.isArray(result.evidence)) {
      throw new Error("HSF_CONSENSUS_INVALID_ASSESSMENT");
    }
  }
  const buckets = new Map<string, ExpertAssessment[]>();
  for (const result of results) {
    const group = buckets.get(result.verdict) ?? [];
    group.push(result);
    buckets.set(result.verdict, group);
  }
  const ranked = [...buckets.entries()].sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]));
  const top = ranked[0];
  if (!top) {
    return { verdict: "NO_CONSENSUS", confidence: 0, confidenceType: "HEURISTIC_AGREEMENT_SCORE", participants: results.length, agreementRatio: 0, dissent: results.map((r) => r.expertId) };
  }
  const tied = ranked.length > 1 && ranked[1]![1].length === top[1].length;
  if (tied) {
    return {
      verdict: "NO_CONSENSUS",
      confidence: 0,
      confidenceType: "HEURISTIC_AGREEMENT_SCORE",
      participants: results.length,
      agreementRatio: top[1].length / results.length,
      dissent: results.map((r) => r.expertId),
    };
  }
  const [verdict, group] = top;
  const agreementRatio = group.length / results.length;
  const meanReportedConfidence = group.reduce((sum, item) => sum + item.confidence, 0) / group.length;
  return {
    verdict,
    confidence: Math.round(meanReportedConfidence * agreementRatio * 100) / 100,
    confidenceType: "HEURISTIC_AGREEMENT_SCORE",
    participants: results.length,
    agreementRatio,
    dissent: results.filter((r) => r.verdict !== verdict).map((r) => r.expertId),
  };
}

export interface VerificationClaim {
  claim: string;
  evidence: readonly string[];
  contradictions: readonly string[];
}

export interface VerificationResult {
  /** Count-based signal only; never a probability or a truth verdict. */
  confidence: number;
  scoreType: "HEURISTIC_NOT_PROBABILITY";
  evidenceCount: number;
  contradictionCount: number;
  level: "SUPPORTIVE_SIGNAL" | "MIXED_SIGNAL" | "CONTRADICTED_SIGNAL" | "UNVERIFIED";
}

export function verifyClaim(input: VerificationClaim): VerificationResult {
  if (!input || typeof input.claim !== "string" || !input.claim.trim() ||
    !Array.isArray(input.evidence) || !Array.isArray(input.contradictions)) {
    throw new Error("HSF_VERIFICATION_INVALID_INPUT");
  }
  const evidenceCount = input.evidence.filter((item) => typeof item === "string" && item.trim()).length;
  const contradictionCount = input.contradictions.filter((item) => typeof item === "string" && item.trim()).length;
  const total = evidenceCount + contradictionCount;
  const raw = total === 0 ? 0 : evidenceCount / total;
  // A count-only heuristic cannot establish truth; cap it below "high confidence".
  const confidence = Math.min(0.8, Math.round(raw * 100) / 100);
  const level = evidenceCount === 0
    ? "UNVERIFIED"
    : contradictionCount > 0
      ? "MIXED_SIGNAL"
      : "SUPPORTIVE_SIGNAL";
  return { confidence, scoreType: "HEURISTIC_NOT_PROBABILITY", evidenceCount, contradictionCount, level };
}

export interface ArchitectureAssessment {
  components: number;
  dependencies: number;
  risks: readonly string[];
  recommendations: readonly string[];
}

export function reasonArchitecture(input: { components: readonly string[]; dependencies: readonly string[]; constraints?: readonly string[] }): ArchitectureAssessment {
  const risks: string[] = [];
  if (input.components.length > 100) risks.push("HIGH_COMPONENT_COUNT");
  if (input.dependencies.length > input.components.length * 4) risks.push("DEPENDENCY_DENSITY");
  if ((input.constraints ?? []).some((c) => /single.?point|central/i.test(c))) risks.push("SINGLE_POINT_OF_FAILURE");
  const recommendations = [
    ...(risks.includes("DEPENDENCY_DENSITY") ? ["segment provider boundaries"] : []),
    ...(risks.includes("HIGH_COMPONENT_COUNT") ? ["introduce bounded contexts"] : []),
    "keep authority, execution and evidence as separate contracts",
  ];
  return { components: input.components.length, dependencies: input.dependencies.length, risks, recommendations };
}

export interface DigitalTwin {
  id: string;
  version: number;
  nodes: readonly { id: string; kind: string; label: string }[];
  edges: readonly { from: string; to: string; relation: string }[];
  generatedAt: string;
}

export function buildDigitalTwin(input: { nodes: DigitalTwin["nodes"]; edges: DigitalTwin["edges"] }): DigitalTwin {
  return { id: `twin:${createHash("sha256").update(JSON.stringify(input)).digest("hex").slice(0, 24)}`, version: 1, ...input, generatedAt: new Date().toISOString() };
}

export interface StrategicScenario {
  name: string;
  probability: number;
  cost: number;
  expectedValue: number;
  assumptions: readonly string[];
}

export function planStrategy(input: { objective: string; scenarios: readonly Omit<StrategicScenario, "expectedValue">[] }): readonly StrategicScenario[] {
  if (!input.objective.trim()) throw new Error("STRATEGY_OBJECTIVE_REQUIRED");
  return input.scenarios.map((s) => ({ ...s, expectedValue: s.probability * s.cost }));
}

export function selfEvaluate(output: unknown, criteria: readonly string[]) {
  const serialized = JSON.stringify(output) ?? "";
  const passed = criteria.filter((criterion) => serialized.toLowerCase().includes(criterion.toLowerCase()));
  return { score: criteria.length ? passed.length / criteria.length : 0, passed, failed: criteria.filter((c) => !passed.includes(c)) };
}

export async function parallelAnalyze<T, R>(items: readonly T[], worker: (item: T, index: number) => Promise<R>): Promise<readonly R[]> {
  return Promise.all(items.map(worker));
}
