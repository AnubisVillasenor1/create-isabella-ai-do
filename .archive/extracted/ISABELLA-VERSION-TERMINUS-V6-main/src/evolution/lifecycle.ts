export type ControlLifecycle =
  | "ACTIVE"
  | "REVOKED"
  | "INVALIDATED"
  | "SUPERSEDED"
  | "DEPRECATED"
  | "ROLLBACK";

export interface LifecycleTransition {
  from: ControlLifecycle;
  to: ControlLifecycle;
  reason: string;
  evidenceRef: string;
}

const ALLOWED: Record<ControlLifecycle, readonly ControlLifecycle[]> = {
  ACTIVE: ["REVOKED", "INVALIDATED", "SUPERSEDED", "DEPRECATED", "ROLLBACK"],
  REVOKED: ["ACTIVE"],
  INVALIDATED: ["ACTIVE", "SUPERSEDED"],
  SUPERSEDED: ["DEPRECATED"],
  DEPRECATED: [],
  ROLLBACK: ["ACTIVE", "INVALIDATED"],
};

export function allowLifecycleTransition(from: ControlLifecycle, to: ControlLifecycle): boolean {
  return ALLOWED[from].includes(to);
}

export function assertLifecycleTransition(transition: LifecycleTransition): void {
  if (!allowLifecycleTransition(transition.from, transition.to)) {
    throw new Error(`EVOLUTION: invalid lifecycle transition ${transition.from} -> ${transition.to}`);
  }
  if (!transition.evidenceRef || !transition.reason) {
    throw new Error("EVOLUTION: lifecycle transitions require reason and evidence.");
  }
}
