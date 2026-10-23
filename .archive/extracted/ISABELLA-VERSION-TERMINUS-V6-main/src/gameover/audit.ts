/**
 * GAME OVER AuditService (UAGP-1).
 *
 * Records every governance decision to an append-only BookPI ledger and keeps a
 * bounded in-memory view for inspection. state: draft | engine-generated. The
 * ledger is hash-chained; it is not a WORM device and does not provide hardware
 * immutability.
 */
import { randomUUID } from "node:crypto";
import { bookPiLedger } from "../bookpi/ledger";
import { GAMEOVER_METHOD_IDS } from "./types";

export interface GovernanceAuditLedger {
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

export interface AuditEntry {
  readonly id: string;
  readonly timestamp: string;
  readonly type: string;
  readonly methodId: string;
  readonly principal: string;
  readonly riskTier: string;
  readonly status: string;
  readonly hash: string;
  readonly sequence: number;
}

export interface RecordDecisionInput {
  readonly principal: string;
  readonly riskTier: string;
  readonly status: string;
  readonly type?: string;
  readonly methodId?: string;
}

export interface AuditService {
  record(input: RecordDecisionInput): AuditEntry;
  list(limit?: number): readonly AuditEntry[];
  snapshot(): {
    readonly count: number;
    readonly valid: boolean;
    readonly chainHead: string | null;
    readonly storage: string;
    readonly durable: boolean;
  };
}

export interface AuditServiceOptions {
  readonly ledger?: GovernanceAuditLedger;
  readonly now?: () => Date;
  readonly idFactory?: () => string;
  readonly historyLimit?: number;
}

const DEFAULT_TYPE = "gameover.governance.decision";
const DEFAULT_HISTORY_LIMIT = 500;

export function createAuditService(options: AuditServiceOptions = {}): AuditService {
  const ledger = options.ledger ?? bookPiLedger;
  const now = options.now ?? (() => new Date());
  const idFactory = options.idFactory ?? (() => `gameover-${randomUUID()}`);
  const historyLimit = options.historyLimit ?? DEFAULT_HISTORY_LIMIT;
  const history: AuditEntry[] = [];

  function record(input: RecordDecisionInput): AuditEntry {
    const id = idFactory();
    const timestamp = now().toISOString();
    const sealed = ledger.append({
      id,
      timestamp,
      type: input.type ?? DEFAULT_TYPE,
      methodId: input.methodId ?? GAMEOVER_METHOD_IDS.govern,
      principal: input.principal,
      riskTier: input.riskTier,
      status: input.status,
    });
    const entry: AuditEntry = Object.freeze({
      id,
      timestamp,
      type: input.type ?? DEFAULT_TYPE,
      methodId: input.methodId ?? GAMEOVER_METHOD_IDS.govern,
      principal: input.principal,
      riskTier: input.riskTier,
      status: input.status,
      hash: sealed.hash,
      sequence: sealed.sequence,
    });
    history.push(entry);
    if (history.length > historyLimit) history.splice(0, history.length - historyLimit);
    return entry;
  }

  function list(limit?: number): readonly AuditEntry[] {
    const slice = limit && limit > 0 ? history.slice(-limit) : history;
    return slice.map((entry) => Object.freeze({ ...entry }));
  }

  function snapshot() {
    const verification = ledger.verify();
    return Object.freeze({
      count: verification.blocksValidated ?? history.length,
      valid: verification.valid,
      chainHead: verification.chainHead,
      storage: verification.storage,
      durable: verification.durable,
    });
  }

  return { record, list, snapshot };
}
