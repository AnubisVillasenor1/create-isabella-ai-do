/**
 * HyperRouter MoE - Dynamic Mixture of Experts Router
 * state: engine-generated
 * Part of ISABELLA-Q Ω Cognitive Architecture
 */

import { EventEmitter } from "node:events";

export type ExpertCapability = 
  | "research"
  | "scientific_evidence"
  | "code"
  | "security"
  | "legal"
  | "medicine"
  | "finance"
  | "strategy"
  | "architecture"
  | "education"
  | "monetization"
  | "governance"
  | "creative_writing"
  | "data_analysis"
  | "translation"
  | "summarization";

export type ExpertTier = "local" | "specialized" | "premium" | "sovereign";

export interface Expert {
  readonly name: string;
  readonly capabilities: ReadonlyArray<ExpertCapability>;
  readonly tier: ExpertTier;
  readonly modelId: string;
  readonly endpoint?: string;
  readonly maxTokens: number;
  readonly costPerToken: number;
  readonly latencyMs: number;
  readonly reliability: number; // 0-1
  readonly version: string;
  readonly metadata: Record<string, unknown>;
}

export interface RoutingContext {
  readonly prompt: string;
  readonly requiredCapabilities: ReadonlyArray<ExpertCapability>;
  readonly maxLatencyMs?: number;
  readonly maxCost?: number;
  readonly riskLevel: "low" | "medium" | "high" | "critical";
  readonly userTier: ExpertTier;
  readonly contextSize: number;
  readonly preferredExpert?: string;
  readonly excludeExperts?: ReadonlyArray<string>;
}

export interface RoutingDecision {
  readonly expert: Expert;
  readonly confidence: number;
  readonly reasoning: string;
  readonly alternatives: ReadonlyArray<{ expert: Expert; score: number }>;
  readonly estimatedLatencyMs: number;
  readonly estimatedCost: number;
}

export interface ExpertScore {
  readonly expert: Expert;
  readonly capabilityMatch: number;
  readonly latencyScore: number;
  readonly costScore: number;
  readonly reliabilityScore: number;
  readonly riskScore: number;
  readonly totalScore: number;
}

export interface MoEConfig {
  readonly maxExperts: number;
  readonly defaultTimeoutMs: number;
  readonly healthCheckIntervalMs: number;
  readonly minConfidenceThreshold: number;
  readonly enableFallback: boolean;
  readonly fallbackExpert: string;
  readonly loadBalancingStrategy: "round_robin" | "least_loaded" | "weighted" | "adaptive";
  readonly circuitBreakerThreshold: number;
  readonly circuitBreakerTimeoutMs: number;
}

const DEFAULT_CONFIG: MoEConfig = {
  maxExperts: 100,
  defaultTimeoutMs: 30000,
  healthCheckIntervalMs: 60000,
  minConfidenceThreshold: 0.6,
  enableFallback: true,
  fallbackExpert: "general",
  loadBalancingStrategy: "adaptive",
  circuitBreakerThreshold: 5,
  circuitBreakerTimeoutMs: 60000,
};

/**
 * Dynamic Expert Registry
 * Manages expert registration, health, and metadata
 */
export class ExpertRegistry extends EventEmitter {
  private experts: Map<string, Expert> = new Map();
  private healthStatus: Map<string, { healthy: boolean; lastCheck: number; failures: number }> = new Map();
  private loadMetrics: Map<string, { requests: number; totalLatency: number; errors: number }> = new Map();
  private config: MoEConfig;

  constructor(config: Partial<MoEConfig> = {}) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.startHealthChecks();
  }

  /**
   * Register a new expert
   */
  registerExpert(expert: Expert): void {
    if (this.experts.size >= this.config.maxExperts) {
      throw new Error("MAX_EXPERTS_REACHED");
    }
    if (this.experts.has(expert.name)) {
      throw new Error(`EXPERT_ALREADY_REGISTERED: ${expert.name}`);
    }
    this.experts.set(expert.name, expert);
    this.healthStatus.set(expert.name, { healthy: true, lastCheck: Date.now(), failures: 0 });
    this.loadMetrics.set(expert.name, { requests: 0, totalLatency: 0, errors: 0 });
    this.emit("expert:registered", expert);
  }

  /**
   * Unregister an expert
   */
  unregisterExpert(name: string): boolean {
    const result = this.experts.delete(name);
    this.healthStatus.delete(name);
    this.loadMetrics.delete(name);
    if (result) {
      this.emit("expert:unregistered", name);
    }
    return result;
  }

  /**
   * Get expert by name
   */
  getExpert(name: string): Expert | undefined {
    return this.experts.get(name);
  }

  /**
   * Get all registered experts
   */
  getAllExperts(): Expert[] {
    return Array.from(this.experts.values());
  }

  /**
   * Get experts by capability
   */
  getExpertsByCapability(capability: ExpertCapability): Expert[] {
    return Array.from(this.experts.values()).filter(e => e.capabilities.includes(capability));
  }

  /**
   * Get experts by tier
   */
  getExpertsByTier(tier: ExpertTier): Expert[] {
    return Array.from(this.experts.values()).filter(e => e.tier === tier);
  }

  /**
   * Update expert health status
   */
  updateHealth(name: string, healthy: boolean): void {
    const status = this.healthStatus.get(name);
    if (!status) return;
    
    status.healthy = healthy;
    status.lastCheck = Date.now();
    if (!healthy) {
      status.failures++;
      if (status.failures >= this.config.circuitBreakerThreshold) {
        this.emit("circuit:open", name);
      }
    } else {
      status.failures = 0;
    }
    this.emit("health:changed", { name, healthy });
  }

  /**
   * Record request metrics
   */
  recordRequest(name: string, latencyMs: number, error: boolean): void {
    const metrics = this.loadMetrics.get(name);
    if (!metrics) return;
    
    metrics.requests++;
    metrics.totalLatency += latencyMs;
    if (error) metrics.errors++;
    
    // Emit metrics for monitoring
    this.emit("metrics:updated", { name, metrics: { ...metrics } });
  }

  /**
   * Get expert load factor (0-1)
   */
  getLoadFactor(name: string): number {
    const metrics = this.loadMetrics.get(name);
    if (!metrics || metrics.requests === 0) return 0;
    
    const avgLatency = metrics.totalLatency / metrics.requests;
    const errorRate = metrics.errors / metrics.requests;
    
    // Normalize to 0-1 (lower is better)
    const latencyFactor = Math.min(avgLatency / 5000, 1); // 5s max
    const errorFactor = errorRate;
    
    return (latencyFactor + errorFactor) / 2;
  }

  /**
   * Check if expert is available
   */
  isAvailable(name: string): boolean {
    const status = this.healthStatus.get(name);
    return status?.healthy === true;
  }

  /**
   * Start periodic health checks
   */
  private startHealthChecks(): void {
    setInterval(() => {
      for (const [name, expert] of this.experts) {
        this.performHealthCheck(name, expert);
      }
    }, this.config.healthCheckIntervalMs);
  }

  /**
   * Perform health check on expert
   */
  private async performHealthCheck(name: string, expert: Expert): Promise<void> {
    const start = Date.now();
    try {
      // In production, would ping expert endpoint
      // For now, simulate health check
      await new Promise(resolve => setTimeout(resolve, 10));
      this.updateHealth(name, true);
      this.recordRequest(name, Date.now() - start, false);
    } catch {
      this.updateHealth(name, false);
      this.recordRequest(name, Date.now() - start, true);
    }
  }

  /**
   * Get registry statistics
   */
  getStats(): {
    totalExperts: number;
    healthyExperts: number;
    expertsByTier: Record<ExpertTier, number>;
    expertsByCapability: Record<ExpertCapability, number>;
  } {
    const experts = this.getAllExperts();
    const healthy = experts.filter(e => this.isAvailable(e.name));
    
    const byTier: Record<ExpertTier, number> = {
      local: 0,
      specialized: 0,
      premium: 0,
      sovereign: 0,
    };
    
    const byCapability: Record<ExpertCapability, number> = {} as any;
    
    for (const expert of experts) {
      byTier[expert.tier]++;
      for (const cap of expert.capabilities) {
        byCapability[cap] = (byCapability[cap] || 0) + 1;
      }
    }
    
    return {
      totalExperts: experts.length,
      healthyExperts: healthy.length,
      expertsByTier: byTier,
      expertsByCapability: byCapability,
    };
  }
}

/**
 * HyperRouter MoE - Intelligent Expert Router
 * Uses multi-factor scoring for optimal expert selection
 */
export class HyperRouterMoE extends EventEmitter {
  private registry: ExpertRegistry;
  private config: MoEConfig;
  private routingHistory: Array<{ context: RoutingContext; decision: RoutingDecision; timestamp: number }> = [];
  private maxHistorySize: number = 10000;

  constructor(registry: ExpertRegistry, config: Partial<MoEConfig> = {}) {
    super();
    this.registry = registry;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Route a request to the optimal expert
   */
  async route(context: RoutingContext): Promise<RoutingDecision> {
    const startTime = Date.now();
    
    // Filter eligible experts
    const candidates = this.filterCandidates(context);
    
    if (candidates.length === 0) {
      if (this.config.enableFallback) {
        const fallback = this.registry.getExpert(this.config.fallbackExpert);
        if (fallback) {
          return this.createDecision(fallback, context, 0.3, "No eligible experts, using fallback");
        }
      }
      throw new Error("NO_ELIGIBLE_EXPERTS");
    }

    // Score all candidates
    const scored = candidates.map(candidate => this.scoreExpert(candidate, context));
    
    // Sort by total score (descending)
    scored.sort((a, b) => b.totalScore - a.totalScore);
    
    const best = scored[0];
    if (!best) throw new Error("NO_SCORED_EXPERTS");
    const confidence = this.calculateConfidence(best, scored[1]);
    
    if (confidence < this.config.minConfidenceThreshold) {
      if (this.config.enableFallback) {
        const fallback = this.registry.getExpert(this.config.fallbackExpert);
        if (fallback) {
          return this.createDecision(fallback, context, 0.4, "Low confidence, using fallback");
        }
      }
    }
    
    const decision = this.createDecision(best.expert, context, confidence, this.generateReasoning(best, context));
    
    // Record routing decision
    this.recordDecision(context, decision);
    
    // Update load metrics
    this.registry.recordRequest(best.expert.name, Date.now() - startTime, false);
    
    return decision;
  }

  /**
   * Filter eligible experts based on context
   */
  private filterCandidates(context: RoutingContext): Expert[] {
    let candidates = this.registry.getAllExperts();
    
    // Filter by health
    candidates = candidates.filter(e => this.registry.isAvailable(e.name));
    
    // Filter by required capabilities
    if (context.requiredCapabilities.length > 0) {
      candidates = candidates.filter(e => 
        context.requiredCapabilities.every(cap => e.capabilities.includes(cap))
      );
    }
    
    // Filter by user tier access
    candidates = candidates.filter(e => this.canAccessTier(context.userTier, e.tier));
    
    // Filter by max latency
    const maxLatencyMs = context.maxLatencyMs;
    if (maxLatencyMs !== undefined) {
      candidates = candidates.filter(e => e.latencyMs <= maxLatencyMs);
    }
    
    // Filter by max cost
    const maxCost = context.maxCost;
    if (maxCost !== undefined) {
      candidates = candidates.filter(e => e.costPerToken <= maxCost);
    }
    
    // Exclude specific experts
    if (context.excludeExperts?.length) {
      candidates = candidates.filter(e => !context.excludeExperts!.includes(e.name));
    }
    
    // Prefer specific expert if requested
    if (context.preferredExpert) {
      const preferred = candidates.find(e => e.name === context.preferredExpert);
      if (preferred) return [preferred];
    }
    
    return candidates;
  }

  /**
   * Check if user tier can access expert tier
   */
  private canAccessTier(userTier: ExpertTier, expertTier: ExpertTier): boolean {
    const tierOrder: ExpertTier[] = ["local", "specialized", "premium", "sovereign"];
    const userIndex = tierOrder.indexOf(userTier);
    const expertIndex = tierOrder.indexOf(expertTier);
    return userIndex >= expertIndex;
  }

  /**
   * Score an expert for the given context
   */
  private scoreExpert(expert: Expert, context: RoutingContext): ExpertScore {
    const capabilityMatch = this.calculateCapabilityMatch(expert, context);
    const latencyScore = this.calculateLatencyScore(expert, context);
    const costScore = this.calculateCostScore(expert, context);
    const reliabilityScore = expert.reliability;
    const riskScore = this.calculateRiskScore(expert, context);
    const loadScore = 1 - this.registry.getLoadFactor(expert.name);
    
    // Weighted scoring
    const weights = {
      capabilityMatch: 0.35,
      latencyScore: 0.15,
      costScore: 0.15,
      reliabilityScore: 0.20,
      riskScore: 0.10,
      loadScore: 0.10,
    };
    
    const totalScore = 
      capabilityMatch * 0.35 +
      latencyScore * 0.15 +
      costScore * 0.15 +
      reliabilityScore * 0.20 +
      riskScore * 0.10 +
      loadScore * 0.10;
    
    return {
      expert,
      capabilityMatch,
      latencyScore,
      costScore,
      reliabilityScore,
      riskScore: riskScore,
      totalScore: Math.round(totalScore * 10000) / 10000,
    };
  }

  private calculateCapabilityMatch(expert: Expert, context: RoutingContext): number {
    if (context.requiredCapabilities.length === 0) return 1;
    
    const matched = context.requiredCapabilities.filter(cap => 
      expert.capabilities.includes(cap)
    ).length;
    
    return matched / context.requiredCapabilities.length;
  }

  private calculateLatencyScore(expert: Expert, context: RoutingContext): number {
    if (!context.maxLatencyMs) return 1;
    
    const ratio = expert.latencyMs / context.maxLatencyMs;
    if (ratio <= 0.5) return 1;
    if (ratio <= 0.8) return 0.8;
    if (ratio <= 1.0) return 0.5;
    return 0;
  }

  private calculateCostScore(expert: Expert, context: RoutingContext): number {
    if (!context.maxCost) return 1;
    
    const ratio = expert.costPerToken / context.maxCost;
    if (ratio <= 0.5) return 1;
    if (ratio <= 0.8) return 0.8;
    if (ratio <= 1.0) return 0.5;
    return 0;
  }

  private calculateRiskScore(expert: Expert, context: RoutingContext): number {
    // Lower tier experts have higher risk for high-risk tasks
    const tierRisk: Record<string, number> = {
      local: 0.3,
      specialized: 0.6,
      premium: 0.8,
      sovereign: 1.0,
    };
    
    const tierRiskScore = tierRisk[expert.tier] || 0.5;
    
    // Adjust for risk level
    const riskMultiplier: Record<string, number> = {
      low: 1.0,
      medium: 0.8,
      high: 0.5,
      critical: 0.2,
    };
    
    return tierRiskScore * (riskMultiplier[context.riskLevel] || 0.5);
  }

  private calculateConfidence(best: ExpertScore, secondBest?: ExpertScore): number {
    if (!secondBest) return 1.0;
    
    const diff = best.totalScore - secondBest.totalScore;
    // Sigmoid-like confidence
    return Math.min(1, 0.5 + diff * 2);
  }

  private generateReasoning(score: ExpertScore, context: RoutingContext): string {
    const reasons: string[] = [];
    
    if (score.capabilityMatch === 1) {
      reasons.push("Perfect capability match");
    } else if (score.capabilityMatch > 0.5) {
      reasons.push("Good capability match");
    }
    
    if (score.latencyScore === 1) reasons.push("Optimal latency");
    if (score.costScore === 1) reasons.push("Cost-effective");
    if (score.reliabilityScore > 0.9) reasons.push("Highly reliable");
    if (score.riskScore === 1) reasons.push("Low risk for task");
    
    return reasons.join("; ") || "Best overall match";
  }

  private createDecision(
    expert: Expert, 
    context: RoutingContext, 
    confidence: number,
    reasoning: string
  ): RoutingDecision {
    // Get alternatives
    const allScored = this.registry.getAllExperts()
      .filter(e => this.registry.isAvailable(e.name))
      .map(e => this.scoreExpert(e, context))
      .sort((a, b) => b.totalScore - a.totalScore);
    
    const alternatives = allScored
      .filter(s => s.expert.name !== context.preferredExpert)
      .slice(1, 4)
      .map(s => ({ expert: s.expert, score: s.totalScore }));
    
    return {
      expert,
      confidence: Math.round(confidence * 100) / 100,
      reasoning,
      alternatives,
      estimatedLatencyMs: expert.latencyMs,
      estimatedCost: expert.costPerToken,
    };
  }

  private recordDecision(context: RoutingContext, decision: RoutingDecision): void {
    this.routingHistory.push({
      context,
      decision,
      timestamp: Date.now(),
    });
    
    // Trim history
    if (this.routingHistory.length > this.maxHistorySize) {
      this.routingHistory = this.routingHistory.slice(-this.maxHistorySize);
    }
  }

  /**
   * Get routing analytics
   */
  getAnalytics(): {
    totalRoutes: number;
    avgConfidence: number;
    expertUsage: Record<string, number>;
    avgLatency: number;
    avgCost: number;
  } {
    if (this.routingHistory.length === 0) {
      return {
        totalRoutes: 0,
        avgConfidence: 0,
        expertUsage: {},
        avgLatency: 0,
        avgCost: 0,
      };
    }
    
    const expertUsage: Record<string, number> = {};
    let totalConfidence = 0;
    let totalLatency = 0;
    let totalCost = 0;
    
    for (const record of this.routingHistory) {
      const expertName = record.decision.expert.name;
      expertUsage[expertName] = (expertUsage[expertName] || 0) + 1;
      totalConfidence += record.decision.confidence;
      totalLatency += record.decision.estimatedLatencyMs;
      totalCost += record.decision.estimatedCost;
    }
    
    return {
      totalRoutes: this.routingHistory.length,
      avgConfidence: totalConfidence / this.routingHistory.length,
      expertUsage,
      avgLatency: totalLatency / this.routingHistory.length,
      avgCost: totalCost / this.routingHistory.length,
    };
  }

  /**
   * Get routing history
   */
  getHistory(limit?: number): Array<{ context: RoutingContext; decision: RoutingDecision; timestamp: number }> {
    return this.routingHistory.slice(-(limit || 100));
  }

  /**
   * Learn from feedback
   */
  recordFeedback(expertName: string, positive: boolean, details?: string): void {
    // In production, would update expert weights based on feedback
    this.emit("feedback", { expertName, positive, details, timestamp: Date.now() });
  }
}

// Export singleton registry instance
export const expertRegistry = new ExpertRegistry();
export const hyperRouter = new HyperRouterMoE(expertRegistry);

// Default expert configurations
export const DEFAULT_EXPERTS: Expert[] = [
  {
    name: "research",
    capabilities: ["research", "scientific_evidence", "data_analysis"],
    tier: "specialized",
    modelId: "isabella-research-v1",
    maxTokens: 8192,
    costPerToken: 0.0001,
    latencyMs: 2000,
    reliability: 0.95,
    version: "1.0.0",
    metadata: { description: "Research and evidence synthesis specialist" },
  },
  {
    name: "code",
    capabilities: ["code", "architecture", "security"],
    tier: "specialized",
    modelId: "isabella-code-v1",
    maxTokens: 8192,
    costPerToken: 0.0001,
    latencyMs: 1500,
    reliability: 0.97,
    version: "1.0.0",
    metadata: { description: "Code review and architecture specialist" },
  },
  {
    name: "strategy",
    capabilities: ["strategy", "finance", "monetization"],
    tier: "premium",
    modelId: "isabella-strategy-v1",
    maxTokens: 8192,
    costPerToken: 0.0002,
    latencyMs: 2500,
    reliability: 0.94,
    version: "1.0.0",
    metadata: { description: "Business strategy and finance specialist" },
  },
  {
    name: "legal",
    capabilities: ["legal", "governance", "security"],
    tier: "specialized",
    modelId: "isabella-legal-v1",
    maxTokens: 8192,
    costPerToken: 0.0002,
    latencyMs: 2000,
    reliability: 0.96,
    version: "1.0.0",
    metadata: { description: "Legal and compliance specialist" },
  },
  {
    name: "medicine",
    capabilities: ["medicine", "data_analysis", "research"],
    tier: "premium",
    modelId: "isabella-medicine-v1",
    maxTokens: 8192,
    costPerToken: 0.0003,
    latencyMs: 3000,
    reliability: 0.93,
    version: "1.0.0",
    metadata: { description: "Medical and health specialist" },
  },
  {
    name: "education",
    capabilities: ["education", "creative_writing", "translation"],
    tier: "specialized",
    modelId: "isabella-education-v1",
    maxTokens: 8192,
    costPerToken: 0.0001,
    latencyMs: 1500,
    reliability: 0.95,
    version: "1.0.0",
    metadata: { description: "Education and content creation specialist" },
  },
  {
    name: "finance",
    capabilities: ["finance", "data_analysis", "strategy"],
    tier: "premium",
    modelId: "isabella-finance-v1",
    maxTokens: 8192,
    costPerToken: 0.0002,
    latencyMs: 2000,
    reliability: 0.94,
    version: "1.0.0",
    metadata: { description: "Financial analysis specialist" },
  },
  {
    name: "security",
    capabilities: ["security", "code", "architecture"],
    tier: "specialized",
    modelId: "isabella-security-v1",
    maxTokens: 8192,
    costPerToken: 0.0001,
    latencyMs: 1500,
    reliability: 0.98,
    version: "1.0.0",
    metadata: { description: "Security audit and threat analysis specialist" },
  },
  {
    name: "general",
    capabilities: ["research", "code", "strategy", "education", "creative_writing", "summarization", "translation"],
    tier: "local",
    modelId: "isabella-general-v1",
    maxTokens: 4096,
    costPerToken: 0.00005,
    latencyMs: 1000,
    reliability: 0.9,
    version: "1.0.0",
    metadata: { description: "General purpose assistant" },
  },
];

// Register default experts
for (const expert of DEFAULT_EXPERTS) {
  try {
    expertRegistry.registerExpert(expert);
  } catch {
    // Already registered
  }
}
