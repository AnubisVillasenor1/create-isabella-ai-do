/**
 * Render server-side de la plataforma (state: engine-generated).
 *
 * El HTML se construye una sola vez por página al arrancar. La interfaz no usa
 * scripts inline: todo el comportamiento vive en /ui/platform.js y /ui/platform-chat.js.
 * El catálogo es contenido controlado; aun así se escapa antes de publicarlo.
 */
import {
  PLATFORM_NAV_GROUPS,
  PLATFORM_PAGES,
  PLATFORM_INVARIANT,
  type PlatformNavGroup,
  type PlatformPage,
  type PlatformSection,
} from './catalog';

const FAVICON =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Cdefs%3E%3ClinearGradient id='g' x1='0' y1='0' x2='1' y2='1'%3E%3Cstop offset='0' stop-color='%239ff7ff'/%3E%3Cstop offset='.55' stop-color='%23c9b8ff'/%3E%3Cstop offset='1' stop-color='%23a9f5d0'/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect width='64' height='64' rx='16' fill='%23070c13'/%3E%3Ccircle cx='32' cy='32' r='22' fill='none' stroke='url(%23g)' stroke-width='2'/%3E%3Ctext x='32' y='40' text-anchor='middle' font-family='Georgia,serif' font-size='22' fill='url(%23g)'%3EIS%3C/text%3E%3C/svg%3E";

const GROUP_LABELS: Record<string, string> = Object.fromEntries(
  PLATFORM_NAV_GROUPS.map((group) => [group.id, group.label])
);

export interface PlatformRenderOptions {
  readonly cssHref: string;
  readonly jsHref: string;
}

export function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function assetHref(path: string, version: string): string {
  return `${path}?v=${encodeURIComponent(version)}`;
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

function groupLabel(groupId: string): string {
  return GROUP_LABELS[groupId] ?? 'PLATAFORMA';
}

function pageIndex(page: PlatformPage): number {
  return Math.max(
    0,
    PLATFORM_PAGES.findIndex((candidate) => candidate.id === page.id)
  );
}

function renderNavGroup(group: PlatformNavGroup, active: PlatformPage): string {
  const links = group.pages
    .map((id) => PLATFORM_PAGES.find((page) => page.id === id))
    .filter((page): page is PlatformPage => page !== undefined)
    .map((page) => {
      const current = page.id === active.id;
      return `<a class="nav-link${current ? ' is-current' : ''}" href="${escapeHtml(page.path)}" data-page-link data-page-id="${escapeHtml(page.id)}" data-page-title="${escapeHtml(page.title)}" data-page-summary="${escapeHtml(page.summary)}" data-page-keywords="${escapeHtml([page.title, page.navLabel, page.eyebrow, ...page.meta].join(' '))}"${current ? ' aria-current="page"' : ''}><span class="nav-link-index">${pad(PLATFORM_PAGES.indexOf(page) + 1)}</span><span class="nav-link-label">${escapeHtml(page.navLabel)}</span><span class="nav-link-arrow" aria-hidden="true">→</span></a>`;
    })
    .join('');
  return `<div class="nav-group"><div class="nav-group-head"><span>${escapeHtml(group.index)}</span><strong>${escapeHtml(group.label)}</strong></div><p class="nav-group-description">${escapeHtml(group.description)}</p>${links}</div>`;
}

function renderSidebar(active: PlatformPage): string {
  const groups = PLATFORM_NAV_GROUPS.map((group) => renderNavGroup(group, active)).join('');
  return `<aside id="platform-nav" class="site-sidebar" aria-label="Navegación de la plataforma">
  <div class="sidebar-brand">
    <a class="brand-lockup" href="/platform" aria-label="Isabella Genesis, panorama de la plataforma">
      <span class="brand-mark" aria-hidden="true"><i></i><b>IS</b></span>
      <span class="brand-copy"><strong>ISABELLA</strong><small>GENESIS / V6</small></span>
    </a>
    <span class="brand-node">NODO CERO</span>
  </div>
  <nav class="sidebar-nav">${groups}</nav>
  <div class="sidebar-foot">
    <div class="sidebar-invariant"><span>INVARIANTE</span><p>${escapeHtml(PLATFORM_INVARIANT)}</p></div>
    <div class="sidebar-links"><a href="/">Interfaz clásica</a><a href="/platform/docs">Documentación</a></div>
  </div>
</aside>`;
}

function renderTopbar(active: PlatformPage): string {
  return `<header class="site-topbar">
  <button class="icon-button nav-toggle" type="button" data-nav-open aria-controls="platform-nav" aria-expanded="false" aria-label="Abrir navegación"><span></span><span></span><span></span></button>
  <div class="topbar-breadcrumb"><a href="/platform">PLATAFORMA</a><span aria-hidden="true">/</span><strong>${escapeHtml(groupLabel(active.group))}</strong><span aria-hidden="true">/</span><b>${escapeHtml(active.navLabel)}</b></div>
  <div class="topbar-actions">
    <button class="search-launcher" type="button" data-command-open aria-label="Buscar en la plataforma"><span aria-hidden="true">⌕</span><span class="search-launcher-label">Buscar</span><kbd>⌘ K</kbd></button>
    <a class="topbar-status" href="/platform/status"><i aria-hidden="true"></i><span>ESTADO DEL NODO</span></a>
    <a class="button button-sm button-primary" href="/chat">Abrir chat <span aria-hidden="true">↗</span></a>
  </div>
</header>`;
}

function renderHero(active: PlatformPage): string {
  const index = pageIndex(active);
  const total = PLATFORM_PAGES.length;
  const chips = active.meta
    .map((item) => `<span class="meta-chip">${escapeHtml(item)}</span>`)
    .join('');
  const cta = active.cta
    ? `<a class="button button-primary" href="${escapeHtml(active.cta.href)}">${escapeHtml(active.cta.label)} <span aria-hidden="true">↗</span></a>`
    : '';
  return `<section class="page-hero" aria-labelledby="page-title">
  <div class="page-hero-copy">
    <p class="eyebrow">${escapeHtml(active.eyebrow)}</p>
    <h1 id="page-title">${escapeHtml(active.title)} <em>${escapeHtml(active.accent)}</em></h1>
    <p class="page-summary">${escapeHtml(active.summary)}</p>
    <div class="meta-row">${chips}</div>
    <div class="hero-actions">${cta}<button class="button button-ghost" type="button" data-command-open>Explorar secciones <span aria-hidden="true">⌘K</span></button></div>
  </div>
  <div class="page-hero-aside" aria-hidden="true">
    <div class="folio-card">
      <div class="folio-meta"><span>FOLIO</span><b>${pad(index + 1)} / ${pad(total)}</b></div>
      <div class="folio-orb"><i class="orbit-ring orbit-ring-a"></i><i class="orbit-ring orbit-ring-b"></i><i class="orbit-ring orbit-ring-c"></i><b>IS</b><span>V6</span></div>
      <div class="folio-foot"><span>${escapeHtml(groupLabel(active.group))}</span><span>REVISIÓN 2026-10-24</span></div>
    </div>
  </div>
</section>`;
}

function renderSection(section: PlatformSection, index: number): string {
  const bullets =
    section.bullets && section.bullets.length > 0
      ? `<ul class="bullet-grid">${section.bullets.map((bullet) => `<li><span aria-hidden="true">◇</span><p>${escapeHtml(bullet)}</p></li>`).join('')}</ul>`
      : '';
  const note = section.note
    ? `<aside class="section-note"><span>NOTA DE HONESTIDAD</span><p>${escapeHtml(section.note)}</p></aside>`
    : '';
  const links =
    section.links && section.links.length > 0
      ? `<div class="section-links">${section.links.map((link) => `<a href="${escapeHtml(link.href)}"${link.external ? ' rel="noreferrer noopener" target="_blank"' : ''}>${escapeHtml(link.label)} <span aria-hidden="true">↗</span></a>`).join('')}</div>`
      : '';
  const code = section.code
    ? `<div class="blueprint-block"><header><span>EJEMPLO VERIFICABLE</span><b>${escapeHtml(section.id.toUpperCase())}</b></header><pre><code>${escapeHtml(section.code)}</code></pre></div>`
    : '';
  return `<section class="page-section" data-reveal>
  <div class="section-rail"><span>${escapeHtml(section.eyebrow)}</span><b>${pad(index + 1)}</b></div>
  <div class="section-body">
    <h2>${escapeHtml(section.title)}</h2>
    <p>${escapeHtml(section.body)}</p>
    ${bullets}
    ${code}
    ${links}
    ${note}
  </div>
</section>`;
}

function renderLiveZone(active: PlatformPage): string {
  if (!active.dynamic) return '';
  const titles: Record<string, string> = {
    overview: 'Lectura operativa en vivo',
    status: 'Telemetría pública del proceso',
    skills: 'Catálogo vivo de skills',
    agents: 'Agente y herramientas registradas',
    marketplace: 'Inventario de solo lectura',
    pricing: 'Planes y cuotas del servidor',
    integrations: 'Superficies y proveedores declarados',
    governance: 'Evidencia y estado de gobernanza',
    canon: 'Registro canónico y trazabilidad',
    library: 'Biblioteca local',
    profile: 'Perfil y reconocimiento local',
    settings: 'Preferencias del espacio',
    donations: 'Canales de apoyo declarados',
  };
  const notes: Record<string, string> = {
    overview: 'Datos públicos del proceso. No sustituyen una prueba de producción.',
    status: 'Métricas locales al proceso; se reinician con el nodo. No son un SLA.',
    skills: 'Listar una skill no la ejecuta ni concede autoridad.',
    agents: 'La aprobación de escrituras se decide en el servidor.',
    marketplace: 'Resolver y planificar no instala, no habilita y no ejecuta.',
    pricing: 'La compra depende de la configuración del operador; no se simula un pago.',
    integrations: 'La configuración declarada no demuestra alcanzabilidad externa.',
    governance: 'La evidencia prueba integridad de registro, no veracidad de un hecho.',
    canon:
      'La madurez declarada describe este repositorio; no es certificación externa ni producción.',
    library: 'Los archivos permanecen en este navegador; no se suben al servidor.',
    profile: 'Las insignias son locales y no constituyen una certificación.',
    settings: 'Estas preferencias solo se aplican en este navegador.',
    donations: 'No se recolectan datos de pago en esta superficie.',
  };
  return `<section class="live-zone" data-live="${escapeHtml(active.dynamic)}" data-reveal aria-labelledby="live-title">
  <div class="live-head">
    <div><p class="eyebrow">LIVE / ${escapeHtml(active.dynamic.toUpperCase())}</p><h2 id="live-title">${escapeHtml(titles[active.dynamic] ?? 'Datos en vivo')}</h2></div>
    <button class="button button-ghost button-sm" type="button" data-live-refresh><span aria-hidden="true">↻</span> Actualizar</button>
  </div>
  <div class="live-content" data-live-content aria-live="polite" aria-busy="true">
    <div class="live-skeleton"><span></span><span></span><span></span></div>
  </div>
  <p class="live-note">${escapeHtml(notes[active.dynamic] ?? 'Lectura informativa; no concede autoridad.')}</p>
</section>`;
}

function renderRelated(active: PlatformPage): string {
  const cards = active.related
    .map((id) => PLATFORM_PAGES.find((page) => page.id === id))
    .filter((page): page is PlatformPage => page !== undefined && page.id !== active.id)
    .map(
      (page) =>
        `<a class="related-card" href="${escapeHtml(page.path)}"><span>${escapeHtml(page.eyebrow)}</span><strong>${escapeHtml(page.navLabel)}</strong><p>${escapeHtml(page.summary)}</p><b aria-hidden="true">→</b></a>`
    )
    .join('');
  if (!cards) return '';
  return `<section class="related-zone" aria-labelledby="related-title"><div class="related-head"><p class="eyebrow">CONTINUAR</p><h2 id="related-title">Secciones relacionadas</h2></div><div class="related-grid">${cards}</div></section>`;
}

function renderFooter(): string {
  const groups = PLATFORM_NAV_GROUPS.map(
    (group) =>
      `<div><span>${escapeHtml(group.label)}</span>${group.pages
        .map((id) => {
          const page = PLATFORM_PAGES.find((candidate) => candidate.id === id);
          return page ? `<a href="${escapeHtml(page.path)}">${escapeHtml(page.navLabel)}</a>` : '';
        })
        .join('')}</div>`
  ).join('');
  return `<footer class="site-footer">
  <div class="footer-brand"><span class="brand-mark" aria-hidden="true"><i></i><b>IS</b></span><div><strong>ISABELLA VILLASEÑOR AI</strong><p>Genesis TINA V6 · Nodo Cero · Real del Monte, Hidalgo, México.</p></div></div>
  <div class="footer-groups">${groups}</div>
  <div class="footer-bottom"><span>© 2026 TAMV Online Network. Proyecto de inteligencia soberana latinoamericana.</span><span>${escapeHtml(PLATFORM_INVARIANT)}</span></div>
</footer>`;
}

function renderCommandPalette(): string {
  return `<dialog id="commandPalette" class="command-palette" aria-labelledby="command-title">
  <div class="command-panel">
    <div class="command-head"><span class="command-mark" aria-hidden="true">⌕</span><label id="command-title" for="commandInput" class="sr-only">Buscar en la plataforma</label><input id="commandInput" type="search" placeholder="Buscar páginas, skills, API, gobernanza…" autocomplete="off" spellcheck="false" /><kbd>ESC</kbd></div>
    <div id="commandResults" class="command-results" role="listbox" aria-label="Resultados"></div>
    <div class="command-foot"><span>↑ ↓ para navegar</span><span>Enter para abrir</span><span>La búsqueda no sale de tu navegador</span></div>
  </div>
</dialog>`;
}

function renderDocument(options: {
  readonly title: string;
  readonly description: string;
  readonly bodyClass: string;
  readonly dataPage: string;
  readonly cssHref: string;
  readonly jsHref: string;
  readonly body: string;
}): string {
  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="theme-color" content="#070c13" />
<meta name="color-scheme" content="dark" />
<meta name="description" content="${escapeHtml(options.description)}" />
<meta property="og:type" content="website" />
<meta property="og:title" content="${escapeHtml(options.title)}" />
<meta property="og:description" content="${escapeHtml(options.description)}" />
<meta property="og:image" content="/assets/video/IntroVideoIsabella-poster.jpg" />
<link rel="icon" href="${FAVICON}" />
<link rel="preload" as="style" href="${escapeHtml(options.cssHref)}" />
<link rel="stylesheet" href="${escapeHtml(options.cssHref)}" />
<title>${escapeHtml(options.title)} · Isabella Villaseñor AI</title>
</head>
<body class="${escapeHtml(options.bodyClass)}" data-page="${escapeHtml(options.dataPage)}">
<a class="skip-link" href="#main">Saltar al contenido</a>
<div class="ambient" aria-hidden="true"><span class="ambient-grid"></span><span class="ambient-glow ambient-glow-a"></span><span class="ambient-glow ambient-glow-b"></span><span class="ambient-scan"></span></div>
<div class="platform-shell">
${options.body}
</div>
${renderCommandPalette()}
<script src="${escapeHtml(options.jsHref)}" defer></script>
</body>
</html>`;
}

export function renderPlatformPage(page: PlatformPage, options: PlatformRenderOptions): string {
  const sections = page.sections.map((section, index) => renderSection(section, index)).join('');
  const main = `<main id="main" class="site-main" data-page-root>
${renderHero(page)}
<div class="content-column">
${sections}
${renderLiveZone(page)}
${renderRelated(page)}
</div>
</main>`;
  const body = `${renderTopbar(page)}
${renderSidebar(page)}
<div class="nav-scrim" data-nav-close hidden></div>
${main}
${renderFooter()}`;
  return renderDocument({
    title: `${page.title} ${page.accent}`,
    description: page.summary,
    bodyClass: `platform-page group-${page.group}`,
    dataPage: page.id,
    cssHref: options.cssHref,
    jsHref: options.jsHref,
    body,
  });
}

export function renderNotFoundPage(options: PlatformRenderOptions): string {
  const page: PlatformPage = {
    id: '404',
    kind: 'page',
    path: '/platform',
    navLabel: 'No encontrado',
    group: 'workspace',
    eyebrow: '404 / RUTA NO ENCONTRADA',
    title: 'Esta página no existe',
    accent: 'en este nodo.',
    summary:
      'La ruta solicitada no pertenece al catálogo de la plataforma. Puedes volver al panorama, abrir el chat dedicado o buscar otra sección con la paleta de comandos.',
    meta: ['404', 'CATÁLOGO CERRADO', 'SIN REDIRECCIÓN SILENCIOSA'],
    sections: [],
    related: ['overview', 'chat', 'docs'],
    cta: { label: 'Volver al panorama', href: '/platform' },
  };
  const main = `<main id="main" class="site-main" data-page-root>
${renderHero(page)}
<div class="content-column">
<section class="page-section" data-reveal><div class="section-rail"><span>01 / RECUPERACIÓN</span><b>01</b></div><div class="section-body"><h2>Volver a una superficie válida.</h2><p>El servidor no sirve páginas arbitrarias: solo los identificadores declarados en el catálogo. Esta respuesta es un 404 real, no una redirección silenciosa.</p><div class="section-links"><a href="/platform">Ir al panorama <span aria-hidden="true">↗</span></a><a href="/chat">Abrir chat <span aria-hidden="true">↗</span></a><a href="/platform/docs">Documentación <span aria-hidden="true">↗</span></a></div></div></section>
${renderRelated(page)}
</div>
</main>`;
  const body = `${renderTopbar(page)}
${renderSidebar(page)}
<div class="nav-scrim" data-nav-close hidden></div>
${main}
${renderFooter()}`;
  return renderDocument({
    title: 'Página no encontrada',
    description: page.summary,
    bodyClass: 'platform-page group-workspace',
    dataPage: '404',
    cssHref: options.cssHref,
    jsHref: options.jsHref,
    body,
  });
}

export function renderChatDocument(options: {
  readonly cssHref: string;
  readonly chatJsHref: string;
  readonly cognitionJsHref: string;
  readonly html: string;
}): string {
  return options.html
    .replace(
      /(\/styles\/platform\.css)\?v=[^"']*/g,
      `$1?v=${encodeURIComponent(options.cssHref.split('?v=')[1] ?? '')}`
    )
    .replace(
      /(\/ui\/cognition-client\.js)\?v=[^"']*/g,
      `$1?v=${encodeURIComponent(options.cognitionJsHref.split('?v=')[1] ?? '')}`
    )
    .replace(
      /(\/ui\/platform-chat\.js)\?v=[^"']*/g,
      `$1?v=${encodeURIComponent(options.chatJsHref.split('?v=')[1] ?? '')}`
    );
}

export function platformAssetPaths(): { css: string; js: string; chatJs: string } {
  return { css: '/styles/platform.css', js: '/ui/platform.js', chatJs: '/ui/platform-chat.js' };
}

export function platformAssetHrefs(versions: { css: string; js: string; chatJs: string }): {
  cssHref: string;
  jsHref: string;
  chatJsHref: string;
} {
  return {
    cssHref: assetHref('/styles/platform.css', versions.css),
    jsHref: assetHref('/ui/platform.js', versions.js),
    chatJsHref: assetHref('/ui/platform-chat.js', versions.chatJs),
  };
}
