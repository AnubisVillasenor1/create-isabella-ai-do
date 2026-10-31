/*
 * Nexus client — floating matrix rails and the federation console.
 *
 * Everything here talks to this node's own /api/v1 surface. The operator token
 * lives in sessionStorage only, never in the DOM log, and API-key secrets are
 * shown exactly once. Rendering uses DOM nodes and textContent, never innerHTML.
 */
(() => {
  'use strict';

  const byId = (id) => document.getElementById(id);
  const reduceMotion =
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const TAB_TARGETS = Object.freeze({
    workbench: 'nexusTabWorkbench',
    connectors: 'nexusTabConnectors',
    keys: 'nexusTabKeys',
    catalog: 'nexusTabCatalog',
    runtime: 'nexusTabRuntime',
    spatial: 'nexusTabSpatial',
  });
  const TOKEN_KEY = 'isabella.nexus.adminToken';
  const METHOD_SET = new Set(['get', 'post', 'put', 'patch', 'delete']);
  const MAX_RESPONSE_CHARS = 200_000;
  const AUDIO_PAYLOAD = /^data:audio\/(?:mpeg|mp3|wav);base64,/;
  const GLYPHS = 'アイウエオカキクケコサシスセソタチツテトナニヌネノ0123456789ISABELLA<>/{}[]';

  let adminToken = '';
  let activeTab = 'workbench';
  let catalogLoaded = false;
  let runtimeLoaded = false;
  let spatialDetected = false;
  let spatialMode = false;
  let xrAvailable = false;
  let lastResponseText = '';
  let probeAudio = null;

  const el = (tag, className, label) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (label !== undefined && label !== null) node.textContent = String(label);
    return node;
  };

  const setText = (node, value) => {
    if (node) node.textContent = value === undefined || value === null ? '' : String(value);
  };

  const display = (value, fallback = '—') =>
    value === undefined || value === null || value === '' ? fallback : String(value);

  const formatDate = (value) => {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return date.toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' });
  };

  const flash = (button, message) => {
    if (!button) return;
    if (!button.dataset.originalLabel) button.dataset.originalLabel = button.textContent || '';
    button.textContent = message;
    window.setTimeout(() => {
      button.textContent = button.dataset.originalLabel || '';
    }, 1_400);
  };

  async function copyText(value) {
    const payload = String(value || '');
    if (!payload) return false;
    try {
      if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
        await navigator.clipboard.writeText(payload);
        return true;
      }
    } catch {
      /* fall through to the legacy path */
    }
    try {
      const area = el('textarea');
      area.value = payload;
      area.setAttribute('readonly', '');
      area.style.position = 'fixed';
      area.style.opacity = '0';
      document.body.append(area);
      area.select();
      const copied = document.execCommand('copy');
      area.remove();
      return copied;
    } catch {
      return false;
    }
  }

  function setChip(id, message, state) {
    const chip = byId(id);
    if (!chip) return;
    const dot = el('i');
    dot.setAttribute('aria-hidden', 'true');
    chip.replaceChildren(dot, document.createTextNode(message));
    if (state) chip.dataset.state = state;
    else delete chip.dataset.state;
  }

  function renderNote(container, message) {
    if (!container) return;
    container.replaceChildren(el('p', 'nexus-empty', message));
  }

  function formStatus(form, message, state) {
    if (!form) return null;
    let node = form.querySelector('.nexus-form-status');
    if (!node) {
      node = el('p', 'nexus-foot nexus-form-status');
      node.setAttribute('role', 'status');
      node.setAttribute('aria-live', 'polite');
      form.append(node);
    }
    node.textContent = message || '';
    if (state) node.dataset.state = state;
    else delete node.dataset.state;
    return node;
  }

  async function runBusy(form, task) {
    const button = form ? form.querySelector('button[type="submit"]') : null;
    if (button) button.disabled = true;
    try {
      await task();
    } finally {
      if (button) button.disabled = false;
    }
  }

  async function timedFetch(path, init) {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 20_000);
    const started = performance.now();
    try {
      const response = await fetch(path, {
        credentials: 'same-origin',
        ...(init || {}),
        signal: controller.signal,
      });
      const raw = await response.text();
      let json = null;
      if (raw) {
        try {
          json = JSON.parse(raw);
        } catch {
          json = null;
        }
      }
      return { response, json, raw, ms: Math.round(performance.now() - started) };
    } finally {
      window.clearTimeout(timer);
    }
  }

  function describeFailure(result) {
    if (!result || !result.response) return 'Sin respuesta del nodo.';
    const status = result.response.status;
    if (status === 401) return 'Token de operador ausente o rechazado.';
    if (status === 403) return 'El token no autoriza esta operación.';
    if (status === 404) return 'El recurso no existe en este nodo.';
    if (status === 429) return 'Límite de solicitudes alcanzado; espera un momento.';
    const code = result.json && result.json.error;
    if (code) return String(code);
    return `HTTP ${status}`;
  }

  const adminHeaders = () => (adminToken ? { authorization: `Bearer ${adminToken}` } : {});

  async function adminFetch(path, init) {
    if (!adminToken) throw new Error('ADMIN_TOKEN_REQUIRED');
    const options = init || {};
    const headers = { accept: 'application/json', ...adminHeaders(), ...(options.headers || {}) };
    return timedFetch(path, { ...options, headers });
  }

  /* ------------------------------------------------------- rail matrix rain */
  class RailMatrix {
    constructor(canvas) {
      this.canvas = canvas;
      this.rail = canvas.closest('.side-rail');
      this.context = canvas.getContext('2d', { alpha: true });
      this.width = 0;
      this.height = 0;
      this.columnSize = 13;
      this.drops = [];
      this.intensity = 0;
      this.target = 0;
      this.running = false;
      this.frame = 0;
      this.last = 0;
      this.tick = this.tick.bind(this);
      if (!this.context) return;
      if (typeof ResizeObserver === 'function') {
        this.observer = new ResizeObserver(() => {
          this.resize();
          if (!this.running) this.paint();
        });
        this.observer.observe(this.rail || canvas);
      } else {
        window.addEventListener('resize', () => this.resize());
      }
      this.resize();
    }

    resize() {
      if (!this.context) return;
      const host = this.rail || this.canvas;
      const rect = host.getBoundingClientRect();
      const width = Math.max(1, Math.round(rect.width));
      const height = Math.max(1, Math.round(rect.height));
      if (width === this.width && height === this.height && this.drops.length) return;
      this.width = width;
      this.height = height;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      this.canvas.width = Math.round(width * dpr);
      this.canvas.height = Math.round(height * dpr);
      this.context.setTransform(dpr, 0, 0, dpr, 0, 0);
      const columns = Math.max(1, Math.floor(width / this.columnSize));
      this.drops = Array.from(
        { length: columns },
        () => Math.random() * -(height / this.columnSize) * 1.4
      );
    }

    open() {
      this.target = 1;
      if (this.rail) this.rail.classList.add('is-matrix');
      this.start();
    }

    close() {
      this.target = 0;
      if (this.rail) this.rail.classList.remove('is-matrix');
      if (this.intensity > 0.02 || this.running) this.start();
      else this.paint();
    }

    start() {
      if (!this.context) return;
      if (reduceMotion) {
        this.intensity = this.target;
        this.paint();
        return;
      }
      if (this.running) return;
      this.running = true;
      this.last = performance.now();
      this.frame = window.requestAnimationFrame(this.tick);
    }

    tick(now) {
      if (!this.running || !this.context) return;
      this.frame = window.requestAnimationFrame(this.tick);
      if (now - this.last < 33) return;
      const step = Math.min(48, now - this.last) / 16.67;
      this.last = now;
      this.intensity += (this.target - this.intensity) * 0.18;
      if (this.intensity < 0.02 && this.target === 0) {
        this.intensity = 0;
        this.running = false;
        this.context.clearRect(0, 0, this.width, this.height);
        return;
      }
      this.paint(step);
    }

    paint(step = 1) {
      const context = this.context;
      if (!context) return;
      context.clearRect(0, 0, this.width, this.height);
      const alpha = this.intensity;
      if (alpha <= 0.01) return;
      context.font = `${this.columnSize - 2}px ui-monospace, monospace`;
      for (let index = 0; index < this.drops.length; index += 1) {
        if (Math.random() > 0.82) continue;
        const x = index * this.columnSize + 3;
        const y = this.drops[index] * this.columnSize;
        const palette =
          index % 3 === 0 ? '201,184,255' : index % 3 === 1 ? '169,245,208' : '159,247,255';
        context.fillStyle = `rgba(${palette},${(0.18 + Math.random() * 0.4) * alpha})`;
        context.fillText(GLYPHS[Math.floor(Math.random() * GLYPHS.length)], x, y);
        if (this.drops[index] > 2) {
          context.fillStyle = `rgba(${palette},${0.08 * alpha})`;
          context.fillText(
            GLYPHS[Math.floor(Math.random() * GLYPHS.length)],
            x,
            y - this.columnSize
          );
        }
        if (!reduceMotion) this.drops[index] += (0.16 + Math.random() * 0.36) * step;
        if (y > this.height + 40) this.drops[index] = Math.random() * -8;
      }
    }
  }

  function closeRails() {
    document.querySelectorAll('.side-rail').forEach((rail) => {
      rail.classList.remove('is-open');
      rail.setAttribute('aria-hidden', 'true');
      rail.setAttribute('inert', '');
      const launcher = document.querySelector(`[aria-controls="${rail.id}"]`);
      if (launcher) {
        launcher.setAttribute('aria-expanded', 'false');
        launcher.classList.remove('is-latched');
      }
    });
  }

  function mountRails() {
    const rails = [...document.querySelectorAll('.side-rail[data-rail]')];
    rails.forEach((rail) => {
      const canvas = rail.querySelector('[data-rail-matrix]');
      const matrix =
        canvas && typeof canvas.getContext === 'function' ? new RailMatrix(canvas) : null;
      const launcher = document.querySelector(`[aria-controls="${rail.id}"]`);
      const sync = () => {
        const open = rail.classList.contains('is-open');
        if (open) {
          if (matrix) matrix.open();
          if (launcher) launcher.classList.add('is-latched');
        } else {
          if (matrix) matrix.close();
          if (launcher) launcher.classList.remove('is-latched');
        }
        rail.setAttribute('aria-hidden', String(!open));
        if (open) rail.removeAttribute('inert');
        else rail.setAttribute('inert', '');
        if (launcher) launcher.setAttribute('aria-expanded', String(open));
      };
      if (typeof MutationObserver === 'function') {
        new MutationObserver(sync).observe(rail, {
          attributes: true,
          attributeFilter: ['class'],
        });
      }
      sync();
    });

    document.querySelectorAll('[data-rail-close]').forEach((button) => {
      button.addEventListener('click', () => {
        const rail = byId(button.dataset.railClose || '');
        if (!rail) return;
        closeRails();
        const launcher = document.querySelector(`[aria-controls="${rail.id}"]`);
        if (launcher && typeof launcher.focus === 'function') {
          launcher.focus({ preventScroll: true });
        }
      });
    });

    document.addEventListener('keydown', (event) => {
      if (event.key !== 'Escape') return;
      const open = [...document.querySelectorAll('.side-rail.is-open')][0];
      if (!open) return;
      closeRails();
      const launcher = document.querySelector(`[aria-controls="${open.id}"]`);
      if (launcher && typeof launcher.focus === 'function') {
        launcher.focus({ preventScroll: true });
      }
    });

    const launchers = [...document.querySelectorAll('.rail-launcher')];
    document.addEventListener('keydown', (event) => {
      if (!event.altKey || event.ctrlKey || event.metaKey) return;
      const index = Number(event.key) - 1;
      if (!Number.isInteger(index) || index < 0 || index >= launchers.length) return;
      event.preventDefault();
      launchers[index].click();
    });

    document.querySelectorAll('[data-nexus-focus]').forEach((link) => {
      link.addEventListener('click', (event) => {
        const target = link.dataset.nexusFocus;
        if (!target) return;
        event.preventDefault();
        closeRails();
        activateTab(target);
        const section = byId('nexus');
        if (section) {
          section.scrollIntoView({
            behavior: reduceMotion ? 'auto' : 'smooth',
            block: 'start',
          });
        }
      });
    });
  }

  function mountSectionTracking() {
    if (typeof IntersectionObserver !== 'function') return;
    const links = [...document.querySelectorAll('.side-rail a[href^="#"]')];
    if (!links.length) return;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const hash = `#${entry.target.id}`;
          links.forEach((link) => {
            const active = link.getAttribute('href') === hash;
            link.classList.toggle('is-current', active);
            if (active) link.setAttribute('aria-current', 'location');
            else link.removeAttribute('aria-current');
          });
        });
      },
      { rootMargin: '-42% 0px -50% 0px' }
    );
    document.querySelectorAll('main section[id]').forEach((section) => observer.observe(section));
  }

  /* ------------------------------------------------------------ nexus tabs */
  const tabButtons = [...document.querySelectorAll('.nexus-tab')];
  const tabPanels = new Map();
  tabButtons.forEach((tab) => {
    const panel = byId(tab.getAttribute('aria-controls') || '');
    if (panel) tabPanels.set(tab.id, panel);
  });

  function activateTab(name) {
    let key = 'workbench';
    if (name && TAB_TARGETS[name]) key = name;
    else if (name) {
      const match = Object.keys(TAB_TARGETS).find((entry) => TAB_TARGETS[entry] === name);
      if (match) key = match;
    }
    const target = byId(TAB_TARGETS[key]);
    if (!target) return;
    activeTab = key;
    tabButtons.forEach((tab) => {
      const active = tab === target;
      tab.classList.toggle('is-active', active);
      tab.setAttribute('aria-selected', String(active));
      tab.tabIndex = active ? 0 : -1;
      const panel = tabPanels.get(tab.id);
      if (panel) {
        panel.classList.toggle('is-active', active);
        panel.hidden = !active;
      }
    });
    if (key === 'connectors' && adminToken) {
      void refreshConnectors();
      void refreshInbox();
    }
    if (key === 'keys' && adminToken) void refreshKeys();
    if (key === 'catalog') void refreshCatalog();
    if (key === 'runtime') void refreshRuntime();
    if (key === 'spatial') void detectSpatial();
  }

  function mountTabs() {
    tabButtons.forEach((tab, index) => {
      tab.addEventListener('click', () => activateTab(tab.id));
      tab.addEventListener('keydown', (event) => {
        let next = null;
        if (event.key === 'ArrowRight') next = tabButtons[(index + 1) % tabButtons.length];
        else if (event.key === 'ArrowLeft')
          next = tabButtons[(index - 1 + tabButtons.length) % tabButtons.length];
        else if (event.key === 'Home') next = tabButtons[0];
        else if (event.key === 'End') next = tabButtons[tabButtons.length - 1];
        if (!next) return;
        event.preventDefault();
        activateTab(next.id);
        next.focus();
      });
    });
  }

  /* ------------------------------------------------------------ operator token */
  const tokenInput = byId('nexusAdminToken');
  try {
    adminToken = sessionStorage.getItem(TOKEN_KEY) || '';
  } catch {
    adminToken = '';
  }
  if (tokenInput && adminToken) tokenInput.value = adminToken;
  if (tokenInput) {
    tokenInput.addEventListener('input', () => {
      adminToken = tokenInput.value.trim();
      try {
        if (adminToken) sessionStorage.setItem(TOKEN_KEY, adminToken);
        else sessionStorage.removeItem(TOKEN_KEY);
      } catch {
        /* sessionStorage can be unavailable in hardened browsers */
      }
    });
    tokenInput.addEventListener('change', () => {
      if (!adminToken) return;
      if (activeTab === 'connectors') {
        void refreshConnectors();
        void refreshInbox();
      }
      if (activeTab === 'keys') void refreshKeys();
    });
  }

  /* ------------------------------------------------------------- workbench */
  function safeApiPath(value) {
    if (!value.startsWith('/api/v1/')) return false;
    if (value.startsWith('/api/v1//')) return false;
    if (value.includes('..')) return false;
    return !/[\s"'<>\\]/.test(value);
  }

  function setResponse(status, meta, body, state) {
    const card = document.querySelector('.nexus-response');
    if (card) card.dataset.state = state || '';
    setText(byId('nexusResponseStatus'), status);
    setText(byId('nexusResponseMeta'), meta);
    setText(byId('nexusResponseBody'), body);
  }

  async function runWorkbench() {
    const method = (byId('nexusMethod') ? byId('nexusMethod').value : 'GET').toUpperCase();
    const pathInput = byId('nexusPath');
    const path = (pathInput ? pathInput.value : '').trim();
    if (!safeApiPath(path)) {
      setResponse(
        'RUTA INVÁLIDA',
        'Solo rutas internas /api/v1/*',
        'La ruta debe empezar por /api/v1/. No se permiten URLs externas, espacios ni saltos de directorio.',
        'error'
      );
      return;
    }
    if (path.startsWith('/api/v1/admin/') && !adminToken) {
      setResponse(
        'TOKEN REQUERIDO',
        'Ruta de operador',
        'Introduce el token de operador para ejecutar rutas /api/v1/admin/*. El token solo vive en esta pestaña.',
        'error'
      );
      return;
    }
    const bodyField = byId('nexusBody');
    const rawBody = bodyField ? bodyField.value.trim() : '';
    let body;
    if (method !== 'GET' && rawBody) {
      try {
        body = JSON.parse(rawBody);
      } catch {
        setResponse(
          'JSON INVÁLIDO',
          'El cuerpo no se envió',
          'Corrige el JSON del cuerpo.',
          'error'
        );
        return;
      }
    }
    const apiKeyField = byId('nexusApiKey');
    const apiKey = apiKeyField ? apiKeyField.value.trim() : '';
    const headers = { accept: 'application/json' };
    if (method !== 'GET') headers['content-type'] = 'application/json';
    if (path.startsWith('/api/v1/admin/')) headers.authorization = `Bearer ${adminToken}`;
    else if (apiKey) headers['x-isabella-api-key'] = apiKey;
    else if (adminToken) headers.authorization = `Bearer ${adminToken}`;
    setResponse('EJECUTANDO…', 'Petición en curso', 'Esperando respuesta del nodo…', 'busy');
    try {
      const result = await timedFetch(path, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      const rendered = result.json === null ? result.raw : JSON.stringify(result.json, null, 2);
      const truncated =
        rendered.length > MAX_RESPONSE_CHARS
          ? `${rendered.slice(0, MAX_RESPONSE_CHARS)}\n… (truncado)`
          : rendered;
      lastResponseText = rendered;
      setResponse(
        `${result.response.status} ${result.response.statusText || ''}`.trim(),
        `${result.ms} ms · ${rendered.length} chars`,
        truncated || '(sin contenido)',
        result.response.ok ? 'ok' : 'error'
      );
    } catch (error) {
      setResponse(
        error && error.name === 'AbortError' ? 'TIEMPO AGOTADO' : 'SIN CONEXIÓN',
        'La petición no completó',
        'El nodo no respondió dentro del límite de 20 segundos.',
        'error'
      );
    }
  }

  function loadEndpoint(method, path) {
    activateTab('workbench');
    const methodField = byId('nexusMethod');
    const pathField = byId('nexusPath');
    if (methodField) methodField.value = method.toUpperCase();
    if (pathField) {
      pathField.value = path;
      pathField.focus({ preventScroll: true });
      if (typeof pathField.select === 'function') pathField.select();
    }
    setResponse(
      'CARGADO',
      `${method.toUpperCase()} ${path}`,
      'Revisa la ruta, ajusta el cuerpo si hace falta y pulsa EJECUTAR.',
      ''
    );
  }

  function mountWorkbench() {
    const form = byId('nexusRequestForm');
    if (form) {
      form.addEventListener('submit', (event) => {
        event.preventDefault();
        void runWorkbench();
      });
    }
    const copy = byId('nexusCopyResponse');
    if (copy) {
      copy.addEventListener('click', async () => {
        const body = byId('nexusResponseBody');
        const value = lastResponseText || (body ? body.textContent : '') || '';
        const copied = await copyText(value);
        flash(copy, copied ? 'COPIADO' : 'ERROR');
      });
    }
  }

  /* ------------------------------------------------------------- connectors */
  function renderConnectorRows(items) {
    const list = byId('nexusConnectorList');
    if (!list) return;
    list.replaceChildren();
    if (!items.length) {
      list.append(
        el(
          'p',
          'nexus-empty',
          'No hay conectores registrados. Registra uno para obtener su ruta firmada.'
        )
      );
      return;
    }
    items.forEach((item) => {
      const row = el('div', 'nexus-row');
      const top = el('div', 'nexus-row-top');
      top.append(
        el('strong', null, display(item.name, item.id)),
        el('span', 'nexus-tag', display(item.kind, 'webhook').toUpperCase())
      );
      const meta = el(
        'p',
        null,
        `ID ${display(item.id)} · creado ${formatDate(item.createdAt)} · ${display(
          item.targetUrl,
          'sin target'
        )}`
      );
      const path = `/api/v1/federation/webhooks/${item.id}`;
      const code = el('code', null, path);
      const actions = el('div', 'nexus-row-actions');
      const copy = el('button', 'nexus-mini', 'COPIAR WEBHOOK');
      copy.type = 'button';
      copy.dataset.copy = `${window.location.origin}${path}`;
      const remove = el('button', 'nexus-mini is-danger', 'ELIMINAR');
      remove.type = 'button';
      remove.dataset.removeConnector = item.id;
      actions.append(copy, remove);
      row.append(top, meta, code, actions);
      list.append(row);
    });
  }

  async function refreshConnectors() {
    const list = byId('nexusConnectorList');
    if (!list) return;
    if (!adminToken) {
      renderNote(list, 'Introduce el token de operador para listar conectores.');
      return;
    }
    renderNote(list, 'Consultando conectores…');
    try {
      const result = await adminFetch('/api/v1/federation/connectors');
      if (!result.response.ok) {
        renderNote(list, describeFailure(result));
        return;
      }
      const connectors =
        result.json && Array.isArray(result.json.connectors) ? result.json.connectors : [];
      renderConnectorRows(connectors);
    } catch {
      renderNote(list, 'No fue posible consultar los conectores.');
    }
  }

  async function refreshInbox() {
    const list = byId('nexusInboxList');
    if (!list) return;
    if (!adminToken) {
      renderNote(list, 'Introduce el token de operador para leer el inbox firmado.');
      return;
    }
    renderNote(list, 'Consultando inbox…');
    try {
      const result = await adminFetch('/api/v1/federation/inbox?limit=50');
      if (!result.response.ok) {
        renderNote(list, describeFailure(result));
        return;
      }
      const entries = result.json && Array.isArray(result.json.entries) ? result.json.entries : [];
      list.replaceChildren();
      if (!entries.length) {
        list.append(
          el(
            'p',
            'nexus-empty',
            'El inbox está vacío. Los webhooks firmados aparecerán aquí sin ejecutar acciones.'
          )
        );
        return;
      }
      entries.forEach((entry) => {
        const row = el('div', 'nexus-row');
        const top = el('div', 'nexus-row-top');
        top.append(
          el('strong', null, display(entry.from, 'remitente')),
          el('span', 'nexus-tag', display(entry.kind, 'webhook').toUpperCase())
        );
        const text = el('p', null, display(entry.text, '(sin texto)'));
        const meta = el(
          'p',
          null,
          `${formatDate(entry.receivedAt)} · conector ${display(entry.connectorId)} · ${
            entry.remoteMessageId ? `msg ${entry.remoteMessageId}` : 'sin id remoto'
          }`
        );
        row.append(top, text, meta);
        list.append(row);
      });
    } catch {
      renderNote(list, 'No fue posible leer el inbox.');
    }
  }

  function mountConnectors() {
    const form = byId('nexusConnectorForm');
    if (form) {
      form.addEventListener('submit', (event) => {
        event.preventDefault();
        void runBusy(form, async () => {
          if (!adminToken) {
            formStatus(form, 'Introduce el token de operador para registrar conectores.', 'error');
            if (tokenInput) tokenInput.focus();
            return;
          }
          const nameField = byId('nexusConnectorName');
          const kindField = byId('nexusConnectorKind');
          const targetField = byId('nexusConnectorTarget');
          const name = nameField ? nameField.value.trim() : '';
          const kind = kindField ? kindField.value : 'webhook';
          const targetUrl = targetField ? targetField.value.trim() : '';
          if (!name) {
            formStatus(form, 'El nombre del conector es obligatorio.', 'error');
            return;
          }
          if (targetUrl && !/^https:\/\//i.test(targetUrl)) {
            formStatus(form, 'El target debe usar https://', 'error');
            return;
          }
          if (targetUrl) {
            try {
              const parsed = new URL(targetUrl);
              if (parsed.protocol !== 'https:') throw new Error('protocol');
            } catch {
              formStatus(form, 'El target no es una URL https válida.', 'error');
              return;
            }
          }
          try {
            const payload = { name, kind };
            if (targetUrl) payload.targetUrl = targetUrl;
            const result = await adminFetch('/api/v1/federation/connectors', {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify(payload),
            });
            if (!result.response.ok || !result.json || !result.json.success) {
              formStatus(form, describeFailure(result), 'error');
              return;
            }
            const connector = result.json.connector || {};
            formStatus(
              form,
              `Conector registrado · ${display(connector.id, name)}. La ruta firmada ya está activa.`,
              'ok'
            );
            form.reset();
            void refreshConnectors();
            void refreshInbox();
          } catch {
            formStatus(form, 'No fue posible registrar el conector.', 'error');
          }
        });
      });
    }

    const connectorList = byId('nexusConnectorList');
    if (connectorList) {
      connectorList.addEventListener('click', (event) => {
        const target = event.target instanceof Element ? event.target : null;
        if (!target) return;
        const button = target.closest('[data-remove-connector]');
        if (!button) return;
        const id = button.dataset.removeConnector;
        if (!id) return;
        if (!window.confirm(`¿Eliminar el conector ${id}?`)) return;
        void (async () => {
          if (!adminToken) return;
          try {
            const result = await adminFetch(
              `/api/v1/federation/connectors/${encodeURIComponent(id)}`,
              { method: 'DELETE' }
            );
            if (!result.response.ok) {
              formStatus(form, describeFailure(result), 'error');
              return;
            }
            formStatus(form, `Conector ${id} eliminado.`, 'ok');
            void refreshConnectors();
            void refreshInbox();
          } catch {
            formStatus(form, 'No fue posible eliminar el conector.', 'error');
          }
        })();
      });
    }

    document.addEventListener('click', async (event) => {
      const target = event.target instanceof Element ? event.target : null;
      const button = target ? target.closest('[data-copy]') : null;
      if (!button) return;
      const copied = await copyText(button.dataset.copy || '');
      flash(button, copied ? 'COPIADO' : 'ERROR');
    });

    const refreshList = byId('nexusRefreshConnectors');
    if (refreshList) refreshList.addEventListener('click', () => void refreshConnectors());
    const refreshBox = byId('nexusRefreshInbox');
    if (refreshBox) refreshBox.addEventListener('click', () => void refreshInbox());
  }

  /* -------------------------------------------------------------- api keys */
  function showIssuedSecret(secret) {
    const box = byId('nexusIssuedKey');
    const code = byId('nexusIssuedSecret');
    if (!box || !code) return;
    code.textContent = secret;
    box.hidden = false;
  }

  function renderKeyRows(items) {
    const list = byId('nexusKeyList');
    if (!list) return;
    list.replaceChildren();
    if (!items.length) {
      list.append(el('p', 'nexus-empty', 'No hay claves emitidas en este nodo.'));
      return;
    }
    items.forEach((item) => {
      const revoked = Boolean(item.revokedAt);
      const row = el('div', 'nexus-row');
      const top = el('div', 'nexus-row-top');
      top.append(
        el('strong', null, display(item.name, item.id)),
        el('span', 'nexus-tag', display(item.tenantId, 'programa'))
      );
      const emitted = el('span', 'nexus-tag', display(item.prefix, 'isa_live_'));
      top.append(emitted);
      if (revoked) {
        const tag = el('span', 'nexus-tag', 'REVOCADA');
        tag.dataset.state = 'unavailable';
        top.append(tag);
      }
      const scopes = el('div', 'nexus-row-actions');
      (item.scopes || []).forEach((scope) => scopes.append(el('span', 'nexus-tag', scope)));
      const meta = el(
        'p',
        null,
        `ID ${display(item.id)} · creada ${formatDate(item.createdAt)} · expira ${formatDate(
          item.expiresAt
        )} · último uso ${formatDate(item.lastUsedAt)}`
      );
      row.append(top, scopes, meta);
      if (!revoked) {
        const actions = el('div', 'nexus-row-actions');
        const rotate = el('button', 'nexus-mini', 'ROTAR');
        rotate.type = 'button';
        rotate.dataset.rotateKey = item.id;
        const revoke = el('button', 'nexus-mini is-danger', 'REVOCAR');
        revoke.type = 'button';
        revoke.dataset.revokeKey = item.id;
        revoke.dataset.keyName = display(item.name, item.id);
        actions.append(rotate, revoke);
        row.append(actions);
      }
      list.append(row);
    });
  }

  async function refreshKeys() {
    const list = byId('nexusKeyList');
    if (!list) return;
    if (!adminToken) {
      renderNote(list, 'Introduce el token de operador para listar claves.');
      return;
    }
    renderNote(list, 'Consultando claves…');
    try {
      const result = await adminFetch('/api/v1/admin/api-keys');
      if (!result.response.ok) {
        renderNote(list, describeFailure(result));
        return;
      }
      const keys = result.json && Array.isArray(result.json.keys) ? result.json.keys : [];
      renderKeyRows(keys);
    } catch {
      renderNote(list, 'No fue posible consultar las claves.');
    }
  }

  async function rotateKey(id) {
    if (!adminToken) return;
    if (!window.confirm('Rotar esta clave invalidará el secreto actual. ¿Continuar?')) return;
    try {
      const result = await adminFetch(`/api/v1/admin/api-keys/${encodeURIComponent(id)}/rotate`, {
        method: 'POST',
      });
      if (!result.response.ok || !result.json || !result.json.success) {
        formStatus(byId('nexusKeyForm'), describeFailure(result), 'error');
        return;
      }
      const secret = result.json.key && result.json.key.secret;
      if (typeof secret === 'string') showIssuedSecret(secret);
      formStatus(
        byId('nexusKeyForm'),
        'Clave rotada. El secreto anterior ya no es válido; copia el nuevo.',
        'ok'
      );
      void refreshKeys();
    } catch {
      formStatus(byId('nexusKeyForm'), 'No fue posible rotar la clave.', 'error');
    }
  }

  async function revokeKey(id, name) {
    if (!adminToken) return;
    if (!window.confirm(`¿Revocar la clave de ${name || id}?`)) return;
    try {
      const result = await adminFetch(`/api/v1/admin/api-keys/${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
      if (!result.response.ok || !result.json || !result.json.success) {
        formStatus(byId('nexusKeyForm'), describeFailure(result), 'error');
        return;
      }
      formStatus(byId('nexusKeyForm'), `Clave ${id} revocada.`, 'ok');
      void refreshKeys();
    } catch {
      formStatus(byId('nexusKeyForm'), 'No fue posible revocar la clave.', 'error');
    }
  }

  function mountKeys() {
    const form = byId('nexusKeyForm');
    if (form) {
      form.addEventListener('submit', (event) => {
        event.preventDefault();
        void runBusy(form, async () => {
          if (!adminToken) {
            formStatus(form, 'Introduce el token de operador para emitir claves.', 'error');
            if (tokenInput) tokenInput.focus();
            return;
          }
          const nameField = byId('nexusProgramName');
          const idField = byId('nexusProgramId');
          const expiryField = byId('nexusKeyExpiry');
          const name = nameField ? nameField.value.trim() : '';
          const programId = idField ? idField.value.trim() : '';
          const scopes = [...document.querySelectorAll('.nexus-scope:checked')].map(
            (input) => input.value
          );
          if (!name) {
            formStatus(form, 'El nombre del programa es obligatorio.', 'error');
            return;
          }
          if (!scopes.length) {
            formStatus(form, 'Selecciona al menos un scope.', 'error');
            return;
          }
          const payload = { name, scopes };
          if (programId) payload.programId = programId;
          if (expiryField && expiryField.value) {
            const expiry = new Date(expiryField.value);
            if (Number.isNaN(expiry.getTime())) {
              formStatus(form, 'La fecha de expiración no es válida.', 'error');
              return;
            }
            payload.expiresAt = expiry.toISOString();
          }
          try {
            const result = await adminFetch('/api/v1/admin/programs', {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify(payload),
            });
            if (!result.response.ok || !result.json || !result.json.success) {
              formStatus(form, describeFailure(result), 'error');
              return;
            }
            const secret = result.json.key && result.json.key.secret;
            if (typeof secret === 'string') showIssuedSecret(secret);
            formStatus(
              form,
              'Clave emitida. El secreto se muestra una sola vez; guárdalo ahora.',
              'ok'
            );
            form.reset();
            void refreshKeys();
          } catch {
            formStatus(form, 'No fue posible emitir la clave.', 'error');
          }
        });
      });
    }

    const copy = byId('nexusCopyIssuedKey');
    if (copy) {
      copy.addEventListener('click', async () => {
        const secretNode = byId('nexusIssuedSecret');
        const copied = await copyText(secretNode ? secretNode.textContent : '');
        flash(copy, copied ? 'COPIADA' : 'ERROR');
      });
    }

    const list = byId('nexusKeyList');
    if (list) {
      list.addEventListener('click', (event) => {
        const target = event.target instanceof Element ? event.target : null;
        if (!target) return;
        const rotate = target.closest('[data-rotate-key]');
        if (rotate) {
          void rotateKey(rotate.dataset.rotateKey);
          return;
        }
        const revoke = target.closest('[data-revoke-key]');
        if (revoke) void revokeKey(revoke.dataset.revokeKey, revoke.dataset.keyName);
      });
    }

    const refresh = byId('nexusRefreshKeys');
    if (refresh) refresh.addEventListener('click', () => void refreshKeys());
  }

  /* --------------------------------------------------------------- catalog */
  async function refreshCatalog(force = false) {
    const list = byId('nexusCatalogList');
    if (!list) return;
    if (catalogLoaded && !force) return;
    renderNote(list, 'Cargando catálogo del nodo…');
    try {
      const result = await timedFetch('/api/v1/federation/catalog', {
        headers: { accept: 'application/json' },
      });
      if (!result.response.ok || !result.json) {
        renderNote(list, describeFailure(result));
        return;
      }
      const catalog = result.json;
      const info = catalog.info || {};
      const header = el('div', 'nexus-row');
      const top = el('div', 'nexus-row-top');
      top.append(
        el('strong', null, display(info.title, 'Isabella Federation API')),
        el('span', 'nexus-tag', `v${display(info.version, '1.0.0')}`),
        el('span', 'nexus-tag', display(catalog.openapi, '3.1.0'))
      );
      header.append(top, el('p', null, display(info.description, '')));
      list.replaceChildren(header);
      const paths = catalog.paths && typeof catalog.paths === 'object' ? catalog.paths : {};
      let count = 0;
      Object.entries(paths).forEach(([path, operations]) => {
        if (!operations || typeof operations !== 'object') return;
        Object.entries(operations).forEach(([method, operation]) => {
          if (!METHOD_SET.has(method) || !operation || typeof operation !== 'object') return;
          count += 1;
          const row = el('div', 'nexus-endpoint');
          const methodNode = el('span', `nexus-method is-${method}`, method.toUpperCase());
          const infoNode = el('div');
          infoNode.append(
            el('code', null, path),
            el('small', null, display(operation.summary, 'Endpoint del nodo'))
          );
          const actions = el('div', 'nexus-row-actions');
          if (operation.security) actions.append(el('span', 'nexus-tag', 'OPERADOR'));
          const run = el('button', 'nexus-mini', 'PROBAR');
          run.type = 'button';
          run.addEventListener('click', () => loadEndpoint(method, path));
          actions.append(run);
          row.append(methodNode, infoNode, actions);
          list.append(row);
        });
      });
      if (!count) list.append(el('p', 'nexus-empty', 'El catálogo no declaró operaciones.'));
      catalogLoaded = true;
    } catch {
      renderNote(list, 'No fue posible cargar el catálogo OpenAPI.');
    }
  }

  /* --------------------------------------------------------------- runtime */
  async function refreshRuntime(force = false) {
    const list = byId('nexusRuntimeList');
    if (!list) return;
    if (runtimeLoaded && !force) return;
    renderNote(list, 'Consultando readiness local…');
    try {
      const result = await timedFetch('/api/v1/federation/models', {
        headers: { accept: 'application/json' },
      });
      if (!result.response.ok || !result.json) {
        renderNote(list, describeFailure(result));
        return;
      }
      const data = result.json;
      const models = Array.isArray(data.models) ? data.models : [];
      list.replaceChildren();
      if (!models.length) {
        list.append(
          el(
            'p',
            'nexus-empty',
            'No hay modelos configurados en este nodo. La conversación usará el fallback honesto disponible.'
          )
        );
      } else {
        models.forEach((model) => {
          const card = el('div', 'nexus-model');
          const top = el('div', 'nexus-row-top');
          top.append(
            el('h3', null, `${display(model.provider, 'modelo')} · ${display(model.family, '—')}`)
          );
          const readiness = el('span', 'nexus-tag', display(model.readiness, '—').toUpperCase());
          readiness.dataset.state = model.readiness || '';
          top.append(readiness);
          const capabilities = el('div', 'nexus-row-actions');
          (model.capabilities || []).forEach((capability) => {
            capabilities.append(el('span', 'nexus-tag', capability));
          });
          const disclosure = el('p', null, display(model.disclosure, ''));
          card.append(top, capabilities, disclosure);
          list.append(card);
        });
      }
      const counts = data.counts || {};
      const ready = Number(counts.ready) || 0;
      const configured = Number(counts.configured) || 0;
      const unavailable = Number(counts.unavailable) || 0;
      setChip(
        'nexusModelState',
        `MODELOS · ${ready}/${ready + configured + unavailable} READY`,
        ready > 0 ? 'ready' : 'warn'
      );
      const speech = data.speech || {};
      const freeDiagnostics = data.providerRuntime && data.providerRuntime.keylessFree;
      if (freeDiagnostics) {
        const card = el('div', 'nexus-model');
        const top = el('div', 'nexus-row-top');
        const freeProviders = Array.isArray(freeDiagnostics.providers)
          ? freeDiagnostics.providers.map((provider) => provider && provider.name).filter(Boolean)
          : [];
        top.append(
          el(
            'h3',
            null,
            freeProviders.length
              ? `gratuito sin clave · ${freeProviders.join(' / ')}`
              : 'gratuito sin clave'
          )
        );
        const cooldown = Math.max(0, Number(freeDiagnostics.cooldownRemainingMs) || 0);
        const state = el(
          'span',
          'nexus-tag',
          !freeDiagnostics.configured
            ? 'NO CONFIGURADO'
            : cooldown > 0
              ? 'CUOTA EN ESPERA'
              : 'OPERATIVO'
        );
        state.dataset.state = !freeDiagnostics.configured
          ? 'unavailable'
          : cooldown > 0
            ? 'configured'
            : 'ready';
        top.append(state);
        card.append(top);
        card.append(
          el(
            'p',
            null,
            !freeDiagnostics.configured
              ? 'El operador no habilitó inferencia externa gratuita; la conversación usa el fallback local.'
              : cooldown > 0
                ? `El proveedor gratuito limitó este nodo (HTTP ${display(freeDiagnostics.lastStatus, '—')}). Reintento en ${Math.ceil(cooldown / 1000)} s; el nodo sigue respondiendo con su fallback honesto.`
                : freeDiagnostics.lastFailureKind
                  ? `Último intento fallido: ${display(freeDiagnostics.lastFailureKind, '—')} (HTTP ${display(freeDiagnostics.lastStatus, '—')}).`
                  : freeDiagnostics.keyedFreeTier
                    ? 'Clave gratuita configurada: amplía el límite por IP sin convertir la ruta en un servicio de pago.'
                    : 'Sin clave: el proveedor gratuito aplica su límite por IP. Una clave gratuita del operador amplía ese límite.'
          )
        );
        list.append(card);
      }
      const speechNode = byId('nexusSpeechReadiness');
      if (speechNode) {
        if (speech.textToSpeech) {
          const providers = Array.isArray(speech.providers) ? speech.providers.join(' · ') : '';
          speechNode.textContent = `Voz del nodo disponible${providers ? ` · ${providers}` : ''}. Speech-to-text: ${speech.speechToText ? 'sí' : 'no'}.`;
        } else {
          speechNode.textContent =
            'La voz del nodo no está habilitada. La prueba de voz reportará el plan local sin fabricar audio.';
        }
      }
      runtimeLoaded = true;
    } catch {
      renderNote(list, 'No fue posible consultar el runtime de modelos.');
    }
  }

  function mountCatalogRuntime() {
    const catalogRefresh = byId('nexusRefreshCatalog');
    if (catalogRefresh) catalogRefresh.addEventListener('click', () => void refreshCatalog(true));
    const runtimeRefresh = byId('nexusRefreshRuntime');
    if (runtimeRefresh) runtimeRefresh.addEventListener('click', () => void refreshRuntime(true));
  }

  /* --------------------------------------------------------------- spatial */
  function updateSpatialChip() {
    if (spatialMode) setChip('nexusSpatialState', 'ESPACIAL · PROFUNDIDAD ON', 'ready');
    else if (xrAvailable) setChip('nexusSpatialState', 'ESPACIAL · XR DISPONIBLE', 'ready');
    else setChip('nexusSpatialState', 'ESPACIAL · 2D', 'warn');
  }

  async function detectSpatial(force = false) {
    if (spatialDetected && !force) return;
    spatialDetected = true;
    const xr = navigator.xr;
    const setBadge = (id, label, state) => {
      const node = byId(id);
      if (!node) return;
      node.textContent = label;
      if (state) node.dataset.state = state;
      else delete node.dataset.state;
    };
    if (!xr || typeof xr.isSessionSupported !== 'function') {
      xrAvailable = false;
      setBadge('nexusXrVr', 'VR · NO', 'off');
      setBadge('nexusXrAr', 'AR · NO', 'off');
      setBadge('nexusXrInline', 'INLINE · NO', 'off');
      setBadge('nexusXrDevice', 'DEVICE · WEBXR AUSENTE', 'off');
      const note = byId('nexusSpatialNote');
      if (note) {
        note.textContent =
          'Este navegador no expone navigator.xr. El modo profundidad sigue disponible como capa visual 2D con parallax.';
      }
      updateSpatialChip();
      return;
    }
    const support = async (mode) => {
      try {
        return await xr.isSessionSupported(mode);
      } catch {
        return false;
      }
    };
    const [vr, ar, inline] = await Promise.all([
      support('immersive-vr'),
      support('immersive-ar'),
      support('inline'),
    ]);
    xrAvailable = Boolean(vr || ar || inline);
    setBadge('nexusXrVr', `VR · ${vr ? 'SÍ' : 'NO'}`, vr ? 'ready' : 'off');
    setBadge('nexusXrAr', `AR · ${ar ? 'SÍ' : 'NO'}`, ar ? 'ready' : 'off');
    setBadge('nexusXrInline', `INLINE · ${inline ? 'SÍ' : 'NO'}`, inline ? 'ready' : 'off');
    setBadge(
      'nexusXrDevice',
      `DEVICE · ${xrAvailable ? 'XR' : '2D'}`,
      xrAvailable ? 'ready' : 'off'
    );
    const note = byId('nexusSpatialNote');
    if (note) {
      note.textContent = xrAvailable
        ? 'WebXR respondió a la detección. Nexus no abre una sesión inmersiva por sí mismo: el modo profundidad es una capa visual gobernada.'
        : 'WebXR existe pero no anunció sesiones inmersivas. Se mantiene el modo profundidad 2D.';
    }
    updateSpatialChip();
  }

  function setSpatialMode(on) {
    spatialMode = on;
    document.body.classList.toggle('spatial-mode', on);
    const button = byId('nexusSpatialMode');
    if (button) {
      button.setAttribute('aria-pressed', String(on));
      button.textContent = on ? 'DESACTIVAR PROFUNDIDAD' : 'ACTIVAR PROFUNDIDAD';
    }
    updateSpatialChip();
  }

  function mountSpatial() {
    const button = byId('nexusSpatialMode');
    if (button) button.addEventListener('click', () => setSpatialMode(!spatialMode));
    document.addEventListener(
      'pointermove',
      (event) => {
        if (!spatialMode) return;
        const x = (event.clientX / Math.max(1, window.innerWidth) - 0.5) * 2;
        const y = (event.clientY / Math.max(1, window.innerHeight) - 0.5) * 2;
        document.documentElement.style.setProperty('--nx-spatial-x', x.toFixed(3));
        document.documentElement.style.setProperty('--nx-spatial-y', y.toFixed(3));
      },
      { passive: true }
    );
  }

  /* ----------------------------------------------------------- voice probe */
  function stopProbeAudio() {
    if (!probeAudio) return;
    probeAudio.pause();
    probeAudio.src = '';
    probeAudio = null;
  }

  async function probeVoice() {
    const button = byId('nexusVoiceProbe');
    const status = byId('nexusVoiceStatus');
    if (!button || !status) return;
    stopProbeAudio();
    button.disabled = true;
    status.textContent = 'SINTETIZANDO…';
    status.dataset.state = 'busy';
    try {
      const result = await timedFetch('/api/v1/voice/speak', {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify({
          text: 'Hola. Soy Isabella. Esta es mi voz operativa en este nodo.',
        }),
      });
      const data = result.json || {};
      if (!result.response.ok || !data.success) {
        status.textContent = describeFailure(result);
        status.dataset.state = 'error';
        return;
      }
      const audio = data.audio || {};
      if (typeof audio.dataUrl === 'string' && AUDIO_PAYLOAD.test(audio.dataUrl)) {
        probeAudio = new Audio(audio.dataUrl);
        probeAudio.addEventListener(
          'ended',
          () => {
            status.textContent = `AUDIO OK · ${display(data.backend, 'nodo')}`;
            status.dataset.state = 'ready';
          },
          { once: true }
        );
        await probeAudio.play();
        status.textContent = `REPRODUCIENDO · ${display(data.voice, 'voz')}`;
        status.dataset.state = 'ready';
        return;
      }
      status.textContent = `SIN AUDIO DEL NODO · ${display(data.status, 'client-plan')}`;
      status.dataset.state = 'warn';
    } catch (error) {
      status.textContent =
        error && error.name === 'AbortError'
          ? 'Tiempo de espera agotado.'
          : 'La prueba de voz falló.';
      status.dataset.state = 'error';
    } finally {
      button.disabled = false;
    }
  }

  function mountVoice() {
    const button = byId('nexusVoiceProbe');
    if (button) button.addEventListener('click', () => void probeVoice());
  }

  /* ----------------------------------------------------------- node status */
  async function refreshNode() {
    setChip('nexusNodeState', 'NODO · CONSULTANDO', 'busy');
    try {
      const result = await timedFetch('/api/v1/federation/node', {
        headers: { accept: 'application/json' },
      });
      if (!result.response.ok || !result.json) {
        setChip('nexusNodeState', `NODO · HTTP ${result.response.status}`, 'off');
        return;
      }
      const data = result.json;
      setChip('nexusNodeState', `NODO · ${display(data.federationRoutesVersion, 'OK')}`, 'ready');
      setChip(
        'nexusSigningState',
        data.signingConfigured ? 'WEBHOOK · FIRMA OK' : 'WEBHOOK · FALTA SECRETO',
        data.signingConfigured ? 'ready' : 'warn'
      );
      const counts = data.models || {};
      const ready = Number(counts.ready) || 0;
      const configured = Number(counts.configured) || 0;
      const unavailable = Number(counts.unavailable) || 0;
      setChip(
        'nexusModelState',
        `MODELOS · ${ready}/${ready + configured + unavailable} READY`,
        ready > 0 ? 'ready' : 'warn'
      );
      const speech = data.speech || {};
      if (speech.textToSpeech !== undefined) {
        const speechNode = byId('nexusSpeechReadiness');
        if (speechNode) {
          speechNode.textContent = speech.textToSpeech
            ? 'La voz del nodo está habilitada; usa PROBAR VOZ para verificar el audio real.'
            : 'La voz del nodo no está habilitada; la prueba reportará un plan local sin fabricar audio.';
        }
      }
      updateSpatialChip();
    } catch {
      setChip('nexusNodeState', 'NODO · SIN RESPUESTA', 'off');
    }
  }

  /* --------------------------------------------------------- nexus pulse FX */
  function mountPulse() {
    const canvas = byId('nexusMatrix');
    if (!canvas || typeof canvas.getContext !== 'function') return;
    const context = canvas.getContext('2d', { alpha: true });
    if (!context) return;
    const nodes = Array.from({ length: 24 }, (_, index) => ({
      ring: 0.16 + (index % 4) * 0.085,
      angle: (index / 24) * Math.PI * 2,
      speed: 0.00015 + (index % 3) * 0.00007,
      size: 0.9 + (index % 3) * 0.5,
      x: 0,
      y: 0,
    }));
    let width = 0;
    let height = 0;
    let running = false;
    let frame = 0;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      width = Math.max(1, Math.round(rect.width));
      height = Math.max(1, Math.round(rect.height));
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const paint = (time) => {
      context.clearRect(0, 0, width, height);
      const radius = Math.min(width, height) / 2;
      if (!radius) return;
      nodes.forEach((node, index) => {
        const angle = node.angle + time * node.speed;
        node.x = width / 2 + Math.cos(angle) * node.ring * radius;
        node.y = height / 2 + Math.sin(angle) * node.ring * radius;
        const palette =
          index % 3 === 0 ? '201,184,255' : index % 3 === 1 ? '169,245,208' : '159,247,255';
        context.fillStyle = `rgba(${palette},0.8)`;
        context.beginPath();
        context.arc(node.x, node.y, node.size, 0, Math.PI * 2);
        context.fill();
      });
      for (let i = 0; i < nodes.length; i += 1) {
        for (let j = i + 1; j < nodes.length; j += 1) {
          const distance = Math.hypot(nodes[i].x - nodes[j].x, nodes[i].y - nodes[j].y);
          if (distance > radius * 0.42) continue;
          context.strokeStyle = `rgba(159,247,255,${(1 - distance / (radius * 0.42)) * 0.2})`;
          context.lineWidth = 0.6;
          context.beginPath();
          context.moveTo(nodes[i].x, nodes[i].y);
          context.lineTo(nodes[j].x, nodes[j].y);
          context.stroke();
        }
      }
    };

    const loop = (time) => {
      if (!running) return;
      paint(time);
      frame = window.requestAnimationFrame(loop);
    };
    const start = () => {
      resize();
      if (reduceMotion) {
        paint(0);
        return;
      }
      if (running) return;
      running = true;
      frame = window.requestAnimationFrame(loop);
    };
    const stop = () => {
      running = false;
      window.cancelAnimationFrame(frame);
    };

    if (typeof ResizeObserver === 'function') new ResizeObserver(resize).observe(canvas);
    else window.addEventListener('resize', resize);
    if (typeof IntersectionObserver === 'function') {
      new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) start();
            else stop();
          });
        },
        { threshold: 0.05 }
      ).observe(canvas);
    } else {
      start();
    }
  }

  /* ------------------------------------------------------ reveal and ripple */
  function mountReveal() {
    const targets = [
      ...document.querySelectorAll(
        '.nexus-head, .nexus-status, .nexus-tabs, .nexus-auth, .nexus-panels, .nexus-contract'
      ),
    ];
    if (!targets.length) return;
    if (reduceMotion || typeof IntersectionObserver !== 'function') {
      targets.forEach((target) => target.classList.add('is-visible'));
      return;
    }
    targets.forEach((target) => target.setAttribute('data-nexus-reveal', ''));
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        });
      },
      { threshold: 0.12 }
    );
    targets.forEach((target) => observer.observe(target));
  }

  function mountRipples() {
    document.addEventListener('pointerdown', (event) => {
      if (reduceMotion) return;
      const target = event.target instanceof Element ? event.target : null;
      if (!target) return;
      const surface = target.closest(
        '.nexus-tab, .nexus-action, .nexus-mini, .nexus-endpoint, .rail-panel a, .rail-launcher, .nexus-chip'
      );
      if (!surface) return;
      const ripple = el('span', 'ui-ripple');
      ripple.style.left = `${event.clientX}px`;
      ripple.style.top = `${event.clientY}px`;
      document.body.append(ripple);
      ripple.addEventListener('animationend', () => ripple.remove(), { once: true });
      window.setTimeout(() => ripple.remove(), 900);
    });
  }

  /* ------------------------------------------------------------------ boot */
  mountRails();
  mountTabs();
  mountWorkbench();
  mountConnectors();
  mountKeys();
  mountCatalogRuntime();
  mountSpatial();
  mountVoice();
  mountReveal();
  mountRipples();
  mountSectionTracking();
  mountPulse();

  void refreshNode();
  window.setTimeout(() => {
    void refreshCatalog();
    void refreshRuntime();
  }, 900);

  window.IsabellaNexus = Object.freeze({
    activate: activateTab,
    refresh: () => void refreshNode(),
    refreshCatalog: () => void refreshCatalog(true),
    refreshRuntime: () => void refreshRuntime(true),
  });
})();
