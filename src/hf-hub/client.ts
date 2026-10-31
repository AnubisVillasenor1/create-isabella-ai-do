/**
 * Hugging Face Hub client — acceso READ-ONLY al catálogo, model cards, datasets
 * y archivos PÚBLICOS del Hub. state: draft | engine-generated.
 *
 * Invariante (AGENTS.md): este cliente usa la infraestructura de INFORMACIÓN y
 * DATOS del Hub, que es gratuita. NO usa el router de INFERENCIA (de pago): el
 * cliente nunca genera texto, solo descubre y lee metadatos y archivos.
 * Leer un dataset NO lo admite como conocimiento verificado: CAPABILITY ≠ AUTHORITY.
 *
 * Diseño determinista y testeable: la red se inyecta vía `fetchImpl` y toda
 * respuesta se valida con type-guards (sin `any`). Falla cerrado ante HTTP != 2xx.
 */
import { HF_HUB_MAX_FILE_BYTES } from './catalog';

export const HF_HUB_BASE_URL = 'https://huggingface.co';
export const HF_HUB_TIMEOUT_MS = 15_000;
export const HF_HUB_DEFAULT_LIMIT = 12;
export const HF_HUB_MAX_LIMIT = 50;

export type HfEnv = Readonly<Record<string, string | undefined>>;

/** Estructura mínima de una respuesta HTTP; permite inyectar un doble en pruebas. */
export interface HfResponse {
  readonly ok: boolean;
  readonly status: number;
  text(): Promise<string>;
}

export type HfFetch = (
  url: string,
  init?: { headers?: Record<string, string>; signal?: AbortSignal }
) => Promise<HfResponse>;

export interface HfModelSummary {
  readonly id: string;
  readonly pipelineTag: string;
  readonly downloads: number;
  readonly likes: number;
  readonly tags: readonly string[];
  readonly lastModified: string | null;
  readonly gated: boolean;
}

export interface HfDatasetSummary {
  readonly id: string;
  readonly downloads: number;
  readonly likes: number;
  readonly tags: readonly string[];
  readonly lastModified: string | null;
  readonly gated: boolean;
}

export interface HfModelQuery {
  readonly task?: string;
  readonly search?: string;
  readonly limit?: number;
}

export interface HfDatasetQuery {
  readonly search?: string;
  readonly limit?: number;
}

export interface HfFileQuery {
  readonly repo: string;
  readonly repoType: 'datasets' | 'models';
  readonly path: string;
  readonly revision?: string;
}

export interface HfHubClientOptions {
  readonly fetchImpl?: HfFetch;
  readonly baseUrl?: string;
  readonly timeoutMs?: number;
  readonly maxFileBytes?: number;
}

const globalFetch: HfFetch = (url, init) => fetch(url, init);

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' ? (value as Record<string, unknown>) : null;
}

function asString(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function asNumber(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function asBoolean(value: unknown): boolean {
  return value === true;
}

function asStringArray(value: unknown): readonly string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : [];
}

function toModelSummary(value: unknown): HfModelSummary | null {
  const record = asRecord(value);
  const id = record ? asString(record.id) : null;
  if (!record || !id) return null;
  return Object.freeze({
    id,
    pipelineTag: asString(record.pipeline_tag) ?? 'unknown',
    downloads: asNumber(record.downloads),
    likes: asNumber(record.likes),
    tags: Object.freeze([...asStringArray(record.tags)]),
    lastModified: asString(record.lastModified),
    gated: asBoolean(record.gated),
  });
}

function toDatasetSummary(value: unknown): HfDatasetSummary | null {
  const record = asRecord(value);
  const id = record ? asString(record.id) : null;
  if (!record || !id) return null;
  return Object.freeze({
    id,
    downloads: asNumber(record.downloads),
    likes: asNumber(record.likes),
    tags: Object.freeze([...asStringArray(record.tags)]),
    lastModified: asString(record.lastModified),
    gated: asBoolean(record.gated),
  });
}

export function clampHfLimit(limit: number | undefined): number {
  if (limit === undefined || !Number.isFinite(limit)) return HF_HUB_DEFAULT_LIMIT;
  const rounded = Math.floor(limit);
  if (rounded < 1) return 1;
  return Math.min(HF_HUB_MAX_LIMIT, rounded);
}

/** Id válido de repo del Hub: `owner/name` con caracteres seguros. */
export function isSafeRepoId(id: string): boolean {
  return /^[A-Za-z0-9][A-Za-z0-9._-]{0,95}\/[A-Za-z0-9][A-Za-z0-9._-]{0,95}$/.test(id.trim());
}

export class HfHubClient {
  private readonly baseUrl: string;
  private readonly token?: string;
  private readonly fetchImpl: HfFetch;
  private readonly timeoutMs: number;
  private readonly maxFileBytes: number;

  constructor(env: HfEnv = {}, options: HfHubClientOptions = {}) {
    const token = env.HF_TOKEN?.trim();
    if (token) this.token = token;
    this.baseUrl = (options.baseUrl ?? HF_HUB_BASE_URL).replace(/\/+$/, '');
    this.fetchImpl = options.fetchImpl ?? globalFetch;
    this.timeoutMs = options.timeoutMs ?? HF_HUB_TIMEOUT_MS;
    this.maxFileBytes = options.maxFileBytes ?? HF_HUB_MAX_FILE_BYTES;
  }

  /** Autenticado con un token del operador. El Hub público funciona sin token, con menor cuota. */
  get configured(): boolean {
    return Boolean(this.token);
  }

  private headers(accept: string): Record<string, string> {
    return this.token ? { accept, authorization: `Bearer ${this.token}` } : { accept };
  }

  private async request(path: string, accept: string): Promise<HfResponse> {
    const controller = new AbortController();
    const timer: ReturnType<typeof setTimeout> = setTimeout(
      () => controller.abort(),
      this.timeoutMs
    );
    try {
      const response = await this.fetchImpl(`${this.baseUrl}${path}`, {
        headers: this.headers(accept),
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(`HF_HUB_HTTP_${response.status}`);
      return response;
    } finally {
      clearTimeout(timer);
    }
  }

  async listModels(query: HfModelQuery = {}): Promise<readonly HfModelSummary[]> {
    const params = new URLSearchParams();
    params.set('limit', String(clampHfLimit(query.limit)));
    params.set('sort', 'downloads');
    params.set('direction', '-1');
    params.set('full', 'false');
    const task = query.task?.trim();
    if (task) params.set('filter', task);
    const search = query.search?.trim();
    if (search) params.set('search', search);
    const response = await this.request(`/api/models?${params.toString()}`, 'application/json');
    return this.parseList(await response.text(), toModelSummary);
  }

  async listDatasets(query: HfDatasetQuery = {}): Promise<readonly HfDatasetSummary[]> {
    const params = new URLSearchParams();
    params.set('limit', String(clampHfLimit(query.limit)));
    params.set('sort', 'downloads');
    params.set('direction', '-1');
    const search = query.search?.trim();
    if (search) params.set('search', search);
    const response = await this.request(`/api/datasets?${params.toString()}`, 'application/json');
    return this.parseList(await response.text(), toDatasetSummary);
  }

  async getModel(id: string): Promise<HfModelSummary> {
    if (!isSafeRepoId(id)) throw new Error('HF_HUB_UNSAFE_REPO_ID');
    const response = await this.request(`/api/models/${id.trim()}`, 'application/json');
    const parsed = toModelSummary(JSON.parse(await response.text()) as unknown);
    if (!parsed) throw new Error('HF_HUB_INVALID_PAYLOAD');
    return parsed;
  }

  async getDataset(id: string): Promise<HfDatasetSummary> {
    if (!isSafeRepoId(id)) throw new Error('HF_HUB_UNSAFE_REPO_ID');
    const response = await this.request(`/api/datasets/${id.trim()}`, 'application/json');
    const parsed = toDatasetSummary(JSON.parse(await response.text()) as unknown);
    if (!parsed) throw new Error('HF_HUB_INVALID_PAYLOAD');
    return parsed;
  }

  /**
   * Descarga el texto de un archivo de repo (p. ej. `README.md` de un dataset).
   * Acotado por `maxFileBytes`: es una lectura acotada, no un mirror completo.
   */
  async getFileText(query: HfFileQuery): Promise<string> {
    if (!isSafeRepoId(query.repo)) throw new Error('HF_HUB_UNSAFE_REPO_ID');
    const revision = (query.revision ?? 'main').trim() || 'main';
    const cleanPath = query.path.replace(/^\/+/, '');
    const response = await this.request(
      `/${query.repoType}/${query.repo.trim()}/resolve/${revision}/${cleanPath}`,
      'text/plain, text/markdown, */*'
    );
    const text = await response.text();
    return text.length > this.maxFileBytes ? text.slice(0, this.maxFileBytes) : text;
  }

  private parseList<T>(text: string, mapper: (value: unknown) => T | null): readonly T[] {
    const payload: unknown = JSON.parse(text);
    if (!Array.isArray(payload)) throw new Error('HF_HUB_INVALID_PAYLOAD');
    const items: T[] = [];
    for (const entry of payload) {
      const mapped = mapper(entry);
      if (mapped !== null) items.push(mapped);
    }
    return Object.freeze(items);
  }
}

export function createHfHubClient(env: HfEnv = {}, options: HfHubClientOptions = {}): HfHubClient {
  return new HfHubClient(env, options);
}
