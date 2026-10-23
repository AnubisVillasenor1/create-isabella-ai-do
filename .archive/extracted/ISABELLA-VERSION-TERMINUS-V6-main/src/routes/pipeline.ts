// Pipeline Conductor HTTP surface — ejecuta el pipeline gobernado de 6 etapas
// (INGRESS → ARGUS_CROWN → TRINITY_MOE → SOPHIA_ERI → ORION_SANDBOX → BOOKPI_IGDS)
// sobre un module/function real y sella evidencia en el ledger seleccionado.
//
// Invariante: el pipeline gobernado DECIDE y SELA EVIDENCIA; NO ejecuta efectos
// externos. Ejecutar una capacidad sigue siendo una acción humana autorizada.
//
// state: draft | engine-generated.
import type { Application, Request, Response } from "express";
import { buildBookPiEvent } from "../bookpi/emitter";
import { verifyChainLink, ZERO_HASH } from "../bookpi/crypto";
import { createJsonlStorage } from "../bookpi/storage-jsonl";
import type { BookPiEventRecord, BookPiEventSeed, BookPiStorage } from "../bookpi/types";
import { conductPipeline } from "../pipeline/conductor";
import { createPrincipal } from "../identity/principal";
import type { CapabilityGate } from "../crown/capability";
import type { EvolutionControl } from "../core/types";
import type { ConsentRegistryLike } from "../identity/consent";
import type { FixedWindowRateLimiter } from "../security/rate-limit";

export const PIPELINE_ROUTES_VERSION = "1.0.0";

/**
 * In-memory `BookPiStorage` with the same hash-chain semantics as the Postgres and
 * JSONL adapters. Volatile by design: it matches the repo's default posture
 * (in-memory SHA-256 hash chain) when no durable pipeline path is configured.
 */
export function createInMemoryBookPiStorage(): BookPiStorage {
  const events: BookPiEventRecord[] = [];
  return {
    async getLastEvent(): Promise<BookPiEventRecord | null> {
      return events.at(-1) ?? null;
    },
    async appendEvent(seed: BookPiEventSeed, ctx = {}): Promise<BookPiEventRecord> {
      const last = events.at(-1);
      const record = buildBookPiEvent(seed, {
        sequence: last ? last.sequence + 1 : 1,
        prevHash: last ? last.hash : ZERO_HASH,
        timestamp: new Date().toISOString(),
        ...(ctx.actorId !== undefined ? { actorId: ctx.actorId } : {}),
        ...(ctx.secret !== undefined ? { secret: ctx.secret } : {}),
      });
      events.push(record);
      return record;
    },
    async listEvents(): Promise<BookPiEventRecord[]> {
      return [...events];
    },
    async verifyChain(opts: { secret?: string } = {}): Promise<{ valid: boolean; count: number; failures: string[] }> {
      const failures: string[] = [];
      let prevHash = ZERO_HASH;
      for (const event of events) {
        if (event.prevHash !== prevHash) failures.push(`evento ${event.sequence} (${event.id}): prevHash no encadena`);
        if (!verifyChainLink(event, opts.secret)) failures.push(`evento ${event.sequence} (${event.id}): hash/integridad inválidos`);
        prevHash = event.hash;
      }
      return { valid: failures.length === 0, count: events.length, failures };
    },
  };
}

export interface PipelineRouteDeps {
  readonly app: Application;
  /** Pre-built storage. Mutually exclusive with `bookpiPath`; one of the two is required. */
  readonly bookpi?: BookPiStorage;
  /** Durable JSONL path for the pipeline ledger. Read lazily on first request. */
  readonly bookpiPath?: string;
  readonly gate: CapabilityGate;
  readonly controlsSnapshot: readonly EvolutionControl[];
  readonly enforceRateLimit: (req: Request, res: Response, limiter: FixedWindowRateLimiter, bucket: string) => boolean;
  readonly rateLimiter: FixedWindowRateLimiter;
  readonly consent?: ConsentRegistryLike;
  /** Admin gate. When omitted, the route is open (development) with the `operator` role. */
  readonly authorizeAdmin?: (req: Request, res: Response) => boolean;
}

export function registerPipelineRoutes(deps: PipelineRouteDeps): void {
  // Resolve the storage exactly once. A durable JSONL backend is created lazily so
  // mounting the route never performs filesystem IO or requires top-level await.
  let storagePromise: Promise<BookPiStorage> | undefined;
  const resolveStorage = (): Promise<BookPiStorage> => {
    if (deps.bookpi) return Promise.resolve(deps.bookpi);
    if (!storagePromise) {
      storagePromise = Promise.resolve(
        deps.bookpiPath ? createJsonlStorage(deps.bookpiPath) : createInMemoryBookPiStorage(),
      );
    }
    return storagePromise;
  };

  deps.app.post("/api/v1/pipeline/execute", async (req: Request, res: Response) => {
    if (deps.authorizeAdmin && !deps.authorizeAdmin(req, res)) return;
    if (!deps.enforceRateLimit(req, res, deps.rateLimiter, "pipeline-execute")) return;

    const body = (req.body ?? {}) as { input?: unknown; methodId?: unknown };
    const input = typeof body.input === "string" ? body.input : "";
    const methodId = typeof body.methodId === "string" ? body.methodId : "";
    if (!input.trim()) {
      res.status(400).json({ success: false, error: "PIPELINE_INPUT_REQUIRED" });
      return;
    }
    if (!methodId.trim()) {
      res.status(400).json({ success: false, error: "PIPELINE_METHOD_ID_REQUIRED" });
      return;
    }

    // Roles are derived from the gate, never from the request body: a client
    // cannot self-assign a privilege. An admin-gated route acts as `admin`;
    // an open development route acts as `operator`.
    const roles = deps.authorizeAdmin ? ["admin"] : ["operator"];
    const principal = createPrincipal({ id: "human:pipeline-session", kind: "human", roles });

    try {
      const result = await conductPipeline({
        principal,
        input,
        methodId,
        gate: deps.gate,
        bookpi: await resolveStorage(),
        controlsSnapshot: deps.controlsSnapshot,
        ...(deps.consent ? { consent: deps.consent } : {}),
      });
      const ledgerOnlyFailure = !result.passed
        && result.verdicts.some((verdict) => verdict.stage === "BOOKPI_IGDS" && !verdict.passed)
        && result.verdicts.filter((verdict) => verdict.stage !== "BOOKPI_IGDS").every((verdict) => verdict.passed);
      const status = result.passed ? 200 : ledgerOnlyFailure ? 503 : 403;
      res.status(status).json({
        success: result.passed,
        authorizationPerformed: result.passed,
        executionPerformed: false,
        ...(ledgerOnlyFailure ? { error: "PIPELINE_EVIDENCE_STORAGE_UNAVAILABLE" } : {}),
        result,
      });
    } catch (error) {
      res.status(400).json({ success: false, error: error instanceof Error ? error.message : "PIPELINE_FAILED" });
    }
  });
}
