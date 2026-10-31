// state: engine-generated — revisión humana pendiente.
import { describe, expect, it, vi } from 'vitest';
import type { Request, Response } from 'express';
import {
  createDefaultApiRateLimit,
  normalizeRouteBucket,
  parseDefaultRateLimit,
} from '../../src/http/default-rate-limit';
import { FixedWindowRateLimiter } from '../../src/security/rate-limit';

function res(): Response {
  const captured = {
    status: 0,
    body: {} as Record<string, unknown>,
    headers: {} as Record<string, string>,
  };
  const obj = {
    setHeader(name: string, value: string) {
      captured.headers[name] = String(value);
    },
    status(code: number) {
      captured.status = code;
      return obj;
    },
    json(body: unknown) {
      captured.body = body as Record<string, unknown>;
      return obj;
    },
  };
  return Object.assign(obj as unknown as Response, { __captured: captured });
}

function req(method: string, path: string, ip = '203.0.113.7'): Request {
  return { method, path, ip } as unknown as Request;
}

const captured = (response: Response) =>
  (
    response as unknown as {
      __captured: {
        status: number;
        body: Record<string, unknown>;
        headers: Record<string, string>;
      };
    }
  ).__captured;

describe('parseDefaultRateLimit', () => {
  it('cae al techo por defecto ante cualquier valor inválido, nunca a cero', () => {
    for (const value of [undefined, '', 'abc', '0', '-5', '1e9', '999999'])
      expect(parseDefaultRateLimit(value)).toBe(300);
  });

  it('respeta un entero en rango', () => {
    expect(parseDefaultRateLimit('60')).toBe(60);
    expect(parseDefaultRateLimit('1')).toBe(1);
    expect(parseDefaultRateLimit(' 12 ')).toBe(12);
  });
});

describe('normalizeRouteBucket', () => {
  it('colapsa segmentos que parecen identificadores', () => {
    expect(normalizeRouteBucket('/api/v1/wallet/12345')).toBe('/api/v1/wallet/:id');
    expect(normalizeRouteBucket('/api/v1/memory/3f2b1c9a-4d5e-6f70-8192-a3b4c5d6e7f8')).toBe(
      '/api/v1/memory/:id'
    );
    expect(normalizeRouteBucket('/api/v1/keys/deadc0fedeadbeef00112233')).toBe('/api/v1/keys/:id');
    expect(normalizeRouteBucket('/api/v1/proposals/abcDEF0123456789_-xyz0123456789')).toBe(
      '/api/v1/proposals/:id'
    );
  });

  it('conserva segmentos legibles y de versión', () => {
    expect(normalizeRouteBucket('/api/v1/isa/pipeline')).toBe('/api/v1/isa/pipeline');
    expect(normalizeRouteBucket('/api/v1/cognition/route')).toBe('/api/v1/cognition/route');
  });
});

describe('createDefaultApiRateLimit', () => {
  it('limita todo mutante bajo /api/ aunque la ruta no tenga limiter propio', () => {
    const middleware = createDefaultApiRateLimit({
      limiter: new FixedWindowRateLimiter(2, 60_000),
      clientKey: (request) => request.ip || 'unknown',
    });
    const next = vi.fn();
    for (let i = 0; i < 2; i += 1) {
      middleware(req('POST', '/api/v1/isa/act'), res(), next);
    }
    expect(next).toHaveBeenCalledTimes(2);

    const blocked = res();
    middleware(req('POST', '/api/v1/isa/act'), blocked, next);
    expect(next).toHaveBeenCalledTimes(2);
    expect(captured(blocked).status).toBe(429);
    expect(captured(blocked).body).toMatchObject({
      success: false,
      error: 'RATE_LIMIT_EXCEEDED',
      scope: 'default-mutating-api',
    });
    expect(Number(captured(blocked).headers['Retry-After'])).toBeGreaterThanOrEqual(1);
  });

  it('no interfiere con lecturas ni con superficies fuera de /api/', () => {
    const middleware = createDefaultApiRateLimit({
      limiter: new FixedWindowRateLimiter(1, 60_000),
      clientKey: (request) => request.ip || 'unknown',
    });
    const next = vi.fn();
    for (const [method, path] of [
      ['GET', '/api/v1/readyz'],
      ['HEAD', '/api/v1/isa/act'],
      ['POST', '/ui/upload'],
      ['OPTIONS', '/api/v1/cognition/route'],
    ]) {
      middleware(req(method, path), res(), next);
    }
    expect(next).toHaveBeenCalledTimes(4);
  });

  it('una ruta exenta declarada explícitamente no consume cubeta', () => {
    const middleware = createDefaultApiRateLimit({
      limiter: new FixedWindowRateLimiter(1, 60_000),
      clientKey: (request) => request.ip || 'unknown',
      exemptPaths: ['/api/v1/billing/stripe/webhook'],
    });
    const next = vi.fn();
    for (let i = 0; i < 3; i += 1) {
      middleware(req('POST', '/api/v1/billing/stripe/webhook'), res(), next);
    }
    expect(next).toHaveBeenCalledTimes(3);
  });

  it('la cubeta es por ruta normalizada y cliente, no global', () => {
    const limiter = new FixedWindowRateLimiter(1, 60_000);
    const middleware = createDefaultApiRateLimit({
      limiter,
      clientKey: (request) => request.ip || 'unknown',
    });
    const next = vi.fn();
    middleware(req('POST', '/api/v1/wallet/1'), res(), next);
    middleware(req('POST', '/api/v1/other/2'), res(), next);
    expect(next).toHaveBeenCalledTimes(2);
    middleware(req('POST', '/api/v1/wallet/999'), res(), next);
    expect(next).toHaveBeenCalledTimes(2);
    middleware(req('POST', '/api/v1/wallet/1', '198.51.100.4'), res(), next);
    expect(next).toHaveBeenCalledTimes(3);
  });
});
