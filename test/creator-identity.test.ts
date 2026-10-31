import { describe, expect, it } from 'vitest';
import { createPrincipal } from '../src/identity/principal';
import { isAuthenticatedCreatorPrincipal } from '../src/identity/creator';

describe('isAuthenticatedCreatorPrincipal', () => {
  it('recognizes a human principal matching the configured server-side ID', () => {
    const principal = createPrincipal({ id: 'auth0|creator-123', kind: 'human' });
    expect(isAuthenticatedCreatorPrincipal(principal, 'auth0|creator-123')).toBe(true);
  });

  it('does not grant creator recognition from a role alone without the verified ID binding', () => {
    const principal = createPrincipal({
      id: 'verified-user-7',
      kind: 'human',
      roles: ['user', 'isabella:creator'],
    });
    expect(isAuthenticatedCreatorPrincipal(principal, undefined)).toBe(false);
  });

  it('does not authenticate by display name, alias or configured ID mismatch', () => {
    const principal = createPrincipal({
      id: 'ordinary-user',
      kind: 'human',
      displayName: 'Edwin Oswaldo Castillo Trejo (Anubis Villaseñor)',
      roles: ['isabella:creator'],
    });
    expect(isAuthenticatedCreatorPrincipal(principal, 'auth0|creator-123')).toBe(false);
  });

  it('never grants creator recognition to a machine principal', () => {
    const principal = createPrincipal({
      id: 'auth0|creator-123',
      kind: 'machine',
      roles: ['isabella:creator'],
    });
    expect(isAuthenticatedCreatorPrincipal(principal, 'auth0|creator-123')).toBe(false);
  });

  it('does not match an empty configured ID', () => {
    const principal = createPrincipal({ id: 'any-human', kind: 'human' });
    expect(isAuthenticatedCreatorPrincipal(principal, '  ')).toBe(false);
  });
});
