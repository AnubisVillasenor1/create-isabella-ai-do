/**
 * ISABELLA SOVEREIGN MONETIZATION FABRIC (ISMF) — 25 NATIVE METHODS
 * ================================================================
 * Integración nativa de los 25 métodos de monetización web más innovadores
 * en la arquitectura de 4 planos (Experiencia, Cognitivo, Gobernanza, Infraestructura)
 * de Isabella AI Genesis.
 *
 * Regla Canónica C.R.O.W.N. / ARGUS:
 * - Acceso exclusivo para perfiles con suscripción mensual activa.
 * - Reparto estricto: 75% Creador / 25% Plataforma liquidado en BookPI WORM Ledger.
 */

import { PrincipalContext } from "./x402-connector";

export type MonetizationCategory =
  | "AGENTIC_MACHINE_INFRA"
  | "DYNAMIC_CONTENT_MEMBERSHIP"
  | "B2B_ENTERPRISE_BILLING"
  | "DIRECT_FUNDING_SPONSORSHIPS";

export interface NativeMonetizationMethod {
  id: string;
  name: string;
  category: MonetizationCategory;
  description: string;
  protocolOrTech: string;
  minimumSubscriptionRequired: "ACTIVE";
  creatorSplitPct: 75;
  platformSplitPct: 25;
  supportedCurrencies: string[];
}

export const ISMF_25_MONETIZATION_METHODS: Record<string, NativeMonetizationMethod> = {
  // MÓDULO A: AGENTIC & MACHINE INFRASTRUCTURE
  "method-01-api-mcp": {
    id: "method-01-api-mcp",
    name: "Monetización de APIs y Servidores MCP",
    category: "AGENTIC_MACHINE_INFRA",
    description:
      "Cobro nativo por llamada a APIs, datasets o servidores MCP mediante protocolo x402.",
    protocolOrTech: "HTTP 402 / x402 / USDC / EVM",
    minimumSubscriptionRequired: "ACTIVE",
    creatorSplitPct: 75,
    platformSplitPct: 25,
    supportedCurrencies: ["USDC", "USD", "BOOKPI_CREDITS"],
  },
  "method-02-metered-billing": {
    id: "method-02-metered-billing",
    name: "SaaS y Freemium con Tarificación por Uso",
    category: "AGENTIC_MACHINE_INFRA",
    description:
      "Tarificación por token de inferencia, volumen de almacenamiento o queries en cuotas.",
    protocolOrTech: "Stripe Metered / BookPI Quotas",
    minimumSubscriptionRequired: "ACTIVE",
    creatorSplitPct: 75,
    platformSplitPct: 25,
    supportedCurrencies: ["USD", "MXN", "EUR"],
  },
  "method-03-data-licensing": {
    id: "method-03-data-licensing",
    name: "Licenciamiento de Datos y Data Clean Rooms",
    category: "AGENTIC_MACHINE_INFRA",
    description:
      "Venta soberana de datasets estructurados para entrenamiento ético de IA con trazabilidad.",
    protocolOrTech: "DID Proof / Zero-Knowledge Clean Rooms",
    minimumSubscriptionRequired: "ACTIVE",
    creatorSplitPct: 75,
    platformSplitPct: 25,
    supportedCurrencies: ["USDC", "USD"],
  },
  "method-04-outcome-a2a": {
    id: "method-04-outcome-a2a",
    name: "Pagos Agenticos Basados en Resultados",
    category: "AGENTIC_MACHINE_INFRA",
    description:
      "Contratos de depósito (escrow) donde el agente paga solo si la tarea se resuelve con éxito.",
    protocolOrTech: "Smart Escrow / NCUA 2-de-3 Quórum",
    minimumSubscriptionRequired: "ACTIVE",
    creatorSplitPct: 75,
    platformSplitPct: 25,
    supportedCurrencies: ["USDC", "BOOKPI_CREDITS"],
  },
  "method-05-w3c-interledger": {
    id: "method-05-w3c-interledger",
    name: "Estándar de Monetización Web W3C (Interledger)",
    category: "AGENTIC_MACHINE_INFRA",
    description:
      "Transmisión continua de micro-pagos automáticos en tiempo real durante la navegación.",
    protocolOrTech: "W3C Web Monetization / ILP",
    minimumSubscriptionRequired: "ACTIVE",
    creatorSplitPct: 75,
    platformSplitPct: 25,
    supportedCurrencies: ["USDC", "USD"],
  },

  // MÓDULO B: DYNAMIC CONTENT & MEMBERSHIP
  "method-06-smart-paywall": {
    id: "method-06-smart-paywall",
    name: "Muros de Pago Inteligentes y Adaptativos",
    category: "DYNAMIC_CONTENT_MEMBERSHIP",
    description:
      "Restricción adaptativa de contenido gobernada por CROWN según intención y perfil de visitante.",
    protocolOrTech: "CROWN PEP/PDP / IDH-D Gate",
    minimumSubscriptionRequired: "ACTIVE",
    creatorSplitPct: 75,
    platformSplitPct: 25,
    supportedCurrencies: ["USD", "MXN", "USDC"],
  },
  "method-07-private-communities": {
    id: "method-07-private-communities",
    name: "Comunidades Privadas y Membresías",
    category: "DYNAMIC_CONTENT_MEMBERSHIP",
    description:
      "Acceso exclusivo por suscripción a círculos de conocimiento y networking soberano.",
    protocolOrTech: "ARGUS DID Roles / Tenant Isolation",
    minimumSubscriptionRequired: "ACTIVE",
    creatorSplitPct: 75,
    platformSplitPct: 25,
    supportedCurrencies: ["USD", "MXN"],
  },
  "method-08-digital-products": {
    id: "method-08-digital-products",
    name: "Venta Directa de Productos Digitales",
    category: "DYNAMIC_CONTENT_MEMBERSHIP",
    description: "Comercialización de prompts, plantillas UI, componentes y gemelos digitales 3D.",
    protocolOrTech: "BookPI Digital Asset Registry",
    minimumSubscriptionRequired: "ACTIVE",
    creatorSplitPct: 75,
    platformSplitPct: 25,
    supportedCurrencies: ["USD", "MXN", "EUR"],
  },
  "method-09-online-courses": {
    id: "method-09-online-courses",
    name: "Cursos en Línea y Programas de Formación",
    category: "DYNAMIC_CONTENT_MEMBERSHIP",
    description:
      "Talleres síncronos y programas asíncronos bajo demanda asistidos por agentes pedagógicos.",
    protocolOrTech: "LMS Soberano / Verified Certificates",
    minimumSubscriptionRequired: "ACTIVE",
    creatorSplitPct: 75,
    platformSplitPct: 25,
    supportedCurrencies: ["USD", "MXN"],
  },
  "method-10-paid-newsletters": {
    id: "method-10-paid-newsletters",
    name: "Boletines Informativos Monetizados",
    category: "DYNAMIC_CONTENT_MEMBERSHIP",
    description: "Publicaciones editoriales con cobro recurrente o patrocinadores integrados.",
    protocolOrTech: "Stripe Billing / Substack-compatible RSS",
    minimumSubscriptionRequired: "ACTIVE",
    creatorSplitPct: 75,
    platformSplitPct: 25,
    supportedCurrencies: ["USD", "MXN"],
  },
  "method-11-token-gating": {
    id: "method-11-token-gating",
    name: "Membresías Cripto y Token-Gating",
    category: "DYNAMIC_CONTENT_MEMBERSHIP",
    description:
      "Verificación criptográfica de pases digitales, credenciales W3C o tokens soberanos.",
    protocolOrTech: "EVM / Solana / W3C Verifiable Credentials",
    minimumSubscriptionRequired: "ACTIVE",
    creatorSplitPct: 75,
    platformSplitPct: 25,
    supportedCurrencies: ["USDC", "ETH", "POL"],
  },
  "method-12-d2c-pod": {
    id: "method-12-d2c-pod",
    name: "Comercio Electrónico D2C e Impresión Bajo Demanda",
    category: "DYNAMIC_CONTENT_MEMBERSHIP",
    description:
      "Venta directa de mercancía física vinculada al territorio y patrimonio artesanal.",
    protocolOrTech: "Stripe Connect / Logistics API",
    minimumSubscriptionRequired: "ACTIVE",
    creatorSplitPct: 75,
    platformSplitPct: 25,
    supportedCurrencies: ["MXN", "USD"],
  },

  // MÓDULO C: B2B ENTERPRISE & USAGE BILLING
  "method-13-white-label": {
    id: "method-13-white-label",
    name: "Software Marca Blanca (White-Label SaaS)",
    category: "B2B_ENTERPRISE_BILLING",
    description:
      "Despliegue de instancias de agentes y gemelos cognitivos bajo la marca corporativa del cliente.",
    protocolOrTech: "Multi-Tenant RLS / Custom Domain CNAME",
    minimumSubscriptionRequired: "ACTIVE",
    creatorSplitPct: 75,
    platformSplitPct: 25,
    supportedCurrencies: ["USD", "MXN"],
  },
  "method-14-productized-services": {
    id: "method-14-productized-services",
    name: "Servicios Empaquetados a Precio Fijo",
    category: "B2B_ENTERPRISE_BILLING",
    description:
      "Venta de servicios profesionales (diseño, auditoría de seguridad, consultoría de IA) a tarifa plana.",
    protocolOrTech: "Stripe Invoicing / SLA Smart Gate",
    minimumSubscriptionRequired: "ACTIVE",
    creatorSplitPct: 75,
    platformSplitPct: 25,
    supportedCurrencies: ["USD", "MXN"],
  },
  "method-15-lead-generation": {
    id: "method-15-lead-generation",
    name: "Generación de Clientes Potenciales B2B",
    category: "B2B_ENTERPRISE_BILLING",
    description:
      "Captación y entrega de prospectos cualificados con verificación de consentimiento y privacidad.",
    protocolOrTech: "Privacy-Preserving CRM Integration",
    minimumSubscriptionRequired: "ACTIVE",
    creatorSplitPct: 75,
    platformSplitPct: 25,
    supportedCurrencies: ["USD", "MXN"],
  },
  "method-16-marketplace-rates": {
    id: "method-16-marketplace-rates",
    name: "Comisiones en Mercados Multi-Vendedor",
    category: "B2B_ENTERPRISE_BILLING",
    description: "Retención automatizada sobre transacciones entre terceros en mercados federados.",
    protocolOrTech: "Stripe Custom Connect / Split Engine",
    minimumSubscriptionRequired: "ACTIVE",
    creatorSplitPct: 75,
    platformSplitPct: 25,
    supportedCurrencies: ["USD", "MXN"],
  },
  "method-17-freemium-saas": {
    id: "method-17-freemium-saas",
    name: "SaaS Freemium con Conversión Automatizada",
    category: "B2B_ENTERPRISE_BILLING",
    description:
      "Niveles gratuitos con embudos guiados por IA para conversión a suscripciones de pago.",
    protocolOrTech: "CROWN Tenant Quotas / Stripe Subscriptions",
    minimumSubscriptionRequired: "ACTIVE",
    creatorSplitPct: 75,
    platformSplitPct: 25,
    supportedCurrencies: ["USD", "MXN"],
  },

  // MÓDULO D: DIRECT FUNDING & SPONSORSHIPS
  "method-18-micro-tipping": {
    id: "method-18-micro-tipping",
    name: "Plataformas de Micro-donaciones y Propinas",
    category: "DIRECT_FUNDING_SPONSORSHIPS",
    description:
      "Financiación colectiva y gratificaciones directas sin fricción mediante botones integrados.",
    protocolOrTech: "Instant Tip Rail / Lightning / Card",
    minimumSubscriptionRequired: "ACTIVE",
    creatorSplitPct: 75,
    platformSplitPct: 25,
    supportedCurrencies: ["USD", "MXN", "USDC"],
  },
  "method-19-open-source-sponsorship": {
    id: "method-19-open-source-sponsorship",
    name: "Patrocinio de Código Abierto Soberano",
    category: "DIRECT_FUNDING_SPONSORSHIPS",
    description:
      "Mecenazgo directo para mantenedores de paquetes y repositorios de ciencia abierta.",
    protocolOrTech: "GitHub Sponsors Bridge / Open Collective",
    minimumSubscriptionRequired: "ACTIVE",
    creatorSplitPct: 75,
    platformSplitPct: 25,
    supportedCurrencies: ["USD", "EUR"],
  },
  "method-20-virtual-ppv": {
    id: "method-20-virtual-ppv",
    name: "Eventos Virtuales y Transmisiones Pay-Per-View",
    category: "DIRECT_FUNDING_SPONSORSHIPS",
    description:
      "Boletos digitales para transmisiones en vivo, talleres interactivos y keynotes exclusivas.",
    protocolOrTech: "WebRTC Secure Stream / Ticket Gate",
    minimumSubscriptionRequired: "ACTIVE",
    creatorSplitPct: 75,
    platformSplitPct: 25,
    supportedCurrencies: ["USD", "MXN"],
  },
  "method-21-smart-affiliates": {
    id: "method-21-smart-affiliates",
    name: "Marketing de Afiliación Inteligente",
    category: "DIRECT_FUNDING_SPONSORSHIPS",
    description:
      "Enlaces contextuales dinámicos inyectados por el motor cognitivo según afinidad del lector.",
    protocolOrTech: "GraphRAG Affiliation Matcher",
    minimumSubscriptionRequired: "ACTIVE",
    creatorSplitPct: 75,
    platformSplitPct: 25,
    supportedCurrencies: ["USD", "MXN"],
  },
  "method-22-programmatic-ads": {
    id: "method-22-programmatic-ads",
    name: "Redes Publicitarias Programáticas de Alto Rendimiento",
    category: "DIRECT_FUNDING_SPONSORSHIPS",
    description:
      "Subastas en tiempo real (Header Bidding) con filtrado de dignidad digital (IDH-D).",
    protocolOrTech: "Prebid.js / IDH-D Ad Sanitizer",
    minimumSubscriptionRequired: "ACTIVE",
    creatorSplitPct: 75,
    platformSplitPct: 25,
    supportedCurrencies: ["USD"],
  },
  "method-23-direct-sponsors": {
    id: "method-23-direct-sponsors",
    name: "Contenido Patrocinado y Acuerdos Directos",
    category: "DIRECT_FUNDING_SPONSORSHIPS",
    description:
      "Convenios publicitarios directos con marcas locales y territoriales sin intermediarios.",
    protocolOrTech: "Direct Brand Escrow / BookPI Audit",
    minimumSubscriptionRequired: "ACTIVE",
    creatorSplitPct: 75,
    platformSplitPct: 25,
    supportedCurrencies: ["MXN", "USD"],
  },
  "method-24-direct-banners": {
    id: "method-24-direct-banners",
    name: "Venta Directa de Banners y Publicidad Nativa",
    category: "DIRECT_FUNDING_SPONSORSHIPS",
    description: "Alquiler mensual o por impresiones de espacios visuales fijos en la plataforma.",
    protocolOrTech: "Native Billboard Slot / Click Tracker",
    minimumSubscriptionRequired: "ACTIVE",
    creatorSplitPct: 75,
    platformSplitPct: 25,
    supportedCurrencies: ["USD", "MXN"],
  },
  "method-25-ai-promo-injection": {
    id: "method-25-ai-promo-injection",
    name: "Inserción Dinámica de Promociones Asistida por IA",
    category: "DIRECT_FUNDING_SPONSORSHIPS",
    description:
      "Inyección no invasiva de ofertas contextuales en tiempo real durante la lectura o consulta.",
    protocolOrTech: "Cognitive DualKernel Prompt Adapter",
    minimumSubscriptionRequired: "ACTIVE",
    creatorSplitPct: 75,
    platformSplitPct: 25,
    supportedCurrencies: ["USD", "MXN"],
  },
};

/**
 * Evaluador de acceso ISMF:
 * Comprueba que el usuario mantenga una suscripción mensual activa en Isabella
 * para poder activar o ejecutar cualquiera de los 25 métodos de monetización.
 */
export function validateIsmfAccess(
  methodId: string,
  context: PrincipalContext,
): { allowed: boolean; method?: NativeMonetizationMethod; reason?: string } {
  const method = ISMF_25_MONETIZATION_METHODS[methodId];
  if (!method) {
    return { allowed: false, reason: `ISMF_METHOD_NOT_FOUND: ${methodId}` };
  }

  // Candado CROWN: Suscripción mensual activa requerida
  if (context.subscriptionStatus !== "ACTIVE") {
    return {
      allowed: false,
      method,
      reason:
        "CROWN_POLICY_DENY: Se requiere una suscripción mensual activa con Isabella para monetizar a través de este método.",
    };
  }

  return { allowed: true, method };
}

/**
 * Calcula la liquidación del 75/25 para cualquier método de la suite ISMF.
 */
export function calculateIsmfSplit(grossAmountUsd: number) {
  const creatorUsd = parseFloat((grossAmountUsd * 0.75).toFixed(2));
  const platformUsd = parseFloat((grossAmountUsd - creatorUsd).toFixed(2));

  return {
    grossAmountUsd,
    creatorPct: 75,
    creatorUsd,
    platformPct: 25,
    platformUsd,
    splitRule: "ISMF_CANONICAL_75_25",
  };
}
