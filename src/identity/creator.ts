import type { Principal } from './principal';

/**
 * Recognize the creator only by a stable server-verified principal ID.
 *
 * Roles are deliberately not sufficient here: a role can be trusted only when
 * the authentication adapter proves it was issued by the server-side identity
 * provider. Until that trust chain is wired and tested end-to-end, the explicit
 * configured ID is the only supported creator-recognition mechanism.
 */
export function isAuthenticatedCreatorPrincipal(
  principal: Principal,
  configuredCreatorPrincipalId: string | undefined
): boolean {
  if (principal.kind !== 'human') return false;
  const configuredId = configuredCreatorPrincipalId?.trim();
  return configuredId !== undefined && configuredId.length > 0 && principal.id === configuredId;
}
