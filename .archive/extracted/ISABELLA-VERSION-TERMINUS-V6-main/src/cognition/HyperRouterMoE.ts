import { createHash } from 'node:crypto';
import { getPostgresMultimodelAdapter } from '../database/PostgresMultimodelAdapter';
import type { PostgresMultimodelAdapter } from '../database/PostgresMultimodelAdapter';

export interface HyperRouterConfig {
  semanticCacheThreshold: number;
  semanticCacheTTL: number;
  complexityThresholds: {
    llama8b: number;
    qwen14b: number;
    deepseek32b: number;
  };
  resourceThresholds: {
    cpuHigh: number;
    ramHigh: number;
  };
  localModels: ModelConfig[];
  fallbackModels: FallbackModelConfig[];
}

export interface ModelConfig {
  name: string;
  provider: 'ollama' | 'groq' | 'gemini' | 'openrouter' | 'hf';
  endpoint?: string;
  maxContextLength: number;
  complexityRange: [number, number];
  priority: number;
}

export interface FallbackModelConfig {
  name: string;
  provider: 'groq' | 'gemini' | 'openrouter' | 'hf';
  apiKeyEnv: string;
  maxContextLength: number;
  enabled: boolean;
}

export interface RoutingDecision {
  selectedModel: string;
  provider: string;
  complexityScore: number;
  fromCache: boolean;
  reasoning: string;
}

export interface GenerationRequest {
  prompt: string;
  maxTokens?: number;
  temperature?: number;
  context?: unknown;
  forceModel?: string;
  bypassCache?: boolean;
}

export interface GenerationResponse {
  text: string;
  model: string;
  tokensUsed: number;
  latencyMs: number;
  fromCache: boolean;
  complexityScore: number;
}

interface EmbeddingGenerator {
  generate(text: string): Promise<number[]>;
}

class SimpleComplexityScorer {
  private keywordWeights: Map<string, number> = new Map([
    ['explain', 10], ['analyze', 15], ['compare', 12], ['optimize', 18],
    ['debug', 20], ['refactor', 22], ['architect', 25], ['design', 18],
    ['implement', 15], ['algorithm', 20], ['complex', 25], ['distributed', 20],
    ['concurrent', 18], ['async', 12], ['recursive', 15], ['dynamic', 12],
    ['pattern', 10], ['best practice', 12], ['trade-off', 15], ['tradeoff', 15],
    ['security', 15], ['vulnerability', 20], ['exploit', 25], ['audit', 20],
    ['scale', 18], ['performance', 15], ['memory leak', 20], ['deadlock', 22],
    ['race condition', 25], ['consensus', 20], ['byzantine', 25], ['raft', 18],
    ['paxos', 22], ['cryptography', 20], ['encryption', 15], ['zero-knowledge', 25],
    ['blockchain', 18], ['smart contract', 20], ['solidity', 15], ['rust', 12],
    ['go', 10], ['python', 8], ['typescript', 10], ['javascript', 8],
    ['react', 10], ['vue', 8], ['angular', 10], ['node', 8],
    ['docker', 10], ['kubernetes', 15], ['k8s', 15], ['terraform', 15],
    ['aws', 10], ['gcp', 10], ['azure', 10], ['ci/cd', 12], ['pipeline', 10],
  ]);

  score(prompt: string): number {
    const lowerPrompt = prompt.toLowerCase();
    let score = 0;
    
    // Base score por longitud
    score += Math.min(prompt.length / 50, 30);
    
    // Score por palabras clave técnicas
    for (const [keyword, weight] of this.keywordWeights) {
      if (lowerPrompt.includes(keyword)) {
        score += weight;
      }
    }
    
    // Score por patrones de código
    const codePatterns = [
      /function\s+\w+/g,
      /class\s+\w+/g,
      /interface\s+\w+/g,
      /type\s+\w+/g,
      /async\s+function/g,
      /await\s+/g,
      /Promise</g,
      /async\s*\(/g,
    ];
    
    for (const pattern of codePatterns) {
      const matches = prompt.match(pattern);
      if (matches) score += matches.length * 5;
    }
    
    // Score por estructura compleja
    if (prompt.includes('```')) score += 10;
    if (prompt.split('\n').length > 20) score += 15;
    if (prompt.includes('TODO') || prompt.includes('FIXME')) score += 5;
    
    return Math.min(Math.max(score, 0), 100);
  }
}

class OllamaEmbeddingGenerator implements EmbeddingGenerator {
  private baseUrl: string;
  private model: string;

  constructor(baseUrl: string = 'http://localhost:11434', model: string = 'nomic-embed-text') {
    this.baseUrl = baseUrl;
    this.model = model;
  }

  async generate(text: string): Promise<number[]> {
    try {
      const response = await fetch(`${this.baseUrl}/api/embeddings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: this.model, prompt: text }),
      });
      
      if (!response.ok) throw new Error(`Embedding failed: ${response.statusText}`);
      
      const data = await response.json();
      return data.embedding;
    } catch (error) {
      console.error('[EmbeddingGenerator] Error:', error);
      // Fallback: hash determinístico simple para desarrollo
      return this.simpleHashEmbedding(text);
    }
  }

  private simpleHashEmbedding(text: string): number[] {
    // Embedding determinístico simple para desarrollo/testing
    const hash = createHash('sha256').update(text).digest();
    const embedding = new Array(1024).fill(0);
    for (let i = 0; i < hash.length; i++) {
      embedding[i % 1024] += hash[i] / 255;
    }
    // Normalizar
    const norm = Math.sqrt(embedding.reduce((sum, v) => sum + v * v, 0));
    return embedding.map(v => v / (norm || 1));
  }
}

export class HyperRouterMoE {
  private config: HyperRouterConfig;
  private db!: PostgresMultimodelAdapter;
  private scorer: SimpleComplexityScorer;
  private embeddingGenerator: EmbeddingGenerator;
  private initialized: boolean = false;

  constructor(config: Partial<HyperRouterConfig> = {}) {
    this.config = {
      semanticCacheThreshold: config.semanticCacheThreshold ?? 0.95,
      semanticCacheTTL: config.semanticCacheTTL ?? 86400,
      complexityThresholds: config.complexityThresholds ?? {
        llama8b: 25,
        qwen14b: 50,
        deepseek32b: 75,
      },
      resourceThresholds: config.resourceThresholds ?? {
        cpuHigh: 85,
        ramHigh: 90,
      },
      localModels: config.localModels ?? [
        { name: 'llama3.3:8b', provider: 'ollama', maxContextLength: 8192, complexityRange: [0, 25], priority: 1 },
        { name: 'qwen2.5-coder:14b', provider: 'ollama', maxContextLength: 32768, complexityRange: [26, 50], priority: 2 },
        { name: 'deepseek-r1:32b', provider: 'ollama', maxContextLength: 32768, complexityRange: [51, 100], priority: 3 },
      ],
      fallbackModels: config.fallbackModels ?? [
        { name: 'llama-3.3-70b-versatile', provider: 'groq', apiKeyEnv: 'GROQ_API_KEY', maxContextLength: 8192, enabled: true },
        { name: 'gemini-1.5-flash', provider: 'gemini', apiKeyEnv: 'GEMINI_API_KEY', maxContextLength: 1000000, enabled: true },
        { name: 'meta-llama/llama-3.1-405b-instruct', provider: 'openrouter', apiKeyEnv: 'OPENROUTER_API_KEY', maxContextLength: 128000, enabled: true },
      ],
    };
    
    this.scorer = new SimpleComplexityScorer();
    this.embeddingGenerator = new OllamaEmbeddingGenerator();
  }

  async initialize(db?: PostgresMultimodelAdapter): Promise<void> {
    if (this.initialized) return;
    
    this.db = db || getPostgresMultimodelAdapter();
    await this.db.initialize();
    await this.registerModels();
    this.initialized = true;
    console.log('[HyperRouterMoE] Initialized');
  }

  private async registerModels(): Promise<void> {
    for (const model of this.config.localModels) {
      await this.db.registerModel(model.name, model.provider, model.maxContextLength);
    }
    for (const model of this.config.fallbackModels) {
      if (model.enabled) {
        await this.db.registerModel(model.name, model.provider, model.maxContextLength);
      }
    }
  }

  async route(request: GenerationRequest): Promise<RoutingDecision> {
    if (!this.initialized) await this.initialize();
    
    const complexityScore = this.scorer.score(request.prompt);
    
    // 1. Verificar caché semántica (si no se fuerza bypass)
    if (!request.bypassCache) {
      const embedding = await this.embeddingGenerator.generate(request.prompt);
      const cacheResult = await this.db.querySemanticCache(embedding, this.config.semanticCacheThreshold);
      
      if (cacheResult.hit) {
        await this.db.recordRoutingDecision(
          this.hashPrompt(request.prompt),
          complexityScore,
          'semantic-cache',
          0
        );
        return {
          selectedModel: 'semantic-cache',
          provider: 'cache',
          complexityScore,
          fromCache: true,
          reasoning: `Cache hit (similarity: ${(cacheResult.similarity! * 100).toFixed(1)}%)`,
        };
      }
    }
    
    // 2. Verificar recursos del sistema
    const resources = await this.getSystemResources();
    const isOverloaded = resources.cpuPercent > this.config.resourceThresholds.cpuHigh || 
                         resources.ramPercent > this.config.resourceThresholds.ramHigh;
    
    // 3. Seleccionar modelo por complejidad
    let selectedModel: ModelConfig | FallbackModelConfig | null = null;
    let reasoning = '';
    
    if (isOverloaded) {
      // Sistema sobrecargado -> usar fallback nube
      selectedModel = this.config.fallbackModels.find(m => m.enabled) || null;
      reasoning = `System overloaded (CPU: ${resources.cpuPercent}%, RAM: ${resources.ramPercent}%) - using cloud fallback`;
    } else if (request.forceModel) {
      // Modelo forzado
      selectedModel = [...this.config.localModels, ...this.config.fallbackModels]
        .find(m => m.name === request.forceModel) || null;
      reasoning = `Model forced by request: ${request.forceModel}`;
    } else {
      // Selección por complejidad
      if (complexityScore <= this.config.complexityThresholds.llama8b) {
        selectedModel = this.config.localModels.find(m => m.name === 'llama3.3:8b') || null;
        reasoning = `Low complexity (${complexityScore}) -> Llama 3.3 8B`;
      } else if (complexityScore <= this.config.complexityThresholds.qwen14b) {
        selectedModel = this.config.localModels.find(m => m.name === 'qwen2.5-coder:14b') || null;
        reasoning = `Medium complexity (${complexityScore}) -> Qwen 2.5 Coder 14B`;
      } else {
        selectedModel = this.config.localModels.find(m => m.name === 'deepseek-r1:32b') || null;
        reasoning = `High complexity (${complexityScore}) -> DeepSeek-R1 32B`;
      }
    }
    
    if (!selectedModel) {
      // Fallback final
      selectedModel = this.config.fallbackModels.find(m => m.enabled) || this.config.localModels[0];
      reasoning = 'Default fallback';
    }
    
    await this.db.recordRoutingDecision(
      this.hashPrompt(request.prompt),
      complexityScore,
      selectedModel.name,
      0
    );
    
    return {
      selectedModel: selectedModel.name,
      provider: selectedModel.provider,
      complexityScore,
      fromCache: false,
      reasoning,
    };
  }

  async generate(request: GenerationRequest): Promise<GenerationResponse> {
    const startTime = Date.now();
    const decision = await this.route(request);
    
    if (decision.fromCache) {
      const embedding = await this.embeddingGenerator.generate(request.prompt);
      const cacheResult = await this.db.querySemanticCache(embedding, this.config.semanticCacheThreshold);
      return {
        text: cacheResult.response?.text || cacheResult.response || '',
        model: 'semantic-cache',
        tokensUsed: 0,
        latencyMs: Date.now() - startTime,
        fromCache: true,
        complexityScore: decision.complexityScore,
      };
    }
    
    let responseText = '';
    let tokensUsed = 0;
    
    try {
      if (decision.provider === 'ollama') {
        const result = await this.callOllama(decision.selectedModel, request);
        responseText = result.text;
        tokensUsed = result.tokensUsed;
      } else if (decision.provider === 'groq') {
        const result = await this.callGroq(decision.selectedModel, request);
        responseText = result.text;
        tokensUsed = result.tokensUsed;
      } else if (decision.provider === 'gemini') {
        const result = await this.callGemini(decision.selectedModel, request);
        responseText = result.text;
        tokensUsed = result.tokensUsed;
      } else if (decision.provider === 'openrouter') {
        const result = await this.callOpenRouter(decision.selectedModel, request);
        responseText = result.text;
        tokensUsed = result.tokensUsed;
      } else {
        throw new Error(`Unknown provider: ${decision.provider}`);
      }
      
      // Guardar en caché semántica
      const embedding = await this.embeddingGenerator.generate(request.prompt);
      await this.db.storeSemanticCache(request.prompt, embedding, { text: responseText }, this.config.semanticCacheTTL);
      
      await this.db.updateRoutingMetrics(decision.selectedModel, true, Date.now() - startTime);
      
      return {
        text: responseText,
        model: decision.selectedModel,
        tokensUsed,
        latencyMs: Date.now() - startTime,
        fromCache: false,
        complexityScore: decision.complexityScore,
      };
    } catch (error) {
      await this.db.updateRoutingMetrics(decision.selectedModel, false, Date.now() - startTime);
      throw error;
    }
  }

  private async callOllama(model: string, request: GenerationRequest): Promise<{ text: string; tokensUsed: number }> {
    const baseUrl = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
    const response = await fetch(`${baseUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        prompt: request.prompt,
        stream: false,
        options: {
          num_predict: request.maxTokens || 2048,
          temperature: request.temperature ?? 0.7,
        },
      }),
    });
    
    if (!response.ok) throw new Error(`Ollama error: ${response.statusText}`);
    const data = await response.json();
    return { text: data.response || '', tokensUsed: data.eval_count || 0 };
  }

  private async callGroq(model: string, request: GenerationRequest): Promise<{ text: string; tokensUsed: number }> {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) throw new Error('GROQ_API_KEY not configured');
    
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: request.prompt }],
        max_tokens: request.maxTokens || 2048,
        temperature: request.temperature ?? 0.7,
      }),
    });
    
    if (!response.ok) throw new Error(`Groq error: ${response.statusText}`);
    const data = await response.json();
    return { 
      text: data.choices[0]?.message?.content || '', 
      tokensUsed: data.usage?.total_tokens || 0 
    };
  }

  private async callGemini(model: string, request: GenerationRequest): Promise<{ text: string; tokensUsed: number }> {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error('GEMINI_API_KEY not configured');
    
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: request.prompt }] }],
          generationConfig: {
            maxOutputTokens: request.maxTokens || 2048,
            temperature: request.temperature ?? 0.7,
          },
        }),
      });
    
    if (!response.ok) throw new Error(`Gemini error: ${response.statusText}`);
    const data = await response.json();
    return { 
      text: data.candidates[0]?.content?.parts[0]?.text || '', 
      tokensUsed: data.usageMetadata?.totalTokenCount || 0 
    };
  }

  private async callOpenRouter(model: string, request: GenerationRequest): Promise<{ text: string; tokensUsed: number }> {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) throw new Error('OPENROUTER_API_KEY not configured');
    
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://isabella.tamv.online',
        'X-Title': 'Isabella Genesis',
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: request.prompt }],
        max_tokens: request.maxTokens || 2048,
        temperature: request.temperature ?? 0.7,
      }),
    });
    
    if (!response.ok) throw new Error(`OpenRouter error: ${response.statusText}`);
    const data = await response.json();
    return { 
      text: data.choices[0]?.message?.content || '', 
      tokensUsed: data.usage?.total_tokens || 0 
    };
  }

  private hashPrompt(prompt: string): string {
    return createHash('sha256').update(prompt).digest('hex');
  }

  private async getSystemResources(): Promise<{ cpuPercent: number; ramPercent: number }> {
    // En producción, usar métricas reales del sistema
    // Por ahora, simulamos
    return { cpuPercent: 45, ramPercent: 55 };
  }

  async getHealth(): Promise<{
    status: 'healthy' | 'degraded';
    database: unknown;
    resources: { cpuPercent: number; ramPercent: number };
    models: { local: number; fallback: number };
    config: { cacheThreshold: number; complexityThresholds: HyperRouterConfig['complexityThresholds'] };
  }> {
    const dbHealth = await this.db.healthCheck();
    const resources = await this.getSystemResources();
    return {
      status: dbHealth.healthy ? 'healthy' : 'degraded',
      database: dbHealth,
      resources,
      models: {
        local: this.config.localModels.length,
        fallback: this.config.fallbackModels.filter(m => m.enabled).length,
      },
      config: {
        cacheThreshold: this.config.semanticCacheThreshold,
        complexityThresholds: this.config.complexityThresholds,
      },
    };
  }
}

// Singleton
let hyperRouterInstance: HyperRouterMoE | null = null;

export function getHyperRouter(config?: Partial<HyperRouterConfig>): HyperRouterMoE {
  if (!hyperRouterInstance) {
    hyperRouterInstance = new HyperRouterMoE(config);
  }
  return hyperRouterInstance;
}

export async function initializeHyperRouter(config?: Partial<HyperRouterConfig>, db?: PostgresMultimodelAdapter): Promise<HyperRouterMoE> {
  const router = getHyperRouter(config);
  await router.initialize(db);
  return router;
}
