import { createHash, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";

export const API_KEY_SCOPES = ["cognition:read", "cognition:write", "memory:write", "admin:keys"] as const;
export type ApiKeyScope = (typeof API_KEY_SCOPES)[number];

export type IsabellaApiKeyRecord = {
  id: string;
  prefix: string;
  tenantId: string;
  name: string;
  scopes: readonly ApiKeyScope[];
  createdAt: string;
  expiresAt: string | null;
  revokedAt: string | null;
  lastUsedAt: string | null;
};

type StoredKey = IsabellaApiKeyRecord & { digest: Buffer };

export type CreateApiKeyInput = {
  tenantId: string;
  name: string;
  scopes: readonly ApiKeyScope[];
  expiresAt?: string | null;
};

export type IssuedApiKey = { secret: string; record: IsabellaApiKeyRecord };
export type ApiKeyVerification = { ok: true; record: IsabellaApiKeyRecord } | { ok: false; reason: "invalid" | "expired" | "revoked" | "scope" };

const PREFIX = "isa_live_";
const digestSecret = (secret: string): Buffer => createHash("sha256").update(secret, "utf8").digest();
const publicRecord = ({ digest: _digest, ...record }: StoredKey): IsabellaApiKeyRecord => record;
const validScope = (scope: string): scope is ApiKeyScope => (API_KEY_SCOPES as readonly string[]).includes(scope);

export class IsabellaApiKeyStore {
  private readonly keys = new Map<string, StoredKey>();

  issue(input: CreateApiKeyInput): IssuedApiKey {
    const tenantId = input.tenantId.trim();
    const name = input.name.trim();
    const scopes = [...new Set(input.scopes)];
    if (!tenantId || !name || scopes.length === 0 || scopes.some((scope) => !validScope(scope))) {
      throw new Error("API_KEY_INPUT_INVALID");
    }
    const expiresAt = input.expiresAt ?? null;
    if (expiresAt !== null && (!Number.isFinite(Date.parse(expiresAt)) || Date.parse(expiresAt) <= Date.now())) {
      throw new Error("API_KEY_EXPIRY_INVALID");
    }
    const issuedValue = `${PREFIX}${randomBytes(32).toString("base64url")}`;
    const record: StoredKey = {
      id: randomUUID(),
      prefix: issuedValue.slice(0, 16),
      tenantId,
      name,
      scopes,
      createdAt: new Date().toISOString(),
      expiresAt,
      revokedAt: null,
      lastUsedAt: null,
      digest: digestSecret(issuedValue),
    };
    this.keys.set(record.id, record);
    return { secret: issuedValue, record: publicRecord(record) };
  }

  list(tenantId?: string): IsabellaApiKeyRecord[] {
    return [...this.keys.values()]
      .filter((record) => !tenantId || record.tenantId === tenantId)
      .map(publicRecord);
  }

  revoke(id: string): boolean {
    const record = this.keys.get(id);
    if (!record || record.revokedAt) return false;
    record.revokedAt = new Date().toISOString();
    return true;
  }

  verify(secret: string, requiredScope?: ApiKeyScope, tenantId?: string): ApiKeyVerification {
    const digest = digestSecret(secret);
    for (const record of this.keys.values()) {
      if (!timingSafeEqual(record.digest, digest)) continue;
      if (tenantId && record.tenantId !== tenantId) return { ok: false, reason: "invalid" };
      if (record.revokedAt) return { ok: false, reason: "revoked" };
      if (record.expiresAt && Date.parse(record.expiresAt) <= Date.now()) return { ok: false, reason: "expired" };
      if (requiredScope && !record.scopes.includes(requiredScope)) return { ok: false, reason: "scope" };
      record.lastUsedAt = new Date().toISOString();
      return { ok: true, record: publicRecord(record) };
    }
    return { ok: false, reason: "invalid" };
  }
}
