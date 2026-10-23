import { BOOKPI_PROTOCOL } from "../bookpi/types";
import type { BookPiStorage, JsonValue } from "../bookpi/types";

export interface RetentionObject {
  id: string;
  createdAt: string;
  byteLength: number;
  expiresAt?: string;
  legalHold?: boolean;
  pinned?: boolean;
  inUse?: boolean;
}

export interface RetentionPolicy {
  version: string;
  maxObjects: number;
  maxBytes: number;
  maxAgeMs: number;
  minimumAgeMs: number;
  batchSize: number;
}

export interface RetentionPlan {
  policyVersion: string;
  plannedAt: string;
  candidates: Array<{ id: string; reason: "EXPIRED" | "OLDEST_FIRST_CAPACITY" }>;
  currentObjects: number;
  projectedObjects: number;
  currentBytes: number;
  projectedBytes: number;
  capacitySatisfied: boolean;
  blockedBy: string[];
}

export interface RetentionAdmissionRequest {
  id: string;
  /** Pseudonymous tenant scope; raw tenant IDs must not be placed in the retention manifest. */
  tenantFingerprint: string;
  byteLength: number;
}
export interface RetentionAdmissionReservation {
  /** Commit a durable capacity reservation once the shards meet their quorum. */
  commit(): Promise<void>;
  /** Idempotently release a pending/committed reservation if storage does not complete. */
  release(): Promise<void>;
}
export type RetentionAdmissionGate = (input: RetentionAdmissionRequest) => Promise<RetentionAdmissionReservation>;

export interface RetentionRepository {
  /** If provided, the query must be tenant-scoped and exclude unrelated tenants' objects. */
  listObjects(tenantFingerprint?: string): Promise<readonly RetentionObject[]>;
  /** Erases mutable payload/shards only; never delete the BookPI audit ledger. */
  erasePayload(id: string, tenantFingerprint?: string): Promise<{ physicalDeletionComplete: boolean; details?: string }>;
  /**
   * Must atomically re-check tenant object/byte limits and create a durable reservation.
   * This is the serialization point across workers/replicas; process-local locks are insufficient.
   */
  reserveAdmission?(
    input: RetentionAdmissionRequest,
    policy: RetentionPolicy,
  ): Promise<RetentionAdmissionReservation>;
}

export interface RetentionAudit {
  append(type: string, payload: Record<string, string | number | boolean | string[]>): Promise<void>;
}

function validatePolicy(policy: RetentionPolicy): void {
  if (!policy.version.trim() || !Number.isSafeInteger(policy.maxObjects) || policy.maxObjects < 1
    || !Number.isSafeInteger(policy.maxBytes) || policy.maxBytes < 1
    || !Number.isSafeInteger(policy.maxAgeMs) || policy.maxAgeMs < 1
    || !Number.isSafeInteger(policy.minimumAgeMs) || policy.minimumAgeMs < 0
    || policy.minimumAgeMs > policy.maxAgeMs
    || !Number.isSafeInteger(policy.batchSize) || policy.batchSize < 1) {
    throw new Error("BOOKPI_RETENTION_POLICY_INVALID");
  }
}

function objectAge(item: RetentionObject, nowMs: number): number {
  return nowMs - Date.parse(item.createdAt);
}

function isExpired(item: RetentionObject, nowMs: number, policy: RetentionPolicy): boolean {
  const expires = item.expiresAt ? Date.parse(item.expiresAt) : Number.NaN;
  return (Number.isFinite(expires) && expires <= nowMs) || objectAge(item, nowMs) >= policy.maxAgeMs;
}

function deletable(item: RetentionObject, nowMs: number, policy: RetentionPolicy): boolean {
  if (item.legalHold || item.pinned || item.inUse) return false;
  return isExpired(item, nowMs, policy) || objectAge(item, nowMs) >= policy.minimumAgeMs;
}

function validateObjects(objects: readonly RetentionObject[], nowMs: number): number {
  const ids = new Set<string>();
  let totalBytes = 0;
  for (const item of objects) {
    const createdAt = Date.parse(item.createdAt);
    if (!item.id.trim() || ids.has(item.id) || !Number.isSafeInteger(item.byteLength) || item.byteLength < 0
      || !Number.isFinite(createdAt) || createdAt > nowMs
      || (item.expiresAt !== undefined && !Number.isFinite(Date.parse(item.expiresAt)))) {
      throw new Error("BOOKPI_RETENTION_OBJECT_INVALID_OR_DUPLICATE");
    }
    ids.add(item.id);
    totalBytes += item.byteLength;
    if (!Number.isSafeInteger(totalBytes)) throw new Error("BOOKPI_RETENTION_TOTAL_BYTES_OVERFLOW");
  }
  return totalBytes;
}

/** Deterministic retention plan; pinned/legal-hold/in-use objects are never evicted. */
export function planRetention(
  objects: readonly RetentionObject[],
  policy: RetentionPolicy,
  nowMs = Date.now(),
  admission?: { incomingBytes: number },
): RetentionPlan {
  validatePolicy(policy);
  if (admission && (!Number.isSafeInteger(admission.incomingBytes) || admission.incomingBytes < 0)) {
    throw new Error("BOOKPI_INCOMING_SIZE_INVALID");
  }
  const totalBytes = validateObjects(objects, nowMs);
  const incomingCount = admission ? 1 : 0;
  const incomingBytes = admission?.incomingBytes ?? 0;
  let count = objects.length;
  let bytes = totalBytes;
  const candidates: RetentionPlan["candidates"] = [];
  const eligible = objects
    .filter((item) => deletable(item, nowMs, policy))
    .sort((a, b) => {
      const expiredA = isExpired(a, nowMs, policy);
      const expiredB = isExpired(b, nowMs, policy);
      if (expiredA !== expiredB) return expiredA ? -1 : 1;
      return objectAge(b, nowMs) - objectAge(a, nowMs) || a.id.localeCompare(b.id);
    });

  for (const item of eligible) {
    const expired = isExpired(item, nowMs, policy);
    const overCapacity = count + incomingCount > policy.maxObjects || bytes + incomingBytes > policy.maxBytes;
    if (!expired && !overCapacity) continue;
    if (candidates.length >= policy.batchSize) break;
    candidates.push({ id: item.id, reason: expired ? "EXPIRED" : "OLDEST_FIRST_CAPACITY" });
    count -= 1;
    bytes -= item.byteLength;
  }

  const blockedBy: string[] = [];
  if (count > policy.maxObjects) blockedBy.push("MAX_OBJECT_COUNT_BLOCKED_BY_HOLD_OR_BATCH_LIMIT");
  if (bytes > policy.maxBytes) blockedBy.push("MAX_BYTE_CAP_BLOCKED_BY_HOLD_OR_BATCH_LIMIT");
  if (objects.some((item) => item.legalHold || item.pinned || item.inUse) && blockedBy.length > 0) blockedBy.push("PROTECTED_OBJECTS_PRESENT");

  return {
    policyVersion: policy.version,
    plannedAt: new Date(nowMs).toISOString(),
    candidates,
    currentObjects: objects.length,
    projectedObjects: count,
    currentBytes: totalBytes,
    projectedBytes: bytes,
    capacitySatisfied: count + incomingCount <= policy.maxObjects && bytes + incomingBytes <= policy.maxBytes,
    blockedBy,
  };
}

export interface WriteCapacityDecision {
  admitted: boolean;
  requiresRetentionSweep: boolean;
  reason: "CAPACITY_AVAILABLE" | "RETENTION_REQUIRED_BEFORE_ADMISSION" | "CAPACITY_BLOCKED";
  currentObjects: number;
  projectedObjects: number;
  currentBytes: number;
  projectedBytes: number;
  candidateIds: string[];
}

/**
 * Call before each logical object write. Existing objects are not silently
 * deleted on the hot path; the writer must run the audited sweep and retry.
 */
export function checkWriteCapacity(
  objects: readonly RetentionObject[],
  incomingBytes: number,
  policy: RetentionPolicy,
  nowMs = Date.now(),
): WriteCapacityDecision {
  if (!Number.isSafeInteger(incomingBytes) || incomingBytes < 0) throw new Error("BOOKPI_INCOMING_SIZE_INVALID");
  const plan = planRetention(objects, policy, nowMs, { incomingBytes });
  const projectedObjects = plan.projectedObjects + 1;
  const projectedBytes = plan.projectedBytes + incomingBytes;
  if (!Number.isSafeInteger(projectedBytes)) throw new Error("BOOKPI_PROJECTED_BYTES_OVERFLOW");
  if (plan.candidates.length > 0) {
    return {
      admitted: false,
      requiresRetentionSweep: true,
      reason: "RETENTION_REQUIRED_BEFORE_ADMISSION",
      currentObjects: plan.currentObjects,
      projectedObjects,
      currentBytes: plan.currentBytes,
      projectedBytes,
      candidateIds: plan.candidates.map((candidate) => candidate.id),
    };
  }
  const blocked = !plan.capacitySatisfied;
  return {
    admitted: !blocked,
    requiresRetentionSweep: false,
    reason: blocked ? "CAPACITY_BLOCKED" : "CAPACITY_AVAILABLE",
    currentObjects: plan.currentObjects,
    projectedObjects,
    currentBytes: plan.currentBytes,
    projectedBytes,
    candidateIds: [],
  };
}

function jsonValue(value: unknown): JsonValue {
  return value as JsonValue;
}

/** Adapter that writes retention events as BookPI append-only records. */
export function createBookPiRetentionAudit(ledger: BookPiStorage): RetentionAudit {
  return {
    async append(type, payload) {
      await ledger.appendEvent({
        header: {
          type,
          source: "isabella.terminus-omega",
          protocol: BOOKPI_PROTOCOL,
          hehepcontext: { hexagon: "BOOKPI", domain: "RETENTION" },
        },
        schemaVersion: "bookpi-retention.v1",
        meta: { policy: "bounded-retention-v1" },
        payload: jsonValue(payload),
      });
    },
  };
}

/**
 * A sweep first appends its intent, then performs idempotent payload erasure, then
 * appends per-object completion. If the intent audit fails, nothing is deleted.
 */
export async function runRetentionSweep(
  repository: RetentionRepository,
  audit: RetentionAudit,
  policy: RetentionPolicy,
  nowMs = Date.now(),
  tenantFingerprint?: string,
  admission?: { incomingBytes: number },
): Promise<{ plan: RetentionPlan; erased: string[]; failed: Array<{ id: string; reason: string }> }> {
  const plan = planRetention(await repository.listObjects(tenantFingerprint), policy, nowMs, admission);
  if (plan.candidates.length === 0) return { plan, erased: [], failed: [] };

  await audit.append("bookpi.retention.requested", {
    policyVersion: policy.version,
    plannedAt: plan.plannedAt,
    ...(tenantFingerprint ? { tenantFingerprint } : {}),
    ...(admission ? { admissionIncomingBytes: admission.incomingBytes } : {}),
    candidateIds: plan.candidates.map((candidate) => candidate.id),
    candidateCount: plan.candidates.length,
    projectedObjects: plan.projectedObjects,
    projectedBytes: plan.projectedBytes,
  });

  const erased: string[] = [];
  const failed: Array<{ id: string; reason: string }> = [];
  for (const candidate of plan.candidates) {
    let physicalDeletionComplete = false;
    try {
      const result = await repository.erasePayload(candidate.id, tenantFingerprint);
      if (!result.physicalDeletionComplete) throw new Error(result.details ?? "PHYSICAL_DELETION_INCOMPLETE");
      physicalDeletionComplete = true;
      erased.push(candidate.id);
    } catch (error) {
      failed.push({ id: candidate.id, reason: error instanceof Error ? error.message : String(error) });
    }

    try {
      await audit.append(physicalDeletionComplete ? "bookpi.retention.completed" : "bookpi.retention.failed", {
        policyVersion: policy.version,
        objectId: candidate.id,
        ...(tenantFingerprint ? { tenantFingerprint } : {}),
        reason: candidate.reason,
        physicalDeletionComplete,
        completedAt: new Date(nowMs).toISOString(),
      });
    } catch (error) {
      failed.push({ id: candidate.id, reason: "RETENTION_RESULT_AUDIT_FAILED: " + (error instanceof Error ? error.message : String(error)) });
    }
  }
  return { plan, erased, failed };
}


/**
 * Tenant-scoped admission gate. It runs an audited sweep only when the current
 * policy identifies expired/capacity candidates, then requires the repository
 * to reserve capacity atomically in durable storage before returning.
 */
export function createRetentionAdmissionGate(
  repository: RetentionRepository,
  audit: RetentionAudit,
  policy: RetentionPolicy,
  clock: () => number = Date.now,
): RetentionAdmissionGate {
  return async (input) => {
    if (!input.id?.trim() || !input.tenantFingerprint?.trim()
      || !Number.isSafeInteger(input.byteLength) || input.byteLength < 0) {
      throw new Error("TERMINUS_ADMISSION_INPUT_INVALID");
    }
    if (typeof repository.reserveAdmission !== "function") {
      throw new Error("TERMINUS_ATOMIC_ADMISSION_RESERVATION_REQUIRED");
    }

    let objects = await repository.listObjects(input.tenantFingerprint);
    if (objects.some((item) => item.id === input.id)) throw new Error("TERMINUS_OBJECT_ID_ALREADY_RETAINED");
    let decision = checkWriteCapacity(objects, input.byteLength, policy, clock());
    // Each pass is bounded by the policy batch size; multiple passes handle large
    // cleanup sets without deleting unbounded data in a single request.
    const maxSweepPasses = Math.max(1, Math.ceil((objects.length + 1) / policy.batchSize) + 1);
    let sweepPasses = 0;
    while (decision.requiresRetentionSweep && sweepPasses < maxSweepPasses) {
      const sweep = await runRetentionSweep(
        repository, audit, policy, clock(), input.tenantFingerprint, { incomingBytes: input.byteLength },
      );
      if (sweep.failed.length > 0) throw new Error("TERMINUS_RETENTION_SWEEP_INCOMPLETE");
      if (sweep.erased.length === 0) throw new Error("TERMINUS_RETENTION_SWEEP_NO_PROGRESS");
      objects = await repository.listObjects(input.tenantFingerprint);
      if (objects.some((item) => item.id === input.id)) throw new Error("TERMINUS_OBJECT_ID_ALREADY_RETAINED");
      decision = checkWriteCapacity(objects, input.byteLength, policy, clock());
      sweepPasses += 1;
    }

    if (!decision.admitted) throw new Error("TERMINUS_CAPACITY_BLOCKED:" + decision.reason);

    // The repository transaction must re-check both count and bytes as concurrent
    // writers may have reserved space since the read/planning phase above.
    return repository.reserveAdmission(input, policy);
  };
}

