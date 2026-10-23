/**
 * Transparency log — árbol de Merkle append-only conforme a RFC 6962 / RFC 9162
 * (separación de dominio 0x00 hoja / 0x01 nodo), con pruebas de inclusión y de
 * consistencia verificables por terceros, y Signed Tree Heads Ed25519.
 *
 * state: draft | engine-generated (pendiente de revisión humana con nombre).
 *
 * Qué ES: estructura criptográfica verificable, en memoria, determinista.
 * Qué NO ES: no es WORM, no es durable, no es un anclaje RFC 3161 ni notarización
 * externa. CAPABILITY ≠ EVIDENCE: un STH firmado prueba consistencia del log para
 * quien conoce la clave pública, no que el contenido sea verdadero.
 *
 * Nota: `bookpi/merkle.ts` (chunking de manuscritos) se mantiene intacto por
 * compatibilidad; este módulo es el log de evidencia con semántica CT.
 */
import { createHash, sign as edSign, verify as edVerify, type KeyObject } from "node:crypto";

const LEAF_PREFIX = Buffer.from([0x00]);
const NODE_PREFIX = Buffer.from([0x01]);

function sha256(...parts: Buffer[]): Buffer {
  const h = createHash("sha256");
  for (const p of parts) h.update(p);
  return h.digest();
}

export function emptyTreeHash(): Buffer {
  return sha256();
}

export function hashLeaf(data: Uint8Array): Buffer {
  return sha256(LEAF_PREFIX, Buffer.from(data));
}

export function hashChildren(left: Buffer, right: Buffer): Buffer {
  return sha256(NODE_PREFIX, left, right);
}

/** Mayor potencia de 2 estrictamente menor que n (n >= 2). */
function splitPoint(n: number): number {
  let k = 1;
  while (k * 2 < n) k *= 2;
  return k;
}

function isPow2(n: number): boolean {
  return n > 0 && (n & (n - 1)) === 0;
}

export interface SignedTreeHead {
  readonly treeSize: number;
  readonly rootHash: string;
  readonly timestamp: string;
  readonly signature: string;
}

export function treeHeadMessage(treeSize: number, rootHash: string, timestamp: string): Buffer {
  return Buffer.from(`TAMV-STH-v1\n${treeSize}\n${rootHash}\n${timestamp}`, "utf8");
}

export class TransparencyLog {
  private readonly leaves: Buffer[] = [];

  get size(): number {
    return this.leaves.length;
  }

  /** Añade una entrada (bytes o texto UTF-8) y devuelve su índice. Append-only: no hay update/delete. */
  append(entry: Uint8Array | string): number {
    const data = typeof entry === "string" ? Buffer.from(entry, "utf8") : entry;
    this.leaves.push(hashLeaf(data));
    return this.leaves.length - 1;
  }

  leafHash(index: number): string {
    const leaf = this.leaves[index];
    if (leaf === undefined) throw new RangeError("TRANSPARENCY: leaf index out of range");
    return leaf.toString("hex");
  }

  private mth(lo: number, hi: number): Buffer {
    const n = hi - lo;
    if (n === 0) return emptyTreeHash();
    if (n === 1) {
      const leaf = this.leaves[lo];
      if (leaf === undefined) throw new RangeError("TRANSPARENCY: leaf index out of range");
      return leaf;
    }
    const k = splitPoint(n);
    return hashChildren(this.mth(lo, lo + k), this.mth(lo + k, hi));
  }

  /** Raíz del árbol de los primeros `size` elementos (por defecto, el log completo). */
  rootHash(size: number = this.leaves.length): string {
    this.assertSize(size);
    return this.mth(0, size).toString("hex");
  }

  private assertSize(size: number): void {
    if (!Number.isInteger(size) || size < 0 || size > this.leaves.length) {
      throw new RangeError("TRANSPARENCY: tree size out of range");
    }
  }

  /** Prueba de inclusión de `index` en el árbol de tamaño `size` (RFC 9162 §2.1.3.1). */
  inclusionProof(index: number, size: number = this.leaves.length): string[] {
    this.assertSize(size);
    if (!Number.isInteger(index) || index < 0 || index >= size) {
      throw new RangeError("TRANSPARENCY: leaf index out of range for tree size");
    }
    const path = (m: number, lo: number, hi: number): Buffer[] => {
      const n = hi - lo;
      if (n === 1) return [];
      const k = splitPoint(n);
      return m < k ? [...path(m, lo, lo + k), this.mth(lo + k, hi)] : [...path(m - k, lo + k, hi), this.mth(lo, lo + k)];
    };
    return path(index, 0, size).map((b) => b.toString("hex"));
  }

  /** Prueba de consistencia entre los árboles de tamaño `first` y `second` (RFC 9162 §2.1.4.1). */
  consistencyProof(first: number, second: number = this.leaves.length): string[] {
    this.assertSize(second);
    if (!Number.isInteger(first) || first < 1 || first > second) {
      throw new RangeError("TRANSPARENCY: first tree size must satisfy 1 <= first <= second");
    }
    if (first === second) return [];
    const subproof = (m: number, lo: number, hi: number, complete: boolean): Buffer[] => {
      const n = hi - lo;
      if (m === n) return complete ? [] : [this.mth(lo, hi)];
      const k = splitPoint(n);
      return m <= k
        ? [...subproof(m, lo, lo + k, complete), this.mth(lo + k, hi)]
        : [...subproof(m - k, lo + k, hi, false), this.mth(lo, lo + k)];
    };
    return subproof(first, 0, second, true).map((b) => b.toString("hex"));
  }

  /** Emite un Signed Tree Head Ed25519 sobre el estado actual. */
  signTreeHead(privateKey: KeyObject, now: Date = new Date()): SignedTreeHead {
    const treeSize = this.leaves.length;
    const rootHash = this.rootHash(treeSize);
    const timestamp = now.toISOString();
    const signature = edSign(null, treeHeadMessage(treeSize, rootHash, timestamp), privateKey).toString("base64");
    return { treeSize, rootHash, timestamp, signature };
  }
}

const HEX64 = /^[0-9a-f]{64}$/;

function toHash(hex: string): Buffer | null {
  return HEX64.test(hex) ? Buffer.from(hex, "hex") : null;
}

/** Verificación independiente de una prueba de inclusión (RFC 9162 §2.1.3.2). Fail-closed. */
export function verifyInclusion(params: {
  leafHash: string;
  index: number;
  treeSize: number;
  proof: readonly string[];
  rootHash: string;
}): boolean {
  const { index, treeSize } = params;
  if (!Number.isInteger(index) || !Number.isInteger(treeSize) || index < 0 || index >= treeSize) return false;
  let r = toHash(params.leafHash);
  const root = toHash(params.rootHash);
  if (r === null || root === null) return false;
  let fn = index;
  let sn = treeSize - 1;
  for (const p of params.proof) {
    const node = toHash(p);
    if (node === null || sn === 0) return false;
    if ((fn & 1) === 1 || fn === sn) {
      r = hashChildren(node, r);
      if ((fn & 1) === 0) {
        while ((fn & 1) === 0 && fn !== 0) {
          fn >>= 1;
          sn >>= 1;
        }
      }
    } else {
      r = hashChildren(r, node);
    }
    fn >>= 1;
    sn >>= 1;
  }
  return sn === 0 && r.equals(root);
}

/** Verificación independiente de una prueba de consistencia (RFC 9162 §2.1.4.2). Fail-closed. */
export function verifyConsistency(params: {
  firstSize: number;
  secondSize: number;
  firstRoot: string;
  secondRoot: string;
  proof: readonly string[];
}): boolean {
  const { firstSize, secondSize } = params;
  if (!Number.isInteger(firstSize) || !Number.isInteger(secondSize) || firstSize < 1 || firstSize > secondSize) return false;
  const firstRoot = toHash(params.firstRoot);
  const secondRoot = toHash(params.secondRoot);
  if (firstRoot === null || secondRoot === null) return false;
  if (firstSize === secondSize) return params.proof.length === 0 && firstRoot.equals(secondRoot);
  const nodes: Buffer[] = [];
  for (const p of params.proof) {
    const node = toHash(p);
    if (node === null) return false;
    nodes.push(node);
  }
  if (isPow2(firstSize)) nodes.unshift(firstRoot);
  const head = nodes[0];
  if (head === undefined) return false;
  let fn = firstSize - 1;
  let sn = secondSize - 1;
  while ((fn & 1) === 1) {
    fn >>= 1;
    sn >>= 1;
  }
  let fr = head;
  let sr = head;
  for (const c of nodes.slice(1)) {
    if (sn === 0) return false;
    if ((fn & 1) === 1 || fn === sn) {
      fr = hashChildren(c, fr);
      sr = hashChildren(c, sr);
      if ((fn & 1) === 0) {
        while ((fn & 1) === 0 && fn !== 0) {
          fn >>= 1;
          sn >>= 1;
        }
      }
    } else {
      sr = hashChildren(sr, c);
    }
    fn >>= 1;
    sn >>= 1;
  }
  return sn === 0 && fr.equals(firstRoot) && sr.equals(secondRoot);
}

/** Verifica la firma Ed25519 de un STH con la clave pública del operador del log. */
export function verifySignedTreeHead(head: SignedTreeHead, publicKey: KeyObject): boolean {
  if (!HEX64.test(head.rootHash) || !Number.isInteger(head.treeSize) || head.treeSize < 0) return false;
  try {
    return edVerify(null, treeHeadMessage(head.treeSize, head.rootHash, head.timestamp), publicKey, Buffer.from(head.signature, "base64"));
  } catch {
    return false;
  }
}
