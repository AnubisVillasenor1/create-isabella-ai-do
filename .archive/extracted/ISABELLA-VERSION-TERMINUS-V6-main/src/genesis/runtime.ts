import { evaluateCrown, type CrownEvaluationInput, type CrownVerdict } from "../crown";
import { inspectAegis, type AegisVerdict } from "../security/aegis";
import { planExecution, type AdaptivePlan, type AdaptiveRequest } from "../intelligence/adaptive-router";
import { planTurboRoute as buildTurboPlan, type TurboPlan, type TurboRequest } from "../intelligence/turbo-planner";
import { classifyFlow as classifyTrafficFlow, type TrafficLightInput, type TrafficLightVerdict } from "../governance/traffic-light";
import { InMemoryTelemetry, sloSnapshot, type TelemetrySink } from "../observability/telemetry";
import { IKESEngine, type IKESEnginePersistencePort } from "../memory/ikes";
import { ToolRegistry, type ToolAuthorization, type ToolReceipt } from "../tools/registry";
import { SkillRegistry } from "../skills/registry";
import { GovernedInferenceRouter } from "../inference/router";
import type { GenerationRequest, GenerationResult } from "../inference/types";
import { DeterministicVerifier } from "../veritas/verifier";
import { assessGrounding, type GroundingEvidence, type GroundingOptions, type GroundingReport } from "../veritas/grounding";
import { evaluateCompanionSafety, type CompanionSafetyVerdict } from "../companion/safety";
import { InMemoryHumanEscalationQueue, createEscalation, type HumanEscalationQueue } from "../companion/escalation";
import { explainPolicyDecision, type DecisionExplanation } from "../cognition/explainability";
import { createEmotionalTrace, type EmotionalTrace } from "../cognition/emotional-trace";
import { planExperts, type ExpertPlan, GENESIS_EXPERTS } from "../cognition/experts";
import { queryTerritory, type TerritoryQuery, type TerritoryAnswer } from "../territory/context";
import { evaluateXrSafety, type XrSafetyDecision, type XrSafetyEvent } from "../xr/safety";
import { InMemoryConsentRegistry, type ConsentRegistry } from "../cognition/consent";
import { planExperts as planCognitiveExperts } from "../cognition/experts";
import { synthesize, type CognitiveSynthesis, type CognitiveTask, type ExpertResult } from "../cognition/orchestrator";
import { createSource, validateClaim, type ProvenanceClaim, type ProvenanceSource } from "../memory/provenance";
import type { AtlasPersistencePort, CreateUserInput, RecordEconomyEntryInput, RecordProtocolExecutionInput } from "../atlas";
import { IsabellaEngine, type IsabellaEngineConfig, type IsabellaProfile } from "../isabella";
import { PennyLaneBridge, type PennyLaneBridgeConfig, type PennyLaneExecutionRequest, type PennyLaneExecutionResult } from "../quantum";
import { sanitizeDocument, type RawDocument, type SanitizedDocument } from "../sanitization";
import {
  createKnowledgeEntry,
  runIkesPipeline,
  toEpistemicStatus,
  type KnowledgeEntrySeed,
  type IkesPipelineResult,
} from "../memory/knowledge-entry";
import {
  LspValidationAdapter,
  EntityMutationManager,
  evaluateGitOperation,
  assessDeployment,
  verifyAgentSdkApp,
  evaluateQualityGates,
  planLifecycleRun,
  issueManagerToken,
  reconcileBeforeRelease,
  type GitOperationRequest,
  type GitGovernanceVerdict,
  type DeploymentAssessment,
  type DeploymentTarget,
  type VerifierInput,
  type VerifierReport,
  type QualityGateInput,
  type QualityGateReport,
  type LifecycleRunInput,
  type LifecycleRunPlan,
  type ManagerToken,
  type ReconciliationState,
  type ReconciliationReport,
  type SyncScope,
} from "../governance";
import type { KnowledgeClaim } from "../memory/ikes";
import { ProtocolRegistry, PROTOCOL_CATALOG } from "../protocols";
import { GenesisModuleRegistry } from "../modules";
import { CANONICAL_TOOLS, PROTOCOL_TOOLS } from "../tools";
import { CANONICAL_SKILLS, FOUNDATIONAL_SKILLS } from "../skills";
import { assessEpistemicState, passesEriGate, type SophiaSignals, type SophiaAssessment } from "../cognition/sophia";
import { detectContradictions as runContradictionDetection, type CanonicalClaim, type ContradictionOptions, type ContradictionReport } from "../cognition/contradiction";
import { federationById, listFederations, type TamvFederation } from "../federation";
import { MagpieBus, type MagpieDeliveryReport, type MagpieHandler, type MagpiePublishInput } from "../messaging";
import {
  mapOrderPermissions as buildPermissionMap,
  verifyAuthorizationEnvelope as runVerifyAuthorization,
  type OrderIntent,
  type PermissionCatalog,
  type AuthorizationEnvelope,
  type AuthorizationVerification,
} from "../governance/permission-map";
import { hardenSanitization, buildQuarantineRecord, type HardeningResult } from "../sanitization";
import { triangulateDigest, sealEnvelope, openEnvelope, evaluateVigia, type TriangulatedDigest, type SealedEnvelope, type VigiaVerdict } from "../security";
import {
  sealDocument as sealDocumentManifest,
  verifyDocumentSeal as verifyDocumentSealManifest,
  documentSealEnablement as documentSealEnablementReport,
  Ed25519Signer,
  type SealDocumentInput,
  type DocumentSealManifest,
  type VerifySealInput,
  type SealVerificationReport,
  type DocumentSealEnablement,
} from "../security";
import { buildOpsSnapshot, assessProductionReadiness, type DependencyHealth, type MaintenanceWindow, type OpsSnapshot, type ProductionReadinessReport } from "../deployment";
import { buildTapAct, validateTapAct, evaluateIsaPipeline, type TapActInput, type TapAct, type TapActValidation, type HighImpactTrigger } from "../ingress";
import {
  CapabilityGateway,
  CapabilityRegistry,
  ExecutionFabric,
  InMemoryMemoryFabric,
  KnowledgeFabric,
  buildDigitalTwin,
  consensus,
  parallelAnalyze,
  planStrategy,
  reasonArchitecture,
  selfEvaluate,
  verifyClaim,
} from "../capabilities";
import { createGiftBundle, type GiftBundle } from "../gifts";
import {
  CIVILIZATION_GIFT_COUNT,
  CIVILIZATION_LAYER_COUNT,
  civilizationSummary as buildCivilizationSummary,
  runCivilizationCycle as runCivilizationCycleCore,
  type CivilizationCycleInput,
  type CivilizationCycleResult,
} from "../civilization";
import { createEngine } from "../evolution/engine";
import {
  createHfHubClient,
  hfHubSummary as buildHfHubSummary,
  ingestHfDataset as ingestHfDatasetCore,
  queryHfHubCatalog,
  type HfCatalogInput,
  type HfCatalogResult,
  type HfIngestInput,
  type HfKnowledgeDocument,
} from "../hf-hub";
import {
  createIhec,
  ihecSummary as buildIhecSummary,
  runWithIhec,
  type IhecGiftPayload,
  type IhecRunResult,
} from "../ihec";
import {
  CUSTOMIZATION_CATALOG,
  CustomizationRegistry,
  buildMarketplaceCatalog,
  buildMarketplaceSnapshot,
  planMarketplaceEnablement,
  resolveMarketplacePack,
  type CustomizationEntry,
  type MarketplaceCatalog,
  type MarketplaceInventory,
  type MarketplacePack,
  type MarketplacePlan,
  type MarketplaceSnapshot,
} from "../customization";

export interface GenesisRuntimeInput extends CrownEvaluationInput, AdaptiveRequest {
  memoryQuery?: string;
}

export interface GenesisRuntimeDecision {
  crown: CrownVerdict;
  aegis: AegisVerdict;
  plan: AdaptivePlan;
  memory: ReturnType<IKESEngine["retrieve"]>;
  admitted: boolean;
}

export interface GenesisToolDecision {
  admitted: boolean;
  aegis: AegisVerdict;
  output?: unknown;
  receipt?: ToolReceipt;
}

export class IsabellaGenesisRuntime {
  readonly memory: IKESEngine;
  readonly tools = new ToolRegistry();
  readonly skills = new SkillRegistry();
  readonly telemetry: TelemetrySink;
  readonly inference = new GovernedInferenceRouter();
  readonly verifier = new DeterministicVerifier();
  readonly escalation: HumanEscalationQueue = new InMemoryHumanEscalationQueue();
  readonly consent: ConsentRegistry = new InMemoryConsentRegistry();
  readonly persistence?: AtlasPersistencePort;
  readonly isabella: IsabellaEngine;
  readonly quantum: PennyLaneBridge;
  readonly protocols = new ProtocolRegistry();
  readonly modules = new GenesisModuleRegistry();
  readonly capabilities = new CapabilityRegistry();
  readonly capabilityGateway = new CapabilityGateway(this.capabilities);
  readonly memoryFabric = new InMemoryMemoryFabric();
  readonly executionFabric = new ExecutionFabric();
  readonly knowledgeFabric = new KnowledgeFabric();
  /**
   * Catálogo nativo de customización (reglas, skills, plugins, hooks, servidores MCP)
   * derivado de Antigravity. Solo lectura: enumerar/clasificar no autoriza ni ejecuta.
   */
  readonly customizations = new CustomizationRegistry();
  /**
   * Cliente READ-ONLY del Hugging Face Hub. Usa la infraestructura de INFORMACIÓN y
   * DATOS del Hub (gratuita); nunca el router de inferencia (de pago). Leer no
   * admite conocimiento: el material ingerido sale PENDING_REVIEW.
   */
  readonly hfHub = createHfHubClient(process.env);
  /**
   * ISABELLA Ω v3.1 · IHEC — Hyper Emergency Core. Sistema inmunológico cognitivo:
   * 12 subsistemas de continuidad + 10 regalos de Perplexity. Registro en proceso;
   * NO autoriza ni ejecuta efectos externos.
   */
  readonly ihec = createIhec();
  readonly lsp = new LspValidationAdapter();
  readonly mutations = new EntityMutationManager();
  readonly events = new MagpieBus();
  /** Legado de los regalos: diez capacidades que Isabella debe desarrollar. */
  readonly gifts: GiftBundle = createGiftBundle();
  /** Cache del fabric de evolución (Ω-11) para la auditoría de controles del ciclo CCR-1. */
  private evolutionFabric?: { readonly controls: readonly import("../core/types").EvolutionControl[]; readonly mode: string };
  /** Llave Ed25519 del sello documental IGDS; perezosa (env PEM o efímera). */
  private documentSealSignerInstance?: Ed25519Signer;

  constructor(
    telemetry: TelemetrySink = new InMemoryTelemetry(),
    persistence?: AtlasPersistencePort,
    isabellaConfig?: IsabellaEngineConfig,
    quantumConfig?: PennyLaneBridgeConfig,
    memoryPersistence?: IKESEnginePersistencePort,
  ) {
    this.telemetry = telemetry;
    this.persistence = persistence;
    this.memory = new IKESEngine(memoryPersistence);
    this.isabella = new IsabellaEngine(isabellaConfig);
    this.quantum = new PennyLaneBridge(quantumConfig);
    this.registerCanonicalModules();
    this.registerCanonicalProtocols();
    this.registerHyperSkillFabric();
    this.registerGovernanceCapabilities();
    this.registerCanonicalCatalogs();
    this.registerGiftCapabilities();
    this.registerCivilizationCapabilities();
    this.registerHfHubCapabilities();
    this.registerIhecCapabilities();
    this.registerCustomizationCatalog();
    this.registerCustomizationCapabilities();
  }

  /** Registra los catálogos canónicos de tools, skills y protocolos. */
  private registerCanonicalCatalogs(): void {
    for (const tool of [...CANONICAL_TOOLS, ...PROTOCOL_TOOLS]) {
      if (this.tools.list().some((t) => t.id === tool.id)) continue;
      this.tools.register(tool);
    }
    for (const skill of [...CANONICAL_SKILLS, ...FOUNDATIONAL_SKILLS]) {
      if (this.skills.list().some((s) => s.id === skill.id)) continue;
      this.skills.register(skill);
    }
    for (const protocol of PROTOCOL_CATALOG) {
      if (this.protocols.list().some((p) => p.id === protocol.id)) continue;
      this.protocols.register(protocol);
    }
  }

  private registerCanonicalModules(): void {
    this.modules.register({
      id: "isabella.cognition",
      version: "1.0.0",
      domain: "cognition",
      capabilities: ["mediation", "entropy", "epistemic-analysis"],
    });
    this.modules.register({
      id: "isabella.litle",
      version: "1.0.0",
      domain: "trust",
      capabilities: ["attestation", "evidence-chain", "certificate"],
    });
    this.modules.register({
      id: "isabella.atlas",
      version: "1.0.0",
      domain: "infrastructure",
      capabilities: ["persistence", "xr", "webrtc-signaling"],
    });
    this.modules.register({
      id: "isabella.quantum.pennylane",
      version: "1.0.0",
      domain: "quantum",
      capabilities: ["circuit-execution", "quantum-simulation", "hybrid-workflows", "qiskit-interop"],
    });
    this.modules.register({
      id: "isabella.governance",
      version: "1.0.0",
      domain: "trust",
      capabilities: [
        "sanitization",
        "knowledge-entry",
        "evidence-manifest",
        "git-governance",
        "lsp-validation",
        "sync-manager",
        "deployment-gates",
        "verifier",
        "quality-gates",
        "file-schema",
        "lifecycle",
      ],
    });
  }

  /**
   * Registra los diez regalos del legado como capacidades HSF invocables vía
   * `POST /api/v1/hsf/invoke`. El manifiesto va encabezado por el cocreador.
   * Invariante: registrar una capacidad no concede autoridad ni ejecuta efectos.
   */
  private registerGiftCapabilities(): void {
    const low = (id: string, domain: import("../capabilities").CapabilityDomain, description: string) => ({
      id, version: "1.0.0", domain, description, riskTier: "LOW" as const, requiresAuthority: true,
    });
    for (const gift of this.gifts.manifest) {
      this.capabilities.register({
        descriptor: low(gift.capabilityId, gift.domain, `[Legado #${gift.order}] ${gift.title}: ${gift.summary}`),
        health: () => "ready",
        execute: async (input) => this.gifts.invoke(gift.capabilityId, input),
      });
    }
  }

  private registerCivilizationCapabilities(): void {
    const low = (id: string, domain: import("../capabilities").CapabilityDomain, description: string) => ({
      id, version: "1.0.0", domain, description, riskTier: "LOW" as const, requiresAuthority: true,
    });
    this.capabilities.register({
      descriptor: low(
        "hsf.civilization.runtime",
        "architecture",
        `ISABELLA Ω · CCR-1: ciclo gobernado de 9 pasos sobre ${CIVILIZATION_LAYER_COUNT} capas Ω y ${CIVILIZATION_GIFT_COUNT} regalos; clasifica, explica y evidencia, no autoriza ni ejecuta.`,
      ),
      health: () => "ready",
      execute: async (input) => {
        const value = input as { input?: CivilizationCycleInput } | CivilizationCycleInput;
        const cycleInput = (value as { input?: CivilizationCycleInput }).input ?? (value as CivilizationCycleInput);
        return this.runCivilizationCycle(cycleInput);
      },
    });
  }

  private registerHfHubCapabilities(): void {
    const low = (id: string, domain: import("../capabilities").CapabilityDomain, description: string) => ({
      id, version: "1.0.0", domain, description, riskTier: "LOW" as const, requiresAuthority: true,
    });
    this.capabilities.register({
      descriptor: low(
        "hsf.integration.hf-hub",
        "integration",
        "HUGGING FACE HUB: cataloga modelos/datasets y propone model cards como conocimiento; usa información/datos del Hub (gratis), nunca el router de inferencia (de pago). Leer no admite conocimiento.",
      ),
      health: () => (this.hfHub.configured ? "ready" : "degraded"),
      execute: async (input) => {
        const value = (input ?? {}) as {
          operation?: string; task?: string; search?: string; limit?: number; datasetId?: string; revision?: string;
        };
        if (value.operation === "ingest" && typeof value.datasetId === "string" && value.datasetId.trim()) {
          return this.ingestHfDataset({
            datasetId: value.datasetId.trim(),
            ...(typeof value.revision === "string" && value.revision.trim() ? { revision: value.revision.trim() } : {}),
          });
        }
        return this.queryHfHub({
          ...(typeof value.task === "string" && value.task.trim() ? { task: value.task.trim() } : {}),
          ...(typeof value.search === "string" && value.search.trim() ? { search: value.search.trim() } : {}),
          ...(typeof value.limit === "number" ? { limit: value.limit } : {}),
        });
      },
    });
  }

  /**
   * Registra IHEC v3.1 (Hyper Emergency Core) como capacidad invocable vía
   * `POST /api/v1/hsf/invoke`. Ejecuta el ciclo de civilización BAJO protección
   * de IHEC y aplica los 10 regalos de Perplexity. NO autoriza ni ejecuta.
   */
  private registerIhecCapabilities(): void {
    const low = (id: string, domain: import("../capabilities").CapabilityDomain, description: string) => ({
      id, version: "1.0.0", domain, description, riskTier: "LOW" as const, requiresAuthority: true,
    });
    this.capabilities.register({
      descriptor: low(
        "hsf.ihec.continuity",
        "architecture",
        "ISABELLA Ω v3.1 · IHEC: 12 subsistemas de continuidad + 10 regalos de Perplexity; detecta, aísla, se recupera, aprende y muta. No autoriza ni ejecuta.",
      ),
      health: () => "ready",
      execute: async (input) => {
        const value = (input ?? {}) as { input?: CivilizationCycleInput; payload?: IhecGiftPayload };
        const cycleInput = value.input ?? (value as unknown as CivilizationCycleInput);
        return this.runCivilizationCycleWithIhec(cycleInput, value.payload ?? {});
      },
    });
  }

  /** Registra el catálogo canónico de customización nativa (declarativo, inmutable). */
  private registerCustomizationCatalog(): void {
    for (const entry of CUSTOMIZATION_CATALOG) {
      if (this.customizations.has(entry.id)) continue;
      this.customizations.register(entry);
    }
  }

  /**
   * Registra el marketplace de customización como capacidad HSF invocable vía
   * `POST /api/v1/hsf/invoke`. Cataloga, resuelve packs y produce un plan.
   * Invariante: no autoriza, no instala y no ejecuta.
   */
  private registerCustomizationCapabilities(): void {
    const low = (id: string, domain: import("../capabilities").CapabilityDomain, description: string) => ({
      id, version: "1.0.0", domain, description, riskTier: "LOW" as const, requiresAuthority: true,
    });
    this.capabilities.register({
      descriptor: low(
        "hsf.integration.marketplace",
        "integration",
        "Customización nativa + Marketplace: cataloga reglas, skills, hooks, plugins y servidores MCP como descriptores de solo lectura; resuelve packs y produce un plan. No autoriza, no instala, no ejecuta.",
      ),
      health: () => "ready",
      execute: async (input) => {
        const value = (input ?? {}) as { operation?: string; id?: string };
        if (value.operation === "snapshot") return this.marketplaceSnapshot();
        if (value.operation === "detail" && typeof value.id === "string") {
          return this.customizationDetail(value.id) ?? null;
        }
        if (value.operation === "pack" && typeof value.id === "string") {
          return this.marketplacePack(value.id) ?? null;
        }
        if (value.operation === "plan" && typeof value.id === "string") {
          return this.marketplacePlan(value.id) ?? null;
        }
        return this.customizationCatalog();
      },
    });
  }

  /** Catálogo nativo de customización (solo lectura). */
  customizationCatalog(): MarketplaceCatalog {
    return buildMarketplaceCatalog(this.customizations);
  }

  /** Detalle de una entidad de customización por id, o `undefined`. */
  customizationDetail(id: string): CustomizationEntry | undefined {
    return this.customizations.get(id);
  }

  /** Inventario vivo de los registros que el marketplace agrega. */
  private marketplaceInventory(): MarketplaceInventory {
    return {
      customizations: this.customizations.list().length,
      skills: this.skills.list().length,
      tools: this.tools.list().length,
      protocols: this.protocols.list().length,
      modules: this.modules.list().length,
      capabilities: this.capabilities.list().length,
    };
  }

  /** Instantánea del marketplace: conteos + digest determinista (solo lectura). */
  marketplaceSnapshot(): MarketplaceSnapshot {
    return buildMarketplaceSnapshot(this.customizations, this.marketplaceInventory());
  }

  /** Resuelve un pack de plugin contra el catálogo nativo, o `undefined`. */
  marketplacePack(id: string): MarketplacePack | undefined {
    const entry = this.customizations.get(id);
    if (!entry || entry.kind !== "plugin") return undefined;
    return resolveMarketplacePack(entry, this.customizations);
  }

  /** Plan de habilitación de un pack; nunca habilita ni ejecuta. */
  marketplacePlan(id: string): MarketplacePlan | undefined {
    const pack = this.marketplacePack(id);
    return pack ? planMarketplaceEnablement(pack) : undefined;
  }

  private registerHyperSkillFabric(): void {
    const low = (id: string, domain: import("../capabilities").CapabilityDomain, description: string) => ({
      id, version: "1.0.0", domain, description, riskTier: "LOW" as const, requiresAuthority: true,
    });

    this.capabilities.register({
      descriptor: low("hsf.memory.fabric", "memory", "Persistent-memory contract over semantic, relational, temporal and provenance providers."),
      health: () => "ready",
      execute: async (input, _context) => {
        const value = input as { text?: string; namespace?: string; relations?: string[]; metadata?: Record<string,string> };
        if (!value.text?.trim()) throw new Error("HSF_MEMORY_TEXT_REQUIRED");
        return this.memoryFabric.write({ text: value.text, namespace: value.namespace ?? "genesis", relations: value.relations ?? [], metadata: value.metadata, });
      },
    });
    this.capabilities.register({
      descriptor: low("hsf.execution.fabric", "execution", "Governed task scheduling contract for asynchronous and long-lived work."),
      health: () => "ready",
      execute: async (input) => {
        const value = input as { type?: string; input?: unknown; scheduledAt?: string };
        if (!value.type?.trim()) throw new Error("HSF_TASK_TYPE_REQUIRED");
        return this.executionFabric.enqueue(value.type, value.input, value.scheduledAt);
      },
    });
    this.capabilities.register({
      descriptor: low("hsf.knowledge.fabric", "knowledge", "Versioned knowledge ingestion with deterministic content identity."),
      health: () => "ready",
      execute: async (input) => this.knowledgeFabric.ingest(input as { title: string; content: string; source: string }),
    });
    this.capabilities.register({
      descriptor: low("hsf.collective.consensus", "collective", "Independent expert result reconciliation with explicit dissent."),
      health: () => "ready",
      execute: async (input) => consensus((input as { results: Parameters<typeof consensus>[0] }).results),
    });
    this.capabilities.register({
      descriptor: low("hsf.truth.verification", "verification", "Evidence/contradiction scoring; never upgrades absent evidence into truth."),
      health: () => "ready",
      execute: async (input) => verifyClaim(input as Parameters<typeof verifyClaim>[0]),
    });
    this.capabilities.register({
      descriptor: low("hsf.architecture.reasoning", "architecture", "Structural analysis of components, dependencies and constraints."),
      health: () => "ready",
      execute: async (input) => reasonArchitecture(input as Parameters<typeof reasonArchitecture>[0]),
    });
    this.capabilities.register({
      descriptor: low("hsf.digital-twin", "digital-twin", "Deterministic project/system twin projection."),
      health: () => "ready",
      execute: async (input) => buildDigitalTwin(input as Parameters<typeof buildDigitalTwin>[0]),
    });
    this.capabilities.register({
      descriptor: low("hsf.strategic-intelligence", "strategy", "Scenario planning with explicit probabilities, costs and assumptions."),
      health: () => "ready",
      execute: async (input) => planStrategy(input as Parameters<typeof planStrategy>[0]),
    });
    this.capabilities.register({
      descriptor: low("hsf.self-evaluation", "verification", "Post-output criterion review without altering the source model."),
      health: () => "ready",
      execute: async (input) => {
        const value = input as { output: unknown; criteria: string[] };
        return selfEvaluate(value.output, value.criteria);
      },
    });
    this.capabilities.register({
      descriptor: low("hsf.massive-context.parallel", "collective", "Parallel decomposition/fusion primitive for bounded analysis workers."),
      health: () => "ready",
      execute: async (input) => {
        const value = input as { items: unknown[] };
        return parallelAnalyze(value.items, async (item, index) => ({ index, item }));
      },
    });
  }

  private registerGovernanceCapabilities(): void {
    const low = (id: string, domain: import("../capabilities").CapabilityDomain, description: string) => ({
      id, version: "1.0.0", domain, description, riskTier: "LOW" as const, requiresAuthority: true,
    });

    this.capabilities.register({
      descriptor: low("hsf.sanitization.pipeline", "knowledge", "Sanitización segura de documentos antes de deduplicación y admisión."),
      health: () => "ready",
      execute: async (input) => this.sanitize(input as RawDocument),
    });
    this.capabilities.register({
      descriptor: low("hsf.knowledge.admission", "knowledge", "Admite conocimiento gobernado (IKES) con sanitización, evidencia y policy gate."),
      health: () => "ready",
      execute: async (input) => this.admitKnowledge(input as Parameters<typeof this.admitKnowledge>[0]),
    });
    this.capabilities.register({
      descriptor: low("hsf.git.governance", "verification", "Evalúa operaciones Git destructivas/externas contra el policy gate."),
      health: () => "ready",
      execute: async (input) => this.evaluateGit(input as GitOperationRequest),
    });
    this.capabilities.register({
      descriptor: low("hsf.quality.gates", "verification", "Evalúa los 15 gates canónicos antes de promoción."),
      health: () => "ready",
      execute: async (input) => this.evaluateQuality(input as QualityGateInput),
    });
    this.capabilities.register({
      descriptor: low("hsf.deployment.gates", "integration", "Evalúa los gates de despliegue (build→rollback) y valores DNS reales."),
      health: () => "ready",
      execute: async (input) => {
        const value = input as { target: DeploymentTarget; gates: Parameters<typeof assessDeployment>[1]; opts?: Parameters<typeof assessDeployment>[2] };
        return this.assessDeployment(value.target, value.gates, value.opts);
      },
    });
    this.capabilities.register({
      descriptor: low("hsf.agent.verifier", "verification", "Verifica aplicaciones Python basadas en Agent SDK (alcance acotado)."),
      health: () => "ready",
      execute: async (input) => this.verifyAgentApp(input as VerifierInput),
    });
    this.capabilities.register({
      descriptor: low("hsf.lifecycle.plan", "execution", "Produce un plan de ciclo de vida de issues (inspect → propose)."),
      health: () => "ready",
      execute: async (input) => this.planLifecycle(input as LifecycleRunInput),
    });
    this.capabilities.register({
      descriptor: low("hsf.lsp.validation", "verification", "Valida técnicamente código con frescura de diagnósticos LSP."),
      health: () => "ready",
      execute: async (input) => {
        const value = input as { file: string; content: string; diagnostics?: Parameters<LspValidationAdapter["pushDiagnostics"]>[2]; timeoutMs?: number };
        this.lsp.openFile(value.file, value.content);
        const version = this.lsp.saveFile(value.file, value.content);
        if (value.diagnostics) this.lsp.pushDiagnostics(value.file, version, value.diagnostics);
        return this.lsp.waitForDiagnostics(value.file, version, value.timeoutMs ?? 50);
      },
    });
    this.capabilities.register({
      descriptor: low("hsf.sanitization.hardening", "knowledge", "Endurecimiento de sanitización: entropía, homóglifos y PII profunda (Luhn/IBAN)."),
      health: () => "ready",
      execute: async (input) => this.harden((input as { content?: string }).content ?? ""),
    });
    this.capabilities.register({
      descriptor: low("hsf.crypto.triangulated", "verification", "Sello criptográfico triangulado (SHA3-512 + SHA-256 + BLAKE2b-512) y AEAD AES-256-GCM."),
      health: () => "ready",
      execute: async (input) => {
        const value = input as { content?: string; hmacKey?: string };
        return this.triangulate(value.content ?? "", value.hmacKey);
      },
    });
    this.capabilities.register({
      descriptor: low("hsf.ops.readiness", "integration", "Readiness de producción fail-closed sobre dependencias requeridas."),
      health: () => "ready",
      execute: async (input) => this.readiness((input as { dependencies?: DependencyHealth[] }).dependencies ?? []),
    });
    this.capabilities.register({
      descriptor: low("hsf.isa.pipeline", "verification", "Evalúa el pipeline ISA-API v40 de 12 etapas (fail-closed)."),
      health: () => "ready",
      execute: async (input) => this.evaluateIsa(input as Parameters<typeof evaluateIsaPipeline>[0]),
    });
    this.capabilities.register({
      descriptor: low("hsf.vigia.integrity", "verification", "Triple bloqueo VIGIA: integridad ontológica, semántica y conductual (fail-closed)."),
      health: () => "ready",
      execute: async (input) => this.assessVigia((input as { content?: string }).content ?? ""),
    });
    this.capabilities.register({
      descriptor: low("hsf.truth.contradiction", "verification", "Contradiction Engine Ω: contradicciones estructurales entre claims canónicos."),
      health: () => "ready",
      execute: async (input) => {
        const value = input as { claims?: CanonicalClaim[]; functionalRelations?: string[] };
        return this.detectContradictions(value.claims ?? [], { functionalRelations: value.functionalRelations });
      },
    });
    this.capabilities.register({
      descriptor: low("hsf.federation.registry", "collective", "Registro canónico de las 7 federaciones TAMV (id ↔ código YUN)."),
      health: () => "ready",
      execute: async (input) => {
        const value = input as { id?: number };
        return value.id === undefined ? listFederations() : this.federation(value.id);
      },
    });
    this.capabilities.register({
      descriptor: low("hsf.messaging.bus", "integration", "MAGPIE-X: bus de eventos gobernado en proceso; transporta intención, no autoriza ejecución."),
      health: () => "ready",
      execute: async (input) => {
        const value = input as Partial<MagpiePublishInput>;
        if (!value.topic?.trim() || !value.type?.trim()) throw new Error("MAGPIE_PUBLISH_INPUT_REQUIRED");
        return this.publishEvent({
          topic: value.topic,
          type: value.type,
          payload: value.payload,
          correlationId: value.correlationId,
          causationId: value.causationId,
        });
      },
    });
    this.capabilities.register({
      descriptor: low("hsf.truth.grounding", "verification", "Evidence Grounding Guard Ω: anclaje léxico fail-closed de una respuesta a su evidencia (no verdad)."),
      health: () => "ready",
      execute: async (input) => {
        const value = input as { answer?: string; evidence?: GroundingEvidence[]; options?: GroundingOptions };
        return this.assessGrounding(value.answer ?? "", value.evidence ?? [], value.options);
      },
    });
    this.capabilities.register({
      descriptor: low("hsf.governance.permission-map", "architecture", "PERMISSION MAP Ω: expande una orden en sus permisos requeridos y los cataloga por nivel (NEUTRO→CRÍTICO); mapear no autoriza."),
      health: () => "ready",
      execute: async (input) => {
        const value = input as { order?: OrderIntent };
        if (!value.order) throw new Error("ORDER_REQUIRED");
        return this.mapOrderPermissions(value.order);
      },
    });
    this.capabilities.register({
      descriptor: low("hsf.governance.consent-envelope", "verification", "Verifica el sobre de autorización humana (fail-closed) y atribuye la responsabilidad al principal."),
      health: () => "ready",
      execute: async (input) => {
        const value = input as { envelope?: AuthorizationEnvelope; catalog?: PermissionCatalog };
        if (!value.envelope || !value.catalog) throw new Error("AUTHORIZATION_INPUT_REQUIRED");
        return this.verifyOrderAuthorization(value.envelope, value.catalog);
      },
    });
    this.capabilities.register({
      descriptor: low("hsf.intelligence.turbo-planner", "strategy", "TURBO ROUTE PLANNER Ω: decide la ruta (FAST/GROUNDED/AGENT/HUMAN_REVIEW) y qué filtros gobernados son obligatorios u omitibles; planificar no autoriza."),
      health: () => "ready",
      execute: async (input) => {
        const value = input as { request?: TurboRequest };
        if (!value.request) throw new Error("TURBO_REQUEST_REQUIRED");
        return this.planTurboRoute(value.request);
      },
    });
    this.capabilities.register({
      descriptor: low("hsf.governance.traffic-light", "strategy", "SEMÁFORO DE FLUJO GOBERNADO Ω: clasifica la solicitud (verde/amarillo/naranja/rojo) y decide cuántos filtros gobernados corren; clasificar no autoriza ni ejecuta."),
      health: () => "ready",
      execute: async (input) => {
        const value = input as { input?: TrafficLightInput };
        if (!value.input) throw new Error("TRAFFIC_INPUT_REQUIRED");
        return this.classifyFlow(value.input);
      },
    });
    this.capabilities.register({
      descriptor: low("hsf.security.document-seal", "verification", "IGDS-v1: sella un documento (integridad SHA-256 + firma Ed25519) y devuelve su manifiesto; sellar no autoriza ni publica."),
      health: () => "ready",
      execute: async (input) => {
        const value = input as {
          document?: SealDocumentInput["document"];
          contentBase64?: string;
          createdAt?: string;
          prevSealId?: string | null;
          generateWatermark?: boolean;
        };
        if (!value.document || typeof value.contentBase64 !== "string") throw new Error("DOCUMENT_SEAL_INPUT_REQUIRED");
        return this.sealDocument({
          document: value.document,
          bytes: Buffer.from(value.contentBase64, "base64"),
          ...(value.createdAt ? { createdAt: value.createdAt } : {}),
          ...(value.prevSealId !== undefined ? { prevSealId: value.prevSealId } : {}),
          ...(value.generateWatermark !== undefined ? { generateWatermark: value.generateWatermark } : {}),
        });
      },
    });
    this.capabilities.register({
      descriptor: low("hsf.security.document-seal.verify", "verification", "IGDS-v1: verifica integridad + firma Ed25519 de un manifiesto de sello documental (fail-closed)."),
      health: () => "ready",
      execute: async (input) => {
        const value = input as { manifest?: DocumentSealManifest; contentBase64?: string; publicKeyPem?: string };
        if (!value.manifest || typeof value.contentBase64 !== "string" || typeof value.publicKeyPem !== "string") {
          throw new Error("DOCUMENT_SEAL_VERIFY_INPUT_REQUIRED");
        }
        return this.verifyDocumentSeal({
          manifest: value.manifest,
          bytes: Buffer.from(value.contentBase64, "base64"),
          publicKeyPem: value.publicKeyPem,
        });
      },
    });
  }

  private registerCanonicalProtocols(): void {
    this.protocols.register({
      id: "isabella.quantum.pennylane.execute",
      version: "1.0.0",
      description: "Ejecuta un circuito cuántico mediante el puente gobernado Isabella → PennyLane.",
      execute: async (context) => this.executePennyLane(context.input as PennyLaneExecutionRequest),
    });
  }

  async executePennyLane(request: PennyLaneExecutionRequest): Promise<PennyLaneExecutionResult> {
    const started = Date.now();
    const result = await this.quantum.execute(request);
    this.telemetry.metric({
      name: "request_latency_ms",
      value: Date.now() - started,
      at: new Date().toISOString(),
      attributes: {
        stage: "quantum-pennylane",
        backend: result.backend,
        status: result.status,
      },
    });
    return result;
  }

  async quantumHealth() {
    return this.quantum.health();
  }


  async initPersistence(): Promise<void> {
    const initializers: Promise<unknown>[] = [this.memory.initPersistence()];
    if (this.persistence && "init" in this.persistence && typeof this.persistence.init === "function") {
      initializers.push(this.persistence.init());
    }
    const results = await Promise.allSettled(initializers);
    const failures = results.filter((result): result is PromiseRejectedResult => result.status === "rejected");
    if (failures.length > 0) {
      throw new AggregateError(failures.map((failure) => failure.reason), "GENESIS_PERSISTENCE_INITIALIZATION_FAILED");
    }
  }

  async persistUser(input: CreateUserInput) {
    if (!this.persistence) throw new Error("Genesis persistence is not configured");
    return this.persistence.createUser(input);
  }

  async persistProtocolExecution(input: RecordProtocolExecutionInput) {
    if (!this.persistence) throw new Error("Genesis persistence is not configured");
    return this.persistence.recordProtocolExecution(input);
  }

  async persistEconomyEntry(input: RecordEconomyEntryInput) {
    if (!this.persistence) throw new Error("Genesis persistence is not configured");
    return this.persistence.recordEconomyEntry(input);
  }

  async publishAtlasXrEvent(eventType: string, payload: unknown) {
    if (!this.persistence) throw new Error("Genesis persistence is not configured");
    return this.persistence.publishXrEvent(eventType, payload);
  }

  async createAtlasSignal(input: Parameters<AtlasPersistencePort["createSignal"]>[0]) {
    if (!this.persistence) throw new Error("Genesis persistence is not configured");
    return this.persistence.createSignal(input);
  }

  mediateIsabella(input: { input: string; profile?: IsabellaProfile }) {
    const started = Date.now();
    try {
      const result = this.isabella.chat(input);
      this.telemetry.metric({
        name: "request_latency_ms",
        value: Date.now() - started,
        at: new Date().toISOString(),
        attributes: { stage: "isabella-mediation", profile: input.profile ?? "general" },
      });
      return result;
    } catch (error) {
      this.telemetry.metric({
        name: "request_latency_ms",
        value: Date.now() - started,
        at: new Date().toISOString(),
        attributes: { stage: "isabella-mediation", status: "error" },
      });
      throw error;
    }
  }

  isabellaLatencySnapshot() {
    if (!(this.telemetry instanceof InMemoryTelemetry)) {
      return { samples: 0, p50Ms: 0, p95Ms: 0, p99Ms: 0, errorRate: 0, source: "custom-sink" as const };
    }
    const samples = this.telemetry.metrics
      .filter((point) => point.name === "request_latency_ms" && point.attributes.stage === "isabella-mediation")
      .map((point) => point.value);
    const errors = this.telemetry.metrics.filter(
      (point) => point.name === "request_latency_ms"
        && point.attributes.stage === "isabella-mediation"
        && point.attributes.status === "error",
    ).length;
    return { ...sloSnapshot(samples, errors), source: "in-memory" as const };
  }

  evaluateIsabellaEntropy(probabilities: number[]) {
    const started = Date.now();
    const result = this.isabella.evaluarEntropia(probabilities);
    this.telemetry.metric({
      name: "request_latency_ms",
      value: Date.now() - started,
      at: new Date().toISOString(),
      attributes: { stage: "isabella-entropy" },
    });
    return result;
  }

  /** Optional memory degradation must not disable local conversation; explicit memory APIs still return 503. */
  private retrieveMemorySafely(query: string): ReturnType<IKESEngine["retrieve"]> {
    try {
      return this.memory.retrieve(query);
    } catch (error) {
      if (error instanceof Error && error.message === "IKES_PERSISTENCE_NOT_INITIALIZED") return [];
      throw error;
    }
  }

  evaluate(input: GenesisRuntimeInput): GenesisRuntimeDecision {
    const started = Date.now();
    const aegis = inspectAegis(input.input);
    const crown = evaluateCrown(input);
    const plan = planExecution(input);
    const memory = input.memoryQuery && aegis.decision !== "BLOCK"
      ? this.retrieveMemorySafely(input.memoryQuery)
      : [];
    const admitted = aegis.decision !== "BLOCK" && crown.verification.allPassed && crown.responseMode !== "refuse";

    this.telemetry.metric({
      name: "request_total",
      value: 1,
      at: new Date().toISOString(),
      attributes: { admitted, risk: input.riskTier, complexity: plan.complexity },
    });
    this.telemetry.metric({
      name: "request_latency_ms",
      value: Date.now() - started,
      at: new Date().toISOString(),
      attributes: { stage: "governed-evaluation" },
    });

    this.events.publish({
      topic: "runtime.evaluated",
      type: admitted ? "admitted" : "refused",
      payload: { admitted, risk: input.riskTier, complexity: plan.complexity, aegis: aegis.decision },
    });

    return { crown, aegis, plan, memory, admitted };
  }

  synthesizeCognition(task: CognitiveTask, expertIds: readonly (typeof GENESIS_EXPERTS[number])[], results: readonly ExpertResult[]): CognitiveSynthesis {
    return synthesize(task, planCognitiveExperts(expertIds), results);
  }

  registerConsent(grant: Parameters<ConsentRegistry["grant"]>[0]): void { this.consent.grant(grant); }
  revokeConsent(consentId: string): void { this.consent.revoke(consentId); }
  hasConsent(principalId: string, purpose: Parameters<ConsentRegistry["has"]>[1], scope?: string): boolean { return this.consent.has(principalId,purpose,scope); }

  assessCompanionSafety(input: string): CompanionSafetyVerdict {
    return evaluateCompanionSafety(input);
  }

  /** VIGIA triple bloqueo: integridad ontológica, semántica y conductual. */
  assessVigia(input: string): VigiaVerdict {
    return evaluateVigia(input);
  }

  explainPolicy(decision: "ALLOW"|"DENY"|"REVIEW", factors: readonly string[], evidenceRefs: readonly string[], policyVersion: string): DecisionExplanation {
    return explainPolicyDecision(decision, factors, evidenceRefs, policyVersion);
  }

  createContextTrace(traceId: string, signals: Parameters<typeof createEmotionalTrace>[1], purpose: Parameters<typeof createEmotionalTrace>[2]): EmotionalTrace {
    return createEmotionalTrace(traceId, signals, purpose);
  }

  planExpertModules(ids: readonly (typeof GENESIS_EXPERTS[number])[]): ExpertPlan {
    return planExperts(ids);
  }

  routeTerritory(query: TerritoryQuery, resolver: (query: TerritoryQuery) => TerritoryAnswer): TerritoryAnswer {
    return queryTerritory(query, resolver);
  }

  evaluateXrSafety(event: XrSafetyEvent): XrSafetyDecision {
    return evaluateXrSafety(event);
  }

  createProvenanceSource(input: Parameters<typeof createSource>[0]): ProvenanceSource { return createSource(input); }
  validateProvenanceClaim(claim: ProvenanceClaim, sources: readonly ProvenanceSource[]): boolean { return validateClaim(claim,sources); }

  escalate(request: Parameters<typeof createEscalation>[0]): void {
    this.escalation.enqueue(createEscalation(request));
  }

  async generate(request: GenerationRequest): Promise<GenerationResult> {
    const started = Date.now();
    const result = await this.inference.generate(request);
    this.telemetry.metric({
      name: "request_latency_ms",
      value: Date.now() - started,
      at: new Date().toISOString(),
      attributes: { stage: "inference", modelId: result.modelId },
    });
    if (result.outputTokens > 0) {
      this.telemetry.metric({
        name: "tokens_per_second",
        value: result.outputTokens / Math.max(0.001, result.latencyMs / 1000),
        at: new Date().toISOString(),
        attributes: { modelId: result.modelId },
      });
    }
    return result;
  }

  async executeTool(
    id: string,
    input: unknown,
    principal: GenesisRuntimeInput["principal"],
    scope: string,
    authorization: ToolAuthorization = {},
  ): Promise<GenesisToolDecision> {
    const started = Date.now();
    const aegis = inspectAegis(JSON.stringify(input) ?? "");
    if (aegis.decision === "BLOCK") {
      this.telemetry.metric({
        name: "security_block",
        value: 1,
        at: new Date().toISOString(),
        attributes: { stage: "tool-input", toolId: id },
      });
      this.events.publish({ topic: "tool.blocked", type: "security", payload: { toolId: id, decision: aegis.decision } });
      return { admitted: false, aegis };
    }

    try {
      const result = await this.tools.execute(id, input, principal, scope, authorization);
      this.telemetry.metric({
        name: "tool_execution",
        value: 1,
        at: new Date().toISOString(),
        attributes: { toolId: id, status: result.receipt.status },
      });
      this.telemetry.metric({
        name: "request_latency_ms",
        value: Date.now() - started,
        at: new Date().toISOString(),
        attributes: { stage: "tool-execution" },
      });
      this.events.publish({ topic: "tool.executed", type: result.receipt.status, payload: { toolId: id } });
      return { admitted: true, aegis, output: result.output, receipt: result.receipt };
    } catch (error) {
      const receipt = (error as { receipt?: ToolReceipt }).receipt;
      this.telemetry.metric({
        name: "tool_execution",
        value: 1,
        at: new Date().toISOString(),
        attributes: { toolId: id, status: receipt?.status ?? "error" },
      });
      this.events.publish({ topic: "tool.failed", type: "error", payload: { toolId: id } });
      return { admitted: false, aegis, receipt };
    }
  }

  /* ------------------------------------------------------------------ */
  /* Gobernanza de conocimiento (IKES, sanitización, evidencia)          */
  /* ------------------------------------------------------------------ */

  /** Sanitiza un documento antes de indexarlo. Determinista y sin efectos externos. */
  sanitize(raw: RawDocument): SanitizedDocument {
    const result = sanitizeDocument(raw);
    this.telemetry.metric({
      name: "request_total",
      value: 1,
      at: new Date().toISOString(),
      attributes: { stage: "sanitization", status: result.status },
    });
    return result;
  }

  /**
   * Acepta un documento sanitizado como conocimiento gobernado: sanitización →
   * identidad → claims → evidencia → policy gate → índice. Fail-closed si el
   * material fue cuarentenado o no tiene evidencia.
   */
  admitKnowledge(input: {
    raw: RawDocument;
    entityId: string;
    provenanceId: string;
    claims?: readonly KnowledgeClaim[];
    policyGateGranted: boolean;
  }): { sanitized: SanitizedDocument; entry: IkesPipelineResult } {
    const sanitized = this.sanitize(input.raw);
    const claimIds = (input.claims ?? []).map((c) => c.claimId);
    const seed: KnowledgeEntrySeed = {
      entityId: input.entityId,
      provenanceId: input.provenanceId,
      claimIds,
      sourceIds: [...new Set((input.claims ?? []).flatMap((c) => [...c.sourceIds]))],
      evidenceIds: [...new Set((input.claims ?? []).flatMap((c) => [...c.evidenceIds]))],
      temporalStatus: "current",
      epistemicStatus: toEpistemicStatus(input.claims?.[0]?.epistemicState ?? "E0_UNVERIFIED"),
    };
    const entry = createKnowledgeEntry(seed);
    const pipeline = runIkesPipeline({
      entry,
      sanitizationAdmitted: sanitized.status === "ADMITTED",
      policyGateGranted: input.policyGateGranted,
      // The current runtime has no durable knowledge index adapter; never imply indexing from sanitization alone.
      indexed: false,
      auditIds: [],
    });
    return { sanitized, entry: pipeline };
  }

  /** Serializa la mutación de una entidad dentro del scope mínimo. */
  mutateEntity<T>(scope: SyncScope, entityId: string, fn: () => Promise<T>): Promise<T> {
    return this.mutations.mutate(scope, entityId, fn);
  }

  /** Emite un token de manager con scope, expiración, capacidades y auditoría. */
  issueToken(scope: SyncScope, capabilities: readonly string[], ttlMs?: number): ManagerToken {
    return issueManagerToken({ scope, capabilities, ttlMs });
  }

  /* ------------------------------------------------------------------ */
  /* Gates de gobernanza                                                 */
  /* ------------------------------------------------------------------ */

  evaluateGit(request: GitOperationRequest): GitGovernanceVerdict {
    return evaluateGitOperation(request);
  }

  assessDeployment(target: DeploymentTarget, gates: Parameters<typeof assessDeployment>[1], opts?: Parameters<typeof assessDeployment>[2]): DeploymentAssessment {
    return assessDeployment(target, gates, opts);
  }

  verifyAgentApp(input: VerifierInput): VerifierReport {
    return verifyAgentSdkApp(input);
  }

  evaluateQuality(input: QualityGateInput): QualityGateReport {
    return evaluateQualityGates(input);
  }

  planLifecycle(input: LifecycleRunInput): LifecycleRunPlan {
    return planLifecycleRun(input);
  }

  reconcile(state: ReconciliationState): ReconciliationReport {
    return reconcileBeforeRelease(state);
  }

  /** SOPHIA: evalúa el estado epistémico (E0–E4) y el Índice de Resonancia Epistémica. */
  assessEpistemic(signals: SophiaSignals): SophiaAssessment & { passesEriGate: boolean } {
    const assessment = assessEpistemicState(signals);
    return { ...assessment, passesEriGate: passesEriGate(assessment) };
  }

  /** Contradiction Engine Ω: detecta contradicciones estructurales entre claims canónicos. */
  detectContradictions(claims: readonly CanonicalClaim[], options?: ContradictionOptions): ContradictionReport {
    return runContradictionDetection(claims, options);
  }

  /** Evidence Grounding Guard Ω: mide el anclaje léxico de una respuesta a su evidencia (fail-closed). */
  assessGrounding(answer: string, evidence: readonly GroundingEvidence[], options?: GroundingOptions): GroundingReport {
    const report = assessGrounding(answer, evidence, options);
    this.events.publish({
      topic: "truth.grounding.assessed",
      type: report.verdict,
      payload: { verdict: report.verdict, groundedness: report.groundedness, unsupported: report.unsupportedClaimCount, digest: report.digest },
    });
    return report;
  }

  /** Registro canónico de las 7 federaciones TAMV (id ↔ código YUN). */
  federation(id: number): TamvFederation {
    return federationById(id);
  }

  /**
   * PERMISSION MAP Ω: expande una orden de alto nivel en su catálogo de permisos por
   * nivel de riesgo y su checklist. Mapear NO autoriza; prepara la decisión humana.
   */
  mapOrderPermissions(order: OrderIntent): PermissionCatalog {
    const catalog = buildPermissionMap(order);
    this.events.publish({
      topic: "governance.permissions.mapped",
      type: catalog.highestLevel,
      payload: {
        orderId: catalog.orderId,
        total: catalog.totalPermissions,
        totalAuthorizations: catalog.totalAuthorizations,
        highestLevel: catalog.highestLevel,
        requiresHumanAcceptance: catalog.requiresHumanAcceptance,
        digest: catalog.digest,
      },
    });
    return catalog;
  }

  /**
   * Verifica el sobre de autorización humana. Fail-closed: solo `AUTHORIZED` procede;
   * cualquier hueco, denegación o manipulación bloquea la ejecución.
   */
  verifyOrderAuthorization(envelope: AuthorizationEnvelope, catalog: PermissionCatalog): AuthorizationVerification {
    const verification = runVerifyAuthorization(envelope, catalog);
    this.events.publish({
      topic: "governance.permissions.authorized",
      type: verification.status,
      payload: {
        orderId: envelope.orderId,
        status: verification.status,
        mayProceed: verification.mayProceed,
        authorized: verification.authorizedPermissions.length,
        denied: verification.deniedPermissions.length,
        reason: verification.reason,
      },
    });
    return verification;
  }

  /**
   * TURBO ROUTE PLANNER Ω: decide la ruta de baja latencia (FAST/GROUNDED/AGENT/
   * HUMAN_REVIEW), qué filtros gobernados son obligatorios u omitibles, la política
   * de caché y el ámbito federado. Planificar NO autoriza ni ejecuta: la ruta es una
   * recomendación de flujo; CROWN sigue autorizando.
   */
  planTurboRoute(request: TurboRequest): TurboPlan {
    const plan = buildTurboPlan(request);
    this.events.publish({
      topic: "intelligence.turbo.planned",
      type: plan.route,
      payload: {
        route: plan.route,
        complexity: plan.complexity,
        mode: plan.mode,
        requiredFilters: plan.requiredFilters,
        skippedFilters: plan.skippedFilters,
        cachePolicy: plan.cachePolicy,
        federationId: plan.federationId,
        humanReviewRequired: plan.humanReviewRequired,
        digest: plan.digest,
      },
    });
    return plan;
  }

  /**
   * SEMÁFORO DE FLUJO GOBERNADO Ω: clasifica la solicitud en verde/amarillo/naranja/
   * rojo y decide cuántos filtros gobernados deben ejecutarse (vía rápida gobernada vs.
   * filtrado vs. gobierno reforzado vs. revisión humana). Clasificar NO autoriza ni
   * ejecuta: solo enruta el flujo; CROWN sigue autorizando y BookPI sigue evidenciando.
   */
  classifyFlow(input: TrafficLightInput): TrafficLightVerdict {
    const verdict = classifyTrafficFlow(input);
    this.events.publish({
      topic: "governance.traffic.classified",
      type: verdict.band,
      payload: {
        band: verdict.band,
        route: verdict.route,
        riskTier: verdict.riskTier,
        fastLane: verdict.fastLane,
        requiredFilters: verdict.requiredFilters,
        cachePolicy: verdict.cachePolicy,
        digest: verdict.digest,
      },
    });
    return verdict;
  }

  /* ------------------------------------------------------------------ */
  /* ISABELLA Ω · Cognitive Civilization Runtime (CCR-1)                 */
  /* ------------------------------------------------------------------ */

  private getEvolutionFabric(): { readonly controls: readonly import("../core/types").EvolutionControl[]; readonly mode: string } {
    if (!this.evolutionFabric) {
      const engine = createEngine();
      this.evolutionFabric = Object.freeze({ controls: [...engine.controls.values()], mode: engine.mode });
    }
    return this.evolutionFabric;
  }

  /**
   * ISABELLA Ω · CCR-1: ejecuta el ciclo gobernado de 9 pasos sobre subsistemas
   * reales (kernel → memoria → conocimiento → razonamiento → política → confianza →
   * realidad → evolución → contrato). El ciclo clasifica, explica y evidencia; NO
   * autoriza y NO ejecuta (`authorizationPerformed`/`executionPerformed` = false).
   */
  runCivilizationCycle(input: CivilizationCycleInput): CivilizationCycleResult {
    return runCivilizationCycleCore(
      {
        classifyFlow: (value) => this.classifyFlow(value),
        assessCompanionSafety: (value) => this.assessCompanionSafety(value),
        assessVigia: (value) => this.assessVigia(value),
        retrieveKnowledge: (query) => this.retrieveMemorySafely(query),
        planExperts: (ids) => this.planExpertModules(ids),
        harden: (content) => this.harden(content),
        explainPolicy: (decision, factors, evidenceRefs, policyVersion) =>
          this.explainPolicy(decision, factors, evidenceRefs, policyVersion),
        evolutionControls: () => this.getEvolutionFabric(),
        publish: (event) => {
          this.events.publish(event);
        },
      },
      input,
    );
  }

  /** Resumen honesto de las capas Ω y regalos Ω del CCR-1 (conteos y estado). */
  civilizationSummary(): ReturnType<typeof buildCivilizationSummary> {
    return buildCivilizationSummary();
  }

  /**
   * Catálogo del Hugging Face Hub (modelos + datasets). Solo lectura de información;
   * no genera texto ni concede autoridad. Falla cerrado si el Hub responde != 2xx.
   */
  queryHfHub(input: HfCatalogInput = {}): Promise<HfCatalogResult> {
    return queryHfHubCatalog(this.hfHub, input);
  }

  /** Propone la model card de un dataset del Hub como conocimiento PENDING_REVIEW. */
  ingestHfDataset(input: HfIngestInput): Promise<HfKnowledgeDocument> {
    return ingestHfDatasetCore(this.hfHub, input);
  }

  /** Resumen honesto de la integración HF Hub (id de método y número de tareas). */
  hfHubSummary(): ReturnType<typeof buildHfHubSummary> {
    return buildHfHubSummary();
  }

  /* ------------------------------------------------------------------ */
  /* ISABELLA Ω v3.1 · IHEC — Hyper Emergency Core                       */
  /* ------------------------------------------------------------------ */

  /**
   * Ejecuta el ciclo de civilización Ω BAJO la protección de IHEC y aplica los 10
   * regalos de Perplexity. En el camino feliz devuelve el ciclo + regalos; ante un
   * `SovereignKernelError` produce respuesta degradada con recuperación; ante
   * cualquier otro fallo activa Omega Mode. En ambos casos archiva la crisis y
   * genera una guarda (PENDING_REVIEW). NO autoriza ni ejecuta.
   */
  runCivilizationCycleWithIhec(
    input: CivilizationCycleInput,
    giftPayload: IhecGiftPayload = {},
  ): IhecRunResult<CivilizationCycleResult> {
    const payload: IhecGiftPayload = { summary: input.input, ...giftPayload };
    return runWithIhec(this.ihec, payload, () => this.runCivilizationCycle(input));
  }

  /** Resumen honesto de IHEC v3.1 (subsistemas, capas, regalos y divergencias). */
  ihecSummary(): ReturnType<typeof buildIhecSummary> {
    return buildIhecSummary();
  }


  /**
   * Llave Ed25519 usada para sellar documentos. Se carga de
   * `GENESIS_DOCUMENT_SEAL_KEY_PEM` (PKCS#8) si está presente; en caso contrario
   * se genera una efímera en memoria. Una llave efímera NO persiste entre
   * reinicios: la verificación posterior requiere la llave pública que viaja en
   * el manifiesto. Estado honesto: Ed25519 real; RFC 3161/C2PA/PQC no soportados.
   */
  documentSealSigner(): Ed25519Signer {
    if (!this.documentSealSignerInstance) {
      const pem = process.env.GENESIS_DOCUMENT_SEAL_KEY_PEM?.trim();
      this.documentSealSignerInstance = pem
        ? Ed25519Signer.fromPem(pem, "genesis-document-seal")
        : Ed25519Signer.generate("genesis-document-seal-ephemeral");
    }
    return this.documentSealSignerInstance;
  }

  /**
   * IGDS-v1: sella un documento con integridad SHA-256 + firma Ed25519 y marca
   * de agua textual. Sellar documenta procedencia; NO autoriza, NO publica y NO
   * concede timestamp de confianza ni C2PA.
   */
  async sealDocument(input: SealDocumentInput): Promise<DocumentSealManifest> {
    const manifest = await sealDocumentManifest(input, this.documentSealSigner());
    this.events.publish({
      topic: "security.document.sealed",
      type: manifest.schema,
      payload: {
        sealId: manifest.sealId,
        compactId: manifest.compactId,
        documentId: manifest.document.id,
        sha256: manifest.content.sha256,
        bytes: manifest.content.bytes,
        keyId: manifest.signer.keyId,
      },
    });
    return manifest;
  }

  /** IGDS-v1: verifica un sello (fail-closed: integridad + firma Ed25519). */
  async verifyDocumentSeal(input: VerifySealInput): Promise<SealVerificationReport> {
    const report = await verifyDocumentSealManifest(input);
    this.events.publish({
      topic: "security.document.seal.verified",
      type: report.valid ? "VALID" : "INVALID",
      payload: {
        sealId: report.sealId,
        valid: report.valid,
        integrity: report.integrity,
        signature: report.signature,
      },
    });
    return report;
  }

  /** Reporte honesto de lo implementado y lo no soportado por el sello IGDS-v1. */
  documentSealEnablement(): DocumentSealEnablement {
    return documentSealEnablementReport();
  }

  /** MAGPIE-X: publica un evento gobernado en el bus en proceso. Transporta intención, no autoriza ejecución. */
  publishEvent<T>(input: MagpiePublishInput<T>): MagpieDeliveryReport {
    return this.events.publish(input);
  }

  /** MAGPIE-X: suscribe un handler en proceso; devuelve la función de baja. */
  subscribeEvent<T>(topic: string, handler: MagpieHandler<T>): () => void {
    return this.events.subscribe(topic, handler);
  }

  /* ------------------------------------------------------------------ */
  /* Hardening: sanitización 2.0, criptografía triangulada, operaciones  */
  /* ------------------------------------------------------------------ */

  /** Endurecimiento de sanitización con entropía, homóglifos y PII profunda. */
  harden(content: string): HardeningResult {
    return hardenSanitization(content);
  }

  /** Cuarentena de un contenido sensible (registra hash y motivo, no el secreto). */
  quarantine(content: string, findings: Parameters<typeof buildQuarantineRecord>[1]): ReturnType<typeof buildQuarantineRecord> {
    return buildQuarantineRecord(content, findings);
  }

  /** Sello triangulado de un contenido (SHA3-512 + SHA-256 + BLAKE2b-512). */
  triangulate(content: string, hmacKey?: string): TriangulatedDigest {
    return triangulateDigest(content, hmacKey);
  }

  /** Sella un contenido con AES-256-GCM + sello triangulado. */
  seal(plaintext: string, key: Buffer, aad = ""): SealedEnvelope {
    return sealEnvelope(plaintext, key, aad);
  }

  /** Abre un sobre sellado; fail-closed ante tag o sello inválidos. */
  open(envelope: SealedEnvelope, key: Buffer, aad = ""): string {
    return openEnvelope(envelope, key, aad);
  }

  /** Readiness de producción (fail-closed: solo `healthy` es ready). */
  readiness(dependencies: readonly DependencyHealth[]): ProductionReadinessReport {
    return assessProductionReadiness(dependencies);
  }

  /** Snapshot operativo coherente (readiness + mantenimiento + correlación). */
  opsSnapshot(dependencies: readonly DependencyHealth[], windows: readonly MaintenanceWindow[] = []): OpsSnapshot {
    return buildOpsSnapshot(dependencies, windows);
  }

  /** Construye un acto operativo canónico TAP v1.0. */
  buildAct(input: TapActInput, highImpactTriggers: readonly HighImpactTrigger[] = []): TapAct {
    return buildTapAct(input, highImpactTriggers);
  }

  /** Valida los controles obligatorios de un acto TAP. */
  validateAct(act: TapAct): TapActValidation {
    return validateTapAct(act);
  }

  /** Evalúa el pipeline ISA-API de 12 etapas (fail-closed). */
  evaluateIsa(flags: Parameters<typeof evaluateIsaPipeline>[0]): ReturnType<typeof evaluateIsaPipeline> {
    return evaluateIsaPipeline(flags);
  }
}
