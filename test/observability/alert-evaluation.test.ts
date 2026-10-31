import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  AlertManager,
  MetricsCollector,
  SLOManager,
  evaluateAlertExpr,
  parseAlertDuration,
  resolveExprValue,
  type Metric,
} from '../../src/observability/observability-stack';

/**
 * state: engine-generated — el evaluador de alertas y de SLO ya no inventa números.
 *
 * La puerta que se prueba es concreta: una alerta sólo dispara si la métrica real del collector
 * cruza el umbral de la regla, y un SLO sin datos suficientes devuelve `null` en vez de un 0.99
 * decorativo. Todo se ejecuta con marcas de tiempo fijas, así que ninguna aserción depende del
 * reloj ni de la suerte.
 */

const T0 = Date.parse('2026-10-29T00:00:00Z');

function metric(
  name: string,
  type: Metric['type'],
  value: number,
  labels: Record<string, string> = {},
  timestamp = T0
): Metric {
  return { name, type, value, labels, timestamp };
}

describe('evaluador determinista de expresiones', () => {
  it('suma los incrementos de un contador y toma la última lectura de un gauge', () => {
    const metrics = [
      metric('http_requests_total', 'counter', 1, { status: '200' }, T0),
      metric('http_requests_total', 'counter', 1, { status: '200' }, T0 + 1000),
      metric('http_requests_total', 'counter', 1, { status: '500' }, T0 + 2000),
      metric('process_heap_bytes', 'gauge', 400, {}, T0),
      metric('process_heap_bytes', 'gauge', 900, {}, T0 + 5000),
    ];
    expect(resolveExprValue('http_requests_total', metrics).value).toBe(3);
    expect(resolveExprValue('rate(http_requests_total[5m])', metrics).value).toBe(3);
    expect(resolveExprValue('process_heap_bytes', metrics).value).toBe(900);
  });

  it('filtra por etiqueta con igualdad y con regex anclado', () => {
    const metrics = [
      metric('http_requests_total', 'counter', 2, { status: '500' }),
      metric('http_requests_total', 'counter', 3, { status: '503' }),
      metric('http_requests_total', 'counter', 95, { status: '200' }),
    ];
    expect(resolveExprValue('http_requests_total{status=~"5.."}', metrics).value).toBe(5);
    expect(resolveExprValue('http_requests_total{status="200"}', metrics).value).toBe(95);
    expect(
      resolveExprValue(
        'rate(http_requests_total{status=~"5.."}[5m]) / rate(http_requests_total[5m])',
        metrics
      ).value
    ).toBeCloseTo(0.05, 12);
  });

  it('declara no evaluable lo que el runtime no puede medir y sin datos lo que no existe', () => {
    const metrics = [metric('process_heap_bytes', 'gauge', 10)];
    const unsupported = evaluateAlertExpr(
      'histogram_quantile(0.99, rate(http_request_duration_seconds_bucket[5m])) > 1',
      metrics
    );
    expect(unsupported.state).toBe('not_evaluable');
    expect(unsupported.reason).toMatch(/^FUNCION_NO_MEDIBLE/);

    const missing = evaluateAlertExpr('process_resident_memory_bytes > 1', metrics);
    expect(missing.state).toBe('no_data');
    expect(missing.reason).toBe('SIN_SERIES:process_resident_memory_bytes');
  });

  it('respeta la ventana `for` de la regla sobre el reloj inyectado', () => {
    expect(parseAlertDuration('2m')).toBe(120_000);
    expect(parseAlertDuration('30s')).toBe(30_000);
    expect(parseAlertDuration('1h')).toBe(3_600_000);
    expect(parseAlertDuration('')).toBe(0);
  });
});

describe('AlertManager con métricas reales', () => {
  const rule = {
    name: 'memory_pressure',
    expr: 'process_heap_bytes / process_max_memory_bytes > 0.9',
    for: '2m',
    labels: { severity: 'warning' },
    annotations: { summary: 'Heap por encima del 90%' },
  };

  function harness(heap: number, limit: number) {
    const alerts = new AlertManager();
    alerts.addRule(rule);
    const metrics = [
      metric('process_heap_bytes', 'gauge', heap),
      metric('process_max_memory_bytes', 'gauge', limit),
    ];
    return { alerts, metrics };
  }

  it('no dispara mientras la métrica real esté por debajo del umbral', () => {
    const { alerts, metrics } = harness(800, 1000);
    const fired = alerts.evaluate(metrics, T0);
    expect(fired).toEqual([]);
    expect(alerts.getActiveAlerts()).toEqual([]);
    expect(alerts.getRuleOutcomes()[0].outcome).toMatchObject({
      state: 'evaluated',
      firing: false,
      value: 0.8,
    });
  });

  it('dispara al cumplirse la ventana y reporta el valor observado', () => {
    const { alerts, metrics } = harness(950, 1000);
    expect(alerts.evaluate(metrics, T0)).toEqual([]);
    const fired = alerts.evaluate(metrics, T0 + 120_000);
    expect(fired).toHaveLength(1);
    expect(fired[0]).toMatchObject({ state: 'firing', observed: 0.95, threshold: 0.9 });
    expect(alerts.getActiveAlerts()).toHaveLength(1);

    const bajo = [
      metric('process_heap_bytes', 'gauge', 100),
      metric('process_max_memory_bytes', 'gauge', 1000),
    ];
    expect(alerts.evaluate(bajo, T0 + 200_000)).toEqual([]);
    expect(alerts.getActiveAlerts()).toEqual([]);
    expect(alerts.getRuleOutcomes()[0].outcome.state).toBe('evaluated');
  });

  it('es determinista: la misma entrada produce exactamente la misma salida', () => {
    const { alerts, metrics } = harness(950, 1000);
    const primera = alerts.evaluate(metrics, T0 + 300_000);
    const segunda = alerts.evaluate(metrics, T0 + 300_000);
    expect(JSON.stringify(segunda)).toBe(JSON.stringify(primera));
    const otraInstancia = new AlertManager();
    otraInstancia.addRule(rule);
    expect(JSON.stringify(otraInstancia.evaluate(metrics, T0 + 300_000))).toBe(
      JSON.stringify(primera)
    );
    expect(alerts.getRuleOutcomes()[0].outcome.value).toBe(
      otraInstancia.getRuleOutcomes()[0].outcome.value
    );
  });

  it('una regla con función no medible nunca produce una alerta inventada', () => {
    const alerts = new AlertManager();
    alerts.addRule({
      name: 'high_latency',
      expr: 'histogram_quantile(0.99, rate(http_request_duration_seconds_bucket[5m])) > 1',
      for: '5m',
      labels: { severity: 'warning' },
      annotations: {},
    });
    const now = T0 + 10 * 60_000;
    for (let i = 0; i < 25; i += 1) expect(alerts.evaluate([], now + i)).toEqual([]);
    expect(alerts.getActiveAlerts()).toEqual([]);
    expect(alerts.getRuleOutcomes()[0].outcome.state).toBe('not_evaluable');
  });
});

describe('SLOManager con datos del collector', () => {
  const definition = {
    name: 'availability',
    description: 'Proporción de peticiones sin error 5xx',
    sli: {
      type: 'availability' as const,
      query: 'rate(http_requests_total{status!~"5.."}[5m]) / rate(http_requests_total[5m])',
      goodQuery: 'rate(http_requests_total{status!~"5.."}[5m])',
      totalQuery: 'rate(http_requests_total[5m])',
    },
    target: 0.95,
    window: '30d',
  };

  it('declara INSUFFICIENT_DATA con value null cuando no hay tráfico medido', async () => {
    const collector = new MetricsCollector();
    const slos = new SLOManager(collector);
    slos.register(definition);
    const result = await slos.evaluate('availability');
    expect(result.state).toBe('INSUFFICIENT_DATA');
    expect(result.value).toBeNull();
    expect(result.met).toBe(false);
    expect(result.reason).toBe('SIN_SERIES:http_requests_total');
  });

  it('mide la fracción real de good/total sobre los contadores', async () => {
    const collector = new MetricsCollector();
    for (let i = 0; i < 97; i += 1) collector.counter('http_requests_total', 1, { status: '200' });
    for (let i = 0; i < 3; i += 1) collector.counter('http_requests_total', 1, { status: '500' });
    const slos = new SLOManager(collector);
    slos.register(definition);
    const result = await slos.evaluate('availability');
    expect(result.state).toBe('MEASURED');
    expect(result.value).toBeCloseTo(0.97, 12);
    expect(result.met).toBe(true);
    expect(result.good).toBe(97);
    expect(result.total).toBe(100);
  });

  it('no puede devolver el 0.99 simulado que el módulo publicaba antes', async () => {
    const fuente = readFileSync(
      new URL('../../src/observability/observability-stack.ts', import.meta.url),
      'utf-8'
    );
    expect(fuente).not.toMatch(/Simulated SLI value/);
    expect(fuente).not.toMatch(/const value = 0\.99;/);
    expect(fuente).not.toMatch(/Math\.random/);
  });
});
