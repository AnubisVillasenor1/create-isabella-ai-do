/**
 * state: draft | engine-generated — Snapshot observable del "universo" de Isabella.
 *
 * Se construye aquí, y no dentro de `src/server.ts`, por una razón verificable: es la única fuente
 * de datos del mapa del hero, y un mapa que nadie puede probar es decorado. Ninguna constante de
 * este módulo fija conteos: todo llega por `sources`, y lo que no está cableado se declara con un
 * estado que lo dice. §1 de AGENTS.md separa CAPABILITY de AUTHORITY y de EVIDENCE; un mapa que
 * pinte de verde una declaración miente igual que un `toolsCount: 2` inventado.
 */

export const UNIVERSE_SCHEMA = 'isabella.universe.v1' as const;

export type UniverseEngineState =
  | 'WIRED_RUNTIME_DECISION'
  | 'WIRED_TOOL_GUARD'
  | 'WIRED_ROUTES_REGISTERED'
  | 'WIRED_IN_PROCESS'
  | 'DECLARED_ONLY'
  | 'MODULE_NOT_WIRED_TO_HTTP';

export const UNIVERSE_STATE_LEGEND = {
  WIRED_RUNTIME_DECISION:
    'se invoca en la ruta de decisión del runtime Genesis (src/genesis/runtime.ts)',
  WIRED_TOOL_GUARD: 'se invoca al admitir cada herramienta (src/tools/registry.ts)',
  WIRED_ROUTES_REGISTERED: 'las rutas HTTP construyen la clase sobre petición (src/litle)',
  WIRED_IN_PROCESS: 'instancia real dentro del proceso; sin sonda externa que la confirme',
  DECLARED_ONLY: 'declarado en este repositorio; ninguna petición lo consulta',
  MODULE_NOT_WIRED_TO_HTTP: 'existe el módulo en src/ pero ninguna ruta del HTTP lo importa',
  SUPABASE_CONFIGURED_NOT_PROBED_HERE:
    'puerto de persistencia configurado por entorno; no se sonda en esta respuesta',
  VOLATILE_IN_PROCESS: 'solo memoria del proceso: se pierde al reiniciar',
  REGISTRY_DERIVED: 'conteo leído del registro en memoria en este momento',
  NOT_HALTED: 'sin alcance haltado por el interruptor soberano',
  HALTED: 'el interruptor soberano tiene al menos un alcance haltado',
  ENV_HALT_ENGAGED: 'ISA_KILL_SWITCH activo: todo alcance está haltado por entorno',
} as const;

export interface UniverseCrownNode {
  readonly id: string;
  readonly name: string;
  readonly role: string;
  readonly federation: string;
  readonly status: string;
  readonly weight: number;
  readonly icon: string;
}

export interface UniverseExpert {
  readonly id: string;
  readonly riskCeiling: string;
}

export interface UniverseSources {
  readonly crownNodes: readonly UniverseCrownNode[];
  readonly experts: readonly UniverseExpert[];
  /** Un elemento por herramienta registrada; solo se usa su techo de riesgo. */
  readonly toolRiskTiers: readonly string[];
  readonly capabilityDescriptors: readonly { id: string; domain: string; riskTier: string }[];
  readonly counts: {
    readonly skills: number;
    readonly modules: number;
    readonly protocols: number;
    readonly customizations: number;
    readonly memoryClaims: number;
  };
  readonly toolEvidence: {
    readonly configured: boolean;
    readonly sealedEvents: number;
    readonly sealFailures: number;
    readonly withheldResults: number;
    readonly tools: number;
  };
  readonly blackout: { readonly envFlag: boolean; readonly haltCount: number };
  readonly bookpi: { readonly backend: string; readonly durability: string };
  readonly quantumDescription: unknown;
  readonly ikesPersistenceConfigured: boolean;
}

/** Distribución por tier de riesgo, siempre en el mismo orden para que el mapa sea determinista. */
export function riskTierDistribution(tiers: readonly string[]): Record<string, number> {
  const distribution: Record<string, number> = {};
  for (const tier of tiers) distribution[tier] = (distribution[tier] ?? 0) + 1;
  return Object.fromEntries(Object.entries(distribution).sort(([a], [b]) => a.localeCompare(b)));
}

export function federationsOf(nodes: readonly UniverseCrownNode[]) {
  const labels = [...new Set(nodes.map((node) => node.federation))].sort((a, b) =>
    a.localeCompare(b, 'es')
  );
  return labels.map((label) => ({
    label,
    nodes: nodes.filter((node) => node.federation === label).map((node) => node.id),
  }));
}

export function buildUniverseSnapshot(sources: UniverseSources) {
  const tools = sources.toolRiskTiers.length;
  const blackoutState = sources.blackout.envFlag
    ? 'ENV_HALT_ENGAGED'
    : sources.blackout.haltCount > 0
      ? 'HALTED'
      : 'NOT_HALTED';
  const memoryState = sources.ikesPersistenceConfigured
    ? 'SUPABASE_CONFIGURED_NOT_PROBED_HERE'
    : 'VOLATILE_IN_PROCESS';

  return {
    schema: UNIVERSE_SCHEMA,
    provenance:
      'Nodos, pesos y federaciones leídos de CROWN_NODES; módulos expertos de EXPERT_REGISTRY; ' +
      'conteos derivados en vivo de los registros del runtime. El navegador no inventa ninguna posición ni estado.',
    nodeStatusMeaning:
      'DECLARED = nodo declarado en este repositorio, sin sonda independiente. Solo se pinta como activo ' +
      'cuando el estado recibido lo justifica.',
    stateLegend: UNIVERSE_STATE_LEGEND,
    engineStates: {
      crown: 'WIRED_RUNTIME_DECISION' satisfies UniverseEngineState,
      aegis: 'WIRED_TOOL_GUARD' satisfies UniverseEngineState,
      ikes: 'WIRED_IN_PROCESS' satisfies UniverseEngineState,
      ikesPersistence: memoryState,
      veritas: 'WIRED_IN_PROCESS' satisfies UniverseEngineState,
      bookpi: sources.bookpi.backend,
      bookpiDurability: sources.bookpi.durability,
      pdp: 'MODULE_NOT_WIRED_TO_HTTP' satisfies UniverseEngineState,
      litleTrustFabric: 'WIRED_ROUTES_REGISTERED' satisfies UniverseEngineState,
      blackout: blackoutState,
      blackoutHalts: sources.blackout.haltCount,
      quantumPennyLane: sources.quantumDescription,
      hyperSkillFabric: {
        contract: 'isabella.hsf.v1',
        capabilities: sources.capabilityDescriptors,
      },
      geminiEngine: 'EXPLICIT_SELECTION_ONLY',
    },
    nodes: sources.crownNodes.map((node) => ({
      id: node.id,
      name: node.name,
      role: node.role,
      federation: node.federation,
      status: node.status,
      weight: node.weight,
      icon: node.icon,
    })),
    federations: federationsOf(sources.crownNodes),
    expertModules: sources.experts.map((expert) => ({
      id: expert.id,
      riskCeiling: expert.riskCeiling,
    })),
    subsystems: [
      { id: 'tools', label: 'HERRAMIENTAS GOBERNADAS', count: tools, state: 'REGISTRY_DERIVED' },
      {
        id: 'skills',
        label: 'HABILIDADES',
        count: sources.counts.skills,
        state: 'REGISTRY_DERIVED',
      },
      {
        id: 'modules',
        label: 'MÓDULOS GÉNESIS',
        count: sources.counts.modules,
        state: 'REGISTRY_DERIVED',
      },
      {
        id: 'protocols',
        label: 'PROTOCOLOS',
        count: sources.counts.protocols,
        state: 'REGISTRY_DERIVED',
      },
      {
        id: 'capabilities',
        label: 'CAPACIDADES HSF',
        count: sources.capabilityDescriptors.length,
        state: 'REGISTRY_DERIVED',
      },
      {
        id: 'customizations',
        label: 'CATÁLOGO DE CUSTOMIZACIÓN',
        count: sources.counts.customizations,
        state: 'REGISTRY_DERIVED',
      },
      {
        id: 'memory',
        label: 'AFIRMACIONES IKES',
        count: sources.counts.memoryClaims,
        state: memoryState,
      },
      {
        id: 'experts',
        label: 'MÓDULOS EXPERTOS',
        count: sources.experts.length,
        state: 'DECLARED_ONLY',
      },
      {
        id: 'crownNodes',
        label: 'NODOS CROWN',
        count: sources.crownNodes.length,
        state: 'DECLARED_ONLY',
      },
    ],
    toolsByRiskTier: riskTierDistribution(sources.toolRiskTiers),
    evidence: sources.toolEvidence,
    counts: {
      experts: sources.experts.length,
      crownNodes: sources.crownNodes.length,
      tools,
      skills: sources.counts.skills,
      modules: sources.counts.modules,
      protocols: sources.counts.protocols,
    },
  };
}
