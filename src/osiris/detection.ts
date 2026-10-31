/**
 * OSIRIS deterministic detection engine.
 *
 * Rules are explicit, auditable heuristics — NOT a trained model and NOT a
 * probabilistic classifier. Each finding carries a fixed, hand-declared
 * confidence weight and the raw evidence that triggered it. No accuracy,
 * precision or false-positive rate is claimed here because none has been
 * measured. state: draft | engine-generated.
 */
import type { JsonValue } from '../bookpi/types';
import {
  SEVERITY_ORDER,
  type DefenseRecommendation,
  type DetectionFinding,
  type DetectionResult,
  type SecurityFeatures,
  type ThreatCategory,
  type ThreatSeverity,
} from './types';

export interface DetectionRule {
  readonly id: string;
  readonly category: ThreatCategory;
  evaluate(features: SecurityFeatures): DetectionFinding | null;
}

function severityAtLeast(severity: ThreatSeverity, floor: ThreatSeverity): boolean {
  return SEVERITY_ORDER.indexOf(severity) >= SEVERITY_ORDER.indexOf(floor);
}

function finding(
  ruleId: string,
  category: ThreatCategory,
  severity: ThreatSeverity,
  confidence: number,
  summary: string,
  evidence: Record<string, JsonValue>
): DetectionFinding {
  return Object.freeze({
    ruleId,
    category,
    severity,
    confidence,
    summary,
    evidence: Object.freeze(evidence),
  });
}

function hasFlag(features: SecurityFeatures, flag: string): boolean {
  return (features.contentFlags ?? []).includes(flag);
}

export const DEFAULT_DETECTION_RULES: readonly DetectionRule[] = [
  {
    id: 'OSIRIS-RATE-001',
    category: 'rate_anomaly',
    evaluate: (features) => {
      const rate = features.requestRatePerMinute;
      if (typeof rate !== 'number' || !Number.isFinite(rate)) return null;
      if (rate >= 1000) {
        return finding(
          'OSIRIS-RATE-001',
          'rate_anomaly',
          'high',
          0.6,
          'Sustained request rate far above baseline',
          { requestRatePerMinute: rate }
        );
      }
      if (rate >= 300) {
        return finding('OSIRIS-RATE-001', 'rate_anomaly', 'medium', 0.5, 'Elevated request rate', {
          requestRatePerMinute: rate,
        });
      }
      return null;
    },
  },
  {
    id: 'OSIRIS-AUTH-001',
    category: 'credential_abuse',
    evaluate: (features) => {
      const attempts = features.failedAuthAttempts;
      if (typeof attempts !== 'number' || !Number.isFinite(attempts)) return null;
      if (attempts >= 10) {
        return finding(
          'OSIRIS-AUTH-001',
          'credential_abuse',
          'high',
          0.7,
          'Repeated authentication failures for one actor',
          { failedAuthAttempts: attempts }
        );
      }
      if (attempts >= 5) {
        return finding(
          'OSIRIS-AUTH-001',
          'credential_abuse',
          'medium',
          0.5,
          'Multiple authentication failures',
          { failedAuthAttempts: attempts }
        );
      }
      return null;
    },
  },
  {
    id: 'OSIRIS-PAYLOAD-001',
    category: 'payload_anomaly',
    evaluate: (features) => {
      const length = features.inputLength;
      if (typeof length !== 'number' || !Number.isFinite(length)) return null;
      if (length > 100_000) {
        return finding(
          'OSIRIS-PAYLOAD-001',
          'payload_anomaly',
          'high',
          0.6,
          'Payload far exceeds declared limits',
          { inputLength: length }
        );
      }
      if (length > 20_000) {
        return finding(
          'OSIRIS-PAYLOAD-001',
          'payload_anomaly',
          'medium',
          0.5,
          'Oversized payload',
          { inputLength: length }
        );
      }
      return null;
    },
  },
  {
    id: 'OSIRIS-RECON-001',
    category: 'reconnaissance',
    evaluate: (features) => {
      const unique = features.uniqueResourceCount;
      if (typeof unique !== 'number' || !Number.isFinite(unique)) return null;
      if (unique >= 200) {
        return finding(
          'OSIRIS-RECON-001',
          'reconnaissance',
          'high',
          0.6,
          'Broad resource enumeration sweep',
          { uniqueResourceCount: unique }
        );
      }
      if (unique >= 50) {
        return finding(
          'OSIRIS-RECON-001',
          'reconnaissance',
          'medium',
          0.5,
          'Resource enumeration pattern',
          { uniqueResourceCount: unique }
        );
      }
      return null;
    },
  },
  {
    id: 'OSIRIS-INJECT-001',
    category: 'injection_attempt',
    evaluate: (features) => {
      const marker = ['sql-keywords', 'prompt-injection', 'template-injection'].find((flag) =>
        hasFlag(features, flag)
      );
      if (!marker) return null;
      return finding(
        'OSIRIS-INJECT-001',
        'injection_attempt',
        'high',
        0.6,
        'Injection lexicon detected in input',
        { marker }
      );
    },
  },
  {
    id: 'OSIRIS-EVASION-001',
    category: 'policy_evasion',
    evaluate: (features) => {
      if (!hasFlag(features, 'jailbreak-lexicon')) return null;
      return finding(
        'OSIRIS-EVASION-001',
        'policy_evasion',
        'high',
        0.6,
        'Policy-evasion lexicon detected',
        { marker: 'jailbreak-lexicon' }
      );
    },
  },
  {
    id: 'OSIRIS-EXPOSURE-001',
    category: 'credential_abuse',
    evaluate: (features) => {
      if (features.isAuthenticated !== false) return null;
      if (!hasFlag(features, 'sensitive-resource')) return null;
      return finding(
        'OSIRIS-EXPOSURE-001',
        'credential_abuse',
        'medium',
        0.5,
        'Unauthenticated access to a sensitive resource',
        { sensitiveResource: true }
      );
    },
  },
  {
    id: 'OSIRIS-CRYPTO-001',
    category: 'crypto_posture',
    evaluate: (features) => {
      if (features.tls !== false) return null;
      return finding(
        'OSIRIS-CRYPTO-001',
        'crypto_posture',
        'low',
        0.4,
        'Transport is not reported as TLS-protected',
        { tls: false }
      );
    },
  },
];

function scoreFindings(findings: readonly DetectionFinding[]): number {
  const weights: Record<ThreatSeverity, number> = {
    info: 1,
    low: 5,
    medium: 15,
    high: 30,
    critical: 50,
  };
  const raw = findings.reduce((sum, item) => sum + weights[item.severity] * item.confidence, 0);
  return Math.min(100, Math.round(raw));
}

function recommendationFor(severity: DetectionResult['maxSeverity']): DefenseRecommendation {
  switch (severity) {
    case 'critical':
      return 'BLOCK_RECOMMENDED';
    case 'high':
      return 'REVIEW';
    case 'medium':
      return 'RATE_LIMIT';
    case 'low':
      return 'MONITOR';
    default:
      return 'ALLOW';
  }
}

export function maxSeverityOf(findings: readonly DetectionFinding[]): ThreatSeverity | 'none' {
  let max: ThreatSeverity | 'none' = 'none';
  for (const item of findings) {
    if (max === 'none' || severityAtLeast(item.severity, max)) max = item.severity;
  }
  return max;
}

export interface DetectOptions {
  readonly rules?: readonly DetectionRule[];
  readonly signalId: string;
  readonly timestamp: string;
}

/** Run all rules over the features and return an advisory detection result. */
export function detect(features: SecurityFeatures, options: DetectOptions): DetectionResult {
  const rules = options.rules ?? DEFAULT_DETECTION_RULES;
  const findings: DetectionFinding[] = [];
  for (const rule of rules) {
    const result = rule.evaluate(features);
    if (result) findings.push(result);
  }
  const maxSeverity = maxSeverityOf(findings);
  return Object.freeze({
    signalId: options.signalId,
    timestamp: options.timestamp,
    findings: Object.freeze(findings),
    maxSeverity,
    score: scoreFindings(findings),
    recommendation: recommendationFor(maxSeverity),
  });
}
