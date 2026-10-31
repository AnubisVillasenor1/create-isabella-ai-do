// OpenAI-compatible surface — makes Isabella a drop-in model for any OpenAI SDK
// client, without pretending to be OpenAI. Every request is routed through the
// canonical Genesis mediation (`runtime.mediateIsabella`), so CROWN/AEGIS and the
// Isabella engine still apply. Invariant: the surface TRANSPORTS intent and returns
// a reply; it does not grant authority, and the profile is derived server-side from
// the requested model — never trusted from free-text.
//
// state: draft | engine-generated. Not an OpenAI product; wire-compatible only.
import { randomUUID } from 'node:crypto';
import type { Application, Request, Response } from 'express';
import type { FixedWindowRateLimiter } from '../security/rate-limit';

export const OPENAI_COMPAT_VERSION = '1.0.0';

export type OpenAiProfile =
  'general' | 'contra-auditoria' | 'simulacion' | 'secretaria' | 'gobernanza';

export interface OpenAiMediation {
  readonly answer: string;
  readonly profile: string;
  readonly safeguards: readonly string[];
}

export interface OpenAiCompatibleDeps {
  readonly app: Application;
  /** Server-side mediator. Profile is resolved from the model id, not the client text. */
  readonly mediate: (input: string, profile: OpenAiProfile) => OpenAiMediation;
  /** Advertised model id (default `isabella-genesis`). */
  readonly modelId?: string;
  readonly ownedBy?: string;
  readonly enforceRateLimit: (
    req: Request,
    res: Response,
    limiter: FixedWindowRateLimiter,
    bucket: string
  ) => boolean;
  readonly rateLimiter: FixedWindowRateLimiter;
  /** Bearer-token gate reused from the server; applied only when `apiTokenEnvName` is set. */
  readonly authorizeApiToken?: (req: Request, res: Response, envName: string) => boolean;
  readonly apiTokenEnvName?: string;
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

interface ChatMessage {
  readonly role: string;
  readonly content: unknown;
}

function extractMessages(body: Record<string, unknown>): ChatMessage[] | undefined {
  const raw = body.messages;
  if (!Array.isArray(raw) || raw.length === 0) return undefined;
  const messages: ChatMessage[] = [];
  for (const item of raw) {
    if (typeof item !== 'object' || item === null) return undefined;
    const record = item as { role?: unknown; content?: unknown };
    if (typeof record.role !== 'string') return undefined;
    messages.push({ role: record.role, content: record.content });
  }
  return messages;
}

function sendError(
  res: Response,
  status: number,
  message: string,
  code: string,
  type = 'invalid_request_error'
): void {
  res.status(status).json({ error: { message, type, param: null, code } });
}

export function registerOpenAiCompatibleRoutes(deps: OpenAiCompatibleDeps): void {
  const { app, mediate, enforceRateLimit, rateLimiter } = deps;
  const modelId = deps.modelId ?? 'isabella-genesis';
  const ownedBy = deps.ownedBy ?? 'tamv-isabella';
  const created = 1_700_000_000;

  const guard = (req: Request, res: Response, bucket: string): boolean => {
    if (deps.authorizeApiToken && deps.apiTokenEnvName) {
      if (!deps.authorizeApiToken(req, res, deps.apiTokenEnvName)) return false;
    }
    return enforceRateLimit(req, res, rateLimiter, bucket);
  };

  app.get('/v1/models', (req, res) => {
    if (!guard(req, res, 'openai-models')) return;
    res.json({
      object: 'list',
      data: [
        { id: modelId, object: 'model', created, owned_by: ownedBy },
        { id: `${modelId}-gobernanza`, object: 'model', created, owned_by: ownedBy },
        { id: `${modelId}-contra-auditoria`, object: 'model', created, owned_by: ownedBy },
        { id: `${modelId}-simulacion`, object: 'model', created, owned_by: ownedBy },
        { id: `${modelId}-secretaria`, object: 'model', created, owned_by: ownedBy },
      ],
    });
  });

  app.post('/v1/chat/completions', (req, res) => {
    if (!guard(req, res, 'openai-chat')) return;
    const body = (req.body ?? {}) as Record<string, unknown>;
    const messages = extractMessages(body);
    if (!messages) {
      sendError(
        res,
        400,
        '`messages` must be a non-empty array of { role, content } objects.',
        'INVALID_MESSAGES'
      );
      return;
    }

    const requestedModel =
      typeof body.model === 'string' && body.model.trim() ? body.model.trim() : modelId;
    const profile = profileForModel(requestedModel);

    const lastUser = [...messages].reverse().find((message) => message.role === 'user');
    const input = lastUser ? textFromContent(lastUser.content).trim() : '';
    if (!input) {
      sendError(
        res,
        400,
        'A `user` message with textual content is required.',
        'MISSING_USER_MESSAGE'
      );
      return;
    }
    if (input.length > 20_000) {
      sendError(res, 413, 'Input exceeds the 20000-character mediation limit.', 'INPUT_TOO_LARGE');
      return;
    }

    let mediation: OpenAiMediation;
    try {
      mediation = mediate(input, profile);
    } catch (error) {
      sendError(
        res,
        500,
        error instanceof Error ? error.message : 'MEDIATION_FAILED',
        'MEDIATION_FAILED',
        'server_error'
      );
      return;
    }

    const id = `chatcmpl-${randomUUID().replace(/-/g, '')}`;
    const promptTokens = messages.reduce(
      (sum, message) => sum + estimateTokens(textFromContent(message.content)),
      0
    );
    const completionTokens = estimateTokens(mediation.answer);

    if (body.stream === true) {
      res.status(200);
      res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache, no-transform');
      res.setHeader('Connection', 'keep-alive');
      res.flushHeaders?.();
      const emit = (delta: Record<string, unknown>, finish: string | null): void => {
        res.write(
          `data: ${JSON.stringify({ id, object: 'chat.completion.chunk', created, model: requestedModel, choices: [{ index: 0, delta, finish_reason: finish }] })}\n\n`
        );
      };
      emit({ role: 'assistant' }, null);
      const chunks = mediation.answer.match(/[\s\S]{1,24}/g) ?? [];
      for (const chunk of chunks) emit({ content: chunk }, null);
      emit({}, 'stop');
      res.write('data: [DONE]\n\n');
      res.end();
      return;
    }

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
      system_fingerprint: `isabella-${OPENAI_COMPAT_VERSION}`,
      isabella: { profile: mediation.profile, safeguards: mediation.safeguards },
    });
  });

  app.post('/v1/completions', (req, res) => {
    if (!guard(req, res, 'openai-completions')) return;
    const body = (req.body ?? {}) as Record<string, unknown>;
    const prompt =
      typeof body.prompt === 'string'
        ? body.prompt.trim()
        : Array.isArray(body.prompt)
          ? body.prompt
              .map((p) => textFromContent(p))
              .join('\n')
              .trim()
          : '';
    if (!prompt) {
      sendError(res, 400, '`prompt` must be a string or array of strings.', 'INVALID_PROMPT');
      return;
    }
    const requestedModel =
      typeof body.model === 'string' && body.model.trim() ? body.model.trim() : modelId;
    let mediation: OpenAiMediation;
    try {
      mediation = mediate(prompt.slice(0, 20_000), profileForModel(requestedModel));
    } catch (error) {
      sendError(
        res,
        500,
        error instanceof Error ? error.message : 'MEDIATION_FAILED',
        'MEDIATION_FAILED',
        'server_error'
      );
      return;
    }
    res.json({
      id: `cmpl-${randomUUID().replace(/-/g, '')}`,
      object: 'text_completion',
      created,
      model: requestedModel,
      choices: [{ index: 0, text: mediation.answer, finish_reason: 'stop', logprobs: null }],
      usage: {
        prompt_tokens: estimateTokens(prompt),
        completion_tokens: estimateTokens(mediation.answer),
        total_tokens: estimateTokens(prompt) + estimateTokens(mediation.answer),
      },
      isabella: { profile: mediation.profile, safeguards: mediation.safeguards },
    });
  });
}
