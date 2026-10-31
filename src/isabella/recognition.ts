export type IsabellaGiftStatus = 'wired' | 'ready' | 'draft';

export interface IsabellaGift {
  readonly id: string;
  readonly name: string;
  readonly domain:
    | 'latency'
    | 'safety'
    | 'memory'
    | 'tools'
    | 'governance'
    | 'observability'
    | 'quality'
    | 'community';
  readonly status: IsabellaGiftStatus;
  readonly promise: string;
  readonly evidence: string;
  readonly humanAction: string;
}

/**
 * Isabella's ten practical gifts: an honest, inspectable inventory of the
 * capabilities that make the system useful without claiming production
 * authority that still belongs to a human operator.
 */
export const ISABELLA_GIFTS: readonly IsabellaGift[] = [
  {
    id: 'pulse',
    name: 'Pulso de latencia',
    domain: 'latency',
    status: 'wired',
    promise: 'Mide cada ruta y hace visibles p50/p95/p99 y errores.',
    evidence: 'LatencyRegistry + MetricsRegistry',
    humanAction: 'Definir SLOs por entorno',
  },
  {
    id: 'turbo-route',
    name: 'Turbo Route Planner',
    domain: 'latency',
    status: 'wired',
    promise: 'Selecciona FAST, GROUNDED, AGENT o HUMAN_REVIEW sin saltarse controles.',
    evidence: 'Turbo Planner HTTP surface',
    humanAction: 'Aprobar políticas de escalado',
  },
  {
    id: 'native-moe',
    name: 'Motor nativo MoE',
    domain: 'quality',
    status: 'wired',
    promise: 'Combina expertos especializados con trazabilidad del resultado.',
    evidence: 'Genesis runtime + native ML modules',
    humanAction: 'Revisar benchmarks representativos',
  },
  {
    id: 'memory',
    name: 'Memoria con procedencia',
    domain: 'memory',
    status: 'wired',
    promise:
      'Conserva continuidad acotada y distingue conocimiento verificado de contexto no confiable.',
    evidence: 'SessionMemory + VerifiedKnowledgeStore',
    humanAction: 'Configurar retención y borrado',
  },
  {
    id: 'mcp-bridge',
    name: 'Puente de herramientas',
    domain: 'tools',
    status: 'wired',
    promise: 'Expone skills por MCP con scopes, presupuesto, rate limit y sello BookPI.',
    evidence: 'HyperCore SkillMcpServer',
    humanAction: 'Conectar solo herramientas autorizadas',
  },
  {
    id: 'human-gate',
    name: 'Gobernanza humana',
    domain: 'governance',
    status: 'wired',
    promise: 'Escala acciones sensibles y nunca convierte una inferencia en autoridad.',
    evidence: 'CROWN + BookPI + approval gates',
    humanAction: 'Nombrar aprobadores por riesgo',
  },
  {
    id: 'security-baseline',
    name: 'Blindaje operativo',
    domain: 'safety',
    status: 'wired',
    promise: 'Aplica cabeceras, límites, tokens, idempotencia y sanitización en el borde.',
    evidence: 'HTTP hardening + ingress controls',
    humanAction: 'Rotar secretos y auditar despliegues',
  },
  {
    id: 'evidence',
    name: 'Evidencia reproducible',
    domain: 'observability',
    status: 'wired',
    promise: 'Cada afirmación de capacidad puede enlazarse a ruta, métrica o ledger.',
    evidence: 'BookPI append-only + evidence manifests',
    humanAction: 'Adjuntar aprobación humana con nombre',
  },
  {
    id: 'recovery',
    name: 'Recuperación segura',
    domain: 'safety',
    status: 'ready',
    promise: 'Aísla proveedores lentos, usa cooldowns y mantiene una respuesta degradada honesta.',
    evidence: 'Provider cooldowns + readiness checks',
    humanAction: 'Ejercitar fallos en staging',
  },
  {
    id: 'community-contract',
    name: 'Contrato para la comunidad',
    domain: 'community',
    status: 'ready',
    promise: 'Publica límites, riesgos, latencia y estado draft/verified sin marketing engañoso.',
    evidence: 'This capability manifest is machine-readable',
    humanAction: 'Revisión humana antes de declarar verified',
  },
];

export function buildIsabellaCapabilityManifest(): {
  readonly contract: 'isabella.capabilities.v1';
  readonly state: 'draft';
  readonly generatedAt: string;
  readonly gifts: readonly IsabellaGift[];
  readonly counts: Readonly<Record<IsabellaGiftStatus, number>>;
} {
  const counts: Record<IsabellaGiftStatus, number> = { wired: 0, ready: 0, draft: 0 };
  for (const gift of ISABELLA_GIFTS) counts[gift.status] += 1;
  return {
    contract: 'isabella.capabilities.v1',
    state: 'draft',
    generatedAt: new Date().toISOString(),
    gifts: ISABELLA_GIFTS,
    counts,
  };
}

export function isIsabellaManifestComplete(): boolean {
  return (
    ISABELLA_GIFTS.length === 10 &&
    ISABELLA_GIFTS.every((gift) => gift.id && gift.promise && gift.evidence)
  );
}
