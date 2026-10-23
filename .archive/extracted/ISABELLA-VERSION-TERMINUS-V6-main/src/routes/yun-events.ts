// YUN event fabric — HTTP surface: validate a canonical YUN event, verify its
// content hash and append an auditable BookPI record without exposing
// cross-domain storage.
//
// state: draft | engine-generated. Extracted from src/server.ts (TD-01) with no
// behaviour change; the route inventory is locked by test/deployment/route-inventory
// .test.ts. The POST is admin-gated; the GET is rate-limited and returns only
// integrity metadata (no principal identities).
import type { Application, Request, Response } from "express";
import { createYunEvent, verifyYunEvent, type YunEventInput } from "../federation/yun-event";
import type { BookPiLedgerPort } from "../bookpi/ledger";
import type { FixedWindowRateLimiter } from "../security/rate-limit";

export interface YunEventRoutesDeps {
  readonly app: Application;
  /** Append-only BookPI sink for YUN event records. */
  readonly ledger: BookPiLedgerPort;
  /** Bearer-token gate reused from the server (`authorizeApiToken`). */
  readonly authorizeAdmin: (req: Request, res: Response) => boolean;
  /** Fixed-window limiter guard reused from the server (`enforceRateLimit`). */
  readonly enforceRateLimit: (req: Request, res: Response, limiter: FixedWindowRateLimiter, bucket: string) => boolean;
  /** Shared limiter instance for the public YUN events bucket. */
  readonly rateLimiter: FixedWindowRateLimiter;
}

export function registerYunEventRoutes(deps: YunEventRoutesDeps): void {
  const { app, ledger, authorizeAdmin, enforceRateLimit, rateLimiter } = deps;

  app.post("/api/v1/yun/events", (req, res) => {
    if (!authorizeAdmin(req, res)) return;
    try {
      const event = createYunEvent(req.body as YunEventInput);
      if (!verifyYunEvent(event)) {
        res.status(500).json({ error: "YUN_EVENT_INTEGRITY_FAILURE" });
        return;
      }
      const record = ledger.append({
        id: `yun-${event.event_id}`,
        timestamp: event.timestamp,
        type: `YUN.${event.event_type}`,
        methodId: "TINA.YUN.FABRIC.append_event.v1.0.0.MEDIUM.HUMAN_IN_THE_LOOP",
        principal: event.federation_id,
        riskTier: event.severity === "critical" ? "CRITICAL" : "MEDIUM",
        status: "ACCEPTED",
      });
      res.status(201).json({ event, ledger: { id: record.id, hash: record.hash, sequence: record.sequence } });
    } catch (error) {
      const message = error instanceof Error ? error.message : "invalid YUN event";
      res.status(400).json({ error: "YUN_EVENT_INVALID", message });
    }
  });

  app.get("/api/v1/yun/events", (req, res) => {
    if (!enforceRateLimit(req, res, rateLimiter, "yun-events")) return;
    const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 100);
    const events = ledger
      .snapshot()
      .events.filter((event) => event.type.startsWith("YUN."))
      .slice(-limit)
      .map((event) => ({ id: event.id, timestamp: event.timestamp, type: event.type, hash: event.hash, sequence: event.sequence }));
    res.json({ schemaVersion: "1.0.0", count: events.length, events });
  });
}
