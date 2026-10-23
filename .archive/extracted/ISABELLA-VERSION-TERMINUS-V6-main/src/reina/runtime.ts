/**
 * Singleton de proceso de REINA (state: draft | engine-generated).
 *
 * El kill switch se inicializa con `ISA_KILL_SWITCH=1` como bandera de entorno y
 * SIN emisores autorizados (no hay forma de armarlo por firma hasta que un operador
 * registre claves públicas por un camino revisado). Los STH firmados requieren una
 * clave Ed25519 del operador; sin ella, solo se expone raíz y pruebas.
 */
import { KillSwitch } from "../security/kill-switch";
import { ReinaGovernor, type EvidenceRecord } from "./governor";

export function createReinaRuntime(env: NodeJS.ProcessEnv, evidenceSink?: (record: EvidenceRecord) => void): ReinaGovernor {
  const flag = env.ISA_KILL_SWITCH === "1" || env.ISA_KILL_SWITCH === "true";
  const killSwitch = new KillSwitch({ authorizedKeys: new Map(), envFlag: flag });
  return new ReinaGovernor({ killSwitch, ...(evidenceSink !== undefined ? { evidenceSink } : {}) });
}
