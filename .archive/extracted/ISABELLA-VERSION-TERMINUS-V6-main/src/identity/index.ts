export {
  createPrincipal, assertBalancedAuthority, isHuman,
  type Principal, type PrincipalContext, type PrincipalKind,
} from "./principal";
export {
  createRbacPolicy, resolvePermissions, principalPermissions, hasPermission,
  type RbacPolicy, type RolePolicy,
} from "./rbac";
export {
  decidePdp, overrideWithHumanApproval, isPrivileged,
  type AttributeCondition, type PdpDecision, type PdpDeps, type PdpEffect, type PdpRequest,
} from "./pdp";
export {
  createConsentRegistry, requireConsent,
  type ConsentRecord, type ConsentRegistryLike, type ConsentRequirement,
} from "./consent";
export {
  createTenantCatalog, tenantIsActive, isolatedAccess,
  type Tenant, type TenantCatalog,
} from "./tenant";
export {
  issueHumanApproval, isRecentApproval, verifyHumanApproval, createApprovalReplayRegistry, approvalSignerFromEnvironment,
  type ApprovalRef, type ApprovalTarget, type ApprovalSigner, type ApprovalReplayRegistry,
} from "./approval";
