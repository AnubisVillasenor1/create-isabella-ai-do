/**
 * ============================================================================
 * ISABELLA Ω • SOVEREIGN FABRIC
 * ============================================================================
 *
 * Canonical Composition Layer
 * Unified Entry Point for the Isabella Cognitive Civilization Runtime
 *
 * Version: Ω.14
 * Architecture: Heptafederated Sovereign Runtime
 * Runtime: Trinidad vLLM Fabric
 * Governance: GAME OVER • CROWN Ω
 * Evidence: BookPI Ω
 * Identity: ISA Identity
 * Security: ISA Safe
 *
 * ---------------------------------------------------------------------------
 * PURPOSE
 * ---------------------------------------------------------------------------
 * This file constitutes the canonical composition boundary of the Isabella
 * ecosystem.
 *
 * Every public capability exposed by the runtime MUST transit through this
 * composition layer in order to guarantee:
 *
 *   • Namespace consistency
 *   • Dependency visibility
 *   • Governance enforcement
 *   • Capability discoverability
 *   • Cross-federation interoperability
 *   • Version-safe evolution
 *   • Evidence traceability
 *
 * This file is therefore not a simple barrel export.
 * It is the constitutional gateway of the Isabella Runtime.
 * ============================================================================
 */

// ============================================================================
// Ω-1 • FOUNDATION FABRIC
// Identity • Core Runtime • Security • Evolution
// ============================================================================
export * from "./authority/method-id";
export * from "./core";
export * from "./identity";
export * from "./security";
export * from "./crown";
export * from "./ingress";
export * from "./federation";
export * from "./memory";
export * from "./evolution";
export * from "./genesis";
export * from "./bookpi";

// ============================================================================
// Ω-2 • COGNITIVE FABRIC
// Reasoning • Intelligence • Inference • Knowledge
// ============================================================================
export * from "./intelligence";
export * from "./inference";
export * from "./observability";
export * from "./tools";
export * from "./skills";

// ============================================================================
// Ω-3 • TRUST & VALIDATION FABRIC
// Verification • Quality Gates • Production Readiness
// ============================================================================
export * from "./veritas";
export * from "./evaluation";
export * from "./deployment";

// ============================================================================
// Ω-4 • HUMAN INTERACTION FABRIC
// Companion • Explainability • Consent • Emotional Safety
// ============================================================================
export * from "./companion/safety";
export * from "./companion/escalation";
export * from "./cognition/explainability";
export * from "./cognition/emotional-trace";
export * from "./cognition/consent";
export * from "./cognition/contradiction";

// ============================================================================
// Ω-5 • EXPERT REASONING FABRIC
// MoE • Sophia • Cognitive Orchestration
// ============================================================================
export * from "./cognition/experts";
export * from "./cognition/moe";
export * from "./cognition/orchestrator";
export * from "./cognition/sophia";

// ============================================================================
// Ω-6 • EXECUTION FABRIC
// Territory • XR • Capability Runtime
// ============================================================================
export * from "./territory/context";
export * from "./territory/tamv-integration";
export * from "./xr/safety";
export * from "./capabilities";
export * from "./modules";
export * from "./plugins";
export * from "./protocols";
export * from "./messaging";
export * from "./sanitization";

// ============================================================================
// Ω-7 • GOVERNANCE & ECONOMIC FABRIC
// Constitutional Control • Commerce • Tenancy
// ============================================================================
export * from "./governance";
export * from "./commerce";
export * from "./tenancy/isolation";

// ============================================================================
// Ω-8 • ADVANCED SYSTEMS FABRIC
// HyperCore • Quantum • Osiris • GameOver
// ============================================================================
export * from "./quantum";
export * from "./osiris";
export * from "./gameover";
export * from "./hypercore";
export * from "./isabella";

// ============================================================================
// Ω-9 • CANONICAL TYPE RESOLUTION LAYER
// Semantic Collision Governance
// ============================================================================

/**
 * Risk Taxonomy Resolution
 *
 * Multiple subsystems expose independent semantic interpretations
 * of operational risk.
 *
 * Explicit namespace separation is required to preserve meaning.
 */
export type { RiskLevel } from "./crown";
export type { RiskLevel as GameOverRiskLevel } from "./gameover";

/**
 * Capability Contract Resolution
 */
export type {
  CapabilityDescriptor,
  VerificationResult,
} from "./capabilities";

export type {
  CapabilityDescriptor as CrownCapabilityDescriptor,
  VerificationResult as CrownVerificationResult,
} from "./crown";

export type {
  CapabilityDescriptor as HyperCapabilityDescriptor,
  VerificationResult as HyperVerificationResult,
} from "./capabilities";

/**
 * Runtime Throttling Resolution
 */
export type { RateLimitDecision } from "./security/rate-limit";
export type { RateLimitDecision as FixedWindowPolicy } from "./security/rate-limit";
export type { RateLimitDecision as TokenBucketPolicy } from "./deployment/production-ops";

/**
 * Epistemic Confidence Resolution
 *
 * Separates business confidence from verified knowledge confidence.
 */
export type { CommerceConfidenceLevel as CommerceConfidence } from "./commerce";
export type { ConfidenceLevel as VerifiedKnowledgeConfidence } from "./memory/verified-knowledge";

/**
 * Decision Explanation Disambiguation
 */
export { explainDecision } from "./cognition/explainability";
export { explainDecision as explainGameOverDecision } from "./gameover";

// ============================================================================
// Ω-13 • SOVEREIGN NAMESPACES
// ============================================================================

/**
 * Terminus Constitutional Runtime
 */
export * as Terminus from "./terminus";

/**
 * Native Sovereign Machine Learning Runtime
 *
 * Provider-independent
 * Deterministic
 * Seed-reproducible
 * Pure TypeScript implementation
 */
export * as NativeML from "./lib/native-ml";
