import type { InferenceAdapter, GenerationRequest, GenerationResult, ModelDescriptor } from "./types";
export class FailingClosedAdapter implements InferenceAdapter {
  readonly descriptor: ModelDescriptor = {
    id: "fail-closed",
    version: "1.0.0",
    provider: "fail-closed",
    capabilities: ["chat"],
    contextWindow: 0,
    maxOutputTokens: 0,
    latencyClass: "FAST",
  };
  constructor(private readonly reason="no_inference_provider") {}
  async generate(_request: GenerationRequest): Promise<GenerationResult> { throw new Error(`INFERENCE: ${this.reason}`); }
}
