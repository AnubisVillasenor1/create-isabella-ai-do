// state: draft | engine-generated — Contracts de integración nativa Ω∞ (Documento §IV).
// Reexpresión TIPADA de los módulos del chat como capas nativas de los seis macrodominios
// canónicos. Ninguna función de este archivo mueve dinero, firma post-cuántico ni ejecuta
// acciones externas: define estructura y el mapa módulo→macrodominio. La autoridad la
// decide la Constitución (src/omega/constitution.ts) + CROWN (src/crown/capability.ts).
import type { RiskTier } from '../../authority/method-id';

/** Los seis macrodominios canónicos de Isabella Ω∞. */
export const MACRODOMAINS = [
  'CORE',
  'GOVERNANCE',
  'KNOWLEDGE',
  'ECONOMY',
  'IMMUNITY',
  'EXPERIENCE',
] as const;
export type MacroDomain = (typeof MACRODOMAINS)[number];

export interface MacroDomainInfo {
  readonly domain: MacroDomain;
  readonly label: string;
  readonly nativeModules: readonly string[];
  readonly isabellaComponent: string;
}

/** Mapa de integración nativa (Documento §II): módulo del chat → macrodominio + componente Isabella. */
export const MACRODOMAIN_REGISTRY: Readonly<Record<MacroDomain, MacroDomainInfo>> = Object.freeze({
  CORE: {
    domain: 'CORE',
    label: 'Ω-CORE',
    nativeModules: ['SIGMA_CORE'],
    isabellaComponent: 'Trinity Fabric + Agent Mesh (src/hypercore, src/agents, src/cognition)',
  },
  GOVERNANCE: {
    domain: 'GOVERNANCE',
    label: 'Ω-GOVERNANCE',
    nativeModules: ['ISA_CORE', 'ISA_QSF'],
    isabellaComponent: 'CROWN + GAME OVER + Terminus (src/crown, src/gameover, src/terminus)',
  },
  KNOWLEDGE: {
    domain: 'KNOWLEDGE',
    label: 'Ω-KNOWLEDGE',
    nativeModules: ['LATINO_GENESIS', 'BOOKPI'],
    isabellaComponent: 'YUN + Knowledge Graph + RAG + BookPI (src/linguistics, src/bookpi)',
  },
  ECONOMY: {
    domain: 'ECONOMY',
    label: 'Ω-ECONOMY',
    nativeModules: ['IEGS'],
    isabellaComponent: 'IMF + CreatorOS + Treasury + SCER (src/economy)',
  },
  IMMUNITY: {
    domain: 'IMMUNITY',
    label: 'Ω-IMMUNITY',
    nativeModules: ['ISA_QSF', 'SENTINEL_X'],
    isabellaComponent: 'AEGIS + Sentinel-X + IHEC (src/ihec, src/osiris, src/economy/fraud)',
  },
  EXPERIENCE: {
    domain: 'EXPERIENCE',
    label: 'Ω-EXPERIENCE',
    nativeModules: ['GENESIS_TTS', 'VOX'],
    isabellaComponent: 'NEXUS COE + World Model (src/tts, src/voice, src/multimodal)',
  },
});

/**
 * El módulo ISA-QSF se integra de forma dual (Documento §II): GOVERNANCE (plano de
 * confianza) e IMMUNITY (criptografía/antifraude). El orquestador sella la capa
 * criptográfica bajo IMMUNITY porque ahí residen AEGIS y Sentinel-X.
 */
export const QSF_DOMAIN: MacroDomain = 'IMMUNITY';

/** §4.1 — SIGMA → GÉNESIS: la intención semántica/emocional se convierte en voz. */
export interface SigmaToGenesisContract {
  trace_id: string;
  semantic_intent: string;
  cultural_context: string;
  emotion_vector: Record<string, number>;
  prosody_plan: {
    f0_curve: number[];
    pauses_ms: number[];
    breathing_points: number[];
  };
  target_voice_dna: string;
}

/** §4.2 — Latino Genesis → SIGMA: el léxico alimenta el enrutador experto y el contexto cultural. */
export interface LatinoGenesisToSigmaContract {
  enriched_context: string[];
  matched_terms: string[];
  cultural_signals: string[];
  prosody_hints: string[];
}

/** §4.3 — IEGS → ISA-CORE: toda transacción económica pasa por el plano de confianza. */
export const ECONOMY_OPERATIONS = ['settle', 'stake', 'refund', 'chargeback'] as const;
export type EconomyOperation = (typeof ECONOMY_OPERATIONS)[number];
export const CROWN_DECISIONS = ['ALLOW', 'REVIEW', 'DENY'] as const;
export type CrownDecision = (typeof CROWN_DECISIONS)[number];

export interface EconomyToCoreContract {
  transaction_id: string;
  actor_did: string;
  operation: EconomyOperation;
  trust_score: number;
  risk_score: number;
  evidence_id: string;
  crown_decision: CrownDecision;
}

/**
 * §4.4 — QSF → BookPI: toda operación criptográfica sella evidencia.
 *
 * DIVERGENCIA ARCHIVADA (AGENTS.md §6): el documento especifica `payload_hash` SHA3-512 y
 * `signature` ML-DSA (post-cuántica). El runtime real sella con la cadena SHA-256 de
 * src/bookpi/ledger.ts y NO posee proveedor PQC → el campo `signature` solo se rellena con
 * material firmado EXTERNO verificado; jamás se fabrica. Mientras no exista proveedor PQC
 * real (HSM/KMS), la capa queda `BLOCKED_ENVIRONMENT`.
 */
export const QSF_OPERATIONS = ['encrypt', 'decrypt', 'sign', 'verify', 'quantum_task'] as const;
export type QsfOperation = (typeof QSF_OPERATIONS)[number];

export interface QsfToBookPiContract {
  operation: QsfOperation;
  actor_did: string;
  payload_hash: string;
  signature?: Uint8Array;
  signature_present: boolean;
  evidence_id: string;
}

/**
 * Secure Envelope Ω (Documento §VI Fase 1): contenedor común que todo hop del flujo nativo
 * porta para que identidad, territorio y evidencia viajen sin perder trazabilidad.
 */
export interface SecureEnvelope {
  trace_id: string;
  actor_did: string;
  territory: string;
  domain: MacroDomain;
  evidence_refs: readonly string[];
}

/** Un paso del flujo nativo: qué macrodominio ejecutó, con qué contrato y qué evidencia dejó. */
export interface NativeHop {
  readonly domain: MacroDomain;
  readonly contract: string;
  readonly methodId: string;
  readonly actorDid: string;
  readonly evidenceId: string;
  readonly status: 'OBSERVED' | 'ALLOW' | 'DENY' | 'BLOCKED_ENVIRONMENT';
  readonly detail: Record<string, string | number | boolean | null>;
}

/** Los ocho factores de la ecuación de legitimidad (Documento §I). Si alguno es 0 → DENY. */
export const LEGITIMACY_FACTORS = [
  'identity',
  'authority',
  'policy',
  'evidence',
  'execution',
  'traceability',
  'governance',
  'humanOversight',
] as const;
export type LegitimacyFactorName = (typeof LEGITIMACY_FACTORS)[number];
export type LegitimacyFactors = Readonly<Record<LegitimacyFactorName, boolean>>;

/** Riesgo canónico por dominio, usado para el methodId y el sellado en BookPI. */
export const DOMAIN_RISK: Readonly<Record<MacroDomain, RiskTier>> = Object.freeze({
  CORE: 'MEDIUM',
  GOVERNANCE: 'HIGH',
  KNOWLEDGE: 'LOW',
  ECONOMY: 'HIGH',
  IMMUNITY: 'CRITICAL',
  EXPERIENCE: 'LOW',
});
