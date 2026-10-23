/**
 * COMMERCE — subscription store (state: draft | engine-generated).
 *
 * Records the VERIFIED subscription state reported by an external payment
 * provider. Isabella does NOT process payments, does NOT store card data, and
 * does NOT infer a paid state without a provider reference. Transitions are
 * validated against an explicit state machine and every change is appended to
 * an in-memory audit trail.
 */
import type { PlanId, SubscriptionStatus } from "./types";
import { PLANS } from "./plans";

export interface SubscriptionRecord {
  readonly workspaceId: string;
  readonly planCode: PlanId;
  readonly status: SubscriptionStatus;
  readonly provider: string;
  readonly externalRef?: string;
  readonly currentPeriodEnd?: string;
  readonly updatedAt: string;
  readonly createdAt: string;
}

export interface SubscriptionEvent {
  readonly at: string;
  readonly workspaceId: string;
  readonly from: SubscriptionStatus | "none";
  readonly to: SubscriptionStatus;
  readonly planCode: PlanId;
  readonly reason: string;
}

export interface SubscriptionPersistence {
  get(workspaceId: string): Promise<SubscriptionRecord | null>;
  save(record: SubscriptionRecord): Promise<void>;
  list(): Promise<readonly SubscriptionRecord[]>;
}

export class InMemorySubscriptionPersistence implements SubscriptionPersistence {
  private readonly records = new Map<string, SubscriptionRecord>();

  async get(workspaceId: string): Promise<SubscriptionRecord | null> {
    return this.records.get(workspaceId) ?? null;
  }
  async save(record: SubscriptionRecord): Promise<void> {
    this.records.set(record.workspaceId, record);
  }
  async list(): Promise<readonly SubscriptionRecord[]> {
    return Object.freeze([...this.records.values()]);
  }
}

/** Allowed status transitions; a fresh subscription starts at `none`. */
const ALLOWED_TRANSITIONS: Record<SubscriptionStatus, readonly SubscriptionStatus[]> = {
  trialing: ["active", "past_due", "canceled", "suspended"],
  active: ["trialing", "past_due", "canceled", "suspended"],
  past_due: ["active", "canceled", "suspended"],
  canceled: ["active", "trialing"],
  suspended: ["active", "canceled"],
};

export interface SubscribeInput {
  readonly workspaceId: string;
  readonly planCode: PlanId;
  readonly provider: string;
  readonly externalRef: string;
  readonly status?: Extract<SubscriptionStatus, "active" | "trialing">;
  readonly currentPeriodEnd?: string;
  /** Explicit acknowledgement that an ENTERPRISE contract is in place. */
  readonly contract?: boolean;
}

export interface SubscriptionStoreOptions {
  readonly persistence?: SubscriptionPersistence;
  readonly now?: () => string;
  readonly eventLimit?: number;
}

export class SubscriptionStore {
  private readonly persistence: SubscriptionPersistence;
  private readonly now: () => string;
  private readonly eventLimit: number;
  private readonly events: SubscriptionEvent[] = [];

  constructor(options: SubscriptionStoreOptions = {}) {
    this.persistence = options.persistence ?? new InMemorySubscriptionPersistence();
    this.now = options.now ?? (() => new Date().toISOString());
    this.eventLimit = options.eventLimit ?? 1000;
  }

  private recordEvent(event: SubscriptionEvent): void {
    this.events.push(Object.freeze(event));
    if (this.events.length > this.eventLimit) this.events.splice(0, this.events.length - this.eventLimit);
  }

  private async transition(
    workspaceId: string,
    planCode: PlanId,
    next: SubscriptionStatus,
    provider: string,
    externalRef: string | undefined,
    reason: string,
    currentPeriodEnd?: string,
  ): Promise<SubscriptionRecord> {
    const existing = await this.persistence.get(workspaceId);
    const from: SubscriptionStatus | "none" = existing?.status ?? "none";
    if (existing && next !== existing.status && !ALLOWED_TRANSITIONS[existing.status].includes(next)) {
      throw new Error(`SUBSCRIPTION_TRANSITION_INVALID: ${existing.status} -> ${next}`);
    }
    if (!provider.trim()) throw new Error("SUBSCRIPTION_PROVIDER_REQUIRED");
    if (!externalRef || !externalRef.trim()) throw new Error("SUBSCRIPTION_PROVIDER_REFERENCE_REQUIRED");

    const now = this.now();
    const record: SubscriptionRecord = Object.freeze({
      workspaceId,
      planCode,
      status: next,
      provider,
      externalRef,
      currentPeriodEnd,
      updatedAt: now,
      createdAt: existing?.createdAt ?? now,
    });
    await this.persistence.save(record);
    this.recordEvent({ at: now, workspaceId, from, to: next, planCode, reason });
    return record;
  }

  /** Record a verified paid/trialing subscription from a provider reference. */
  async subscribe(input: SubscribeInput): Promise<SubscriptionRecord> {
    if (!input.workspaceId.trim()) throw new Error("SUBSCRIPTION_WORKSPACE_REQUIRED");
    if (PLANS[input.planCode].contractRequired && input.contract !== true) {
      throw new Error("SUBSCRIPTION_CONTRACT_REQUIRED");
    }
    const status = input.status ?? "active";
    return this.transition(input.workspaceId, input.planCode, status, input.provider, input.externalRef, "subscribe", input.currentPeriodEnd);
  }

  async upgrade(workspaceId: string, planCode: PlanId, provider: string, externalRef: string): Promise<SubscriptionRecord> {
    const existing = await this.persistence.get(workspaceId);
    const status = existing && (existing.status === "active" || existing.status === "trialing") ? existing.status : "active";
    return this.transition(workspaceId, planCode, status, provider, externalRef, "upgrade");
  }

  async markPastDue(workspaceId: string, provider: string, externalRef: string): Promise<SubscriptionRecord> {
    const existing = await this.require(workspaceId);
    return this.transition(workspaceId, existing.planCode, "past_due", provider, externalRef, "past_due");
  }

  async cancel(workspaceId: string, reason = "canceled"): Promise<SubscriptionRecord> {
    const existing = await this.require(workspaceId);
    return this.transition(workspaceId, existing.planCode, "canceled", existing.provider, existing.externalRef ?? "n/a", reason);
  }

  async suspend(workspaceId: string, reason = "suspended"): Promise<SubscriptionRecord> {
    const existing = await this.require(workspaceId);
    return this.transition(workspaceId, existing.planCode, "suspended", existing.provider, existing.externalRef ?? "n/a", reason);
  }

  async get(workspaceId: string): Promise<SubscriptionRecord | null> {
    return this.persistence.get(workspaceId);
  }

  /** Audit trail of transitions (most recent last). */
  history(): readonly SubscriptionEvent[] {
    return Object.freeze([...this.events]);
  }

  async list(): Promise<readonly SubscriptionRecord[]> {
    return this.persistence.list();
  }

  auditTrail(): readonly SubscriptionEvent[] {
    return Object.freeze([...this.events]);
  }

  /**
   * Effective plan/status for a workspace. A workspace without a record is a
   * FREE, active-tier workspace (the free tier is a valid state, not a
   * missing subscription).
   */
  async effective(workspaceId: string): Promise<{ planCode: PlanId; status: SubscriptionStatus }> {
    const existing = await this.persistence.get(workspaceId);
    return existing
      ? { planCode: existing.planCode, status: existing.status }
      : { planCode: "free", status: "active" };
  }

  private async require(workspaceId: string): Promise<SubscriptionRecord> {
    const existing = await this.persistence.get(workspaceId);
    if (!existing) throw new Error("SUBSCRIPTION_NOT_FOUND");
    return existing;
  }
}
