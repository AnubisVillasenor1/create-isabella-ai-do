import { describe, expect, it } from 'vitest';
import { verifyAuditChain } from '../../src/ivcc/audit';
import { hashUsageToken, IvccConsentError, IvccConsentManager } from '../../src/ivcc/consent';
import { MemoryIvccStore } from '../../src/ivcc/store';

const SUBJECT_SALT = Buffer.alloc(32, 3);
const SUBJECT = 'person:ana-001';
const SCOPES = ['voice_profile:create', 'voice:synthesize', 'emotion:infer', 'prosody:memory'];

function manager(now: () => Date = () => new Date('2026-01-01T00:00:00.000Z')) {
  const store = new MemoryIvccStore();
  return { store, consent: new IvccConsentManager(store, SUBJECT_SALT, now) };
}

const grant = {
  subjectRef: SUBJECT,
  scopes: SCOPES,
  method: 'written-record',
  evidenceRef: 'vault://consent/2026/001',
  attestation: true,
};

describe('IVCC-ECP-1 consent manager', () => {
  it('requires explicit attestation, a human method and an opaque evidence reference', async () => {
    const { consent } = manager();
    await expect(consent.register({ ...grant, attestation: false }, 'admin')).rejects.toMatchObject(
      { code: 'IVCC_CONSENT_ATTESTATION_REQUIRED' }
    );
    await expect(
      consent.register({ ...grant, method: 'implied-by-usage' }, 'admin')
    ).rejects.toMatchObject({ code: 'IVCC_CONSENT_METHOD_INVALID' });
    await expect(consent.register({ ...grant, evidenceRef: 'x' }, 'admin')).rejects.toMatchObject({
      code: 'IVCC_CONSENT_EVIDENCE_INVALID',
    });
    await expect(
      consent.register({ ...grant, scopes: ['voice:clone-anyone'] }, 'admin')
    ).rejects.toMatchObject({ code: 'IVCC_CONSENT_SCOPE_INVALID' });
  });

  it('stores only salted subject hashes and hashed usage tokens', async () => {
    const { store, consent } = manager();
    const result = await consent.register(grant, 'admin');
    expect(result.usageToken).toMatch(/^ivt_/);
    expect(result.subjectHash).toMatch(/^[a-f0-9]{64}$/);
    const state = await store.read();
    const serialized = JSON.stringify(state);
    expect(serialized).not.toContain(SUBJECT);
    expect(serialized).not.toContain(result.usageToken);
    expect(state.usageTokens[0]?.tokenHash).toBe(hashUsageToken(result.usageToken));
    expect(state.consents[0]?.evidenceHash).toMatch(/^[a-f0-9]{64}$/);
    expect(serialized).not.toContain(grant.evidenceRef);
  });

  it('validates granular scopes and reports missing scopes', async () => {
    const { consent } = manager();
    await consent.register({ ...grant, scopes: ['voice:synthesize'] }, 'admin');
    const valid = await consent.check({
      subjectRef: SUBJECT,
      scopes: ['voice:synthesize'],
      actor: 'admin',
    });
    expect(valid.validation.valid).toBe(true);
    expect(valid.chainValid).toBe(true);
    const missing = await consent.check({
      subjectRef: SUBJECT,
      scopes: ['voice:synthesize', 'emotion:infer'],
      actor: 'admin',
    });
    expect(missing.validation.valid).toBe(false);
    expect(missing.validation.reason).toBe('SCOPE_NOT_GRANTED');
    expect(missing.validation.missingScopes).toEqual(['emotion:infer']);
  });

  it('expires grants deterministically without mutating the record', async () => {
    let now = new Date('2026-01-01T00:00:00.000Z');
    const { consent } = manager(() => now);
    await consent.register(
      { ...grant, scopes: ['voice:synthesize'], expiresAt: '2026-01-02T00:00:00.000Z' },
      'admin'
    );
    now = new Date('2026-01-03T00:00:00.000Z');
    const result = await consent.check({
      subjectRef: SUBJECT,
      scopes: ['voice:synthesize'],
      actor: 'admin',
    });
    expect(result.validation.valid).toBe(false);
    expect(result.validation.reason).toBe('EXPIRED');
  });

  it('revokes permanently and keeps a valid tamper-evident audit chain', async () => {
    const { store, consent } = manager();
    await consent.register(grant, 'admin');
    const revoked = await consent.revoke({ subjectRef: SUBJECT }, 'admin');
    expect(revoked.permanent).toBe(true);
    expect(revoked.revokedConsents).toBe(1);
    expect(revoked.revokedTokens).toBe(1);

    const after = await consent.check({
      subjectRef: SUBJECT,
      scopes: ['voice:synthesize'],
      actor: 'admin',
    });
    expect(after.validation.valid).toBe(false);
    expect(after.validation.reason).toBe('REVOKED');

    const state = await store.read();
    expect(state.consents[0]?.revokedAt).not.toBeNull();
    expect(state.usageTokens[0]?.revokedAt).not.toBeNull();
    expect(verifyAuditChain(state.audit)).toBe(true);
    expect(state.audit.map((event) => event.event)).toContain('consent.registered');
    expect(state.audit.map((event) => event.event)).toContain('consent.revoked');
  });

  it('rejects registration for synthetic subjects managed by the operator baseline', async () => {
    const { consent } = manager();
    await expect(
      consent.register({ ...grant, subjectRef: 'synthetic:isabella' }, 'admin')
    ).rejects.toBeInstanceOf(IvccConsentError);
  });

  it('never stores raw consent evidence in the audit log', async () => {
    const { consent } = manager();
    await consent.register(grant, 'admin');
    const audit = await consent.readAudit({}, 'admin');
    expect(audit.chainValid).toBe(true);
    expect(JSON.stringify(audit.events)).not.toContain(grant.evidenceRef);
    expect(JSON.stringify(audit.events)).not.toContain(SUBJECT);
  });
});
