/**
 * Isabella AI Library — especificación técnica modular de la librería Isabella AI.
 *
 * Catálogo declarativo de módulos, grupos de API, salvaguardas éticas y marcos de
 * cumplimiento. Honestidad técnica: el catálogo describe capacidades y sus
 * dependencias; no afirma que cada capacidad esté desplegada en producción.
 */

export const ISABELLA_MODULE_IDS = [
  "core-cognitive-emotional",
  "multimodal-sensory",
  "quantum-emotional-shield",
  "governance-affected-ledger",
  "curation-multiversal-narrative",
  "p2p-blockchain",
  "api-orchestration",
  "personalization-accessibility",
  "deployment-hardware",
] as const;

export type IsabellaModuleId = (typeof ISABELLA_MODULE_IDS)[number];

export interface IsabellaModule {
  id: IsabellaModuleId;
  name: string;
  description: string;
  capabilities: readonly string[];
  dependencies: readonly string[];
}

export const ISABELLA_MODULES: Readonly<Record<IsabellaModuleId, IsabellaModule>> = Object.freeze({
  "core-cognitive-emotional": {
    id: "core-cognitive-emotional",
    name: "Núcleo Cognitivo-Emocional (Isabella Core MD-X5)",
    description: "Motor central de procesamiento cognitivo y emocional, modulación afectiva y memoria adaptativa.",
    capabilities: [
      "Procesamiento de lenguaje natural multilingüe",
      "Análisis y modulación emocional en tiempo real",
      "Generación de narrativas y experiencias personalizadas",
      "Memoria contextual y aprendizaje incremental",
      "Integración con motores de curaduría y recomendación",
    ],
    dependencies: ["Llama 3.x", "Phi", "Chroma", "Ollama", "LangChain", "PyTorch", "HuggingFace Transformers", "Docker"],
  },
  "multimodal-sensory": {
    id: "multimodal-sensory",
    name: "Integración Sensorial Multimodal",
    description: "Adquisición, procesamiento y fusión de datos sensoriales (audio espacial, visual, hápticos, VR/AR).",
    capabilities: [
      "Procesamiento y fusión de entradas visuales",
      "Análisis y síntesis de audio espacial y visuales 4D",
      "Soporte para dispositivos hápticos y retroalimentación táctil",
      "Integración con frameworks de visión y audio",
      "Adaptación dinámica a perfiles sensoriales y necesidades especiales",
    ],
    dependencies: ["OpenCV", "PyAudio", "TensorFlow", "Unity", "Unreal Engine"],
  },
  "quantum-emotional-shield": {
    id: "quantum-emotional-shield",
    name: "Seguridad y Blindaje Cuántico-Emocional (DEKATEOTL System)",
    description: "Sistema multicapa de protección técnica, emocional y cultural con resiliencia cuántico-inspirada.",
    capabilities: [
      "Detección y neutralización de amenazas técnicas, psicológicas y culturales",
      "Orquestación dinámica de módulos de defensa",
      "Registro de eventos críticos (ledger afectivo)",
      "Filtros éticos y culturales en cada acción defensiva",
      "Resiliencia y autoevolución ante ataques y anomalías",
    ],
    dependencies: ["OpenSSL", "libsodium", "Ethereum", "Hyperledger"],
  },
  "governance-affected-ledger": {
    id: "governance-affected-ledger",
    name: "Gobernanza, Trazabilidad y Ledger Afectivo",
    description: "Gobernanza ética, trazabilidad de eventos y participación comunitaria auditables.",
    capabilities: [
      "Registro inmutable de eventos y decisiones críticas",
      "Auditoría y monitoreo en tiempo real",
      "Mecanismos de votación y participación comunitaria",
      "Integración con credenciales verificables y badges",
      "Adaptación a marcos regulatorios locales e internacionales",
    ],
    dependencies: ["Blockchain", "Chroma", "Qdrant", "DAO", "Smart contracts"],
  },
  "curation-multiversal-narrative": {
    id: "curation-multiversal-narrative",
    name: "Curaduría Digital y Narrativa Multiversal",
    description: "Selección y generación de contenidos y experiencias por criterios éticos, afectivos y culturales.",
    capabilities: [
      "Curaduría automática y manual de contenidos",
      "Generación de relatos y experiencias interactivas",
      "Integración con galerías digitales y sistemas de badges",
      "Personalización según identidad cultural y estado emocional",
    ],
    dependencies: ["LLMs", "Chroma", "LangChain", "Twine", "Ink"],
  },
  "p2p-blockchain": {
    id: "p2p-blockchain",
    name: "Integración P2P y Blockchain",
    description: "Comunicación, sincronización y colaboración entre instancias en redes peer-to-peer.",
    capabilities: [
      "Comunicación segura y descentralizada entre nodos",
      "Sincronización de estados y eventos críticos",
      "Soporte para aplicaciones descentralizadas",
      "Integración con micropréstamos y activos digitales",
    ],
    dependencies: ["libp2p", "WebRTC", "Ethereum", "Hyperledger"],
  },
  "api-orchestration": {
    id: "api-orchestration",
    name: "APIs y Orquestación",
    description: "Interfaces programáticas (REST, WebSocket, gRPC) y despliegue automatizado.",
    capabilities: [
      "Exposición de APIs RESTful y WebSocket",
      "Orquestación de módulos y servicios",
      "Despliegue automatizado con Docker Compose y Kubernetes",
      "Integración con frameworks de automatización",
    ],
    dependencies: ["FastAPI", "Express.js", "gRPC", "Docker", "Kubernetes", "GitHub Actions"],
  },
  "personalization-accessibility": {
    id: "personalization-accessibility",
    name: "Personalización, Inclusión y Accesibilidad",
    description: "Adaptación de la experiencia a perfiles diversos, necesidades especiales y contextos culturales.",
    capabilities: [
      "Personalización de interfaces y flujos según perfil",
      "Soporte de accesibilidad (lectores de pantalla, subtítulos)",
      "Adaptación a idiomas, dialectos y contextos culturales",
      "Mecanismos de feedback y mejora continua",
    ],
    dependencies: ["ARIA", "WCAG", "APIs de traducción y localización"],
  },
  "deployment-hardware": {
    id: "deployment-hardware",
    name: "Despliegue y Hardware",
    description: "Gestión de hardware, dispositivos edge, VR/AR, hápticos y optimización en recursos limitados.",
    capabilities: [
      "Detección y gestión de recursos hardware",
      "Soporte para dispositivos edge, VR/AR y hápticos",
      "Optimización para ejecución offline y hardware limitado",
      "Monitorización de rendimiento y consumo energético",
    ],
    dependencies: ["Prometheus", "Grafana"],
  },
});

export interface IsabellaApiGroup {
  id: string;
  name: string;
  endpoints: readonly string[];
}

export const ISABELLA_API_GROUPS: readonly IsabellaApiGroup[] = Object.freeze([
  { id: "cognitive-emotional", name: "Procesamiento Cognitivo-Emocional", endpoints: ["/nlp/process", "/emotion/modulate", "/memory/context"] },
  { id: "sensory-multimodal", name: "Sensorial Multimodal", endpoints: ["/sensor/visual", "/sensor/audio", "/sensor/haptic", "/sensor/vrar"] },
  { id: "security-ledger", name: "Seguridad y Ledger", endpoints: ["/security/event", "/security/ledger", "/security/audit"] },
  { id: "governance-participation", name: "Gobernanza y Participación", endpoints: ["/governance/vote", "/governance/badge", "/governance/audit"] },
  { id: "curation-narrative", name: "Curaduría y Narrativa", endpoints: ["/curation/content", "/narrative/generate", "/gallery/manage"] },
  { id: "p2p-blockchain", name: "P2P y Blockchain", endpoints: ["/p2p/connect", "/p2p/sync", "/blockchain/tx"] },
  { id: "orchestration-deploy", name: "Orquestación y Despliegue", endpoints: ["/orchestrate/module", "/deploy/status", "/automation/trigger"] },
  { id: "personalization-accessibility", name: "Personalización y Accesibilidad", endpoints: ["/profile/customize", "/accessibility/settings", "/feedback/submit"] },
]);

export const ETHICAL_SAFEGUARDS = [
  "etica_por_diseno",
  "transparencia_y_explicabilidad",
  "consentimiento_informado",
  "no_discriminacion_y_equidad",
  "supervision_humana",
] as const;

export type EthicalSafeguard = (typeof ETHICAL_SAFEGUARDS)[number];

export const COMPLIANCE_FRAMEWORKS = [
  "UNESCO_AI_ETHICS",
  "EU_AI_ACT",
  "OECD_AI_PRINCIPLES",
  "LFPDPPP_MEXICO",
] as const;

export type ComplianceFramework = (typeof COMPLIANCE_FRAMEWORKS)[number];

export interface ModuleAudit {
  module: IsabellaModuleId;
  /** El módulo declara explícitamente que no es certificación de producción. */
  declaresLimits: boolean;
  safeguards: readonly EthicalSafeguard[];
  frameworks: readonly ComplianceFramework[];
}

/**
 * Audita un módulo del catálogo: confirma que declara límites y referencia
 * salvaguardas éticas y marcos de cumplimiento. No certifica cumplimiento real;
 * solo verifica que la declaración existe (honestidad técnica).
 */
export function auditIsabellaModule(module: IsabellaModuleId): ModuleAudit {
  const descriptor = ISABELLA_MODULES[module];
  return {
    module,
    declaresLimits: descriptor.dependencies.length > 0 && descriptor.capabilities.length > 0,
    safeguards: ETHICAL_SAFEGUARDS,
    frameworks: COMPLIANCE_FRAMEWORKS,
  };
}

export function listIsabellaModules(): readonly IsabellaModule[] {
  return ISABELLA_MODULE_IDS.map((id) => ISABELLA_MODULES[id]);
}