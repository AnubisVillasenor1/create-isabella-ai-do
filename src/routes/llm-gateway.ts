// Multi-provider gateway surface — Anthropic, Google (Gemini) and Llama wire-compatible
// front-doors that all route through the same canonical Genesis mediation as the OpenAI
// surface (src/routes/openai.ts). Invariant (AGENTS.md §1): the transport carries intent
// and returns a reply; it grants NO authority. The profile is derived server-side from the
// requested model id, never from free-text. Every response is optional-audited with the
// prompt preview redacted before it is stored.
//
// state: draft | engine-generated. Not affiliated with Anthropic, Google or Meta; these
// are transport adapters only.
import { randomUUID } from 'node:crypto';
import type { Application, Request, Response } from 'express';
import type { FixedWindowRateLimiter } from '../security/rate-limit';
import type { GatewayAuditLog } from '../observability/gateway-audit';
import type { OpenAiMediation, OpenAiProfile } from './openai';

export const LLM_GATEWAY_VERSION = '1.0.0';

export interface LlmGatewayDeps {
  readonly app: Application;
  /** Same server-side mediator the OpenAI surface uses; profile resolved from the model id. */
  readonly mediate: (input: string, profile: OpenAiProfile) => OpenAiMediation;
  readonly modelId?: string;
  readonly ownedBy?: string;
  readonly enforceRateLimit: (
    req: Request,
    res: Response,
    limiter: FixedWindowRateLimiter,
    bucket: string
  ) => boolean;
  readonly rateLimiter: FixedWindowRateLimiter;
  readonly authorizeApiToken?: (req: Request, res: Response, envName: string) => boolean;
  readonly apiTokenEnvName?: string;
  readonly audit?: GatewayAuditLog;
}

const PROFILE_SUFFIXES: ReadonlyArray<readonly [string, OpenAiProfile]> = [
  ['gobernanza', 'gobernanza'],
  ['contra-auditoria', 'contra-auditoria'],
  ['contraauditoria', 'contra-auditoria'],
  ['auditoria', 'contra-auditoria'],
  ['simulacion', 'simulacion'],
  ['secretaria', 'secretaria'],
];

function profileForModel(model: string): OpenAiProfile {
  const normalized = model.trim().toLowerCase();
  for (const [suffix, profile] of PROFILE_SUFFIXES) {
    if (normalized.endsWith(`-${suffix}`) || normalized === suffix) return profile;
  }
  return 'general';
}

function estimateTokens(text: string): number {
  return Math.max(1, Math.ceil(text.length / 4));
}

function textFromContent(content: unknown): string {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === 'string') return part;
        const record = part as { type?: string; text?: string };
        return record.type === 'text' || record.type === undefined ? (record.text ?? '') : '';
      })
      .join('');
  }
  return '';
}

const MAX_INPUT_CHARS = 20_000;

function lastUserText(rawMessages: unknown): string {
  if (!Array.isArray(rawMessages)) return '';
  for (let i = rawMessages.length - 1; i >= 0; i -= 1) {
    const item = rawMessages[i];
    if (typeof item !== 'object' || item === null) continue;
    const record = item as { role?: unknown; content?: unknown };
    if (record.role === 'user') return textFromContent(record.content).trim();
  }
  return '';
}

function chunkText(text: string): string[] {
  return text.match(/[\s\S]{1,24}/g) ?? [];
}

export function registerLlmGatewayRoutes(deps: LlmGatewayDeps): void {
  const { app, mediate, enforceRateLimit, rateLimiter, audit } = deps;
  const modelId = deps.modelId ?? 'isabella-genesis';
  const created = 1_700_000_000;

  const guard = (req: Request, res: Response, bucket: string): boolean => {
    if (deps.authorizeApiToken && deps.apiTokenEnvName) {
      if (!deps.authorizeApiToken(req, res, deps.apiTokenEnvName)) return false;
    }
    return enforceRateLimit(req, res, rateLimiter, bucket);
  };

  const record = (
    provider: 'anthropic' | 'google' | 'llama',
    endpoint: string,
    model: string,
    status: number,
    started: number,
    req: Request,
    prompt: string,
    completion: string,
    stream: boolean
  ): void => {
    if (!audit) return;
    audit.record({
      provider,
      endpoint,
      model,
      status,
      latencyMs: Math.max(0, Date.now() - started),
      ip: req.ip,
      prompt,
      completion,
      stream,
    });
  };

  // ── Anthropic Messages API ────────────────────────────────────────────────
  app.post('/v1/messages', (req, res) => {
    const started = Date.now();
    if (!guard(req, res, 'gateway-anthropic')) return;
    const body = (req.body ?? {}) as Record<string, unknown>;
    const requestedModel =
      typeof body.model === 'string' && body.model.trim() ? body.model.trim() : modelId;
    const system = typeof body.system === 'string' ? body.system : '';
    const input = [system, lastUserText(body.messages)].filter(Boolean).join('\n').trim();
    if (!input) {
      record('anthropic', '/v1/messages', requestedModel, 400, started, req, '', '', false);
      res.status(400).json({
        type: 'error',
        error: {
          type: 'invalid_request_error',
          message: 'A `messages` or `system` text is required.',
        },
      });
      return;
    }
    if (input.length > MAX_INPUT_CHARS) {
      record('anthropic', '/v1/messages', requestedModel, 413, started, req, input, '', false);
      res.status(413).json({
        type: 'error',
        error: {
          type: 'invalid_request_error',
          message: 'Input exceeds the 20000-character mediation limit.',
        },
      });
      return;
    }

    let mediation: OpenAiMediation;
    try {
      mediation = mediate(input, profileForModel(requestedModel));
    } catch (error) {
      record('anthropic', '/v1/messages', requestedModel, 500, started, req, input, '', false);
      res.status(500).json({
        type: 'error',
        error: {
          type: 'api_error',
          message: error instanceof Error ? error.message : 'MEDIATION_FAILED',
        },
      });
      return;
    }

    const id = `msg_${randomUUID().replace(/-/g, '')}`;
    const inputTokens = estimateTokens(input);
    const outputTokens = estimateTokens(mediation.answer);

    if (body.stream === true) {
      res.status(200);
      res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache, no-transform');
      res.setHeader('Connection', 'keep-alive');
      res.flushHeaders?.();
      const send = (event: string, data: unknown): void => {
        res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
      };
      send('message_start', {
        type: 'message_start',
        message: {
          id,
          type: 'message',
          role: 'assistant',
          content: [],
          model: requestedModel,
          usage: { input_tokens: inputTokens, output_tokens: 0 },
        },
      });
      send('content_block_start', {
        type: 'content_block_start',
        index: 0,
        content_block: { type: 'text', text: '' },
      });
      for (const piece of chunkText(mediation.answer)) {
        send('content_block_delta', {
          type: 'content_block_delta',
          index: 0,
          delta: { type: 'text_delta', text: piece },
        });
      }
      send('content_block_stop', { type: 'content_block_stop', index: 0 });
      send('message_delta', {
        type: 'message_delta',
        delta: { stop_reason: 'end_turn' },
        usage: { output_tokens: outputTokens },
      });
      send('message_stop', { type: 'message_stop' });
      res.end();
      record(
        'anthropic',
        '/v1/messages',
        requestedModel,
        200,
        started,
        req,
        input,
        mediation.answer,
        true
      );
      return;
    }

    record(
      'anthropic',
      '/v1/messages',
      requestedModel,
      200,
      started,
      req,
      input,
      mediation.answer,
      false
    );
    res.json({
      id,
      type: 'message',
      role: 'assistant',
      model: requestedModel,
      content: [{ type: 'text', text: mediation.answer }],
      stop_reason: 'end_turn',
      stop_sequence: null,
      usage: { input_tokens: inputTokens, output_tokens: outputTokens },
    });
  });

  // ── Google Gemini (v1beta) ────────────────────────────────────────────────
  // Path form: /v1beta/models/<model>:generateContent  |  :streamGenerateContent
  app.post('/v1beta/models/:spec', (req, res) => {
    const started = Date.now();
    if (!guard(req, res, 'gateway-google')) return;
    const spec = String(req.params.spec ?? '');
    const [rawModel, rawAction] = spec.split(':');
    const action = (rawAction ?? 'generateContent').toLowerCase();
    const streaming = action.startsWith('stream');
    const requestedModel = rawModel && rawModel.trim() ? rawModel.trim() : modelId;

    const body = (req.body ?? {}) as Record<string, unknown>;
    const systemInstruction = body.systemInstruction as { parts?: unknown[] } | undefined;
    const systemText = systemInstruction ? textFromContent(systemInstruction.parts) : '';
    const contents = Array.isArray(body.contents) ? body.contents : [];
    let lastModelUser = '';
    for (let i = contents.length - 1; i >= 0; i -= 1) {
      const item = contents[i];
      if (typeof item !== 'object' || item === null) continue;
      const recordItem = item as { parts?: unknown };
      const text = textFromContent(recordItem.parts).trim();
      if (text) {
        lastModelUser = text;
        break;
      }
    }
    const input = [systemText, lastModelUser].filter(Boolean).join('\n').trim();
    if (!input) {
      record(
        'google',
        '/v1beta/models/:spec',
        requestedModel,
        400,
        started,
        req,
        '',
        '',
        streaming
      );
      res.status(400).json({
        error: {
          code: 400,
          message: '`contents` with textual parts is required.',
          status: 'INVALID_ARGUMENT',
        },
      });
      return;
    }
    if (input.length > MAX_INPUT_CHARS) {
      record(
        'google',
        '/v1beta/models/:spec',
        requestedModel,
        413,
        started,
        req,
        input,
        '',
        streaming
      );
      res.status(413).json({
        error: {
          code: 413,
          message: 'Input exceeds the 20000-character mediation limit.',
          status: 'REQUEST_TOO_LARGE',
        },
      });
      return;
    }

    let mediation: OpenAiMediation;
    try {
      mediation = mediate(input, profileForModel(requestedModel));
    } catch (error) {
      record(
        'google',
        '/v1beta/models/:spec',
        requestedModel,
        500,
        started,
        req,
        input,
        '',
        streaming
      );
      res.status(500).json({
        error: {
          code: 500,
          message: error instanceof Error ? error.message : 'MEDIATION_FAILED',
          status: 'INTERNAL',
        },
      });
      return;
    }

    const promptTokens = estimateTokens(input);
    const completionTokens = estimateTokens(mediation.answer);
    const candidate = (text: string, finish: string | null) => ({
      content: { parts: [{ text }], role: 'model' },
      finishReason: finish,
      index: 0,
    });

    if (streaming) {
      res.status(200);
      res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache, no-transform');
      res.flushHeaders?.();
      for (const piece of chunkText(mediation.answer)) {
        res.write(
          `data: ${JSON.stringify({ candidates: [candidate(piece, null)], modelVersion: requestedModel })}\n\n`
        );
      }
      res.write(
        `data: ${JSON.stringify({ candidates: [candidate('', 'STOP')], usageMetadata: { promptTokenCount: promptTokens, candidatesTokenCount: completionTokens, totalTokenCount: promptTokens + completionTokens } })}\n\n`
      );
      res.write('data: [DONE]\n\n');
      res.end();
      record(
        'google',
        '/v1beta/models/:spec',
        requestedModel,
        200,
        started,
        req,
        input,
        mediation.answer,
        true
      );
      return;
    }

    record(
      'google',
      '/v1beta/models/:spec',
      requestedModel,
      200,
      started,
      req,
      input,
      mediation.answer,
      false
    );
    res.json({
      candidates: [candidate(mediation.answer, 'STOP')],
      promptFeedback: { safetyRatings: [] },
      modelVersion: requestedModel,
      usageMetadata: {
        promptTokenCount: promptTokens,
        candidatesTokenCount: completionTokens,
        totalTokenCount: promptTokens + completionTokens,
      },
    });
  });

  // ── Llama (OpenAI-compatible /llama/v1) ───────────────────────────────────
  app.get('/llama/v1/models', (req, res) => {
    if (!guard(req, res, 'gateway-llama-models')) return;
    res.json({
      object: 'list',
      data: [{ id: modelId, object: 'model', created, owned_by: deps.ownedBy ?? 'tamv-isabella' }],
    });
  });

  app.post('/llama/v1/chat/completions', (req, res) => {
    const started = Date.now();
    if (!guard(req, res, 'gateway-llama-chat')) return;
    const body = (req.body ?? {}) as Record<string, unknown>;
    const requestedModel =
      typeof body.model === 'string' && body.model.trim() ? body.model.trim() : modelId;
    const input = lastUserText(body.messages);
    if (!input) {
      record(
        'llama',
        '/llama/v1/chat/completions',
        requestedModel,
        400,
        started,
        req,
        '',
        '',
        false
      );
      res.status(400).json({
        error: {
          message: 'A `user` message with textual content is required.',
          type: 'invalid_request_error',
          param: null,
          code: 'MISSING_USER_MESSAGE',
        },
      });
      return;
    }
    if (input.length > MAX_INPUT_CHARS) {
      record(
        'llama',
        '/llama/v1/chat/completions',
        requestedModel,
        413,
        started,
        req,
        input,
        '',
        false
      );
      res.status(413).json({
        error: {
          message: 'Input exceeds the 20000-character mediation limit.',
          type: 'invalid_request_error',
          param: null,
          code: 'INPUT_TOO_LARGE',
        },
      });
      return;
    }

    let mediation: OpenAiMediation;
    try {
      mediation = mediate(input, profileForModel(requestedModel));
    } catch (error) {
      record(
        'llama',
        '/llama/v1/chat/completions',
        requestedModel,
        500,
        started,
        req,
        input,
        '',
        false
      );
      res.status(500).json({
        error: {
          message: error instanceof Error ? error.message : 'MEDIATION_FAILED',
          type: 'server_error',
          param: null,
          code: 'MEDIATION_FAILED',
        },
      });
      return;
    }

    const id = `chatcmpl-${randomUUID().replace(/-/g, '')}`;
    const promptTokens = estimateTokens(input);
    const completionTokens = estimateTokens(mediation.answer);

    if (body.stream === true) {
      res.status(200);
      res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache, no-transform');
      res.flushHeaders?.();
      const emit = (delta: Record<string, unknown>, finish: string | null): void => {
        res.write(
          `data: ${JSON.stringify({ id, object: 'chat.completion.chunk', created, model: requestedModel, choices: [{ index: 0, delta, finish_reason: finish }] })}\n\n`
        );
      };
      emit({ role: 'assistant' }, null);
      for (const piece of chunkText(mediation.answer)) emit({ content: piece }, null);
      emit({}, 'stop');
      res.write('data: [DONE]\n\n');
      res.end();
      record(
        'llama',
        '/llama/v1/chat/completions',
        requestedModel,
        200,
        started,
        req,
        input,
        mediation.answer,
        true
      );
      return;
    }

    record(
      'llama',
      '/llama/v1/chat/completions',
      requestedModel,
      200,
      started,
      req,
      input,
      mediation.answer,
      false
    );
    res.json({
      id,
      object: 'chat.completion',
      created,
      model: requestedModel,
      choices: [
        {
          index: 0,
          message: { role: 'assistant', content: mediation.answer },
          finish_reason: 'stop',
        },
      ],
      usage: {
        prompt_tokens: promptTokens,
        completion_tokens: completionTokens,
        total_tokens: promptTokens + completionTokens,
      },
      system_fingerprint: `isabella-${LLM_GATEWAY_VERSION}`,
      isabella: { profile: mediation.profile, safeguards: mediation.safeguards },
    });
  });
}
