/**
 * Singleton de proceso de REINA (state: draft | engine-generated).
 *
 * Sin emisores autorizados propios: si el servidor ya construyó un `KillSwitch` con claves
 * revisadas, se le inyecta esa instancia. Dos apagadores en el mismo proceso significaría que
 * un GLOBAL firmado por el plano HTTP deja a REINA adjudicando como si el nodo estuviera vivo.
 * Sin inyección (tests, arranques parciales) se mantiene la bandera de entorno y ninguna firma.
 * Los STH firmados requieren una clave Ed25519 del operador; sin ella, solo se expone raíz y pruebas.
 */
import { KillSwitch } from '../security/kill-switch';
import { ReinaGovernor, type EvidenceRecord } from './governor';

export function createReinaRuntime(
  env: NodeJS.ProcessEnv,
  evidenceSink?: (record: EvidenceRecord) => void,
  sharedKillSwitch?: KillSwitch
): ReinaGovernor {
  const flag = env.ISA_KILL_SWITCH === '1' || env.ISA_KILL_SWITCH === 'true';
  const killSwitch =
    sharedKillSwitch ?? new KillSwitch({ authorizedKeys: new Map(), envFlag: flag });
  return new ReinaGovernor({ killSwitch, ...(evidenceSink !== undefined ? { evidenceSink } : {}) });
}
