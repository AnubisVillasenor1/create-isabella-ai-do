/**
 * OSIRIS — Quantum-era cyber-defense observation layer.
 *
 * state: draft | engine-generated. This module OBSERVES, SCORES and RECORDS.
 * It does not block, does not certify, does not run a trained ML model, and
 * does not claim any accuracy figure. Human authority decides and executes.
 *
 * Fidelity contract: SPECIFIED ≠ IMPLEMENTED ≠ TESTED ≠ INTEGRATED ≠
 * VERIFIED ≠ DEPLOYED ≠ CERTIFIED.
 */
import type { JsonValue } from '../bookpi/types';

export const OSIRIS_MODULE = 'OSIRIS' as const;
export const OSIRIS_VERSION = '0.1.0' as const;

/** Canonical method id: [TINA].[YUN].[MODULO].[FUNCION].[VERSION].[RISK].[GOV]. */
export const OSIRIS_METHOD_IDS = {
  inspect: 'TINA.YUN.OSIRIS.inspect_signal.v0.1.0.MEDIUM.INSTITUTIONAL',
  posture: 'TINA.YUN.OSIRIS.assess_posture.v0.1.0.LOW.AUTONOMOUS',
  audit: 'TINA.YUN.OSIRIS.record_finding.v0.1.0.LOW.INSTITUTIONAL',
} as const;

export type ThreatSeverity = 'info' | 'low' | 'medium' | 'high' | 'critical';

export const SEVERITY_ORDER: readonly ThreatSeverity[] = [
  'info',
  'low',
  'medium',
  'high',
  'critical',
];

export type ThreatCategory =
  | 'credential_abuse'
  | 'injection_attempt'
  | 'rate_anomaly'
  | 'payload_anomaly'
  | 'reconnaissance'
  | 'policy_evasion'
  | 'crypto_posture'
  | 'unknown';

/**
 * Observable features extracted from an inbound signal. Callers are responsible
 * for sanitizing payloads BEFORE extracting features; OSIRIS never needs raw
 * secrets and must never receive them.
 */
export interface SecurityFeatures {
  readonly requestRatePerMinute?: number;
  readonly inputLength?: number;
  readonly failedAuthAttempts?: number;
  readonly uniqueResourceCount?: number;
  readonly contentFlags?: readonly string[];
  readonly isAuthenticated?: boolean;
  readonly tls?: boolean;
}

export interface SecuritySignal {
  readonly id: string;
  readonly timestamp: string;
  readonly source: string;
  readonly actorId?: string;
  readonly features: SecurityFeatures;
}

export interface DetectionFinding {
  readonly ruleId: string;
  readonly category: ThreatCategory;
  readonly severity: ThreatSeverity;
  readonly confidence: number;
  readonly summary: string;
  readonly evidence: Readonly<Record<string, JsonValue>>;
}

/** Advisory only. Human authority decides the response. */
export type DefenseRecommendation =
  'ALLOW' | 'MONITOR' | 'RATE_LIMIT' | 'REVIEW' | 'BLOCK_RECOMMENDED';

export interface DetectionResult {
  readonly signalId: string;
  readonly timestamp: string;
  readonly findings: readonly DetectionFinding[];
  readonly maxSeverity: ThreatSeverity | 'none';
  readonly score: number;
  readonly recommendation: DefenseRecommendation;
}

export type PostureState = 'active' | 'inactive' | 'unknown';

export interface PostureControl {
  readonly control: string;
  readonly state: PostureState;
  readonly note: string;
}

export interface DefensePosture {
  readonly assessedAt: string;
  readonly controls: readonly PostureControl[];
  readonly activeCount: number;
  readonly unknownCount: number;
  /** Never "secure". OSIRIS does not certify. */
  readonly certification: 'NOT_CERTIFIED';
  readonly trainedModelPresent: false;
}

export interface OsirisMetrics {
  readonly signalsInspected: number;
  readonly findingsBySeverity: Readonly<Record<ThreatSeverity, number>>;
  readonly lastSignalAt: string | null;
}

export interface OsirisSnapshot {
  readonly module: typeof OSIRIS_MODULE;
  readonly version: typeof OSIRIS_VERSION;
  readonly metrics: OsirisMetrics;
  readonly posture: DefensePosture;
  readonly ledger: {
    readonly count: number;
    readonly valid: boolean;
    readonly chainHead: string | null;
    readonly storage: string;
    readonly durable: boolean;
  };
  readonly disclaimer: string;
}
