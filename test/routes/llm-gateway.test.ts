import { describe, expect, it } from 'vitest';
import type { Application, Request, Response } from 'express';
import type { FixedWindowRateLimiter } from '../../src/security/rate-limit';
import { registerLlmGatewayRoutes } from '../../src/routes/llm-gateway';
import type { OpenAiMediation, OpenAiProfile } from '../../src/routes/openai';
import { GatewayAuditLog } from '../../src/observability/gateway-audit';

type Handler = (req: Request, res: Response) => void;

interface Captured {
  status: number;
  body: unknown;
  headers: Record<string, string>;
  writes: string[];
  ended: boolean;
}

function makeRes(): { res: Response; captured: Captured } {
  const captured: Captured = {
    status: 200,
    body: undefined,
    headers: {},
    writes: [],
    ended: false,
  };
  const res = {
    status(code: number) {
      captured.status = code;
      return this;
    },
    json(payload: unknown) {
      captured.body = payload;
      return this;
    },
    setHeader(name: string, value: string) {
      captured.headers[name] = value;
    },
    flushHeaders() {
      /* no-op */
    },
    write(chunk: string) {
      captured.writes.push(chunk);
      return true;
    },
    end() {
      captured.ended = true;
    },
  };
  return { res: res as unknown as Response, captured };
}

function harness(audit?: GatewayAuditLog) {
  const handlers = new Map<string, Handler>();
  const app = {
    get: (path: string, handler: Handler) => handlers.set(`GET ${path}`, handler),
    post: (path: string, handler: Handler) => handlers.set(`POST ${path}`, handler),
  } as unknown as Application;
  const mediate = (input: string, profile: OpenAiProfile): OpenAiMediation => ({
    answer: `Echo: ${input}`,
    profile,
    safeguards: ['human-override-ready'],
  });
  registerLlmGatewayRoutes({
    app,
    mediate,
    enforceRateLimit: () => true,
    rateLimiter: {} as FixedWindowRateLimiter,
    audit,
  });
  return handlers;
}

describe('Multi-provider gateway (Anthropic / Google / Llama)', () => {
  it('Anthropic /v1/messages returns a message-shaped completion and derives profile from model', () => {
    const handlers = harness();
    const { res, captured } = makeRes();
    handlers.get('POST /v1/messages')!(
      {
        body: {
          model: 'isabella-genesis-gobernanza',
          messages: [{ role: 'user', content: 'hola' }],
        },
        ip: '1.2.3.4',
      } as unknown as Request,
      res
    );
    const body = captured.body as {
      type: string;
      role: string;
      content: Array<{ type: string; text: string }>;
      stop_reason: string;
      usage: { output_tokens: number };
    };
    expect(body.type).toBe('message');
    expect(body.role).toBe('assistant');
    expect(body.content[0]?.text).toContain('hola');
    expect(body.stop_reason).toBe('end_turn');
    expect(body.usage.output_tokens).toBeGreaterThan(0);
  });

  it('Anthropic streaming emits message_start ... message_stop', () => {
    const handlers = harness();
    const { res, captured } = makeRes();
    handlers.get('POST /v1/messages')!(
      {
        body: { stream: true, messages: [{ role: 'user', content: 'hola mundo' }] },
        ip: '1.2.3.4',
      } as unknown as Request,
      res
    );
    expect(captured.headers['Content-Type']).toContain('text/event-stream');
    const joined = captured.writes.join('');
    expect(joined).toContain('event: message_start');
    expect(joined).toContain('event: content_block_delta');
    expect(joined).toContain('event: message_stop');
    expect(captured.ended).toBe(true);
  });

  it('Anthropic fails closed with an Anthropic error envelope on empty input', () => {
    const handlers = harness();
    const { res, captured } = makeRes();
    handlers.get('POST /v1/messages')!(
      { body: { messages: [] }, ip: '1.2.3.4' } as unknown as Request,
      res
    );
    const body = captured.body as { type: string; error: { type: string } };
    expect(captured.status).toBe(400);
    expect(body.type).toBe('error');
    expect(body.error.type).toBe('invalid_request_error');
  });

  it('Google generateContent returns a candidate with model role and usage', () => {
    const handlers = harness();
    const { res, captured } = makeRes();
    handlers.get('POST /v1beta/models/:spec')!(
      {
        params: { spec: 'gemini-pro:generateContent' },
        body: { contents: [{ role: 'user', parts: [{ text: 'hola' }] }] },
        ip: '1.2.3.4',
      } as unknown as Request,
      res
    );
    const body = captured.body as {
      candidates: Array<{
        content: { parts: Array<{ text: string }>; role: string };
        finishReason: string;
      }>;
      usageMetadata: { totalTokenCount: number };
    };
    expect(body.candidates[0]?.content.role).toBe('model');
    expect(body.candidates[0]?.content.parts[0]?.text).toContain('hola');
    expect(body.candidates[0]?.finishReason).toBe('STOP');
    expect(body.usageMetadata.totalTokenCount).toBeGreaterThan(0);
  });

  it('Google streamGenerateContent emits data chunks ending with [DONE]', () => {
    const handlers = harness();
    const { res, captured } = makeRes();
    handlers.get('POST /v1beta/models/:spec')!(
      {
        params: { spec: 'gemini-pro:streamGenerateContent' },
        body: { contents: [{ parts: [{ text: 'hola mundo' }] }] },
        ip: '1.2.3.4',
      } as unknown as Request,
      res
    );
    expect(captured.headers['Content-Type']).toContain('text/event-stream');
    expect(captured.writes.at(-1)).toBe('data: [DONE]\n\n');
  });

  it('Llama chat completions returns an OpenAI-shaped completion under /llama/v1', () => {
    const handlers = harness();
    const { res, captured } = makeRes();
    handlers.get('POST /llama/v1/chat/completions')!(
      {
        body: { model: 'isabella-genesis', messages: [{ role: 'user', content: 'hola' }] },
        ip: '1.2.3.4',
      } as unknown as Request,
      res
    );
    const body = captured.body as {
      object: string;
      choices: Array<{ message: { content: string } }>;
      usage: { total_tokens: number };
    };
    expect(body.object).toBe('chat.completion');
    expect(body.choices[0]?.message.content).toContain('hola');
    expect(body.usage.total_tokens).toBeGreaterThan(0);
  });

  it('records redacted previews in the audit ledger for every provider call', () => {
    const audit = new GatewayAuditLog(10, 'test-salt');
    const handlers = harness(audit);
    const { res } = makeRes();
    handlers.get('POST /v1/messages')!(
      {
        body: {
          messages: [
            {
              role: 'user',
              content: 'mi correo es ana@corp.com y token Bearer abcdefghijklmnopqrstuv',
            },
          ],
        },
        ip: '9.9.9.9',
      } as unknown as Request,
      res
    );
    const recent = audit.recent(5);
    expect(recent).toHaveLength(1);
    expect(recent[0]?.provider).toBe('anthropic');
    expect(recent[0]?.preview).toContain('[REDACTED:EMAIL]');
    expect(recent[0]?.preview).toContain('[REDACTED:SECRET]');
    expect(recent[0]?.preview).not.toContain('ana@corp.com');
    expect(recent[0]?.clientKey).not.toContain('9.9.9.9');
  });
});
