/**
 * Kill switch con alcance, expiración y órdenes firmadas Ed25519.
 *
 * state: draft | engine-generated. Es una compuerta de CONSULTA: el llamador debe
 * invocar `assertNotHalted(scope)` antes de actuar (fail-closed); este módulo no
 * detiene procesos por sí mismo.
 *
 * - ENGAGE: una firma de un emisor autorizado, fresca (±skew), con nonce no repetido.
 *   Duración acotada (`maxDurationMs`): un paro sin renovación se levanta solo.
 * - RELEASE: GLOBAL exige 2 emisores distintos (control dual); otros alcances, 1.
 * - Bandera de entorno `ISA_KILL_SWITCH=1` (inyectada como `envFlag`) detiene GLOBAL
 *   sin firma y no puede levantarse por RELEASE: requiere retirar la variable.
 * - Alcances: "GLOBAL" o cadenas como "federation:ECONOMY". GLOBAL cubre todos.
 */
import { sign as edSign, verify as edVerify, type KeyObject } from "node:crypto";

export type KillAction = "ENGAGE" | "RELEASE";

export interface KillCommand {
  readonly action: KillAction;
  readonly scope: string;
  readonly issuer: string;
  readonly issuedAt: string;
  readonly nonce: string;
  readonly reason: string;
  readonly signature: string;
}

export function killMessage(c: Omit<KillCommand, "signature">): Buffer {
  return Buffer.from(`TAMV-KILL-v1\n${c.action}\n${c.scope}\n${c.issuer}\n${c.issuedAt}\n${c.nonce}\n${c.reason}`, "utf8");
}

export function signKillCommand(privateKey: KeyObject, c: Omit<KillCommand, "signature">): KillCommand {
  return { ...c, signature: edSign(null, killMessage(c), privateKey).toString("base64") };
}

export class HaltedError extends Error {
  constructor(readonly scope: string) {
    super(`KILL_SWITCH: scope ${scope} is halted`);
    this.name = "HaltedError";
  }
}

export interface KillSwitchOptions {
  readonly authorizedKeys: ReadonlyMap<string, KeyObject>;
  readonly envFlag?: boolean;
  readonly maxDurationMs?: number;
  readonly skewMs?: number;
}

interface Halt {
  readonly since: number;
  readonly expiresAt: number;
  readonly issuer: string;
  readonly reason: string;
}

const SCOPE = /^[A-Za-z0-9_:.\-]{1,128}$/;

export class KillSwitch {
  private readonly halts = new Map<string, Halt>();
  private readonly seenNonces = new Set<string>();
  private readonly maxDurationMs: number;
  private readonly skewMs: number;

  constructor(private readonly opts: KillSwitchOptions) {
    this.maxDurationMs = opts.maxDurationMs ?? 60 * 60 * 1000;
    this.skewMs = opts.skewMs ?? 60 * 1000;
    if (!Number.isFinite(this.maxDurationMs) || this.maxDurationMs <= 0) throw new RangeError("KILL_SWITCH: maxDurationMs must be positive");
  }

  private verify(c: KillCommand, now: number): void {
    if (!SCOPE.test(c.scope)) throw new Error("KILL_SWITCH: invalid scope");
    if (c.nonce.length < 8 || c.nonce.length > 128) throw new Error("KILL_SWITCH: invalid nonce");
    const key = this.opts.authorizedKeys.get(c.issuer);
    if (key === undefined) throw new Error("KILL_SWITCH: issuer not authorized");
    const issued = Date.parse(c.issuedAt);
    if (!Number.isFinite(issued) || Math.abs(now - issued) > this.skewMs) throw new Error("KILL_SWITCH: command not fresh");
    let ok = false;
    try {
      const { signature, ...unsigned } = c;
      ok = edVerify(null, killMessage(unsigned), key, Buffer.from(signature, "base64"));
    } catch {
      ok = false;
    }
    if (!ok) throw new Error("KILL_SWITCH: invalid signature");
  }

  private consumeNonce(c: KillCommand): void {
    const id = `${c.issuer}:${c.nonce}`;
    if (this.seenNonces.has(id)) throw new Error("KILL_SWITCH: nonce replay");
    this.seenNonces.add(id);
  }

  engage(c: KillCommand, now: number = Date.now()): void {
    if (c.action !== "ENGAGE") throw new Error("KILL_SWITCH: expected ENGAGE command");
    this.verify(c, now);
    this.consumeNonce(c);
    this.halts.set(c.scope, { since: now, expiresAt: now + this.maxDurationMs, issuer: c.issuer, reason: c.reason });
  }

  /** GLOBAL exige control dual (≥2 emisores distintos); el resto, 1. */
  release(commands: readonly KillCommand[], now: number = Date.now()): void {
    const first = commands[0];
    if (first === undefined) throw new Error("KILL_SWITCH: no release commands");
    const scope = first.scope;
    if (this.opts.envFlag === true && scope === "GLOBAL") throw new Error("KILL_SWITCH: environment flag active; remove ISA_KILL_SWITCH to release");
    const issuers = new Set<string>();
    for (const c of commands) {
      if (c.action !== "RELEASE" || c.scope !== scope) throw new Error("KILL_SWITCH: release commands must share RELEASE action and scope");
      this.verify(c, now);
      issuers.add(c.issuer);
    }
    const required = scope === "GLOBAL" ? 2 : 1;
    if (issuers.size < required) throw new Error(`KILL_SWITCH: release of ${scope} requires ${required} distinct issuers`);
    for (const c of commands) this.consumeNonce(c);
    this.halts.delete(scope);
  }

  isHalted(scope: string, now: number = Date.now()): boolean {
    if (this.opts.envFlag === true) return true;
    for (const key of ["GLOBAL", scope]) {
      const h = this.halts.get(key);
      if (h === undefined) continue;
      if (now >= h.expiresAt) {
        this.halts.delete(key);
        continue;
      }
      return true;
    }
    return false;
  }

  assertNotHalted(scope: string, now: number = Date.now()): void {
    if (this.isHalted(scope, now)) throw new HaltedError(scope);
  }

  status(now: number = Date.now()): { envFlag: boolean; halts: { scope: string; since: string; expiresAt: string; issuer: string; reason: string }[] } {
    const halts: { scope: string; since: string; expiresAt: string; issuer: string; reason: string }[] = [];
    for (const [scope, h] of this.halts) {
      if (now < h.expiresAt) halts.push({ scope, since: new Date(h.since).toISOString(), expiresAt: new Date(h.expiresAt).toISOString(), issuer: h.issuer, reason: h.reason });
    }
    return { envFlag: this.opts.envFlag === true, halts };
  }
}
