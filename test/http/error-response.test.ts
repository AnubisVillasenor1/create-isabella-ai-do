// state: engine-generated — revisión humana pendiente.
import { describe, expect, it, vi } from 'vitest';
import type { NextFunction, Request, Response } from 'express';
import {
  correlationIdMiddleware,
  correlationIdOf,
  failureCode,
  resolveCorrelationId,
  respondWithFailure,
} from '../../src/http/error-response';

interface Captured {
  status: number;
  body: Record<string, unknown>;
  headers: Record<string, string>;
}

function mockResponse(captured: Captured): Response {
  return {
    headersSent: false,
    locals: {},
    setHeader(name: string, value: string) {
      captured.headers[name] = String(value);
    },
    status(code: number) {
      captured.status = code;
      return this as unknown as Response;
    },
    json(body: unknown) {
      captured.body = body as Record<string, unknown>;
      return this as unknown as Response;
    },
  } as unknown as Response;
}

function mockRequest(headers: Record<string, unknown> = {}): Request {
  return { headers } as unknown as Request;
}

describe('failureCode: sólo códigos del sistema salen al cliente', () => {
  it('deja pasar los códigos SCREAMING_SNAKE propios', () => {
    expect(failureCode(new Error('IKES_PERSISTENCE_WRITE_FAILED'))).toBe(
      'IKES_PERSISTENCE_WRITE_FAILED'
    );
  });

  it('no filtra mensajes en prosa, rutas absolutas ni URIs de conexión', () => {
    const leaks = [
      new Error('connect ECONNREFUSED 10.0.0.7:5432'),
      new Error('C:\\Users\\tamvo\\repo\\src\\server.ts:42'),
      new Error('SyntaxError: Unexpected token < in JSON at position 0'),
      new Error('postgresql://admin:secreto@prod/db'),
      new Error(''),
      new TypeError('x is not a function'),
      'cadena arbitraria',
      null,
      undefined,
    ];
    for (const cause of leaks) expect(failureCode(cause)).toBe('REQUEST_FAILED');
  });

  it('admite un fallback de código legible por contrato', () => {
    expect(failureCode(new Error('boom'), 'ISA_PIPELINE_EVALUATION_FAILED')).toBe(
      'ISA_PIPELINE_EVALUATION_FAILED'
    );
  });
});

describe('respondWithFailure', () => {
  it('responde con código estable + correlationId y conserva el detalle en el log', () => {
    const captured: Captured = { status: 0, body: {}, headers: {} };
    const res = mockResponse(captured);
    const log = vi.fn();
    correlationIdMiddleware(mockRequest(), res, (() => undefined) as NextFunction);

    respondWithFailure(res, 500, new Error('SQL: SELECT * FROM secret'), {
      code: 'READINESS_EVALUATION_FAILED',
      log,
    });

    expect(captured.status).toBe(500);
    expect(captured.body).toEqual({
      success: false,
      error: 'READINESS_EVALUATION_FAILED',
      correlationId: expect.any(String),
    });
    expect(JSON.stringify(captured.body)).not.toContain('SELECT');
    expect(log).toHaveBeenCalledWith(
      expect.objectContaining({ status: 500, code: 'READINESS_EVALUATION_FAILED' })
    );
  });

  it('publica el mismo id en la cabecera y en el cuerpo', () => {
    const captured: Captured = { status: 0, body: {}, headers: {} };
    respondWithFailure(mockResponse(captured), 503, new Error('IKES_PERSISTENCE_NOT_INITIALIZED'));
    expect(captured.body.error).toBe('IKES_PERSISTENCE_NOT_INITIALIZED');
    expect(captured.headers['X-Request-Id']).toBe(captured.body.correlationId);
  });

  it('no escribe sobre una respuesta ya enviada', () => {
    const captured: Captured = { status: 0, body: {}, headers: {} };
    const res = mockResponse(captured);
    (res as unknown as { headersSent: boolean }).headersSent = true;
    respondWithFailure(res, 400, new Error('X_IS_INVALID'));
    expect(captured.status).toBe(0);
    expect(captured.body).toEqual({});
  });
});

describe('correlationIdMiddleware', () => {
  it('reutiliza un id entrante bien formado', () => {
    const captured: Captured = { status: 0, body: {}, headers: {} };
    const res = mockResponse(captured);
    const next = vi.fn();
    correlationIdMiddleware(mockRequest({ 'x-request-id': 'incidente-42_ABC' }), res, next);
    expect(correlationIdOf(res)).toBe('incidente-42_ABC');
    expect(captured.headers['X-Request-Id']).toBe('incidente-42_ABC');
    expect(next).toHaveBeenCalledOnce();
  });

  it('rechaza ids reflejables de forma insegura y genera uno nuevo', () => {
    for (const incoming of [
      'short',
      'a'.repeat(65),
      'lleva espacio',
      'inseguro\r\nInjected-Header: si',
      ['doble', 'valor'],
    ]) {
      expect(resolveCorrelationId(incoming)).toMatch(/^[0-9a-f]{16}$/);
    }
  });
});
