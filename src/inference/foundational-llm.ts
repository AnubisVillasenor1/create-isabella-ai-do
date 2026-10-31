import { createLocalEngine } from './local-engine';
import { sovereignRag } from './rag';
import { generateText } from 'ai';
import { gateway } from '@ai-sdk/gateway';
import type { IsabellaGenesisRuntime } from '../genesis/runtime';
import type { GenerationResult } from './types';

export interface FoundationalRequest {
  input: string;
  systemPrompt: string;
  maxTokens?: number;
  history?: ReadonlyArray<{ role: 'user' | 'assistant'; content: string }>;
  knowledgeContext?: string;
}

export interface FoundationalResult {
  text: string;
  engine: 'foundational' | 'sovereign-fallback';
  latencyMs: number;
  modelId?: string;
}

/**
 * Isabella Foundational LLM — orquesta proveedores reales (open source / free)
 * con memoria de contexto y fallback soberano garantizado.
 */
export class IsabellaFoundationalLLM {
  private readonly cache = new Map<string, { result: FoundationalResult; expiresAt: number }>();
  private readonly cacheTtlMs = 60_000;

  constructor(private readonly runtime: IsabellaGenesisRuntime) {}

  private cacheKey(request: FoundationalRequest): string {
    const history = (request.history ?? []).map((t) => `${t.role}:${t.content}`).join('|');
    return `${request.maxTokens ?? 512}:${request.systemPrompt.slice(0, 128)}:${request.input}:${history}:${request.knowledgeContext ?? ''}`;
  }

  async generate(request: FoundationalRequest): Promise<FoundationalResult> {
    const started = Date.now();
    // Evict expired entries.
    for (const [k, v] of this.cache) {
      if (v.expiresAt <= Date.now()) this.cache.delete(k);
    }
    const key = this.cacheKey(request);
    const cached = this.cache.get(key);
    if (cached && cached.expiresAt > Date.now()) {
      return { ...cached.result, latencyMs: Math.max(1, Date.now() - started) };
    }

    const maxTokens = request.maxTokens ?? 512;
    const historyBlock = (request.history ?? [])
      .slice(-8)
      .map((turn) => `${turn.role === 'user' ? 'Usuario' : 'Isabella'}: ${turn.content}`)
      .join('\n');
    const knowledgeBlock = request.knowledgeContext?.trim()
      ? `Contexto verificado:\n${request.knowledgeContext.trim()}`
      : '';
    const ragHits = sovereignRag.search(request.input, 3).filter((h) => h.score > 0.05);
    const ragBlock = ragHits.length
      ? `Contexto recuperado (RAG soberano):\n${ragHits.map((h) => `- ${h.text}`).join('\n')}`
      : '';
    const prompt = [
      request.systemPrompt,
      knowledgeBlock,
      ragBlock,
      historyBlock ? `Historial reciente:\n${historyBlock}` : '',
      `Solicitud del usuario:\n${request.input}`,
    ]
      .filter(Boolean)
      .join('\n\n');

    // 0. Intentar AI SDK Gateway (modelo free de Vercel) si está disponible.
    try {
      const result = await generateText({
        model: gateway('nvidia/nemotron-3.5-lightning-free'),
        system: request.systemPrompt,
        prompt: request.input,
        maxOutputTokens: maxTokens,
        temperature: 0.35,
        providerOptions: { gateway: { disallowPromptTraining: true, sort: 'tps' } },
      });
      if (result.text && result.text.trim().length > 0) {
        const value: FoundationalResult = {
          text: result.text.trim(),
          engine: 'foundational',
          latencyMs: Math.max(1, Date.now() - started),
          modelId: 'ai-sdk-gateway:nemotron',
        };
        this.cache.set(key, { result: value, expiresAt: Date.now() + this.cacheTtlMs });
        return value;
      }
    } catch {
      // Degradar al siguiente proveedor.
    }

    // 1. Intentar proveedores reales registrados (Ollama, HF, Gratis, etc.)
    try {
      const result: GenerationResult = await this.runtime.generate({
        prompt,
        maxTokens,
      });
      if (result.text && result.text.trim().length > 0) {
        const value: FoundationalResult = {
          text: result.text.trim(),
          engine: 'foundational',
          latencyMs: Math.max(1, Date.now() - started),
          modelId: result.modelId,
        };
        this.cache.set(key, { result: value, expiresAt: Date.now() + this.cacheTtlMs });
        return value;
      }
    } catch {
      // Degradar al motor local soberano.
    }

    // 2. Fallback local determinista enriquecido (nunca se presenta como modelo externo).
    const local = await createLocalEngine().generate({ prompt: request.input, maxTokens });
    const value: FoundationalResult = {
      text: local.text,
      engine: 'sovereign-fallback',
      latencyMs: Math.max(1, Date.now() - started),
      modelId: 'isabella-local-fallback',
    };
    this.cache.set(key, { result: value, expiresAt: Date.now() + this.cacheTtlMs });
    return value;
  }
}

export function createFoundationalLLM(runtime: IsabellaGenesisRuntime): IsabellaFoundationalLLM {
  return new IsabellaFoundationalLLM(runtime);
}
