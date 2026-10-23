/**
 * OSIRIS sentinel — orchestrates detection, advisory recommendation, append-only
 * audit recording (BookPI) and telemetry.
 *
 * OSIRIS OBSERVES and RECORDS. It does not block traffic, does not execute a
 * response, and does not certify. `recommendation` is advisory; the human
 * authority decides and executes. state: draft | engine-generated.
 */
import { randomUUID } from "node:crypto";
import { bookPiLedger } from "../bookpi/ledger";
import { detect, type DetectionRule } from "./detection";
import { assessDefensePosture, type PostureInputs } from "./posture";
import {
  OSIRIS_METHOD_IDS,
  OSIRIS_MODULE,
  OSIRIS_VERSION,
  type DetectionResult,
  type OsirisMetrics,
  type OsirisSnapshot,
  type SecuritySignal,
  type ThreatSeverity,
} from "./types";

/** Minimal append-only audit contract satisfied by the in-memory BookPI ledger. */
export interface OsirisAuditLedger {
  append(input: {
    id: string;
    timestamp: string;
    type: string;
    methodId: string;
    principal: string;
    riskTier: string;
    status: string;
  }): { readonly hash: string; readonly sequence: number };
  verify(): {
    readonly valid: boolean;
    readonly blocksValidated?: number;
    readonly chainHead: string | null;
    readonly storage: string;
    readonly durable: boolean;
  };
}

export interface OsirisSentinelOptions {
  readonly ledger?: OsirisAuditLedger;
  readonly rules?: readonly DetectionRule[];
  readonly posture?: () => PostureInputs;
  readonly now?: () => Date;
  readonly historyLimit?: number;
}

export interface OsirisSentinel {
  inspect(signal: SecuritySignal): DetectionResult;
  listFindings(limit?: number): readonly DetectionResult[];
  getSnapshot(): OsirisSnapshot;
}

const HISTORY_LIMIT_DEFAULT = 500;
const DISCLAIMER =
  "OSIRIS observes and records; it does not block, execute responses, certify, or run a trained ML model. " +
  "Confidence values are hand-declared heuristic weights, not measured accuracy. Advisory only.";

const SEVERITY_TO_RISK: Record<ThreatSeverity | "none", string> = {
  none: "LOW",
  info: "LOW",
  low: "LOW",
  medium: "MEDIUM",
  high: "HIGH",
  critical: "CRITICAL",
};

function emptySeverityCounts(): Record<ThreatSeverity, number> {
  return { info: 0, low: 0, medium: 0, high: 0, critical: 0 };
}

function requireText(value: unknown, field: string, maxLength = 200): string {
  if (typeof value !== "string") throw new TypeError(`${field} must be a string`);
  const normalized = value.trim();
  if (!normalized) throw new TypeError(`${field} must not be empty`);
  if (normalized.length > maxLength) throw new RangeError(`${field} exceeds ${maxLength} characters`);
  if (/[\u0000-\u001f\u007f]/.test(normalized)) throw new TypeError(`${field} contains control characters`);
  return normalized;
}

function normalizeSignal(signal: SecuritySignal): SecuritySignal {
  const timestampText = requireText(signal.timestamp, "timestamp", 40);
  const parsed = Date.parse(timestampText);
  if (!Number.isFinite(parsed) || !/^\d{4}-\d{2}-\d{2}T.*Z$/.test(timestampText)) {
    throw new TypeError("timestamp must be an ISO-8601 UTC timestamp ending in Z");
  }
  if (!signal.features || typeof signal.features !== "object" || Array.isArray(signal.features)) {
    throw new TypeError("features must be an object");
  }
  return {
    id: requireText(signal.id, "id"),
    timestamp: new Date(parsed).toISOString(),
    source: requireText(signal.source, "source"),
    actorId: signal.actorId === undefined ? undefined : requireText(signal.actorId, "actorId"),
    features: signal.features,
  };
}

export function createOsirisSentinel(options: OsirisSentinelOptions = {}): OsirisSentinel {
  const ledger: OsirisAuditLedger = options.ledger ?? bookPiLedger;
  const now = options.now ?? (() => new Date());
  const historyLimit = options.historyLimit ?? HISTORY_LIMIT_DEFAULT;
  const history: DetectionResult[] = [];
  const findingsBySeverity = emptySeverityCounts();
  let signalsInspected = 0;
  let lastSignalAt: string | null = null;

  function inspect(rawSignal: SecuritySignal): DetectionResult {
    const signal = normalizeSignal(rawSignal);
    const result = detect(signal.features, {
      rules: options.rules,
      signalId: signal.id,
      timestamp: signal.timestamp,
    });

    for (const item of result.findings) {
      findingsBySeverity[item.severity] += 1;
    }
    signalsInspected += 1;
    lastSignalAt = signal.timestamp;

    history.push(result);
    if (history.length > historyLimit) history.splice(0, history.length - historyLimit);

    ledger.append({
      id: `osiris-${randomUUID()}`,
      timestamp: signal.timestamp,
      type: "osiris.detection",
      methodId: OSIRIS_METHOD_IDS.inspect,
      principal: signal.actorId ?? "osiris:sentinel",
      riskTier: SEVERITY_TO_RISK[result.maxSeverity],
      status: result.recommendation === "BLOCK_RECOMMENDED" ? "REVIEW_RECOMMENDED" : `${result.recommendation}_ADVISORY`,
    });

    return result;
  }

  function listFindings(limit?: number): readonly DetectionResult[] {
    const list = limit && limit > 0 ? history.slice(-limit) : history;
    return list.map((item) => Object.freeze({ ...item }));
  }

  function getSnapshot(): OsirisSnapshot {
    const verification = ledger.verify();
    const metrics: OsirisMetrics = Object.freeze({
      signalsInspected,
      findingsBySeverity: Object.freeze({ ...findingsBySeverity }),
      lastSignalAt,
    });
    return Object.freeze({
      module: OSIRIS_MODULE,
      version: OSIRIS_VERSION,
      metrics,
      posture: assessDefensePosture(options.posture?.() ?? {}, () => now().toISOString()),
      ledger: Object.freeze({
        count: verification.blocksValidated ?? 0,
        valid: verification.valid,
        chainHead: verification.chainHead,
        storage: verification.storage,
        durable: verification.durable,
      }),
      disclaimer: DISCLAIMER,
    });
  }

  return { inspect, listFindings, getSnapshot };
}

export const osirisSentinel = createOsirisSentinel();
