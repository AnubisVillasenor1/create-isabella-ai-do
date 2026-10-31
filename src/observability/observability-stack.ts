/**
 * Observability Stack Ω
 * state: engine-generated
 * Part of ISABELLA-Q Ω Cognitive Architecture
 *
 * Implements comprehensive observability:
 * - OpenTelemetry Integration (traces, metrics, logs)
 * - Prometheus Metrics Collection & Exposition
 * - Grafana Dashboard Definitions
 * - Structured Logging (JSON, structured fields)
 * - Distributed Tracing (W3C TraceContext)
 * - Alerting Rules (PrometheusRule)
 * - SLO/SLI Definitions
 * - Health Checks & Readiness Probes
 */

import { EventEmitter } from 'node:events';
import { randomBytes, createHash } from 'node:crypto';
import { getHeapStatistics } from 'node:v8';

export type MetricType = 'counter' | 'gauge' | 'histogram' | 'summary';
export type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal';
export type SpanKind = 'internal' | 'server' | 'client' | 'producer' | 'consumer';
export type SpanStatusCode = 'unset' | 'ok' | 'error';

export interface Metric {
  readonly name: string;
  readonly type: MetricType;
  readonly value: number;
  readonly labels: Record<string, string>;
  readonly timestamp: number;
  readonly help?: string;
  readonly unit?: string;
}

export interface MetricDefinition {
  readonly name: string;
  readonly type: MetricType;
  readonly help: string;
  readonly unit?: string;
  readonly labelNames: string[];
  readonly buckets?: number[]; // for histogram
  readonly objectives?: Record<number, number>; // for summary
}

export interface LogEntry {
  readonly level: LogLevel;
  readonly message: string;
  readonly timestamp: number;
  readonly traceId?: string;
  readonly spanId?: string;
  readonly fields: Record<string, unknown>;
  readonly logger: string;
}

export interface Span {
  readonly traceId: string;
  readonly spanId: string;
  readonly parentSpanId?: string;
  readonly name: string;
  readonly kind: SpanKind;
  readonly startTime: number;
  readonly endTime?: number;
  status: SpanStatus;
  readonly attributes: Record<string, unknown>;
  readonly events: SpanEvent[];
  readonly links: SpanLink[];
}

export interface SpanStatus {
  readonly code: SpanStatusCode;
  readonly message?: string;
}

export interface SpanEvent {
  readonly name: string;
  readonly timestamp: number;
  readonly attributes: Record<string, unknown>;
}

export interface SpanLink {
  readonly traceId: string;
  readonly spanId: string;
  readonly attributes: Record<string, unknown>;
}

export interface TraceContext {
  readonly traceId: string;
  readonly spanId: string;
  readonly traceFlags: number;
  readonly traceState?: string;
}

export interface HealthCheck {
  readonly name: string;
  readonly status: 'healthy' | 'degraded' | 'unhealthy';
  readonly timestamp: number;
  readonly durationMs: number;
  readonly details?: Record<string, unknown>;
  readonly error?: string;
}

export interface SLODefinition {
  readonly name: string;
  readonly description: string;
  readonly sli: SLIDefinition;
  readonly target: number; // 0-1
  readonly window: string; // e.g., "30d"
  readonly alertThreshold?: number;
}

export interface SLIDefinition {
  readonly type: 'availability' | 'latency' | 'quality' | 'freshness' | 'correctness';
  readonly query: string; // PromQL query
  readonly goodQuery: string; // query for good events
  readonly totalQuery: string; // query for total events
}

export interface AlertRule {
  readonly name: string;
  readonly expr: string; // PromQL expression
  readonly for: string; // duration
  readonly labels: Record<string, string>;
  readonly annotations: Record<string, string>;
}

export interface DashboardPanel {
  readonly id: number;
  readonly title: string;
  readonly type: 'graph' | 'stat' | 'table' | 'heatmap' | 'logs' | 'trace';
  readonly gridPos: { x: number; y: number; w: number; h: number };
  readonly targets: DashboardTarget[];
  readonly options?: Record<string, unknown>;
}

export interface DashboardTarget {
  readonly expr: string;
  readonly legendFormat?: string;
  readonly refId: string;
}

export interface GrafanaDashboard {
  readonly uid: string;
  readonly title: string;
  readonly tags: string[];
  readonly timezone: string;
  readonly panels: DashboardPanel[];
  readonly templating?: { list: unknown[] };
  readonly time: { from: string; to: string };
  readonly refresh: string;
}

/**
 * Metrics Collector (Prometheus-compatible)
 */
export class MetricsCollector extends EventEmitter {
  private metrics: Map<string, MetricDefinition> = new Map();
  private values: Map<string, Metric[]> = new Map();
  private defaultLabels: Record<string, string> = {};

  constructor(defaultLabels: Record<string, string> = {}) {
    super();
    this.defaultLabels = defaultLabels;
  }

  register(definition: MetricDefinition): void {
    this.metrics.set(definition.name, definition);
    this.values.set(definition.name, []);
    this.emit('metric:registered', definition);
  }

  counter(name: string, value: number = 1, labels: Record<string, string> = {}): void {
    this.record({ name, type: 'counter', value, labels, timestamp: Date.now() });
  }

  gauge(name: string, value: number, labels: Record<string, string> = {}): void {
    this.record({ name, type: 'gauge', value, labels, timestamp: Date.now() });
  }

  histogram(name: string, value: number, labels: Record<string, string> = {}): void {
    this.record({ name, type: 'histogram', value, labels, timestamp: Date.now() });
  }

  summary(name: string, value: number, labels: Record<string, string> = {}): void {
    this.record({ name, type: 'summary', value, labels, timestamp: Date.now() });
  }

  private record(metric: Metric): void {
    const mergedLabels = { ...this.defaultLabels, ...metric.labels };
    const fullMetric = { ...metric, labels: mergedLabels };

    const values = this.values.get(metric.name) || [];
    values.push(fullMetric);

    // Keep last 10000 values per metric
    if (values.length > 10000) {
      values.shift();
    }

    this.values.set(metric.name, values);
    this.emit('metric:recorded', fullMetric);
  }

  setDefaultLabels(labels: Record<string, string>): void {
    this.defaultLabels = { ...this.defaultLabels, ...labels };
  }

  getMetrics(): Metric[] {
    const result: Metric[] = [];
    for (const values of this.values.values()) {
      result.push(...values);
    }
    return result;
  }

  getLatest(name: string): Metric | undefined {
    const values = this.values.get(name);
    return values?.[values.length - 1];
  }

  exportPrometheus(): string {
    const lines: string[] = [];

    for (const [name, definition] of this.metrics) {
      lines.push(`# HELP ${name} ${definition.help}`);
      lines.push(`# TYPE ${name} ${definition.type}`);

      const values = this.values.get(name) || [];
      const latest = new Map<string, Metric>();

      // Get latest value per label combination
      for (const metric of values) {
        const labelKey = Object.entries(metric.labels)
          .sort()
          .map(([k, v]) => `${k}="${v}"`)
          .join(',');
        latest.set(labelKey, metric);
      }

      for (const metric of latest.values()) {
        const labelStr = Object.entries(metric.labels)
          .map(([k, v]) => `${k}="${v}"`)
          .join(',');
        const labelPart = labelStr ? `{${labelStr}}` : '';
        lines.push(`${name}${labelPart} ${metric.value} ${metric.timestamp}`);
      }
    }

    return lines.join('\n') + '\n';
  }

  reset(): void {
    for (const name of this.values.keys()) {
      this.values.set(name, []);
    }
  }
}

/**
 * Structured Logger
 */
export class StructuredLogger extends EventEmitter {
  private level: LogLevel = 'info';
  private defaultFields: Record<string, unknown> = {};
  private transports: LogTransport[] = [];

  constructor(options: { level?: LogLevel; defaultFields?: Record<string, unknown> } = {}) {
    super();
    this.level = options.level || 'info';
    this.defaultFields = options.defaultFields || {};
  }

  setLevel(level: LogLevel): void {
    this.level = level;
  }

  addTransport(transport: LogTransport): void {
    this.transports.push(transport);
  }

  private shouldLog(level: LogLevel): boolean {
    const levels: LogLevel[] = ['trace', 'debug', 'info', 'warn', 'error', 'fatal'];
    return levels.indexOf(level) >= levels.indexOf(this.level);
  }

  private log(level: LogLevel, message: string, fields: Record<string, unknown> = {}): void {
    if (!this.shouldLog(level)) return;

    // Add trace context if available
    const traceContext = getCurrentTraceContext();

    const entry: LogEntry = {
      level,
      message,
      timestamp: Date.now(),
      traceId: traceContext?.traceId,
      spanId: traceContext?.spanId,
      fields: { ...this.defaultFields, ...fields },
      logger: 'isabella',
    };

    this.emit('log', entry);

    for (const transport of this.transports) {
      transport.write(entry);
    }
  }

  trace(message: string, fields?: Record<string, unknown>): void {
    this.log('trace', message, fields);
  }

  debug(message: string, fields?: Record<string, unknown>): void {
    this.log('debug', message, fields);
  }

  info(message: string, fields?: Record<string, unknown>): void {
    this.log('info', message, fields);
  }

  warn(message: string, fields?: Record<string, unknown>): void {
    this.log('warn', message, fields);
  }

  error(message: string, fields?: Record<string, unknown>): void {
    this.log('error', message, fields);
  }

  fatal(message: string, fields?: Record<string, unknown>): void {
    this.log('fatal', message, fields);
  }

  child(fields: Record<string, unknown>): StructuredLogger {
    const child = new StructuredLogger({ level: this.level });
    child.defaultFields = { ...this.defaultFields, ...fields };
    child.transports = [...this.transports];
    return child;
  }
}

interface LogTransport {
  write(entry: LogEntry): void;
}

class ConsoleTransport implements LogTransport {
  write(entry: LogEntry): void {
    const levelColor = {
      trace: '\x1b[90m',
      debug: '\x1b[36m',
      info: '\x1b[32m',
      warn: '\x1b[33m',
      error: '\x1b[31m',
      fatal: '\x1b[35m',
    }[entry.level];

    const reset = '\x1b[0m';
    const timestamp = new Date(entry.timestamp).toISOString();
    const fieldsStr =
      Object.keys(entry.fields).length > 0 ? ` ${JSON.stringify(entry.fields)}` : '';

    console.log(
      `${levelColor}[${entry.level.toUpperCase()}]${reset} ${timestamp} ${entry.message}${fieldsStr}`
    );
  }
}

/**
 * Distributed Tracer
 */
export class Tracer extends EventEmitter {
  private spans: Map<string, Span> = new Map();
  private traceIdGenerator: () => string = () => randomBytes(16).toString('hex');
  private spanIdGenerator: () => string = () => randomBytes(8).toString('hex');
  private sampler: Sampler = new AlwaysOnSampler();

  setSampler(sampler: Sampler): void {
    this.sampler = sampler;
  }

  startSpan(
    name: string,
    options: {
      kind?: SpanKind;
      parent?: TraceContext;
      attributes?: Record<string, unknown>;
      links?: SpanLink[];
    } = {}
  ): SpanContext {
    const traceId = options.parent?.traceId || this.traceIdGenerator();
    const spanId = this.spanIdGenerator();
    const parentSpanId = options.parent?.spanId;

    const samplingDecision = this.sampler.shouldSample({
      traceId,
      name,
      kind: options.kind || 'internal',
      attributes: options.attributes || {},
    });

    const span: Span = {
      traceId,
      spanId,
      parentSpanId,
      name,
      kind: options.kind || 'internal',
      startTime: Date.now(),
      status: { code: 'unset' },
      attributes: options.attributes || {},
      events: [],
      links: options.links || [],
    };

    this.spans.set(spanId, span);

    const context: SpanContext = {
      span,
      traceContext: { traceId, spanId, traceFlags: samplingDecision.sampled ? 1 : 0 },
      setAttribute: (key: string, value: unknown) => {
        span.attributes[key] = value;
      },
      addEvent: (name: string, attributes?: Record<string, unknown>) => {
        span.events.push({ name, timestamp: Date.now(), attributes: attributes || {} });
      },
      setStatus: (code: SpanStatusCode, message?: string) => {
        span.status = { code, message };
      },
      end: () => this.endSpan(spanId),
    };

    this.emit('span:started', span);
    return context;
  }

  private endSpan(spanId: string): void {
    const span = this.spans.get(spanId);
    if (!span) return;

    const endedSpan: Span = {
      ...span,
      endTime: Date.now(),
    };

    this.spans.set(spanId, endedSpan);
    this.emit('span:ended', endedSpan);
  }

  getSpan(spanId: string): Span | undefined {
    return this.spans.get(spanId);
  }

  getTrace(traceId: string): Span[] {
    return Array.from(this.spans.values())
      .filter((s) => s.traceId === traceId)
      .sort((a, b) => a.startTime - b.startTime);
  }

  exportJaeger(): string {
    // Simplified Jaeger JSON export
    const traces = Array.from(this.spans.values())
      .filter((s) => s.endTime)
      .reduce(
        (acc, span) => {
          if (!acc[span.traceId]) acc[span.traceId] = [];
          acc[span.traceId].push(span);
          return acc;
        },
        {} as Record<string, Span[]>
      );

    return JSON.stringify({ data: Object.values(traces) });
  }
}

interface SpanContext {
  readonly span: Span;
  readonly traceContext: TraceContext;
  readonly setAttribute: (key: string, value: unknown) => void;
  readonly addEvent: (name: string, attributes?: Record<string, unknown>) => void;
  readonly setStatus: (code: SpanStatusCode, message?: string) => void;
  readonly end: () => void;
}

interface SamplingDecision {
  readonly sampled: boolean;
  readonly attributes?: Record<string, unknown>;
}

interface Sampler {
  shouldSample(params: {
    traceId: string;
    name: string;
    kind: SpanKind;
    attributes: Record<string, unknown>;
  }): SamplingDecision;
}

class AlwaysOnSampler implements Sampler {
  shouldSample(): SamplingDecision {
    return { sampled: true };
  }
}

class ProbabilisticSampler implements Sampler {
  constructor(private rate: number) {}

  shouldSample({ traceId }: { traceId: string }): SamplingDecision {
    const hash = parseInt(createHash('md5').update(traceId).digest('hex').slice(0, 8), 16);
    return { sampled: hash / 0xffffffff < this.rate };
  }
}

/**
 * Health Check Manager
 */
export class HealthCheckManager extends EventEmitter {
  private checks: Map<string, HealthCheckFunction> = new Map();
  private results: Map<string, HealthCheck> = new Map();

  register(name: string, fn: HealthCheckFunction): void {
    this.checks.set(name, fn);
    this.emit('check:registered', name);
  }

  async runAll(): Promise<HealthCheck[]> {
    const results = await Promise.all(
      Array.from(this.checks.entries()).map(async ([name, fn]) => {
        const start = Date.now();
        try {
          const result = await fn();
          const check: HealthCheck = {
            name,
            status: result.healthy ? 'healthy' : 'degraded',
            timestamp: Date.now(),
            durationMs: Date.now() - start,
            details: result.details,
          };
          this.results.set(name, check);
          return check;
        } catch (error) {
          const check: HealthCheck = {
            name,
            status: 'unhealthy',
            timestamp: Date.now(),
            durationMs: Date.now() - start,
            error: String(error),
          };
          this.results.set(name, check);
          return check;
        }
      })
    );

    this.emit('checks:completed', results);
    return results;
  }

  async run(name: string): Promise<HealthCheck> {
    const fn = this.checks.get(name);
    if (!fn) throw new Error(`HEALTH_CHECK_NOT_FOUND: ${name}`);

    const start = Date.now();
    try {
      const result = await fn();
      const check: HealthCheck = {
        name,
        status: result.healthy ? 'healthy' : 'degraded',
        timestamp: Date.now(),
        durationMs: Date.now() - start,
        details: result.details,
      };
      this.results.set(name, check);
      return check;
    } catch (error) {
      const check: HealthCheck = {
        name,
        status: 'unhealthy',
        timestamp: Date.now(),
        durationMs: Date.now() - start,
        error: String(error),
      };
      this.results.set(name, check);
      return check;
    }
  }

  getResult(name: string): HealthCheck | undefined {
    return this.results.get(name);
  }

  getOverallStatus(): 'healthy' | 'degraded' | 'unhealthy' {
    const statuses = Array.from(this.results.values()).map((r) => r.status);
    if (statuses.includes('unhealthy')) return 'unhealthy';
    if (statuses.includes('degraded')) return 'degraded';
    return 'healthy';
  }
}

interface HealthCheckFunction {
  (): Promise<{ healthy: boolean; details?: Record<string, unknown> }>;
}

/**
 * state: engine-generated — resolvedor determinista de las expresiones que el runtime puede medir.
 *
 * Subconjunto soportado: `<término> [ '/' <término> ] <op> <número>`, donde un término es
 * `metric` o `metric{etiqueta=~"regex"}` y `rate(...)`, `increase(...)`, `sum(...)` se resuelven
 * como la suma acumulada de la serie. El collector no guarda ventanas de tiempo, así que la
 * resolución de `rate(x[w])` es `x` desde el arranque del proceso; los operadores restantes
 * devuelven `not_evaluable` y se reportan como tales en lugar de inventarse un número.
 */

const WINDOW_FUNCTIONS = new Set([
  'rate',
  'irate',
  'increase',
  'delta',
  'sum',
  'avg',
  'min',
  'max',
  'count',
  'last_over_time',
  'sum_over_time',
  'avg_over_time',
]);

const COMPARISON =
  /^(?<lhs>.+?)\s*(?<op>>=|<=|==|!=|>|<)\s*(?<rhs>[-+]?\d+(?:\.\d+)?(?:[eE][-+]?\d+)?)\s*$/;

function labelSeriesKey(metric: Metric): string {
  const labels = Object.keys(metric.labels)
    .sort()
    .map((k) => `${k}=${metric.labels[k]}`)
    .join(',');
  return `${metric.name}\u0000${labels}`;
}

function latestSeries(metrics: readonly Metric[]): Map<string, Metric> {
  const latest = new Map<string, Metric>();
  for (const metric of metrics) latest.set(labelSeriesKey(metric), metric);
  return latest;
}

function splitSelectorClauses(raw: string): string[] {
  const clauses: string[] = [];
  let current = '';
  let quote = '';
  for (const char of raw) {
    if (quote) {
      current += char;
      if (char === quote) quote = '';
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      current += char;
      continue;
    }
    if (char === ',') {
      clauses.push(current);
      current = '';
      continue;
    }
    current += char;
  }
  clauses.push(current);
  return clauses.filter((clause) => clause.trim() !== '');
}

function splitOnSlash(text: string): string[] | null {
  const parts: string[] = [];
  let current = '';
  let depth = 0;
  let quote = '';
  for (const char of text) {
    if (quote) {
      current += char;
      if (char === quote) quote = '';
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      current += char;
      continue;
    }
    if (char === '(' || char === '{' || char === '[') depth += 1;
    if (char === ')' || char === '}' || char === ']') depth -= 1;
    if (char === '/' && depth === 0) {
      parts.push(current);
      current = '';
      continue;
    }
    current += char;
  }
  parts.push(current);
  if (depth !== 0) return null;
  return parts;
}

interface TermResolution {
  readonly value: number | null;
  readonly reason?: string;
}

function resolveTerm(term: string, metrics: readonly Metric[]): TermResolution {
  let text = term.trim().replace(/\s*\[[^\]]*\]\s*$/, '');
  const call = text.match(/^([A-Za-z_:][\w:]*?)\s*\(([\s\S]*)\)$/);
  if (call) {
    const fn = call[1];
    if (!WINDOW_FUNCTIONS.has(fn)) return { value: null, reason: `FUNCION_NO_MEDIBLE:${fn}` };
    return resolveTerm(call[2], metrics);
  }
  const selector = text.match(/^(?<name>[A-Za-z_:][\w:]*)(?:\{(?<labels>[^{}]*)\})?$/);
  const name = selector?.groups?.name;
  if (!name) return { value: null, reason: `TERMINO_NO_RESOLUBLE:${text}` };

  const matchers: Array<{ label: string; op: string; value: string }> = [];
  const rawLabels = selector?.groups?.labels ?? '';
  for (const clause of splitSelectorClauses(rawLabels)) {
    const parsed = clause.match(
      /^\s*(?<label>[A-Za-z_:][\w:]*)\s*(?<op>=~|!~|=|!=)\s*(?<value>.*?)\s*$/
    );
    if (!parsed?.groups) return { value: null, reason: `SELECTOR_INVALIDO:${clause}` };
    matchers.push({
      label: parsed.groups.label,
      op: parsed.groups.op,
      value: parsed.groups.value.replace(/^["']|["']$/g, ''),
    });
  }

  const matching: Metric[] = [];
  for (const metric of metrics) {
    if (metric.name !== name) continue;
    let ok = true;
    for (const matcher of matchers) {
      const actual = metric.labels[matcher.label] ?? '';
      if (matcher.op === '=' || matcher.op === '!=') {
        const equal = actual === matcher.value;
        ok = matcher.op === '=' ? equal : !equal;
      } else {
        let pattern: RegExp;
        try {
          pattern = new RegExp(`^(?:${matcher.value})$`);
        } catch {
          return { value: null, reason: `REGEX_INVALIDO:${matcher.value}` };
        }
        const matches = pattern.test(actual);
        ok = matcher.op === '=~' ? matches : !matches;
      }
      if (!ok) break;
    }
    if (ok) matching.push(metric);
  }
  if (matching.length === 0) return { value: null, reason: `SIN_SERIES:${name}` };

  // Un counter registra incrementos: su valor acumulado es la suma de todas las muestras.
  // Un gauge registra lecturas del estado actual: sólo cuenta la última por combinación de etiquetas.
  const isCounter = matching.some((metric) => metric.type === 'counter');
  const samples = isCounter ? matching : Array.from(latestSeries(matching).values());
  let total = 0;
  for (const metric of samples) total += metric.value;
  return { value: total };
}

export interface ExprResolution {
  readonly value: number | null;
  readonly reason: string;
}

/** Resuelve una expresión de un solo término o de cociente entre dos términos. */
export function resolveExprValue(expr: string, metrics: readonly Metric[]): ExprResolution {
  const parts = splitOnSlash(expr);
  if (!parts) return { value: null, reason: 'EXPRESION_DESEQUILIBRADA' };
  const first = resolveTerm(parts[0], metrics);
  if (first.value === null) return { value: null, reason: first.reason ?? 'SIN_SERIES' };
  let value = first.value;
  for (const part of parts.slice(1)) {
    const resolved = resolveTerm(part, metrics);
    if (resolved.value === null) return { value: null, reason: resolved.reason ?? 'SIN_SERIES' };
    if (resolved.value === 0) return { value: null, reason: 'DIVISOR_ZERO' };
    value = value / resolved.value;
  }
  return { value, reason: 'MEDIDO' };
}

export interface AlertOutcome {
  readonly state: 'evaluated' | 'not_evaluable' | 'no_data';
  readonly value?: number;
  readonly threshold?: number;
  readonly operator?: string;
  readonly firing?: boolean;
  readonly reason: string;
}

const SYNTAX_REASONS = new Set([
  'EXPRESION_DESEQUILIBRADA',
  'SELECTOR_INVALIDO',
  'REGEX_INVALIDO',
  'TERMINO_NO_RESOLUBLE',
]);

function isNotEvaluable(reason: string): boolean {
  return SYNTAX_REASONS.has(reason) || reason.startsWith('FUNCION_NO_MEDIBLE');
}

/** Compara la métrica real contra el umbral de la regla. Nunca devuelve un disparo simulado. */
export function evaluateAlertExpr(expr: string, metrics: readonly Metric[]): AlertOutcome {
  const comparison = expr.match(COMPARISON);
  if (!comparison?.groups) return { state: 'not_evaluable', reason: 'SIN_COMPARACION_CON_UMBRAL' };
  const resolved = resolveExprValue(comparison.groups.lhs, metrics);
  if (resolved.value === null)
    return {
      state: isNotEvaluable(resolved.reason) ? 'not_evaluable' : 'no_data',
      reason: resolved.reason,
    };
  const threshold = Number(comparison.groups.rhs);
  const value = resolved.value;
  let firing: boolean;
  switch (comparison.groups.op) {
    case '>':
      firing = value > threshold;
      break;
    case '>=':
      firing = value >= threshold;
      break;
    case '<':
      firing = value < threshold;
      break;
    case '<=':
      firing = value <= threshold;
      break;
    case '==':
      firing = value === threshold;
      break;
    default:
      firing = value !== threshold;
  }
  return {
    state: 'evaluated',
    value,
    threshold,
    operator: comparison.groups.op,
    firing,
    reason: 'MEDIDO',
  };
}

const DURATION = /^(?<amount>\d+(?:\.\d+)?)\s*(?<unit>[smhd])$/;

export function parseAlertDuration(forField: string): number {
  const match = forField.trim().match(DURATION);
  if (!match?.groups) return 0;
  const perUnit: Record<string, number> = { s: 1e3, m: 6e4, h: 36e5, d: 864e5 };
  return Number(match.groups.amount) * perUnit[match.groups.unit];
}

/**
 * SLO Manager
 */
export interface SloEvaluation {
  readonly slo: SLODefinition;
  readonly value: number | null;
  readonly met: boolean;
  readonly state: 'MEASURED' | 'INSUFFICIENT_DATA';
  readonly reason: string;
  readonly good?: number;
  readonly total?: number;
}
export class SLOManager extends EventEmitter {
  private slos: Map<string, SLODefinition> = new Map();
  private metricsCollector: MetricsCollector;

  constructor(metricsCollector: MetricsCollector) {
    super();
    this.metricsCollector = metricsCollector;
  }

  register(slo: SLODefinition): void {
    this.slos.set(slo.name, slo);
    this.emit('slo:registered', slo);
  }

  async evaluate(sloName: string): Promise<SloEvaluation> {
    const slo = this.slos.get(sloName);
    if (!slo) throw new Error(`SLO_NOT_FOUND: ${sloName}`);

    const metrics = this.metricsCollector.getMetrics();
    const good = resolveExprValue(slo.sli.goodQuery, metrics);
    const total = resolveExprValue(slo.sli.totalQuery, metrics);
    if (good.value === null)
      return { slo, value: null, met: false, state: 'INSUFFICIENT_DATA', reason: good.reason };
    if (total.value === null)
      return { slo, value: null, met: false, state: 'INSUFFICIENT_DATA', reason: total.reason };

    const value = Math.min(1, Math.max(0, good.value / total.value));
    const met = value >= slo.target;
    const evaluation: SloEvaluation = {
      slo,
      value,
      met,
      state: 'MEASURED',
      reason: 'MEDIDO',
      good: good.value,
      total: total.value,
    };
    this.emit('slo:evaluated', { slo, value, met });
    return evaluation;
  }

  async evaluateAll(): Promise<SloEvaluation[]> {
    return Promise.all(Array.from(this.slos.keys()).map((name) => this.evaluate(name)));
  }

  getSLO(name: string): SLODefinition | undefined {
    return this.slos.get(name);
  }
}

/**
 * Alert Manager
 */
export class AlertManager extends EventEmitter {
  private rules: Map<string, AlertRule> = new Map();
  private activeAlerts: Map<string, ActiveAlert> = new Map();
  private pendingSince: Map<string, number> = new Map();
  private outcomes: Map<string, AlertOutcome> = new Map();

  addRule(rule: AlertRule): void {
    this.rules.set(rule.name, rule);
    this.emit('rule:added', rule);
  }

  removeRule(name: string): void {
    this.rules.delete(name);
    this.pendingSince.delete(name);
    this.outcomes.delete(name);
    this.emit('rule:removed', name);
  }

  /**
   * Estado real de cada regla en la última pasada: MEDIDO, sin serie o no evaluable.
   * Se expone para que un operador vea qué reglas todavía no miden nada.
   */
  getRuleOutcomes(): Array<{ rule: AlertRule; outcome: AlertOutcome }> {
    return Array.from(this.rules.values()).map((rule) => ({
      rule,
      outcome: this.outcomes.get(rule.name) ?? { state: 'not_evaluable', reason: 'NUNCA_EVALUADA' },
    }));
  }

  evaluate(metrics: Metric[], now: number = Date.now()): ActiveAlert[] {
    const newAlerts: ActiveAlert[] = [];

    for (const rule of this.rules.values()) {
      const outcome = evaluateAlertExpr(rule.expr, metrics);
      this.outcomes.set(rule.name, outcome);
      const breached = outcome.state === 'evaluated' && outcome.firing === true;

      if (breached) {
        const required = parseAlertDuration(rule.for);
        const since = this.pendingSince.get(rule.name) ?? now;
        this.pendingSince.set(rule.name, since);
        // La regla sólo dispara después de su ventana `for`, medida sobre muestras reales.
        if (now - since < required) continue;
        const existing = this.activeAlerts.get(rule.name);
        if (existing && existing.state === 'firing') continue;
        const alert: ActiveAlert = {
          rule,
          state: 'firing',
          startsAt: since,
          labels: rule.labels,
          annotations: rule.annotations,
          observed: outcome.value,
          threshold: outcome.threshold,
          operator: outcome.operator,
        };
        this.activeAlerts.set(rule.name, alert);
        newAlerts.push(alert);
        this.emit('alert:firing', alert);
      } else {
        this.pendingSince.delete(rule.name);
        const existing = this.activeAlerts.get(rule.name);
        if (existing && existing.state === 'firing') {
          existing.state = 'resolved';
          existing.endsAt = now;
          this.emit('alert:resolved', existing);
        }
      }
    }

    return newAlerts;
  }

  getActiveAlerts(): ActiveAlert[] {
    return Array.from(this.activeAlerts.values()).filter((a) => a.state === 'firing');
  }
}

interface ActiveAlert {
  rule: AlertRule;
  state: 'firing' | 'resolved';
  startsAt: number;
  endsAt?: number;
  labels: Record<string, string>;
  annotations: Record<string, string>;
  observed?: number;
  threshold?: number;
  operator?: string;
}

/**
 * Grafana Dashboard Generator
 */
export class DashboardGenerator {
  static generateSystemDashboard(): GrafanaDashboard {
    return {
      uid: 'isabella-system',
      title: 'ISABELLA-Q Ω System Overview',
      tags: ['isabella', 'system', 'overview'],
      timezone: 'UTC',
      panels: [
        {
          id: 1,
          title: 'Request Rate',
          type: 'graph',
          gridPos: { x: 0, y: 0, w: 12, h: 8 },
          targets: [
            {
              expr: 'rate(http_requests_total[5m])',
              legendFormat: '{{method}} {{route}}',
              refId: 'A',
            },
          ],
        },
        {
          id: 2,
          title: 'Error Rate',
          type: 'graph',
          gridPos: { x: 12, y: 0, w: 12, h: 8 },
          targets: [
            {
              expr: 'rate(http_requests_total{status=~"5.."}[5m])',
              legendFormat: '{{route}}',
              refId: 'A',
            },
          ],
        },
        {
          id: 3,
          title: 'Latency (p50, p95, p99)',
          type: 'graph',
          gridPos: { x: 0, y: 8, w: 12, h: 8 },
          targets: [
            {
              expr: 'histogram_quantile(0.50, rate(http_request_duration_seconds_bucket[5m]))',
              legendFormat: 'p50',
              refId: 'A',
            },
            {
              expr: 'histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))',
              legendFormat: 'p95',
              refId: 'B',
            },
            {
              expr: 'histogram_quantile(0.99, rate(http_request_duration_seconds_bucket[5m]))',
              legendFormat: 'p99',
              refId: 'C',
            },
          ],
        },
        {
          id: 4,
          title: 'Active Sessions',
          type: 'stat',
          gridPos: { x: 12, y: 8, w: 6, h: 4 },
          targets: [{ expr: 'active_sessions', legendFormat: '', refId: 'A' }],
        },
        {
          id: 5,
          title: 'Memory Usage',
          type: 'graph',
          gridPos: { x: 18, y: 8, w: 6, h: 4 },
          targets: [
            { expr: 'process_resident_memory_bytes', legendFormat: 'RSS', refId: 'A' },
            { expr: 'process_heap_bytes', legendFormat: 'Heap', refId: 'B' },
          ],
        },
        {
          id: 6,
          title: 'CPU Usage',
          type: 'graph',
          gridPos: { x: 0, y: 16, w: 12, h: 8 },
          targets: [
            { expr: 'rate(process_cpu_seconds_total[5m])', legendFormat: 'CPU', refId: 'A' },
          ],
        },
        {
          id: 7,
          title: 'MoE Router Distribution',
          type: 'graph',
          gridPos: { x: 12, y: 16, w: 12, h: 8 },
          targets: [
            { expr: 'moe_router_expert_selection_total', legendFormat: '{{expert}}', refId: 'A' },
          ],
        },
        {
          id: 8,
          title: 'Memory Mesh Backend Latency',
          type: 'graph',
          gridPos: { x: 0, y: 24, w: 12, h: 8 },
          targets: [
            { expr: 'memory_mesh_query_duration_seconds', legendFormat: '{{backend}}', refId: 'A' },
          ],
        },
        {
          id: 9,
          title: 'Zero-Trust Auth Decisions',
          type: 'graph',
          gridPos: { x: 12, y: 24, w: 12, h: 8 },
          targets: [
            { expr: 'zero_trust_auth_decisions_total', legendFormat: '{{decision}}', refId: 'A' },
          ],
        },
        {
          id: 10,
          title: 'Governance Decisions',
          type: 'graph',
          gridPos: { x: 0, y: 32, w: 12, h: 8 },
          targets: [{ expr: 'governance_decisions_total', legendFormat: '{{status}}', refId: 'A' }],
        },
        {
          id: 11,
          title: 'Federated Learning Rounds',
          type: 'graph',
          gridPos: { x: 12, y: 32, w: 12, h: 8 },
          targets: [
            { expr: 'federated_learning_rounds_total', legendFormat: '', refId: 'A' },
            {
              expr: 'federated_learning_client_participation',
              legendFormat: 'participation',
              refId: 'B',
            },
          ],
        },
      ],
      time: { from: 'now-1h', to: 'now' },
      refresh: '30s',
    };
  }

  static generateSecurityDashboard(): GrafanaDashboard {
    return {
      uid: 'isabella-security',
      title: 'ISABELLA-Q Ω Security',
      tags: ['isabella', 'security', 'zero-trust'],
      timezone: 'UTC',
      panels: [
        {
          id: 1,
          title: 'Authentication Success Rate',
          type: 'stat',
          gridPos: { x: 0, y: 0, w: 6, h: 4 },
          targets: [
            {
              expr: 'rate(zero_trust_auth_success_total[5m]) / rate(zero_trust_auth_total[5m])',
              refId: 'A',
            },
          ],
        },
        {
          id: 2,
          title: 'Device Trust Scores',
          type: 'heatmap',
          gridPos: { x: 6, y: 0, w: 12, h: 8 },
          targets: [{ expr: 'zero_trust_device_trust_score', refId: 'A' }],
        },
        {
          id: 3,
          title: 'Behavioral Anomalies',
          type: 'graph',
          gridPos: { x: 18, y: 0, w: 6, h: 4 },
          targets: [
            { expr: 'rate(behavioral_anomalies_total[5m])', legendFormat: '{{type}}', refId: 'A' },
          ],
        },
        {
          id: 4,
          title: 'Policy Violations',
          type: 'table',
          gridPos: { x: 0, y: 4, w: 24, h: 12 },
          targets: [{ expr: 'governance_policy_violations_total', refId: 'A' }],
        },
        {
          id: 5,
          title: 'Threat Intelligence Matches',
          type: 'stat',
          gridPos: { x: 0, y: 16, w: 6, h: 4 },
          targets: [{ expr: 'threat_intel_matches_total', refId: 'A' }],
        },
        {
          id: 6,
          title: 'Risk Score Distribution',
          type: 'heatmap',
          gridPos: { x: 6, y: 16, w: 12, h: 8 },
          targets: [{ expr: 'zero_trust_risk_score', refId: 'A' }],
        },
      ],
      time: { from: 'now-1h', to: 'now' },
      refresh: '30s',
    };
  }

  static generateLearningDashboard(): GrafanaDashboard {
    return {
      uid: 'isabella-learning',
      title: 'ISABELLA-Q Ω Learning & Training',
      tags: ['isabella', 'learning', 'training'],
      timezone: 'UTC',
      panels: [
        {
          id: 1,
          title: 'Training Loss',
          type: 'graph',
          gridPos: { x: 0, y: 0, w: 12, h: 8 },
          targets: [{ expr: 'training_loss', legendFormat: '{{job}}', refId: 'A' }],
        },
        {
          id: 2,
          title: 'Active Learning Query Efficiency',
          type: 'graph',
          gridPos: { x: 12, y: 0, w: 12, h: 8 },
          targets: [{ expr: 'active_learning_label_efficiency', refId: 'A' }],
        },
        {
          id: 3,
          title: 'DPO Reward Margin',
          type: 'graph',
          gridPos: { x: 0, y: 8, w: 12, h: 8 },
          targets: [{ expr: 'dpo_reward_margin', refId: 'A' }],
        },
        {
          id: 4,
          title: 'RLAIF Mean Reward',
          type: 'graph',
          gridPos: { x: 12, y: 8, w: 12, h: 8 },
          targets: [{ expr: 'rlaif_mean_reward', refId: 'A' }],
        },
        {
          id: 5,
          title: 'Federated Learning Convergence',
          type: 'graph',
          gridPos: { x: 0, y: 16, w: 12, h: 8 },
          targets: [{ expr: 'federated_learning_global_loss', refId: 'A' }],
        },
        {
          id: 6,
          title: 'Model Versions Deployed',
          type: 'stat',
          gridPos: { x: 12, y: 16, w: 6, h: 4 },
          targets: [{ expr: 'model_versions_deployed', refId: 'A' }],
        },
      ],
      time: { from: 'now-6h', to: 'now' },
      refresh: '1m',
    };
  }
}

/**
 * Observability Stack - Main Orchestrator
 */
export class ObservabilityStack extends EventEmitter {
  readonly metrics: MetricsCollector;
  readonly logger: StructuredLogger;
  readonly tracer: Tracer;
  readonly healthChecks: HealthCheckManager;
  readonly slos: SLOManager;
  readonly alerts: AlertManager;

  constructor(serviceName: string = 'isabella-q-omega') {
    super();

    this.metrics = new MetricsCollector({ service: serviceName });
    this.logger = new StructuredLogger({
      level: 'info',
      defaultFields: { service: serviceName },
    });
    this.logger.addTransport(new ConsoleTransport());

    this.tracer = new Tracer();
    this.healthChecks = new HealthCheckManager();
    this.slos = new SLOManager(this.metrics);
    this.alerts = new AlertManager();

    this.setupDefaultMetrics();
    this.setupDefaultHealthChecks();
    this.setupDefaultSLOs();
    this.setupDefaultAlerts();
    this.startCollectionLoop();
  }

  private setupDefaultMetrics(): void {
    // HTTP metrics
    this.metrics.register({
      name: 'http_requests_total',
      type: 'counter',
      help: 'Total HTTP requests',
      labelNames: ['method', 'route', 'status'],
    });

    this.metrics.register({
      name: 'http_request_duration_seconds',
      type: 'histogram',
      help: 'HTTP request duration in seconds',
      labelNames: ['method', 'route'],
      buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
    });

    // System metrics
    this.metrics.register({
      name: 'active_sessions',
      type: 'gauge',
      help: 'Number of active sessions',
      labelNames: [],
    });

    this.metrics.register({
      name: 'process_resident_memory_bytes',
      type: 'gauge',
      help: 'Resident memory size in bytes',
      labelNames: [],
      unit: 'bytes',
    });

    this.metrics.register({
      name: 'process_heap_bytes',
      type: 'gauge',
      help: 'Used heap size in bytes',
      labelNames: [],
      unit: 'bytes',
    });

    this.metrics.register({
      name: 'process_max_memory_bytes',
      type: 'gauge',
      help: 'V8 heap size limit in bytes',
      labelNames: [],
      unit: 'bytes',
    });

    this.metrics.register({
      name: 'process_cpu_seconds_total',
      type: 'counter',
      help: 'Total CPU time in seconds',
      labelNames: [],
    });

    // MoE metrics
    this.metrics.register({
      name: 'moe_router_expert_selection_total',
      type: 'counter',
      help: 'Expert selection count',
      labelNames: ['expert'],
    });

    // Memory Mesh metrics
    this.metrics.register({
      name: 'memory_mesh_query_duration_seconds',
      type: 'histogram',
      help: 'Memory mesh query duration',
      labelNames: ['backend', 'operation'],
      buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1],
    });

    // Zero-Trust metrics
    this.metrics.register({
      name: 'zero_trust_auth_total',
      type: 'counter',
      help: 'Total authentication attempts',
      labelNames: ['identity_type', 'factor'],
    });

    this.metrics.register({
      name: 'zero_trust_auth_success_total',
      type: 'counter',
      help: 'Successful authentications',
      labelNames: ['identity_type', 'factor'],
    });

    this.metrics.register({
      name: 'zero_trust_auth_decisions_total',
      type: 'counter',
      help: 'Authorization decisions',
      labelNames: ['decision'],
    });

    this.metrics.register({
      name: 'zero_trust_risk_score',
      type: 'gauge',
      help: 'Current risk score',
      labelNames: ['identity_id'],
    });

    this.metrics.register({
      name: 'zero_trust_device_trust_score',
      type: 'gauge',
      help: 'Device trust score',
      labelNames: ['device_id'],
    });

    // Governance metrics
    this.metrics.register({
      name: 'governance_decisions_total',
      type: 'counter',
      help: 'Governance decisions',
      labelNames: ['domain', 'status'],
    });

    this.metrics.register({
      name: 'governance_policy_violations_total',
      type: 'counter',
      help: 'Policy violations',
      labelNames: ['policy_id', 'severity'],
    });

    // Federated Learning metrics
    this.metrics.register({
      name: 'federated_learning_rounds_total',
      type: 'counter',
      help: 'Federated learning rounds completed',
      labelNames: [],
    });

    this.metrics.register({
      name: 'federated_learning_client_participation',
      type: 'gauge',
      help: 'Client participation rate',
      labelNames: [],
    });

    this.metrics.register({
      name: 'federated_learning_global_loss',
      type: 'gauge',
      help: 'Global model loss',
      labelNames: [],
    });

    // Learning metrics
    this.metrics.register({
      name: 'training_loss',
      type: 'gauge',
      help: 'Training loss',
      labelNames: ['job', 'phase'],
    });

    this.metrics.register({
      name: 'dpo_reward_margin',
      type: 'gauge',
      help: 'DPO reward margin',
      labelNames: [],
    });

    this.metrics.register({
      name: 'rlaif_mean_reward',
      type: 'gauge',
      help: 'RLAIF mean reward',
      labelNames: [],
    });

    this.metrics.register({
      name: 'active_learning_label_efficiency',
      type: 'gauge',
      help: 'Active learning label efficiency',
      labelNames: [],
    });

    // Model metrics
    this.metrics.register({
      name: 'model_versions_deployed',
      type: 'gauge',
      help: 'Number of model versions deployed',
      labelNames: [],
    });

    this.metrics.register({
      name: 'threat_intel_matches_total',
      type: 'counter',
      help: 'Threat intelligence matches',
      labelNames: ['type', 'severity'],
    });
  }

  private setupDefaultHealthChecks(): void {
    this.healthChecks.register('http', async () => ({ healthy: true }));
    this.healthChecks.register('memory', async () => ({
      healthy: process.memoryUsage().heapUsed < 1024 * 1024 * 1024, // < 1GB
      details: { heapUsed: process.memoryUsage().heapUsed },
    }));
    this.healthChecks.register('event_loop', async () => ({ healthy: true }));
  }

  private setupDefaultSLOs(): void {
    this.slos.register({
      name: 'availability',
      description: 'Service availability',
      sli: {
        type: 'availability',
        query: 'rate(http_requests_total[5m])',
        goodQuery: 'rate(http_requests_total{status!~"5.."}[5m])',
        totalQuery: 'rate(http_requests_total[5m])',
      },
      target: 0.999,
      window: '30d',
    });

    this.slos.register({
      name: 'latency_p99',
      description: 'P99 latency under 500ms',
      sli: {
        type: 'latency',
        query: 'histogram_quantile(0.99, rate(http_request_duration_seconds_bucket[5m]))',
        goodQuery:
          'histogram_quantile(0.99, rate(http_request_duration_seconds_bucket{le="0.5"}[5m]))',
        totalQuery: 'histogram_quantile(0.99, rate(http_request_duration_seconds_bucket[5m]))',
      },
      target: 0.95,
      window: '7d',
    });
  }

  private setupDefaultAlerts(): void {
    // Sin motor PromQL: la fracción se calcula sobre los contadores acumulados del proceso,
    // no sobre una ventana de 5m. Se declara explícito para no vender una lectura que no existe.
    this.alerts.addRule({
      name: 'high_error_rate',
      expr: 'rate(http_requests_total{status=~"5.."}[5m]) / rate(http_requests_total[5m]) > 0.05',
      for: '2m',
      labels: { severity: 'critical' },
      annotations: {
        summary: 'High error rate detected',
        basis: 'cumulative_since_process_start',
      },
    });

    this.alerts.addRule({
      name: 'high_latency',
      expr: 'histogram_quantile(0.99, rate(http_request_duration_seconds_bucket[5m])) > 1',
      for: '5m',
      labels: { severity: 'warning' },
      annotations: { summary: 'High P99 latency' },
    });

    this.alerts.addRule({
      name: 'memory_pressure',
      expr: 'process_heap_bytes / process_max_memory_bytes > 0.9',
      for: '5m',
      labels: { severity: 'warning' },
      annotations: { summary: 'Heap usage above 90% of the V8 heap limit' },
    });
  }

  private startCollectionLoop(): void {
    // Collect system metrics every 10 seconds. Cada lectura se toma del propio proceso:
    // rss/heap reales, límite de heap de V8 y el delta de CPU medido entre tics.
    let previousCpu = process.cpuUsage();
    setInterval(() => {
      const mem = process.memoryUsage();
      const delta = process.cpuUsage(previousCpu);
      previousCpu = process.cpuUsage();
      this.metrics.gauge('process_resident_memory_bytes', mem.rss);
      this.metrics.gauge('process_heap_bytes', mem.heapUsed);
      this.metrics.gauge('process_max_memory_bytes', getHeapStatistics().heap_size_limit);
      this.metrics.counter('process_cpu_seconds_total', (delta.user + delta.system) / 1e6);
    }, 10000);

    // Evaluate alerts every 30 seconds
    setInterval(() => {
      this.alerts.evaluate(this.metrics.getMetrics());
    }, 30000);

    // Run health checks every minute
    setInterval(() => {
      this.healthChecks.runAll();
    }, 60000);
  }

  // Helper methods for instrumentation
  recordHttpRequest(method: string, route: string, status: number, durationMs: number): void {
    this.metrics.counter('http_requests_total', 1, { method, route, status: String(status) });
    this.metrics.histogram('http_request_duration_seconds', durationMs / 1000, { method, route });
  }

  recordAuthAttempt(identityType: string, factor: string, success: boolean): void {
    this.metrics.counter('zero_trust_auth_total', 1, { identity_type: identityType, factor });
    if (success) {
      this.metrics.counter('zero_trust_auth_success_total', 1, {
        identity_type: identityType,
        factor,
      });
    }
  }

  recordAuthDecision(decision: string): void {
    this.metrics.counter('zero_trust_auth_decisions_total', 1, { decision });
  }

  recordGovernanceDecision(domain: string, status: string): void {
    this.metrics.counter('governance_decisions_total', 1, { domain, status });
  }

  recordPolicyViolation(policyId: string, severity: string): void {
    this.metrics.counter('governance_policy_violations_total', 1, {
      policy_id: policyId,
      severity,
    });
  }

  setActiveSessions(count: number): void {
    this.metrics.gauge('active_sessions', count);
  }

  setDeviceTrustScore(deviceId: string, score: number): void {
    this.metrics.gauge('zero_trust_device_trust_score', score, { device_id: deviceId });
  }

  setRiskScore(identityId: string, score: number): void {
    this.metrics.gauge('zero_trust_risk_score', score, { identity_id: identityId });
  }

  recordFederatedRound(participation: number, loss: number): void {
    this.metrics.counter('federated_learning_rounds_total', 1);
    this.metrics.gauge('federated_learning_client_participation', participation);
    this.metrics.gauge('federated_learning_global_loss', loss);
  }

  recordTrainingLoss(job: string, phase: string, loss: number): void {
    this.metrics.gauge('training_loss', loss, { job, phase });
  }

  getDashboard(name: 'system' | 'security' | 'learning'): GrafanaDashboard {
    switch (name) {
      case 'system':
        return DashboardGenerator.generateSystemDashboard();
      case 'security':
        return DashboardGenerator.generateSecurityDashboard();
      case 'learning':
        return DashboardGenerator.generateLearningDashboard();
    }
  }

  getAllDashboards(): GrafanaDashboard[] {
    return [
      DashboardGenerator.generateSystemDashboard(),
      DashboardGenerator.generateSecurityDashboard(),
      DashboardGenerator.generateLearningDashboard(),
    ];
  }

  exportPrometheusMetrics(): string {
    return this.metrics.exportPrometheus();
  }
}

// Trace context management (using async_hooks in production)
let currentTraceContext: TraceContext | null = null;

export function getCurrentTraceContext(): TraceContext | null {
  return currentTraceContext;
}

export function setCurrentTraceContext(context: TraceContext | null): void {
  currentTraceContext = context;
}

export function runWithTraceContext<T>(context: TraceContext, fn: () => T): T {
  const prev = currentTraceContext;
  currentTraceContext = context;
  try {
    return fn();
  } finally {
    currentTraceContext = prev;
  }
}

/**
 * Default Observability Stack Instance
 */
export const defaultObservability = new ObservabilityStack('isabella-q-omega');
