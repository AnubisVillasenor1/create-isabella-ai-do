/**
 * Crypto-shredding por sujeto: cada sujeto tiene una DEK aleatoria AES-256-GCM
 * envuelta con una KEK derivada por HKDF. "Borrar" = destruir la DEK envuelta;
 * el texto cifrado remanente queda irrecuperable. Se conserva una lápida con
 * compromiso (sin datos personales) para evidencia de que el borrado ocurrió.
 *
 * state: draft | engine-generated (pendiente de revisión humana con nombre).
 *
 * Límites honestos: el almacén por defecto es volátil (en memoria); el borrado
 * criptográfico solo es efectivo si NO existen copias de la DEK ni de la KEK
 * fuera de este almacén (backups). No sustituye una evaluación ARCO/legal.
 */
import { createCipheriv, createDecipheriv, createHash, hkdfSync, randomBytes } from "node:crypto";

export interface WrappedDek {
  readonly iv: string;
  readonly ct: string;
  readonly tag: string;
}

/** Contrato de persistencia de DEKs envueltas. Las implementaciones durables deben borrar de verdad. */
export interface DekStore {
  get(subjectId: string): WrappedDek | undefined;
  set(subjectId: string, dek: WrappedDek): void;
  delete(subjectId: string): boolean;
}

export class InMemoryDekStore implements DekStore {
  private readonly map = new Map<string, WrappedDek>();
  get(subjectId: string): WrappedDek | undefined {
    return this.map.get(subjectId);
  }
  set(subjectId: string, dek: WrappedDek): void {
    this.map.set(subjectId, dek);
  }
  delete(subjectId: string): boolean {
    return this.map.delete(subjectId);
  }
}

export interface SealedRecord {
  readonly v: 1;
  readonly subjectId: string;
  readonly iv: string;
  readonly ct: string;
  readonly tag: string;
}

export interface ShredTombstone {
  readonly subjectIdCommitment: string;
  readonly shreddedAt: string;
  readonly reason: string;
}

export class SubjectShreddedError extends Error {
  constructor() {
    super("CRYPTO_SHRED: subject key was destroyed; data is irrecoverable");
    this.name = "SubjectShreddedError";
  }
}

function assertSubject(subjectId: string): void {
  if (typeof subjectId !== "string" || subjectId.length === 0 || subjectId.length > 256) {
    throw new Error("CRYPTO_SHRED: subjectId must be a non-empty string up to 256 chars");
  }
}

export class CryptoShredVault {
  private readonly kek: Buffer;
  private readonly tombstones = new Map<string, ShredTombstone>();
  private readonly salt = randomBytes(16);

  constructor(masterKey: Buffer, private readonly store: DekStore = new InMemoryDekStore()) {
    if (!Buffer.isBuffer(masterKey) || masterKey.length < 32) {
      throw new Error("CRYPTO_SHRED: masterKey must be a Buffer of at least 32 bytes");
    }
    this.kek = Buffer.from(hkdfSync("sha256", masterKey, Buffer.alloc(0), "TAMV/crypto-shred/v1/dek-wrap", 32));
  }

  private commit(subjectId: string): string {
    return createHash("sha256").update(this.salt).update(subjectId, "utf8").digest("hex");
  }

  isShredded(subjectId: string): boolean {
    return this.tombstones.has(this.commit(subjectId));
  }

  private dekFor(subjectId: string, create: boolean): Buffer {
    if (this.isShredded(subjectId)) throw new SubjectShreddedError();
    const existing = this.store.get(subjectId);
    if (existing !== undefined) {
      const d = createDecipheriv("aes-256-gcm", this.kek, Buffer.from(existing.iv, "base64"));
      d.setAAD(Buffer.from(`dek:${subjectId}`, "utf8"));
      d.setAuthTag(Buffer.from(existing.tag, "base64"));
      return Buffer.concat([d.update(Buffer.from(existing.ct, "base64")), d.final()]);
    }
    if (!create) throw new SubjectShreddedError();
    const dek = randomBytes(32);
    const iv = randomBytes(12);
    const c = createCipheriv("aes-256-gcm", this.kek, iv);
    c.setAAD(Buffer.from(`dek:${subjectId}`, "utf8"));
    const ct = Buffer.concat([c.update(dek), c.final()]);
    this.store.set(subjectId, { iv: iv.toString("base64"), ct: ct.toString("base64"), tag: c.getAuthTag().toString("base64") });
    return dek;
  }

  seal(subjectId: string, plaintext: Uint8Array | string): SealedRecord {
    assertSubject(subjectId);
    const dek = this.dekFor(subjectId, true);
    const iv = randomBytes(12);
    const c = createCipheriv("aes-256-gcm", dek, iv);
    c.setAAD(Buffer.from(`rec:${subjectId}`, "utf8"));
    const data = typeof plaintext === "string" ? Buffer.from(plaintext, "utf8") : Buffer.from(plaintext);
    const ct = Buffer.concat([c.update(data), c.final()]);
    dek.fill(0);
    return { v: 1, subjectId, iv: iv.toString("base64"), ct: ct.toString("base64"), tag: c.getAuthTag().toString("base64") };
  }

  open(record: SealedRecord): Buffer {
    assertSubject(record.subjectId);
    const dek = this.dekFor(record.subjectId, false);
    try {
      const d = createDecipheriv("aes-256-gcm", dek, Buffer.from(record.iv, "base64"));
      d.setAAD(Buffer.from(`rec:${record.subjectId}`, "utf8"));
      d.setAuthTag(Buffer.from(record.tag, "base64"));
      return Buffer.concat([d.update(Buffer.from(record.ct, "base64")), d.final()]);
    } finally {
      dek.fill(0);
    }
  }

  /** Destruye la DEK del sujeto. Idempotente. Devuelve la lápida (sin datos personales). */
  shred(subjectId: string, reason: string, now: Date = new Date()): ShredTombstone {
    assertSubject(subjectId);
    if (typeof reason !== "string" || reason.trim().length === 0) throw new Error("CRYPTO_SHRED: reason is required");
    const key = this.commit(subjectId);
    const prior = this.tombstones.get(key);
    if (prior !== undefined) return prior;
    this.store.delete(subjectId);
    const tombstone: ShredTombstone = { subjectIdCommitment: key, shreddedAt: now.toISOString(), reason: reason.trim() };
    this.tombstones.set(key, tombstone);
    return tombstone;
  }
}
