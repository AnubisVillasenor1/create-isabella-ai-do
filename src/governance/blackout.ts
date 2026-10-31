/**
 * state: draft | engine-generated — Modo Terminus Blackout (Documento Ω∞ §V.9 y §XVIII).
 *
 * Compone autoridad existente, no la duplica. La criptografía de las órdenes (Ed25519), el
 * anti-replay por nonce, la expiración del halt y el control dual de GLOBAL viven en
 * `src/security/kill-switch.ts`. Ese módulo es deliberadamente una compuerta de consulta: no
 * detiene nada por sí solo. Aquí se cierra el círculo con lo tres que le faltaba para ser
 * operativo en el runtime:
 *
 * 1. La lista CERRADA de alcances que la superficie HTTP consulta de verdad. Un `scope` escrito
 *    con un typo en una orden válida halta una cadena que nadie mira: apagado silencioso e
 *    inexistente. `assertGovernableScope` lo rechaza.
 * 2. La tabla ruta→alcance, con supervivientes. El documento pide "agentes, federación, pagos y
 *    LLM OFF; solo Veritas, BookPI y Recovery activos", y eso exige que el plano de control y el
 *    plano de evidencia sigan alcanzables durante el propio apagado.
 * 3. La evaluación de integridad constitucional: cuándo apagar es la única respuesta honesta.
 *
 * Invariante (AGENTS.md §1): CAPABILITY ≠ AUTHORITY ≠ EXECUTION ≠ EVIDENCE. Nada se apaga solo
 * en este módulo. `assessConstitutionalIntegrity` recomienda; únicamente una firma humana,
 * verificada por `KillSwitch`, ejecuta el halt o lo levanta.
 */
import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import type { KillCommand, KillSwitch } from '../security/kill-switch';

/**
 * Alcances gobernedores. `GLOBAL` es el alcance nativo del KillSwitch y cubre a todos los
 * demás; los cuatro restantes permiten un apagado selectivo sin desmontar el nodo entero.
 */
export const BLACKOUT_SCOPES = [
  'AGENT_EXECUTION',
  'LLM_INFERENCE',
  'PAYMENTS',
  'FEDERATION',
  'VOICE_SYNTHESIS',
] as const;

export type BlackoutScope = (typeof BLACKOUT_SCOPES)[number];
export type GovernableScope = BlackoutScope | 'GLOBAL';

export const GLOBAL_SCOPE: GovernableScope = 'GLOBAL';

/** Identidades de método (§5 AGENTS.md), válidas según `src/authority/method-id.ts`. */
export const BLACKOUT_METHOD_IDS = Object.freeze({
  engage: 'T.RESILIENCE.CROWN.blackout.engage.v1.0.0.CRITICAL.CONSTITUTIONAL',
  release: 'T.RESILIENCE.CROWN.blackout.release.v1.0.0.CRITICAL.CONSTITUTIONAL',
  halt: 'T.RESILIENCE.CROWN.blackout.halt.v1.0.0.HIGH.CONSTITUTIONAL',
  assess: 'T.RESILIENCE.CROWN.blackout.assess.v1.0.0.MEDIUM.CONSTITUTIONAL',
} as const);

/**
 * Prefijos que NUNCA se bloquean, aunque el halt sea GLOBAL. Es el "Recovery Kernel + Veritas +
 * BookPI" del documento convertido a datos: sin esto, apagar el nodo apagaría también la única
 * puerta para volver a encenderlo y el libro donde se asienta la evidencia del apagado.
 * Se evalúa antes que la tabla de alcances: ganar una superposición significa sobrevivir.
 */
export const BLACKOUT_SURVIVOR_PREFIXES = [
  '/api/v1/governance/blackout',
  '/api/v1/bookpi',
  '/api/v1/evidence-graph',
  '/api/v1/audit',
  '/api/v1/emergency',
  '/api/v1/reina',
  '/api/v1/healthz',
  '/api/v1/readyz',
  '/api/v1/health',
  '/api/v1/ops',
  '/api/v1/status',
  '/api/v1/isabella/status',
  '/api/v1/security',
  '/api/v3/omega/constitution',
] as const;

/**
 * Tabla ruta→alcance sobre los prefijos que existen hoy en `test/deployment/route-inventory.json`.
 * Orden = precedencia: la primera coincidencia gana, así que las rutas específicas van antes que
 * su grupo (p. ej. `/api/v1/cognition/speech` es voz, no inferencia de texto).
 */
export const GOVERNED_ROUTE_SCOPES: ReadonlyArray<{
  readonly prefix: string;
  readonly scope: GovernableScope;
}> = Object.freeze([
  // Voz: síntesis y clonación salen del nodo hacia proveedores.
  { prefix: '/api/v1/cognition/speech', scope: 'VOICE_SYNTHESIS' },
  { prefix: '/api/v1/tts', scope: 'VOICE_SYNTHESIS' },
  { prefix: '/api/v1/voice', scope: 'VOICE_SYNTHESIS' },
  { prefix: '/api/v1/audio-overview', scope: 'VOICE_SYNTHESIS' },
  // TAMV Kaos Audio System: analiza PCM del cliente y declara planes sobre la cadena de voz.
  { prefix: '/api/v1/tamv', scope: 'VOICE_SYNTHESIS' },
  // Inferencia de lenguaje: egreso de la conversación a proveedores externos.
  { prefix: '/api/v1/cognition', scope: 'LLM_INFERENCE' },
  { prefix: '/api/v1/cognitive/request', scope: 'LLM_INFERENCE' },
  { prefix: '/api/v1/native/llm', scope: 'LLM_INFERENCE' },
  { prefix: '/api/v1/synthesize', scope: 'LLM_INFERENCE' },
  { prefix: '/api/v1/notebook/generate', scope: 'LLM_INFERENCE' },
  { prefix: '/v1/chat/completions', scope: 'LLM_INFERENCE' },
  { prefix: '/v1/completions', scope: 'LLM_INFERENCE' },
  // Superficie multi-proveedor del gateway (Anthropic / Google / Llama): egreso directo a redes externas.
  { prefix: '/v1/messages', scope: 'LLM_INFERENCE' },
  { prefix: '/v1beta/models', scope: 'LLM_INFERENCE' },
  { prefix: '/llama/v1/chat/completions', scope: 'LLM_INFERENCE' },
  // Ejecución autónoma de herramientas, agentes y pipelines.
  { prefix: '/api/v1/tools/execute', scope: 'AGENT_EXECUTION' },
  { prefix: '/api/v1/agents', scope: 'AGENT_EXECUTION' },
  { prefix: '/api/v1/mcp', scope: 'AGENT_EXECUTION' },
  { prefix: '/api/v1/hypercore', scope: 'AGENT_EXECUTION' },
  { prefix: '/api/v1/fabric/execute', scope: 'AGENT_EXECUTION' },
  { prefix: '/api/v1/pipeline/execute', scope: 'AGENT_EXECUTION' },
  { prefix: '/api/v1/isa', scope: 'AGENT_EXECUTION' },
  { prefix: '/api/v1/learning/train', scope: 'AGENT_EXECUTION' },
  { prefix: '/api/v1/quantum/pennylane/execute', scope: 'AGENT_EXECUTION' },
  // Movimiento de dinero y liquidación.
  { prefix: '/api/v3/economy', scope: 'PAYMENTS' },
  { prefix: '/api/v3/treasury', scope: 'PAYMENTS' },
  { prefix: '/api/v3/affiliates', scope: 'PAYMENTS' },
  { prefix: '/api/v1/revenue', scope: 'PAYMENTS' },
  { prefix: '/api/v1/monetization', scope: 'PAYMENTS' },
  { prefix: '/api/v1/billing', scope: 'PAYMENTS' },
  { prefix: '/api/v1/commerce', scope: 'PAYMENTS' },
  { prefix: '/api/v1/pricing', scope: 'PAYMENTS' },
  { prefix: '/api/v1/cognitive-capital/trade', scope: 'PAYMENTS' },
  // Egreso y entrada federada entre nodos.
  { prefix: '/api/v1/federation', scope: 'FEDERATION' },
  { prefix: '/api/v1/connectors', scope: 'FEDERATION' },
  { prefix: '/api/v1/citemesh', scope: 'FEDERATION' },
  { prefix: '/api/v3/omega/twins', scope: 'FEDERATION' },
]);

/** Solo `GET`/`HEAD` quedan exentos: un apagado no puede cegar a quien viene a auditarlo. */
const READ_ONLY_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

export function assertGovernableScope(value: string): GovernableScope {
  if (value === GLOBAL_SCOPE) return value;
  if ((BLACKOUT_SCOPES as readonly string[]).includes(value)) return value as BlackoutScope;
  throw new Error(
    `BLACKOUT: scope '${value}' no es gobernable. Use GLOBAL o uno de: ${[
      ...BLACKOUT_SCOPES,
      GLOBAL_SCOPE,
    ].join(', ')}.`
  );
}

export function isSurvivorPath(path: string): boolean {
  return BLACKOUT_SURVIVOR_PREFIXES.some(
    (prefix) => path === prefix || path.startsWith(prefix + '/') || path.startsWith(prefix + '?')
  );
}

/** `null` = ruta no gobernedora (su control sigue siendo el de siempre: tokens, scopes, límites). */
export function scopeForPath(path: string): GovernableScope | null {
  if (isSurvivorPath(path)) return null;
  const withoutQuery = path.split('?')[0] ?? path;
  for (const entry of GOVERNED_ROUTE_SCOPES) {
    const { prefix } = entry;
    if (withoutQuery === prefix || withoutQuery.startsWith(prefix + '/')) return entry.scope;
  }
  return null;
}

export interface BlackoutCheck {
  readonly allowed: boolean;
  readonly scope: GovernableScope | null;
  readonly reason: 'NOT_GOVERNED' | 'SURVIVOR' | 'ACTIVE' | 'HALTED';
}

export function evaluateBlackoutRequest(
  method: string,
  path: string,
  isHalted: (scope: GovernableScope) => boolean
): BlackoutCheck {
  if (READ_ONLY_METHODS.has(method.toUpperCase())) {
    return { allowed: true, scope: null, reason: 'NOT_GOVERNED' };
  }
  if (isSurvivorPath(path)) {
    return { allowed: true, scope: null, reason: 'SURVIVOR' };
  }
  const scope = scopeForPath(path);
  if (scope === null) return { allowed: true, scope: null, reason: 'NOT_GOVERNED' };
  // GLOBAL se consulta explícitamente: `KillSwitch.isHalted` ya cubre GLOBAL desde cualquier
  // alcance, pero este evaluador se usa con predicados inyectados y delegar ahí la cobertura
  // haría que un apagado GLOBAL no cortara nada.
  const down = isHalted(GLOBAL_SCOPE) || isHalted(scope);
  return down
    ? { allowed: false, scope, reason: 'HALTED' }
    : { allowed: true, scope, reason: 'ACTIVE' };
}

export interface BlackoutEvidenceEvent {
  readonly id: string;
  readonly timestamp: string;
  readonly type: string;
  readonly methodId: string;
  readonly principal: string;
  readonly riskTier: string;
  readonly status: string;
}

export interface BlackoutGuardDeps {
  readonly killSwitch: KillSwitch;
  /** Sello en BookPI de cada decisión denegada. Opcional: sin sumidero, se deniega sin evidencia. */
  readonly recordEvidence?: (event: BlackoutEvidenceEvent) => void;
  readonly newEventId?: () => string;
  /**
   * Ventana de sellado por alcance. Un nodo haltado sigue recibiendo tráfico y sellar cada 503
   * llenaría la cadena de evidencia con repeticiones; se sella el primer rechazo de cada alcance
   * por ventana y los siguientes se cuentan sin escribir.
   */
  readonly evidenceWindowMs?: number;
}

export function createBlackoutGuard(deps: BlackoutGuardDeps) {
  const windowMs = deps.evidenceWindowMs ?? 60_000;
  const lastSealedAt = new Map<GovernableScope, number>();
  const newEventId = deps.newEventId ?? ((): string => `blackout-${randomUUID()}`);

  return function blackoutGuard(req: Request, res: Response, next: NextFunction): void {
    const check = evaluateBlackoutRequest(req.method, req.path, (scope) =>
      deps.killSwitch.isHalted(scope)
    );
    if (check.allowed || check.scope === null) {
      next();
      return;
    }
    const haltedScope = check.scope;
    const now = Date.now();
    const previous = lastSealedAt.get(haltedScope);
    if (deps.recordEvidence && (previous === undefined || now - previous >= windowMs)) {
      lastSealedAt.set(haltedScope, now);
      deps.recordEvidence({
        id: newEventId(),
        timestamp: new Date(now).toISOString(),
        type: 'BLACKOUT_DENIAL',
        methodId: BLACKOUT_METHOD_IDS.halt,
        principal: `http:${req.ip || 'unknown'}`,
        riskTier: 'HIGH',
        status: `DENIED:${haltedScope}`,
      });
    }
    res.status(503).json({
      success: false,
      error: 'HALTED_BY_BLACKOUT',
      scope: haltedScope,
      reason: check.reason,
    });
  };
}

export type ConstitutionalPosture = 'CLEAN' | 'DEGRADED' | 'CORRUPTED';

export interface IntegrityFinding {
  readonly id: string;
  readonly severity: 'ERROR' | 'WARN';
  readonly message: string;
}

export interface BlackoutAssessment {
  readonly posture: ConstitutionalPosture;
  readonly findings: readonly IntegrityFinding[];
  readonly halted: readonly GovernableScope[];
  readonly engagementSuggested: boolean;
  readonly recommendedScope: GovernableScope;
  readonly evidenceSealed: boolean;
}

export interface IntegritySources {
  /** `() => bookPiLedger.verify()` en el servidor. `null` = sin cadena que verificar. */
  readonly verifyLedger:
    (() => { valid: boolean; status: string; diagnostics?: readonly string[] }) | null;
  readonly readinessErrors: readonly IntegrityFinding[];
  readonly envHalted: boolean;
  readonly halted: (scope: GovernableScope) => boolean;
}

/**
 * Jerarquía de la verdad (AGENTS.md §3): la evidencia observada manda. La cadena de BookPI rota
 * es corrupción constitucional por definición —es el libro que sostiene la trazabilidad de todo
 * lo demás— y produce CORRUPTED por sí sola. Un ERROR de despliegue es DEGRADED: apagar por
 * configuración pendiente sería un falso positivo que tumba el servicio.
 */
export function assessConstitutionalIntegrity(src: IntegritySources): BlackoutAssessment {
  const findings: IntegrityFinding[] = [];
  let ledgerBroken = false;

  if (src.verifyLedger === null) {
    findings.push({
      id: 'BI-LEDGER-ABSENT',
      severity: 'WARN',
      message: 'No BookPI ledger wired: blackout decisions cannot be sealed as evidence.',
    });
  } else {
    let verified: { valid: boolean; status: string; diagnostics?: readonly string[] } | null = null;
    try {
      verified = src.verifyLedger();
    } catch (error) {
      verified = null;
      findings.push({
        id: 'BI-LEDGER-VERIFY-THREW',
        severity: 'ERROR',
        message: `Ledger verification threw: ${error instanceof Error ? error.message : 'UNKNOWN'}`,
      });
      ledgerBroken = true;
    }
    if (verified !== null && !verified.valid) {
      ledgerBroken = true;
      findings.push({
        id: 'BI-LEDGER-CHAIN-BROKEN',
        severity: 'ERROR',
        message: `BookPI chain is ${verified.status}: ${
          (verified.diagnostics ?? []).slice(0, 3).join('; ') || 'no diagnostics'
        }`,
      });
    }
  }

  if (src.envHalted) {
    findings.push({
      id: 'BI-ENV-KILL-SWITCH',
      severity: 'ERROR',
      message:
        'ISA_KILL_SWITCH is engaged: GLOBAL is halted without a signature and cannot be released remotely.',
    });
  }

  for (const finding of src.readinessErrors) findings.push(finding);

  const posture: ConstitutionalPosture = ledgerBroken
    ? 'CORRUPTED'
    : findings.length > 0
      ? 'DEGRADED'
      : 'CLEAN';

  const halted = ([GLOBAL_SCOPE, ...BLACKOUT_SCOPES] as const).filter((scope) => src.halted(scope));

  return Object.freeze({
    posture,
    findings: Object.freeze(findings),
    halted: Object.freeze(halted),
    engagementSuggested: posture === 'CORRUPTED',
    recommendedScope: posture === 'CORRUPTED' ? GLOBAL_SCOPE : 'LLM_INFERENCE',
    evidenceSealed: src.verifyLedger !== null,
  });
}

export interface BlackoutControllerDeps {
  readonly killSwitch: KillSwitch;
  readonly recordEvidence: (event: BlackoutEvidenceEvent) => void;
  readonly newEventId: () => string;
  readonly now?: () => number;
}

export interface BlackoutTransition {
  readonly scope: GovernableScope;
  readonly action: 'ENGAGE' | 'RELEASE';
  readonly issuer: string;
  readonly reason: string;
  readonly status: ReturnType<KillSwitch['status']>;
  readonly sealed: boolean;
  readonly sealError?: string;
}

/**
 * Traduce una orden firmada a apagado real, y apaga antes de sellar: si la evidencia falla,
 * el halt se aplica igual (dirección segura) y se reporta `sealed:false` en vez de fingir que
 * no pasó. Levantar el apagado sin evidencia sí se rechaza: reanudar capacidad es el movimiento
 * que exige trazabilidad (§1: CAPABILITY ≠ AUTHORITY ≠ EXECUTION ≠ EVIDENCE).
 */
export class BlackoutController {
  private readonly now: () => number;

  constructor(private readonly deps: BlackoutControllerDeps) {
    this.now = deps.now ?? ((): number => Date.now());
  }

  engage(command: KillCommand): BlackoutTransition {
    if (command.action !== 'ENGAGE') throw new Error('BLACKOUT: expected an ENGAGE command');
    const scope = assertGovernableScope(command.scope);
    const prepared: KillCommand = { ...command, scope };
    this.deps.killSwitch.engage(prepared, this.now());
    const status = this.deps.killSwitch.status(this.now());
    const seal = this.trySeal(
      'BLACKOUT_ENGAGED',
      BLACKOUT_METHOD_IDS.engage,
      scope,
      prepared,
      'halted'
    );
    return Object.freeze({
      scope,
      action: 'ENGAGE',
      issuer: prepared.issuer,
      reason: prepared.reason,
      status,
      sealed: seal.sealed,
      ...(seal.error !== undefined ? { sealError: seal.error } : {}),
    });
  }

  release(commands: readonly KillCommand[]): BlackoutTransition {
    const first = commands[0];
    if (first === undefined) throw new Error('BLACKOUT: no release commands');
    const scope = assertGovernableScope(first.scope);
    const prepared: readonly KillCommand[] = commands.map((c) => ({ ...c, scope }));
    // El sello va antes del release: si la evidencia no se escribe, la capacidad no se reactiva.
    const seal = this.trySeal(
      'BLACKOUT_RELEASE_REQUESTED',
      BLACKOUT_METHOD_IDS.release,
      scope,
      first,
      'release_sealed'
    );
    if (!seal.sealed) {
      throw new Error(
        `BLACKOUT: release of ${scope} requires evidence in BookPI (${seal.error ?? 'SEAL_FAILED'})`
      );
    }
    this.deps.killSwitch.release(prepared, this.now());
    return Object.freeze({
      scope,
      action: 'RELEASE',
      issuer: first.issuer,
      reason: first.reason,
      status: this.deps.killSwitch.status(this.now()),
      sealed: true,
    });
  }

  private trySeal(
    type: string,
    methodId: string,
    scope: GovernableScope,
    command: KillCommand,
    statusPrefix: string
  ): { sealed: boolean; error?: string } {
    try {
      this.deps.recordEvidence({
        id: this.deps.newEventId(),
        timestamp: new Date(this.now()).toISOString(),
        type,
        methodId,
        principal: `kill-switch:${command.issuer}`,
        riskTier: 'CRITICAL',
        status: `${statusPrefix}:${scope}:${command.nonce.slice(0, 16)}`,
      });
      return { sealed: true };
    } catch (error) {
      return { sealed: false, error: error instanceof Error ? error.message : String(error) };
    }
  }
}
