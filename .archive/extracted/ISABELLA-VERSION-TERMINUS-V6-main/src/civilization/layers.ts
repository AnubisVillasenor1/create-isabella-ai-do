/**
 * ISABELLA Ω · COGNITIVE CIVILIZATION RUNTIME (CCR-1) — Registro de capas Ω.
 *
 * state: draft | engine-generated.
 *
 * Este módulo NO inventa una civilización nueva: declara, de forma auditable y
 * honesta, las capas Ω del spec CCR-1 (v2.0.0) y su estado REAL dentro de este
 * repositorio. Cada capa apunta a los módulos que de verdad la sostienen y a una
 * nota de realidad (`reality`) que distingue lo IMPLEMENTADO de lo PARCIAL, lo
 * SIMULADO y lo meramente SPECIFIED.
 *
 * Invariante (AGENTS.md §1): una capa Ω describe una CAPACIDAD de composición; no
 * concede autoridad, no ejecuta efectos y no se declara verificado. `authorityPath`
 * permanece `FULL`: la conciencia humana decide y ejecuta.
 *
 * Nota de divergencia honesta (AGENTS.md §6): el spec titula "12 capas Ω" pero su
 * tabla enumera Ω-0..Ω-12 (13 filas). Se registran las 13 y se declara la
 * discrepancia (`CCR_DECLARED_LAYERS = 12`, `CIVILIZATION_LAYER_COUNT = 13`) para
 * arbitraje humano, en lugar de ocultarla.
 */

export const CCR_SPEC_ID = "isabella-core-ccr" as const;
export const CCR_VERSION = "2.0.0" as const;
export const CCR_STATE = "draft" as const;

/** El spec declara "12 capas Ω" pero enumera 13 (Ω-0..Ω-12). Divergencia declarada. */
export const CCR_DECLARED_LAYERS = 12 as const;

export const CIVILIZATION_LAYER_STATUSES = [
  "IMPLEMENTED",
  "PARTIAL",
  "SIMULATED",
  "SPECIFIED",
  "NOT_WIRED",
] as const;
export type CivilizationLayerStatus = (typeof CIVILIZATION_LAYER_STATUSES)[number];

export interface CivilizationLayer {
  /** Identificador Ω canónico (Ω-0..Ω-12). */
  readonly id: string;
  readonly order: number;
  readonly name: string;
  readonly responsibility: string;
  readonly status: CivilizationLayerStatus;
  /** Módulos/funciones reales del repo que sostienen esta capa. */
  readonly wiring: readonly string[];
  /** Nota de realidad: qué es real, qué es parcial, qué NO está cableado. */
  readonly reality: string;
}

/**
 * Las 13 capas Ω del CCR-1, en orden de composición. El estado refleja el
 * repositorio real, no la aspiración del spec.
 */
export const CIVILIZATION_LAYERS: readonly CivilizationLayer[] = Object.freeze([
  {
    id: "Ω-0",
    order: 0,
    name: "Sovereign Kernel",
    responsibility: "Identidad, autorización, enrutado, validación y auditoría del ciclo.",
    status: "IMPLEMENTED",
    wiring: [
      "genesis/runtime.ts#evaluate (CROWN + AEGIS + plan + memoria)",
      "governance/traffic-light.ts#classifyFlow",
      "crown/* (intent, verification, capability)",
      "security/aegis.ts#inspectAegis",
      "bookpi/* (ledger append-only)",
    ],
    reality:
      "Enrutado/clasificación/auditoría reales (CROWN+AEGIS+semáforo+BookPI). El kernel DECIDE y REGISTRA; no ejecuta efectos externos.",
  },
  {
    id: "Ω-1",
    order: 1,
    name: "Cognitive Memory Mesh",
    responsibility: "Memoria episódica, semántica y verificada con procedencia.",
    status: "PARTIAL",
    wiring: [
      "memory/ikes.ts#IKESEngine.retrieve",
      "memory/provenance.ts",
      "memory/fabric.ts (InMemoryMemoryFabric)",
      "veritas/verifier.ts",
    ],
    reality:
      "Memoria verificada (IKES) y procedencia reales. No hay Neo4j/Qdrant/EventStore cableados: el sustrato persistente distribuido es SPECIFIED.",
  },
  {
    id: "Ω-2",
    order: 2,
    name: "Reality Digital Twin",
    responsibility: "Gemelo digital del territorio y simulación/forecast de escenarios.",
    status: "PARTIAL",
    wiring: [
      "capabilities (buildDigitalTwin)",
      "territory/context.ts#queryTerritory",
      "xr/safety.ts#evaluateXrSafety",
    ],
    reality:
      "Gemelo digital declarativo y contexto territorial reales. El motor de simulación/forecast NO está cableado: `simulation = null`.",
  },
  {
    id: "Ω-3",
    order: 3,
    name: "Planetary Knowledge Graph",
    responsibility: "Grafo semántico de conocimiento con procedencia y expansión.",
    status: "PARTIAL",
    wiring: [
      "knowledge/fabric.ts#KnowledgeFabric.ingest",
      "memory/ikes.ts (claims canónicos)",
      "memory/provenance.ts",
    ],
    reality:
      "Admisión gobernada de conocimiento y procedencia reales. La expansión de grafo semántico (Neo4j/RDF) NO está cableada; los dominios se derivan de los claims recuperados.",
  },
  {
    id: "Ω-4",
    order: 4,
    name: "Meta-Reasoning Engine",
    responsibility: "Razonar sobre el razonamiento: camino, confianza y contradicciones.",
    status: "PARTIAL",
    wiring: [
      "cognition/explainability.ts#explainPolicyDecision",
      "cognition/contradiction.ts#detectContradictions",
      "cognition/experts.ts#planExperts",
      "veritas/grounding.ts#assessGrounding",
    ],
    reality:
      "Camino de razonamiento, explicación de política y detección de contradicciones reales. La planificación de expertos es real; la ejecución de 1024 microexpertos vía vLLM es SPECIFIED.",
  },
  {
    id: "Ω-5",
    order: 5,
    name: "Autonomous Science Engine",
    responsibility: "Hipótesis, experimentos, papers, citas y revisión por pares.",
    status: "NOT_WIRED",
    wiring: [],
    reality:
      "SPECIFIED únicamente. No existe motor de ciencia autónoma en este repositorio; se declara ausente en lugar de simularlo.",
  },
  {
    id: "Ω-6",
    order: 6,
    name: "Civilization Policy Compiler",
    responsibility: "Leyes → ontología → políticas ejecutables (OPA/Rego) → runtime.",
    status: "PARTIAL",
    wiring: [
      "crown/verification.ts (evaluateCrown)",
      "governance/permission-map.ts",
      "cognition/explainability.ts#explainPolicyDecision",
    ],
    reality:
      "Compuerta CROWN y mapa de permisos reales; la explicación de política es real. El compilador leyes→Rego/OPA NO está cableado.",
  },
  {
    id: "Ω-7",
    order: 7,
    name: "Trust Fabric",
    responsibility: "Integridad SHA3-512, Merkle, DAG, ML-DSA, cadena de custodia.",
    status: "IMPLEMENTED",
    wiring: [
      "bookpi/crypto.ts (sha3_512Hex, computeEventHash, computeEventIntegrity)",
      "bookpi/merkle.ts#buildMerkleTree",
      "bookpi/transparency.ts (RFC6962, SignedTreeHead)",
      "security/post-quantum.ts (Ed25519 real; ML-DSA/SLH-DSA BLOCKED_ENVIRONMENT)",
      "security/document-seal.ts",
    ],
    reality:
      "SHA-256 + SHA3-512 + Merkle + RFC6962 + firma Ed25519 reales. PQC (ML-DSA/SLH-DSA) queda BLOCKED_ENVIRONMENT: NO se simula la post-cuántica.",
  },
  {
    id: "Ω-8",
    order: 8,
    name: "Multi-Agent Federated Intelligence",
    responsibility: "Enjambre MoE de microexpertos especializados y federados.",
    status: "PARTIAL",
    wiring: [
      "cognition/experts.ts (GENESIS_EXPERTS, planExperts)",
      "cognition/orchestrator.ts#synthesize",
      "cognition/moe/*",
      "federation/*",
    ],
    reality:
      "MoE real y parametrizable con 24 expertos canónicos y 7 federaciones. Los 1024 microexpertos + vLLM del spec son SPECIFIED.",
  },
  {
    id: "Ω-9",
    order: 9,
    name: "Economic Consciousness Engine",
    responsibility: "Métricas de impacto, coste, energía y riqueza (GEMET).",
    status: "PARTIAL",
    wiring: [
      "commerce/*",
      "atlas (RecordEconomyEntryInput, persistEconomyEntry)",
      "observability/telemetry.ts",
    ],
    reality:
      "Registro de entradas económicas y telemetría reales. El motor de consciencia económica (energía/coste por inferencia) es PARCIAL/SPECIFIED.",
  },
  {
    id: "Ω-10",
    order: 10,
    name: "Neural Governance Layer",
    responsibility: "Anticipar riesgo, sesgo y corrupción antes de que ocurran.",
    status: "IMPLEMENTED",
    wiring: [
      "gameover (UAGP, trust-engine.ts#scoreTrust)",
      "reina (adjudicación)",
      "osiris (defensa)",
      "crown/verification.ts",
    ],
    reality:
      "Gobernanza anticipatoria, adjudicación y defensa reales. Emite veredictos, no ejecuta: la conciencia humana arbitra.",
  },
  {
    id: "Ω-11",
    order: 11,
    name: "Self-Evolution Engine",
    responsibility: "Auto-diagnóstico, auditoría y reorganización gobernada.",
    status: "PARTIAL",
    wiring: [
      "evolution/engine.ts#createEngine",
      "evolution/catalog.ts#controlSummary",
      "evolution/state-machine.ts",
      "scripts/repository-assurance.mjs",
    ],
    reality:
      "Fabric de evolución con transiciones gobernadas reales (paso a `wired` exige aprobador humano). La reorganización autónoma sin humano está PROHIBIDA por invariante.",
  },
  {
    id: "Ω-12",
    order: 12,
    name: "Antifragility Core",
    responsibility: "Que cada fallo endurezca el sistema (circuit breaker, rollback, caos).",
    status: "PARTIAL",
    wiring: [
      "deployment/circuit-breaker.ts#CircuitBreaker",
      "deployment (rollback gates)",
      "evolution/hypercore.ts#decideHypercore",
    ],
    reality:
      "Circuit breaker, gates de rollback y early-exit reales. La inyección de caos (chaos engineering) NO está cableada.",
  },
]);

export const CIVILIZATION_LAYER_COUNT = CIVILIZATION_LAYERS.length;

export function layerById(id: string): CivilizationLayer | undefined {
  return CIVILIZATION_LAYERS.find((layer) => layer.id === id);
}

export function layerSummary(): Record<CivilizationLayerStatus, number> {
  const summary: Record<CivilizationLayerStatus, number> = {
    IMPLEMENTED: 0,
    PARTIAL: 0,
    SIMULATED: 0,
    SPECIFIED: 0,
    NOT_WIRED: 0,
  };
  for (const layer of CIVILIZATION_LAYERS) summary[layer.status] += 1;
  return summary;
}
