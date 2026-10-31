/**
 * IVCC-ECP-1 consent manager: explicit and granular grants, one-time usage
 * tokens stored only as hashes, permanent revocation, right to be forgotten and
 * a hash-chained audit log. Subject references are opaque and always hashed;
 * raw names, audio and biometric samples are never stored.
 */
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import {
  CONSENT_METHODS,
  CONSENT_SCOPES,
  IVCC_POLICY,
  type AuditEvent,
  type AuditEventType,
  type ConsentMethod,
  type ConsentRecord,
  type ConsentScope,
  type ConsentValidation,
  type IvccState,
} from './types';
import type { IvccStore } from './store';
import { appendAudit, verifyAuditChain } from './audit';
import { canonicalJson, parseIso, sha256Hex } from './util';

export const SUBJECT_REF_RE = /^(?:person|synthetic):[a-z0-9][a-z0-9:_-]{2,79}$/;
const MAX_CONSENT_DAYS = 730;

export class IvccConsentError extends Error {
  constructor(
    readonly code:
      | 'IVCC_SUBJECT_REF_INVALID'
      | 'IVCC_SUBJECT_SYNTHETIC_MANAGED'
      | 'IVCC_CONSENT_SCOPE_INVALID'
      | 'IVCC_CONSENT_METHOD_INVALID'
      | 'IVCC_CONSENT_ATTESTATION_REQUIRED'
      | 'IVCC_CONSENT_EVIDENCE_INVALID'
      | 'IVCC_CONSENT_EXPIRY_INVALID'
      | 'IVCC_CONSENT_NOT_FOUND',
    message: string
  ) {
    super(message);
    this.name = 'IvccConsentError';
  }
}

export function hashSubject(subjectRef: string, salt: Buffer): string {
  return createHash('sha256')
    .update(salt)
    .update('\u0000subject:')
    .update(subjectRef)
    .digest('hex');
}

export function hashActor(actor: string, salt: Buffer): string {
  return `actor:${createHash('sha256').update(salt).update('\u0000actor:').update(actor).digest('hex').slice(0, 16)}`;
}

export function hashUsageToken(token: string): string {
  return sha256Hex(`ivcc-usage:${token}`);
}

function hashEvidence(evidenceRef: string, salt: Buffer): string {
  return createHash('sha256')
    .update(salt)
    .update('\u0000evidence:')
    .update(evidenceRef)
    .digest('hex');
}

export function validateScopes(input: readonly string[]): ConsentScope[] {
  if (!Array.isArray(input) || input.length === 0) {
    throw new IvccConsentError(
      'IVCC_CONSENT_SCOPE_INVALID',
      'at least one consent scope is required'
    );
  }
  const seen = new Set<ConsentScope>();
  for (const scope of input) {
    if (!(CONSENT_SCOPES as readonly string[]).includes(scope)) {
      throw new IvccConsentError(
        'IVCC_CONSENT_SCOPE_INVALID',
        `unknown consent scope: ${String(scope)}`
      );
    }
    seen.add(scope as ConsentScope);
  }
  return [...seen];
}

function activeRecord(record: ConsentRecord, at: Date): boolean {
  if (record.revokedAt) return false;
  if (parseIso(record.grantedAt) && parseIso(record.grantedAt)! > at) return false;
  if (record.expiresAt && parseIso(record.expiresAt) && parseIso(record.expiresAt)! <= at)
    return false;
  return true;
}

export function validateConsentInState(
  state: IvccState,
  subjectHash: string,
  requiredScopes: readonly ConsentScope[],
  at: Date
): ConsentValidation {
  const records = state.consents.filter((record) => record.subjectHash === subjectHash);
  const active = records.filter((record) => activeRecord(record, at));
  const coveredScopes = [...new Set(active.flatMap((record) => record.scopes))];
  const missingScopes = requiredScopes.filter((scope) => !coveredScopes.includes(scope));
  const covering = active.filter((record) =>
    requiredScopes.every((scope) => record.scopes.includes(scope))
  );

  if (covering.length > 0) {
    const expiries = covering
      .map((record) => record.expiresAt)
      .filter((value): value is string => Boolean(value))
      .sort();
    return {
      valid: true,
      reason: 'VALID',
      subjectHash,
      consentIds: covering.map((record) => record.consentId),
      coveredScopes,
      missingScopes: [],
      expiresAt: expiries[0] ?? null,
    };
  }

  let reason: ConsentValidation['reason'] = 'NO_CONSENT';
  if (
    records.some(
      (record) => record.revokedAt && requiredScopes.every((scope) => record.scopes.includes(scope))
    )
  ) {
    reason = 'REVOKED';
  } else if (
    records.some(
      (record) =>
        record.expiresAt &&
        parseIso(record.expiresAt) &&
        parseIso(record.expiresAt)! <= at &&
        requiredScopes.every((scope) => record.scopes.includes(scope))
    )
  ) {
    reason = 'EXPIRED';
  } else if (active.length > 0) {
    reason = 'SCOPE_NOT_GRANTED';
  } else if (records.length > 0) {
    reason = records.every((record) => record.revokedAt) ? 'REVOKED' : 'EXPIRED';
  }

  return {
    valid: false,
    reason,
    subjectHash,
    consentIds: active.map((record) => record.consentId),
    coveredScopes,
    missingScopes,
    expiresAt: null,
  };
}

export function verifyUsageTokenInState(
  state: IvccState,
  token: string,
  subjectHash: string,
  requiredScopes: readonly ConsentScope[],
  at: Date
): ConsentValidation {
  const tokenHash = hashUsageToken(token);
  const record = state.usageTokens.find((item) => item.tokenHash === tokenHash);
  if (!record || record.revokedAt || record.subjectHash !== subjectHash) {
    return {
      valid: false,
      reason: 'USAGE_TOKEN_INVALID',
      subjectHash,
      consentIds: [],
      coveredScopes: [],
      missingScopes: [...requiredScopes],
      expiresAt: null,
    };
  }
  const consent = state.consents.find((item) => item.consentId === record.consentId);
  if (!consent || !activeRecord(consent, at)) {
    return {
      valid: false,
      reason: consent?.revokedAt ? 'REVOKED' : 'USAGE_TOKEN_INVALID',
      subjectHash,
      consentIds: [],
      coveredScopes: [],
      missingScopes: [...requiredScopes],
      expiresAt: null,
    };
  }
  const missingScopes = requiredScopes.filter((scope) => !consent.scopes.includes(scope));
  if (missingScopes.length > 0) {
    return {
      valid: false,
      reason: 'SCOPE_NOT_GRANTED',
      subjectHash,
      consentIds: [consent.consentId],
      coveredScopes: [...consent.scopes],
      missingScopes,
      expiresAt: consent.expiresAt,
    };
  }
  return {
    valid: true,
    reason: 'VALID',
    subjectHash,
    consentIds: [consent.consentId],
    coveredScopes: [...consent.scopes],
    missingScopes: [],
    expiresAt: consent.expiresAt,
  };
}

export interface ConsentTransaction {
  readonly state: IvccState;
  readonly now: Date;
  readonly nowIso: string;
  audit(
    event: AuditEventType,
    subjectHash: string | null,
    actor: string,
    detail: Readonly<Record<string, unknown>>
  ): AuditEvent;
}

export interface RegisterConsentResult {
  readonly consent: ConsentRecord;
  readonly usageToken: string;
  readonly subjectHash: string;
  readonly auditSeq: number;
}

export interface CheckConsentResult {
  readonly validation: ConsentValidation;
  readonly chainValid: boolean;
}

export interface RevokeResult {
  readonly found: boolean;
  readonly subjectHash: string | null;
  readonly revokedConsents: number;
  readonly revokedTokens: number;
  readonly erasedProfiles: number;
  readonly erasedMemoryEntries: number;
  readonly permanent: true;
  readonly auditSeq: number | null;
}

export interface AuditReadResult {
  readonly events: readonly AuditEvent[];
  readonly total: number;
  readonly chainValid: boolean;
}

export class IvccConsentManager {
  private tail: Promise<unknown> = Promise.resolve();

  constructor(
    readonly store: IvccStore,
    readonly subjectSalt: Buffer,
    private readonly now: () => Date = () => new Date()
  ) {}

  hashSubject(subjectRef: string): string {
    return hashSubject(subjectRef, this.subjectSalt);
  }

  hashActor(actor: string): string {
    return hashActor(actor, this.subjectSalt);
  }

  private enqueue<T>(task: () => Promise<T>): Promise<T> {
    const run = this.tail.then(task, task);
    this.tail = run.then(
      () => undefined,
      () => undefined
    );
    return run;
  }

  async transaction<T>(fn: (tx: ConsentTransaction) => T | Promise<T>): Promise<T> {
    return this.enqueue(async () => {
      const state = await this.store.read();
      const now = this.now();
      const nowIso = now.toISOString();
      const actorHash = (actor: string): string => hashActor(actor, this.subjectSalt);
      const tx: ConsentTransaction = {
        state,
        now,
        nowIso,
        audit: (event, subjectHash, actor, detail) =>
          appendAudit(state, { event, subjectHash, actor: actorHash(actor), detail, at: nowIso }),
      };
      const result = await fn(tx);
      await this.store.write(state);
      return result;
    });
  }

  async register(
    input: {
      subjectRef: string;
      scopes: readonly string[];
      method: string;
      evidenceRef: string;
      attestation: boolean;
      expiresAt?: string | null;
    },
    actor: string
  ): Promise<RegisterConsentResult> {
    if (!SUBJECT_REF_RE.test(input.subjectRef)) {
      throw new IvccConsentError(
        'IVCC_SUBJECT_REF_INVALID',
        'subjectRef must be an opaque lowercase reference such as person:abc123'
      );
    }
    if (input.subjectRef.startsWith('synthetic:')) {
      throw new IvccConsentError(
        'IVCC_SUBJECT_SYNTHETIC_MANAGED',
        'synthetic identities are managed by the operator baseline, not by registration'
      );
    }
    if (!(CONSENT_METHODS as readonly string[]).includes(input.method)) {
      throw new IvccConsentError(
        'IVCC_CONSENT_METHOD_INVALID',
        'consent method must be written-record, recorded-oral or digital-signature'
      );
    }
    if (input.attestation !== true) {
      throw new IvccConsentError(
        'IVCC_CONSENT_ATTESTATION_REQUIRED',
        'explicit attestation is required; consent cannot be implied'
      );
    }
    if (
      typeof input.evidenceRef !== 'string' ||
      input.evidenceRef.trim().length < 3 ||
      input.evidenceRef.length > 200
    ) {
      throw new IvccConsentError(
        'IVCC_CONSENT_EVIDENCE_INVALID',
        'an opaque evidence reference of 3..200 characters is required'
      );
    }
    const scopes = validateScopes(input.scopes);
    const now = this.now();
    let expiresAt: string | null = null;
    if (input.expiresAt) {
      const parsed = parseIso(input.expiresAt);
      if (
        !parsed ||
        parsed <= now ||
        parsed.getTime() > now.getTime() + MAX_CONSENT_DAYS * 86_400_000
      ) {
        throw new IvccConsentError(
          'IVCC_CONSENT_EXPIRY_INVALID',
          `expiry must be in the future and within ${MAX_CONSENT_DAYS} days`
        );
      }
      expiresAt = parsed.toISOString();
    }
    const subjectHash = hashSubject(input.subjectRef, this.subjectSalt);
    const consentId = `cns_${randomUUID().replace(/-/g, '')}`;
    const usageToken = `ivt_${randomBytes(24).toString('base64url')}`;
    const evidenceHash = hashEvidence(input.evidenceRef.trim(), this.subjectSalt);
    let auditSeq = 0;
    const consent: ConsentRecord = {
      consentId,
      subjectHash,
      scopes,
      grantedAt: now.toISOString(),
      expiresAt,
      revokedAt: null,
      method: input.method as ConsentMethod,
      evidenceHash,
      policy: IVCC_POLICY,
      synthetic: false,
      version: 1,
    };
    await this.transaction((tx) => {
      tx.state.consents.push(consent);
      tx.state.usageTokens.push({
        tokenHash: hashUsageToken(usageToken),
        consentId,
        subjectHash,
        createdAt: now.toISOString(),
        revokedAt: null,
      });
      auditSeq = tx.audit('consent.registered', subjectHash, actor, {
        consentId,
        scopes,
        method: input.method,
        expiresAt,
        evidenceHash,
        policy: IVCC_POLICY,
        usageTokenIssued: true,
      }).seq;
    });
    return { consent, usageToken, subjectHash, auditSeq };
  }

  async check(input: {
    subjectRef: string;
    scopes: readonly string[];
    actor: string;
  }): Promise<CheckConsentResult> {
    if (!SUBJECT_REF_RE.test(input.subjectRef)) {
      throw new IvccConsentError(
        'IVCC_SUBJECT_REF_INVALID',
        'subjectRef must be an opaque lowercase reference'
      );
    }
    const scopes = validateScopes(input.scopes);
    const subjectHash = hashSubject(input.subjectRef, this.subjectSalt);
    return this.transaction((tx) => {
      const validation = validateConsentInState(tx.state, subjectHash, scopes, tx.now);
      tx.audit('consent.checked', subjectHash, input.actor, {
        scopes,
        valid: validation.valid,
        reason: validation.reason,
        consentIds: validation.consentIds,
        missingScopes: validation.missingScopes,
      });
      return { validation, chainValid: verifyAuditChain(tx.state.audit) };
    });
  }

  async revoke(
    input: { subjectRef?: string; consentId?: string },
    actor: string
  ): Promise<RevokeResult> {
    let subjectHash: string | null = null;
    if (input.consentId) {
      const state = await this.store.read();
      const record = state.consents.find((item) => item.consentId === input.consentId);
      if (!record) {
        throw new IvccConsentError('IVCC_CONSENT_NOT_FOUND', 'consent not found');
      }
      subjectHash = record.subjectHash;
    } else if (input.subjectRef && SUBJECT_REF_RE.test(input.subjectRef)) {
      subjectHash = hashSubject(input.subjectRef, this.subjectSalt);
    } else {
      throw new IvccConsentError('IVCC_SUBJECT_REF_INVALID', 'subjectRef or consentId is required');
    }
    const targetHash = subjectHash;
    const consentIds = input.consentId ? [input.consentId] : undefined;
    return this.transaction((tx) => {
      let revokedConsents = 0;
      let revokedTokens = 0;
      const inScope = (subject: string) => subject === targetHash;
      for (const consent of tx.state.consents) {
        if (!inScope(consent.subjectHash)) continue;
        if (consentIds && !consentIds.includes(consent.consentId)) continue;
        if (!consent.revokedAt) {
          (consent as { revokedAt: string | null }).revokedAt = tx.nowIso;
          revokedConsents += 1;
        }
      }
      for (const token of tx.state.usageTokens) {
        if (!inScope(token.subjectHash)) continue;
        if (consentIds && !consentIds.includes(token.consentId)) continue;
        if (!token.revokedAt) {
          (token as { revokedAt: string | null }).revokedAt = tx.nowIso;
          revokedTokens += 1;
        }
      }
      const beforeProfiles = tx.state.profiles.length;
      tx.state.profiles = tx.state.profiles.filter((profile) => !inScope(profile.subjectHash));
      const erasedProfiles = beforeProfiles - tx.state.profiles.length;
      const memory = tx.state.memory[targetHash];
      const erasedMemoryEntries = memory?.entries.length ?? 0;
      delete tx.state.memory[targetHash];
      const found = revokedConsents + revokedTokens + erasedProfiles + (memory ? 1 : 0) > 0;
      const seq = tx.audit('consent.revoked', targetHash, actor, {
        consentId: input.consentId ?? null,
        revokedConsents,
        revokedTokens,
        erasedProfiles,
        erasedMemoryEntries,
        permanent: true,
      }).seq;
      return {
        found,
        subjectHash: targetHash,
        revokedConsents,
        revokedTokens,
        erasedProfiles,
        erasedMemoryEntries,
        permanent: true as const,
        auditSeq: seq,
      };
    });
  }

  async eraseMemory(
    subjectRef: string,
    actor: string
  ): Promise<{ erasedEntries: number; auditSeq: number; chainValid: boolean }> {
    if (!SUBJECT_REF_RE.test(subjectRef)) {
      throw new IvccConsentError(
        'IVCC_SUBJECT_REF_INVALID',
        'subjectRef must be an opaque lowercase reference'
      );
    }
    const subjectHash = hashSubject(subjectRef, this.subjectSalt);
    return this.transaction((tx) => {
      const entries = tx.state.memory[subjectHash]?.entries.length ?? 0;
      delete tx.state.memory[subjectHash];
      const seq = tx.audit('memory.erased', subjectHash, actor, { erasedEntries: entries }).seq;
      return {
        erasedEntries: entries,
        auditSeq: seq,
        chainValid: verifyAuditChain(tx.state.audit),
      };
    });
  }

  async readAudit(
    input: { subjectRef?: string; event?: string; limit?: number },
    actor: string
  ): Promise<AuditReadResult> {
    const subjectHash = input.subjectRef
      ? SUBJECT_REF_RE.test(input.subjectRef)
        ? hashSubject(input.subjectRef, this.subjectSalt)
        : null
      : null;
    const limit = Math.min(200, Math.max(1, Math.floor(input.limit ?? 50)));
    return this.transaction((tx) => {
      tx.audit('audit.read', subjectHash, actor, {
        subjectFilterHash: subjectHash,
        eventFilter: input.event ?? null,
        limit,
      });
      let events = [...tx.state.audit];
      if (subjectHash) events = events.filter((event) => event.subjectHash === subjectHash);
      if (input.event) events = events.filter((event) => event.event === input.event);
      const total = events.length;
      return { events: events.slice(-limit), total, chainValid: verifyAuditChain(tx.state.audit) };
    });
  }

  async snapshot(): Promise<IvccState> {
    return this.store.read();
  }
}

export function consentDigest(record: ConsentRecord): string {
  return sha256Hex(canonicalJson(record));
}
