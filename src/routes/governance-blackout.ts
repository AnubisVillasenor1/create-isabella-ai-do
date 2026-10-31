/**
 * Superficie HTTP del Modo Terminus Blackout y de la Ecuación de Legitimidad Ω∞.
 *
 * state: draft | engine-generated.
 *
 * Regla de la casa (AGENTS.md §1, y como en `governance-permissions.ts`): mapear NO autoriza,
 * autorizar NO ejecuta, evaluar NO aprueba. Ninguna de estas rutas cambia una capacidad por sí
 * misma; la única que produce un efecto (halt/reanudar) exige además una orden firmada Ed25519
 * verificada por `KillSwitch`, y `RELEASE` requiere evidencia escrita en BookPI antes de
 * reactivar nada.
 */
import type { Application, Request, Response } from 'express';
import type { FixedWindowRateLimiter } from '../security/rate-limit';
import type { KillCommand } from '../security/kill-switch';
import {
  BLACKOUT_SCOPES,
  BLACKOUT_METHOD_IDS,
  GLOBAL_SCOPE,
  type BlackoutAssessment,
  type BlackoutController,
  type BlackoutEvidenceEvent,
  type GovernableScope,
} from '../governance/blackout';
import {
  computeLegitimacy,
  type LegitimacyEvaluation,
  type NativeAssurance,
} from '../omega/native/legitimacy';

export const BLACKOUT_ROUTES_VERSION = '1.0.0';

const MAX_STRING_LIST = 32;
const MAX_STRING_LENGTH = 200;

export interface BlackoutRouteDeps {
  readonly app: Application;
  readonly controller: BlackoutController;
  readonly assess: () => BlackoutAssessment;
  readonly enforceRateLimit: (
    req: Request,
    res: Response,
    limiter: FixedWindowRateLimiter,
    bucket: string
  ) => boolean;
  readonly rateLimiter: FixedWindowRateLimiter;
  readonly authorizeAdmin: (req: Request, res: Response) => boolean;
  /** Sumidero de evidencia para el evaluate de legitimidad; se omite si el nodo no tiene ledger. */
  readonly recordEvidence?: (event: BlackoutEvidenceEvent) => void;
  readonly newEventId?: () => string;
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value : null;
}

/** Listas acotadas: una request no puede alargar el trail de auditoría sin límite. */
function boundedStrings(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  const out: string[] = [];
  for (const item of value.slice(0, MAX_STRING_LIST)) {
    if (typeof item !== 'string') return null;
    out.push(item.slice(0, MAX_STRING_LENGTH));
  }
  return out;
}

function asKillCommand(value: unknown): KillCommand | null {
  const raw = asRecord(value);
  const action = asString(raw.action);
  const scope = asString(raw.scope);
  const issuer = asString(raw.issuer);
  const issuedAt = asString(raw.issuedAt);
  const nonce = asString(raw.nonce);
  const reason = asString(raw.reason);
  const signature = asString(raw.signature);
  if (!action || !scope || !issuer || !issuedAt || !nonce || !reason || !signature) return null;
  if (action !== 'ENGAGE' && action !== 'RELEASE') return null;
  return { action, scope, issuer, issuedAt, nonce, reason, signature };
}

const PRINCIPAL_KINDS = new Set(['human', 'machine', 'service']);
const MAX_FIELD_LENGTH = 512;

function asBoundedString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  if (value.trim() === '') return null;
  return value.slice(0, MAX_FIELD_LENGTH);
}

/**
 * Reconstrucción explícita del `NativeAssurance` desde JSON. No se hace un cast del body:
 * un factor ausente leído como `undefined` produciría un DENY accidental —o un ALLOW— sin
 * que nadie sepa qué campo falta, y el propósito de esta puerta es exactamente lo contrario.
 */
function asAssurance(value: unknown): { assurance?: NativeAssurance; error?: string } {
  const raw = asRecord(value);
  const strings: (keyof NativeAssurance)[] = [
    'requestId',
    'actorDid',
    'mandate',
    'policyVersion',
    'territory',
    'explanation',
    'recoveryPlan',
    'learningRecord',
    'economicJustification',
  ];
  const out: Record<string, unknown> = {};
  for (const field of strings) {
    const parsed = asBoundedString(raw[field]);
    if (parsed === null) return { error: `LEGITIMACY_FIELD_REQUIRED:${field}` };
    out[field] = parsed;
  }
  const principalKind = asString(raw.principalKind);
  if (principalKind === null || !PRINCIPAL_KINDS.has(principalKind)) {
    return { error: 'LEGITIMACY_PRINCIPAL_KIND_INVALID' };
  }
  out.principalKind = principalKind;
  const booleans: (keyof NativeAssurance)[] = [
    'humanOverrideAvailable',
    'governanceGranted',
    'evidencePresent',
    'tracePresent',
    'executionAuthorized',
  ];
  for (const field of booleans) {
    if (typeof raw[field] !== 'boolean')
      return { error: `LEGITIMACY_FLAG_MUST_BE_BOOLEAN:${field}` };
    out[field] = raw[field];
  }
  return { assurance: out as unknown as NativeAssurance };
}

export function registerBlackoutRoutes(deps: BlackoutRouteDeps): void {
  const { app } = deps;

  // ENGAGE: apaga un alcance gobernable con una orden firmada. La firma se verifica dentro del
  // KillSwitch (issuer autorizado + frescura + nonce); este handler no decide autoridad.
  app.post('/api/v1/governance/blackout/engage', (req, res) => {
    if (!deps.authorizeAdmin(req, res)) return;
    if (!deps.enforceRateLimit(req, res, deps.rateLimiter, 'governance-blackout-engage')) return;
    try {
      const command = asKillCommand(asRecord(req.body ?? {}).command);
      if (command === null) {
        res.status(400).json({ success: false, error: 'BLACKOUT_COMMAND_INCOMPLETE' });
        return;
      }
      if (command.action !== 'ENGAGE') {
        res.status(400).json({ success: false, error: 'BLACKOUT_EXPECTED_ENGAGE' });
        return;
      }
      const transition = deps.controller.engage(command);
      res.json({
        success: true,
        capabilityChanged: true,
        evidenceSealed: transition.sealed,
        ...transition,
      });
    } catch (error) {
      res
        .status(400)
        .json({ success: false, error: error instanceof Error ? error.message : String(error) });
    }
  });

  // RELEASE: exige 2 emisores distintos cuando el alcance es GLOBAL, y evidencia antes de reactivar.
  app.post('/api/v1/governance/blackout/release', (req, res) => {
    if (!deps.authorizeAdmin(req, res)) return;
    if (!deps.enforceRateLimit(req, res, deps.rateLimiter, 'governance-blackout-release')) return;
    try {
      const raw = Array.isArray(asRecord(req.body ?? {}).commands)
        ? (asRecord(req.body ?? {}).commands as unknown[])
        : [asRecord(req.body ?? {}).command];
      const commands: KillCommand[] = [];
      for (const item of raw.slice(0, 8)) {
        const command = asKillCommand(item);
        if (command === null) {
          res.status(400).json({ success: false, error: 'BLACKOUT_COMMAND_INCOMPLETE' });
          return;
        }
        commands.push(command);
      }
      if (commands.length === 0) {
        res.status(400).json({ success: false, error: 'BLACKOUT_RELEASE_COMMANDS_REQUIRED' });
        return;
      }
      const transition = deps.controller.release(commands);
      res.json({ success: true, capabilityChanged: true, ...transition });
    } catch (error) {
      res
        .status(400)
        .json({ success: false, error: error instanceof Error ? error.message : String(error) });
    }
  });

  // Estado del apagado y de la integridad constitucional: lectura sin efectos, para el operador
  // que decide si apagar. Sin esta puerta, la recomendación viviría solo en los logs.
  app.get('/api/v1/governance/blackout/status', (req, res) => {
    if (!deps.authorizeAdmin(req, res)) return;
    if (!deps.enforceRateLimit(req, res, deps.rateLimiter, 'governance-blackout-status')) return;
    const assessment = deps.assess();
    res.json({
      success: true,
      version: BLACKOUT_ROUTES_VERSION,
      governableScopes: [GLOBAL_SCOPE, ...BLACKOUT_SCOPES] as GovernableScope[],
      assessment,
    });
  });

  // Ecuación de legitimidad Ω∞ en seco: factores, propagación de cero y veredicto de la
  // Constitución. No autoriza, no ejecuta, no aprueba: devuelve la cuenta para que un humano decida.
  app.post('/api/v1/governance/legitimacy/evaluate', (req, res) => {
    if (!deps.authorizeAdmin(req, res)) return;
    if (!deps.enforceRateLimit(req, res, deps.rateLimiter, 'governance-legitimacy-evaluate'))
      return;
    const body = asRecord(req.body ?? {});
    const evidenceRefs = boundedStrings(body.evidenceRefs);
    const auditTrail = boundedStrings(body.auditTrail);
    if (evidenceRefs === null || auditTrail === null) {
      res.status(400).json({ success: false, error: 'BLACKOUT_REF_LISTS_INVALID_OR_UNBOUNDED' });
      return;
    }
    const parsed = asAssurance(body.assurance);
    if (parsed.assurance === undefined) {
      res
        .status(400)
        .json({ success: false, error: parsed.error ?? 'LEGITIMACY_ASSURANCE_INVALID' });
      return;
    }
    const assurance = parsed.assurance;

    let evaluation: LegitimacyEvaluation;
    try {
      evaluation = computeLegitimacy(assurance, evidenceRefs, auditTrail);
    } catch (error) {
      res
        .status(400)
        .json({ success: false, error: error instanceof Error ? error.message : String(error) });
      return;
    }

    const verdict = evaluation.allowed ? 'ALLOW' : 'DENY';
    let sealed = false;
    if (deps.recordEvidence && deps.newEventId) {
      try {
        deps.recordEvidence({
          id: deps.newEventId(),
          timestamp: new Date().toISOString(),
          type: 'LEGITIMACY_EVALUATED',
          methodId: BLACKOUT_METHOD_IDS.assess,
          principal: assurance.actorDid,
          riskTier: 'MEDIUM',
          status: `${verdict}:${assurance.requestId.slice(0, 64)}`,
        });
        sealed = true;
      } catch {
        sealed = false;
      }
    }

    res.json({
      success: true,
      authorizationPerformed: false,
      executionPerformed: false,
      approvalPerformed: false,
      evidenceSealed: sealed,
      verdict,
      evaluation,
    });
  });
}
