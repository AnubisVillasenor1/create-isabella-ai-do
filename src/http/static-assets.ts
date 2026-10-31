/**
 * state: engine-generated
 * In-memory static asset serving with content-hash ETag, pre-compressed brotli/gzip bodies and
 * conditional (304) responses. Built once at startup so a request never pays for compression.
 * Latency rationale (AUD-15): the UI shipped ~190 KB of uncompressed CSS/JS/HTML with 60 s cache.
 * CAPABILITY ≠ AUTHORITY: this only serves public, already-readable UI bytes.
 */
import { createHash } from 'node:crypto';
import { brotliCompressSync, constants as zc, gzipSync } from 'node:zlib';

export interface StaticAsset {
  readonly contentType: string;
  readonly etag: string;
  readonly identity: Buffer;
  readonly gzip: Buffer;
  readonly br: Buffer;
}

export interface MinimalReq {
  headers: Record<string, string | string[] | undefined>;
  method?: string;
}
export interface MinimalRes {
  setHeader(name: string, value: string | number): unknown;
  status(code: number): MinimalRes;
  end(body?: Buffer): unknown;
}

export function contentHash(content: string | Buffer): string {
  return createHash('sha256').update(content).digest('hex').slice(0, 12);
}

export function buildAsset(content: string | Buffer, contentType: string): StaticAsset {
  const identity = Buffer.isBuffer(content) ? content : Buffer.from(content, 'utf8');
  return Object.freeze({
    contentType,
    etag: `"${contentHash(identity)}"`,
    identity,
    gzip: gzipSync(identity, { level: 9 }),
    br: brotliCompressSync(identity, {
      params: { [zc.BROTLI_PARAM_QUALITY]: 11, [zc.BROTLI_PARAM_SIZE_HINT]: identity.length },
    }),
  });
}

/** Pick the best encoding the client accepts; honours q=0 exclusions. */
export function negotiateEncoding(
  acceptEncoding: string | string[] | undefined
): 'br' | 'gzip' | 'identity' {
  const header = Array.isArray(acceptEncoding) ? acceptEncoding.join(',') : (acceptEncoding ?? '');
  const accepted = new Map<string, number>();
  for (const part of header.split(',')) {
    const [name, ...params] = part.trim().toLowerCase().split(';');
    if (!name) continue;
    const q = params.map((p) => p.trim()).find((p) => p.startsWith('q='));
    const weight = q ? Number(q.slice(2)) : 1;
    accepted.set(name.trim(), Number.isFinite(weight) ? weight : 1);
  }
  if ((accepted.get('br') ?? 0) > 0) return 'br';
  if ((accepted.get('gzip') ?? accepted.get('*') ?? 0) > 0) return 'gzip';
  return 'identity';
}

export function etagMatches(ifNoneMatch: string | string[] | undefined, etag: string): boolean {
  const header = Array.isArray(ifNoneMatch) ? ifNoneMatch.join(',') : ifNoneMatch;
  if (!header) return false;
  if (header.trim() === '*') return true;
  return header.split(',').some((candidate) => candidate.trim().replace(/^W\//, '') === etag);
}

export function serveAsset(
  req: MinimalReq,
  res: MinimalRes,
  asset: StaticAsset,
  cacheControl: string
): void {
  const encoding = negotiateEncoding(req.headers['accept-encoding']);
  res.setHeader('Content-Type', asset.contentType);
  res.setHeader('Cache-Control', cacheControl);
  res.setHeader('Vary', 'Accept-Encoding');
  res.setHeader('ETag', asset.etag);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (etagMatches(req.headers['if-none-match'], asset.etag)) {
    res.status(304).end();
    return;
  }
  const body = encoding === 'br' ? asset.br : encoding === 'gzip' ? asset.gzip : asset.identity;
  if (encoding !== 'identity') res.setHeader('Content-Encoding', encoding);
  res.setHeader('Content-Length', body.length);
  res.status(200).end(req.method === 'HEAD' ? undefined : body);
}
