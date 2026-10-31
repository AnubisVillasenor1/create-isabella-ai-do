/* Isabella Platform — client surface. No inline scripts, no external dependencies. */
(() => {
  'use strict';

  const body = document.body;
  const pageId = body.dataset.page || 'overview';
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const SESSIONS_KEY = 'isabella.platform.chat.sessions.v1';
  const CHAT_SETTINGS_KEY = 'isabella.platform.chat.settings.v1';
  const PROFILE_KEY = 'isabella.platform.profile.v1';
  const LIBRARY_KEY = 'isabella.platform.library.v1';
  const VISITS_KEY = 'isabella.platform.visits.v1';
  const MAX_LIBRARY_ITEM = 160_000;
  const MAX_LIBRARY_TOTAL = 900_000;
  const MAX_LIBRARY_ITEMS = 24;

  const esc = (value) =>
    String(value ?? '').replace(
      /[&<>"']/g,
      (character) =>
        ({
          '&': '&amp;',
          '<': '&lt;',
          '>': '&gt;',
          '"': '&quot;',
          "'": '&#39;',
        })[character]
    );

  const asNumber = (value, fallback = 0) => {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  };

  const fmtNumber = (value) => {
    const number = asNumber(value);
    return new Intl.NumberFormat('es-MX').format(number);
  };

  const fmtMs = (value) => {
    const number = asNumber(value);
    return number > 0 ? `${number < 10 ? number.toFixed(1) : Math.round(number)} ms` : '0 ms';
  };

  const fmtBytes = (value) => {
    const bytes = asNumber(value);
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const fmtDate = (value) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '—';
    return date.toLocaleString('es-MX', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const shortHash = (value, length = 16) => {
    const text = String(value ?? '');
    return text.length > length ? `${text.slice(0, length)}…` : text || '—';
  };

  const readJson = (key, fallback) => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  };

  const writeJson = (key, value) => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch {
      return false;
    }
  };

  const removeKey = (key) => {
    try {
      localStorage.removeItem(key);
    } catch {
      /* storage can be unavailable in private mode; the UI states the failure. */
    }
  };

  const download = (filename, content, type = 'text/plain;charset=utf-8') => {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const fetchJson = async (path, timeoutMs = 9000) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(path, {
        headers: { accept: 'application/json' },
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    } finally {
      clearTimeout(timer);
    }
  };

  const settled = async (path) => {
    try {
      return { ok: true, data: await fetchJson(path) };
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : 'UNKNOWN' };
    }
  };

  const pill = (label, tone = '') =>
    `<span class="pill${tone ? ` is-${tone}` : ''}">${esc(label)}</span>`;

  const toneForRisk = (risk) => {
    const value = String(risk || '').toUpperCase();
    if (value === 'LOW') return 'ok';
    if (value === 'MEDIUM') return 'info';
    if (value === 'HIGH') return 'warn';
    if (value === 'CRITICAL') return 'bad';
    return '';
  };

  const stat = (label, value, sub = '', accent = false, small = false) => `
    <div class="stat-card${accent ? ' is-accent' : ''}">
      <span>${esc(label)}</span>
      <strong class="${small ? 'is-small' : ''}">${esc(value)}</strong>
      ${sub ? `<small>${esc(sub)}</small>` : ''}
    </div>`;

  const kvRow = (label, value) =>
    `<div class="kv-row"><dt>${esc(label)}</dt><dd>${esc(value)}</dd></div>`;

  const table = (headers, rows) => `
    <div class="data-table-wrap">
      <table class="data-table">
        <thead><tr>${headers.map((header) => `<th scope="col">${esc(header)}</th>`).join('')}</tr></thead>
        <tbody>${rows.length ? rows.map((row) => `<tr>${row.map((cell) => `<td>${cell}</td>`).join('')}</tr>`).join('') : `<tr><td colspan="${headers.length}">Sin datos disponibles.</td></tr>`}</tbody>
      </table>
    </div>`;

  const errorBlock = (message) =>
    `<div class="live-error"><strong>Lectura no disponible</strong>${esc(message)}. La página sigue siendo válida; el servicio puede estar degradado o requerir configuración.</div>`;

  const emptyBlock = (title, message) =>
    `<div class="live-empty"><strong>${esc(title)}</strong>${esc(message)}</div>`;

  /* ------------------------------------------------------------------ shell */

  const initNav = () => {
    const sidebar = $('#platform-nav');
    const scrim = $('[data-nav-close]');
    const opener = $('[data-nav-open]');
    if (!sidebar || !opener) return;
    const setOpen = (open) => {
      sidebar.classList.toggle('is-open', open);
      opener.setAttribute('aria-expanded', String(open));
      if (scrim) {
        scrim.hidden = !open;
        scrim.classList.toggle('is-visible', open);
      }
    };
    opener.addEventListener('click', () => setOpen(!sidebar.classList.contains('is-open')));
    scrim?.addEventListener('click', () => setOpen(false));
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && sidebar.classList.contains('is-open')) setOpen(false);
    });
  };

  const initReveal = () => {
    const nodes = $$('[data-reveal]');
    if (!('IntersectionObserver' in window)) {
      nodes.forEach((node) => node.classList.add('is-visible'));
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            observer.unobserve(entry.target);
          }
        });
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.08 }
    );
    nodes.forEach((node) => observer.observe(node));
  };

  const initCodeCopy = () => {
    $$('.blueprint-block').forEach((block) => {
      const header = $('header', block);
      const code = $('pre code', block);
      if (!header || !code) return;
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'icon-action';
      button.textContent = 'COPIAR';
      button.addEventListener('click', async () => {
        try {
          await navigator.clipboard.writeText(code.textContent || '');
          button.textContent = 'COPIADO';
          setTimeout(() => {
            button.textContent = 'COPIAR';
          }, 1600);
        } catch {
          button.textContent = 'COPIA MANUAL';
          setTimeout(() => {
            button.textContent = 'COPIAR';
          }, 1600);
        }
      });
      header.append(button);
    });
  };

  const initCommandPalette = () => {
    const dialog = $('#commandPalette');
    const input = $('#commandInput');
    const results = $('#commandResults');
    if (!dialog || !input || !results) return;

    const links = $$('[data-page-link]');
    const unique = new Map();
    links.forEach((link) => {
      const id = link.dataset.pageId;
      if (!id || unique.has(id)) return;
      unique.set(id, {
        id,
        href: link.getAttribute('href'),
        title: link.dataset.pageTitle || link.textContent.trim(),
        summary: link.dataset.pageSummary || '',
        keywords: `${link.dataset.pageKeywords || ''} ${link.textContent}`.toLowerCase(),
      });
    });
    const items = Array.from(unique.values());
    let activeIndex = 0;
    let filtered = items;

    const paint = () => {
      if (!filtered.length) {
        results.innerHTML =
          '<div class="command-empty">No hay coincidencias. Prueba con «chat», «gobernanza» o «api».</div>';
        return;
      }
      results.innerHTML = filtered
        .map(
          (item, index) => `
        <a class="command-result${index === activeIndex ? ' is-active' : ''}" href="${esc(item.href)}" role="option" aria-selected="${index === activeIndex ? 'true' : 'false'}" data-command-item>
          <span class="command-result-index">${String(index + 1).padStart(2, '0')}</span>
          <span class="command-result-copy"><strong>${esc(item.title)}</strong><small>${esc(item.summary)}</small></span>
          <span class="command-result-arrow" aria-hidden="true">→</span>
        </a>`
        )
        .join('');
      $$('[data-command-item]', results).forEach((node, index) => {
        node.addEventListener('mouseenter', () => {
          activeIndex = index;
          $$('[data-command-item]', results).forEach((item, itemIndex) => {
            item.classList.toggle('is-active', itemIndex === index);
          });
        });
      });
    };

    const filter = () => {
      const query = input.value.trim().toLowerCase();
      filtered = !query
        ? items
        : items.filter((item) =>
            `${item.title} ${item.summary} ${item.keywords}`.toLowerCase().includes(query)
          );
      activeIndex = 0;
      paint();
    };

    const open = () => {
      if (typeof dialog.showModal === 'function') {
        if (!dialog.open) dialog.showModal();
      } else {
        dialog.setAttribute('open', '');
      }
      input.value = '';
      filter();
      setTimeout(() => input.focus(), 30);
    };

    const close = () => {
      if (typeof dialog.close === 'function' && dialog.open) dialog.close();
      else dialog.removeAttribute('open');
    };

    $$('[data-command-open]').forEach((button) => button.addEventListener('click', open));
    dialog.addEventListener('click', (event) => {
      if (event.target === dialog) close();
    });
    input.addEventListener('input', filter);
    input.addEventListener('keydown', (event) => {
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        activeIndex = Math.min(filtered.length - 1, activeIndex + 1);
        paint();
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        activeIndex = Math.max(0, activeIndex - 1);
        paint();
      } else if (event.key === 'Enter') {
        const target = filtered[activeIndex];
        if (target) {
          event.preventDefault();
          window.location.href = target.href;
        }
      }
    });
    document.addEventListener('keydown', (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        open();
      }
      if (event.key === 'Escape' && dialog.open) close();
    });
  };

  const trackVisit = () => {
    const visits = readJson(VISITS_KEY, []);
    const list = Array.isArray(visits) ? visits.filter((item) => typeof item === 'string') : [];
    if (!list.includes(pageId)) list.push(pageId);
    writeJson(VISITS_KEY, list.slice(-60));
  };

  /* ------------------------------------------------------------------ shared local data */

  const readSessions = () => {
    const sessions = readJson(SESSIONS_KEY, []);
    if (!Array.isArray(sessions)) return [];
    return sessions.filter(
      (session) => session && typeof session.id === 'string' && Array.isArray(session.messages)
    );
  };

  const readLibrary = () => {
    const items = readJson(LIBRARY_KEY, []);
    if (!Array.isArray(items)) return [];
    return items.filter(
      (item) => item && typeof item.id === 'string' && typeof item.text === 'string'
    );
  };

  const readSettings = () => {
    const settings = readJson(CHAT_SETTINGS_KEY, {});
    return {
      engine: settings && settings.engine === 'sovereign' ? 'sovereign' : 'auto',
      lens:
        settings &&
        ['general', 'territorial', 'epistemic', 'security', 'governance'].includes(settings.lens)
          ? settings.lens
          : 'general',
      streaming: !settings || settings.streaming !== false,
      voice: Boolean(settings && settings.voice),
      reducedMotion: Boolean(settings && settings.reducedMotion),
    };
  };

  const writeSettings = (settings) => writeJson(CHAT_SETTINGS_KEY, settings);

  const readProfile = () => {
    const profile = readJson(PROFILE_KEY, {});
    return {
      name: typeof profile?.name === 'string' ? profile.name.slice(0, 60) : 'Visitante local',
      role:
        typeof profile?.role === 'string' ? profile.role.slice(0, 80) : 'Sesión sin cuenta remota',
    };
  };

  /* ------------------------------------------------------------------ overview */

  const loadOverview = async (root) => {
    const [health, turbo, native, agents, catalog] = await Promise.all([
      settled('/api/v1/health'),
      settled('/api/v1/hypercore/turbo/status'),
      settled('/api/v1/cognition/native-runtime'),
      settled('/api/v1/agents'),
      settled('/api/v1/platform/catalog'),
    ]);
    if (!health.ok && !turbo.ok && !native.ok) {
      root.innerHTML = errorBlock('No fue posible leer el estado público del nodo.');
      return;
    }
    const healthData = health.ok ? health.data : {};
    const turboData = turbo.ok ? turbo.data : {};
    const nativeData = native.ok ? native.data : {};
    const agentData = agents.ok ? agents.data : {};
    const catalogData = catalog.ok ? catalog.data : {};
    const latency = turboData?.metrics?.latencies?.['cognition.route.latency'] || {};
    const provider = nativeData?.provider || {};
    const planPages = asNumber(catalogData?.counts?.pages, 16);
    const agent = Array.isArray(agentData?.agents) ? agentData.agents[0] : null;
    root.innerHTML = `
      <div class="stat-grid">
        ${stat('NODO', healthData.node || 'Nodo Cero', healthData.app || 'Isabella Genesis')}
        ${stat('VERSIÓN', healthData.version || '—', healthData.inferenceMode || 'inferencia declarada')}
        ${stat('FAST LANE', turboData?.fastLane?.enabled ? 'ACTIVO' : 'NO DECLARADO', 'intenciones cortas y deterministas', true)}
        ${stat('P95 COGNICIÓN', fmtMs(latency.p95), `${fmtNumber(latency.count)} muestras locales`)}
        ${stat('AGENTE LOCAL', agent ? `${agent.tools?.length || 0} tools` : '—', 'sin modelo ni red', false, true)}
        ${stat('PÁGINAS', planPages, 'superficie multipágina', false, true)}
      </div>
      <div class="live-block">
        <h3>PROVEEDORES DECLARADOS</h3>
        <div class="pill-row">
          ${pill(`modelo ${provider.modelConfigured ? 'configurado' : 'no configurado'}`, provider.modelConfigured ? 'ok' : 'warn')}
          ${pill(`gratuito sin clave ${provider.keylessFreeProviderConfigured ? 'habilitado' : 'no habilitado'}`, provider.keylessFreeProviderConfigured ? 'ok' : '')}
          ${pill(`proveedor de pago ${provider.paidProviderConfigured ? 'presente' : 'ausente'}`, provider.paidProviderConfigured ? 'warn' : '')}
          ${pill(`ruta pública ${provider.publicRouteRequiresToken ? 'con token' : 'sin token'}`, provider.publicRouteRequiresToken ? 'info' : '')}
        </div>
      </div>
      <div class="live-grid-2">
        <div class="live-block">
          <h3>LATENCIAS LOCALES (MS)</h3>
          ${latencyBars(turboData)}
        </div>
        <div class="live-block">
          <h3>COMPUERTA DE PROVEEDORES</h3>
          <dl class="kv-list">
            ${kvRow('activos', turboData?.providerGate?.active ?? '—')}
            ${kvRow('en cola', turboData?.providerGate?.queued ?? '—')}
            ${kvRow('completados', turboData?.providerGate?.completed ?? '—')}
            ${kvRow('rechazados', turboData?.providerGate?.rejected ?? '—')}
            ${kvRow('espera media', fmtMs(turboData?.providerGate?.avgQueueWaitMs))}
          </dl>
        </div>
      </div>
      <div class="live-block">
        <h3>RUTAS DE ENTRADA</h3>
        <div class="pill-row">
          <a class="pill is-info" href="/chat">chat dedicado</a>
          <a class="pill" href="/platform/status">estado</a>
          <a class="pill" href="/platform/skills">skills</a>
          <a class="pill" href="/platform/tools">tools</a>
          <a class="pill" href="/platform/governance">gobernanza</a>
          <a class="pill" href="/platform/developers">api</a>
        </div>
      </div>`;
  };

  const latencyBars = (turboData) => {
    const latencies = turboData?.metrics?.latencies || {};
    const rows = Object.entries(latencies)
      .filter(([, value]) => value && asNumber(value.count) > 0)
      .sort(([, a], [, b]) => asNumber(b.p95) - asNumber(a.p95))
      .slice(0, 6);
    if (!rows.length)
      return '<p class="inspector-empty">Aún no hay muestras de latencia en este proceso.</p>';
    const max = Math.max(...rows.map(([, value]) => asNumber(value.p95)), 1);
    return `<div class="bar-list">${rows
      .map(
        ([name, value]) => `
      <div class="bar-row"><span title="${esc(name)}">${esc(name.split('.').slice(-2).join('.'))}</span><span class="bar-track"><span class="bar-fill" style="width:${Math.max(2, Math.round((asNumber(value.p95) / max) * 100))}%"></span></span><b>${fmtMs(value.p95)}</b></div>`
      )
      .join('')}</div>`;
  };

  /* ------------------------------------------------------------------ status */

  const loadStatus = async (root) => {
    const [health, readiness, turbo, native, meta] = await Promise.all([
      settled('/api/v1/health'),
      settled('/api/v1/healthz'),
      settled('/api/v1/hypercore/turbo/status'),
      settled('/api/v1/cognition/native-runtime'),
      settled('/api/v1/status'),
    ]);
    if (!health.ok && !readiness.ok && !turbo.ok) {
      root.innerHTML = errorBlock('El nodo no devolvió lecturas de salud.');
      return;
    }
    const healthData = health.ok ? health.data : {};
    const readinessData = readiness.ok ? readiness.data : {};
    const turboData = turbo.ok ? turbo.data : {};
    const nativeData = native.ok ? native.data : {};
    const metaData = meta.ok ? meta.data : {};
    const latency = turboData?.metrics?.latencies?.['cognition.route.latency'] || {};
    const provider = nativeData?.provider || {};
    const blockers = Array.isArray(readinessData.blockers) ? readinessData.blockers : [];
    const engines = metaData.engines || {};
    root.innerHTML = `
      <div class="stat-grid">
        ${stat('PROCESO', healthData.status || 'desconocido', healthData.app || 'Isabella Genesis')}
        ${stat('READINESS', readinessData.status || (readiness.ok ? '—' : 'NO LEÍDO'), readinessData.ready ? 'configuración mínima presente' : 'revisar bloqueos', Boolean(readinessData.ready))}
        ${stat('P95 COGNICIÓN', fmtMs(latency.p95), `${fmtNumber(latency.count)} muestras`, true)}
        ${stat('P99 COGNICIÓN', fmtMs(latency.p99), `máx ${fmtMs(latency.max)}`)}
        ${stat('COMPUERTA', `${asNumber(turboData?.providerGate?.active)} activos`, `${asNumber(turboData?.providerGate?.queued)} en cola`)}
        ${stat('BOOKPI', engines.bookpiDurability || engines.bookpi || '—', 'durabilidad declarada', false, true)}
      </div>
      <div class="live-grid-2">
        <div class="live-block">
          <h3>CONTADORES DE PROCESO</h3>
          <div class="pill-row">${counterPills(turboData)}</div>
        </div>
        <div class="live-block">
          <h3>PROVEEDORES</h3>
          <dl class="kv-list">
            ${kvRow('modelo configurado', provider.modelConfigured ? 'SÍ' : 'NO')}
            ${kvRow('modelo abierto', provider.openModelConfigured ? 'SÍ' : 'NO')}
            ${kvRow('gratuito sin clave', provider.keylessFreeProviderConfigured ? 'SÍ' : 'NO')}
            ${kvRow('proveedor de pago', provider.paidProviderConfigured ? 'PRESENTE' : 'AUSENTE')}
            ${kvRow('ruta pública con token', provider.publicRouteRequiresToken ? 'SÍ' : 'NO')}
          </dl>
        </div>
      </div>
      <div class="live-block">
        <h3>HISTOGRAMAS DE LATENCIA (MS)</h3>
        ${latencyTable(turboData)}
      </div>
      <div class="live-block">
        <h3>BLOQUEOS DE READINESS</h3>
        ${
          blockers.length
            ? `<div class="pill-row">${blockers
                .slice(0, 12)
                .map((blocker) =>
                  pill(
                    typeof blocker === 'string'
                      ? blocker
                      : blocker?.dependency || blocker?.reason || JSON.stringify(blocker),
                    'warn'
                  )
                )
                .join('')}</div>`
            : '<p class="inspector-empty">Sin bloqueos reportados por las comprobaciones de configuración e IO local.</p>'
        }
        <p class="inspector-note">Readiness por configuración y IO local; no prueba alcanzabilidad externa, cuota ni concurrencia distribuida.</p>
      </div>`;
  };

  const counterPills = (turboData) => {
    const counters = turboData?.metrics?.counters || {};
    const entries = Object.entries(counters).slice(0, 14);
    if (!entries.length) return '<span class="pill">sin contadores aún</span>';
    return entries.map(([name, value]) => pill(`${name} ${fmtNumber(value)}`)).join('');
  };

  const latencyTable = (turboData) => {
    const latencies = turboData?.metrics?.latencies || {};
    const rows = Object.entries(latencies).map(([name, value]) => [
      `<code>${esc(name)}</code>`,
      fmtNumber(value.count),
      fmtMs(value.p50),
      fmtMs(value.p90),
      fmtMs(value.p95),
      fmtMs(value.p99),
      fmtMs(value.max),
    ]);
    return table(['RUTA', 'N', 'P50', 'P90', 'P95', 'P99', 'MÁX'], rows);
  };

  /* ------------------------------------------------------------------ skills */

  const loadSkills = async (root) => {
    const result = await settled('/api/v1/hypercore/skills');
    if (!result.ok) {
      root.innerHTML = errorBlock('El registro de skills no está disponible en este proceso.');
      return;
    }
    const data = result.data || {};
    const skills = Array.isArray(data.skills) ? data.skills : [];
    const phases = Array.isArray(data.phases) ? data.phases : [];
    const rows = skills.map((skill) => [
      `<code>${esc(skill.id)}</code>`,
      esc(skill.version || '—'),
      pill(skill.riskTier || '—', toneForRisk(skill.riskTier)),
      `<span class="mono">${esc(Array.isArray(skill.scopes) && skill.scopes.length ? skill.scopes.join(' · ') : 'sin scopes')}</span>`,
      `<span class="mono">${esc(shortHash(skill.methodId, 26))}</span>`,
    ]);
    root.innerHTML = `
      <div class="stat-grid">
        ${stat('SKILLS', skills.length, 'registradas en este proceso', true, true)}
        ${stat('CONTRATO', data.contract || '—', 'versión del catálogo', false, true)}
        ${stat('FASES', phases.length, 'motor HyperCore', false, true)}
        ${stat('MANIFIESTO', shortHash(data.catalogManifest, 20), 'huella del registro', false, true)}
      </div>
      <div class="live-block">
        <h3>CATÁLOGO</h3>
        ${table(['SKILL', 'VERSIÓN', 'RIESGO', 'SCOPES', 'MÉTODO'], rows)}
      </div>
      ${
        phases.length
          ? `<div class="live-block"><h3>FASES DECLARADAS</h3><div class="pill-row">${phases
              .slice(0, 24)
              .map((phase) =>
                pill(
                  typeof phase === 'string'
                    ? phase
                    : phase?.name || phase?.id || JSON.stringify(phase)
                )
              )
              .join('')}</div></div>`
          : ''
      }`;
  };

  /* ------------------------------------------------------------------ agents */

  const loadAgents = async (root) => {
    const result = await settled('/api/v1/agents');
    if (!result.ok) {
      root.innerHTML = errorBlock('El catálogo del agente local no está disponible.');
      return;
    }
    const data = result.data || {};
    const agent = Array.isArray(data.agents) ? data.agents[0] : null;
    if (!agent) {
      root.innerHTML = emptyBlock(
        'Sin agente registrado',
        'Este proceso no expone un agente local.'
      );
      return;
    }
    const policy = data.executionPolicy || {};
    const tools = Array.isArray(agent.tools) ? agent.tools : [];
    const rows = tools.map((tool) => [
      `<code>${esc(tool.id)}</code>`,
      esc(tool.name || '—'),
      pill(
        tool.sideEffect || 'read',
        tool.sideEffect === 'write' ? 'warn' : tool.sideEffect === 'admin' ? 'bad' : 'ok'
      ),
      tool.requiresApproval ? pill('requiere aprobación', 'warn') : pill('sin aprobación', 'ok'),
      esc(tool.description || '—'),
    ]);
    root.innerHTML = `
      <div class="stat-grid">
        ${stat('AGENTE', agent.name || agent.id, agent.engine || 'local-deterministic', true, true)}
        ${stat('HERRAMIENTAS', tools.length, 'allowlisted', false, true)}
        ${stat('MODELO', policy.modelRequired ? 'REQUERIDO' : 'NO REQUERIDO', 'sin LLM', false, true)}
        ${stat('RED', policy.networkRequired ? 'REQUERIDA' : 'NO REQUERIDA', 'sin salida externa', false, true)}
      </div>
      <div class="live-block">
        <h3>HERRAMIENTAS REGISTRADAS</h3>
        ${table(['ID', 'NOMBRE', 'EFECTO', 'APROBACIÓN', 'DESCRIPCIÓN'], rows)}
      </div>
      <div class="live-grid-2">
        <div class="live-block">
          <h3>POLÍTICA DE EJECUCIÓN</h3>
          <dl class="kv-list">
            ${kvRow('motor', policy.engine || '—')}
            ${kvRow('gratuito', policy.free ? 'SÍ' : 'NO')}
            ${kvRow('efectos permitidos', Array.isArray(policy.allowedSideEffects) ? policy.allowedSideEffects.join(', ') : '—')}
            ${kvRow('aprobación para', Array.isArray(policy.approvalRequiredFor) ? policy.approvalRequiredFor.join(', ') : '—')}
            ${kvRow('memoria canónica', policy.canonicalMemoryMutation ? 'MUTA' : 'NO MUTA')}
          </dl>
        </div>
        <div class="live-block">
          <h3>CONTROL</h3>
          <p class="inspector-empty">${esc(agent.approval || 'La aprobación se decide en el servidor.')}</p>
          <div class="pill-row" style="margin-top:10px">
            <a class="pill is-info" href="/chat">probar en chat</a>
            <a class="pill" href="/api/v1/agents">ver JSON</a>
          </div>
        </div>
      </div>`;
  };

  /* ------------------------------------------------------------------ marketplace */

  const loadMarketplace = async (root) => {
    const result = await settled('/api/v1/marketplace');
    if (!result.ok) {
      root.innerHTML = errorBlock('El marketplace de solo lectura no está disponible.');
      return;
    }
    const data = result.data || {};
    const inventory = data.inventory || {};
    const kindCounts = data.kindCounts || {};
    const kindRows = Object.entries(kindCounts).map(([kind, count]) => [
      `<code>${esc(kind)}</code>`,
      fmtNumber(count),
    ]);
    root.innerHTML = `
      <div class="stat-grid">
        ${stat('CUSTOMIZACIONES', fmtNumber(inventory.customizations), 'registro vivo', true)}
        ${stat('SKILLS', fmtNumber(inventory.skills), 'capacidades declaradas')}
        ${stat('TOOLS', fmtNumber(inventory.tools), 'herramientas')}
        ${stat('MÓDULOS', fmtNumber(inventory.modules), 'composición')}
        ${stat('PROTOCOLOS', fmtNumber(inventory.protocols), 'contratos')}
        ${stat('CAPACIDADES', fmtNumber(inventory.capabilities), 'catálogo')}
      </div>
      <div class="live-grid-2">
        <div class="live-block">
          <h3>INVENTARIO POR TIPO</h3>
          ${table(['TIPO', 'CANTIDAD'], kindRows)}
        </div>
        <div class="live-block">
          <h3>CONTRATO DE SOLO LECTURA</h3>
          <dl class="kv-list">
            ${kvRow('método', data.methodId || '—')}
            ${kvRow('autorización', data.authorizationPerformed ? 'SÍ' : 'NO')}
            ${kvRow('ejecución', data.executionPerformed ? 'SÍ' : 'NO')}
            ${kvRow('digest', shortHash(data.digest, 30))}
            ${kvRow('customization digest', shortHash(data.customizationDigest, 30))}
          </dl>
          <p class="inspector-note">${esc(data.disclaimer || 'Resolver y planificar no autoriza, no instala y no ejecuta.')}</p>
        </div>
      </div>`;
  };

  /* ------------------------------------------------------------------ pricing */

  const loadPricing = async (root) => {
    const [plansResult, pricesResult] = await Promise.all([
      settled('/api/v1/billing/plans'),
      settled('/api/v1/billing/prices'),
    ]);
    if (!plansResult.ok) {
      root.innerHTML = errorBlock('El catálogo de planes no está disponible.');
      return;
    }
    const plans = Array.isArray(plansResult.data?.plans) ? plansResult.data.plans : [];
    const prices = Array.isArray(pricesResult.data?.prices) ? pricesResult.data.prices : [];
    const featureLabels = {
      offer: 'Ofertas',
      campaign: 'Campañas',
      landing: 'Landing',
      checkout: 'Checkout',
      lead_process: 'Leads',
      publish: 'Publicación',
      attribution: 'Atribución',
      analytics: 'Analítica',
      recommendations: 'Recomendaciones',
      funnel: 'Funnels',
      revenue_dashboard: 'Dashboard',
      affiliate: 'Afiliados',
      collect_payment: 'Cobros',
      marketplace: 'Marketplace',
      monetizable_automation: 'Automatización',
      multi_workspace: 'Multi-workspace',
      scheduled_automation: 'Programación',
      priority_review: 'Revisión prioritaria',
    };
    const planCards = plans
      .map((plan) => {
        const featured = plan.id === 'vip';
        const features = Array.isArray(plan.features) ? plan.features : [];
        const quotas = plan.quotas || {};
        const visibleFeatures = features.length ? features : ['exploración'];
        const price = prices.find((item) => item.planId === plan.id && item.interval === 'month');
        return `<article class="plan-card${featured ? ' is-featured' : ''}">
        <span>${esc(String(plan.id || '').toUpperCase())}${featured ? ' · DESTACADO' : ''}</span>
        <h3>${esc(plan.label || plan.id)}</h3>
        <p>${esc(plan.description || '')}</p>
        <ul>${visibleFeatures
          .slice(0, 9)
          .map((feature) => `<li>${esc(featureLabels[feature] || feature)}</li>`)
          .join('')}</ul>
        <dl>
          ${price ? `<dt>Mensual</dt><dd>${esc((price.unitAmount / 100).toLocaleString('es-MX', { style: 'currency', currency: 'USD' }))} ${esc(price.currency || '')}</dd>` : ''}
          <dt>Ofertas</dt><dd>${quotaLabel(quotas.active_offers)}</dd>
          <dt>Campañas</dt><dd>${quotaLabel(quotas.active_campaigns)}</dd>
          <dt>Leads/mes</dt><dd>${quotaLabel(quotas.leads_per_month)}</dd>
          <dt>Workspaces</dt><dd>${quotaLabel(quotas.workspaces)}</dd>
          <dt>Contrato</dt><dd>${plan.contract_required ? 'SÍ' : 'NO'}</dd>
        </dl>
      </article>`;
      })
      .join('');
    const paymentConfigured = prices.length > 0 && pricesResult.ok;
    root.innerHTML = `
      <div class="plan-grid">${planCards || emptyBlock('Sin planes', 'El servidor no devolvió planes.')}</div>
      <div class="live-grid-2" style="margin-top:12px">
        <div class="live-block">
          <h3>ESTADO DE COBRO</h3>
          <div class="pill-row">
            ${pill(paymentConfigured ? 'catálogo de precios disponible' : 'precios no disponibles', paymentConfigured ? 'ok' : 'warn')}
            ${pill('claves secretas: no expuestas', 'ok')}
            ${pill('checkout: requiere configuración del operador', 'info')}
          </div>
          <p class="inspector-note">La API pública devuelve precios y planes sin identificadores secretos de Stripe. La compra solo se habilita cuando el servidor tiene un procesador configurado.</p>
        </div>
        <div class="live-block">
          <h3>LISTA DE PRECIOS PÚBLICA</h3>
          ${
            prices.length
              ? `<dl class="kv-list">${prices
                  .slice(0, 8)
                  .map((price) =>
                    kvRow(
                      `${price.planId} · ${price.interval}`,
                      `${(price.unitAmount / 100).toLocaleString('es-MX', { style: 'currency', currency: 'USD' })}`
                    )
                  )
                  .join('')}</dl>`
              : '<p class="inspector-empty">Sin precios públicos en este proceso.</p>'
          }
        </div>
      </div>`;
  };

  const quotaLabel = (value) => {
    if (value === -1) return 'ILIMITADO';
    if (value === undefined || value === null) return '—';
    return fmtNumber(value);
  };

  /* ------------------------------------------------------------------ integrations */

  const loadIntegrations = async (root) => {
    const [native, health, readiness] = await Promise.all([
      settled('/api/v1/cognition/native-runtime'),
      settled('/api/v1/health'),
      settled('/api/v1/healthz'),
    ]);
    const nativeData = native.ok ? native.data : {};
    const provider = nativeData.provider || {};
    const hyper = nativeData.hyperTurbo || {};
    const moe = nativeData.nativeMoe || {};
    const readinessData = readiness.ok ? readiness.data : {};
    const blockers = Array.isArray(readinessData.blockers) ? readinessData.blockers : [];
    root.innerHTML = `
      <div class="stat-grid">
        ${stat('HYPER TURBO', hyper.status || '—', hyper.modelId || 'modelo declarado', true, true)}
        ${stat('EXPERTOS', fmtNumber(hyper.experts), 'ruta local MoE', false, true)}
        ${stat('MOE NATIVO', moe.title || moe.status || '—', moe.implementation || 'implementación', false, true)}
        ${stat('READINESS', readinessData.status || '—', readinessData.ready ? 'sin bloqueos' : 'revisar configuración', Boolean(readinessData.ready), true)}
      </div>
      <div class="live-block">
        <h3>SUPERFICIES DE INTEGRACIÓN</h3>
        ${table(
          ['SUPERFICIE', 'MÉTODO', 'AUTENTICACIÓN', 'ESTADO'],
          [
            [
              '<code>/api/v1/cognition/route</code>',
              'POST',
              'pública con rate limit',
              pill('wired', 'ok'),
            ],
            [
              '<code>/api/v1/cognition/stream</code>',
              'POST',
              'pública con rate limit',
              pill('wired', 'ok'),
            ],
            ['<code>/api/v1/agents</code>', 'GET', 'pública con rate limit', pill('wired', 'ok')],
            [
              '<code>/api/v1/hypercore/skills</code>',
              'GET',
              'pública con rate limit',
              pill('wired', 'ok'),
            ],
            [
              '<code>/api/v1/marketplace</code>',
              'GET',
              'pública con rate limit',
              pill('wired', 'ok'),
            ],
            ['<code>/api/v1/billing/plans</code>', 'GET', 'pública', pill('wired', 'ok')],
            [
              '<code>/v1/chat/completions</code>',
              'POST',
              'compatible OpenAI; token según despliegue',
              pill('condicional', 'info'),
            ],
            [
              '<code>/api/v1/billing/stripe/webhook</code>',
              'POST',
              'firma del proveedor',
              pill('condicional', 'info'),
            ],
          ]
        )}
      </div>
      <div class="live-grid-2">
        <div class="live-block">
          <h3>PROVEEDORES Y POLÍTICA</h3>
          <dl class="kv-list">
            ${kvRow('modelo configurado', provider.modelConfigured ? 'SÍ' : 'NO')}
            ${kvRow('modelo gratuito sin clave', provider.keylessFreeProviderConfigured ? 'SÍ' : 'NO')}
            ${kvRow('pago configurado', provider.paidProviderConfigured ? 'SÍ' : 'NO')}
            ${kvRow('ruta pública token', provider.publicRouteRequiresToken ? 'SÍ' : 'NO')}
            ${kvRow('transporte', nativeData?.realtime?.transport || 'http-json')}
          </dl>
          <p class="inspector-note">${esc(nativeData?.realtime?.note || 'La interfaz declara el motor real de cada respuesta.')}</p>
        </div>
        <div class="live-block">
          <h3>READINESS DECLARADO</h3>
          <p class="inspector-empty">${health.ok ? esc(health.data?.node || 'Nodo Cero') : 'Nodo no leído'} · ${health.ok ? esc(health.data?.version || '—') : '—'}</p>
          <div class="pill-row" style="margin-top:10px">
            ${
              blockers.length
                ? blockers
                    .slice(0, 8)
                    .map((blocker) =>
                      pill(
                        typeof blocker === 'string'
                          ? blocker
                          : blocker?.dependency || blocker?.reason || 'BLOQUEO',
                        'warn'
                      )
                    )
                    .join('')
                : pill('sin bloqueos reportados', 'ok')
            }
          </div>
          <div class="section-links" style="margin-top:14px"><a href="/platform/developers">Guía de API <span aria-hidden="true">↗</span></a><a href="/api/v1/healthz">Readiness JSON <span aria-hidden="true">↗</span></a></div>
        </div>
      </div>`;
  };

  /* ------------------------------------------------------------------ governance */

  const loadGovernance = async (root) => {
    const [meta, reina, readiness] = await Promise.all([
      settled('/api/v1/status'),
      settled('/api/v1/reina/status'),
      settled('/api/v1/healthz'),
    ]);
    const metaData = meta.ok ? meta.data : {};
    const engines = metaData.engines || {};
    const reinaData = reina.ok ? reina.data : {};
    const readinessData = readiness.ok ? readiness.data : {};
    const blockers = Array.isArray(readinessData.blockers) ? readinessData.blockers : [];
    root.innerHTML = `
      <div class="live-block">
        <h3>INVARIANTE DEL PROCESO</h3>
        <p class="mono" style="margin:0;font-size:11px;line-height:1.9;color:var(--crystal)">${esc(metaData.invariant || 'CAPABILITY ≠ AUTHORITY ≠ EXECUTION ≠ EVIDENCE ≠ LEARNING ≠ PRODUCTION')}</p>
      </div>
      <div class="stat-grid" style="margin-top:12px">
        ${stat('BOOKPI', engines.bookpi || '—', engines.bookpiDurability || 'durabilidad no declarada', true, true)}
        ${stat('CROWN', engines.crown || '—', 'policy decision point', false, true)}
        ${stat('AEGIS', engines.aegis || '—', 'superficie de riesgo', false, true)}
        ${stat('REINA', reinaData.state || '—', reinaData.name || 'adjudicación', false, true)}
        ${stat('READINESS', readinessData.status || '—', readinessData.ready ? 'sin bloqueos' : 'fail-closed', Boolean(readinessData.ready), true)}
        ${stat('REGISTRO', fmtNumber(reinaData.logSize), 'entradas del log', false, true)}
      </div>
      <div class="live-grid-2">
        <div class="live-block">
          <h3>MOTORES DECLARADOS</h3>
          <dl class="kv-list">
            ${kvRow('CROWN', engines.crown || '—')}
            ${kvRow('AEGIS', engines.aegis || '—')}
            ${kvRow('IKES', engines.ikes || '—')}
            ${kvRow('VERITAS', engines.veritas || '—')}
            ${kvRow('PDP', engines.pdp || '—')}
            ${kvRow('LITLE', engines.litleTrustFabric || '—')}
            ${kvRow('GEMINI', engines.geminiEngine || '—')}
          </dl>
        </div>
        <div class="live-block">
          <h3>LÍMITES DECLARADOS</h3>
          <p class="inspector-empty">${esc(Array.isArray(reinaData.disclaimers) ? reinaData.disclaimers.join(' ') : 'La adjudicación no ejecuta acciones.')}</p>
          <div class="pill-row" style="margin-top:10px">
            ${
              blockers.length
                ? blockers
                    .slice(0, 8)
                    .map((blocker) =>
                      pill(
                        typeof blocker === 'string' ? blocker : blocker?.dependency || 'BLOQUEO',
                        'warn'
                      )
                    )
                    .join('')
                : pill('sin bloqueos de configuración', 'ok')
            }
          </div>
        </div>
      </div>`;
  };

  /* ------------------------------------------------------------------ canon */

  const loadCanon = async (root) => {
    const result = await settled('/api/v1/platform/catalog');
    const canon = result.ok ? result.data?.canon : null;
    if (!canon || !Array.isArray(canon.implementations) || !canon.counts) {
      root.innerHTML = errorBlock('El catálogo no publicó el registro canónico.');
      return;
    }
    const maturityTone = (value) =>
      ({ verified: 'ok', implemented: 'info', partial: 'warn', specified: 'bad' })[value] || '';
    const counts = canon.maturity || {};
    const evidence = (entry) =>
      Array.isArray(entry.evidence) && entry.evidence.length
        ? entry.evidence
            .map((path) => `<span class="mono" style="font-size:10px">${esc(path)}</span>`)
            .join('<br>')
        : '<span class="inspector-empty">sin código localizado</span>';
    root.innerHTML = `
      <div class="stat-grid">
        ${stat('PILARES', fmtNumber(canon.counts.pillars), 'mandatos canónicos', true, true)}
        ${stat('IMPLEMENTACIONES ΩX', fmtNumber(canon.counts.implementations), 'contratos declarados', false, true)}
        ${stat('VERIFICADAS', fmtNumber(counts.verified), 'código + prueba local', false, true)}
        ${stat('ESPECIFICADAS', fmtNumber(counts.specified), 'sin código; no se simulan', false, true)}
      </div>
      <div class="live-grid-2">
        <div class="live-block">
          <h3>PILARES Ω</h3>
          <dl class="kv-list">
            ${canon.pillars.map((pillar) => kvRow(`${pillar.id} · ${pillar.title}`, pillar.mandate)).join('')}
          </dl>
        </div>
        <div class="live-block">
          <h3>MADUREZ DECLARADA</h3>
          <div class="pill-row">
            ${pill(`verified ${fmtNumber(counts.verified)}`, 'ok')}
            ${pill(`implemented ${fmtNumber(counts.implemented)}`, 'info')}
            ${pill(`partial ${fmtNumber(counts.partial)}`, 'warn')}
            ${pill(`specified ${fmtNumber(counts.specified)}`, 'bad')}
          </div>
          <dl class="kv-list" style="margin-top:12px">
            ${kvRow('canon', canon.canonical?.officialName || '—')}
            ${kvRow('generación', canon.canonical?.generation || '—')}
            ${kvRow('dominio', canon.canonical?.strategicDomain || '—')}
            ${kvRow('estado', canon.canonical?.status || '—')}
            ${kvRow('corte', canon.canonical?.asOf || '—')}
            ${kvRow('claim de producción', canon.canonical?.productionClaim ? 'SÍ' : 'NO')}
          </dl>
        </div>
      </div>
      <div class="live-block">
        <h3>${fmtNumber(canon.counts.implementations)} IMPLEMENTACIONES CANÓNICAS</h3>
        ${table(
          ['ID', 'CAPACIDAD', 'MADUREZ', 'EVIDENCIA LOCALIZADA'],
          canon.implementations.map((entry) => [
            `<span class="mono">${esc(entry.id)}</span>`,
            `<strong>${esc(entry.title)}</strong><br><small>${esc(entry.note || entry.summary)}</small>`,
            pill(entry.maturity, maturityTone(entry.maturity)),
            evidence(entry),
          ])
        )}
      </div>
      <div class="live-grid-2">
        <div class="live-block">
          <h3>CAPAS DE MEMORIA</h3>
          ${table(
            ['TIER', 'ALCANCE', 'MADUREZ'],
            canon.memoryTiers.map((tier) => [
              `<strong>${esc(tier.title)}</strong>`,
              esc(tier.scope),
              pill(tier.maturity, maturityTone(tier.maturity)),
            ])
          )}
        </div>
        <div class="live-block">
          <h3>ROSTER Y FEDERACIONES</h3>
          <div class="pill-row">${canon.agentRoster.map((agent) => pill(agent.role)).join('')}</div>
          <div class="pill-row" style="margin-top:10px">${canon.federations.map((federation) => pill(federation.name, 'info')).join('')}</div>
          <p class="inspector-note">${esc(canon.disclaimers?.[3] || 'El roster y las federaciones son objetivos arquitectónicos.')}</p>
        </div>
      </div>
      <div class="live-block">
        <h3>ALCANCE DEL CANON</h3>
        <p class="inspector-note">${(canon.disclaimers || []).map((item) => esc(item)).join(' ')}</p>
      </div>`;
  };

  /* ------------------------------------------------------------------ library */

  const loadLibrary = (root) => {
    const renderLibrary = () => {
      const items = readLibrary();
      const totalBytes = items.reduce((sum, item) => sum + asNumber(item.size), 0);
      const content = items.length
        ? `<div class="lib-list">${items
            .map(
              (item) => `
            <div class="lib-item" data-lib-id="${esc(item.id)}">
              <div class="lib-item-main">
                <strong>${esc(item.name)}</strong>
                <small>${fmtBytes(item.size)} · ${fmtDate(item.createdAt)} · local</small>
              </div>
              <div class="lib-item-actions">
                <button class="icon-action" type="button" data-lib-view="${esc(item.id)}">VER</button>
                <button class="icon-action" type="button" data-lib-copy="${esc(item.id)}">COPIAR</button>
                <button class="icon-action" type="button" data-lib-delete="${esc(item.id)}">BORRAR</button>
              </div>
            </div>`
            )
            .join('')}</div>`
        : emptyBlock(
            'Biblioteca vacía',
            'Importa un archivo de texto para conservarlo en este navegador.'
          );
      root.innerHTML = `
        <div class="stat-grid">
          ${stat('ARCHIVOS', items.length, `de ${MAX_LIBRARY_ITEMS}`, true, true)}
          ${stat('TAMAÑO', fmtBytes(totalBytes), `de ${fmtBytes(MAX_LIBRARY_TOTAL)}`)}
          ${stat('ALMACENAMIENTO', 'LOCALSTORAGE', 'sin sincronización', false, true)}
          ${stat('PRIVACIDAD', 'NAVEGADOR', 'sin carga remota', false, true)}
        </div>
        <div class="live-block">
          <label class="dropzone" data-lib-drop>
            <input id="libFile" type="file" multiple accept=".txt,.md,.csv,.json,.log,.yml,.yaml,.ts,.js,.css,.html" />
            <span>Selecciona o arrastra archivos de texto · máx. ${fmtBytes(MAX_LIBRARY_ITEM)} por archivo</span>
          </label>
          ${content}
          <div class="pill-row" style="margin-top:12px">
            <button class="pill" type="button" data-lib-export>EXPORTAR JSON</button>
            <button class="pill is-bad" type="button" data-lib-clear>BORRAR TODO</button>
          </div>
          <p class="inspector-note">Los archivos no se envían al servidor, no se indexan y no se convierten en memoria canónica. La cuota de localStorage puede variar por navegador.</p>
        </div>`;
      bindLibrary(root, renderLibrary);
    };
    renderLibrary();
  };

  const bindLibrary = (root, rerender) => {
    const input = $('#libFile', root);
    const drop = $('[data-lib-drop]', root);
    const ingest = async (files) => {
      const current = readLibrary();
      let total = current.reduce((sum, item) => sum + asNumber(item.size), 0);
      const accepted = [];
      for (const file of files) {
        if (file.size > MAX_LIBRARY_ITEM) continue;
        if (current.length + accepted.length >= MAX_LIBRARY_ITEMS) break;
        if (total + file.size > MAX_LIBRARY_TOTAL) break;
        try {
          const text = await file.text();
          if (text.includes('\u0000')) continue;
          accepted.push({
            id: `lib-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            name: file.name.slice(0, 120),
            size: file.size,
            type: file.type || 'text/plain',
            createdAt: new Date().toISOString(),
            text: text.slice(0, MAX_LIBRARY_ITEM),
          });
          total += file.size;
        } catch {
          /* an unreadable file is skipped; the remaining files are still allowed. */
        }
      }
      if (accepted.length) {
        writeJson(LIBRARY_KEY, [...accepted, ...current].slice(0, MAX_LIBRARY_ITEMS));
        rerender();
      }
    };
    input?.addEventListener('change', () => {
      ingest(Array.from(input.files || []));
      input.value = '';
    });
    drop?.addEventListener('dragover', (event) => {
      event.preventDefault();
      drop.classList.add('is-dragover');
    });
    drop?.addEventListener('dragleave', () => drop.classList.remove('is-dragover'));
    drop?.addEventListener('drop', (event) => {
      event.preventDefault();
      drop.classList.remove('is-dragover');
      ingest(Array.from(event.dataTransfer?.files || []));
    });
    root.querySelectorAll('[data-lib-view]').forEach((button) =>
      button.addEventListener('click', () => {
        const item = readLibrary().find((candidate) => candidate.id === button.dataset.libView);
        if (item) openLibraryViewer(item);
      })
    );
    root.querySelectorAll('[data-lib-copy]').forEach((button) =>
      button.addEventListener('click', async () => {
        const item = readLibrary().find((candidate) => candidate.id === button.dataset.libCopy);
        if (!item) return;
        try {
          await navigator.clipboard.writeText(item.text);
          button.textContent = 'COPIADO';
          setTimeout(() => {
            button.textContent = 'COPIAR';
          }, 1400);
        } catch {
          openLibraryViewer(item);
        }
      })
    );
    root.querySelectorAll('[data-lib-delete]').forEach((button) =>
      button.addEventListener('click', () => {
        const id = button.dataset.libDelete;
        writeJson(
          LIBRARY_KEY,
          readLibrary().filter((item) => item.id !== id)
        );
        rerender();
      })
    );
    $('[data-lib-export]', root)?.addEventListener('click', () => {
      download(
        'isabella-biblioteca.json',
        JSON.stringify(readLibrary(), null, 2),
        'application/json'
      );
    });
    $('[data-lib-clear]', root)?.addEventListener('click', () => {
      if (
        !window.confirm(
          '¿Borrar todos los archivos locales de la biblioteca? Esta acción no se puede deshacer.'
        )
      )
        return;
      removeKey(LIBRARY_KEY);
      rerender();
    });
  };

  const openLibraryViewer = (item) => {
    let dialog = $('#libViewer');
    if (!dialog) {
      dialog = document.createElement('dialog');
      dialog.id = 'libViewer';
      dialog.className = 'command-palette lib-viewer';
      dialog.innerHTML =
        '<div class="command-panel"><div class="command-head"><span class="command-mark" aria-hidden="true">◇</span><strong id="libViewerTitle" class="mono"></strong><button type="button" class="icon-action" data-lib-viewer-close>CERRAR</button></div><pre class="lib-viewer-text" id="libViewerText"></pre></div>';
      document.body.append(dialog);
      dialog.addEventListener('click', (event) => {
        if (event.target === dialog || event.target.closest('[data-lib-viewer-close]')) {
          if (typeof dialog.close === 'function') dialog.close();
          else dialog.removeAttribute('open');
        }
      });
    }
    $('#libViewerTitle', dialog).textContent = item.name;
    $('#libViewerText', dialog).textContent = item.text;
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else dialog.setAttribute('open', '');
  };

  /* ------------------------------------------------------------------ profile */

  const loadProfile = (root) => {
    const sessions = readSessions();
    const library = readLibrary();
    const profile = readProfile();
    const visits = readJson(VISITS_KEY, []);
    const visitList = Array.isArray(visits) ? visits : [];
    const allMessages = sessions.flatMap((session) => session.messages || []);
    const userMessages = allMessages.filter((message) => message.role === 'user');
    const hasMath = userMessages.some((message) =>
      /(?:calcula|calcular|cuánto es|cuanto es|resuelve)/i.test(String(message.content || ''))
    );
    const hasSummary = userMessages.some((message) =>
      /resume|resumen/i.test(String(message.content || ''))
    );
    const badges = [
      {
        id: 'first',
        title: 'Primer enlace',
        description: 'Iniciaste una conversación local.',
        unlocked: sessions.length > 0,
      },
      {
        id: 'explorer',
        title: 'Explorador',
        description: 'Visitaste al menos cinco superficies de la plataforma.',
        unlocked: new Set(visitList).size >= 5,
      },
      {
        id: 'librarian',
        title: 'Bibliotecario',
        description: 'Guardaste un archivo en la biblioteca local.',
        unlocked: library.length > 0,
      },
      {
        id: 'calculator',
        title: 'Calculista',
        description: 'Usaste el agente local para una operación aritmética.',
        unlocked: hasMath,
      },
      {
        id: 'summarizer',
        title: 'Sintetizador',
        description: 'Solicitaste un resumen extractivo.',
        unlocked: hasSummary,
      },
      {
        id: 'governance',
        title: 'Lector de gobernanza',
        description: 'Abriste la sección de gobernanza y evidencia.',
        unlocked: visitList.includes('governance'),
      },
      {
        id: 'steady',
        title: 'Constante',
        description: 'Acumulaste cinco conversaciones locales.',
        unlocked: sessions.length >= 5,
      },
    ];
    const initials =
      profile.name
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase() || '')
        .join('') || 'IS';
    const gallery = [
      ...library.slice(0, 4).map((item) => ({
        id: item.id,
        title: item.name,
        meta: `${fmtBytes(item.size)} · biblioteca`,
        href: '/platform/library',
      })),
      ...sessions.slice(0, 4).map((session) => ({
        id: session.id,
        title: session.title || 'Conversación',
        meta: `${(session.messages || []).length} mensajes · ${fmtDate(session.updatedAt)}`,
        href: `/chat?session=${encodeURIComponent(session.id)}`,
      })),
    ];
    root.innerHTML = `
      <div class="profile-head">
        <div class="profile-avatar" aria-hidden="true">${esc(initials)}</div>
        <div class="profile-copy">
          <span class="eyebrow">PERFIL LOCAL / SIN CUENTA REMOTA</span>
          <h3>${esc(profile.name)}</h3>
          <p>${esc(profile.role)} · ${fmtNumber(sessions.length)} conversaciones · ${fmtNumber(library.length)} archivos</p>
        </div>
        <div class="profile-score"><strong>${badges.filter((badge) => badge.unlocked).length}</strong><span>insignias locales</span></div>
      </div>
      <div class="live-grid-2">
        <div class="live-block">
          <h3>IDENTIDAD LOCAL</h3>
          <div class="field-grid">
            <label class="field"><span>Nombre visible</span><input id="profileName" maxlength="60" value="${esc(profile.name)}" /></label>
            <label class="field"><span>Rol o contexto</span><input id="profileRole" maxlength="80" value="${esc(profile.role)}" /></label>
          </div>
          <div class="pill-row" style="margin-top:10px">
            <button class="pill is-info" type="button" data-profile-save>GUARDAR PERFIL</button>
            <button class="pill" type="button" data-profile-export>EXPORTAR DATOS</button>
          </div>
          <p class="inspector-note">El perfil no se envía al servidor. No hay autenticación remota ni verificación de identidad en esta superficie.</p>
        </div>
        <div class="live-block">
          <h3>INSIGNIAS DE USO</h3>
          <div class="badge-grid">${badges.map((badge) => `<div class="badge-card${badge.unlocked ? '' : ' is-locked'}"><span>${badge.unlocked ? 'DESBLOQUEADA' : 'BLOQUEADA'}</span><strong>${esc(badge.title)}</strong><p>${esc(badge.description)}</p></div>`).join('')}</div>
        </div>
      </div>
      <div class="live-block">
        <h3>GALERÍA Y HISTORIAL RECIENTE</h3>
        ${gallery.length ? `<div class="related-grid">${gallery.map((item) => `<a class="related-card" href="${esc(item.href)}"><span>${esc(item.meta)}</span><strong>${esc(item.title)}</strong><p>Guardado localmente. Abre la superficie para ver el contenido.</p><b aria-hidden="true">→</b></a>`).join('')}</div>` : emptyBlock('Sin actividad todavía', 'Abre el chat o importa un archivo para comenzar tu historial local.')}
      </div>`;
    $('[data-profile-save]', root)?.addEventListener('click', () => {
      writeJson(PROFILE_KEY, {
        name:
          String($('#profileName', root)?.value || 'Visitante local')
            .trim()
            .slice(0, 60) || 'Visitante local',
        role:
          String($('#profileRole', root)?.value || 'Sesión sin cuenta remota')
            .trim()
            .slice(0, 80) || 'Sesión sin cuenta remota',
      });
      loadProfile(root);
    });
    $('[data-profile-export]', root)?.addEventListener('click', () => {
      download(
        'isabella-perfil-local.json',
        JSON.stringify(
          {
            profile: readProfile(),
            sessions: readSessions(),
            library: readLibrary(),
            visits: readJson(VISITS_KEY, []),
            exportedAt: new Date().toISOString(),
          },
          null,
          2
        ),
        'application/json'
      );
    });
  };

  /* ------------------------------------------------------------------ settings */

  const loadSettings = (root) => {
    const settings = readSettings();
    root.innerHTML = `
      <div class="live-grid-2">
        <div class="live-block">
          <h3>CONVERSACIÓN</h3>
          <div class="field-grid">
            <label class="field"><span>Motor por defecto</span><select id="settingEngine">
              <option value="auto"${settings.engine === 'auto' ? ' selected' : ''}>Auto · gratuito primero</option>
              <option value="sovereign"${settings.engine === 'sovereign' ? ' selected' : ''}>Soberano · sin proveedor externo</option>
            </select></label>
            <label class="field"><span>Lente de análisis</span><select id="settingLens">
              <option value="general"${settings.lens === 'general' ? ' selected' : ''}>General</option>
              <option value="territorial"${settings.lens === 'territorial' ? ' selected' : ''}>Territorial</option>
              <option value="epistemic"${settings.lens === 'epistemic' ? ' selected' : ''}>Epistémica</option>
              <option value="security"${settings.lens === 'security' ? ' selected' : ''}>Seguridad</option>
              <option value="governance"${settings.lens === 'governance' ? ' selected' : ''}>Gobernanza</option>
            </select></label>
          </div>
          <div class="toggle-row"><div class="toggle-copy"><strong>Entrega progresiva</strong><small>Recibe la respuesta por fragmentos SSE. Si se desactiva, se usa JSON.</small></div><label class="switch"><input id="settingStreaming" type="checkbox"${settings.streaming ? ' checked' : ''} aria-label="Activar entrega progresiva" /><i></i></label></div>
          <div class="toggle-row"><div class="toggle-copy"><strong>Lectura en voz alta</strong><small>Usa la voz del navegador. No envía audio a un servidor.</small></div><label class="switch"><input id="settingVoice" type="checkbox"${settings.voice ? ' checked' : ''} aria-label="Activar lectura en voz alta" /><i></i></label></div>
          <div class="toggle-row"><div class="toggle-copy"><strong>Reducir movimiento</strong><small>Desactiva animaciones decorativas en la plataforma.</small></div><label class="switch"><input id="settingMotion" type="checkbox"${settings.reducedMotion ? ' checked' : ''} aria-label="Reducir movimiento" /><i></i></label></div>
        </div>
        <div class="live-block">
          <h3>DATOS LOCALES</h3>
          <dl class="kv-list">
            ${kvRow('conversaciones', fmtNumber(readSessions().length))}
            ${kvRow('archivos', fmtNumber(readLibrary().length))}
            ${kvRow('páginas visitadas', fmtNumber((readJson(VISITS_KEY, []) || []).length))}
            ${kvRow('sincronización remota', 'NINGUNA')}
            ${kvRow('cuenta', 'LOCAL / SIN LOGIN')}
          </dl>
          <div class="pill-row" style="margin-top:12px">
            <button class="pill" type="button" data-clear-chat>BORRAR CONVERSACIONES</button>
            <button class="pill" type="button" data-clear-library>BORRAR BIBLIOTECA</button>
            <button class="pill is-bad" type="button" data-clear-all>BORRAR TODO</button>
          </div>
          <p class="inspector-note">Borrar los datos del sitio en el navegador produce el mismo efecto de forma irreversible.</p>
        </div>
      </div>`;
    const save = () => {
      writeSettings({
        engine: $('#settingEngine', root)?.value === 'sovereign' ? 'sovereign' : 'auto',
        lens: $('#settingLens', root)?.value || 'general',
        streaming: Boolean($('#settingStreaming', root)?.checked),
        voice: Boolean($('#settingVoice', root)?.checked),
        reducedMotion: Boolean($('#settingMotion', root)?.checked),
      });
      applyMotion(readSettings());
    };
    [
      '#settingEngine',
      '#settingLens',
      '#settingStreaming',
      '#settingVoice',
      '#settingMotion',
    ].forEach((selector) => {
      $(selector, root)?.addEventListener('change', save);
    });
    $('[data-clear-chat]', root)?.addEventListener('click', () => {
      if (!window.confirm('¿Borrar todas las conversaciones locales?')) return;
      removeKey(SESSIONS_KEY);
      loadSettings(root);
    });
    $('[data-clear-library]', root)?.addEventListener('click', () => {
      if (!window.confirm('¿Borrar todos los archivos de la biblioteca local?')) return;
      removeKey(LIBRARY_KEY);
      loadSettings(root);
    });
    $('[data-clear-all]', root)?.addEventListener('click', () => {
      if (
        !window.confirm(
          '¿Borrar conversaciones, biblioteca, perfil y preferencias de este navegador?'
        )
      )
        return;
      [SESSIONS_KEY, CHAT_SETTINGS_KEY, PROFILE_KEY, LIBRARY_KEY, VISITS_KEY].forEach(removeKey);
      loadSettings(root);
    });
  };

  const applyMotion = (settings) => {
    document.documentElement.classList.toggle('reduce-motion', Boolean(settings.reducedMotion));
  };

  /* ------------------------------------------------------------------ donations */

  const loadDonations = async (root) => {
    const plans = await settled('/api/v1/billing/plans');
    const configured = Boolean(plans.ok && Array.isArray(plans.data?.plans));
    root.innerHTML = `
      <div class="stat-grid">
        ${stat('CANAL DE PAGO', 'NO CONFIGURADO', 'esta página no procesa pagos', true, true)}
        ${stat('DATOS DE TARJETA', 'NO SE SOLICITAN', 'sin formularios de cobro', false, true)}
        ${stat('PLANES', configured ? fmtNumber(plans.data.plans.length) : '—', 'catálogo del servidor', false, true)}
        ${stat('TRANSPARENCIA', 'DECLARADA', 'sin promesas de retorno', false, true)}
      </div>
      <div class="live-grid-2">
        <div class="live-block">
          <h3>FORMAS DE APOYO</h3>
          <dl class="kv-list">
            ${kvRow('apoyo único', 'infraestructura y pruebas')}
            ${kvRow('apoyo mensual', 'mantenimiento del nodo')}
            ${kvRow('patrocinio', 'documentación y accesibilidad')}
            ${kvRow('canal habilitado', 'pendiente de configuración')}
          </dl>
          <p class="inspector-note">Cuando el operador configure un procesador, el canal y sus condiciones se publicarán aquí. Hasta entonces, no hay botón de cobro real.</p>
        </div>
        <div class="live-block">
          <h3>PRINCIPIOS</h3>
          <div class="pill-row">
            ${pill('sin pagos simulados', 'ok')}
            ${pill('sin datos de tarjeta en chat', 'ok')}
            ${pill('sin retorno financiero', 'info')}
            ${pill('sin presión de conversión', 'info')}
          </div>
          <div class="section-links" style="margin-top:12px"><a href="/platform/pricing">Ver planes <span aria-hidden="true">↗</span></a><a href="/platform/about">Acerca del proyecto <span aria-hidden="true">↗</span></a></div>
        </div>
      </div>`;
  };

  /* ------------------------------------------------------------------ mount */

  const mountLive = () => {
    const zone = $('[data-live]');
    if (!zone) return;
    const root = $('[data-live-content]', zone);
    if (!root) return;
    const loaders = {
      overview: loadOverview,
      status: loadStatus,
      skills: loadSkills,
      agents: loadAgents,
      marketplace: loadMarketplace,
      pricing: loadPricing,
      integrations: loadIntegrations,
      governance: loadGovernance,
      canon: loadCanon,
      library: loadLibrary,
      profile: loadProfile,
      settings: loadSettings,
      donations: loadDonations,
    };
    const loader = loaders[zone.dataset.live];
    if (!loader) return;
    const run = async () => {
      root.setAttribute('aria-busy', 'true');
      try {
        await loader(root);
      } catch (error) {
        root.innerHTML = errorBlock(
          error instanceof Error ? error.message : 'Error inesperado al leer la superficie.'
        );
      } finally {
        root.setAttribute('aria-busy', 'false');
      }
    };
    run();
    $('[data-live-refresh]', zone)?.addEventListener('click', run);
  };

  initNav();
  initReveal();
  initCodeCopy();
  initCommandPalette();
  applyMotion(readSettings());
  trackVisit();
  mountLive();
})();
