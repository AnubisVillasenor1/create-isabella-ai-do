/** Conductor — cablea INGRESS → ARGUS_CROWN → TRINITY_MOE → SOPHIA_ERI →
 * ORION_SANDBOX → BOOKPI_IGDS con modules reales (canon v40, pipeline 6 etapas). */

import type { ApprovalRef } from '../identity/approval';
import type { ConsentRegistryLike } from '../identity/consent';
import type { CapabilityGate } from '../crown/capability';
import { evaluateCrown } from '../crown/index';
import type { RawIncoming } from '../ingress/request';
import { normalizeIngress } from '../ingress/request';
import { propagateTrace } from '../ingress/trace';
import type { EvolutionControl, StageVerdict } from '../core/types';
import { EXECUTION_PIPELINE, PRODUCTION_AUTHORITY_CHAIN, blankSlotMapping } from '../core/types';
import type { Principal } from '../identity/principal';
import { formatMethodId, parseMethodId } from '../authority/method-id';
import { buildProposal } from '../orion/proposal';
import { runSandbox } from '../orion/sandbox';
import { BOOKPI_PROTOCOL } from '../bookpi/types';
import type { BookPiEventRecord, BookPiStorage } from '../bookpi/types';

export interface ConductorDeps {
  principal: Principal;
  input: unknown;
  methodId: string;
  gate: CapabilityGate;
  bookpi: BookPiStorage;
  controlsSnapshot: readonly EvolutionControl[];
  consent?: ConsentRegistryLike;
  approval?: ApprovalRef;
  proposalDomain?: string;
  raw?: RawIncoming;
}

export interface ConductorResult {
  requestId: string;
  traceId: string;
  methodId: string;
  demanded: string;
  verdicts: readonly StageVerdict[];
  passed: boolean;
  ledger?: BookPiEventRecord;
  reason: string;
}

export async function conductPipeline(deps: ConductorDeps): Promise<ConductorResult> {
  const traceId = propagateTrace(deps.raw?.headers?.['x-trace-id']);
  const requestId = crypto.randomUUID();
  const verdicts: StageVerdict[] = [];

  const record = (
    stage: StageVerdict['stage'],
    passed: boolean,
    reason: string,
    evidenceRef?: string
  ): void => {
    verdicts.push({ stage, passed, reason, evidenceRef });
  };

  // ---- 01 INGRESS
  try {
    const normalized = deps.raw
      ? normalizeIngress(deps.raw, { methodId: deps.methodId, tenantId: deps.principal.tenantId })
      : {
          requestId,
          traceId,
          methodId: deps.methodId,
          body: deps.input,
          receivedAt: new Date().toISOString(),
        };
    record('INGRESS', true, 'solicitud normalizada y saneada', normalized.requestId);
  } catch (err) {
    record('INGRESS', false, `entrada rechazada: ${(err as Error).message}`);
    return finish(undefined);
  }

  // ---- 02 ARGUS_CROWN
  const crown = evaluateCrown({
    input: String(deps.input ?? ''),
    methodId: deps.methodId,
    principal: deps.principal,
    gate: deps.gate,
    approval: deps.approval,
    action: 'execute',
    resource: deps.methodId,
  });
  const crownOk = crown.gateApproved && crown.verification.allPassed;
  record(
    'ARGUS_CROWN',
    crownOk,
    `CROWN modo ${crown.responseMode} (riesgo ${crown.riskLevel})`,
    crownOk ? `crown:${crown.intent.category}` : undefined
  );

  // ---- 03 TRINITY_MOE
  const module = routeMoe(deps.methodId);
  record(
    'TRINITY_MOE',
    module !== undefined,
    module ? `ruteado a módulo ${module}` : 'módulo irresoluble',
    module ? `moe:${module}` : undefined
  );

  // ---- 04 SOPHIA_ERI
  const consentOk = !deps.consent || deps.consent.check(deps.principal.id, 'memoria', 'recall');
  record(
    'SOPHIA_ERI',
    consentOk,
    consentOk ? 'memoria autorizada por consentimiento' : 'consentimiento de memoria ausente'
  );

  // ---- 05 ORION_SANDBOX
  try {
    const proposal = buildProposal({
      methodId: deps.methodId,
      domain: domainOf(deps.methodId, deps.proposalDomain),
      plane: planeOf(deps.methodId),
      target: String(deps.input ?? ''),
      changeBlocks: ['replay'],
      riskTier: parsedTier(deps.methodId),
      governanceTier: 'OPERATIONAL',
    });
    const sandbox = runSandbox(proposal, {
      controlsSnapshot: deps.controlsSnapshot,
      approval: deps.approval,
    });
    record('ORION_SANDBOX', sandbox.passed, sandbox.reason);
  } catch (err) {
    record('ORION_SANDBOX', false, `sandbox no representó: ${(err as Error).message}`);
  }

  // ---- 06 BOOKPI_IGDS
  const canAppend = verdicts.every((v) => v.passed);
  let lastEvent: BookPiEventRecord | undefined;
  if (canAppend) {
    lastEvent = await appendLedger(deps, requestId, traceId, record);
  } else {
    record('BOOKPI_IGDS', false, 'no se sella ledger: el pipeline no pasó las etapas previas');
  }

  return finish(lastEvent);

  function finish(lastEvent: BookPiEventRecord | undefined): ConductorResult {
    const passed = verdicts.every((v) => v.passed);
    let demanded = deps.methodId;
    try {
      demanded = formatMethodId(parseMethodId(deps.methodId));
    } catch {
      demanded = deps.methodId;
    }
    return {
      requestId,
      traceId,
      methodId: deps.methodId,
      demanded,
      verdicts,
      passed,
      ledger: lastEvent,
      reason: passed
        ? 'pipeline completo con cadena de autoridad intacta'
        : `bloqueado en ${blockedStage(verdicts)}`,
    };
  }
}

async function appendLedger(
  deps: ConductorDeps,
  requestId: string,
  traceId: string,
  record: (
    stage: StageVerdict['stage'],
    passed: boolean,
    reason: string,
    evidenceRef?: string
  ) => void
): Promise<BookPiEventRecord | undefined> {
  try {
    const event = await deps.bookpi.appendEvent(
      {
        schemaVersion: 'tamv-federation/v1',
        header: {
          type: 'PIPELINE_EXECUTION',
          source: 'isoti-conductor',
          protocol: BOOKPI_PROTOCOL,
          hehepcontext: {
            hexagon: 'pipeline',
            domain: domainOf(deps.methodId, deps.proposalDomain),
          },
        },
        payload: { methodId: deps.methodId, requestId, traceId, outcome: 'allowed' },
        meta: { actorId: deps.principal.id, seed: 'conductor-v1' },
      },
      { actorId: deps.principal.id }
    );
    record('BOOKPI_IGDS', true, 'evento sellado en el ledger', event.hash);
    return event;
  } catch (err) {
    const message = err instanceof Error ? err.message : '';
    const safeReason = /integrity secret|required.*secret/iu.test(message)
      ? 'secreto de integridad no configurado'
      : /permission|RLS|42501/iu.test(message)
        ? 'permiso de almacenamiento denegado'
        : 'almacenamiento de evidencia no disponible';
    record('BOOKPI_IGDS', false, `ledger no selló: ${safeReason}`);
    return undefined;
  }
}

function blockedStage(verdicts: readonly StageVerdict[]): string {
  return verdicts.find((v) => !v.passed)?.stage ?? 'none';
}

function parsedTier(methodId: string): ReturnType<typeof parseMethodId>['riskTier'] {
  try {
    return parseMethodId(methodId).riskTier;
  } catch {
    return 'MEDIUM';
  }
}

const YUN_DOMAIN: Record<string, string> = {
  IDENTITY: 'principals',
  PATRIMONY: 'append_only_evidence',
  TOURISM: 'external_integrations',
  ECONOMY: 'risk_register',
  TWINS: 'durable_memory',
  COLLECTIVE_INTELLIGENCE: 'skill_routing',
  RESILIENCE: 'recovery',
};

function domainOf(methodId: string, hint?: string): string {
  if (hint) {
    return hint;
  }
  try {
    return YUN_DOMAIN[parseMethodId(methodId).yun] ?? 'runtime';
  } catch {
    return 'unknown';
  }
}

function planeOf(methodId: string): string {
  try {
    return parseMethodId(methodId).module;
  } catch {
    return 'unknown';
  }
}

function routeMoe(methodId: string): string | undefined {
  try {
    return parseMethodId(methodId).module;
  } catch {
    return undefined;
  }
}

export { EXECUTION_PIPELINE, PRODUCTION_AUTHORITY_CHAIN, blankSlotMapping as emptySlots };
