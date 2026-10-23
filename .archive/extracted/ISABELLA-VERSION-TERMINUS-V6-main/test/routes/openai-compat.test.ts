import { describe, expect, it } from "vitest";
import type { Application, Request, Response } from "express";
import type { FixedWindowRateLimiter } from "../../src/security/rate-limit";
import { registerOpenAiCompatibleRoutes, type OpenAiMediation, type OpenAiProfile } from "../../src/routes/openai";

type Handler = (req: Request, res: Response) => void;

interface Captured {
  status: number;
  body: unknown;
  headers: Record<string, string>;
  writes: string[];
  ended: boolean;
}

function harness(mediate: (input: string, profile: OpenAiProfile) => OpenAiMediation) {
  const handlers = new Map<string, Handler>();
  const app = {
    get: (path: string, handler: Handler) => handlers.set(`GET ${path}`, handler),
    post: (path: string, handler: Handler) => handlers.set(`POST ${path}`, handler),
  } as unknown as Application;
  registerOpenAiCompatibleRoutes({
    app,
    mediate,
    enforceRateLimit: () => true,
    rateLimiter: {} as FixedWindowRateLimiter,
  });
  return handlers;
}

function makeRes(): { res: Response; captured: Captured } {
  const captured: Captured = { status: 200, body: undefined, headers: {}, writes: [], ended: false };
  const res = {
    status(code: number) { captured.status = code; return this; },
    json(payload: unknown) { captured.body = payload; return this; },
    setHeader(name: string, value: string) { captured.headers[name] = value; },
    flushHeaders() { /* no-op */ },
    write(chunk: string) { captured.writes.push(chunk); return true; },
    end() { captured.ended = true; },
  };
  return { res: res as unknown as Response, captured };
}

function mediateEcho(input: string, profile: OpenAiProfile): OpenAiMediation {
  return { answer: `Isabella recibió: ${input}`, profile, safeguards: ["human-override-ready"] };
}

describe("OpenAI-compatible surface", () => {
  it("advertises the model list", () => {
    const handlers = harness(mediateEcho);
    const { res, captured } = makeRes();
    handlers.get("GET /v1/models")!({} as Request, res);
    const body = captured.body as { object: string; data: Array<{ id: string; object: string }> };
    expect(body.object).toBe("list");
    expect(body.data.map((m) => m.id)).toContain("isabella-genesis");
    expect(body.data.every((m) => m.object === "model")).toBe(true);
  });

  it("returns an OpenAI-shaped chat completion and derives the profile from the model", () => {
    const handlers = harness(mediateEcho);
    const { res, captured } = makeRes();
    handlers.get("POST /v1/chat/completions")!(
      { body: { model: "isabella-genesis-gobernanza", messages: [{ role: "user", content: "hola" }] } } as unknown as Request,
      res,
    );
    const body = captured.body as {
      object: string;
      choices: Array<{ message: { role: string; content: string }; finish_reason: string }>;
      usage: { total_tokens: number };
      isabella: { profile: string };
    };
    expect(body.object).toBe("chat.completion");
    expect(body.choices[0]?.message.content).toContain("hola");
    expect(body.choices[0]?.finish_reason).toBe("stop");
    expect(body.isabella.profile).toBe("gobernanza");
    expect(body.usage.total_tokens).toBeGreaterThan(0);
  });

  it("streams SSE chunks and terminates with [DONE]", () => {
    const handlers = harness(mediateEcho);
    const { res, captured } = makeRes();
    handlers.get("POST /v1/chat/completions")!(
      { body: { stream: true, messages: [{ role: "user", content: "hola mundo" }] } } as unknown as Request,
      res,
    );
    expect(captured.headers["Content-Type"]).toContain("text/event-stream");
    expect(captured.writes.every((chunk) => chunk.startsWith("data: "))).toBe(true);
    expect(captured.writes.at(-1)).toBe("data: [DONE]\n\n");
    expect(captured.ended).toBe(true);
  });

  it("fails closed with an OpenAI-shaped error envelope on invalid input", () => {
    const handlers = harness(mediateEcho);
    const { res, captured } = makeRes();
    handlers.get("POST /v1/chat/completions")!({ body: { messages: [] } } as unknown as Request, res);
    const body = captured.body as { error: { type: string; code: string } };
    expect(captured.status).toBe(400);
    expect(body.error.type).toBe("invalid_request_error");
    expect(body.error.code).toBe("INVALID_MESSAGES");
  });

  it("supports legacy text completions", () => {
    const handlers = harness(mediateEcho);
    const { res, captured } = makeRes();
    handlers.get("POST /v1/completions")!({ body: { prompt: "resume" } } as unknown as Request, res);
    const body = captured.body as { object: string; choices: Array<{ text: string }> };
    expect(body.object).toBe("text_completion");
    expect(body.choices[0]?.text).toContain("resume");
  });
});
