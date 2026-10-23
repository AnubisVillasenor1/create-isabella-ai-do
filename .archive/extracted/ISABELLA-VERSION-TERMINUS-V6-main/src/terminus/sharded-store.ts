import { createCipheriv, createDecipheriv, createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { BOOKPI_PROTOCOL } from "../bookpi/types";
import type { BookPiStorage, JsonValue } from "../bookpi/types";
import { decodeShards, encodeShards, DATA_SHARDS, TOTAL_SHARDS } from "./erasure-code";
import type { ShardPiece } from "./erasure-code";
import { triangulateDigest, verifyTriangulatedDigest } from "../security/triangulated-crypto";
import type { TriangulatedDigest } from "../security/triangulated-crypto";
import type { RetentionAdmissionGate, RetentionAdmissionReservation } from "./retention";

export interface ShardQuota {
  /** Operator-configured hard cap; provider adapters must also enforce current upstream quota atomically. */
  maxBytes: number;
  maxObjects: number;
}

export interface StoredShard {
  schemaVersion: "terminus-shard.v1";
  objectId: string;
  tenantFingerprint: string;
  shardIndex: number;
  dataShards: typeof DATA_SHARDS;
  totalShards: typeof TOTAL_SHARDS;
  ciphertextLength: number;
  ciphertextSha256: string;
  keyId: string;
  ivHex: string;
  authTagHex: string;
  createdAt: string;
  payload: Uint8Array;
  shardSha256: string;
  triangulatedId: TriangulatedDigest;
}

export interface ShardStore {
  /** Unique failure domain/provider name (not merely a region or account alias). */
  readonly providerId: string;
  /**
   * Must be atomic, immutable/no-overwrite and fail closed when either the
   * operator cap or provider's current storage/write quota would be exceeded.
   */
  putIfWithinQuota(record: StoredShard, quota: ShardQuota): Promise<void>;
  get(objectId: string, tenantFingerprint: string, shardIndex: number): Promise<StoredShard | null>;
  delete(objectId: string, tenantFingerprint: string, shardIndex: number): Promise<void>;
  getUsage(): Promise<{ usedBytes: number; objectCount: number }>;
}

export interface DataKeyManager {
  createKey(context: { objectIdDigest: string; tenantFingerprint: string }): Promise<{ keyId: string; key: Uint8Array }>;
  getKey(keyId: string): Promise<Uint8Array | null>;
  /** Must be durable and idempotent; destroying the key is the logical erasure boundary. */
  destroyKey(keyId: string): Promise<void>;
}

export interface ShardedStoreOptions {
  stores: readonly ShardStore[];
  quotas: Readonly<Record<string, ShardQuota>>;
  keyManager: DataKeyManager;
  ledger: BookPiStorage;
  admissionGate: RetentionAdmissionGate;
  maxObjectBytes: number;
  clock?: () => number;
}

export interface StoredObjectRef {
  objectId: string;
  tenantFingerprint: string;
  keyId: string;
  ciphertextSha256: string;
  ciphertextLength: number;
  originalLength: number;
  createdAt: string;
  minimumRecoverableShards: typeof DATA_SHARDS;
  configuredShardCount: typeof TOTAL_SHARDS;
  successfulShardIndexes: number[];
  degraded: boolean;
}

function sha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function sameDigest(left: string, right: string): boolean {
  const a = Buffer.from(left, "hex");
  const b = Buffer.from(right, "hex");
  return a.length === 32 && b.length === 32 && timingSafeEqual(a, b);
}

function validHexDigest(value: string): boolean {
  return /^[a-f0-9]{64}$/i.test(value);
}

function tenantFingerprint(tenantId: string): string {
  // Pseudonymous identifier only; SHA-based fingerprints are not a confidentiality boundary.
  return triangulateDigest(tenantId).triangulated;
}

function additionalData(objectId: string, tenantId: string): Buffer {
  return Buffer.from("terminus-shard.v1\u0000" + objectId + "\u0000" + tenantId, "utf8");
}

function encrypt(plaintext: Uint8Array, key: Uint8Array, aad: Uint8Array): { ciphertext: Uint8Array; ivHex: string; authTagHex: string } {
  if (key.byteLength !== 32) throw new Error("TERMINUS_AES256_KEY_LENGTH_INVALID");
  const iv = randomBytes(12);
  const keyBuffer = Buffer.from(key);
  try {
    const cipher = createCipheriv("aes-256-gcm", keyBuffer, iv);
    cipher.setAAD(Buffer.from(aad));
    const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
    return { ciphertext, ivHex: iv.toString("hex"), authTagHex: cipher.getAuthTag().toString("hex") };
  } finally {
    keyBuffer.fill(0);
  }
}

function decrypt(ciphertext: Uint8Array, key: Uint8Array, ivHex: string, authTagHex: string, aad: Uint8Array): Uint8Array {
  if (key.byteLength !== 32) throw new Error("TERMINUS_AES256_KEY_LENGTH_INVALID");
  if (!/^[a-f0-9]{24}$/i.test(ivHex) || !/^[a-f0-9]{32}$/i.test(authTagHex)) throw new Error("TERMINUS_ENVELOPE_METADATA_INVALID");
  const keyBuffer = Buffer.from(key);
  try {
    const decipher = createDecipheriv("aes-256-gcm", keyBuffer, Buffer.from(ivHex, "hex"));
    decipher.setAAD(Buffer.from(aad));
    decipher.setAuthTag(Buffer.from(authTagHex, "hex"));
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  } finally {
    keyBuffer.fill(0);
  }
}

function validateQuota(quota: ShardQuota | undefined): quota is ShardQuota {
  return !!quota && Number.isSafeInteger(quota.maxBytes) && quota.maxBytes > 0
    && Number.isSafeInteger(quota.maxObjects) && quota.maxObjects > 0;
}

function makeRecord(
  objectId: string,
  tenant: string,
  index: number,
  encoded: ReturnType<typeof encodeShards>,
  payload: Uint8Array,
  encrypted: { ciphertext: Uint8Array; ivHex: string; authTagHex: string },
  keyId: string,
  createdAt: string,
): StoredShard {
  const tenantId = tenantFingerprint(tenant);
  const shardSha256 = sha256(payload);
  const binding = objectId + ":" + tenantId + ":" + index + ":" + shardSha256;
  return {
    schemaVersion: "terminus-shard.v1",
    objectId,
    tenantFingerprint: tenantId,
    shardIndex: index,
    dataShards: encoded.dataShards,
    totalShards: encoded.totalShards,
    ciphertextLength: encrypted.ciphertext.byteLength,
    ciphertextSha256: sha256(encrypted.ciphertext),
    keyId,
    ivHex: encrypted.ivHex,
    authTagHex: encrypted.authTagHex,
    createdAt,
    payload,
    shardSha256,
    triangulatedId: triangulateDigest(binding),
  };
}

/**
 * Encrypt-then-erasure-code store. Nine distinct provider adapters are required;
 * six valid shards reconstruct an object and tolerate up to three unavailable
 * or corrupted shards. This coordinator does not itself supply cloud adapters.
 */
export class TerminusShardedStore {
  private readonly clock: () => number;
  private readonly storesByIndex: readonly ShardStore[];

  constructor(private readonly options: ShardedStoreOptions) {
    const stores = [...options.stores];
    if (stores.length !== TOTAL_SHARDS || new Set(stores.map((store) => store.providerId)).size !== TOTAL_SHARDS
      || stores.some((store) => !store.providerId.trim())) {
      throw new Error("TERMINUS_REQUIRES_NINE_DISTINCT_STORAGE_PROVIDERS");
    }
    for (const store of stores) {
      if (!validateQuota(options.quotas[store.providerId])) throw new Error("TERMINUS_PROVIDER_QUOTA_MISSING_OR_INVALID:" + store.providerId);
    }
    if (!Number.isSafeInteger(options.maxObjectBytes) || options.maxObjectBytes < 1) throw new Error("TERMINUS_MAX_OBJECT_BYTES_INVALID");
    if (typeof options.admissionGate !== "function") throw new Error("TERMINUS_ADMISSION_GATE_REQUIRED");
    this.storesByIndex = Object.freeze(stores);
    this.clock = options.clock ?? Date.now;
  }

  async put(input: { objectId: string; tenantId: string; plaintext: string | Uint8Array }): Promise<StoredObjectRef> {
    if (!input.objectId.trim() || input.objectId.length > 180 || !input.tenantId.trim()) {
      throw new Error("TERMINUS_OBJECT_ID_OR_TENANT_INVALID");
    }
    const plaintext = typeof input.plaintext === "string"
      ? Buffer.from(input.plaintext, "utf8")
      : Buffer.from(input.plaintext);
    if (plaintext.byteLength > this.options.maxObjectBytes) {
      plaintext.fill(0);
      throw new Error("TERMINUS_OBJECT_MAX_BYTES_EXCEEDED");
    }

    const fingerprint = tenantFingerprint(input.tenantId);
    const objectIdDigest = sha256(Buffer.from(input.objectId, "utf8"));
    const createdAt = new Date(this.clock()).toISOString();
    let keyMaterial: { keyId: string; key: Uint8Array } | null = null;
    let admissionReservation: RetentionAdmissionReservation | null = null;
    let storedIndexes: number[] = [];
    let intentWritten = false;
    let completed = false;
    try {
      await this.audit("terminus.object.store.requested", {
        objectIdDigest, tenantFingerprint: fingerprint, originalLength: plaintext.byteLength, requestedAt: createdAt,
      });
      intentWritten = true;
      admissionReservation = await this.options.admissionGate({
        id: input.objectId, tenantFingerprint: fingerprint, byteLength: plaintext.byteLength,
      });
      keyMaterial = await this.options.keyManager.createKey({ objectIdDigest, tenantFingerprint: fingerprint });
      if (!keyMaterial.keyId.trim() || keyMaterial.key.byteLength !== 32) {
        throw new Error("TERMINUS_KEY_MANAGER_RETURNED_INVALID_KEY");
      }

      const envelope = encrypt(plaintext, keyMaterial.key, additionalData(input.objectId, input.tenantId));
      const encoded = encodeShards(envelope.ciphertext);
      const records = encoded.shards.map((bytes, index) =>
        makeRecord(input.objectId, input.tenantId, index, encoded, bytes, envelope, keyMaterial!.keyId, createdAt),
      );
      const writes = await Promise.allSettled(records.map((record, index) => {
        const store = this.storesByIndex[index]!;
        return store.putIfWithinQuota(record, this.options.quotas[store.providerId]!);
      }));
      storedIndexes = writes.flatMap((result, index) => result.status === "fulfilled" ? [index] : []);
      if (storedIndexes.length < DATA_SHARDS) {
        throw new Error("TERMINUS_SHARD_QUORUM_NOT_MET: durable shards available=" + storedIndexes.length + ", required=" + DATA_SHARDS);
      }

      const reference: StoredObjectRef = {
        objectId: input.objectId,
        tenantFingerprint: fingerprint,
        keyId: keyMaterial.keyId,
        ciphertextSha256: sha256(envelope.ciphertext),
        ciphertextLength: envelope.ciphertext.byteLength,
        originalLength: plaintext.byteLength,
        createdAt,
        minimumRecoverableShards: DATA_SHARDS,
        configuredShardCount: TOTAL_SHARDS,
        successfulShardIndexes: storedIndexes,
        degraded: storedIndexes.length < TOTAL_SHARDS,
      };
      await admissionReservation.commit();
      await this.audit("terminus.object.store.completed", {
        objectIdDigest, tenantFingerprint: fingerprint, ciphertextSha256: reference.ciphertextSha256,
        ciphertextLength: reference.ciphertextLength, successfulShardIndexes: storedIndexes,
        degraded: reference.degraded,
      });
      completed = true;
      return reference;
    } catch (error) {
      await Promise.allSettled(storedIndexes.map((index) => this.storesByIndex[index]!.delete(input.objectId, fingerprint, index)));
      if (keyMaterial) await this.options.keyManager.destroyKey(keyMaterial.keyId).catch(() => undefined);
      if (intentWritten) {
        await this.audit("terminus.object.store.failed", {
          objectIdDigest, tenantFingerprint: fingerprint, storedShardCount: storedIndexes.length,
          failure: error instanceof Error ? error.message : String(error),
        }).catch(() => undefined);
      }
      throw error;
    } finally {
      if (!completed && admissionReservation) await admissionReservation.release().catch(() => undefined);
      keyMaterial?.key.fill(0);
      plaintext.fill(0);
    }
  }

  async get(ref: StoredObjectRef, tenantId: string): Promise<Uint8Array> {
    this.assertRef(ref, tenantId);
    const results = await Promise.allSettled(this.storesByIndex.map((store, index) => store.get(ref.objectId, ref.tenantFingerprint, index)));
    const pieces: ShardPiece[] = [];
    const baseline: StoredShard[] = [];

    for (let index = 0; index < results.length; index += 1) {
      const result = results[index]!;
      if (result.status !== "fulfilled" || !result.value) continue;
      const record = result.value;
      if (record.schemaVersion !== "terminus-shard.v1" || record.objectId !== ref.objectId
        || record.shardIndex !== index || record.tenantFingerprint !== ref.tenantFingerprint || record.keyId !== ref.keyId
        || record.ciphertextLength !== ref.ciphertextLength || record.ciphertextSha256 !== ref.ciphertextSha256
        || record.dataShards !== DATA_SHARDS || record.totalShards !== TOTAL_SHARDS
        || !validHexDigest(record.shardSha256) || !sameDigest(sha256(record.payload), record.shardSha256)) continue;
      const binding = record.objectId + ":" + record.tenantFingerprint + ":" + record.shardIndex + ":" + record.shardSha256;
      try {
        if (!verifyTriangulatedDigest(binding, record.triangulatedId)) continue;
      } catch {
        continue;
      }
      pieces.push({ index: record.shardIndex, bytes: record.payload });
      baseline.push(record);
    }

    const uniquePieces = [...new Map(pieces.map((piece) => [piece.index, piece])).values()];
    if (uniquePieces.length < DATA_SHARDS || baseline.length === 0) throw new Error("TERMINUS_SHARD_QUORUM_UNAVAILABLE");
    const first = baseline[0]!;
    if (baseline.some((record) => record.ivHex !== first.ivHex || record.authTagHex !== first.authTagHex
      || record.ciphertextSha256 !== first.ciphertextSha256 || record.keyId !== first.keyId)) {
      throw new Error("TERMINUS_SHARD_METADATA_CONFLICT");
    }

    const ciphertext = decodeShards(uniquePieces, ref.ciphertextLength);
    if (!sameDigest(sha256(ciphertext), ref.ciphertextSha256)) throw new Error("TERMINUS_CIPHERTEXT_INTEGRITY_FAILURE");
    const key = await this.options.keyManager.getKey(ref.keyId);
    if (!key) throw new Error("TERMINUS_DATA_KEY_NOT_FOUND_OR_CRYPTOGRAPHICALLY_ERASED");
    let plaintext: Uint8Array | null = null;
    try {
      plaintext = decrypt(ciphertext, key, first.ivHex, first.authTagHex, additionalData(ref.objectId, tenantId));
      if (plaintext.byteLength !== ref.originalLength) throw new Error("TERMINUS_ORIGINAL_LENGTH_MISMATCH");
      await this.audit("terminus.object.read.completed", {
        objectIdDigest: sha256(Buffer.from(ref.objectId, "utf8")), tenantFingerprint: ref.tenantFingerprint,
        ciphertextSha256: ref.ciphertextSha256,
      });
      return plaintext;
    } catch (error) {
      plaintext?.fill(0);
      throw error;
    } finally {
      key.fill(0);
    }
  }

  async getText(ref: StoredObjectRef, tenantId: string): Promise<string> {
    const plaintext = await this.get(ref, tenantId);
    try {
      return Buffer.from(plaintext).toString("utf8");
    } finally {
      plaintext.fill(0);
    }
  }

  async erase(ref: StoredObjectRef, tenantId: string): Promise<{ cryptographicallyErased: true; deletedShards: number; failures: string[]; physicalDeletionComplete: boolean }> {
    this.assertRef(ref, tenantId);
    await this.audit("terminus.object.erase.requested", {
      objectIdDigest: sha256(Buffer.from(ref.objectId, "utf8")), tenantFingerprint: ref.tenantFingerprint,
      ciphertextSha256: ref.ciphertextSha256,
    });
    await this.options.keyManager.destroyKey(ref.keyId);
    const results = await Promise.allSettled(this.storesByIndex.map((store, index) =>
      store.delete(ref.objectId, ref.tenantFingerprint, index)));
    const failures = results.flatMap((result, index) => result.status === "rejected"
      ? [this.storesByIndex[index]!.providerId + ":" + String(result.reason)]
      : []);
    const deletedShards = results.filter((result) => result.status === "fulfilled").length;
    const physicalDeletionComplete = failures.length === 0;
    try {
      await this.audit(physicalDeletionComplete ? "terminus.object.erase.completed" : "terminus.object.erase.partial", {
        objectIdDigest: sha256(Buffer.from(ref.objectId, "utf8")), tenantFingerprint: ref.tenantFingerprint,
        deletedShards, failures, physicalDeletionComplete,
      });
    } catch (error) {
      failures.push("BOOKPI_AUDIT_OUTCOME_UNAVAILABLE:" + (error instanceof Error ? error.message : String(error)));
    }
    return { cryptographicallyErased: true, deletedShards, failures, physicalDeletionComplete: physicalDeletionComplete && failures.length === 0 };
  }

  async inspectUsage(): Promise<Array<{ providerId: string; usedBytes: number; objectCount: number; maxBytes: number; maxObjects: number; byteLimitReached: boolean; objectLimitReached: boolean }>> {
    return Promise.all(this.storesByIndex.map(async (store) => {
      const usage = await store.getUsage();
      const quota = this.options.quotas[store.providerId]!;
      return {
        providerId: store.providerId,
        ...usage,
        maxBytes: quota.maxBytes,
        maxObjects: quota.maxObjects,
        byteLimitReached: usage.usedBytes >= quota.maxBytes,
        objectLimitReached: usage.objectCount >= quota.maxObjects,
      };
    }));
  }

  private assertRef(ref: StoredObjectRef, tenantId: string): void {
    if (!ref || typeof ref.objectId !== "string" || !ref.objectId.trim()
      || typeof ref.keyId !== "string" || !ref.keyId.trim()
      || typeof ref.tenantFingerprint !== "string" || !validHexDigest(ref.ciphertextSha256)
      || ref.tenantFingerprint !== tenantFingerprint(tenantId)
      || !Number.isSafeInteger(ref.ciphertextLength) || ref.ciphertextLength < 0
      || !Number.isSafeInteger(ref.originalLength) || ref.originalLength < 0
      || typeof ref.createdAt !== "string" || !Number.isFinite(Date.parse(ref.createdAt))
      || ref.minimumRecoverableShards !== DATA_SHARDS || ref.configuredShardCount !== TOTAL_SHARDS
      || !Array.isArray(ref.successfulShardIndexes)
      || new Set(ref.successfulShardIndexes).size !== ref.successfulShardIndexes.length
      || ref.successfulShardIndexes.some((index) => !Number.isInteger(index) || index < 0 || index >= TOTAL_SHARDS)) {
      throw new Error("TERMINUS_OBJECT_REFERENCE_INVALID_OR_TENANT_MISMATCH");
    }
  }

  private async audit(type: string, payload: Record<string, string | number | boolean | string[] | number[]>): Promise<void> {
    await this.options.ledger.appendEvent({
      header: {
        type,
        source: "isabella.terminus-omega",
        protocol: BOOKPI_PROTOCOL,
        hehepcontext: { hexagon: "TERMINUS", domain: "SHARDED_STORAGE" },
      },
      schemaVersion: "terminus-storage.v1",
      meta: { retention: "payload-policy", audit: "append-only" },
      payload: JSON.parse(JSON.stringify(payload)) as JsonValue,
    }, { actorId: "terminus-omega" });
  }

}
