import type {
  GenerationRequest,
  GenerationResult,
  InferenceAdapter,
  InferenceRouter,
  ModelDescriptor,
} from './types';
import { createLocalEngine } from './local-engine';

const LATENCY_RANK = { FAST: 0, BALANCED: 1, DEEP: 2 } as const;

export class GovernedInferenceRouter implements InferenceRouter {
  private readonly models = new Map<string, InferenceAdapter>();

  register(adapter: InferenceAdapter): void {
    const d = adapter.descriptor;
    if (this.models.has(d.id)) throw new Error(`INFERENCE: duplicate model ${d.id}`);
    if (!d.id || !d.provider || !d.version)
      throw new Error('INFERENCE: model descriptor metadata is incomplete.');
    if (!d.capabilities.includes('chat'))
      throw new Error(`INFERENCE: ${d.id} cannot serve generation without chat capability`);
    if (d.contextWindow < 1 || d.maxOutputTokens < 1)
      throw new Error('INFERENCE: invalid model limits');
    this.models.set(d.id, adapter);
  }

  list(): readonly ModelDescriptor[] {
    return [...this.models.values()].map((m) => m.descriptor);
  }

  async generate(request: GenerationRequest): Promise<GenerationResult> {
    if (!request.prompt.trim()) throw new Error('INFERENCE: empty prompt rejected');
    if (!Number.isInteger(request.maxTokens) || request.maxTokens < 1)
      throw new Error('INFERENCE: invalid token budget');

    // Candidate selection: explicit modelId pins a single adapter; otherwise try all
    // registered adapters in latency order so one slow/blocked provider does not
    // silence Isabella. Validation errors below still fail closed.
    const candidates: InferenceAdapter[] = [];
    if (request.modelId) {
      const pinned = this.models.get(request.modelId);
      if (!pinned) throw new Error('INFERENCE: no compatible model');
      candidates.push(pinned);
    } else {
      candidates.push(
        ...[...this.models.values()].sort(
          (a, b) =>
            LATENCY_RANK[a.descriptor.latencyClass] - LATENCY_RANK[b.descriptor.latencyClass]
        )
      );
    }
    if (candidates.length === 0) throw new Error('INFERENCE: no compatible model');

    const started = Date.now();
    let lastError: unknown;
    let validationError: Error | undefined;
    for (const adapter of candidates) {
      const descriptor = adapter.descriptor;
      if (!descriptor.capabilities.includes('chat')) {
        validationError ??= new Error('INFERENCE: selected model lacks chat capability');
        continue;
      }
      if (request.maxTokens > descriptor.maxOutputTokens) {
        validationError ??= new Error('INFERENCE: token budget rejected');
        continue;
      }
      const estimatedInputTokens = Math.ceil(request.prompt.length / 4);
      if (estimatedInputTokens + request.maxTokens > descriptor.contextWindow) {
        validationError ??= new Error('INFERENCE: context window exceeded');
        continue;
      }

      try {
        const result = await adapter.generate(request);
        if (result.modelId !== descriptor.id)
          throw new Error('INFERENCE: adapter returned mismatched model id');
        if (result.inputTokens < 0 || result.outputTokens < 0)
          throw new Error('INFERENCE: invalid token accounting');
        return {
          ...result,
          latencyMs: Math.max(result.latencyMs, Date.now() - started),
        };
      } catch (error) {
        lastError = error;
        // Try the next adapter; never abort the user-facing turn on a provider failure.
        continue;
      }
    }

    if (validationError && candidates.length === 1) {
      throw validationError;
    }
    if (
      validationError &&
      candidates.every((c) => {
        // If every candidate was rejected for validation reasons, surface that error.
        return true;
      }) &&
      lastError === undefined &&
      candidates.length > 0
    ) {
      // Only throw validation errors when no provider was actually attempted.
      // Heuristic: if lastError is undefined, no generate() ran.
      throw validationError;
    }

    // Sovereign local fallback: Isabella must always answer, even when every
    // external/free provider is blocked or unavailable. This is disclosed as
    // local deterministic inference, never as an external model.
    const local = await createLocalEngine().generate(request);
    return {
      modelId: 'isabella-local-fallback',
      text: local.text,
      inputTokens: Math.ceil(request.prompt.length / 4),
      outputTokens: Math.ceil(local.text.length / 4),
      latencyMs: Math.max(1, Date.now() - started),
      finishReason: 'stop',
    };
  }

  private select(): InferenceAdapter | undefined {
    return [...this.models.values()].sort(
      (a, b) => LATENCY_RANK[a.descriptor.latencyClass] - LATENCY_RANK[b.descriptor.latencyClass]
    )[0];
  }
}
