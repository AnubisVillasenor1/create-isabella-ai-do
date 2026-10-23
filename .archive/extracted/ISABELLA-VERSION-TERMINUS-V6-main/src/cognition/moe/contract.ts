/**
 * MOE SOBERANO — contrato explícito (contract.ts).
 * state: draft | auto_generated (pendiente revisión humana).
 *
 * ISA-002 (separación router léxico / MoE): el router heurístico del repo
 * (`src/intelligence/adaptive-router.ts`, exporta `planExecution`) clasifica
 * complejidad y produce un `AdaptivePlan` sin logits, sin pesos de gate, sin
 * top-k ni capacidad. Por construcción NO satisface la etiqueta MoE; su salida
 * no es un `MoeGateDecision` (ver `isMoeGateDecision` en router.ts). Ese archivo
 * NO se mueve ni se renombra; esta constante documenta la frontera.
 *
 * Los artefactos de `demoExpertRegistry()` son especificaciones declaradas de
 * ejemplo (`payload` textual), NO pesos entrenados reales. La integridad se
 * garantiza por hash; la honestidad de "experto real" exige evidencia humana.
 */
import { sha256Hex } from "./hash";

export type ExpertId = string;
export type SemanticVersion = string;
export type Sha256Hex = string;

export type Modality = "text" | "image" | "audio" | "tensor";
export type ArtifactStatus = "OPERATIONAL" | "NON_OPERATIONAL";
export type ArtifactEnv = "dev" | "staging" | "production";

export interface SemVerParts {
  readonly major: number;
  readonly minor: number;
  readonly patch: number;
}

/** Artefacto independiente por experto (ISA-004): hash, versión, dataset, licencia. */
export interface ExpertArtifact {
  readonly id: ExpertId;
  readonly version: SemanticVersion;
  readonly dataset: string;
  readonly license: string;
  readonly hash: Sha256Hex;
  readonly payload: string;
  readonly contractVersion: number;
  readonly status: ArtifactStatus;
  readonly modalities: readonly Modality[];
}

export interface ResolvedExpert {
  readonly artifact: Readonly<ExpertArtifact>;
  readonly operational: boolean;
}

export interface ArtifactSpec {
  readonly id: ExpertId;
  readonly version: SemanticVersion;
  readonly dataset: string;
  readonly license: string;
  readonly payload?: string;
  readonly contractVersion?: number;
  readonly status?: ArtifactStatus;
  readonly modalities?: readonly Modality[];
}

export interface ExpertRegistry {
  readonly list: () => readonly ResolvedExpert[];
  readonly get: (id: ExpertId) => ResolvedExpert | undefined;
  readonly isOperational: (id: ExpertId) => boolean;
  /** ISA-013: exige hash verificado antes de cargar en staging/production. */
  readonly open: (id: ExpertId, env: ArtifactEnv) => ResolvedExpert;
  /** ISA-011: todo experto anunciado debe tener artefacto o estar marcado no operativo. */
  readonly assertsNoGhosts: (announced: readonly ExpertId[]) => void;
}

export const SHA256_HEX_RE = /^[0-9a-f]{64}$/;
export const ARTIFACT_CONTRACT_VERSION = 1;

/** ISA-002 — familias de router; solo MOE_SOVEREIGN satisface el contrato MoE. */
export const ROUTER_FAMILIES = ["MOE_SOVEREIGN", "HEURISTIC_LEXICAL"] as const;
export type RouterFamily = (typeof ROUTER_FAMILIES)[number];

export const ROUTER_CLASSIFICATION = {
  adaptiveRouter: {
    module: "src/intelligence/adaptive-router",
    family: "HEURISTIC_LEXICAL" as RouterFamily,
    satisfiesMoeContract: false,
  },
  moeRouter: {
    module: "src/cognition/moe",
    family: "MOE_SOVEREIGN" as RouterFamily,
    satisfiesMoeContract: true,
  },
} as const;

export function satisfiesMoeContract(family: RouterFamily): boolean {
  return family === "MOE_SOVEREIGN";
}

/** Fallback gobernado y determinista del MoE (ISA-001 / ISA-008). */
export const FALLBACK_EXPERT = "MOE_GOVERNED_FALLBACK" as const;
export type FallbackExpertId = typeof FALLBACK_EXPERT;

export function parseSemVer(version: SemanticVersion): SemVerParts {
  const parts = version.split(".");
  if (parts.length !== 3) throw new Error(`MOE: versión inválida '${version}'`);
  const numeric = parts.map((p) => {
    if (!/^\d+$/.test(p)) throw new Error(`MOE: versión no numérica '${version}'`);
    return Number(p);
  });
  const major = numeric[0];
  const minor = numeric[1];
  const patch = numeric[2];
  if (major === undefined || minor === undefined || patch === undefined) {
    throw new Error(`MOE: versión inválida '${version}'`);
  }
  return { major, minor, patch };
}

/** ISA-012 — compatibilidad semántica: mismo major y (minor, patch) >= mínimo. */
export function isCompatibleVersion(declared: SemanticVersion, requiredMin: SemanticVersion): boolean {
  const d = parseSemVer(declared);
  const r = parseSemVer(requiredMin);
  if (d.major !== r.major) return false;
  return d.minor > r.minor || (d.minor === r.minor && d.patch >= r.patch);
}

export function assertArtifactCompatible(
  artifact: Readonly<ExpertArtifact>,
  requiredContractVersion: number = ARTIFACT_CONTRACT_VERSION,
  requiredMinVersion: SemanticVersion = "1.0.0",
): void {
  if (artifact.contractVersion !== requiredContractVersion) {
    throw new Error(
      `MOE: contrato de artefacto incompatible para ${artifact.id} (v${artifact.contractVersion} != v${requiredContractVersion})`,
    );
  }
  if (!isCompatibleVersion(artifact.version, requiredMinVersion)) {
    throw new Error(`MOE: versión ${artifact.version} de ${artifact.id} por debajo del mínimo ${requiredMinVersion}`);
  }
}

export function declareExpertArtifact(spec: ArtifactSpec): ExpertArtifact {
  const payload = spec.payload ?? "";
  return Object.freeze({
    id: spec.id,
    version: spec.version,
    dataset: spec.dataset,
    license: spec.license,
    hash: sha256Hex(payload),
    payload,
    contractVersion: spec.contractVersion ?? ARTIFACT_CONTRACT_VERSION,
    status: spec.status ?? "OPERATIONAL",
    modalities: Object.freeze([...(spec.modalities ?? ["text"])]),
  });
}

export function createExpertRegistry(artifacts: readonly ExpertArtifact[]): ExpertRegistry {
  const byId = new Map<string, ExpertArtifact>();
  for (const artifact of artifacts) {
    if (artifact.id.trim() === "") throw new Error("MOE: artefacto sin id");
    if (byId.has(artifact.id)) throw new Error(`MOE: id de artefacto duplicado ${artifact.id}`);
    if (!SHA256_HEX_RE.test(artifact.hash)) throw new Error(`MOE: hash inválido para ${artifact.id}`);
    parseSemVer(artifact.version);
    byId.set(artifact.id, Object.freeze({ ...artifact, modalities: Object.freeze([...artifact.modalities]) }));
  }

  const resolve = (id: ExpertId): ResolvedExpert | undefined => {
    const artifact = byId.get(id);
    if (!artifact) return undefined;
    return Object.freeze({ artifact, operational: artifact.status === "OPERATIONAL" });
  };

  return Object.freeze({
    list: () =>
      [...byId.values()].map((artifact) => resolve(artifact.id)).filter((e): e is ResolvedExpert => e !== undefined),
    get: resolve,
    isOperational: (id: ExpertId) => resolve(id)?.operational ?? false,
    open: (id: ExpertId, env: ArtifactEnv) => {
      const expert = resolve(id);
      if (!expert) throw new Error(`MOE: experto desconocido ${id}`);
      if (!expert.operational) throw new Error(`MOE: ${id} está marcado NO_OPERATIONAL y no puede cargarse`);
      if (env !== "dev" && sha256Hex(expert.artifact.payload) !== expert.artifact.hash) {
        throw new Error(`MOE: hash de artefacto no coincide para ${id} (env=${env})`);
      }
      return expert;
    },
    assertsNoGhosts: (announced: readonly ExpertId[]) => {
      for (const id of announced) {
        if (!byId.has(id)) {
          throw new Error(`MOE: experto fantasma '${id}' (anunciado sin artefacto ni marca no operativa)`);
        }
      }
    },
  });
}

/** Registro determinista de ejemplo sobre ids reales del catálogo cognitivo. */
export function demoExpertRegistry(): ExpertRegistry {
  const specs: readonly ArtifactSpec[] = [
    { id: "E01_SECURITY", version: "1.2.0", dataset: "genesis-governance-v1", license: "CC-BY-4.0", payload: "E01_SECURITY:security:spec:v1", modalities: ["text"] },
    { id: "E07_ECONOMY", version: "1.0.0", dataset: "genesis-economy-v1", license: "CC-BY-4.0", payload: "E07_ECONOMY:economy:spec:v1", modalities: ["text"] },
    { id: "E11_VERITAS", version: "2.0.0", dataset: "genesis-veritas-v2", license: "CC-BY-4.0", payload: "E11_VERITAS:veritas:spec:v2", modalities: ["text"] },
    { id: "E18_PLANNING", version: "1.1.0", dataset: "genesis-planning-v1", license: "CC-BY-4.0", payload: "E18_PLANNING:planning:spec:v1", modalities: ["text"] },
    { id: "E21_SYNTHESIS", version: "1.0.0", dataset: "genesis-synthesis-v1", license: "CC-BY-4.0", payload: "E21_SYNTHESIS:synthesis:spec:v1", modalities: ["text"] },
    { id: "E22_MEMORY_RAG", version: "1.0.0", dataset: "genesis-memory-v1", license: "CC-BY-4.0", payload: "E22_MEMORY_RAG:memory:spec:v1", modalities: ["text"] },
    { id: FALLBACK_EXPERT, version: "1.0.0", dataset: "genesis-fallback-v1", license: "CC-BY-4.0", payload: "MOE_GOVERNED_FALLBACK:governed:spec:v1", modalities: ["text"] },
  ];
  return createExpertRegistry(specs.map(declareExpertArtifact));
}