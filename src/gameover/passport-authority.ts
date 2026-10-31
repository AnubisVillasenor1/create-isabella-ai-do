/**
 * GAME OVER PassportAuthority (UAGP-1).
 *
 * Issues, stores, verifies and revokes AI Passports in memory. state: draft |
 * engine-generated. This is an application-level registry: it is NOT a
 * cryptographic identity provider and does NOT federate with an external CA.
 */
import { randomUUID } from 'node:crypto';
import { GAMEOVER_CONSTITUTION } from './constitution';
import type { PassportStorePort } from './passport-store';
import type { AgentIdentity, AIPassport, CertificationState, PassportVerification } from './types';

export interface IssuePassportInput {
  readonly agent: AgentIdentity;
  readonly issuer: string;
  readonly trustScore: number;
  readonly validityDays?: number;
  readonly id?: string;
}

export interface PassportAuthorityOptions {
  readonly now?: () => Date;
  readonly idFactory?: () => string;
  /** Optional durable sink; when present the registry survives restarts. */
  readonly store?: PassportStorePort;
}

export interface PassportAuthority {
  issue(input: IssuePassportInput): AIPassport;
  get(id: string): AIPassport | null;
  verify(id: string): PassportVerification;
  revoke(id: string, reason: string): AIPassport;
  list(): readonly AIPassport[];
}

function certificationFor(trustScore: number): CertificationState {
  const { certified, provisional } = GAMEOVER_CONSTITUTION.passportCertificationThresholds;
  if (trustScore >= certified) return 'CERTIFIED';
  if (trustScore >= provisional) return 'PROVISIONAL';
  return 'UNKNOWN';
}

function addDays(base: Date, days: number): Date {
  const next = new Date(base.getTime());
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

export function createPassportAuthority(options: PassportAuthorityOptions = {}): PassportAuthority {
  const now = options.now ?? (() => new Date());
  const idFactory = options.idFactory ?? (() => `GOP-${randomUUID()}`);
  const passports = new Map<string, AIPassport>();
  const store = options.store;
  for (const persisted of store?.load() ?? []) passports.set(persisted.id, persisted);

  function persist(): void {
    if (store) store.save(list());
  }

  function issue(input: IssuePassportInput): AIPassport {
    if (!input.agent || typeof input.agent.id !== 'string' || !input.agent.id.trim())
      throw new Error('PASSPORT_AGENT_ID_REQUIRED');
    if (typeof input.issuer !== 'string' || !input.issuer.trim())
      throw new Error('PASSPORT_ISSUER_REQUIRED');
    if (
      typeof input.trustScore !== 'number' ||
      !Number.isFinite(input.trustScore) ||
      input.trustScore < 0 ||
      input.trustScore > 100
    ) {
      throw new Error('PASSPORT_TRUST_SCORE_INVALID');
    }
    const validityDays = input.validityDays ?? GAMEOVER_CONSTITUTION.defaultPassportValidityDays;
    if (!Number.isInteger(validityDays) || validityDays < 1 || validityDays > 3650) {
      throw new Error('PASSPORT_VALIDITY_DAYS_INVALID');
    }
    const id = input.id ?? idFactory();
    if (typeof id !== 'string' || !id.trim()) throw new Error('PASSPORT_ID_REQUIRED');
    if (passports.has(id)) throw new Error('PASSPORT_ID_DUPLICATE');
    const issuedAt = now();
    const passport: AIPassport = Object.freeze({
      id,
      agent: Object.freeze({
        ...input.agent,
        capabilities: Object.freeze([...input.agent.capabilities]),
      }),
      issuedAt: issuedAt.toISOString(),
      expiresAt: addDays(issuedAt, validityDays).toISOString(),
      issuer: input.issuer.trim(),
      certification: certificationFor(input.trustScore),
      trustScore: input.trustScore,
    });
    passports.set(passport.id, passport);
    persist();
    return passport;
  }

  function get(id: string): AIPassport | null {
    const found = passports.get(id);
    return found ? Object.freeze({ ...found }) : null;
  }

  function verify(id: string): PassportVerification {
    const passport = passports.get(id);
    if (!passport) {
      return Object.freeze({
        id,
        valid: false,
        certification: 'UNKNOWN',
        reason: 'PASSPORT_NOT_FOUND',
        expiresAt: '',
      });
    }
    if (passport.certification === 'REVOKED') {
      return Object.freeze({
        id,
        valid: false,
        certification: 'REVOKED',
        reason: 'PASSPORT_REVOKED',
        expiresAt: passport.expiresAt,
      });
    }
    if (Date.parse(passport.expiresAt) <= now().getTime()) {
      return Object.freeze({
        id,
        valid: false,
        certification: passport.certification,
        reason: 'PASSPORT_EXPIRED',
        expiresAt: passport.expiresAt,
      });
    }
    if (passport.certification === 'UNKNOWN') {
      return Object.freeze({
        id,
        valid: false,
        certification: 'UNKNOWN',
        reason: 'PASSPORT_NOT_CERTIFIED',
        expiresAt: passport.expiresAt,
      });
    }
    return Object.freeze({
      id,
      valid: true,
      certification: passport.certification,
      reason: 'PASSPORT_VALID',
      expiresAt: passport.expiresAt,
    });
  }

  function revoke(id: string, reason: string): AIPassport {
    const passport = passports.get(id);
    if (!passport) throw new Error('PASSPORT_NOT_FOUND');
    if (!reason.trim()) throw new Error('PASSPORT_REVOKE_REASON_REQUIRED');
    const revoked: AIPassport = Object.freeze({
      ...passport,
      certification: 'REVOKED',
      revokedAt: now().toISOString(),
      revokedReason: reason.trim(),
    });
    passports.set(id, revoked);
    persist();
    return revoked;
  }

  function list(): readonly AIPassport[] {
    return [...passports.values()].map((passport) => Object.freeze({ ...passport }));
  }

  return { issue, get, verify, revoke, list };
}
