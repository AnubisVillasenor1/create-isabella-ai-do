export type InferenceCapability = "chat" | "embedding" | "rerank" | "vision";

export interface ModelDescriptor {
  id: string;
  version: string;
  provider: string;
  capabilities: readonly InferenceCapability[];
  contextWindow: number;
  maxOutputTokens: number;
  latencyClass: "FAST" | "BALANCED" | "DEEP";
}

export interface GenerationRequest {
  modelId?: string;
  prompt: string;
  maxTokens: number;
  temperature?: number;
  metadata?: Readonly<Record<string, string | number | boolean>>;
}

export interface GenerationResult {
  modelId: string;
  text: string;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
  finishReason: "stop" | "length" | "error";
}

export interface InferenceAdapter {
  descriptor: ModelDescriptor;
  generate(request: GenerationRequest): Promise<GenerationResult>;
}

export interface EmbeddingAdapter {
  modelId: string;
  embed(input: string): Promise<readonly number[]>;
}

export interface InferenceRouter {
  generate(request: GenerationRequest): Promise<GenerationResult>;
}
