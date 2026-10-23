/** CROWN capability gate — registration is mandatory and fail-closed. */
import type { GovernanceTier, RiskTier } from "../authority/method-id";
import type { ApprovalRef } from "../identity/approval";
import { verifyHumanApproval } from "../identity/approval";
import type { Principal } from "../identity/principal";

export interface CapabilityDescriptor {
  methodId: string; owner: string; allowedRoles: readonly string[]; riskTier: RiskTier;
  governanceTier: GovernanceTier; humanApprovalRequired: boolean;
}
export interface CapabilityVerdict { granted: boolean; reason: string; evidenceRef?: string; }
export interface CapabilityGate {
  /** Read-only policy view; mutation is only possible through registerCapability. */
  readonly descriptors: ReadonlyMap<string, CapabilityDescriptor>;
}

const capabilityMaps = new WeakMap<CapabilityGate, Map<string, CapabilityDescriptor>>();

function readOnlyMap<K, V>(map: Map<K, V>): ReadonlyMap<K, V> {
  let view: ReadonlyMap<K, V>;
  view = new Proxy(map, {
    get(target, property) {
      if (property === "set" || property === "delete" || property === "clear") return undefined;
      if (property === "forEach") {
        return (
          callbackfn: (value: V, key: K, map: ReadonlyMap<K, V>) => void,
          thisArg?: unknown,
        ) => target.forEach((value, key) => callbackfn.call(thisArg, value, key, view));
      }
      const value = Reflect.get(target, property, target) as unknown;
      return typeof value === "function" ? value.bind(target) : value;
    },
  }) as ReadonlyMap<K, V>;
  return view;
}

export function createCapabilityGate(descriptors: readonly CapabilityDescriptor[]): CapabilityGate {
  const mutable = new Map<string, CapabilityDescriptor>();
  const gate: CapabilityGate = { descriptors: readOnlyMap(mutable) };
  capabilityMaps.set(gate, mutable);
  for (const descriptor of descriptors) registerCapability(gate, descriptor);
  return gate;
}

export function registerCapability(gate: CapabilityGate, descriptor: CapabilityDescriptor): void {
  const registered = capabilityMaps.get(gate);
  if (!registered) throw new Error("CROWN: gate must be created by createCapabilityGate.");
  if (!descriptor.methodId || !descriptor.owner) throw new Error("CROWN: capability metadata is incomplete.");
  if (registered.has(descriptor.methodId)) throw new Error(`CROWN: capability already registered: ${descriptor.methodId}`);
  const frozenDescriptor: CapabilityDescriptor = Object.freeze({
    ...descriptor,
    allowedRoles: Object.freeze([...descriptor.allowedRoles]),
  });
  registered.set(frozenDescriptor.methodId, frozenDescriptor);
}
export interface CapabilityRequest {
  principal: Principal;
  approval?: ApprovalRef;
  action: string;
  resource: string;
  contextHash?: string;
  policyVersion?: string;
}
export function callGate(gate: CapabilityGate, methodId: string, req: CapabilityRequest): CapabilityVerdict {
  const descriptor = gate.descriptors.get(methodId);
  if (!descriptor) return { granted: false, reason: "capacidad no registrada (DENY)" };
  const hasRole = descriptor.allowedRoles.length > 0 && req.principal.roles.some((r) => descriptor.allowedRoles.includes(r));
  if (!hasRole) return { granted: false, reason: "el principal no tiene rol autorizado para esta capacidad" };
  if (descriptor.humanApprovalRequired || descriptor.riskTier === "HIGH" || descriptor.riskTier === "CRITICAL") {
    if (
      !req.approval ||
      req.approval.decision !== "ALLOW" ||
      !verifyHumanApproval(req.approval, {
        methodId,
        action: req.action,
        resource: req.resource,
        principalId: req.principal.id,
        contextHash: req.contextHash,
        policyVersion: req.policyVersion,
      })
    ) {
      return { granted: false, reason: "capacidad requiere aprobación humana ligada al contexto real de la solicitud" };
    }
    return { granted: true, reason: `capacidad invocada con aprobación humana ${req.approval.approver}`, evidenceRef: req.approval.evidenceId };
  }
  return { granted: true, reason: "capacidad registrada como invocable en modo no privilegiado" };
}
export function approvalRequiredForGate(descriptor: CapabilityDescriptor): boolean {
  return descriptor.humanApprovalRequired || descriptor.riskTier === "HIGH" || descriptor.riskTier === "CRITICAL";
}
