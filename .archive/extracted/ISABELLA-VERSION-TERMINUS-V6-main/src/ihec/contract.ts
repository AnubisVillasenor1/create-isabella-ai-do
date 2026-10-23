/**
 * ISABELLA Ω v3.1 · IHEC — Hyper Emergency Core (contrato y especificación honesta).
 *
 * state: draft | engine-generated.
 *
 * Este módulo declara, de forma auditable, la especificación IHEC v3.1 ("Edición
 * Perplexity") y su estado REAL dentro de este repositorio. No inventa motores
 * que no existen: los 12 subsistemas se implementan abajo en TypeScript
 * determinista (ver `engines.ts`) y las capas Ω-13 / Ω-14 se registran con su
 * nota de realidad.
 *
 * Invariante (AGENTS.md §1): IHEC es una CAPACIDAD de continuidad y evidencia.
 * NO concede autoridad, NO ejecuta efectos externos y NO se declara verificado.
 * `authorityPath` permanece `FULL`: la conciencia humana decide y ejecuta.
 *
 * Divergencia declarada (AGENTS.md §6): el spec original es Python y nombra
 * criptografía no disponible en este repositorio (BLAKE3 + ZSTD + XChaCha20). Se
 * implementa con la criptografía REAL del repo (SHA3-512 vía BookPI) y la
 * divergencia se archiva en `docs/spec/canonical/DIVERGENCE-REGISTER.md`.
 */

export const IHEC_SPEC_ID = "isabella-core-ccr-ihec-perplexity" as const;
export const IHEC_VERSION = "3.1.0" as const;
export const IHEC_STATE = "draft" as const;

/** Identidad de método (formato legacy [TINA].[YUN].[MODULO].[FUNCION].[VERSION].[RISK].[GOV]). */
export const IHEC_METHOD_ID = "A.TWINS.IHEC.run_immune_cycle.v3.1.0.LOW.AUTONOMOUS" as const;

/** El spec v3.1 titula "14 capas Ω" pero su diagrama enumera 10 + Ω-13 + Ω-14. Divergencia declarada. */
export const IHEC_SPEC_DECLARED_LAYERS = 14 as const;

export const IHEC_DISCLAIMER =
  "IHEC v3.1 detecta, aísla, se recupera, aprende y muta de forma determinista y auditable. NO autoriza, NO ejecuta efectos externos y NO se declara verificado. `authorityPath` permanece FULL: la conciencia humana decide, aprueba y ejecuta." as const;

export interface IhecDivergence {
  readonly code: string;
  readonly spec: string;
  readonly repository: string;
  readonly resolution: string;
}

/**
 * Divergencias código↔spec detectadas al portar el spec v3.1. No se resuelven en
 * silencio: se registran aquí y en el registro canónico de divergencias.
 */
export const IHEC_DIVERGENCES: readonly IhecDivergence[] = Object.freeze([
  {
    code: "IHEC-DIV-001",
    spec: "Criptografía BLAKE3 + ZSTD + XChaCha20 para el sello de snapshots.",
    repository: "No hay BLAKE3/ZSTD/XChaCha20 en el repo; se usa SHA3-512 (BookPI).",
    resolution: "Sello con `sha3_512Hex` (real y testeable); BLAKE3 queda SPECIFIED, no simulado.",
  },
  {
    code: "IHEC-DIV-002",
    spec: "Módulo de referencia en Python (`isabella_omega_ihec.py`).",
    repository: "Este repositorio es TypeScript estricto (sin `any`).",
    resolution: "Portado a TypeScript tipado, determinista; el comportamiento se conserva y se amplía.",
  },
  {
    code: "IHEC-DIV-003",
    spec: "El spec titula '14 capas Ω' pero enumera 10 (Ω-1..Ω-10) + Ω-13 + Ω-14.",
    repository: "CCR-1 ya registra 13 capas (Ω-0..Ω-12).",
    resolution: "Se registran además Ω-13 (IHEC) y Ω-14 (Crisis Memory) como extensión; el conteo declarado se archiva.",
  },
  {
    code: "IHEC-DIV-004",
    spec: "`qiskit-interop` / ventaja cuántica implícita en 'Q-ECTS'.",
    repository: "El bridge cuántico es SIMULADO (HTTP); no hay ventaja cuántica.",
    resolution: "Ningún gift reclama ventaja cuántica; el sustrato real es determinista clásico.",
  },
]);

/** Los 12 subsistemas de continuidad IHEC v3.1 (spec §2). */
export const IHEC_SUBSYSTEM_IDS = [
  "hyper-sentinel",
  "hyper-cache",
  "hyper-snapshot",
  "hyper-recovery",
  "cognitive-governance",
  "hyper-ml-fusion",
  "dataset-fusion",
  "vector-hyper-index",
  "hyper-rag",
  "crisis-memory",
  "immune-mutation",
  "self-healing-topology",
] as const;
export type IhecSubsystemId = (typeof IHEC_SUBSYSTEM_IDS)[number];

export interface IhecSubsystemSpec {
  readonly id: IhecSubsystemId;
  readonly name: string;
  readonly responsibility: string;
  readonly target: string;
  /** Estado honesto: IMPLEMENTED (real en proceso) o PARTIAL/SPECIFIED. */
  readonly status: "IMPLEMENTED" | "PARTIAL" | "SPECIFIED";
  readonly reality: string;
}

/** Declaración honesta de los 12 subsistemas frente al repositorio real. */
export const IHEC_SUBSYSTEMS: readonly IhecSubsystemSpec[] = Object.freeze([
  {
    id: "hyper-sentinel",
    name: "Hyper Sentinel Engine",
    responsibility: "Detección de anomalías, predicción de fallos y protección cognitiva.",
    target: "Detección < 100 ms",
    status: "IMPLEMENTED",
    reality: "Puntuación determinista de señales (firma, drift, ruido) en proceso; no infalible.",
  },
  {
    id: "hyper-cache",
    name: "Hyper Cache Engine",
    responsibility: "Caché multinivel hot/warm/cold.",
    target: "Lectura < 1 ms, escritura < 3 ms",
    status: "IMPLEMENTED",
    reality: "LRU multinivel real en memoria; no hay caché distribuida (Redis) cableada.",
  },
  {
    id: "hyper-snapshot",
    name: "Hyper Snapshot Engine",
    responsibility: "Copias cognitivas de estado, memoria, embeddings, grafos y credenciales.",
    target: "BLAKE3 + ZSTD + XChaCha20",
    status: "PARTIAL",
    reality: "Captura + sello SHA3-512 real; la compresión/cifrado (ZSTD/XChaCha20) es SPECIFIED.",
  },
  {
    id: "hyper-recovery",
    name: "Hyper Recovery Engine",
    responsibility: "Restore de runtime, memoria, modelos, agentes y contexto.",
    target: "RTO < 5 s",
    status: "IMPLEMENTED",
    reality: "Restauración determinista desde un snapshot sellado, verificando su integridad.",
  },
  {
    id: "cognitive-governance",
    name: "Cognitive Governance Engine",
    responsibility: "Auditoría, trazabilidad e historial de decisiones.",
    target: "100% trazado",
    status: "IMPLEMENTED",
    reality: "Registro append-only de decisiones con digest; emite veredictos, no ejecuta.",
  },
  {
    id: "hyper-ml-fusion",
    name: "Hyper ML Fusion Engine",
    responsibility: "Fusión LLM + SLM + Reglas + KG + RAG + Neural Retrieval (MoE dinámico).",
    target: "MoE dinámico",
    status: "PARTIAL",
    reality: "Fusión ponderada determinista de señales; los pesos son heurísticos, no aprendidos.",
  },
  {
    id: "dataset-fusion",
    name: "Dataset Fusion Engine",
    responsibility: "Ingesta, validación, normalización, deduplicación, enriquecimiento, fusión e indexado.",
    target: "Pipeline completo",
    status: "IMPLEMENTED",
    reality: "Pipeline determinista en proceso con deduplicación por hash; el indexado es en memoria.",
  },
  {
    id: "vector-hyper-index",
    name: "Vector Hyper Index",
    responsibility: "Selector FAISS/HNSW/ScaNN/Annoy por latencia/precisión/carga.",
    target: "Selección automática",
    status: "PARTIAL",
    reality: "Selector determinista con trade-offs explícitos; no se empaqueta ningún índice ANN real.",
  },
  {
    id: "hyper-rag",
    name: "Hyper RAG Engine (RAG++)",
    responsibility: "Búsqueda híbrida: vector + grafo + memoria + contexto + herramientas.",
    target: "Búsqueda híbrida",
    status: "PARTIAL",
    reality: "Puntuación híbrida determinista sobre evidencia aportada; sin sustrato vectorial persistente.",
  },
  {
    id: "crisis-memory",
    name: "Crisis Memory Engine",
    responsibility: "Registro inmutable de cada incidente y su lección estructural.",
    target: "100% de crisis archivadas",
    status: "IMPLEMENTED",
    reality: "Registro append-only sellado (SHA3-512); memoria inmunológica en proceso.",
  },
  {
    id: "immune-mutation",
    name: "Immune Mutation Engine",
    responsibility: "Generación de reglas, rutas y salvaguardas a partir de crisis.",
    target: "Mutación verificable",
    status: "IMPLEMENTED",
    reality: "Genera guardas deterministas; la guarda NO se auto-promueve (exige aprobación humana).",
  },
  {
    id: "self-healing-topology",
    name: "Self-Healing Topology Engine",
    responsibility: "Reconfiguración automática de topología de red y agentes.",
    target: "MTTR < 10 s",
    status: "PARTIAL",
    reality: "Plan de reconfiguración determinista; la reconfiguración real de red es de infraestructura.",
  },
]);

export const IHEC_SUBSYSTEM_COUNT = IHEC_SUBSYSTEMS.length;

/** Capas Ω de la extensión v3.1 (sobre las 13 ya registradas por CCR-1). */
export interface IhecLayer {
  readonly id: string;
  readonly name: string;
  readonly responsibility: string;
  readonly status: "IMPLEMENTED" | "PARTIAL" | "SPECIFIED";
  readonly reality: string;
}

export const IHEC_LAYERS: readonly IhecLayer[] = Object.freeze([
  {
    id: "Ω-13",
    name: "Hyper Emergency Core (IHEC)",
    responsibility: "Sistema inmunológico cognitivo: continuidad, aislamiento y recuperación.",
    status: "PARTIAL",
    reality:
      "12 subsistemas implementados en proceso (ver `IHEC_SUBSYSTEMS`); la criptografía BLAKE3/ZSTD/XChaCha20 y la caché distribuida son SPECIFIED.",
  },
  {
    id: "Ω-14",
    name: "Evolutionary Crisis Memory",
    responsibility: "Aprendizaje estructural permanente de cada fallo, ataque o degradación.",
    status: "IMPLEMENTED",
    reality:
      "Crisis Memory + Immune Mutation reales: cada incidente deja una lección y una guarda determinista, sin auto-promoción.",
  },
]);

export const IHEC_LAYER_COUNT = IHEC_LAYERS.length;
