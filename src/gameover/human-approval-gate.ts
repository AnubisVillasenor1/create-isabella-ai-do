/**
 * GAME OVER HumanApprovalGate (UAGP-1).
 *
 * Enforces the human-authority invariant: a governed action that policy marks as
 * requiring human approval must carry a named approver, and if an authenticated
 * principal is available it must match. state: draft | engine-generated. The
 * gate verifies the *presence* of an approver; it does not authenticate users.
 */
export interface HumanApprovalInput {
  readonly required: boolean;
  readonly requestedApprover?: string | null;
  readonly authenticatedPrincipal?: string | null;
}

export interface HumanApprovalResult {
  readonly required: boolean;
  readonly satisfied: boolean;
  readonly approver: string | null;
  readonly reason: string;
}

export function evaluateHumanApproval(input: HumanApprovalInput): HumanApprovalResult {
  if (!input.required) {
    return Object.freeze({
      required: false,
      satisfied: true,
      approver: null,
      reason: 'HUMAN_APPROVAL_NOT_REQUIRED',
    });
  }
  const approver =
    typeof input.requestedApprover === 'string' && input.requestedApprover.trim()
      ? input.requestedApprover.trim()
      : null;
  if (!approver) {
    return Object.freeze({
      required: true,
      satisfied: false,
      approver: null,
      reason: 'HUMAN_APPROVER_REQUIRED',
    });
  }
  const principal =
    typeof input.authenticatedPrincipal === 'string' && input.authenticatedPrincipal.trim()
      ? input.authenticatedPrincipal.trim()
      : null;
  if (!principal) {
    return Object.freeze({
      required: true,
      satisfied: false,
      approver,
      reason: 'HUMAN_AUTHENTICATED_PRINCIPAL_REQUIRED',
    });
  }
  if (principal !== approver) {
    return Object.freeze({
      required: true,
      satisfied: false,
      approver,
      reason: 'HUMAN_APPROVER_MISMATCH',
    });
  }
  return Object.freeze({ required: true, satisfied: true, approver, reason: 'HUMAN_APPROVED' });
}
