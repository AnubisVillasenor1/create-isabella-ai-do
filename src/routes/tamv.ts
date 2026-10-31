/**
 * state: draft | engine-generated — TAMV Kaos Audio System: superficie HTTP gobernada.
 *
 * Copyright (c) 2026 TAMV ONLINE ENTERPRISE — Edwin Oswaldo Castillo Trejo (Anubis Villaseñor).
 *
 * Analiza WAV real y devuelve métricas, un preset y un plan reversible. No reproduce, no
 * sintetiza, no autoriza. Cada POST deja evidencia en BookPI con su identidad de método de
 * 7 segmentos. La respuesta repite el invariante en el cuerpo: `authorizationPerformed: false`
 * y `executionPerformed: false` no son decorativos, son la contrato.
 *
 * `POST /analyze`, `/adaptive-preset` y `/redefine-plan` piden el token de administración:
 * reciben bytes del cliente y consumen CPU. Sin `GENESIS_ADMIN_API_TOKEN` configurado el
 * servidor responde 503 por diseño (fail-closed), no 200 con datos parciales.
 */
import type { Application, Request, Response } from 'express';
import type { FixedWindowRateLimiter } from '../security/rate-limit';
import { readMonitor } from '../tamv/monitor';
import { getFactoryPreset, listFactoryPresets } from '../tamv/presets';
import {
  analyzeBytes,
  decodeAudioPayload,
  isTamvFailure,
  tamvStatus,
  type TamvFailure,
} from '../tamv/engine';
import { buildAdaptivePreset } from '../tamv/adaptive';
import { buildRedefinePlan, summarizeGates } from '../tamv/plan';
import {
  TAMV_ENGINE_VERSION,
  TAMV_METHOD_IDS,
  type TamvAnalysis,
  type TamvPreset,
  type TamvRedefinePlan,
} from '../tamv/types';

export const TAMV_ROUTES_VERSION = '1.0.0';

export interface TamvEvidenceEvent {
  readonly type: string;
  readonly methodId: string;
  readonly principal: string;
  readonly riskTier: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  readonly status: string;
  readonly detailId: string;
}

export interface TamvRouteDeps {
  readonly app: Application;
  readonly enforceRateLimit: (
    req: Request,
    res: Response,
    limiter: FixedWindowRateLimiter,
    bucket: string
  ) => boolean;
  readonly rateLimiter: FixedWindowRateLimiter;
  readonly authorizeAdmin: (req: Request, res: Response) => boolean;
  readonly recordEvidence: (event: TamvEvidenceEvent) => void;
}

function fail(res: Response, status: number, error: string, detail?: unknown): void {
  if (detail === undefined) {
    res.status(status).json({ success: false, error });
    return;
  }
  res.status(status).json({ success: false, error, detail });
}

/** El motivo exacto del rechazo viaja al cliente: "no es WAV" y "está vacío" no son lo mismo. */
function payloadFrom(req: Request): { bytes: Uint8Array; mimeType: string } | TamvFailure {
  const body = (req.body ?? {}) as Record<string, unknown>;
  const audio = (
    typeof body.audio === 'object' && body.audio !== null ? body.audio : body
  ) as Record<string, unknown>;
  return decodeAudioPayload({
    dataUrl: audio.dataUrl,
    base64: audio.base64 ?? audio.wavBase64,
    mimeType: audio.mimeType ?? audio.mime,
  });
}

export function registerTamvRoutes(deps: TamvRouteDeps): void {
  const { app } = deps;

  app.get('/api/v1/tamv/status', (_req, res) => {
    res.json({
      success: true,
      engineVersion: TAMV_ENGINE_VERSION,
      routesVersion: TAMV_ROUTES_VERSION,
      status: tamvStatus(),
      audioRendered: false,
      executionPerformed: false,
    });
  });

  app.get('/api/v1/tamv/presets', (_req, res) => {
    const presets = listFactoryPresets().map((item) => ({
      presetId: item.presetId,
      displayName: item.displayName,
      classification: item.classification,
      matrix: item.matrix,
      haptic: item.haptic,
    }));
    res.json({
      success: true,
      count: presets.length,
      presets,
      authorizationPerformed: false,
      executionPerformed: false,
    });
  });

  app.get('/api/v1/tamv/presets/:presetId', (req, res) => {
    const preset = getFactoryPreset(req.params.presetId ?? '');
    if (preset === null) return fail(res, 404, 'TAMV_PRESET_NOT_FOUND');
    res.json({ success: true, preset, executionPerformed: false });
  });

  app.post('/api/v1/tamv/analyze', (req, res) => {
    if (!deps.authorizeAdmin(req, res)) return;
    if (!deps.enforceRateLimit(req, res, deps.rateLimiter, 'tamv-analyze')) return;
    const payload = payloadFrom(req);
    if (isTamvFailure(payload)) return fail(res, 400, payload.code, payload.message);
    const analysis = analyzeBytes(payload.bytes, payload.mimeType);
    if (isTamvFailure(analysis)) return fail(res, 400, analysis.code, analysis.message);
    deps.recordEvidence({
      type: 'TAMV_ANALYSIS',
      methodId: TAMV_METHOD_IDS.analyze,
      principal: 'tamv',
      riskTier: 'LOW',
      status: 'ADMITTED',
      detailId: analysis.analysisId,
    });
    res.json({
      success: true,
      analysis,
      monitor: readMonitor(analysis),
      authorizationPerformed: false,
      executionPerformed: false,
    });
  });

  app.post('/api/v1/tamv/adaptive-preset', (req, res) => {
    if (!deps.authorizeAdmin(req, res)) return;
    if (!deps.enforceRateLimit(req, res, deps.rateLimiter, 'tamv-adaptive-preset')) return;
    const payload = payloadFrom(req);
    if (isTamvFailure(payload)) return fail(res, 400, payload.code, payload.message);
    const analysis = analyzeBytes(payload.bytes, payload.mimeType);
    if (isTamvFailure(analysis)) return fail(res, 400, analysis.code, analysis.message);
    const preset = buildAdaptivePreset(analysis);
    deps.recordEvidence({
      type: 'TAMV_ADAPTIVE_PRESET',
      methodId: TAMV_METHOD_IDS.adaptivePreset,
      principal: 'tamv',
      riskTier: 'LOW',
      status: 'ADMITTED',
      detailId: preset.presetId,
    });
    res.json({
      success: true,
      analysisId: analysis.analysisId,
      preset,
      recommendedFactoryPresetId: analysis.recommendedPresetId,
      authorizationPerformed: false,
      executionPerformed: false,
    });
  });

  app.post('/api/v1/tamv/redefine-plan', (req, res) => {
    if (!deps.authorizeAdmin(req, res)) return;
    if (!deps.enforceRateLimit(req, res, deps.rateLimiter, 'tamv-redefine-plan')) return;
    const payload = payloadFrom(req);
    if (isTamvFailure(payload)) return fail(res, 400, payload.code, payload.message);
    const analysis = analyzeBytes(payload.bytes, payload.mimeType);
    if (isTamvFailure(analysis)) return fail(res, 400, analysis.code, analysis.message);
    const body = (req.body ?? {}) as Record<string, unknown>;
    const requestedPresetId = typeof body.presetId === 'string' ? body.presetId : null;
    const preset: TamvPreset =
      requestedPresetId === null
        ? buildAdaptivePreset(analysis)
        : applyFactoryPreset(analysis, requestedPresetId);
    if (preset.source === 'factory' && !getFactoryPreset(preset.presetId)) {
      return fail(res, 404, 'TAMV_PRESET_NOT_FOUND');
    }
    const plan: TamvRedefinePlan = buildRedefinePlan(analysis, preset);
    deps.recordEvidence({
      type: 'TAMV_REDEFINE_PLAN',
      methodId: TAMV_METHOD_IDS.redefinePlan,
      principal: 'tamv',
      riskTier: 'MEDIUM',
      status: 'PLANNED_NOT_EXECUTED',
      detailId: plan.planId,
    });
    res.json({
      success: true,
      plan,
      gateSummary: summarizeGates(plan),
      stagesExecuted: 0,
      audioRendered: false,
      authorizationPerformed: false,
      executionPerformed: false,
    });
  });
}

/** Preset de fábrica aplicado al análisis: reusa la cadena declarada del preset elegido. */
function applyFactoryPreset(analysis: TamvAnalysis, presetId: string): TamvPreset {
  const factory = getFactoryPreset(presetId);
  if (factory !== null) return factory;
  return buildAdaptivePreset(analysis);
}
