/**
 * Plataforma de resiliencia, privacidad, evidencia y civilización — treinta capacidades (state: draft | engine-generated).
 *
 * Cada módulo CALCULA o PROTEGE; ninguno autoriza ni ejecuta efectos externos por sí mismo.
 * CAPABILITY ≠ AUTHORITY ≠ EXECUTION ≠ EVIDENCE ≠ LEARNING ≠ PRODUCTION.
 */
export * from '../resilience/retry';
export * from '../resilience/bulkhead';
export * from '../ingress/webhook-inbox';
export * from '../health/preflight';
export * from '../privacy/pii-redactor';
export * from '../observability/slo';
export * from '../memory/bm25';
export * from '../governance/feature-flags';
export * from '../inference/cost-budget';
export * from '../bookpi/evidence-bundle';
export * from '../civilization/evidence-graph';
export * from '../memory/temporal-cognition';
export * from '../fabric/citemesh';
export * from '../economy/cognitive-capital-market';
export * from '../ihec/immune-system';
export * from '../core/cognitive-fabric-engine';
export * from '../governance/constitutional-governance-fabric';

export interface PlatformGift {
  readonly order: number;
  readonly id: string;
  readonly title: string;
  readonly file: string;
  readonly wired: string;
  readonly limits: string;
}

export const PLATFORM_GIFTS: readonly PlatformGift[] = Object.freeze([
  {
    order: 1,
    id: 'retry-backoff',
    title: 'Reintentos con backoff, jitter y deadline',
    file: 'src/resilience/retry.ts',
    wired: 'biblioteca (sin cablear)',
    limits: 'Reintentar operaciones no idempotentes es decisión del llamador.',
  },
  {
    order: 2,
    id: 'bulkhead',
    title: 'Bulkhead con cola acotada y load shedding',
    file: 'src/resilience/bulkhead.ts',
    wired: 'biblioteca (sin cablear)',
    limits: 'Métricas locales al proceso.',
  },
  {
    order: 3,
    id: 'webhook-inbox',
    title: 'Inbox de webhooks (dedupe + orden)',
    file: 'src/ingress/webhook-inbox.ts',
    wired: 'POST /api/v1/billing/stripe/webhook',
    limits: 'Memoria de proceso; varias instancias requieren almacén compartido.',
  },
  {
    order: 4,
    id: 'preflight',
    title: 'Preflight de configuración de producción',
    file: 'src/health/preflight.ts',
    wired: 'arranque (STRICT_PREFLIGHT=1) + GET /api/v1/ops/preflight',
    limits: 'No verifica alcance de red de dependencias.',
  },
  {
    order: 5,
    id: 'pii-redactor',
    title: 'Redactor de PII con CURP/RFC/CLABE validados',
    file: 'src/privacy/pii-redactor.ts',
    wired: 'biblioteca (sin cablear)',
    limits: 'Red de seguridad; no detecta nombres ni direcciones.',
  },
  {
    order: 6,
    id: 'slo-burn-rate',
    title: 'SLO y alertas por quema multi-ventana',
    file: 'src/observability/slo.ts',
    wired: 'biblioteca (sin cablear)',
    limits: 'Retención de 3 días; local al proceso.',
  },
  {
    order: 7,
    id: 'bm25-rrf',
    title: 'Recuperación léxica BM25 + RRF',
    file: 'src/memory/bm25.ts',
    wired: 'biblioteca (sin cablear)',
    limits: 'Léxico: sin semántica/embeddings.',
  },
  {
    order: 8,
    id: 'feature-flags',
    title: 'Feature flags deterministas con rollout y kill switch',
    file: 'src/governance/feature-flags.ts',
    wired: 'biblioteca (sin cablear)',
    limits: 'Una bandera configura exposición, no concede autoridad.',
  },
  {
    order: 9,
    id: 'cost-budget',
    title: 'Presupuesto de costo por tenant con reservas',
    file: 'src/inference/cost-budget.ts',
    wired: 'biblioteca (sin cablear)',
    limits: 'Memoria de proceso; μUSD enteros.',
  },
  {
    order: 10,
    id: 'evidence-bundle',
    title: 'Paquete de evidencia verificable offline',
    file: 'src/bookpi/evidence-bundle.ts',
    wired: 'biblioteca (sin cablear)',
    limits: 'Prueba integridad, no veracidad; sin RFC 3161/WORM.',
  },
  {
    order: 11,
    id: 'civilizational-evidence-graph',
    title: 'Grafo de Evidencia Civilizatoria (CEG)',
    file: 'src/civilization/evidence-graph.ts',
    wired: 'biblioteca (sin cablear)',
    limits: 'Append-only; prueba integridad, no veracidad de hechos.',
  },
  {
    order: 12,
    id: 'temporal-cognition',
    title: 'Cognición Temporal (YUN Ω)',
    file: 'src/memory/temporal-cognition.ts',
    wired: 'biblioteca (sin cablear)',
    limits: 'Versionado en memoria; sin persistencia distribuida.',
  },
  {
    order: 13,
    id: 'citemesh',
    title: 'CITEMESH — Sistema Nervioso Digital',
    file: 'src/fabric/citemesh.ts',
    wired: 'biblioteca (sin cablear)',
    limits: 'In-memory; federación real requiere NATS/Kafka.',
  },
  {
    order: 14,
    id: 'cognitive-capital-market',
    title: 'Mercado de Capital Cognitivo',
    file: 'src/economy/cognitive-capital-market.ts',
    wired: 'biblioteca (sin cablear)',
    limits: 'Sin liquidación real; activos en memoria.',
  },
  {
    order: 15,
    id: 'ihec-immune-system',
    title: 'Sistema Inmune Cognitivo (Ω-14)',
    file: 'src/ihec/immune-system.ts',
    wired: 'biblioteca (sin cablear)',
    limits: 'Anticuerpos en memoria; sin telemetría real.',
  },
  {
    order: 16,
    id: 'cognitive-fabric-engine',
    title: 'Motor de Tejido Cognitivo (CFE)',
    file: 'src/core/cognitive-fabric-engine.ts',
    wired: 'biblioteca (sin cablear)',
    limits: 'Compone meshes; no autoriza ni ejecuta.',
  },
  {
    order: 17,
    id: 'constitutional-governance-fabric',
    title: 'Tejido de Gobernanza Constitucional (CGF)',
    file: 'src/governance/constitutional-governance-fabric.ts',
    wired: 'biblioteca (sin cablear)',
    limits: 'Compone subsistemas; no ejecuta.',
  },
  {
    order: 18,
    id: 'crown-pdp',
    title: 'CROWN — Policy Decision Point',
    file: 'src/crown/capability.ts',
    wired: 'biblioteca (sin cablear)',
    limits: 'Decisión, no ejecución.',
  },
  {
    order: 19,
    id: 'gameover-uagp',
    title: 'GAME OVER — UAGP-1 Gobernanza',
    file: 'src/gameover/gateway.ts',
    wired: 'biblioteca (sin cablear)',
    limits: 'Gobierna, no ejecuta.',
  },
  {
    order: 20,
    id: 'bookpi-ledger',
    title: 'BookPI — Ledger de Evidencia',
    file: 'src/bookpi/ledger.ts',
    wired: 'biblioteca (sin cablear)',
    limits: 'Append-only; sin anclaje RFC 3161.',
  },
  {
    order: 21,
    id: 'terminus-retention',
    title: 'Terminus Ω — Retención y Erasure',
    file: 'src/terminus/retention.ts',
    wired: 'biblioteca (sin cablear)',
    limits: 'Política de retención local.',
  },
  {
    order: 22,
    id: 'omega-constitution',
    title: 'Omega — Constitución Civilizatoria',
    file: 'src/omega/constitution.ts',
    wired: 'biblioteca (sin cablear)',
    limits: 'Declarativa; requiere ejecución externa.',
  },
  {
    order: 23,
    id: 'ihec-emergency',
    title: 'IHEC — Hyper Emergency Core',
    file: 'src/ihec/ihec.ts',
    wired: 'biblioteca (sin cablear)',
    limits: 'Continuidad local al proceso.',
  },
  {
    order: 24,
    id: 'federation-registry',
    title: 'Federación — Registro Territorial',
    file: 'src/federation/registry.ts',
    wired: 'biblioteca (sin cablear)',
    limits: 'Sin transporte real de federación.',
  },
  {
    order: 25,
    id: 'economy-treasury',
    title: 'Economía — Treasury y Royalties',
    file: 'src/economy/treasury.ts',
    wired: 'biblioteca (sin cablear)',
    limits: 'Sin liquidación real.',
  },
  {
    order: 26,
    id: 'memory-ikes',
    title: 'Memoria — IKES Knowledge Store',
    file: 'src/memory/ikes.ts',
    wired: 'biblioteca (sin cablear)',
    limits: 'Almacenamiento local.',
  },
  {
    order: 27,
    id: 'governance-permission-map',
    title: 'Gobernanza — Mapa de Permisos',
    file: 'src/governance/permission-map.ts',
    wired: 'biblioteca (sin cablear)',
    limits: 'RBAC local.',
  },
  {
    order: 28,
    id: 'security-http-hardening',
    title: 'Seguridad — HTTP Hardening',
    file: 'src/security/http-hardening.ts',
    wired: 'middleware global',
    limits: 'Sin CSP/HSTS declarado.',
  },
  {
    order: 29,
    id: 'hypercore-engine',
    title: 'HyperCore — Motor de Optimización',
    file: 'src/hypercore/hypercore.ts',
    wired: 'biblioteca (sin cablear)',
    limits: 'Optimización local.',
  },
  {
    order: 30,
    id: 'isabella-engine',
    title: 'Isabella — Motor Cognitivo',
    file: 'src/isabella/library.ts',
    wired: 'biblioteca (sin cablear)',
    limits: 'Sin proveedor externo por defecto.',
  },
  {
    order: 31,
    id: 'monetization-engine',
    title: 'Motor de Monetización (planes, escrow, payouts, SCER)',
    file: 'src/economy/monetization-engine.ts',
    wired: 'GET/POST /api/v1/monetization/*',
    limits: 'Sin liquidación real; en memoria.',
  },
  {
    order: 32,
    id: 'dynamic-pricing',
    title: 'Pricing Dinámico (demanda, carga, valor)',
    file: 'src/economy/dynamic-pricing.ts',
    wired: 'POST /api/v1/pricing/dynamic',
    limits: 'Heurístico; requiere calibración.',
  },
]);
export * from '../economy/monetization-engine';
export * from '../economy/dynamic-pricing';
