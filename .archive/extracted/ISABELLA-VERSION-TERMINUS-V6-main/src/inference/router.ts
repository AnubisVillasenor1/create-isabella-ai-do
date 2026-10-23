import type { GenerationRequest, GenerationResult, InferenceAdapter, InferenceRouter, ModelDescriptor } from "./types";

const LATENCY_RANK = { FAST: 0, BALANCED: 1, DEEP: 2 } as const;

export class GovernedInferenceRouter implements InferenceRouter {
  private readonly models = new Map<string, InferenceAdapter>();

  register(adapter: InferenceAdapter): void {
    const d = adapter.descriptor;
    if (this.models.has(d.id)) throw new Error(`INFERENCE: duplicate model ${d.id}`);
    if (!d.id || !d.provider || !d.version) throw new Error("INFERENCE: model descriptor metadata is incomplete.");
    if (!d.capabilities.includes("chat")) throw new Error(`INFERENCE: ${d.id} cannot serve generation without chat capability`);
    if (d.contextWindow < 1 || d.maxOutputTokens < 1) throw new Error("INFERENCE: invalid model limits");
    this.models.set(d.id, adapter);
  }

  list(): readonly ModelDescriptor[] {
    return [...this.models.values()].map((m) => m.descriptor);
  }

  async generate(request: GenerationRequest): Promise<GenerationResult> {
    if (!request.prompt.trim()) throw new Error("INFERENCE: empty prompt rejected");
    if (!Number.isInteger(request.maxTokens) || request.maxTokens < 1) throw new Error("INFERENCE: invalid token budget");

    const adapter = request.modelId ? this.models.get(request.modelId) : this.select();
    if (!adapter) throw new Error("INFERENCE: no compatible model");

    const descriptor = adapter.descriptor;
    if (!descriptor.capabilities.includes("chat")) throw new Error("INFERENCE: selected model lacks chat capability");
    if (request.maxTokens > descriptor.maxOutputTokens) throw new Error("INFERENCE: token budget rejected");

    const estimatedInputTokens = Math.ceil(request.prompt.length / 4);
    if (estimatedInputTokens + request.maxTokens > descriptor.contextWindow) {
      throw new Error("INFERENCE: context window exceeded");
    }

    const started = Date.now();
    const result = await adapter.generate(request);
    if (result.modelId !== descriptor.id) throw new Error("INFERENCE: adapter returned mismatched model id");
    if (result.inputTokens < 0 || result.outputTokens < 0) throw new Error("INFERENCE: invalid token accounting");

    return {
      ...result,
      latencyMs: Math.max(result.latencyMs, Date.now() - started),
    };
  }

  private select(): InferenceAdapter | undefined {
    return [...this.models.values()].sort((a, b) => LATENCY_RANK[a.descriptor.latencyClass] - LATENCY_RANK[b.descriptor.latencyClass])[0];
  }
}
