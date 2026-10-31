/**
 * Plataforma multipágina y chat dedicado (state: wired | tested (contract)).
 *
 * El servidor compila las páginas una vez al arrancar y sirve activos
 * precomprimidos con ETag. Las rutas se resuelven contra un catálogo cerrado:
 * un identificador desconocido produce un 404 real, no una redirección silenciosa.
 * Enumerar páginas o catálogos no concede autoridad ni ejecuta acciones.
 */
import type { Application, Request, Response } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { buildAsset, contentHash, serveAsset, type StaticAsset } from '../http/static-assets';
import type { FixedWindowRateLimiter } from '../security/rate-limit';
import { PLATFORM_PAGES, buildPlatformCatalogPayload, findPlatformPage } from '../platform/catalog';
import {
  platformAssetHrefs,
  renderChatDocument,
  renderNotFoundPage,
  renderPlatformPage,
} from '../platform/render';

export const PLATFORM_ROUTES_VERSION = '1.0.0' as const;

/**
 * Marca explícita de superficie pública de solo lectura. La prueba de cableado
 * de compuertas rechaza grupos públicos implícitos: toda ruta que no exija
 * autorización debe declararse aquí de forma deliberada.
 */
export const PLATFORM_PUBLIC_SURFACE = 'read-only-html-and-chat' as const;

const IMMUTABLE_CACHE = 'public, max-age=31536000, immutable';
const HTML_CACHE = 'no-cache';

export interface PlatformRouteDeps {
  readonly app: Application;
  readonly enforceRateLimit: (
    req: Request,
    res: Response,
    limiter: FixedWindowRateLimiter,
    bucket: string
  ) => boolean;
  readonly rateLimiter: FixedWindowRateLimiter;
  readonly publicSurface: typeof PLATFORM_PUBLIC_SURFACE;
}

interface PreparedPlatform {
  readonly css: StaticAsset;
  readonly js: StaticAsset;
  readonly chatJs: StaticAsset;
  readonly chatDocument: StaticAsset;
  readonly pages: ReadonlyMap<string, StaticAsset>;
  readonly notFound: StaticAsset;
}

function loadPlatformAssets(): PreparedPlatform | null {
  try {
    const uiRoot = path.join(process.cwd(), 'src', 'ui', 'platform');
    const css = fs.readFileSync(path.join(uiRoot, 'site.css'), 'utf8');
    const js = fs.readFileSync(path.join(uiRoot, 'site.js'), 'utf8');
    const chatHtml = fs.readFileSync(path.join(uiRoot, 'chat.html'), 'utf8');
    const chatJs = fs.readFileSync(path.join(uiRoot, 'chat.js'), 'utf8');
    const cognitionClient = fs.readFileSync(
      path.join(process.cwd(), 'src', 'ui', 'cognition-client.js'),
      'utf8'
    );
    const hrefs = platformAssetHrefs({
      css: contentHash(css),
      js: contentHash(js),
      chatJs: contentHash(chatJs),
    });
    const pages = new Map<string, StaticAsset>();
    for (const page of PLATFORM_PAGES) {
      if (page.kind !== 'page') continue;
      pages.set(
        page.id,
        buildAsset(
          renderPlatformPage(page, { cssHref: hrefs.cssHref, jsHref: hrefs.jsHref }),
          'text/html; charset=utf-8'
        )
      );
    }
    const chatDocument = renderChatDocument({
      html: chatHtml,
      cssHref: hrefs.cssHref,
      chatJsHref: hrefs.chatJsHref,
      cognitionJsHref: `/ui/cognition-client.js?v=${encodeURIComponent(contentHash(cognitionClient))}`,
    });
    return {
      css: buildAsset(css, 'text/css; charset=utf-8'),
      js: buildAsset(js, 'text/javascript; charset=utf-8'),
      chatJs: buildAsset(chatJs, 'text/javascript; charset=utf-8'),
      chatDocument: buildAsset(chatDocument, 'text/html; charset=utf-8'),
      pages,
      notFound: buildAsset(
        renderNotFoundPage({ cssHref: hrefs.cssHref, jsHref: hrefs.jsHref }),
        'text/html; charset=utf-8'
      ),
    };
  } catch {
    console.warn('[Isabella] Platform UI assets are unavailable at startup.');
    return null;
  }
}

function unavailable(res: Response): void {
  res
    .status(503)
    .type('html')
    .send(
      '<!doctype html><meta charset="utf-8" /><title>Isabella · plataforma no disponible</title><p>La plataforma no pudo cargar sus activos en este proceso. El catálogo y las APIs públicas siguen disponibles.</p>'
    );
}

export function registerPlatformRoutes(deps: PlatformRouteDeps): void {
  const { app } = deps;
  const assets = loadPlatformAssets();
  const overview = PLATFORM_PAGES.find((page) => page.id === 'overview');

  app.get('/chat', (req, res) => {
    if (!deps.enforceRateLimit(req, res, deps.rateLimiter, 'platform-chat')) return;
    if (!assets) {
      unavailable(res);
      return;
    }
    serveAsset(req, res, assets.chatDocument, HTML_CACHE);
  });

  app.get('/platform', (req, res) => {
    if (!deps.enforceRateLimit(req, res, deps.rateLimiter, 'platform-page')) return;
    const page = overview ? assets?.pages.get(overview.id) : null;
    if (!assets || !page) {
      unavailable(res);
      return;
    }
    serveAsset(req, res, page, HTML_CACHE);
  });

  app.get('/platform/:page', (req, res) => {
    if (!deps.enforceRateLimit(req, res, deps.rateLimiter, 'platform-page')) return;
    const pageId = typeof req.params.page === 'string' ? req.params.page : '';
    const page = findPlatformPage(pageId);
    if (!page) {
      if (!assets) {
        res
          .status(404)
          .type('html')
          .send(
            '<!doctype html><meta charset="utf-8" /><title>Isabella · 404</title><p>La ruta solicitada no pertenece al catálogo.</p>'
          );
        return;
      }
      res.status(404);
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Cache-Control', HTML_CACHE);
      res.setHeader('ETag', assets.notFound.etag);
      res.setHeader('X-Content-Type-Options', 'nosniff');
      if (req.method === 'HEAD') {
        res.end();
        return;
      }
      res.end(assets.notFound.identity);
      return;
    }
    if (page.kind === 'chat') {
      res.redirect(308, '/chat');
      return;
    }
    const asset = assets?.pages.get(page.id);
    if (!assets || !asset) {
      unavailable(res);
      return;
    }
    serveAsset(req, res, asset, HTML_CACHE);
  });

  app.get('/styles/platform.css', (req, res) => {
    if (!assets) {
      res.status(404).type('css').send('/* Platform CSS unavailable */');
      return;
    }
    serveAsset(req, res, assets.css, IMMUTABLE_CACHE);
  });

  app.get('/ui/platform.js', (req, res) => {
    if (!assets) {
      res.status(404).type('js').send('// Platform JavaScript unavailable');
      return;
    }
    serveAsset(req, res, assets.js, IMMUTABLE_CACHE);
  });

  app.get('/ui/platform-chat.js', (req, res) => {
    if (!assets) {
      res.status(404).type('js').send('// Chat JavaScript unavailable');
      return;
    }
    serveAsset(req, res, assets.chatJs, IMMUTABLE_CACHE);
  });

  app.get('/ui/platform/logo-isav6.jpeg', (_req, res) => {
    const logoPath = path.join(process.cwd(), 'src', 'ui', 'platform', 'logo-isav6.jpeg');
    if (!fs.existsSync(logoPath)) {
      res.status(404).send('Logo unavailable');
      return;
    }
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.type('jpeg').sendFile(logoPath);
  });

  app.get('/api/v1/platform/catalog', (req, res) => {
    if (!deps.enforceRateLimit(req, res, deps.rateLimiter, 'platform-catalog')) return;
    res.setHeader('Cache-Control', 'no-store');
    res.json({
      success: true,
      version: PLATFORM_ROUTES_VERSION,
      ...buildPlatformCatalogPayload(),
      authority: 'READ_ONLY',
    });
  });
}
