// state: draft | engine-generated — Pila de ejecución de 12 capas Ω∞ (Documento §III).
// Modela la dualidad taxonómica canónica: los 6 macrodominios son el "qué" (taxonomía
// funcional) y las 12 capas L0–L11 son el "cómo" (pila de ejecución). Este módulo es una
// estructura + un guard de orden: no ejecuta, no autoriza, no abre red. Un test verde sobre
// él demuestra capacidad computacional, NO autoridad ni producción (AGENTS.md §1).
import type { MacroDomain } from '../native/contracts';

export const GENESIS_LAYERS = [
  'L0',
  'L1',
  'L2',
  'L3',
  'L4',
  'L5',
  'L6',
  'L7',
  'L8',
  'L9',
  'L10',
  'L11',
] as const;
export type GenesisLayer = (typeof GENESIS_LAYERS)[number];

export interface LayerInfo {
  readonly layer: GenesisLayer;
  readonly name: string;
  readonly responsibility: string;
  readonly isabellaComponent: string;
  readonly macroDomains: readonly MacroDomain[];
}

/** Correspondencia capa→macrodominio del Documento §III (macrodominios = qué, capas = cómo). */
export const LAYER_REGISTRY: Readonly<Record<GenesisLayer, LayerInfo>> = Object.freeze({
  L0: {
    layer: 'L0',
    name: 'Hardware Sovereignty',
    responsibility: 'Soberanía física (Edge / OnPrem / AirGap).',
    isabellaComponent: 'deploy/k8s, docker-compose, infra/ (config, no cognición)',
    macroDomains: ['CORE'],
  },
  L1: {
    layer: 'L1',
    name: 'Trust Fabric',
    responsibility: 'Identidad y confianza (ISA-CORE Ω).',
    isabellaComponent: 'src/identity, src/security, src/omega/native',
    macroDomains: ['GOVERNANCE'],
  },
  L2: {
    layer: 'L2',
    name: 'Fast Lane Cognitive Bus',
    responsibility: 'Ruta semántica adaptativa de baja latencia.',
    isabellaComponent: 'src/inference/local-fast-lane.ts + genesis/fastlane-v2.ts',
    macroDomains: ['CORE'],
  },
  L3: {
    layer: 'L3',
    name: 'Tool Orchestration',
    responsibility: 'Herramientas gobernadas con riesgo y allowlist.',
    isabellaComponent: 'src/tools, src/agents, genesis/tool-expansion.ts',
    macroDomains: ['CORE'],
  },
  L4: {
    layer: 'L4',
    name: 'Multi-Agent Society',
    responsibility: 'Sociedad de microagentes con DID y trust score.',
    isabellaComponent: 'src/agents + genesis/agent-society.ts',
    macroDomains: ['CORE'],
  },
  L5: {
    layer: 'L5',
    name: 'Symbolic Reasoning',
    responsibility: 'Lógica simbólica y verificación de restricciones.',
    isabellaComponent: 'src/cognition + genesis/hybrid-reasoning.ts',
    macroDomains: ['KNOWLEDGE'],
  },
  L6: {
    layer: 'L6',
    name: 'Neuro-Semantic Mesh',
    responsibility: 'Grafo semántico de conocimiento (Knowledge Mesh).',
    isabellaComponent: 'src/atlas, src/memory + genesis/knowledge-mesh.ts',
    macroDomains: ['KNOWLEDGE'],
  },
  L7: {
    layer: 'L7',
    name: 'Executive Memory',
    responsibility: 'Memoria Ejecutiva Fractal de 6 niveles.',
    isabellaComponent: 'src/memory + genesis/fem.ts',
    macroDomains: ['KNOWLEDGE', 'CORE'],
  },
  L8: {
    layer: 'L8',
    name: 'Strategic Planning',
    responsibility: 'Orquestador metacognitivo con presupuesto cognitivo.',
    isabellaComponent: 'src/cognition + genesis/meta-orchestrator.ts',
    macroDomains: ['CORE', 'ECONOMY'],
  },
  L9: {
    layer: 'L9',
    name: 'Self-Evaluation',
    responsibility: 'Bucle de refinamiento cognitivo (auto-evaluación).',
    isabellaComponent: 'src/evaluation + genesis/observability.ts',
    macroDomains: ['IMMUNITY'],
  },
  L10: {
    layer: 'L10',
    name: 'Evolution Engine',
    responsibility: 'Evolución controlada (self-improvement ≠ self-modification).',
    isabellaComponent: 'src/evolution + genesis/controlled-evolution.ts',
    macroDomains: ['IMMUNITY'],
  },
  L11: {
    layer: 'L11',
    name: 'Governance Core',
    responsibility: 'CROWN + GAME OVER + BookPI Ω (plano de gobernanza).',
    isabellaComponent: 'src/crown, src/gameover, src/bookpi, src/omega/constitution',
    macroDomains: ['GOVERNANCE'],
  },
});

/** La capa transversal de experiencia no es una capa L0–L11: envuelve toda la pila. */
export const EXPERIENCE_CROSSCUT: Readonly<{ domain: MacroDomain; note: string }> = Object.freeze({
  domain: 'EXPERIENCE',
  note: 'Ω-EXPERIENCE (NEXUS COE, GÉNESIS TTS, VOX) es transversal a todas las capas.',
});

export function layerInfo(layer: GenesisLayer): LayerInfo {
  return LAYER_REGISTRY[layer];
}

export function isGenesisLayer(value: string): value is GenesisLayer {
  return (GENESIS_LAYERS as readonly string[]).includes(value);
}

/** Índice numérico de una capa (L0 → 0 … L11 → 11). */
export function layerIndex(layer: GenesisLayer): number {
  return Number(layer.slice(1));
}

/**
 * Orden de resolución de la pila. La pila se recorre de L0 hacia L11: la gobernanza
 * (L11) está al final porque consume la salida de todas las capas previas y decide si
 * una propuesta es gobernable. `resolveLayerPath` devuelve la secuencia canónica y,
 * opcionalmente, el subconjunto entre dos capas, siempre en orden ascendente.
 */
export function resolveLayerPath(
  from: GenesisLayer = 'L0',
  to: GenesisLayer = 'L11'
): GenesisLayer[] {
  const a = layerIndex(from);
  const b = layerIndex(to);
  if (a > b) {
    throw new Error('GENESIS_LAYER_ORDER_INVALID: "from" no puede ser posterior a "to"');
  }
  return GENESIS_LAYERS.slice(a, b + 1) as GenesisLayer[];
}

/** Qué macrodominios toca un rango de capas (para trazabilidad del flujo nativo). */
export function macroDomainsForPath(layers: readonly GenesisLayer[]): MacroDomain[] {
  const seen = new Set<MacroDomain>();
  for (const layer of layers) {
    for (const domain of LAYER_REGISTRY[layer].macroDomains) seen.add(domain);
  }
  return [...seen];
}
