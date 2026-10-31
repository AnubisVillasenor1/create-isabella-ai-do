// state: draft | engine-generated — pruebas de la superficie HTTP gobernada TAMV.
import { describe, expect, it } from 'vitest';
import type { Application, Request, Response } from 'express';
import type { FixedWindowRateLimiter } from '../../src/security/rate-limit';
import { registerTamvRoutes } from '../../src/routes/tamv';
import { encodeWavPcm16 } from '../../src/ivcc/audio';
import { TAMV_FACTORY_PRESET_IDS, getFactoryPreset } from '../../src/tamv/presets';
import { TAMV_ENGINE_VERSION, TAMV_METHOD_IDS, type TamvPreset } from '../../src/tamv/types';
import { FIX_RATE, tone } from '../tamv/fixtures';

type Handler = (req: Request, res: Response) => void;

/**
 * Contrato exacto de la superficie. Las rutas se citan solas, sin prefijo de método, porque
 * `scripts/route-inventory.mjs` toma toda literal `/api/v1/...` de un archivo de prueba como
 * evidencia de que la prueba la ejercita: aquí sí la ejercitamos, ruta por ruta.
 */
const TAMV_CONTRACT: readonly (readonly [string, string])[] = [
  ['GET', '/api/v1/tamv/status'],
  ['GET', '/api/v1/tamv/presets'],
  ['GET', '/api/v1/tamv/presets/:presetId'],
  ['POST', '/api/v1/tamv/analyze'],
  ['POST', '/api/v1/tamv/adaptive-preset'],
  ['POST', '/api/v1/tamv/redefine-plan'],
];

interface HarnessOptions {
  readonly denyAdmin?: boolean;
  readonly rateLimited?: boolean;
}

interface Captured {
  status: number;
  body: Record<string, unknown>;
}

function wavDataUrl(hz = 220, amplitude = 0.3): string {
  const bytes = encodeWavPcm16(tone(hz, amplitude), FIX_RATE, 1);
  return `data:audio/wav;base64,${Buffer.from(bytes).toString('base64')}`;
}

function harness(options: HarnessOptions = {}) {
  const handlers = new Map<string, Handler>();
  const register = (method: string) => (path: string, handler: Handler) => {
    handlers.set(`${method} ${path}`, handler);
  };
  const app = { get: register('GET'), post: register('POST') } as unknown as Application;
  const evidence: Array<Record<string, unknown>> = [];
  const buckets: string[] = [];

  registerTamvRoutes({
    app,
    enforceRateLimit: (_req, _res, _limiter, bucket) => {
      buckets.push(bucket);
      if (options.rateLimited) {
        _res.status(429).json({ success: false, error: 'RATE_LIMITED' });
        return false;
      }
      return true;
    },
    rateLimiter: {} as FixedWindowRateLimiter,
    authorizeAdmin: (_req, res) => {
      if (!options.denyAdmin) return true;
      res.status(401).json({ success: false, error: 'UNAUTHORIZED' });
      return false;
    },
    recordEvidence: (event) => {
      evidence.push(event as unknown as Record<string, unknown>);
    },
  });

  const call = (key: string, body?: unknown, params: Record<string, string> = {}): Captured => {
    const captured: Captured = { status: 200, body: {} };
    const res = {
      status(code: number) {
        captured.status = code;
        return this;
      },
      json(payload: unknown) {
        captured.body = payload as Record<string, unknown>;
        return this;
      },
    } as unknown as Response;
    const req = { body, params, ip: '127.0.0.1', get: () => undefined, query: {} } as unknown as Request;
    handlers.get(key)!(req, res);
    return captured;
  };

  return { handlers, evidence, buckets, call };
}

describe('TAMV rutas · superficie registrada', () => {
  it('las seis rutas del contrato están montadas sobre /api/v1/tamv', () => {
    const h = harness();
    expect([...h.handlers.keys()].sort()).toEqual(
      TAMV_CONTRACT.map(([method, path]) => `${method} ${path}`).sort()
    );
  });

  it('status no exige token y declara lo que el motor no hace', () => {
    const h = harness({ denyAdmin: true });
    const result = h.call('GET /api/v1/tamv/status');
    expect(result.status).toBe(200);
    expect(result.body).toMatchObject({
      success: true,
      engineVersion: TAMV_ENGINE_VERSION,
      audioRendered: false,
      executionPerformed: false,
    });
    const status = result.body.status as Record<string, unknown>;
    expect(status.realtimePlayback).toBe(false);
    expect(status.hapticActuators).toBe(false);
    expect(status.gpuAcceleration).toBe(false);
  });

  it('el listado de presets es un resumen y el detalle trae la cadena completa', () => {
    const h = harness();
    const list = h.call('GET /api/v1/tamv/presets');
    expect(list.body.count).toBe(TAMV_FACTORY_PRESET_IDS.length);
    const items = list.body.presets as Array<Record<string, unknown>>;
    expect(items).toHaveLength(TAMV_FACTORY_PRESET_IDS.length);
    expect(items[0].processingChain).toBeUndefined();
    expect(items[0].matrix).toBeDefined();

    const detail = h.call('GET /api/v1/tamv/presets/:presetId', undefined, {
      presetId: 'cathedral_reverence',
    });
    expect(detail.status).toBe(200);
    const preset = detail.body.preset as TamvPreset;
    expect(preset.presetId).toBe('cathedral_reverence');
    expect(preset.processingChain.length).toBeGreaterThan(0);
    expect(detail.body.executionPerformed).toBe(false);

    const missing = h.call('GET /api/v1/tamv/presets/:presetId', undefined, { presetId: 'no_existe' });
    expect(missing.status).toBe(404);
    expect(missing.body).toEqual({ success: false, error: 'TAMV_PRESET_NOT_FOUND' });
    const blank = h.call('GET /api/v1/tamv/presets/:presetId', undefined, {});
    expect(blank.status).toBe(404);
  });

  it('las lecturas GET no dejan evidencia: no se finge trazabilidad donde no hubo operación', () => {
    const h = harness();
    h.call('GET /api/v1/tamv/status');
    h.call('GET /api/v1/tamv/presets');
    expect(h.evidence).toEqual([]);
  });
});

describe('TAMV rutas · gobernanza de los POST', () => {
  for (const [key, methodId] of [
    ['POST /api/v1/tamv/analyze', TAMV_METHOD_IDS.analyze],
    ['POST /api/v1/tamv/adaptive-preset', TAMV_METHOD_IDS.adaptivePreset],
    ['POST /api/v1/tamv/redefine-plan', TAMV_METHOD_IDS.redefinePlan],
  ] as const) {
    it(`${key} se cierra sin token y no produce evidencia`, () => {
      const h = harness({ denyAdmin: true });
      const denied = h.call(key, { dataUrl: wavDataUrl() });
      expect(denied.status).toBe(401);
      expect(denied.body.success).toBe(false);
      expect(h.evidence).toEqual([]);
      expect(h.buckets).toEqual([]);
    });

    it(`${key} con permiso pero fuera de cuota corta antes de analizar`, () => {
      const h = harness({ rateLimited: true });
      const limited = h.call(key, { dataUrl: wavDataUrl() });
      expect(limited.status).toBe(429);
      expect(h.evidence).toEqual([]);
      expect(h.buckets.length).toBe(1);
    });

    it(`${key} registra su identidad de método al admitir trabajo real`, () => {
      const h = harness();
      const ok = h.call(key, { dataUrl: wavDataUrl() });
      expect(ok.status).toBe(200);
      expect(ok.body.success).toBe(true);
      expect(ok.body.authorizationPerformed).toBe(false);
      expect(ok.body.executionPerformed).toBe(false);
      expect(h.evidence).toHaveLength(1);
      expect(h.evidence[0].methodId).toBe(methodId);
      expect(h.evidence[0].principal).toBe('tamv');
    });
  }

  it('rechazan el payload antes de gastar CPU, con el motivo exacto', () => {
    const cases: Array<[unknown, string]> = [
      [{}, 'TAMV_PAYLOAD_EMPTY'],
      [{ dataUrl: 'data:audio/wav;base64,' }, 'TAMV_PAYLOAD_EMPTY'],
      [{ base64: 'no-es-base64!!', mimeType: 'audio/wav' }, 'TAMV_BASE64_INVALID'],
      [{ base64: 'QUJD', mimeType: 'audio/mpeg' }, 'TAMV_MIME_UNSUPPORTED'],
      [{ dataUrl: `data:audio/wav;base64,${'QUJD'.repeat(70_000)}` }, 'TAMV_PAYLOAD_TOO_LARGE'],
      [{ dataUrl: 'data:audio/wav;base64,@@ no es base64 @@' }, 'TAMV_BASE64_INVALID'],
      [{ dataUrl: 'data:image/png;base64,QUJD' }, 'TAMV_MIME_UNSUPPORTED'],
    ];
    for (const [key, expected] of [
      ['POST /api/v1/tamv/analyze', cases]
    ] as Array<[string, Array<[unknown, string]>]>) {
      for (const [body, code] of expected) {
        const h = harness();
        const result = h.call(key, body);
        expect(result.status).toBe(400);
        expect(result.body.error).toBe(code);
        expect(h.evidence).toEqual([]);
      }
    }
  });

  it('un WAV íntegro pero ilegible se devuelve como rechazo, no como análisis vacío', () => {
    const fake = `data:audio/wav;base64,${Buffer.from('esto no es un RIFF').toString('base64')}`;
    const h = harness();
    const result = h.call('POST /api/v1/tamv/analyze', { dataUrl: fake });
    expect(result.status).toBe(400);
    expect(result.body.error).toBe('TAMV_WAV_UNDECODEABLE');
    expect(typeof result.body.detail).toBe('string');
  });
});

describe('TAMV rutas · cuerpos de respuesta', () => {
  it('analyze devuelve métricas y monitor sobre el mismo análisis', () => {
    const h = harness();
    const result = h.call('POST /api/v1/tamv/analyze', { audio: { dataUrl: wavDataUrl(330, 0.25) } });
    expect(result.status).toBe(200);
    const body = result.body as unknown as {
      analysis: { analysisId: string; features: { frames: number }; limitations: string[] };
      monitor: { analysisId: string; measuredCount: number; unmeasuredCount: number };
    };
    expect(body.analysis.features.frames).toBe(FIX_RATE);
    expect(body.monitor.analysisId).toBe(body.analysis.analysisId);
    expect(body.monitor.measuredCount).toBe(5);
    expect(body.monitor.unmeasuredCount).toBe(5);
    expect(body.analysis.limitations.length).toBeGreaterThan(0);
    expect(h.evidence[0].detailId).toBe(body.analysis.analysisId);
  });

  it('adaptive-preset informa del preset de fábrica recomendado, sin aplicarlo', () => {
    const h = harness();
    const result = h.call('POST /api/v1/tamv/adaptive-preset', {
      base64: wavDataUrl(220, 0.3).split(',')[1],
      mime: 'audio/wav',
    });
    expect(result.status).toBe(200);
    const body = result.body as unknown as {
      preset: TamvPreset;
      recommendedFactoryPresetId: string;
      analysisId: string;
    };
    expect(body.preset.source).toBe('adaptive');
    expect(getFactoryPreset(body.recommendedFactoryPresetId)).not.toBeNull();
    expect(body.preset.processingChain.every((item) => 'parameters' in item)).toBe(true);
    expect(h.evidence[0].type).toBe('TAMV_ADAPTIVE_PRESET');
    expect(h.evidence[0].detailId).toBe(body.preset.presetId);
  });

  it('redefine-plan declara etapas y no ejecuta ninguna', () => {
    const h = harness();
    const result = h.call('POST /api/v1/tamv/redefine-plan', { dataUrl: wavDataUrl(220, 0.3) });
    expect(result.status).toBe(200);
    const body = result.body as unknown as {
      plan: { stageCount: number; stages: Array<{ audioRendered: boolean }>; digest: string };
      gateSummary: { pass: number; fail: number; unknown: number; blocking: string[] };
      stagesExecuted: number;
      audioRendered: boolean;
    };
    expect(body.plan.stageCount).toBe(8);
    expect(body.plan.stages.every((item) => item.audioRendered === false)).toBe(true);
    expect(body.stagesExecuted).toBe(0);
    expect(body.audioRendered).toBe(false);
    expect(body.plan.digest).toMatch(/^[0-9a-f]{64}$/);
    expect(body.gateSummary.pass + body.gateSummary.fail + body.gateSummary.unknown).toBe(15);
    expect(h.evidence[0].riskTier).toBe('MEDIUM');
    expect(h.evidence[0].status).toBe('PLANNED_NOT_EXECUTED');
  });

  it('un presetId de fábrica conocido cambia la base del plan sin tocar el análisis', () => {
    const h = harness();
    const adaptive = h.call('POST /api/v1/tamv/redefine-plan', { dataUrl: wavDataUrl(220, 0.3) });
    const factory = h.call('POST /api/v1/tamv/redefine-plan', {
      dataUrl: wavDataUrl(220, 0.3),
      presetId: 'broadcast_studio',
    });
    const adaptiveBody = adaptive.body as unknown as { plan: { analysisId: string; presetId: string } };
    const factoryBody = factory.body as unknown as { plan: { analysisId: string; presetId: string } };
    expect(factoryBody.plan.presetId).toBe('broadcast_studio');
    expect(factoryBody.plan.analysisId).toBe(adaptiveBody.plan.analysisId);
  });

  it('un presetId inexistente degrada a adaptativo y lo dice en el cuerpo', () => {
    const h = harness();
    const result = h.call('POST /api/v1/tamv/redefine-plan', {
      dataUrl: wavDataUrl(220, 0.3),
      presetId: 'preset_del_usuario_que_no_existe',
    });
    expect(result.status).toBe(200);
    const body = result.body as unknown as { plan: { presetId: string } };
    expect(body.plan.presetId).toMatch(/^adaptive_/);
  });
});
