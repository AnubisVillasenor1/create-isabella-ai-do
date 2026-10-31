// state: draft | engine-generated — Orquestador de convergencia nativa Ω∞ (Documento §V).
// Costura NATIVA: recorre los macrodominios canónicos, aplica la ecuación de legitimidad
// (legitimacy.ts + src/omega/constitution.ts) y sella cada hop en la cadena BookPI real
// (src/bookpi/ledger.ts). Es FAIL-CLOSED: si algún factor vale 0 o CROWN no concede, el
// resultado es DENY — y aun así se sella la evidencia de la decisión (evidence before authority).
//
// LÍMITES REALES (no se finge producción):
//  - NO mueve dinero: la liquidación IEGS real es responsabilidad humana; aquí solo se compone
//    el contrato EconomyToCore y se consulta la puerta de confianza.
//  - NO firma post-cuántico: la capa QSF queda BLOCKED_ENVIRONMENT (sin proveedor PQC/HSM).
//  - El hash de evidencia es SHA-256 (el de la cadena BookPI existente), no SHA3-512; la
//    divergencia con el documento está archivada en contracts.ts.
import {
  buildMethodId,
  type GovernanceTier,
  type RiskTier,
  type TinaType,
  type YunFederation,
} from '../../authority/method-id';
import type { BookPiEvent, BookPiLedgerPort } from '../../bookpi/ledger';
import { callGate, type CapabilityDescriptor, type CapabilityGate } from '../../crown/capability';
import type { ApprovalRef } from '../../identity/approval';
import type { Principal } from '../../identity/principal';
import { createHash } from 'node:crypto';
import {
  DOMAIN_RISK,
  type CrownDecision,
  type EconomyOperation,
  type MacroDomain,
  type NativeHop,
  type QsfOperation,
} from './contracts';
import { computeLegitimacy, type LegitimacyEvaluation } from './legitimacy';

const DOMAIN_BINDING: Readonly<
  Record<
    MacroDomain,
    { tina: TinaType; yun: YunFederation; module: string; governance: GovernanceTier }
  >
> = Object.freeze({
  CORE: {
    tina: 'A',
    yun: 'COLLECTIVE_INTELLIGENCE',
    module: 'MOE_ROUTER',
    governance: 'OPERATIONAL',
  },
  GOVERNANCE: { tina: 'I', yun: 'IDENTITY', module: 'CROWN', governance: 'CONSTITUTIONAL' },
  KNOWLEDGE: { tina: 'N', yun: 'PATRIMONY', module: 'HDCVSA_MEMORY', governance: 'OPERATIONAL' },
  ECONOMY: { tina: 'I', yun: 'ECONOMY', module: 'BOOKPI', governance: 'INSTITUTIONAL' },
  IMMUNITY: { tina: 'I', yun: 'RESILIENCE', module: 'AEGIS', governance: 'INSTITUTIONAL' },
  EXPERIENCE: { tina: 'A', yun: 'TWINS', module: 'NATIVE_ML', governance: 'AUTONOMOUS' },
});

function domainMethodId(domain: MacroDomain, fn: string, risk: RiskTier): string {
  const b = DOMAIN_BINDING[domain];
  return buildMethodId({
    tina: b.tina,
    yun: b.yun,
    module: b.module,
    function: fn,
    version: 'v1.0.0',
    riskTier: risk,
    governanceTier: b.governance,
  });
}

const COMPOSITE_METHOD = domainMethodId('GOVERNANCE', 'native_convergence', 'MEDIUM');
const ECONOMY_METHOD = domainMethodId('ECONOMY', 'native_economy', 'HIGH');

/** Descriptorores CROWN para las capacidades nativas. El registro es obligatorio y fail-closed. */
export const NATIVE_CAPABILITY_DESCRIPTORS: readonly CapabilityDescriptor[] = Object.freeze([
  {
    methodId: COMPOSITE_METHOD,
    owner: 'crown-native',
    allowedRoles: ['operator', 'agent', 'isabella', 'human-approver'],
    riskTier: 'MEDIUM',
    governanceTier: 'CONSTITUTIONAL',
    humanApprovalRequired: false,
  },
  {
    methodId: ECONOMY_METHOD,
    owner: 'iegs-native',
    allowedRoles: ['operator', 'human-approver'],
    riskTier: 'HIGH',
    governanceTier: 'INSTITUTIONAL',
    humanApprovalRequired: true,
  },
]);

export interface ProsodyPlan {
  readonly f0_curve: readonly number[];
  readonly pauses_ms: readonly number[];
  readonly breathing_points: readonly number[];
}

export interface NativeIntent {
  readonly semanticIntent: string;
  readonly culturalContext: string;
  readonly emotionVector: Readonly<Record<string, number>>;
  readonly prosody: ProsodyPlan;
  readonly targetVoiceDna: string;
}

export interface NativeEconomicRequest {
  readonly transactionId: string;
  readonly operation: EconomyOperation;
  readonly trustScore: number;
  readonly riskScore: number;
}

export interface NativeCryptoRequest {
  readonly operation: QsfOperation;
  readonly payload: Uint8Array;
  /** Material firmado EXTERNO ya verificado. Si falta, la capa queda BLOCKED_ENVIRONMENT. */
  readonly signature?: Uint8Array;
}

export interface NativeOperationRequest {
  readonly requestId: string;
  readonly principal: Principal;
  readonly actorDid: string;
  readonly mandate: string;
  readonly policyVersion: string;
  readonly humanOverrideAvailable: boolean;
  readonly territory: string;
  readonly explanation: string;
  readonly recoveryPlan: string;
  readonly learningRecord: string;
  readonly economicJustification: string;
  readonly intent: NativeIntent;
  readonly economic?: NativeEconomicRequest;
  readonly crypto?: NativeCryptoRequest;
  readonly humanApproval?: ApprovalRef;
}

export interface NativeConvergenceDeps {
  readonly ledger: BookPiLedgerPort;
  readonly capabilityGate: CapabilityGate;
  readonly clock?: () => string;
}

export interface NativeConvergenceResult {
  readonly requestId: string;
  readonly decidedAt: string;
  readonly status: 'ALLOW' | 'DENY';
  readonly legitimacy: LegitimacyEvaluation;
  readonly hops: readonly NativeHop[];
  readonly evidence: {
    readonly chainHead: string | null;
    readonly events: number;
    readonly valid: boolean;
  };
  readonly executionPerformed: boolean;
  readonly externalSideEffects: 'NONE';
  readonly governanceReason: string;
}

/**
 * Ejecuta el flujo nativo de convergencia. Determinista respecto a `clock` y al ledger
 * inyectados. No abre red, no mueve dinero, no firma PQC: compone contratos, consulta la
 * puerta de confianza y sella evidencia. Devuelve ALLOW solo si la legitimidad es completa.
 */
export function runNativeConvergence(
  deps: NativeConvergenceDeps,
  req: NativeOperationRequest
): NativeConvergenceResult {
  const clock = deps.clock ?? (() => new Date().toISOString());
  const ledgerPrincipal = req.actorDid.trim() || 'unattributed';
  const hops: NativeHop[] = [];

  const seal = (type: string, methodId: string, riskTier: RiskTier, status: string): BookPiEvent =>
    deps.ledger.append({
      id: `${req.requestId}:${type}`,
      timestamp: clock(),
      type,
      methodId,
      principal: ledgerPrincipal,
      riskTier,
      status,
    });

  // Evidencia antes que autoridad: el intento se sella aunque la decisión final sea DENY.
  seal('native.intent', COMPOSITE_METHOD, 'MEDIUM', 'OBSERVED');

  // Ω-GOVERNANCE — identidad + mandato + CROWN.
  const compositeVerdict = callGate(deps.capabilityGate, COMPOSITE_METHOD, {
    principal: req.principal,
    action: 'native.converge',
    resource: req.requestId,
    policyVersion: req.policyVersion,
  });
  const recordHop = (
    domain: MacroDomain,
    contract: string,
    fn: string,
    status: NativeHop['status'],
    detail: Record<string, string | number | boolean | null>
  ): void => {
    const risk = DOMAIN_RISK[domain];
    const methodId = domainMethodId(domain, fn, risk);
    const event = seal(`native.${domain.toLowerCase()}`, methodId, risk, status);
    hops.push({
      domain,
      contract,
      methodId,
      actorDid: req.actorDid,
      evidenceId: event.hash,
      status,
      detail,
    });
  };

  recordHop('GOVERNANCE', 'SecureEnvelope', 'native_governance', 'OBSERVED', {
    governance_granted: compositeVerdict.granted,
    principal_kind: req.principal.kind,
  });

  // Ω-KNOWLEDGE — Latino Genesis → SIGMA (seam tipado; el enganche real a src/linguistics es fase posterior).
  const matchedTerms = req.intent.culturalContext
    .split(/[^A-Za-zÁÉÍÓÚáéíóúÑñ0-9]+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 0)
    .slice(0, 8);
  recordHop('KNOWLEDGE', 'LatinoGenesisToSigma', 'native_knowledge', 'OBSERVED', {
    matched_terms: matchedTerms.length,
    enriched_context: req.intent.culturalContext.slice(0, 120),
  });

  // Ω-CORE — SIGMA produce la intención semántica/emocional (SigmaToGenesisContract).
  const dominantEmotion =
    Object.entries(req.intent.emotionVector).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'neutral';
  recordHop('CORE', 'SigmaToGenesis', 'native_cognition', 'OBSERVED', {
    semantic_intent: req.intent.semanticIntent.slice(0, 120),
    dominant_emotion: dominantEmotion,
    prosody_frames: req.intent.prosody.f0_curve.length,
  });

  // Ω-EXPERIENCE — GÉNESIS TTS / VOX (destino Acoustic DNA; sin síntesis real de audio aquí).
  recordHop('EXPERIENCE', 'SigmaToGenesis', 'native_voice', 'OBSERVED', {
    target_voice_dna: req.intent.targetVoiceDna.slice(0, 64),
    audio_synthesized: false,
  });

  let economyCrown: CrownDecision | null = null;
  let economyDenied = false;
  if (req.economic) {
    const economyVerdict = callGate(deps.capabilityGate, ECONOMY_METHOD, {
      principal: req.principal,
      approval: req.humanApproval,
      action: `economy.${req.economic.operation}`,
      resource: req.economic.transactionId,
      policyVersion: req.policyVersion,
    });
    economyCrown = economyVerdict.granted ? 'ALLOW' : 'DENY';
    economyDenied = !economyVerdict.granted;
    recordHop('ECONOMY', 'EconomyToCore', 'native_economy', economyDenied ? 'DENY' : 'ALLOW', {
      operation: req.economic.operation,
      trust_score: req.economic.trustScore,
      risk_score: req.economic.riskScore,
      crown_decision: economyCrown,
      money_moved: false,
    });
  }

  let cryptoBlocked = false;
  if (req.crypto) {
    // No existe proveedor PQC/HSM en este entorno: la capa QSF se marca BLOCKED_ENVIRONMENT y
    // NO se fabrica firma. payload_hash usa SHA-256 real (divergencia archivada, contracts.ts).
    const payloadHash = createHash('sha256').update(req.crypto.payload).digest('hex');
    cryptoBlocked = true;
    recordHop('IMMUNITY', 'QsfToBookPi', 'native_quantum', 'BLOCKED_ENVIRONMENT', {
      operation: req.crypto.operation,
      payload_hash_sha256: payloadHash.slice(0, 16),
      signature_present: req.crypto.signature !== undefined,
      pqc_provider: 'NONE (BLOCKED_ENVIRONMENT)',
    });
  }

  const preDecisionVerify = deps.ledger.verify();
  const governanceGranted = compositeVerdict.granted && !economyDenied;
  const executionAuthorized = governanceGranted && !cryptoBlocked;
  const evidenceRefs = hops.map((h) => h.evidenceId);

  const legitimacy = computeLegitimacy(
    {
      requestId: req.requestId,
      actorDid: req.actorDid,
      principalKind: req.principal.kind,
      mandate: req.mandate,
      policyVersion: req.policyVersion,
      humanOverrideAvailable: req.humanOverrideAvailable,
      territory: req.territory,
      explanation: req.explanation,
      recoveryPlan: req.recoveryPlan,
      learningRecord: req.learningRecord,
      economicJustification: req.economicJustification,
      governanceGranted,
      evidencePresent: preDecisionVerify.valid && preDecisionVerify.blocksValidated >= 2,
      tracePresent: hops.length > 0,
      executionAuthorized,
    },
    evidenceRefs,
    [COMPOSITE_METHOD],
    clock
  );

  const status: 'ALLOW' | 'DENY' = legitimacy.allowed ? 'ALLOW' : 'DENY';
  seal('native.decision', COMPOSITE_METHOD, 'MEDIUM', status);
  const finalVerify = deps.ledger.verify();

  return Object.freeze({
    requestId: req.requestId,
    decidedAt: clock(),
    status,
    legitimacy,
    hops: Object.freeze(
      hops.map((h) => Object.freeze({ ...h, detail: Object.freeze({ ...h.detail }) }))
    ),
    evidence: Object.freeze({
      chainHead: finalVerify.chainHead,
      events: finalVerify.blocksValidated,
      valid: finalVerify.valid,
    }),
    executionPerformed: legitimacy.allowed,
    externalSideEffects: 'NONE',
    governanceReason: compositeVerdict.reason,
  });
}
