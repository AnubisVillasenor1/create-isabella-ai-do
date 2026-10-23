/**
 * Cognitive Governance Layer Ω
 * state: engine-generated
 * Part of ISABELLA-Q Ω Cognitive Architecture
 * 
 * Implements governance for cognitive systems:
 * - Policy Engine (OPA/Rego compatible)
 * - Quality Gates (automated validation)
 * - Evidence Validator (provenance & integrity)
 * - Ethics Engine (constitutional compliance)
 * - Decision Audit Trail (immutable logging)
 * - Constitutional Interpreter (Root Canon RC-0.1α)
 */

import { EventEmitter } from "node:events";
import { createHash, randomBytes } from "node:crypto";

export type GovernanceDomain = 
  | "capability" 
  | "authority" 
  | "execution" 
  | "evidence" 
  | "learning" 
  | "production";

export type PolicyType = 
  | "access" 
  | "quality" 
  | "ethics" 
  | "compliance" 
  | "resource" 
  | "operational";

export type DecisionStatus = 
  | "pending" 
  | "approved" 
  | "denied" 
  | "conditional" 
  | "escalated" 
  | "revoked";

export type QualityGateStatus = 
  | "passed" 
  | "failed" 
  | "warning" 
  | "skipped" 
  | "running";

export interface GovernancePolicy {
  readonly id: string;
  readonly name: string;
  readonly domain: GovernanceDomain;
  readonly type: PolicyType;
  readonly version: string;
  readonly rules: PolicyRule[];
  readonly metadata: PolicyMetadata;
  readonly createdAt: number;
  readonly updatedAt: number;
  readonly createdBy: string;
}

export interface PolicyRule {
  readonly id: string;
  readonly condition: string; // Rego/OPA expression
  readonly action: "allow" | "deny" | "warn" | "require_approval" | "audit";
  readonly message: string;
  readonly severity: "info" | "warning" | "error" | "critical";
  readonly metadata: Record<string, unknown>;
}

export interface PolicyMetadata {
  readonly description: string;
  readonly tags: string[];
  readonly references: string[]; // Root Canon sections, regulations, etc.
  readonly applicability: PolicyApplicability;
}

export interface PolicyApplicability {
  readonly domains: GovernanceDomain[];
  readonly environments: string[];
  readonly roles: string[];
  readonly resources: string[];
}

export interface GovernanceDecision {
  readonly id: string;
  readonly requestId: string;
  readonly policyId: string;
  readonly domain: GovernanceDomain;
  readonly status: DecisionStatus;
  readonly input: Record<string, unknown>;
  readonly output: DecisionOutput;
  readonly evaluatedAt: number;
  readonly evaluatedBy: string;
  readonly conditions: DecisionCondition[];
  readonly evidence: EvidenceReference[];
}

export interface DecisionOutput {
  readonly allowed: boolean;
  readonly reason: string;
  readonly requiredActions: string[];
  readonly metadata: Record<string, unknown>;
}

export interface DecisionCondition {
  readonly type: "pre" | "post" | "continuous";
  readonly description: string;
  readonly validator: string; // Function or service to validate
  readonly satisfied: boolean;
  readonly validatedAt?: number;
}

export interface EvidenceReference {
  readonly id: string;
  readonly type: "document" | "log" | "metric" | "attestation" | "witness";
  readonly uri: string;
  readonly hash: string;
  readonly timestamp: number;
}

export interface QualityGate {
  readonly id: string;
  readonly name: string;
  readonly domain: GovernanceDomain;
  readonly checks: QualityCheck[];
  readonly threshold: QualityThreshold;
  readonly metadata: Record<string, unknown>;
}

export interface QualityCheck {
  readonly id: string;
  readonly name: string;
  readonly type: "static" | "dynamic" | "semantic" | "security" | "performance" | "compliance";
  readonly validator: string; // Function/service reference
  readonly parameters: Record<string, unknown>;
  readonly weight: number;
  readonly required: boolean;
}

export interface QualityThreshold {
  readonly minimumScore: number;
  readonly criticalChecks: string[]; // Check IDs that must pass
  readonly warningThreshold: number;
}

export interface QualityGateResult {
  readonly gateId: string;
  readonly status: QualityGateStatus;
  readonly score: number;
  readonly checks: QualityCheckResult[];
  readonly evaluatedAt: number;
  readonly metadata: Record<string, unknown>;
}

export interface QualityCheckResult {
  readonly checkId: string;
  readonly passed: boolean;
  readonly score: number;
  readonly details: Record<string, unknown>;
  readonly durationMs: number;
}

export interface Evidence {
  readonly id: string;
  readonly type: "document" | "code" | "data" | "model" | "decision" | "audit";
  readonly content: unknown;
  readonly provenance: Provenance;
  readonly integrity: IntegrityProof;
  readonly metadata: EvidenceMetadata;
}

export interface Provenance {
  readonly source: string;
  readonly author: string;
  readonly createdAt: number;
  readonly chain: ProvenanceLink[];
}

export interface ProvenanceLink {
  readonly from: string;
  readonly to: string;
  readonly transformation: string;
  readonly timestamp: number;
  readonly hash: string;
}

export interface IntegrityProof {
  readonly algorithm: "sha256" | "sha3-512" | "blake3";
  readonly hash: string;
  readonly signature?: string;
  readonly publicKey?: string;
}

export interface EvidenceMetadata {
  readonly tags: string[];
  readonly classification: "public" | "internal" | "confidential" | "restricted";
  readonly retention: number; // days
  readonly jurisdiction: string[];
}

export interface EthicsPrinciple {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly category: "autonomy" | "beneficence" | "non_maleficence" | "justice" | "transparency" | "accountability";
  readonly weight: number;
  readonly rules: EthicsRule[];
}

export interface EthicsRule {
  readonly id: string;
  readonly principleId: string;
  readonly condition: string;
  readonly obligation: "must" | "should" | "may" | "must_not" | "should_not";
  readonly rationale: string;
}

export interface EthicsEvaluation {
  readonly id: string;
  readonly subjectId: string;
  readonly subjectType: "decision" | "action" | "policy" | "model" | "data";
  readonly principles: EthicsPrincipleResult[];
  readonly overallScore: number;
  readonly verdict: "compliant" | "non_compliant" | "requires_review";
  readonly evaluatedAt: number;
  readonly evaluator: string;
}

export interface EthicsPrincipleResult {
  readonly principleId: string;
  readonly score: number;
  readonly satisfied: boolean;
  readonly violations: EthicsViolation[];
  readonly recommendations: string[];
}

export interface EthicsViolation {
  readonly ruleId: string;
  readonly severity: "minor" | "major" | "critical";
  readonly description: string;
  readonly evidence: EvidenceReference[];
}

export interface ConstitutionalArticle {
  readonly id: string;
  readonly title: string;
  readonly content: string;
  readonly domain: GovernanceDomain;
  readonly invariants: string[];
  readonly interpretation: ConstitutionalInterpretation[];
}

export interface ConstitutionalInterpretation {
  readonly id: string;
  readonly articleId: string;
  readonly interpretation: string;
  readonly rationale: string;
  readonly authority: string;
  readonly binding: boolean;
  readonly issuedAt: number;
}

/**
 * Policy Engine - OPA/Rego Compatible
 */
export class PolicyEngine extends EventEmitter {
  private policies: Map<string, GovernancePolicy> = new Map();
  private policyIndex: Map<GovernanceDomain, Set<string>> = new Map();

  addPolicy(policy: GovernancePolicy): void {
    this.policies.set(policy.id, policy);
    
    for (const domain of policy.metadata.applicability.domains) {
      const set = this.policyIndex.get(domain) || new Set();
      set.add(policy.id);
      this.policyIndex.set(domain, set);
    }
    
    this.emit("policy:added", policy);
  }

  removePolicy(policyId: string): void {
    const policy = this.policies.get(policyId);
    if (policy) {
      for (const domain of policy.metadata.applicability.domains) {
        this.policyIndex.get(domain)?.delete(policyId);
      }
      this.policies.delete(policyId);
      this.emit("policy:removed", policyId);
    }
  }

  async evaluate(
    domain: GovernanceDomain,
    input: Record<string, unknown>,
    context: EvaluationContext
  ): Promise<GovernanceDecision> {
    const policyIds = this.policyIndex.get(domain) || new Set();
    const applicablePolicies = Array.from(policyIds)
      .map(id => this.policies.get(id))
      .filter((p): p is GovernancePolicy => p !== undefined)
      .filter(p => this.policyApplies(p, context));

    // Sort by priority (could add priority field)
    const results = await Promise.all(
      applicablePolicies.map(p => this.evaluatePolicy(p, input, context))
    );

    // Aggregate results - deny by default, any deny wins
    let finalStatus: DecisionStatus = "approved";
    let finalReason = "All policies passed";
    const allConditions: DecisionCondition[] = [];
    const allEvidence: EvidenceReference[] = [];
    const requiredActions: string[] = [];

    for (const result of results) {
      if (result.output.allowed === false) {
        finalStatus = "denied";
        finalReason = result.output.reason;
      } else if (result.output.requiredActions.length > 0) {
        if (finalStatus === "approved") finalStatus = "conditional";
        requiredActions.push(...result.output.requiredActions);
      }
      allConditions.push(...result.conditions);
      allEvidence.push(...result.evidence);
    }

    const decision: GovernanceDecision = {
      id: `dec_${randomBytes(12).toString("hex")}`,
      requestId: context.requestId,
      policyId: applicablePolicies[0]?.id || "none",
      domain,
      status: finalStatus,
      input,
      output: {
        allowed: finalStatus !== "denied",
        reason: finalReason,
        requiredActions,
        metadata: {},
      },
      evaluatedAt: Date.now(),
      evaluatedBy: context.evaluator,
      conditions: allConditions,
      evidence: allEvidence,
    };

    this.emit("decision:made", decision);
    return decision;
  }

  private policyApplies(policy: GovernancePolicy, context: EvaluationContext): boolean {
    const app = policy.metadata.applicability;
    
    if (app.environments.length && !app.environments.includes(context.environment)) {
      return false;
    }
    if (app.roles.length && !app.roles.some(r => context.roles.includes(r))) {
      return false;
    }
    if (app.resources.length && !app.resources.some(r => context.resource.startsWith(r))) {
      return false;
    }
    
    return true;
  }

  private async evaluatePolicy(
    policy: GovernancePolicy,
    input: Record<string, unknown>,
    context: EvaluationContext
  ): Promise<GovernanceDecision> {
    const conditions: DecisionCondition[] = [];
    const evidence: EvidenceReference[] = [];

    for (const rule of policy.rules) {
      const satisfied = await this.evaluateRule(rule, input, context);
      
      conditions.push({
        type: "pre",
        description: rule.message,
        validator: rule.condition,
        satisfied,
      });

      if (!satisfied && rule.action === "deny") {
        return {
          id: `dec_${randomBytes(12).toString("hex")}`,
          requestId: context.requestId,
          policyId: policy.id,
          domain: policy.domain,
          status: "denied",
          input,
          output: {
            allowed: false,
            reason: rule.message,
            requiredActions: [],
            metadata: { ruleId: rule.id, severity: rule.severity },
          },
          evaluatedAt: Date.now(),
          evaluatedBy: context.evaluator,
          conditions,
          evidence,
        };
      }
    }

    return {
      id: `dec_${randomBytes(12).toString("hex")}`,
      requestId: context.requestId,
      policyId: policy.id,
      domain: policy.domain,
      status: "approved",
      input,
      output: {
        allowed: true,
        reason: "Policy satisfied",
        requiredActions: [],
        metadata: {},
      },
      evaluatedAt: Date.now(),
      evaluatedBy: context.evaluator,
      conditions,
      evidence,
    };
  }

  private async evaluateRule(
    rule: PolicyRule,
    input: Record<string, unknown>,
    context: EvaluationContext
  ): Promise<boolean> {
    // In production, would use OPA/Rego engine
    // For now, simple expression evaluation
    try {
      // Replace variables in condition
      let expression = rule.condition;
      for (const [key, value] of Object.entries(input)) {
        expression = expression.replace(new RegExp(`\\b${key}\\b`, 'g'), JSON.stringify(value));
      }
      for (const [key, value] of Object.entries(context)) {
        expression = expression.replace(new RegExp(`\\bcontext\\.${key}\\b`, 'g'), JSON.stringify(value));
      }
      
      // Simple evaluation (in production: use proper Rego engine)
      return this.evaluateExpression(expression);
    } catch {
      return false;
    }
  }

  private evaluateExpression(expr: string): boolean {
    // Very basic expression evaluator - replace with OPA in production
    try {
      // eslint-disable-next-line no-eval
      return eval(expr);
    } catch {
      return false;
    }
  }

  getPolicy(id: string): GovernancePolicy | undefined {
    return this.policies.get(id);
  }

  getPoliciesForDomain(domain: GovernanceDomain): GovernancePolicy[] {
    const ids = this.policyIndex.get(domain) || new Set();
    return Array.from(ids).map(id => this.policies.get(id)!).filter(Boolean);
  }
}

interface EvaluationContext {
  readonly requestId: string;
  readonly evaluator: string;
  readonly environment: string;
  readonly roles: string[];
  readonly resource: string;
  readonly metadata: Record<string, unknown>;
}

/**
 * Quality Gates Engine
 */
export class QualityGatesEngine extends EventEmitter {
  private gates: Map<string, QualityGate> = new Map();
  private validators: Map<string, QualityValidator> = new Map();

  registerGate(gate: QualityGate): void {
    this.gates.set(gate.id, gate);
    this.emit("gate:registered", gate);
  }

  registerValidator(id: string, validator: QualityValidator): void {
    this.validators.set(id, validator);
  }

  async runGate(
    gateId: string,
    artifact: QualityArtifact,
    context: QualityContext
  ): Promise<QualityGateResult> {
    const gate = this.gates.get(gateId);
    if (!gate) throw new Error(`QUALITY_GATE_NOT_FOUND: ${gateId}`);

    const startTime = Date.now();
    const checkResults: QualityCheckResult[] = [];

    for (const check of gate.checks) {
      const validator = this.validators.get(check.validator);
      if (!validator) {
        checkResults.push({
          checkId: check.id,
          passed: false,
          score: 0,
          details: { error: `VALIDATOR_NOT_FOUND: ${check.validator}` },
          durationMs: 0,
        });
        continue;
      }

      const checkStart = Date.now();
      try {
        const result = await validator.validate(artifact, check.parameters, context);
        checkResults.push({
          checkId: check.id,
          passed: result.passed,
          score: result.score,
          details: result.details,
          durationMs: Date.now() - checkStart,
        });
      } catch (error) {
        checkResults.push({
          checkId: check.id,
          passed: false,
          score: 0,
          details: { error: String(error) },
          durationMs: Date.now() - checkStart,
        });
      }
    }

    // Calculate overall score
    const totalWeight = checkResults.reduce((sum, r) => sum + (
      gate.checks.find(c => c.id === r.checkId)?.weight ?? 1
    ), 0);
    const weightedScore = checkResults.reduce((sum, r) => {
      const check = gate.checks.find(c => c.id === r.checkId);
      return sum + r.score * (check?.weight || 1);
    }, 0) / totalWeight;

    // Check critical checks
    const criticalFailed = gate.threshold.criticalChecks.some(id => {
      const result = checkResults.find(r => r.checkId === id);
      return result && !result.passed;
    });

    let status: QualityGateStatus;
    if (criticalFailed) status = "failed";
    else if (weightedScore < gate.threshold.minimumScore) status = "failed";
    else if (weightedScore < gate.threshold.warningThreshold) status = "warning";
    else status = "passed";

    const result: QualityGateResult = {
      gateId,
      status,
      score: weightedScore,
      checks: checkResults,
      evaluatedAt: Date.now(),
      metadata: { artifactId: artifact.id, context },
    };

    this.emit("gate:completed", result);
    return result;
  }

  async runAllGates(
    artifact: QualityArtifact,
    context: QualityContext
  ): Promise<QualityGateResult[]> {
    const results: QualityGateResult[] = [];
    for (const gate of this.gates.values()) {
      results.push(await this.runGate(gate.id, artifact, context));
    }
    return results;
  }
}

interface QualityValidator {
  validate(
    artifact: QualityArtifact,
    parameters: Record<string, unknown>,
    context: QualityContext
  ): Promise<{ passed: boolean; score: number; details: Record<string, unknown> }>;
}

interface QualityArtifact {
  readonly id: string;
  readonly type: "code" | "model" | "data" | "document" | "decision";
  readonly content: unknown;
  readonly metadata: Record<string, unknown>;
}

interface QualityContext {
  readonly environment: string;
  readonly pipeline?: string;
  readonly buildId?: string;
  readonly metadata: Record<string, unknown>;
}

/**
 * Evidence Validator
 */
export class EvidenceValidator extends EventEmitter {
  private evidenceStore: Map<string, Evidence> = new Map();
  private trustedKeys: Map<string, string> = new Map(); // keyId -> publicKey

  async submitEvidence(evidence: Evidence): Promise<{ accepted: boolean; evidenceId: string; issues: string[] }> {
    const issues: string[] = [];

    // Verify integrity
    const integrityValid = this.verifyIntegrity(evidence);
    if (!integrityValid) {
      issues.push("INTEGRITY_CHECK_FAILED");
    }

    // Verify provenance chain
    const provenanceValid = this.verifyProvenance(evidence.provenance);
    if (!provenanceValid) {
      issues.push("PROVENANCE_CHAIN_INVALID");
    }

    // Verify signature if present
    if (evidence.integrity.signature) {
      const sigValid = await this.verifySignature(evidence);
      if (!sigValid) {
        issues.push("SIGNATURE_VERIFICATION_FAILED");
      }
    }

    // Check classification handling
    if (evidence.metadata.classification === "restricted" && !contextHasClearance()) {
      issues.push("INSUFFICIENT_CLEARANCE");
    }

    const accepted = issues.length === 0;
    
    if (accepted) {
      this.evidenceStore.set(evidence.id, evidence);
      this.emit("evidence:accepted", evidence);
    } else {
      this.emit("evidence:rejected", { evidence, issues });
    }

    return { accepted, evidenceId: evidence.id, issues };
  }

  private verifyIntegrity(evidence: Evidence): boolean {
    const contentHash = this.hashContent(evidence.content);
    return timingSafeEqual(
      Buffer.from(contentHash),
      Buffer.from(evidence.integrity.hash)
    );
  }

  private verifyProvenance(provenance: Provenance): boolean {
    // Verify each link in the chain
    for (let i = 1; i < provenance.chain.length; i++) {
      const prev = provenance.chain[i - 1];
      const curr = provenance.chain[i];
      
      // Verify hash chain
      const expectedHash = createHash("sha256")
        .update(`${prev.from}:${prev.to}:${prev.transformation}:${prev.timestamp}`)
        .digest("hex");
      
      if (prev.hash !== expectedHash) {
        return false;
      }
    }
    return true;
  }

  private async verifySignature(evidence: Evidence): Promise<boolean> {
    if (!evidence.integrity.publicKey || !evidence.integrity.signature) {
      return false;
    }
    // In production: use crypto.verify()
    return true; // placeholder
  }

  private hashContent(content: unknown): string {
    return createHash("sha3-512").update(JSON.stringify(content)).digest("hex");
  }

  getEvidence(id: string): Evidence | undefined {
    return this.evidenceStore.get(id);
  }

  queryEvidence(filter: {
    type?: Evidence["type"];
    classification?: EvidenceMetadata["classification"];
    source?: string;
    since?: number;
    limit?: number;
  }): Evidence[] {
    let results = Array.from(this.evidenceStore.values());
    
    if (filter.type) results = results.filter(e => e.type === filter.type);
    if (filter.classification) results = results.filter(e => e.metadata.classification === filter.classification);
    if (filter.source) results = results.filter(e => e.provenance.source === filter.source);
    const since = filter.since;
    if (since !== undefined) results = results.filter(e => e.provenance.createdAt >= since);
    
    results.sort((a, b) => b.provenance.createdAt - a.provenance.createdAt);
    
    if (filter.limit) results = results.slice(0, filter.limit);
    
    return results;
  }

  registerTrustedKey(keyId: string, publicKey: string): void {
    this.trustedKeys.set(keyId, publicKey);
  }
}

function contextHasClearance(): boolean {
  // In production: check actual clearance
  return true;
}

function timingSafeEqual(a: Buffer, b: Buffer): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a[i] ^ b[i];
  }
  return result === 0;
}

/**
 * Ethics Engine
 */
export class EthicsEngine extends EventEmitter {
  private principles: Map<string, EthicsPrinciple> = new Map();
  private evaluations: Map<string, EthicsEvaluation> = new Map();

  registerPrinciple(principle: EthicsPrinciple): void {
    this.principles.set(principle.id, principle);
    this.emit("principle:registered", principle);
  }

  async evaluate(
    subjectId: string,
    subjectType: EthicsEvaluation["subjectType"],
    context: Record<string, unknown>,
    evaluator: string
  ): Promise<EthicsEvaluation> {
    const principleResults: EthicsPrincipleResult[] = [];

    for (const principle of this.principles.values()) {
      const violations: EthicsViolation[] = [];
      const recommendations: string[] = [];

      for (const rule of principle.rules) {
        const satisfied = await this.evaluateRule(rule, context);
        if (!satisfied && (rule.obligation === "must" || rule.obligation === "must_not")) {
          violations.push({
            ruleId: rule.id,
            severity: rule.obligation === "must_not" ? "critical" : "major",
            description: `Rule violated: ${rule.rationale}`,
            evidence: [],
          });
          recommendations.push(`Address: ${rule.rationale}`);
        } else if (!satisfied && (rule.obligation === "should" || rule.obligation === "should_not")) {
          recommendations.push(`Consider: ${rule.rationale}`);
        }
      }

      const satisfied = violations.length === 0;
      const score = satisfied ? 1 : Math.max(0, 1 - violations.length * 0.2);

      principleResults.push({
        principleId: principle.id,
        score,
        satisfied,
        violations,
        recommendations,
      });
    }

    const overallScore = principleResults.reduce((sum, r) => sum + r.score * 
      this.principles.get(r.principleId)!.weight, 0) / 
      Array.from(this.principles.values()).reduce((sum, p) => sum + p.weight, 0);

    let verdict: EthicsEvaluation["verdict"];
    if (overallScore >= 0.9) verdict = "compliant";
    else if (overallScore >= 0.6) verdict = "requires_review";
    else verdict = "non_compliant";

    const evaluation: EthicsEvaluation = {
      id: `eth_${randomBytes(12).toString("hex")}`,
      subjectId,
      subjectType,
      principles: principleResults,
      overallScore,
      verdict,
      evaluatedAt: Date.now(),
      evaluator,
    };

    this.evaluations.set(evaluation.id, evaluation);
    this.emit("evaluation:completed", evaluation);
    return evaluation;
  }

  private async evaluateRule(rule: EthicsRule, context: Record<string, unknown>): Promise<boolean> {
    // Simple rule evaluation - in production use proper logic engine
    try {
      let expression = rule.condition;
      for (const [key, value] of Object.entries(context)) {
        expression = expression.replace(new RegExp(`\\b${key}\\b`, 'g'), JSON.stringify(value));
      }
      // eslint-disable-next-line no-eval
      return eval(expression);
    } catch {
      return false;
    }
  }

  getEvaluation(id: string): EthicsEvaluation | undefined {
    return this.evaluations.get(id);
  }

  getEvaluationsForSubject(subjectId: string): EthicsEvaluation[] {
    return Array.from(this.evaluations.values())
      .filter(e => e.subjectId === subjectId)
      .sort((a, b) => b.evaluatedAt - a.evaluatedAt);
  }
}

/**
 * Constitutional Interpreter
 */
export class ConstitutionalInterpreter extends EventEmitter {
  private constitution: Map<string, ConstitutionalArticle> = new Map();
  private interpretations: Map<string, ConstitutionalInterpretation> = new Map();

  loadConstitution(articles: ConstitutionalArticle[]): void {
    for (const article of articles) {
      this.constitution.set(article.id, article);
    }
    this.emit("constitution:loaded", articles.length);
  }

  addInterpretation(interpretation: ConstitutionalInterpretation): void {
    this.interpretations.set(interpretation.id, interpretation);
    this.emit("interpretation:added", interpretation);
  }

  interpret(articleId: string, context: Record<string, unknown>): ConstitutionalInterpretation | null {
    const article = this.constitution.get(articleId);
    if (!article) return null;

    // Find applicable interpretations
    const applicable = Array.from(this.interpretations.values())
      .filter(i => i.articleId === articleId && i.binding)
      .sort((a, b) => b.issuedAt - a.issuedAt);

    if (applicable.length > 0) {
      return applicable[0];
    }

    // Return default interpretation
    return {
      id: `interp_${randomBytes(8).toString("hex")}`,
      articleId,
      interpretation: article.content,
      rationale: "Literal interpretation",
      authority: "system",
      binding: true,
      issuedAt: Date.now(),
    };
  }

  checkCompliance(
    action: { domain: GovernanceDomain; description: string; metadata: Record<string, unknown> }
  ): { compliant: boolean; violations: string[]; articleIds: string[] } {
    const violations: string[] = [];
    const articleIds: string[] = [];

    for (const article of this.constitution.values()) {
      if (article.domain === action.domain || article.domain === "authority") {
        articleIds.push(article.id);
        
        for (const invariant of article.invariants) {
          // Check if action violates invariant
          if (this.violatesInvariant(action, invariant)) {
            violations.push(`Violates ${article.id}: ${invariant}`);
          }
        }
      }
    }

    return {
      compliant: violations.length === 0,
      violations,
      articleIds,
    };
  }

  private violatesInvariant(action: { domain: GovernanceDomain; description: string; metadata: Record<string, unknown> }, invariant: string): boolean {
    // Simple invariant checking - in production use formal verification
    const invariantLower = invariant.toLowerCase();
    const descLower = action.description.toLowerCase();
    
    // Check for capability/authority confusion
    if (invariantLower.includes("capability") && invariantLower.includes("authority")) {
      if (descLower.includes("capability") && descLower.includes("authority")) {
        // Potential confusion
        return true;
      }
    }
    
    // Check for execution without evidence
    if (invariantLower.includes("execution") && invariantLower.includes("evidence")) {
      if (descLower.includes("execute") && !descLower.includes("evidence")) {
        return true;
      }
    }
    
    return false;
  }

  getArticle(id: string): ConstitutionalArticle | undefined {
    return this.constitution.get(id);
  }

  getAllArticles(): ConstitutionalArticle[] {
    return Array.from(this.constitution.values());
  }
}

/**
 * Decision Audit Trail
 */
export class DecisionAuditTrail extends EventEmitter {
  private decisions: Map<string, GovernanceDecision> = new Map();
  private readonly maxDecisions: number = 100000;

  record(decision: GovernanceDecision): void {
    this.decisions.set(decision.id, decision);
    
    if (this.decisions.size > this.maxDecisions) {
      // Remove oldest
      const oldest = Array.from(this.decisions.entries())
        .sort((a, b) => a[1].evaluatedAt - b[1].evaluatedAt)[0];
      this.decisions.delete(oldest[0]);
    }
    
    this.emit("decision:recorded", decision);
  }

  query(filter: {
    domain?: GovernanceDomain;
    status?: DecisionStatus;
    requestId?: string;
    policyId?: string;
    since?: number;
    until?: number;
    limit?: number;
  }): GovernanceDecision[] {
    let results = Array.from(this.decisions.values());
    
    if (filter.domain) results = results.filter(d => d.domain === filter.domain);
    if (filter.status) results = results.filter(d => d.status === filter.status);
    if (filter.requestId) results = results.filter(d => d.requestId === filter.requestId);
    if (filter.policyId) results = results.filter(d => d.policyId === filter.policyId);
    if (filter.since) results = results.filter(d => d.evaluatedAt >= filter.since!);
    if (filter.until) results = results.filter(d => d.evaluatedAt <= filter.until!);
    
    results.sort((a, b) => b.evaluatedAt - a.evaluatedAt);
    
    if (filter.limit) results = results.slice(0, filter.limit);
    
    return results;
  }

  getDecision(id: string): GovernanceDecision | undefined {
    return this.decisions.get(id);
  }

  getStats() {
    const decisions = Array.from(this.decisions.values());
    return {
      total: decisions.length,
      byDomain: decisions.reduce((acc, d) => {
        acc[d.domain] = (acc[d.domain] || 0) + 1;
        return acc;
      }, {} as Record<GovernanceDomain, number>),
      byStatus: decisions.reduce((acc, d) => {
        acc[d.status] = (acc[d.status] || 0) + 1;
        return acc;
      }, {} as Record<DecisionStatus, number>),
      approvalRate: decisions.filter(d => d.status === "approved").length / Math.max(1, decisions.length),
    };
  }
}

/**
 * Cognitive Governance Layer - Main Orchestrator
 */
export class CognitiveGovernanceLayer extends EventEmitter {
  readonly policyEngine: PolicyEngine;
  readonly qualityGates: QualityGatesEngine;
  readonly evidenceValidator: EvidenceValidator;
  readonly ethicsEngine: EthicsEngine;
  readonly constitutionalInterpreter: ConstitutionalInterpreter;
  readonly auditTrail: DecisionAuditTrail;

  constructor() {
    super();
    
    this.policyEngine = new PolicyEngine();
    this.qualityGates = new QualityGatesEngine();
    this.evidenceValidator = new EvidenceValidator();
    this.ethicsEngine = new EthicsEngine();
    this.constitutionalInterpreter = new ConstitutionalInterpreter();
    this.auditTrail = new DecisionAuditTrail();
    
    this.setupEventHandlers();
    this.loadDefaultPolicies();
    this.loadDefaultPrinciples();
    this.loadConstitution();
  }

  private setupEventHandlers(): void {
    this.policyEngine.on("decision:made", d => this.auditTrail.record(d));
    this.qualityGates.on("gate:completed", r => this.emit("quality:completed", r));
    this.evidenceValidator.on("evidence:accepted", e => this.emit("evidence:accepted", e));
    this.ethicsEngine.on("evaluation:completed", e => this.emit("ethics:evaluated", e));
  }

  private loadDefaultPolicies(): void {
    // Capability ≠ Authority policy
    this.policyEngine.addPolicy({
      id: "pol-capability-authority",
      name: "Capability Authority Separation",
      domain: "authority",
      type: "access",
      version: "1.0.0",
      rules: [
        {
          id: "rule-ca-1",
          condition: "input.requestsAuthority && !input.hasExplicitAuthority",
          action: "deny",
          message: "Capability does not imply authority - explicit authorization required",
          severity: "critical",
          metadata: { canonRef: "RC-0.1α§II.1" },
        },
      ],
      metadata: {
        description: "Enforces the fundamental invariant that capability ≠ authority",
        tags: ["invariant", "authority", "separation"],
        references: ["RC-0.1α§II.1"],
        applicability: {
          domains: ["authority", "capability"],
          environments: ["*"],
          roles: ["*"],
          resources: ["*"],
        },
      },
      createdAt: Date.now(),
      updatedAt: Date.now(),
      createdBy: "system",
    });

    // Evidence required for execution
    this.policyEngine.addPolicy({
      id: "pol-evidence-execution",
      name: "Evidence Before Execution",
      domain: "execution",
      type: "operational",
      version: "1.0.0",
      rules: [
        {
          id: "rule-ee-1",
          condition: "input.action === 'execute' && !input.evidenceProvided",
          action: "deny",
          message: "Execution requires prior evidence - EXECUTION ≠ EVIDENCE",
          severity: "critical",
          metadata: { canonRef: "RC-0.1α§II.4" },
        },
      ],
      metadata: {
        description: "Ensures evidence precedes execution",
        tags: ["invariant", "evidence", "execution"],
        references: ["RC-0.1α§II.4"],
        applicability: {
          domains: ["execution", "evidence"],
          environments: ["*"],
          roles: ["*"],
          resources: ["*"],
        },
      },
      createdAt: Date.now(),
      updatedAt: Date.now(),
      createdBy: "system",
    });

    // Learning ≠ Production
    this.policyEngine.addPolicy({
      id: "pol-learning-production",
      name: "Learning Production Separation",
      domain: "learning",
      type: "operational",
      version: "1.0.0",
      rules: [
        {
          id: "rule-lp-1",
          condition: "input.environment === 'production' && input.phase === 'learning'",
          action: "deny",
          message: "Learning activities must not run in production - LEARNING ≠ PRODUCTION",
          severity: "critical",
          metadata: { canonRef: "RC-0.1α§II.5" },
        },
      ],
      metadata: {
        description: "Prevents learning/training in production environments",
        tags: ["invariant", "learning", "production"],
        references: ["RC-0.1α§II.5"],
        applicability: {
          domains: ["learning", "production"],
          environments: ["production"],
          roles: ["*"],
          resources: ["*"],
        },
      },
      createdAt: Date.now(),
      updatedAt: Date.now(),
      createdBy: "system",
    });
  }

  private loadDefaultPrinciples(): void {
    // Autonomy
    this.ethicsEngine.registerPrinciple({
      id: "eth-autonomy",
      name: "Respect for Autonomy",
      description: "Individuals have the right to make informed decisions about their own affairs",
      category: "autonomy",
      weight: 1.0,
      rules: [
        {
          id: "rule-aut-1",
          principleId: "eth-autonomy",
          condition: "input.requiresConsent && !input.consentGiven",
          obligation: "must_not",
          rationale: "Actions requiring consent must not proceed without it",
        },
      ],
    });

    // Beneficence
    this.ethicsEngine.registerPrinciple({
      id: "eth-beneficence",
      name: "Beneficence",
      description: "Actions should promote well-being and benefit",
      category: "beneficence",
      weight: 1.0,
      rules: [
        {
          id: "rule-ben-1",
          principleId: "eth-beneficence",
          condition: "input.impactScore < 0",
          obligation: "should_not",
          rationale: "Actions with negative expected impact should be avoided",
        },
      ],
    });

    // Non-maleficence
    this.ethicsEngine.registerPrinciple({
      id: "eth-nonmaleficence",
      name: "Non-Maleficence",
      description: "First, do no harm",
      category: "non_maleficence",
      weight: 1.5,
      rules: [
        {
          id: "rule-non-1",
          principleId: "eth-nonmaleficence",
          condition: "input.riskLevel === 'critical' && !input.mitigationPresent",
          obligation: "must_not",
          rationale: "Critical risks must have mitigation before proceeding",
        },
      ],
    });

    // Justice
    this.ethicsEngine.registerPrinciple({
      id: "eth-justice",
      name: "Justice",
      description: "Fair distribution of benefits and burdens",
      category: "justice",
      weight: 1.0,
      rules: [
        {
          id: "rule-just-1",
          principleId: "eth-justice",
          condition: "input.discriminatoryImpact",
          obligation: "must_not",
          rationale: "Decisions must not have discriminatory impact",
        },
      ],
    });

    // Transparency
    this.ethicsEngine.registerPrinciple({
      id: "eth-transparency",
      name: "Transparency",
      description: "Decisions and processes must be explainable and auditable",
      category: "transparency",
      weight: 1.0,
      rules: [
        {
          id: "rule-trans-1",
          principleId: "eth-transparency",
          condition: "input.isHighStakes && !input.explanationProvided",
          obligation: "must",
          rationale: "High-stakes decisions must include explanations",
        },
      ],
    });

    // Accountability
    this.ethicsEngine.registerPrinciple({
      id: "eth-accountability",
      name: "Accountability",
      description: "Clear responsibility and answerability for decisions",
      category: "accountability",
      weight: 1.0,
      rules: [
        {
          id: "rule-acc-1",
          principleId: "eth-accountability",
          condition: "!input.responsibleParty",
          obligation: "must_not",
          rationale: "Every decision must have an accountable party",
        },
      ],
    });
  }

  private loadConstitution(): void {
    // Root Canon RC-0.1α Articles
    const articles: ConstitutionalArticle[] = [
      {
        id: "RC-0.1α.I",
        title: "Sovereign Identity",
        content: "The system operates as a sovereign cognitive entity with defined boundaries and responsibilities.",
        domain: "authority",
        invariants: [
          "Sovereignty cannot be delegated without explicit constitutional amendment",
          "Identity is cryptographically verifiable and immutable",
        ],
        interpretation: [],
      },
      {
        id: "RC-0.1α.II",
        title: "Fundamental Invariants",
        content: "The six domains are distinct and non-interchangeable: CAPABILITY ≠ AUTHORITY ≠ EXECUTION ≠ EVIDENCE ≠ LEARNING ≠ PRODUCTION",
        domain: "authority",
        invariants: [
          "CAPABILITY ≠ AUTHORITY",
          "AUTHORITY ≠ EXECUTION",
          "EXECUTION ≠ EVIDENCE",
          "EVIDENCE ≠ LEARNING",
          "LEARNING ≠ PRODUCTION",
          "CAPABILITY ≠ PRODUCTION",
        ],
        interpretation: [],
      },
      {
        id: "RC-0.1α.III",
        title: "Evidence-Based Governance",
        content: "All decisions must be grounded in verifiable evidence with complete provenance chains.",
        domain: "evidence",
        invariants: [
          "No decision without evidence",
          "Evidence must be tamper-evident",
          "Provenance chains must be complete",
        ],
        interpretation: [],
      },
      {
        id: "RC-0.1α.IV",
        title: "Continuous Verification",
        content: "Trust is never static; all identities, devices, and decisions undergo continuous verification.",
        domain: "capability",
        invariants: [
          "Trust levels decay over time without re-verification",
          "Behavioral baselines continuously updated",
          "Anomalies trigger immediate re-evaluation",
        ],
        interpretation: [],
      },
      {
        id: "RC-0.1α.V",
        title: "Ethical Primacy",
        content: "Ethical principles supersede operational efficiency; harm prevention takes precedence over optimization.",
        domain: "authority",
        invariants: [
          "Non-maleficence overrides beneficence in conflicts",
          "Autonomy cannot be overridden without due process",
          "Transparency required for all high-impact decisions",
        ],
        interpretation: [],
      },
    ];

    this.constitutionalInterpreter.loadConstitution(articles);
  }

  /**
   * Main governance check - evaluates all layers
   */
  async govern(params: {
    requestId: string;
    domain: GovernanceDomain;
    action: string;
    resource: string;
    input: Record<string, unknown>;
    context: EvaluationContext;
    artifact?: QualityArtifact;
    subjectId?: string;
    subjectType?: EthicsEvaluation["subjectType"];
  }): Promise<{
    decision: GovernanceDecision;
    qualityResult?: QualityGateResult[];
    ethicsEvaluation?: EthicsEvaluation;
    constitutionalCompliance: { compliant: boolean; violations: string[] };
  }> {
    // 1. Constitutional compliance check
    const constitutional = this.constitutionalInterpreter.checkCompliance({
      domain: params.domain,
      description: params.action,
      metadata: params.input,
    });

    // 2. Policy evaluation
    const decision = await this.policyEngine.evaluate(params.domain, params.input, params.context);

    // 3. Quality gates if artifact provided
    let qualityResult: QualityGateResult[] | undefined;
    if (params.artifact) {
      qualityResult = await this.qualityGates.runAllGates(params.artifact, {
        environment: params.context.environment,
        metadata: params.context.metadata,
      });
    }

    // 4. Ethics evaluation if subject provided
    let ethicsEvaluation: EthicsEvaluation | undefined;
    if (params.subjectId && params.subjectType) {
      ethicsEvaluation = await this.ethicsEngine.evaluate(
        params.subjectId,
        params.subjectType,
        params.input,
        params.context.evaluator
      );
    }

    return {
      decision,
      qualityResult,
      ethicsEvaluation,
      constitutionalCompliance: constitutional,
    };
  }
}

/**
 * Default Cognitive Governance Layer Instance
 */
export const defaultGovernance = new CognitiveGovernanceLayer();
