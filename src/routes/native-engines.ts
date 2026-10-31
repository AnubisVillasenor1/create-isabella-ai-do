// ISABELLA Ω · Native Engines surface (state: draft | engine-generated).
//
// Exposes the NATIVE, in-process engines — the local LLM, the native MoE
// router, the native speech engine and the HyperCore Turbo memoizer — as an
// inspectable HTTP surface. This is the counterpart to the provider-backed
// `/api/v1/cognition/*` routes: here the computation happens in this process.
//
// Invariants (AGENTS.md):
// - Reads (GET) are viewer-level and compute only status/diagnostics.
// - Writes (POST) are admin-gated and rate-limited. Generating text or training
//   a model NEVER grants authority and NEVER executes a side effect.
// - Training results are always `PENDING_REVIEW`: a green metric is a capability,
//   not a faculty, an authority or a production deployment.
import type { Application, Request, Response } from 'express';
import { randomUUID } from 'node:crypto';
import { LocalInferenceEngine } from '../inference/local-engine';
import {
  MoeNativeModel,
  type MoeNativeConfig,
  type MoeNativeMode,
} from '../lib/native-ml/moe-native';
import type { FixedWindowRateLimiter } from '../security/rate-limit';

export const NATIVE_ENGINES_ROUTES_VERSION = '1.0.0' as const;
export const NATIVE_ENGINES_METHOD_ID =
  'A.TWINS.NATIVE_ENGINES.inspect.v1.0.0.LOW.AUTONOMOUS' as const;

const MAX_PROMPT_CHARS = 8_000;
const MAX_DIAGNOSTIC_ROWS = 512;
const MAX_DIAGNOSTIC_DIM = 256;
const MAX_EXPERTS = 64;

export interface NativeEnginesRouteDeps {
  readonly app: Application;
  readonly enforceRateLimit: (
    req: Request,
    res: Response,
    limiter: FixedWindowRateLimiter,
    bucket: string
  ) => boolean;
  readonly rateLimiter: FixedWindowRateLimiter;
  /** Admin gate for POST routes. When omitted, no token is required (development). */
  readonly authorizeAdmin?: (req: Request, res: Response) => boolean;
  /** Override the local engine instance (tests / custom configuration). */
  readonly localEngine?: LocalInferenceEngine;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseMode(value: unknown): MoeNativeMode {
  return value === 'classification' ? 'classification' : 'regression';
}

function parseConfig(body: Record<string, unknown>): MoeNativeConfig {
  const inputDim = Number(body.inputDim);
  const expertCount = Number(body.expertCount);
  const topK = Number(body.topK);
  const seed = Number(body.seed);
  if (!Number.isInteger(inputDim) || inputDim < 1 || inputDim > MAX_DIAGNOSTIC_DIM) {
    throw new Error('NATIVE_MOE_INPUT_DIM_INVALID');
  }
  if (!Number.isInteger(expertCount) || expertCount < 2 || expertCount > MAX_EXPERTS) {
    throw new Error('NATIVE_MOE_EXPERT_COUNT_INVALID');
  }
  if (!Number.isInteger(topK) || topK < 1 || topK > expertCount) {
    throw new Error('NATIVE_MOE_TOPK_INVALID');
  }
  if (!Number.isInteger(seed)) throw new Error('NATIVE_MOE_SEED_INVALID');
  return { inputDim, expertCount, topK, mode: parseMode(body.mode), seed };
}

export function registerNativeEnginesRoutes(deps: NativeEnginesRouteDeps): void {
  const { app } = deps;
  const localEngine = deps.localEngine ?? new LocalInferenceEngine();

  app.get('/api/v1/native/engines', (_req, res) => {
    const snapshot = localEngine.getSnapshot();
    res.json({
      success: true,
      methodId: NATIVE_ENGINES_METHOD_ID,
      authorizationPerformed: false,
      executionPerformed: false,
      engines: {
        llm: {
          id: 'isabella-native-llm',
          state: 'wired',
          mode: 'deterministic-intent-matching',
          language: snapshot.language,
          maxResponseLength: snapshot.maxResponseLength,
          learnedRouter: false,
          note: 'Coincidencia de intenciones determinista con trazas de términos; NO es un modelo neuronal entrenado.',
        },
        moe: {
          id: 'isabella-native-moe',
          state: 'wired',
          implementation: 'pure-typescript-topk-sgd',
          trainable: true,
          approvalStatus: 'PENDING_REVIEW',
          diagnostics: ['entropy', 'gini', 'loadStd'],
        },
        speech: {
          id: 'genesis-tts-mx-prime',
          state: 'wired',
          routing: 'load-aware-softmax-topk',
          fairnessWeight: 0.6,
        },
        turbo: {
          id: 'hypercore-turbo-optimizer',
          state: 'wired',
          eviction: 'lru',
          metrics: ['hitRate', 'p50LatencyMs', 'p95LatencyMs', 'evictions'],
        },
      },
    });
  });

  app.get('/api/v1/native/llm/status', (req, res) => {
    if (!deps.enforceRateLimit(req, res, deps.rateLimiter, 'native-llm-status')) return;
    const snapshot = localEngine.getSnapshot();
    res.json({
      success: true,
      methodId: NATIVE_ENGINES_METHOD_ID,
      botName: snapshot.botName,
      botVersion: snapshot.botVersion,
      language: snapshot.language,
      intents: localEngine.intentDistribution(),
    });
  });

  app.post('/api/v1/native/llm/generate', async (req, res) => {
    if (deps.authorizeAdmin && !deps.authorizeAdmin(req, res)) return;
    if (!deps.enforceRateLimit(req, res, deps.rateLimiter, 'native-llm-generate')) return;
    const body = isRecord(req.body) ? req.body : {};
    const prompt = typeof body.prompt === 'string' ? body.prompt.trim() : '';
    if (!prompt) {
      res.status(400).json({ success: false, error: 'NATIVE_LLM_PROMPT_REQUIRED' });
      return;
    }
    if (prompt.length > MAX_PROMPT_CHARS) {
      res.status(413).json({ success: false, error: 'NATIVE_LLM_PROMPT_TOO_LONG' });
      return;
    }
    const traceId = `native-llm-${randomUUID()}`;
    try {
      const result = await localEngine.generate({ prompt, maxTokens: 512 });
      res.json({
        success: true,
        methodId: NATIVE_ENGINES_METHOD_ID,
        traceId,
        authorizationPerformed: false,
        executionPerformed: false,
        text: result.text,
        intent: result.intent,
        confidence: result.confidence,
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'NATIVE_LLM_FAILED',
      });
    }
  });

  app.post('/api/v1/native/moe/diagnostics', (req, res) => {
    if (deps.authorizeAdmin && !deps.authorizeAdmin(req, res)) return;
    if (!deps.enforceRateLimit(req, res, deps.rateLimiter, 'native-moe-diagnostics')) return;
    const body = isRecord(req.body) ? req.body : {};
    const rawRows = Array.isArray(body.inputs) ? body.inputs : [];
    if (rawRows.length === 0) {
      res.status(400).json({ success: false, error: 'NATIVE_MOE_INPUTS_REQUIRED' });
      return;
    }
    if (rawRows.length > MAX_DIAGNOSTIC_ROWS) {
      res.status(413).json({ success: false, error: 'NATIVE_MOE_INPUTS_TOO_MANY' });
      return;
    }
    try {
      const config = parseConfig(body);
      const inputs = rawRows.map((row) => {
        if (!Array.isArray(row) || row.length !== config.inputDim) {
          throw new Error('NATIVE_MOE_INPUT_DIMENSION_MISMATCH');
        }
        return row.map((value) => {
          const numeric = Number(value);
          if (!Number.isFinite(numeric)) throw new Error('NATIVE_MOE_INPUT_NOT_FINITE');
          return numeric;
        });
      });
      // A seeded, untrained model: the diagnostics describe the initial router,
      // which is the honest baseline. Training is a separate, governed operation.
      const model = new MoeNativeModel(config);
      const diagnostics = model.routingDiagnostics(inputs);
      res.json({
        success: true,
        methodId: NATIVE_ENGINES_METHOD_ID,
        authorizationPerformed: false,
        executionPerformed: false,
        approvalStatus: 'PENDING_REVIEW',
        trained: false,
        diagnostics,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'NATIVE_MOE_DIAGNOSTICS_FAILED';
      res.status(400).json({ success: false, error: message });
    }
  });
}
