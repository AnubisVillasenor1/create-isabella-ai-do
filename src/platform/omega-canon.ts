/**
 * Canon Génesis Ω∞ — registro de doctrina y trazabilidad (state: implemented | tested).
 *
 * El canon describe una arquitectura objetivo. Este registro no la convierte en
 * producción: cada entrada declara su madurez y la evidencia localizada en el
 * repositorio. Una capacidad sin código se marca como `specified`.
 *
 * SPECIFIED ≠ IMPLEMENTED ≠ TESTED ≠ PRODUCTION.
 * CAPABILITY ≠ AUTHORITY ≠ EXECUTION ≠ EVIDENCE ≠ LEARNING ≠ PRODUCTION.
 */

export type CanonMaturity = 'verified' | 'implemented' | 'partial' | 'specified';

export const CANON_MATURITY_DEFINITIONS: Readonly<Record<CanonMaturity, string>> = Object.freeze({
  verified: 'Código localizado y al menos una prueba automatizada que lo ejerce.',
  implemented:
    'Código localizado; no implica que esté cableado a una ruta ni cubierto por pruebas específicas.',
  partial: 'Sólo una parte del contrato canónico está representada en código.',
  specified:
    'Doctrina, objetivo o interfaz declarada sin implementación localizada en este repositorio.',
});

export interface CanonMetadata {
  readonly officialName: string;
  readonly code: string;
  readonly classification: string;
  readonly generation: string;
  readonly status: string;
  readonly strategicDomain: string;
  readonly paradigm: string;
  readonly architecturalLevel: string;
  readonly category: string;
  readonly asOf: string;
  readonly productionClaim: false;
}

export interface CanonPillar {
  readonly id: string;
  readonly title: string;
  readonly mandate: string;
}

export interface CanonLayer {
  readonly id: string;
  readonly title: string;
  readonly maturity: CanonMaturity;
  readonly evidence: readonly string[];
  readonly note?: string;
}

export interface CanonImplementation {
  readonly id: string;
  readonly order: number;
  readonly title: string;
  readonly summary: string;
  readonly maturity: CanonMaturity;
  readonly evidence: readonly string[];
  readonly note?: string;
}

export interface CanonMemoryTier {
  readonly id: string;
  readonly title: string;
  readonly scope: string;
  readonly maturity: CanonMaturity;
  readonly evidence: readonly string[];
  readonly note?: string;
}

export interface CanonCrownLevel {
  readonly level: number;
  readonly name: string;
  readonly mandate: string;
}

export interface CanonAgent {
  readonly id: string;
  readonly role: string;
  readonly mandate: string;
}

export interface CanonFederation {
  readonly id: string;
  readonly name: string;
  readonly domain: string;
}

export interface CanonSecurityLayer {
  readonly id: string;
  readonly title: string;
  readonly maturity: CanonMaturity;
  readonly evidence: readonly string[];
  readonly note?: string;
}

export interface CanonFoundationGeneration {
  readonly generation: number;
  readonly parameters: string;
  readonly architecture: string;
  readonly context: string;
  readonly experts: number | null;
  readonly activeExperts: number | null;
  readonly multimodal: string | null;
  readonly maturity: 'specified';
}

export const OMEGA_CANON: CanonMetadata = Object.freeze({
  officialName: 'Isabella Villaseñor AI Génesis Ω∞',
  code: 'ISABELLA-OMEGA-INFINITY-GENESIS-FOUNDATION-MODEL',
  classification: 'Sistema Cognitivo Soberano Multimodal Federado',
  generation: 'Genesis Ω∞',
  status: 'Marco Fundacional Canónico',
  strategicDomain: 'Infraestructura Cognitiva Universal',
  paradigm: 'Post-LLM Cognitive Sovereign Systems',
  architecturalLevel: 'Strategic Core Infrastructure',
  category: 'CSS · Cognitive Sovereign System',
  asOf: '2026-10-25',
  productionClaim: false,
});

export const OMEGA_INVARIANT = 'SPECIFIED ≠ IMPLEMENTED ≠ TESTED ≠ PRODUCTION' as const;

export const OMEGA_PILLARS: readonly CanonPillar[] = Object.freeze([
  {
    id: 'Ω-01',
    title: 'Soberanía Cognitiva',
    mandate:
      'Operación local y distribuida, trazabilidad, auditabilidad, modularidad, resiliencia e independencia tecnológica.',
  },
  {
    id: 'Ω-02',
    title: 'Inteligencia Distribuida',
    mandate:
      'La inteligencia reside en el modelo, la memoria, los agentes, las herramientas, la gobernanza, el conocimiento y las federaciones.',
  },
  {
    id: 'Ω-03',
    title: 'Gobernanza Verificable',
    mandate: 'Toda decisión debe ser explicable, trazable, auditable, versionable y reproducible.',
  },
  {
    id: 'Ω-04',
    title: 'Memoria Permanente',
    mandate:
      'El conocimiento debe sobrevivir fallos, actualizaciones, migraciones, reentrenamientos y cambios de infraestructura.',
  },
  {
    id: 'Ω-05',
    title: 'Aprendizaje Continuo',
    mandate:
      'Modelos, agentes, memorias, enrutadores y sistemas de decisión deben ser entrenables.',
  },
  {
    id: 'Ω-06',
    title: 'Seguridad Adaptativa',
    mandate: 'La seguridad es contextual, predictiva, cognitiva y distribuida; no sólo perimetral.',
  },
  {
    id: 'Ω-07',
    title: 'Evolución Permanente',
    mandate: 'Todo componente debe poder evolucionar sin rediseñar el ecosistema completo.',
  },
]);

export const OMEGA_ARCHITECTURE: readonly CanonLayer[] = Object.freeze([
  {
    id: 'cognitive-governance-crown',
    title: 'Cognitive Governance Crown',
    maturity: 'verified',
    evidence: ['src/governance/verifier.ts', 'test/governance/cognitive-governance-layer.test.ts'],
  },
  {
    id: 'omega-foundation-model',
    title: 'Omega Foundation Model',
    maturity: 'partial',
    evidence: ['src/cognition/genesis-moe.ts', 'src/cognition/native-comprehension.ts'],
    note: 'Hay motores nativos y un MoE gobernado; no hay pesos de 20B–500B ni un modelo fundacional entrenado.',
  },
  {
    id: 'hyperrouter-moe',
    title: 'HyperRouter MoE',
    maturity: 'implemented',
    evidence: ['src/cognition/HyperRouterMoE.ts'],
  },
  {
    id: 'memory-mesh',
    title: 'Memory Mesh',
    maturity: 'implemented',
    evidence: [
      'src/memory/executive-tactical-memory.ts',
      'src/memory/ikes.ts',
      'src/memory/session-memory.ts',
    ],
  },
  {
    id: 'quantum-rag',
    title: 'Quantum-RAG',
    maturity: 'partial',
    evidence: ['src/cognition/rag/quantum-rag.ts'],
    note: 'Pipeline experimental fuera del typecheck principal; no implica QPU ni aceleración cuántica.',
  },
  {
    id: 'knowledge-graph',
    title: 'Knowledge Graph',
    maturity: 'partial',
    evidence: ['src/civilization/evidence-graph.ts'],
    note: 'Grafo de evidencia append-only; no es una base de conocimiento ontológica completa.',
  },
  {
    id: 'multi-agent-runtime',
    title: 'Multi-Agent Runtime',
    maturity: 'implemented',
    evidence: ['src/agents/runtime.ts'],
  },
  {
    id: 'security-core',
    title: 'Security Core',
    maturity: 'verified',
    evidence: [
      'src/security/zero-trust/zero-trust-core.ts',
      'test/security/zero-trust-core.test.ts',
    ],
  },
  {
    id: 'hyper-core-turbo',
    title: 'Hyper Core Turbo',
    maturity: 'verified',
    evidence: [
      'src/hypercore/turbo-optimizer.ts',
      'src/performance/hypercore-turbo.ts',
      'test/hypercore/turbo-optimizer.test.ts',
    ],
  },
  {
    id: 'economic-governance',
    title: 'Economic Governance',
    maturity: 'implemented',
    evidence: ['src/economy/monetization-engine.ts', 'src/economy/sovereign-revenue-fabric.ts'],
    note: 'Contabilidad y cotización; no liquidación real ni transferencia de fondos.',
  },
  {
    id: 'music-genesis',
    title: 'Music Genesis',
    maturity: 'specified',
    evidence: [],
    note: 'No existe un módulo de composición, stems, mezcla o publicación musical en este repositorio.',
  },
  {
    id: 'open-science-fabric',
    title: 'Open Science Fabric',
    maturity: 'partial',
    evidence: ['src/omega/research.ts'],
    note: 'Ciclo de investigación local; no hay conectores ORCID, Zenodo, CrossRef ni DOI automáticos.',
  },
  {
    id: 'federation-fabric',
    title: 'Federation Fabric',
    maturity: 'partial',
    evidence: ['src/federation/registry.ts', 'src/federation/tamv/tamv-federated-runtime.ts'],
    note: 'Registro y runtime experimental; no hay federación desplegada ni consenso entre nodos reales.',
  },
  {
    id: 'observability-fabric',
    title: 'Observability Fabric',
    maturity: 'implemented',
    evidence: ['src/deployment/latency-metrics.ts', 'src/observability/metrics.ts'],
  },
]);

export const OMEGA_IMPLEMENTATIONS: readonly CanonImplementation[] = Object.freeze([
  {
    id: 'ΩX-01',
    order: 1,
    title: 'NeuroSymbolic Reasoning Layer',
    summary:
      'Reglas seguras, lógica de policy y comprobación de contradicciones junto al razonamiento del modelo.',
    maturity: 'partial',
    evidence: [
      'src/governance/cognitive/cognitive-governance.ts',
      'src/cognition/contradiction.ts',
    ],
    note: 'No hay un motor neuro-simbólico completo que unifique pesos y lógica formal.',
  },
  {
    id: 'ΩX-02',
    order: 2,
    title: 'Self-Reflection Engine',
    summary: 'Evaluación epistémica y explicabilidad posteriores a una respuesta.',
    maturity: 'partial',
    evidence: ['src/cognition/epistemic-evaluator.ts', 'src/cognition/explainability.ts'],
    note: 'La evaluación ocurre después de generar; no reescribe la respuesta antes de emitirla.',
  },
  {
    id: 'ΩX-03',
    order: 3,
    title: 'Meta-Planning Core',
    summary: 'Planificación determinista de rutas y compilación de contexto antes de la ejecución.',
    maturity: 'implemented',
    evidence: ['src/intelligence/turbo-planner.ts', 'src/hypercore/context-compiler.ts'],
  },
  {
    id: 'ΩX-04',
    order: 4,
    title: 'Dynamic Chain Optimizer',
    summary: 'Selección adaptativa de ruta cognitiva y composición de la cadena de proveedores.',
    maturity: 'implemented',
    evidence: ['src/intelligence/adaptive-router.ts', 'src/cognition/orchestrator.ts'],
  },
  {
    id: 'ΩX-05',
    order: 5,
    title: 'Predictive Context Engine',
    summary: 'Compilación de contexto y anticipación de la siguiente operación local.',
    maturity: 'implemented',
    evidence: ['src/hypercore/context-compiler.ts', 'src/hypercore/hyperpredict.ts'],
    note: 'Anticipa rutas y contexto local; no predice tokens de un proveedor externo.',
  },
  {
    id: 'ΩX-06',
    order: 6,
    title: 'Hierarchical Memory Compression',
    summary: 'Versionado temporal y presupuesto de contexto con resumen extractivo.',
    maturity: 'partial',
    evidence: ['src/memory/temporal-cognition.ts', 'src/memory/session-memory.ts'],
    note: 'No existe compresión jerárquica multinivel con consolidación automática.',
  },
  {
    id: 'ΩX-07',
    order: 7,
    title: 'Multi-Layer Semantic Cache',
    summary: 'Caché gobernada con TTL, LRU, single-flight y revalidación en segundo plano.',
    maturity: 'verified',
    evidence: [
      'src/hypercore/governed-semantic-cache.ts',
      'test/hypercore/governed-semantic-cache.test.ts',
    ],
  },
  {
    id: 'ΩX-08',
    order: 8,
    title: 'Adaptive Token Routing',
    summary: 'Router MoE top-k y fragmentación por intención en el runtime nativo.',
    maturity: 'partial',
    evidence: ['src/cognition/HyperRouterMoE.ts', 'src/cognition/genesis-chunk.ts'],
    note: 'Enruta intenciones y fragmentos; no enruta token por token hacia expertos neuronales.',
  },
  {
    id: 'ΩX-09',
    order: 9,
    title: 'Micro-Batching Fabric',
    summary: 'Agrupación de inferencias para maximizar throughput.',
    maturity: 'specified',
    evidence: [],
    note: 'No hay un planificador de micro-batches en el runtime actual.',
  },
  {
    id: 'ΩX-10',
    order: 10,
    title: 'Predictive Tool Invocation',
    summary: 'Predicción de la siguiente herramienta y preparación de su ruta en el agente local.',
    maturity: 'partial',
    evidence: ['src/hypercore/hyperpredict.ts', 'src/agents/runtime.ts'],
    note: 'La predicción no ejecuta herramientas ni evita la aprobación administrativa.',
  },
  {
    id: 'ΩX-11',
    order: 11,
    title: 'Cognitive Load Balancer',
    summary: 'Presupuesto de energía, bulkhead y compuerta de concurrencia para cargas locales.',
    maturity: 'partial',
    evidence: ['src/hypercore/energy.ts', 'src/resilience/bulkhead.ts'],
  },
  {
    id: 'ΩX-12',
    order: 12,
    title: 'Federated Knowledge Synchronization',
    summary: 'Registro federado y runtime experimental de sincronización entre nodos.',
    maturity: 'partial',
    evidence: ['src/federation/registry.ts', 'src/learning/federated/federated-learning.ts'],
    note: 'Las piezas distribuidas están fuera del typecheck principal; no hay federación operando entre procesos.',
  },
  {
    id: 'ΩX-13',
    order: 13,
    title: 'Real-Time Vector Streaming',
    summary: 'Índice vectorial local y recuperación semántica en proceso.',
    maturity: 'partial',
    evidence: ['src/memory/vector.ts'],
    note: 'La actualización es por operación; no hay stream continuo de embeddings.',
  },
  {
    id: 'ΩX-14',
    order: 14,
    title: 'Memory Importance Scoring',
    summary: 'Puntaje de cobertura y densidad para conocimiento verificado.',
    maturity: 'partial',
    evidence: ['src/memory/verified-knowledge.ts'],
    note: 'Puntúa conocimiento verificado; no es una política general de importancia para toda la memoria.',
  },
  {
    id: 'ΩX-15',
    order: 15,
    title: 'Autonomous Knowledge Distillation',
    summary: 'Condensación inteligente de conocimiento.',
    maturity: 'specified',
    evidence: [],
    note: 'No hay destilación automática de modelos ni de conocimiento en el repositorio.',
  },
  {
    id: 'ΩX-16',
    order: 16,
    title: 'Context Resurrection Engine',
    summary: 'Recuperación de versiones y contexto histórico de una sesión.',
    maturity: 'partial',
    evidence: ['src/memory/temporal-cognition.ts', 'src/memory/session-memory.ts'],
    note: 'Permite versionado y rollback; no reconstruye contexto distribuido entre sesiones.',
  },
  {
    id: 'ΩX-17',
    order: 17,
    title: 'Distributed KV Fabric',
    summary: 'KV cache distribuida entre nodos.',
    maturity: 'specified',
    evidence: [],
    note: 'La caché actual es local al proceso.',
  },
  {
    id: 'ΩX-18',
    order: 18,
    title: 'Security Behavioral Analysis',
    summary: 'Análisis conductual y evaluación de riesgo en el núcleo zero-trust.',
    maturity: 'implemented',
    evidence: ['src/security/zero-trust/zero-trust-core.ts'],
    note: 'Se evalúa en proceso; no hay un modelo conductual entrenado con telemetría real.',
  },
  {
    id: 'ΩX-19',
    order: 19,
    title: 'Adaptive Threat Intelligence',
    summary: 'Indicadores de amenaza, superficie AEGIS y reglas de vigilancia.',
    maturity: 'partial',
    evidence: ['src/security/vigia.ts', 'src/security/aegis.ts'],
    note: 'No hay suscripción a feeds externos ni correlación entre nodos.',
  },
  {
    id: 'ΩX-20',
    order: 20,
    title: 'Post-Quantum Readiness Layer',
    summary: 'Contrato fail-closed para ML-KEM/ML-DSA/SLH-DSA y firma clásica Ed25519.',
    maturity: 'partial',
    evidence: ['src/security/post-quantum.ts', 'test/security/post-quantum.test.ts'],
    note: 'No existe backend post-cuántico; el sistema falla cerrado y no simula firmas.',
  },
  {
    id: 'ΩX-21',
    order: 21,
    title: 'Autonomous Governance Validator',
    summary:
      'Validación de políticas, evidencia y compuertas de calidad antes de admitir una operación.',
    maturity: 'verified',
    evidence: [
      'src/governance/verifier.ts',
      'src/governance/quality-gates.ts',
      'test/governance/cognitive-governance-layer.test.ts',
    ],
    note: 'Valida admisibilidad y evidencia local; no certifica veracidad ni decide por una persona.',
  },
  {
    id: 'ΩX-22',
    order: 22,
    title: 'Research Orchestration Fabric',
    summary: 'Ciclo local de hipótesis, evaluación y síntesis de investigación.',
    maturity: 'implemented',
    evidence: ['src/omega/research.ts'],
    note: 'No automatiza publicación, revisión por pares ni registro DOI.',
  },
  {
    id: 'ΩX-23',
    order: 23,
    title: 'Cognitive Quality Assurance',
    summary: 'Compuertas de calidad con puntajes, umbrales y verificaciones críticas.',
    maturity: 'verified',
    evidence: ['src/governance/quality-gates.ts', 'test/governance/quality-gates.test.ts'],
  },
  {
    id: 'ΩX-24',
    order: 24,
    title: 'Latency Elimination Framework',
    summary:
      'Fast lane, memoización, caché y presupuesto de contexto para eliminar trabajo evitable.',
    maturity: 'verified',
    evidence: [
      'src/hypercore/turbo-optimizer.ts',
      'src/performance/hypercore-turbo.ts',
      'test/hypercore/turbo-optimizer.test.ts',
    ],
    note: 'Reduce latencia local; no promete aceleración del proveedor externo.',
  },
  {
    id: 'ΩX-25',
    order: 25,
    title: 'Hyper Evolution Engine',
    summary: 'Ciclo de propuestas, evaluación y evolución del ecosistema con evidencia local.',
    maturity: 'implemented',
    evidence: ['src/evolution/engine.ts', 'src/evolution/hypercore.ts'],
    note: 'Evoluciona artefactos bajo gobernanza; no se auto-despliega a producción.',
  },
  {
    id: 'ΩX-26',
    order: 26,
    title: 'TAMV Kaos Audio System',
    summary:
      'Análisis espectral nativo (FFT/Welch/transitorios/mono-suma), presets de fábrica, preset adaptativo y plan de redefinición, servido por /api/v1/tamv.',
    maturity: 'verified',
    evidence: [
      'src/tamv/dsp.ts',
      'src/tamv/engine.ts',
      'src/routes/tamv.ts',
      'test/tamv/dsp.test.ts',
      'test/routes/tamv.test.ts',
    ],
    note: 'Analiza y planifica; no sintetiza voz ni renderiza audio — el render sigue sin ejecutar.',
  },
]);

export const OMEGA_MEMORY_TIERS: readonly CanonMemoryTier[] = Object.freeze([
  {
    id: 'stm',
    title: 'STM · Short Term Memory',
    scope: 'Sesión, conversación y estado temporal.',
    maturity: 'verified',
    evidence: ['src/memory/session-memory.ts', 'test/memory/session-memory.test.ts'],
  },
  {
    id: 'ltm',
    title: 'LTM · Long Term Memory',
    scope: 'Documentos, conocimiento verificado y evidencia.',
    maturity: 'verified',
    evidence: ['src/memory/ikes.ts', 'test/memory/ikes-persistence.test.ts'],
  },
  {
    id: 'etm',
    title: 'ETM · Executive Tactical Memory',
    scope: 'Metas, planes, decisiones y prioridades con cadena de hashes.',
    maturity: 'verified',
    evidence: [
      'src/memory/executive-tactical-memory.ts',
      'test/memory/executive-tactical-memory.test.ts',
    ],
    note: 'Memoria táctica acotada; no muta la memoria canónica ni concede autoridad.',
  },
  {
    id: 'institutional',
    title: 'Institutional Memory',
    scope: 'Políticas, normativas y procedimientos.',
    maturity: 'implemented',
    evidence: ['src/omega/constitution.ts'],
    note: 'Constitución declarativa; no sustituye un archivo institucional distribuido.',
  },
]);

export const CROWN_LEVELS: readonly CanonCrownLevel[] = Object.freeze([
  {
    level: 1,
    name: 'Seguridad',
    mandate: 'Identidad, dispositivo, ejecución y superficie de ataque.',
  },
  { level: 2, name: 'Cumplimiento', mandate: 'Políticas, obligaciones y controles aplicables.' },
  { level: 3, name: 'Auditoría', mandate: 'Trazabilidad, evidencia e integridad del registro.' },
  { level: 4, name: 'Ética', mandate: 'Salvaguardas, dignidad y revisión de impacto.' },
  { level: 5, name: 'Gobernanza', mandate: 'Decisiones, autoridad y separación de poderes.' },
  { level: 6, name: 'Estrategia', mandate: 'Prioridades, presupuesto y rumbo del ecosistema.' },
  {
    level: 7,
    name: 'Supervisión Cognitiva',
    mandate: 'Calidad, coherencia y límites del razonamiento.',
  },
]);

export const OMEGA_AGENT_ROSTER: readonly CanonAgent[] = Object.freeze([
  { id: 'architect', role: 'ARCHITECT', mandate: 'Diseñar la estructura y sus invariantes.' },
  { id: 'engineer', role: 'ENGINEER', mandate: 'Construir y mantener la implementación.' },
  { id: 'scientist', role: 'SCIENTIST', mandate: 'Formular y contrastar hipótesis.' },
  { id: 'researcher', role: 'RESEARCHER', mandate: 'Recuperar, sintetizar y citar conocimiento.' },
  { id: 'security', role: 'SECURITY', mandate: 'Evaluar riesgo, amenaza y superficie de ataque.' },
  { id: 'legal', role: 'LEGAL', mandate: 'Revisar obligaciones y derechos aplicables.' },
  { id: 'auditor', role: 'AUDITOR', mandate: 'Verificar evidencia, integridad y cumplimiento.' },
  { id: 'finance', role: 'FINANCE', mandate: 'Modelar costos, ingresos y conciliación.' },
  { id: 'educator', role: 'EDUCATOR', mandate: 'Explicar con precisión y accesibilidad.' },
  { id: 'musician', role: 'MUSICIAN', mandate: 'Componer, arreglar y producir música.' },
  { id: 'operator', role: 'OPERATOR', mandate: 'Ejecutar operaciones gobernadas y reversibles.' },
  { id: 'strategist', role: 'STRATEGIST', mandate: 'Priorizar objetivos y asignar recursos.' },
]);

export const OMEGA_FEDERATIONS: readonly CanonFederation[] = Object.freeze([
  { id: 'alpha', name: 'Federation Alpha', domain: 'Inferencia' },
  { id: 'beta', name: 'Federation Beta', domain: 'Memoria' },
  { id: 'gamma', name: 'Federation Gamma', domain: 'Investigación' },
  { id: 'delta', name: 'Federation Delta', domain: 'Aprendizaje' },
  { id: 'epsilon', name: 'Federation Epsilon', domain: 'Herramientas' },
  { id: 'zeta', name: 'Federation Zeta', domain: 'Seguridad' },
  { id: 'eta', name: 'Federation Eta', domain: 'Economía' },
  { id: 'theta', name: 'Federation Theta', domain: 'Música' },
  { id: 'omega', name: 'Federation Omega', domain: 'Gobernanza' },
]);

export const OMEGA_SECURITY_LAYERS: readonly CanonSecurityLayer[] = Object.freeze([
  {
    id: 'identity-trust',
    title: 'Identity Trust',
    maturity: 'verified',
    evidence: [
      'src/security/zero-trust/zero-trust-core.ts',
      'test/security/zero-trust-core.test.ts',
    ],
  },
  {
    id: 'device-trust',
    title: 'Device Trust',
    maturity: 'verified',
    evidence: [
      'src/security/zero-trust/zero-trust-core.ts',
      'test/security/zero-trust-core.test.ts',
    ],
    note: 'Retos de un solo uso y verificación de atestación; no certifica hardware externo.',
  },
  {
    id: 'behavior-trust',
    title: 'Behavior Trust',
    maturity: 'implemented',
    evidence: ['src/security/zero-trust/zero-trust-core.ts'],
  },
  {
    id: 'execution-trust',
    title: 'Execution Trust',
    maturity: 'implemented',
    evidence: ['src/security/zero-trust/zero-trust-core.ts'],
    note: 'El sandbox falla cerrado si no hay backend real de ejecución.',
  },
  {
    id: 'memory-trust',
    title: 'Memory Trust',
    maturity: 'partial',
    evidence: ['src/memory/provenance.ts', 'src/memory/verified-knowledge.ts'],
  },
  {
    id: 'agent-trust',
    title: 'Agent Trust',
    maturity: 'partial',
    evidence: ['src/agents/runtime.ts', 'src/skills/crown-policy.ts'],
  },
  {
    id: 'infrastructure-trust',
    title: 'Infrastructure Trust',
    maturity: 'partial',
    evidence: ['src/deployment/production-ops.ts', 'src/security/http-hardening.ts'],
  },
]);

export const OMEGA_FOUNDATION_GENERATIONS: readonly CanonFoundationGeneration[] = Object.freeze([
  {
    generation: 1,
    parameters: '20B–70B',
    architecture: 'decoder-transformer',
    context: '256k',
    experts: null,
    activeExperts: null,
    multimodal: null,
    maturity: 'specified',
  },
  {
    generation: 2,
    parameters: '120B–250B',
    architecture: 'sparse-moe',
    context: '256k',
    experts: 64,
    activeExperts: 8,
    multimodal: null,
    maturity: 'specified',
  },
  {
    generation: 3,
    parameters: '500B+',
    architecture: 'sparse-moe',
    context: '1,000,000+',
    experts: 64,
    activeExperts: 8,
    multimodal: 'native',
    maturity: 'specified',
  },
]);

export const OMEGA_CANON_DISCLAIMERS: readonly string[] = Object.freeze([
  'El canon es doctrina: no concede autoridad, no ejecuta y no certifica producción.',
  '`verified` significa código y prueba automatizada localizados en este repositorio; no es certificación externa.',
  'Las tres generaciones del Foundation Model son objetivos declarados; este repositorio no contiene esos pesos.',
  'El roster de 12 agentes y las 9 federaciones son objetivos arquitectónicos, no procesos autónomos desplegados.',
  OMEGA_INVARIANT,
]);

export interface OmegaCanonCounts {
  readonly pillars: number;
  readonly architectureLayers: number;
  readonly implementations: number;
  readonly memoryTiers: number;
  readonly crownLevels: number;
  readonly agents: number;
  readonly federations: number;
  readonly securityLayers: number;
  readonly foundationGenerations: number;
}

export interface OmegaCanonPayload {
  readonly contract: 'omega-canon/1.0.0';
  readonly canonical: CanonMetadata;
  readonly invariant: typeof OMEGA_INVARIANT;
  readonly maturityDefinitions: Readonly<Record<CanonMaturity, string>>;
  readonly counts: OmegaCanonCounts;
  readonly maturity: Readonly<Record<CanonMaturity, number>>;
  readonly pillars: readonly CanonPillar[];
  readonly architecture: readonly CanonLayer[];
  readonly implementations: readonly CanonImplementation[];
  readonly memoryTiers: readonly CanonMemoryTier[];
  readonly crownLevels: readonly CanonCrownLevel[];
  readonly agentRoster: readonly CanonAgent[];
  readonly federations: readonly CanonFederation[];
  readonly securityLayers: readonly CanonSecurityLayer[];
  readonly foundationGenerations: readonly CanonFoundationGeneration[];
  readonly disclaimers: readonly string[];
}

export function buildOmegaCanonPayload(): OmegaCanonPayload {
  const maturity: Record<CanonMaturity, number> = {
    verified: 0,
    implemented: 0,
    partial: 0,
    specified: 0,
  };
  for (const implementation of OMEGA_IMPLEMENTATIONS) maturity[implementation.maturity] += 1;

  return {
    contract: 'omega-canon/1.0.0',
    canonical: OMEGA_CANON,
    invariant: OMEGA_INVARIANT,
    maturityDefinitions: CANON_MATURITY_DEFINITIONS,
    counts: {
      pillars: OMEGA_PILLARS.length,
      architectureLayers: OMEGA_ARCHITECTURE.length,
      implementations: OMEGA_IMPLEMENTATIONS.length,
      memoryTiers: OMEGA_MEMORY_TIERS.length,
      crownLevels: CROWN_LEVELS.length,
      agents: OMEGA_AGENT_ROSTER.length,
      federations: OMEGA_FEDERATIONS.length,
      securityLayers: OMEGA_SECURITY_LAYERS.length,
      foundationGenerations: OMEGA_FOUNDATION_GENERATIONS.length,
    },
    maturity,
    pillars: OMEGA_PILLARS,
    architecture: OMEGA_ARCHITECTURE,
    implementations: OMEGA_IMPLEMENTATIONS,
    memoryTiers: OMEGA_MEMORY_TIERS,
    crownLevels: CROWN_LEVELS,
    agentRoster: OMEGA_AGENT_ROSTER,
    federations: OMEGA_FEDERATIONS,
    securityLayers: OMEGA_SECURITY_LAYERS,
    foundationGenerations: OMEGA_FOUNDATION_GENERATIONS,
    disclaimers: OMEGA_CANON_DISCLAIMERS,
  };
}
