import { describe, expect, it } from "vitest";
import type { Application, Request, Response } from "express";
import type { FixedWindowRateLimiter } from "../../src/security/rate-limit";
import type { BookPiLedgerPort } from "../../src/bookpi/ledger";
import type { YunEventInput } from "../../src/federation/yun-event";
import { registerYunEventRoutes } from "../../src/routes/yun-events";

type Handler = (req: Request, res: Response) => void | Promise<void>;

interface Captured {
  status: number;
  body: unknown;
  jsonCalled: boolean;
}

function fakeLedger() {
  const events: Array<Record<string, unknown>> = [];
  let sequence = 0;
  const ledger = {
    append(input: Record<string, unknown>) {
      sequence += 1;
      const record = { ...input, hash: `hash-${sequence}`, sequence };
      events.push(record);
      return record;
    },
    snapshot() {
      return { events: events.map((event) => ({ ...event })) };
    },
  };
  return { ledger: ledger as unknown as BookPiLedgerPort, events };
}

function harness(options: { denyAdmin?: boolean; denyRate?: boolean } = {}) {
  const handlers = new Map<string, Handler>();
  const app = {
    post: (path: string, handler: Handler) => handlers.set(`POST ${path}`, handler),
    get: (path: string, handler: Handler) => handlers.set(`GET ${path}`, handler),
  } as unknown as Application;
  const { ledger, events } = fakeLedger();
  registerYunEventRoutes({
    app,
    ledger,
    authorizeAdmin: () => !options.denyAdmin,
    enforceRateLimit: () => !options.denyRate,
    rateLimiter: {} as FixedWindowRateLimiter,
  });
  return { handlers, events };
}

function makeRes(): { res: Response; captured: Captured } {
  const captured: Captured = { status: 200, body: undefined, jsonCalled: false };
  const res = {
    status(code: number) {
      captured.status = code;
      return this;
    },
    json(payload: unknown) {
      captured.body = payload;
      captured.jsonCalled = true;
      return this;
    },
  };
  return { res: res as unknown as Response, captured };
}

const validInput: YunEventInput = {
  event_type: "territory.signal",
  domain: "tourism",
  federation_id: "federation-3",
  entity_id: "entity-1",
  trace_id: "trace-1",
  timestamp: "2026-10-15T12:00:00.000Z",
  severity: "info",
  payload: { temperature: 21, ok: true },
};

describe("YUN event fabric routes", () => {
  it("sella un evento válido y expone sólo metadatos del ledger", async () => {
    const { handlers } = harness();
    const { res, captured } = makeRes();
    await handlers.get("POST /api/v1/yun/events")!({ body: validInput } as unknown as Request, res);
    const body = captured.body as {
      event: { event_hash: string; event_type: string };
      ledger: { id: string; hash: string; sequence: number };
    };
    expect(captured.status).toBe(201);
    expect(body.event.event_type).toBe("territory.signal");
    expect(body.event.event_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(body.ledger.sequence).toBe(1);
  });

  it("rechaza un evento inválido con 400", async () => {
    const { handlers } = harness();
    const { res, captured } = makeRes();
    await handlers.get("POST /api/v1/yun/events")!(
      { body: { ...validInput, severity: "nope" } } as unknown as Request,
      res,
    );
    expect(captured.status).toBe(400);
    expect((captured.body as { error: string }).error).toBe("YUN_EVENT_INVALID");
  });

  it("no responde cuando la autorización admin deniega", async () => {
    const { handlers } = harness({ denyAdmin: true });
    const { res, captured } = makeRes();
    await handlers.get("POST /api/v1/yun/events")!({ body: validInput } as unknown as Request, res);
    expect(captured.jsonCalled).toBe(false);
  });

  it("lista sólo los eventos YUN y respeta el límite", async () => {
    const { handlers, events } = harness();
    const { res: postRes } = makeRes();
    await handlers.get("POST /api/v1/yun/events")!({ body: validInput } as unknown as Request, postRes);
    events.push({ id: "x", timestamp: "2026-10-15T12:00:00.000Z", type: "TOOL_EXECUTION", hash: "h", sequence: 2 });
    const { res, captured } = makeRes();
    await handlers.get("GET /api/v1/yun/events")!({ query: { limit: "5" } } as unknown as Request, res);
    const body = captured.body as { count: number; events: Array<{ type: string }> };
    expect(body.count).toBe(1);
    expect(body.events[0]!.type).toBe("YUN.territory.signal");
  });
});
