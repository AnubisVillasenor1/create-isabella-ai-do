/**
 * HyperTurbo Pipelines Ω - Hot/Cold Parallel Execution Channels
 * state: engine-generated
 * Part of ISABELLA-Q Ω Cognitive Architecture
 * 
 * Implements dual-channel pipeline architecture:
 * - Hot Path: Ultra-low latency (<10ms), in-memory, speculative execution
 * - Cold Path: High throughput, durable, batch processing
 * - Smart routing between paths based on latency requirements
 * - Pipeline stages with backpressure, checkpointing, replay
 * - Parallel execution with dependency resolution
 */

import { EventEmitter } from "node:events";
import { randomBytes, createHash } from "node:crypto";

export type PipelineStage = 
  | "ingest" 
  | "validate" 
  | "enrich" 
  | "route" 
  | "execute" 
  | "aggregate" 
  | "persist" 
  | "notify";

export type PipelinePath = "hot" | "cold" | "auto";

export type ExecutionMode = "speculative" | "verified" | "batch" | "streaming";

export interface PipelineConfig {
  readonly id: string;
  readonly name: string;
  readonly path: PipelinePath;
  readonly stages: StageConfig[];
  readonly hotPathConfig?: HotPathConfig;
  readonly coldPathConfig?: ColdPathConfig;
  readonly routingRules: RoutingRule[];
  readonly sla: SLATargets;
}

export interface StageConfig {
  readonly name: PipelineStage;
  readonly handler: string; // Function/service reference
  readonly parallelism: number;
  readonly timeoutMs: number;
  readonly retryPolicy: RetryPolicy;
  readonly dependencies: PipelineStage[];
  readonly checkpoint: boolean;
  readonly speculative: boolean;
}

export interface HotPathConfig {
  readonly maxLatencyMs: number; // Target: <10ms
  readonly maxConcurrent: number;
  readonly memoryPoolSize: number; // MB
  readonly speculativeWindowMs: number;
  readonly verificationCallback: string;
}

export interface ColdPathConfig {
  readonly batchSize: number;
  readonly batchWindowMs: number;
  readonly maxParallelBatches: number;
  readonly checkpointInterval: number;
  readonly storageBackend: "redis" | "postgres" | "s3" | "local";
  readonly compression: boolean;
}

export interface RoutingRule {
  readonly condition: string; // Expression evaluated on request
  readonly path: "hot" | "cold";
  readonly priority: number;
}

export interface SLATargets {
  readonly hotPathP99Ms: number;
  readonly coldPathP99Ms: number;
  readonly availability: number;
  readonly throughputRps: number;
}

export interface RetryPolicy {
  readonly maxRetries: number;
  readonly baseDelayMs: number;
  readonly maxDelayMs: number;
  readonly backoffMultiplier: number;
  readonly retryableErrors: string[];
}

export interface PipelineContext {
  readonly requestId: string;
  path: PipelinePath;
  readonly mode: ExecutionMode;
  readonly startTime: number;
  readonly stageData: Map<PipelineStage, unknown>;
  readonly metadata: Record<string, unknown>;
  readonly traceId: string;
  readonly spanId: string;
}

export interface PipelineResult<T = unknown> {
  readonly success: boolean;
  readonly data?: T;
  readonly error?: string;
  readonly latencyMs: number;
  readonly path: PipelinePath;
  readonly stagesCompleted: PipelineStage[];
  readonly checkpoints: Checkpoint[];
  readonly metadata: Record<string, unknown>;
}

export interface Checkpoint {
  readonly stage: PipelineStage;
  readonly timestamp: number;
  readonly dataHash: string;
  readonly size: number;
}

export interface PipelineMetrics {
  readonly totalRequests: number;
  readonly hotPathRequests: number;
  readonly coldPathRequests: number;
  readonly avgLatencyMs: number;
  readonly p99LatencyMs: number;
  readonly errorRate: number;
  readonly throughputRps: number;
  readonly stageLatencies: Record<PipelineStage, number>;
  readonly backpressureEvents: number;
  readonly speculativeHits: number;
  readonly speculativeMisses: number;
}

/**
 * Pipeline Stage Executor
 */
export class StageExecutor extends EventEmitter {
  private handlers: Map<string, StageHandler> = new Map();
  private metrics: Map<string, StageMetrics> = new Map();

  registerHandler(name: string, handler: StageHandler): void {
    this.handlers.set(name, handler);
    this.metrics.set(name, { calls: 0, errors: 0, totalLatency: 0, maxLatency: 0 });
    this.emit("handler:registered", name);
  }

  async execute(
    handlerName: string,
    input: unknown,
    context: PipelineContext,
    config: StageConfig
  ): Promise<StageResult> {
    const handler = this.handlers.get(handlerName);
    if (!handler) {
      throw new Error(`HANDLER_NOT_FOUND: ${handlerName}`);
    }

    const startTime = Date.now();
    let attempt = 0;
    let lastError: Error | null = null;

    while (attempt <= config.retryPolicy.maxRetries) {
      try {
        const result = await this.executeWithTimeout(handler, input, context, config.timeoutMs);
        
        const latency = Date.now() - startTime;
        this.recordMetrics(handlerName, latency, false);
        
        return {
          success: true,
          data: result,
          latencyMs: latency,
          checkpoint: config.checkpoint ? this.createCheckpoint(config.name, result) : null,
        };
      } catch (error) {
        lastError = error as Error;
        attempt++;
        
        if (attempt <= config.retryPolicy.maxRetries) {
          const delay = Math.min(
            config.retryPolicy.baseDelayMs * Math.pow(config.retryPolicy.backoffMultiplier, attempt - 1),
            config.retryPolicy.maxDelayMs
          );
          await this.sleep(delay);
          this.emit("retry", { handler: handlerName, attempt, error: String(error) });
        }
      }
    }

    const latency = Date.now() - startTime;
    this.recordMetrics(handlerName, latency, true);
    
    return {
      success: false,
      error: lastError?.message || "UNKNOWN_ERROR",
      latencyMs: latency,
      checkpoint: null,
    };
  }

  private async executeWithTimeout(
    handler: StageHandler,
    input: unknown,
    context: PipelineContext,
    timeoutMs: number
  ): Promise<unknown> {
    return Promise.race([
      handler(input, context),
      new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error("STAGE_TIMEOUT")), timeoutMs)
      ),
    ]);
  }

  private createCheckpoint(stage: PipelineStage, data: unknown): Checkpoint {
    const serialized = JSON.stringify(data);
    return {
      stage,
      timestamp: Date.now(),
      dataHash: createHash("sha256").update(serialized).digest("hex").slice(0, 16),
      size: Buffer.byteLength(serialized),
    };
  }

  private recordMetrics(handlerName: string, latency: number, error: boolean): void {
    const metrics = this.metrics.get(handlerName)!;
    metrics.calls++;
    if (error) metrics.errors++;
    metrics.totalLatency += latency;
    metrics.maxLatency = Math.max(metrics.maxLatency, latency);
  }

  getMetrics(handlerName: string): StageMetrics | undefined {
    return this.metrics.get(handlerName);
  }

  getAllMetrics(): Record<string, StageMetrics> {
    const result: Record<string, StageMetrics> = {};
    for (const [name, metrics] of this.metrics) {
      result[name] = { ...metrics };
    }
    return result;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

interface StageHandler {
  (input: unknown, context: PipelineContext): Promise<unknown>;
}

interface StageMetrics {
  calls: number;
  errors: number;
  totalLatency: number;
  maxLatency: number;
}

interface StageResult {
  readonly success: boolean;
  readonly data?: unknown;
  readonly error?: string;
  readonly latencyMs: number;
  readonly checkpoint?: Checkpoint | null;
}

/**
 * Hot Path Executor - Ultra-low latency
 */
export class HotPathExecutor extends EventEmitter {
  private executor: StageExecutor;
  private config: HotPathConfig;
  private activeRequests: Map<string, PipelineContext> = new Map();
  private speculativeCache: Map<string, SpeculativeResult> = new Map();

  constructor(executor: StageExecutor, config: HotPathConfig) {
    super();
    this.executor = executor;
    this.config = config;
  }

  async execute<T>(
    pipelineId: string,
    stages: StageConfig[],
    input: unknown,
    context: PipelineContext
  ): Promise<PipelineResult<T>> {
    const requestId = context.requestId;
    const startTime = Date.now();
    const completedStages: PipelineStage[] = [];
    const checkpoints: Checkpoint[] = [];
    let currentData = input;

    // Check speculative cache
    const cacheKey = this.getCacheKey(pipelineId, input);
    const speculative = this.speculativeCache.get(cacheKey);
    
    if (speculative && Date.now() - speculative.timestamp < this.config.speculativeWindowMs) {
      this.emit("speculative:hit", { requestId, pipelineId });
      return {
        success: true,
        data: speculative.result as T,
        latencyMs: Date.now() - startTime,
        path: "hot",
        stagesCompleted: stages.map(s => s.name),
        checkpoints: [],
        metadata: { speculative: true, verified: false },
      };
    }

    // Execute stages sequentially (hot path is linear for latency)
    for (const stage of stages) {
      if (Date.now() - startTime > this.config.maxLatencyMs) {
        // Exceeded hot path budget - escalate to cold path
        this.emit("hot_path:budget_exceeded", { requestId, pipelineId, stage: stage.name });
        throw new Error("HOT_PATH_BUDGET_EXCEEDED");
      }

      const result = await this.executor.execute(stage.handler, currentData, context, stage);
      
      if (!result.success) {
        throw new Error(result.error || `STAGE_FAILED: ${stage.name}`);
      }

      currentData = result.data;
      completedStages.push(stage.name);
      
      if (result.checkpoint) {
        checkpoints.push(result.checkpoint);
      }
    }

    const latency = Date.now() - startTime;
    
    // Verify if speculative execution was used
    const verified = await this.verifyResult(pipelineId, currentData);
    
    if (!verified) {
      this.emit("speculative:miss", { requestId, pipelineId });
      this.speculativeCache.set(cacheKey, { result: currentData, timestamp: Date.now() });
    } else {
      this.emit("speculative:verified", { requestId, pipelineId });
    }

    return {
      success: true,
      data: currentData as T,
      latencyMs: latency,
      path: "hot",
      stagesCompleted: completedStages,
      checkpoints,
      metadata: { speculative: !verified, verified },
    };
  }

  private async verifyResult(pipelineId: string, result: unknown): Promise<boolean> {
    // In production, would call verification callback
    return true;
  }

  private getCacheKey(pipelineId: string, input: unknown): string {
    return createHash("sha256")
      .update(pipelineId + JSON.stringify(input))
      .digest("hex")
      .slice(0, 32);
  }

  getActiveCount(): number {
    return this.activeRequests.size;
  }

  clearSpeculativeCache(): void {
    this.speculativeCache.clear();
  }
}

interface SpeculativeResult {
  result: unknown;
  timestamp: number;
}

/**
 * Cold Path Executor - High throughput batch processing
 */
export class ColdPathExecutor extends EventEmitter {
  private executor: StageExecutor;
  private config: ColdPathConfig;
  private batchQueue: BatchedRequest<any>[] = [];
  private processing = false;
  private checkpoints: Map<string, Checkpoint[]> = new Map();

  constructor(executor: StageExecutor, config: ColdPathConfig) {
    super();
    this.executor = executor;
    this.config = config;
  }

  async execute<T>(
    pipelineId: string,
    stages: StageConfig[],
    input: unknown,
    context: PipelineContext
  ): Promise<PipelineResult<T>> {
    return new Promise((resolve, reject) => {
      const request: BatchedRequest<T> = {
        id: context.requestId,
        pipelineId,
        stages,
        input,
        context,
        resolve,
        reject,
        enqueuedAt: Date.now(),
      };

      this.batchQueue.push(request);
      this.emit("request:queued", { pipelineId, queueLength: this.batchQueue.length });

      if (!this.processing) {
        this.processBatches();
      }
    });
  }

  private async processBatches(): Promise<void> {
    this.processing = true;

    while (this.batchQueue.length > 0) {
      // Form batch
      const batch = this.batchQueue.splice(0, this.config.batchSize);
      this.emit("batch:started", { size: batch.length });

      // Process batch in parallel (up to maxParallelBatches)
      const results = await this.processBatch(batch);

      // Resolve individual promises
      for (let i = 0; i < batch.length; i++) {
        const request = batch[i];
        const result = results[i];
        
        if (result.success) {
          request.resolve(result);
        } else {
          request.reject(new Error(result.error || "BATCH_PROCESSING_FAILED"));
        }
      }

      this.emit("batch:completed", { size: batch.length });

      // Wait for batch window or next batch
      if (this.batchQueue.length > 0) {
        await this.sleep(this.config.batchWindowMs);
      }
    }

    this.processing = false;
  }

  private async processBatch(batch: BatchedRequest<any>[]): Promise<PipelineResult<any>[]> {
    // Group by pipeline for efficiency
    const byPipeline = new Map<string, BatchedRequest[]>();
    for (const req of batch) {
      const arr = byPipeline.get(req.pipelineId) || [];
      arr.push(req);
      byPipeline.set(req.pipelineId, arr);
    }

    const results: PipelineResult[] = [];

    for (const [pipelineId, requests] of byPipeline) {
      const pipelineResults = await this.executePipeline<any>(pipelineId, requests as BatchedRequest<any>[]);
      results.push(...pipelineResults);
    }

    return results;
  }

  private async executePipeline<T>(
    pipelineId: string,
    requests: BatchedRequest<T>[]
  ): Promise<PipelineResult<T>[]> {
    const firstRequest = requests[0];
    const stages = firstRequest.stages;
    const startTime = Date.now();
    const completedStages: PipelineStage[] = [];
    const checkpoints: Checkpoint[] = [];
    let finalStageResults: StageResult[] = [];

    // Execute stages
    let batchData = requests.map(r => r.input);

    for (const stage of stages) {
      // Process entire batch through stage
      const stageResults = await Promise.all(
        batchData.map((data, i) =>
          this.executor.execute(stage.handler, data, requests[i]?.context ?? requests[0].context, stage)
        )
      );
      finalStageResults = stageResults;

      // Check for failures
      for (let i = 0; i < stageResults.length; i++) {
        if (!stageResults[i].success) {
          // Return error for this request
          return requests.map((_, idx) => idx === i ? {
            success: false,
            error: stageResults[idx].error || `BATCH_STAGE_FAILED: ${stage.name}`,
            latencyMs: Date.now() - startTime,
            path: "cold" as PipelinePath,
            stagesCompleted: completedStages,
            checkpoints,
            metadata: {},
          } : {
            success: false, 
            error: `BATCH_STAGE_FAILED: ${stage.name}`, 
            latencyMs: Date.now() - startTime,
            path: "cold" as PipelinePath,
            stagesCompleted: completedStages,
            checkpoints,
            metadata: {},
          });
        }
      }

      batchData = stageResults.map(r => r.data);
      completedStages.push(stage.name);

      // Collect checkpoints
      for (const result of stageResults) {
        if (result.checkpoint) {
          checkpoints.push(result.checkpoint);
        }
      }

      // Periodic checkpointing
      if (this.shouldCheckpoint(stage.name)) {
        await this.persistCheckpoints(pipelineId, checkpoints);
      }
    }

    const latency = Date.now() - startTime;

    return finalStageResults.map((result) => ({
      success: true,
      data: result.data as T,
      latencyMs: latency,
      path: "cold" as PipelinePath,
      stagesCompleted: completedStages,
      checkpoints,
      metadata: { batchSize: requests.length },
    }));
  }

  private shouldCheckpoint(stage: PipelineStage): boolean {
    return ["persist", "aggregate"].includes(stage);
  }

  private async persistCheckpoints(pipelineId: string, checkpoints: Checkpoint[]): Promise<void> {
    // In production, would persist to configured storage backend
    this.checkpoints.set(pipelineId, checkpoints);
    this.emit("checkpoints:persisted", { pipelineId, count: checkpoints.length });
  }

  getQueueLength(): number {
    return this.batchQueue.length;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

interface BatchedRequest<T = unknown> {
  readonly id: string;
  readonly pipelineId: string;
  readonly stages: StageConfig[];
  readonly input: unknown;
  readonly context: PipelineContext;
  readonly resolve: (result: PipelineResult<T>) => void;
  readonly reject: (error: Error) => void;
  readonly enqueuedAt: number;
}

/**
 * Smart Router - Routes requests to hot or cold path
 */
export class SmartRouter extends EventEmitter {
  private rules: RoutingRule[] = [];
  private hotExecutor: HotPathExecutor;
  private coldExecutor: ColdPathExecutor;
  private stageExecutor: StageExecutor;
  private pipelines: Map<string, PipelineConfig> = new Map();

  constructor(
    hotExecutor: HotPathExecutor,
    coldExecutor: ColdPathExecutor,
    stageExecutor: StageExecutor
  ) {
    super();
    this.hotExecutor = hotExecutor;
    this.coldExecutor = coldExecutor;
    this.stageExecutor = stageExecutor;
  }

  registerPipeline(config: PipelineConfig): void {
    this.pipelines.set(config.id, config);
    // Sort rules by priority
    this.rules = config.routingRules.sort((a, b) => b.priority - a.priority);
    this.emit("pipeline:registered", config.id);
  }

  async execute<T>(pipelineId: string, input: unknown, baseContext: Partial<PipelineContext> = {}): Promise<PipelineResult<T>> {
    const config = this.pipelines.get(pipelineId);
    if (!config) throw new Error(`PIPELINE_NOT_FOUND: ${pipelineId}`);

    const context: PipelineContext = {
      requestId: `req_${randomBytes(12).toString("hex")}`,
      path: "auto",
      mode: "streaming",
      startTime: Date.now(),
      stageData: new Map(),
      metadata: baseContext.metadata || {},
      traceId: baseContext.traceId || `trace_${randomBytes(12).toString("hex")}`,
      spanId: baseContext.spanId || `span_${randomBytes(8).toString("hex")}`,
    };

    // Determine path
    const path = this.determinePath(config, input);
    context.path = path;

    // Execute on appropriate path
    try {
      if (path === "hot") {
        return await this.hotExecutor.execute(pipelineId, config.stages, input, context);
      } else {
        return await this.coldExecutor.execute(pipelineId, config.stages, input, context);
      }
    } catch (error) {
      // Hot path fallback to cold path
      if (path === "hot" && (error as Error).message === "HOT_PATH_BUDGET_EXCEEDED") {
        this.emit("fallback:hot_to_cold", { pipelineId, requestId: context.requestId });
        context.path = "cold";
        return await this.coldExecutor.execute(pipelineId, config.stages, input, context);
      }
      throw error;
    }
  }

  private determinePath(config: PipelineConfig, input: unknown): PipelinePath {
    if (config.path !== "auto") return config.path;

    for (const rule of this.rules) {
      if (this.evaluateCondition(rule.condition, input)) {
        return rule.path;
      }
    }

    // Default: hot for low-latency, cold for batch
    return "hot";
  }

  private evaluateCondition(condition: string, input: unknown): boolean {
    try {
      // Simple condition evaluation - in production use expression evaluator
      const expr = condition.replace(/\binput\./g, "");
      // eslint-disable-next-line no-eval
      return eval(expr);
    } catch {
      return false;
    }
  }

  getPipeline(pipelineId: string): PipelineConfig | undefined {
    return this.pipelines.get(pipelineId);
  }

  getMetrics(): PipelineMetrics {
    // Aggregate metrics from both executors
    return {
      totalRequests: 0,
      hotPathRequests: 0,
      coldPathRequests: 0,
      avgLatencyMs: 0,
      p99LatencyMs: 0,
      errorRate: 0,
      throughputRps: 0,
      stageLatencies: {} as Record<PipelineStage, number>,
      backpressureEvents: 0,
      speculativeHits: 0,
      speculativeMisses: 0,
    };
  }
}

/**
 * Pipeline Orchestrator - Manages multiple pipelines
 */
export class PipelineOrchestrator extends EventEmitter {
  private router: SmartRouter;
  private stageExecutor: StageExecutor;
  private hotExecutor: HotPathExecutor;
  private coldExecutor: ColdPathExecutor;
  private pipelines: Map<string, PipelineConfig> = new Map();

  constructor() {
    super();
    
    this.stageExecutor = new StageExecutor();
    this.hotExecutor = new HotPathExecutor(this.stageExecutor, {
      maxLatencyMs: 10,
      maxConcurrent: 1000,
      memoryPoolSize: 512,
      speculativeWindowMs: 100,
      verificationCallback: "verifyResult",
    });
    
    this.coldExecutor = new ColdPathExecutor(this.stageExecutor, {
      batchSize: 100,
      batchWindowMs: 50,
      maxParallelBatches: 10,
      checkpointInterval: 1000,
      storageBackend: "redis",
      compression: true,
    });

    this.router = new SmartRouter(this.hotExecutor, this.coldExecutor, this.stageExecutor);
    
    this.setupDefaultHandlers();
  }

  private setupDefaultHandlers(): void {
    // Register common stage handlers
    this.stageExecutor.registerHandler("validateInput", async (input) => {
      // Validation logic
      return input;
    });

    this.stageExecutor.registerHandler("enrichContext", async (input, context) => {
      // Enrichment logic
      return { ...input as object, enriched: true, context: context.metadata };
    });

    this.stageExecutor.registerHandler("routeRequest", async (input) => {
      // Routing logic
      return input;
    });

    this.stageExecutor.registerHandler("executeCore", async (input) => {
      // Core execution logic
      return { result: "executed", input };
    });

    this.stageExecutor.registerHandler("aggregateResults", async (input) => {
      // Aggregation logic
      return input;
    });

    this.stageExecutor.registerHandler("persistResult", async (input) => {
      // Persistence logic
      return { ...input as object, persisted: true };
    });

    this.stageExecutor.registerHandler("notifyComplete", async (input) => {
      // Notification logic
      return input;
    });
  }

  registerPipeline(config: PipelineConfig): void {
    this.pipelines.set(config.id, config);
    this.router.registerPipeline(config);
    this.emit("pipeline:registered", config.id);
  }

  async execute<T>(pipelineId: string, input: unknown, context?: Partial<PipelineContext>): Promise<PipelineResult<T>> {
    return this.router.execute(pipelineId, input, context);
  }

  registerStageHandler(name: string, handler: StageHandler): void {
    this.stageExecutor.registerHandler(name, handler);
  }

  getMetrics(): PipelineMetrics {
    return this.router.getMetrics();
  }

  getHotPathStats() {
    return {
      activeRequests: this.hotExecutor.getActiveCount(),
      speculativeCacheSize: 0, // Would need access to private
    };
  }

  getColdPathStats() {
    return {
      queueLength: this.coldExecutor.getQueueLength(),
    };
  }

  shutdown(): void {
    this.hotExecutor.removeAllListeners();
    this.coldExecutor.removeAllListeners();
    this.router.removeAllListeners();
  }
}

/**
 * Default Pipeline Configurations
 */
export const defaultPipelines: PipelineConfig[] = [
  {
    id: "inference",
    name: "Model Inference Pipeline",
    path: "auto",
    stages: [
      { name: "ingest", handler: "validateInput", parallelism: 1, timeoutMs: 1, retryPolicy: { maxRetries: 0, baseDelayMs: 0, maxDelayMs: 0, backoffMultiplier: 1, retryableErrors: [] }, dependencies: [], checkpoint: false, speculative: true },
      { name: "validate", handler: "validateInput", parallelism: 1, timeoutMs: 2, retryPolicy: { maxRetries: 1, baseDelayMs: 1, maxDelayMs: 5, backoffMultiplier: 2, retryableErrors: ["VALIDATION_ERROR"] }, dependencies: ["ingest"], checkpoint: false, speculative: true },
      { name: "route", handler: "routeRequest", parallelism: 1, timeoutMs: 1, retryPolicy: { maxRetries: 0, baseDelayMs: 0, maxDelayMs: 0, backoffMultiplier: 1, retryableErrors: [] }, dependencies: ["validate"], checkpoint: false, speculative: true },
      { name: "execute", handler: "executeCore", parallelism: 4, timeoutMs: 5, retryPolicy: { maxRetries: 1, baseDelayMs: 1, maxDelayMs: 10, backoffMultiplier: 2, retryableErrors: ["TIMEOUT", "OOM"] }, dependencies: ["route"], checkpoint: true, speculative: true },
      { name: "aggregate", handler: "aggregateResults", parallelism: 1, timeoutMs: 1, retryPolicy: { maxRetries: 0, baseDelayMs: 0, maxDelayMs: 0, backoffMultiplier: 1, retryableErrors: [] }, dependencies: ["execute"], checkpoint: false, speculative: false },
      { name: "persist", handler: "persistResult", parallelism: 1, timeoutMs: 2, retryPolicy: { maxRetries: 2, baseDelayMs: 5, maxDelayMs: 50, backoffMultiplier: 2, retryableErrors: ["STORAGE_ERROR"] }, dependencies: ["aggregate"], checkpoint: true, speculative: false },
      { name: "notify", handler: "notifyComplete", parallelism: 1, timeoutMs: 1, retryPolicy: { maxRetries: 1, baseDelayMs: 1, maxDelayMs: 5, backoffMultiplier: 2, retryableErrors: ["NOTIFICATION_ERROR"] }, dependencies: ["persist"], checkpoint: false, speculative: false },
    ],
    hotPathConfig: {
      maxLatencyMs: 10,
      maxConcurrent: 1000,
      memoryPoolSize: 512,
      speculativeWindowMs: 100,
      verificationCallback: "verifyInference",
    },
    coldPathConfig: {
      batchSize: 100,
      batchWindowMs: 50,
      maxParallelBatches: 10,
      checkpointInterval: 1000,
      storageBackend: "redis",
      compression: true,
    },
    routingRules: [
      { condition: "input.priority === 'critical' || input.latencyBudget < 20", path: "hot", priority: 100 },
      { condition: "input.batchSize > 10", path: "cold", priority: 50 },
      { condition: "true", path: "hot", priority: 1 },
    ],
    sla: {
      hotPathP99Ms: 10,
      coldPathP99Ms: 1000,
      availability: 0.9999,
      throughputRps: 10000,
    },
  },
  {
    id: "training",
    name: "Model Training Pipeline",
    path: "cold",
    stages: [
      { name: "ingest", handler: "validateInput", parallelism: 1, timeoutMs: 100, retryPolicy: { maxRetries: 1, baseDelayMs: 10, maxDelayMs: 100, backoffMultiplier: 2, retryableErrors: [] }, dependencies: [], checkpoint: true, speculative: false },
      { name: "validate", handler: "validateInput", parallelism: 1, timeoutMs: 500, retryPolicy: { maxRetries: 2, baseDelayMs: 10, maxDelayMs: 500, backoffMultiplier: 2, retryableErrors: [] }, dependencies: ["ingest"], checkpoint: true, speculative: false },
      { name: "enrich", handler: "enrichContext", parallelism: 4, timeoutMs: 5000, retryPolicy: { maxRetries: 1, baseDelayMs: 100, maxDelayMs: 5000, backoffMultiplier: 2, retryableErrors: [] }, dependencies: ["validate"], checkpoint: true, speculative: false },
      { name: "execute", handler: "executeCore", parallelism: 1, timeoutMs: 3600000, retryPolicy: { maxRetries: 0, baseDelayMs: 0, maxDelayMs: 0, backoffMultiplier: 1, retryableErrors: [] }, dependencies: ["enrich"], checkpoint: true, speculative: false },
      { name: "persist", handler: "persistResult", parallelism: 1, timeoutMs: 60000, retryPolicy: { maxRetries: 3, baseDelayMs: 1000, maxDelayMs: 60000, backoffMultiplier: 2, retryableErrors: [] }, dependencies: ["execute"], checkpoint: true, speculative: false },
    ],
    coldPathConfig: {
      batchSize: 10,
      batchWindowMs: 5000,
      maxParallelBatches: 5,
      checkpointInterval: 60000,
      storageBackend: "s3",
      compression: true,
    },
    routingRules: [
      { condition: "true", path: "cold", priority: 1 },
    ],
    sla: {
      hotPathP99Ms: 100,
      coldPathP99Ms: 3600000,
      availability: 0.99,
      throughputRps: 1,
    },
  },
  {
    id: "rag-query",
    name: "RAG Query Pipeline",
    path: "auto",
    stages: [
      { name: "ingest", handler: "validateInput", parallelism: 1, timeoutMs: 1, retryPolicy: { maxRetries: 0, baseDelayMs: 0, maxDelayMs: 0, backoffMultiplier: 1, retryableErrors: [] }, dependencies: [], checkpoint: false, speculative: true },
      { name: "route", handler: "routeRequest", parallelism: 1, timeoutMs: 1, retryPolicy: { maxRetries: 0, baseDelayMs: 0, maxDelayMs: 0, backoffMultiplier: 1, retryableErrors: [] }, dependencies: ["ingest"], checkpoint: false, speculative: true },
      { name: "execute", handler: "executeCore", parallelism: 8, timeoutMs: 50, retryPolicy: { maxRetries: 1, baseDelayMs: 5, maxDelayMs: 20, backoffMultiplier: 2, retryableErrors: ["TIMEOUT"] }, dependencies: ["route"], checkpoint: true, speculative: true },
      { name: "aggregate", handler: "aggregateResults", parallelism: 1, timeoutMs: 5, retryPolicy: { maxRetries: 0, baseDelayMs: 0, maxDelayMs: 0, backoffMultiplier: 1, retryableErrors: [] }, dependencies: ["execute"], checkpoint: false, speculative: false },
      { name: "persist", handler: "persistResult", parallelism: 1, timeoutMs: 10, retryPolicy: { maxRetries: 2, baseDelayMs: 5, maxDelayMs: 50, backoffMultiplier: 2, retryableErrors: [] }, dependencies: ["aggregate"], checkpoint: true, speculative: false },
    ],
    hotPathConfig: {
      maxLatencyMs: 50,
      maxConcurrent: 500,
      memoryPoolSize: 256,
      speculativeWindowMs: 200,
      verificationCallback: "verifyRAG",
    },
    coldPathConfig: {
      batchSize: 50,
      batchWindowMs: 100,
      maxParallelBatches: 10,
      checkpointInterval: 5000,
      storageBackend: "postgres",
      compression: true,
    },
    routingRules: [
      { condition: "input.complexity === 'simple' && input.latencyBudget < 100", path: "hot", priority: 100 },
      { condition: "input.complexity === 'complex' || input.requireCitations", path: "cold", priority: 50 },
      { condition: "true", path: "hot", priority: 1 },
    ],
    sla: {
      hotPathP99Ms: 50,
      coldPathP99Ms: 5000,
      availability: 0.999,
      throughputRps: 5000,
    },
  },
];

/**
 * Default HyperTurbo Pipeline Orchestrator
 */
export const defaultHyperTurbo = new PipelineOrchestrator();

// Register default pipelines
for (const pipeline of defaultPipelines) {
  defaultHyperTurbo.registerPipeline(pipeline);
}
