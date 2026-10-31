/* Isabella Chat+ v2 — state: engine-generated.
 * Fixes: per-message pending timers, double-submit guard, hoisting order,
 * debounced history search, aria-live, safer regenerate, Escape closes slash menu.
 * Still client-side only; no innerHTML with dynamic data; no new permissions. */
(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const messages = $('messages');
  const form = $('chatForm');
  const prompt = $('prompt');
  if (!messages || !form || !prompt) return;
  const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
  const HISTORY_KEY = 'isabella.chats.v1';
  const MAX_CHATS = 40,
    MAX_TURNS = 60,
    MAX_TURN_CHARS = 8000;

  const el = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  };
  const safeStorage = {
    get(k) {
      try {
        return window.localStorage.getItem(k);
      } catch {
        return null;
      }
    },
    set(k, v) {
      try {
        window.localStorage.setItem(k, v);
        return true;
      } catch {
        return false;
      }
    },
  };
  const app = () => window.IsabellaApp || null;

  /* ------------------------------------------------------------------ markdown */
  const KEYWORDS = new Set([
    'const',
    'let',
    'var',
    'function',
    'return',
    'if',
    'else',
    'for',
    'while',
    'class',
    'import',
    'from',
    'export',
    'async',
    'await',
    'new',
    'try',
    'catch',
    'throw',
    'def',
    'in',
    'is',
    'not',
    'and',
    'or',
    'None',
    'True',
    'False',
    'true',
    'false',
    'null',
    'undefined',
    'interface',
    'type',
    'extends',
    'public',
    'private',
    'static',
    'void',
    'int',
    'string',
    'SELECT',
    'FROM',
    'WHERE',
    'INSERT',
    'UPDATE',
    'DELETE',
    'JOIN',
  ]);
  const highlight = (code, lang) => {
    const frag = document.createDocumentFragment();
    if (
      lang === 'json' ||
      /^(js|javascript|ts|typescript|tsx|jsx|py|python|sql|bash|sh|go|rust|rs|java|c|cpp|cs|php|rb|yaml|yml)$/.test(
        lang
      )
    ) {
      const token =
        /(\/\/[^\n]*|#[^\n]*|\/\*[\s\S]*?\*\/)|("(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'|`(?:[^`\\]|\\.)*`)|(\b\d[\d_.]*\b)|([A-Za-z_][A-Za-z0-9_]*)/g;
      let last = 0;
      for (const m of code.matchAll(token)) {
        if (m.index > last) frag.append(code.slice(last, m.index));
        let cls = '';
        if (m[1]) cls = 'tok-c';
        else if (m[2]) cls = 'tok-s';
        else if (m[3]) cls = 'tok-n';
        else if (m[4] && KEYWORDS.has(m[4])) cls = 'tok-k';
        if (cls) frag.append(el('span', cls, m[0]));
        else frag.append(m[0]);
        last = m.index + m[0].length;
      }
      if (last < code.length) frag.append(code.slice(last));
      return frag;
    }
    frag.append(code);
    return frag;
  };
  const safeHref = (value) => {
    try {
      const url = new URL(value, window.location.origin);
      return ['http:', 'https:', 'mailto:'].includes(url.protocol) ? url.href : null;
    } catch {
      return null;
    }
  };
  const inline = (text) => {
    const frag = document.createDocumentFragment();
    const pattern =
      /(`[^`\n]+`)|(\*\*[^*\n]+\*\*|__[^_\n]+__)|(\[[^\]\n]+\]\([^)\s]+\))|(https?:\/\/[^\s<)]+)|(\*[^*\n]+\*|_[^_\n]+_)/g;
    let last = 0;
    for (const m of text.matchAll(pattern)) {
      if (m.index > last) frag.append(text.slice(last, m.index));
      const t = m[0];
      if (m[1]) frag.append(el('code', 'md-inline-code', t.slice(1, -1)));
      else if (m[2]) frag.append(el('strong', '', t.slice(2, -2)));
      else if (m[3]) {
        const parts = /^\[([^\]]+)\]\(([^)\s]+)\)$/.exec(t);
        const href = parts ? safeHref(parts[2]) : null;
        if (href) {
          const a = el('a', 'md-link', parts[1]);
          a.href = href;
          a.target = '_blank';
          a.rel = 'noopener noreferrer nofollow';
          frag.append(a);
        } else frag.append(t);
      } else if (m[4]) {
        const href = safeHref(t);
        if (href) {
          const a = el('a', 'md-link', t);
          a.href = href;
          a.target = '_blank';
          a.rel = 'noopener noreferrer nofollow';
          frag.append(a);
        } else frag.append(t);
      } else frag.append(el('em', '', t.slice(1, -1)));
      last = m.index + t.length;
    }
    if (last < text.length) frag.append(text.slice(last));
    return frag;
  };
  const codeBlock = (code, lang) => {
    const wrap = el('div', 'code-block');
    const head = el('div', 'code-head');
    head.append(el('span', 'code-lang', (lang || 'texto').toUpperCase()));
    const actions = el('span', 'code-actions');
    const copy = el('button', 'code-btn', 'COPIAR');
    copy.type = 'button';
    copy.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(code);
        copy.textContent = 'COPIADO';
      } catch {
        copy.textContent = 'SELECCIONA';
      }
      window.setTimeout(() => {
        copy.textContent = 'COPIAR';
      }, 1500);
    });
    const save = el('button', 'code-btn', 'GUARDAR');
    save.type = 'button';
    save.addEventListener('click', () => {
      app()?.saveDraft?.(code);
      save.textContent = 'GUARDADO';
      window.setTimeout(() => {
        save.textContent = 'GUARDAR';
      }, 1500);
    });
    actions.append(copy, save);
    head.append(actions);
    const pre = el('pre');
    const codeEl = el('code');
    codeEl.append(highlight(code, (lang || '').toLowerCase()));
    pre.append(codeEl);
    wrap.append(head, pre);
    return wrap;
  };
  const splitRow = (line) =>
    line
      .trim()
      .replace(/^\||\|$/g, '')
      .split('|')
      .map((c) => c.trim());
  const renderMarkdown = (raw) => {
    const root = document.createDocumentFragment();
    const lines = String(raw).replace(/\r\n?/g, '\n').split('\n');
    let i = 0;
    const isBlockStart = (l) =>
      /^(```|#{1,4}\s|>\s?|\s*[-*•]\s+|\s*\d+[.)]\s+|-{3,}\s*$|\|)/.test(l);
    while (i < lines.length) {
      const line = lines[i] ?? '';
      if (!line.trim()) {
        i++;
        continue;
      }
      const fence = /^```\s*([\w+-]*)\s*$/.exec(line);
      if (fence) {
        const buf = [];
        i++;
        while (i < lines.length && !/^```\s*$/.test(lines[i] ?? '')) {
          buf.push(lines[i] ?? '');
          i++;
        }
        i++;
        root.append(codeBlock(buf.join('\n'), fence[1] || ''));
        continue;
      }
      const h = /^(#{1,4})\s+(.*)$/.exec(line);
      if (h) {
        const node = el('div', `md-h md-h${Math.min(4, h[1].length)}`);
        node.append(inline(h[2] ?? ''));
        root.append(node);
        i++;
        continue;
      }
      if (/^-{3,}\s*$/.test(line)) {
        root.append(el('hr', 'md-hr'));
        i++;
        continue;
      }
      if (/^>\s?/.test(line)) {
        const buf = [];
        while (i < lines.length && /^>\s?/.test(lines[i] ?? '')) {
          buf.push((lines[i] ?? '').replace(/^>\s?/, ''));
          i++;
        }
        const q = el('blockquote', 'md-quote');
        q.append(inline(buf.join(' ')));
        root.append(q);
        continue;
      }
      if (/^\s*[-*•]\s+/.test(line) || /^\s*\d+[.)]\s+/.test(line)) {
        const ordered = /^\s*\d+[.)]\s+/.test(line);
        const list = el(ordered ? 'ol' : 'ul', 'md-list');
        const rx = ordered ? /^\s*\d+[.)]\s+(.*)$/ : /^\s*[-*•]\s+(.*)$/;
        while (i < lines.length && rx.test(lines[i] ?? '')) {
          const li = el('li');
          li.append(inline(rx.exec(lines[i] ?? '')?.[1] ?? ''));
          list.append(li);
          i++;
        }
        root.append(list);
        continue;
      }
      if (line.includes('|') && /^\s*\|?\s*:?-{2,}/.test(lines[i + 1] ?? '')) {
        const head = splitRow(line);
        i += 2;
        const table = el('table', 'md-table');
        const thead = el('thead');
        const trh = el('tr');
        head.forEach((c) => {
          const th = el('th');
          th.append(inline(c));
          trh.append(th);
        });
        thead.append(trh);
        const tbody = el('tbody');
        while (i < lines.length && (lines[i] ?? '').includes('|') && (lines[i] ?? '').trim()) {
          const tr = el('tr');
          splitRow(lines[i] ?? '').forEach((c) => {
            const td = el('td');
            td.append(inline(c));
            tr.append(td);
          });
          tbody.append(tr);
          i++;
        }
        table.append(thead, tbody);
        const scroller = el('div', 'md-table-wrap');
        scroller.append(table);
        root.append(scroller);
        continue;
      }
      const buf = [line];
      i++;
      while (i < lines.length && (lines[i] ?? '').trim() && !isBlockStart(lines[i] ?? '')) {
        buf.push(lines[i] ?? '');
        i++;
      }
      const para = el('div', 'md-p');
      para.append(inline(buf.join(' ').replace(/\s+/g, ' ')));
      root.append(para);
    }
    return root;
  };

  /* --------------------------------------------------------- message rendering */
  /* per-message pending timers (fix: global timer bug) */
  const pendingTimers = new Map();
  const THINKING = [
    'Leyendo tu mensaje',
    'Aplicando gobernanza',
    'Consultando el motor',
    'Redactando la respuesta',
  ];
  const renderInto = (paragraph, raw, { animate = true } = {}) => {
    if (!paragraph) return;
    const t = pendingTimers.get(paragraph);
    if (t) {
      clearInterval(t);
      pendingTimers.delete(paragraph);
    }
    paragraph.dataset.raw = raw;
    paragraph.classList.remove('is-pending');
    paragraph.classList.add('md-body');
    const frag = renderMarkdown(raw);
    if (animate && !reduceMotion)
      [...frag.childNodes].forEach((n, idx) => {
        if (n instanceof HTMLElement) {
          n.style.setProperty('--i', String(Math.min(idx, 14)));
          n.classList?.add('reveal');
        }
      });
    paragraph.replaceChildren(frag);
    scrollIfPinned(true);
  };
  const beginPending = (paragraph) => {
    if (!paragraph) return;
    const old = pendingTimers.get(paragraph);
    if (old) clearInterval(old);
    const start = performance.now();
    paragraph.dataset.raw = '';
    paragraph.classList.add('is-pending');
    const label = el('span', 'think-label', THINKING[0]);
    const clock = el('span', 'think-clock', '0.0 s');
    const dots = el('span', 'think-dots');
    dots.append(el('i'), el('i'), el('i'));
    const bar = el('span', 'think-bar');
    bar.append(el('i'));
    const row = el('span', 'think-row');
    row.append(dots, label, clock);
    paragraph.replaceChildren(row, bar);
    const timer = setInterval(() => {
      const s = (performance.now() - start) / 1000;
      clock.textContent = `${s.toFixed(1)} s`;
      label.textContent =
        THINKING[Math.min(THINKING.length - 1, Math.floor(s / 1.8))] ?? THINKING[0];
      if (s > 12)
        label.textContent =
          'El proveedor tarda más de lo normal; se usará el motor local si no responde';
    }, 100);
    pendingTimers.set(paragraph, timer);
  };
  const latencySince = (start) => Math.max(0, performance.now() - start);

  /* ----------------------------------------------------------- scroll behaviour */
  const toBottom = el('button', 'scroll-bottom', '↓');
  toBottom.type = 'button';
  toBottom.hidden = true;
  toBottom.setAttribute('aria-label', 'Ir al último mensaje');
  const nearBottom = () => messages.scrollHeight - messages.scrollTop - messages.clientHeight < 90;
  function scrollIfPinned(force) {
    if (force || nearBottom())
      messages.scrollTo({ top: messages.scrollHeight, behavior: reduceMotion ? 'auto' : 'smooth' });
  }
  messages.addEventListener(
    'scroll',
    () => {
      toBottom.hidden = nearBottom();
    },
    { passive: true }
  );
  toBottom.addEventListener('click', () =>
    messages.scrollTo({ top: messages.scrollHeight, behavior: 'smooth' })
  );
  $('chat')?.append(toBottom);

  /* follow-ups / regenerate / edit */
  const followUps = (raw) => {
    if (/```/.test(raw))
      return ['Explícalo línea por línea', 'Añade pruebas', 'Optimízalo y señala riesgos'];
    if (/^\s*(\d+[.)]|[-*•])\s+/m.test(raw))
      return ['Conviértelo en checklist', 'Profundiza el primer punto', 'Señala los riesgos'];
    return ['Resúmelo en 3 puntos', 'Dame un ejemplo concreto', 'Separa hechos de supuestos'];
  };
  const lastTurn = (role) => [...messages.querySelectorAll(`.message.${role}`)].at(-1) || null;
  const removeFrom = (article) => {
    let n = article;
    while (n) {
      const next = n.nextElementSibling;
      n.remove();
      n = next;
    }
  };
  let submitting = false;
  const submitText = (text) => {
    if (submitting) return;
    submitting = true;
    prompt.value = text;
    prompt.dispatchEvent(new Event('input'));
    form.requestSubmit();
    setTimeout(() => {
      submitting = false;
    }, 50);
  };
  const regenerate = () => {
    const user = lastTurn('user');
    if (!user) return;
    const raw = user.querySelector('p')?.dataset.raw || user.querySelector('p')?.textContent || '';
    const text = raw.replace(/\n\nArchivo adjunto:[\s\S]*$/, '');
    removeFrom(user);
    submitText(text);
  };
  const editLast = () => {
    const user = lastTurn('user');
    if (!user) return;
    const raw = user.querySelector('p')?.dataset.raw || user.querySelector('p')?.textContent || '';
    removeFrom(user);
    prompt.value = raw.replace(/\n\nArchivo adjunto:[\s\S]*$/, '');
    prompt.dispatchEvent(new Event('input'));
    prompt.focus();
  };
  const sourcesRow = (raw) => {
    const seen = new Map();
    for (const m of String(raw).matchAll(/https?:\/\/[^\s<>)\]"']+/g)) {
      const href = safeHref(m[0].replace(/[.,;:!?]+$/, ''));
      if (!href || seen.has(href)) continue;
      seen.set(href, new URL(href).hostname.replace(/^www\./, ''));
      if (seen.size >= 6) break;
    }
    if (!seen.size) return null;
    const row = el('div', 'sources-row');
    row.append(el('span', 'sources-label', 'FUENTES CITADAS'));
    let i = 1;
    for (const [href, host] of seen) {
      const a = el('a', 'source-chip');
      a.href = href;
      a.target = '_blank';
      a.rel = 'noopener noreferrer nofollow';
      a.append(el('b', '', String(i++)), el('span', '', host));
      row.append(a);
    }
    row.append(
      el('span', 'sources-note', 'Enlaces escritos por el modelo; no verificados por Isabella.')
    );
    return row;
  };
  const feedbackKey = 'isabella.feedback.v1';
  const recordFeedback = (value, engine) => {
    let store = [];
    try {
      const parsed = JSON.parse(safeStorage.get(feedbackKey) || '[]');
      if (Array.isArray(parsed)) store = parsed;
    } catch {
      store = [];
    }
    store.push({
      at: new Date().toISOString(),
      value,
      engine: engine || null,
      session: app()?.getSessionId?.() || null,
    });
    safeStorage.set(feedbackKey, JSON.stringify(store.slice(-200)));
  };
  const shortToken = (value, max = 40) => (typeof value === 'string' ? value.slice(0, max) : '');
  const omegaChip = (meta) => {
    const trace = meta.trace && typeof meta.trace === 'object' ? meta.trace : null;
    if (!trace) return null;
    const blocked = meta.blocked === true || trace.blocked === true;
    const label = ['Ω∞'];
    if (blocked) label.push('BLOQUEADO');
    else {
      if (trace.strategy) label.push(shortToken(trace.strategy).toUpperCase());
      if (Number.isFinite(trace.quality)) label.push(`QA ${Math.round(trace.quality * 100)}%`);
      if (Number.isFinite(trace.contextHits) && trace.contextHits > 0)
        label.push(`CTX ${trace.contextHits}`);
      const verdict = trace.governance || trace.reflection;
      if (verdict && verdict !== 'PASS') label.push(shortToken(verdict));
    }
    const chip = el('span', `omega-chip${blocked ? ' is-blocked' : ''}`, label.join(' · '));
    const details = [];
    if (trace.strategy) details.push(`estrategia ${shortToken(trace.strategy)}`);
    if (trace.intent) details.push(`intención ${shortToken(trace.intent)}`);
    if (trace.risk) details.push(`riesgo ${shortToken(trace.risk)}`);
    if (Number.isFinite(trace.quality))
      details.push(
        `calidad ${Math.round(trace.quality * 100)}%${trace.qualityVerdict ? ` · ${shortToken(trace.qualityVerdict)}` : ''}`
      );
    if (Number.isFinite(trace.contextHits))
      details.push(`contexto ${trace.contextHits}${trace.contextCacheHit ? ' (caché)' : ''}`);
    if (trace.reflection) details.push(`reflexión ${shortToken(trace.reflection)}`);
    if (trace.governance) details.push(`gobernanza ${shortToken(trace.governance)}`);
    if (trace.authority) details.push(`autoridad ${shortToken(trace.authority)}`);
    details.push(blocked ? 'bloqueado por gobernanza' : 'sin autoridad ni ejecución');
    chip.title = `Runtime Ω∞ local · ${details.join(' · ')}`;
    return chip;
  };
  const decorate = (paragraph, meta = {}) => {
    const article = paragraph?.closest('.message');
    if (!article || article.classList.contains('user')) return;
    article.querySelectorAll('.message-tools').forEach((n) => n.remove());
    const raw = paragraph.dataset.raw || paragraph.textContent || '';
    const bar = el('div', 'message-tools');
    const regen = el('button', 'tool-btn', '↻ Regenerar');
    regen.type = 'button';
    regen.addEventListener('click', regenerate);
    const copy = el('button', 'tool-btn message-copy', 'Copiar');
    copy.type = 'button';
    copy.dataset.messageAction = 'copy';
    const save = el('button', 'tool-btn message-save', 'Guardar');
    save.type = 'button';
    save.dataset.messageAction = 'save';
    const speak = el('button', 'tool-btn message-speak', 'Escuchar');
    speak.type = 'button';
    speak.dataset.messageAction = 'speak';
    const up = el('button', 'tool-btn', '👍');
    const down = el('button', 'tool-btn', '👎');
    [up, down].forEach((b, idx) => {
      b.type = 'button';
      b.setAttribute('aria-label', idx === 0 ? 'Respuesta útil' : 'Respuesta no útil');
      b.addEventListener('click', () => {
        recordFeedback(idx === 0 ? 1 : -1, meta.engine);
        up.disabled = down.disabled = true;
        (idx === 0 ? up : down).classList.add('is-on');
      });
    });
    const sources = sourcesRow(raw);
    bar.append(regen, copy, save, speak, up, down);
    if (Number.isFinite(meta.latencyMs))
      bar.append(el('span', 'latency-chip', `⏱ ${(meta.latencyMs / 1000).toFixed(1)} s`));
    const omega = omegaChip(meta);
    if (omega) bar.append(omega);
    const chips = el('div', 'followups');
    followUps(raw).forEach((t) => {
      const c = el('button', 'followup', t);
      c.type = 'button';
      c.addEventListener('click', () => submitText(t));
      chips.append(c);
    });
    const host =
      article.querySelector('.message-body') || article.querySelector(':scope > div') || article;
    if (sources) host.append(sources);
    host.append(bar, chips);
  };

  /* ------------------------------------------------------------------ history */
  const readChats = () => {
    try {
      const parsed = JSON.parse(safeStorage.get(HISTORY_KEY) || '[]');
      if (!Array.isArray(parsed)) return [];
      return parsed
        .filter((c) => c && typeof c.sid === 'string' && Array.isArray(c.turns))
        .map((c) => ({
          ...c,
          title: String(c.title || 'Conversación').slice(0, 80),
          turns: c.turns.filter((t) => t && typeof t.text === 'string').slice(-MAX_TURNS),
          updated: Number(c.updated) || Date.now(),
          pinned: Boolean(c.pinned),
        }))
        .slice(0, MAX_CHATS * 2);
    } catch {
      return [];
    }
  };
  const writeChats = (list) => {
    const pinned = list
      .filter((c) => c.pinned)
      .sort((a, b) => b.updated - a.updated)
      .slice(0, MAX_CHATS);
    const rest = list
      .filter((c) => !c.pinned)
      .sort((a, b) => b.updated - a.updated)
      .slice(0, Math.max(0, MAX_CHATS - pinned.length));
    safeStorage.set(HISTORY_KEY, JSON.stringify([...pinned, ...rest]));
  };
  const isWelcome = (t) => t.role === 'assistant' && /^Estoy aquí\./.test(t.text);
  const collectTurns = () =>
    [...messages.querySelectorAll('.message')]
      .map((n) => {
        const p = n.querySelector('p');
        return {
          role: n.classList.contains('user') ? 'user' : 'assistant',
          text: (p?.dataset.raw || p?.textContent || '').slice(0, MAX_TURN_CHARS),
          ts: Number(n.dataset.ts) || Date.now(),
        };
      })
      .filter((t) => t.text && !isWelcome(t))
      .slice(-MAX_TURNS);
  const persist = () => {
    const sid = app()?.getSessionId?.();
    const turns = collectTurns();
    if (!sid || !turns.some((t) => t.role === 'user')) return;
    const chats = readChats();
    const existing = chats.find((c) => c.sid === sid);
    const title = (turns.find((t) => t.role === 'user')?.text || 'Conversación')
      .replace(/\s+/g, ' ')
      .slice(0, 64);
    if (existing) {
      existing.turns = turns;
      existing.updated = Date.now();
      if (!existing.renamed) existing.title = title;
    } else chats.push({ sid, title, turns, updated: Date.now(), pinned: false, renamed: false });
    writeChats(chats);
    renderHistory();
  };
  const drawer = el('aside', 'history-drawer');
  drawer.id = 'historyDrawer';
  drawer.setAttribute('role', 'dialog');
  drawer.setAttribute('aria-modal', 'true');
  drawer.setAttribute('aria-label', 'Historial de conversaciones');
  drawer.tabIndex = -1;
  drawer.hidden = true;
  const dHead = el('div', 'hd-head');
  dHead.append(el('strong', '', 'HISTORIAL'), el('span', 'hd-note', 'Solo en este navegador'));
  const dClose = el('button', 'hd-close', '×');
  dClose.type = 'button';
  dClose.setAttribute('aria-label', 'Cerrar historial');
  dHead.append(dClose);
  const dSearch = el('input', 'hd-search');
  dSearch.type = 'search';
  dSearch.placeholder = 'Buscar conversaciones…';
  dSearch.setAttribute('aria-label', 'Buscar conversaciones');
  const dList = el('div', 'hd-list');
  const dFoot = el('div', 'hd-foot');
  const dNew = el('button', 'hd-new', '＋ Nueva conversación');
  dNew.type = 'button';
  const dWipe = el('button', 'hd-wipe', 'Borrar todo');
  dWipe.type = 'button';
  dFoot.append(dNew, dWipe);
  drawer.append(dHead, dSearch, dList, dFoot);
  document.body.append(drawer);
  const fmtDate = (ts) => {
    const d = new Date(ts);
    return (
      d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short' }) +
      ' · ' +
      d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })
    );
  };
  let searchTimer = 0;
  function renderHistory() {
    const q = dSearch.value.trim().toLocaleLowerCase('es-MX');
    const chats = readChats()
      .filter(
        (c) =>
          !q ||
          c.title.toLocaleLowerCase('es-MX').includes(q) ||
          c.turns.some((t) => t.text.toLocaleLowerCase('es-MX').includes(q))
      )
      .sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.updated - a.updated);
    dList.replaceChildren();
    if (!chats.length) {
      dList.append(
        el('p', 'hd-empty', q ? 'Sin resultados.' : 'Aún no hay conversaciones guardadas.')
      );
      return;
    }
    chats.forEach((c) => {
      const row = el('div', `hd-item${c.sid === app()?.getSessionId?.() ? ' is-current' : ''}`);
      const open = el('button', 'hd-open');
      open.type = 'button';
      open.append(
        el('span', 'hd-title', `${c.pinned ? '★ ' : ''}${c.title}`),
        el('span', 'hd-date', `${fmtDate(c.updated)} · ${c.turns.length} msgs`)
      );
      open.addEventListener('click', () => loadChat(c.sid));
      const tools = el('span', 'hd-tools');
      const pin = el('button', 'hd-tool', c.pinned ? '★' : '☆');
      pin.type = 'button';
      pin.title = c.pinned ? 'Quitar fijado' : 'Fijar';
      pin.addEventListener('click', () => {
        const all = readChats();
        const t = all.find((x) => x.sid === c.sid);
        if (t) {
          t.pinned = !t.pinned;
          writeChats(all);
          renderHistory();
        }
      });
      const ren = el('button', 'hd-tool', '✎');
      ren.type = 'button';
      ren.title = 'Renombrar';
      ren.addEventListener('click', () => {
        const name = window.prompt('Nuevo nombre', c.title);
        if (name && name.trim()) {
          const all = readChats();
          const t = all.find((x) => x.sid === c.sid);
          if (t) {
            t.title = name.trim().slice(0, 80);
            t.renamed = true;
            writeChats(all);
            renderHistory();
          }
        }
      });
      const del = el('button', 'hd-tool', '🗑');
      del.type = 'button';
      del.title = 'Eliminar';
      del.addEventListener('click', () => {
        writeChats(readChats().filter((x) => x.sid !== c.sid));
        renderHistory();
      });
      tools.append(pin, ren, del);
      row.append(open, tools);
      dList.append(row);
    });
  }
  function loadChat(sid) {
    const chat = readChats().find((c) => c.sid === sid);
    if (!chat || !app()) return;
    app().resetConversation({ keepFocus: true });
    app().setSessionId(chat.sid);
    messages.querySelectorAll('.message').forEach((n) => n.remove());
    chat.turns.forEach((t) => {
      const p = app().addMessage(
        t.role === 'user' ? t.text : '',
        t.role === 'user' ? 'user' : 'isabella'
      );
      if (t.role !== 'user' && p) renderInto(p, t.text, { animate: false });
    });
    const lastA = lastTurn('isabella')?.querySelector('p');
    if (lastA) decorate(lastA, {});
    closeDrawer();
    scrollIfPinned(true);
  }
  let historyReturnFocus = null;
  function openDrawer() {
    if (!drawer.hidden) return;
    historyReturnFocus =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    renderHistory();
    drawer.hidden = false;
    document.body.classList.add('history-open');
    dSearch.focus();
  }
  function closeDrawer() {
    if (drawer.hidden) return;
    drawer.hidden = true;
    document.body.classList.remove('history-open');
    if (historyReturnFocus?.isConnected) historyReturnFocus.focus({ preventScroll: true });
    historyReturnFocus = null;
  }
  drawer.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      closeDrawer();
      return;
    }
    if (event.key !== 'Tab') return;
    const focusable = [
      ...drawer.querySelectorAll(
        'button:not(:disabled), input:not(:disabled), a[href], [tabindex]:not([tabindex="-1"])'
      ),
    ].filter((node) => node instanceof HTMLElement && node.offsetParent !== null);
    if (!focusable.length) return;
    const first = focusable[0],
      last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });
  const toggleDrawer = () => (drawer.hidden ? openDrawer() : closeDrawer());
  dClose.addEventListener('click', closeDrawer);
  dSearch.addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(renderHistory, 180);
  });
  dNew.addEventListener('click', () => {
    app()?.resetConversation();
    closeDrawer();
  });
  dWipe.addEventListener('click', () => {
    if (window.confirm('¿Borrar todo el historial de este navegador?')) {
      safeStorage.set(HISTORY_KEY, '[]');
      renderHistory();
    }
  });

  /* ---------------------------------------------------------------- focus mode */
  const setFocusMode = (on) => {
    document.body.classList.toggle('chat-focus', on);
    const btn = $('focusToggle');
    if (btn) {
      btn.setAttribute('aria-pressed', String(on));
      btn.textContent = on ? 'Salir de enfoque' : 'Enfoque';
    }
    if (on) {
      $('chat')?.scrollIntoView({ block: 'start' });
      prompt.focus();
    }
  };
  const toggleFocus = () => setFocusMode(!document.body.classList.contains('chat-focus'));
  const actionsRow = document.querySelector('.console-actions');
  if (actionsRow) {
    const hist = el('button', 'subtle-action', 'Historial');
    hist.type = 'button';
    hist.id = 'historyToggle';
    hist.addEventListener('click', toggleDrawer);
    const foc = el('button', 'subtle-action', 'Enfoque');
    foc.type = 'button';
    foc.id = 'focusToggle';
    foc.setAttribute('aria-pressed', 'false');
    foc.addEventListener('click', toggleFocus);
    actionsRow.prepend(hist, foc);
  }
  const topActions = document.querySelector('.topbar-actions');
  if (topActions && !$('historyTop')) {
    const b = el('button', 'header-action ghost', '');
    b.id = 'historyTop';
    b.type = 'button';
    b.title = 'Historial (Ctrl+Shift+H)';
    b.setAttribute('aria-label', 'Abrir historial');
    b.append(el('span', '', '☰'), el('span', 'header-action-label', 'Historial'));
    b.addEventListener('click', toggleDrawer);
    topActions.insertBefore(b, topActions.firstChild);
  }

  /* slash commands */
  const SLASH = [
    {
      cmd: '/resumir',
      desc: 'Resumen en 5 puntos',
      text: 'Resume lo siguiente en 5 puntos clave y una conclusión: ',
    },
    {
      cmd: '/traducir',
      desc: 'Traducir al inglés',
      text: 'Traduce al inglés manteniendo tono profesional: ',
    },
    {
      cmd: '/explicar',
      desc: 'Explicar paso a paso',
      text: 'Explícalo paso a paso, como a un colega nuevo: ',
    },
    {
      cmd: '/corregir',
      desc: 'Corregir ortografía y estilo',
      text: 'Corrige ortografía, gramática y estilo sin cambiar el sentido: ',
    },
    {
      cmd: '/codigo',
      desc: 'Revisar código o diseño',
      text: 'Revisa este código o diseño técnico. Busca errores, riesgos, deuda técnica y pruebas que faltan: ',
    },
    {
      cmd: '/plan',
      desc: 'Plan por fases',
      text: 'Crea un plan de trabajo por fases con entregables, dependencias, criterios de aceptación y riesgos: ',
    },
    {
      cmd: '/investigar',
      desc: 'Investigar con evidencias',
      text: 'Investiga este tema con preguntas, evidencias, contradicciones y conclusiones provisionales: ',
    },
    {
      cmd: '/analizar',
      desc: 'Analizar supuestos y riesgos',
      text: 'Analiza este problema paso a paso, identifica supuestos, riesgos, alternativas y una recomendación verificable: ',
    },
    {
      cmd: '/redactar',
      desc: 'Redactar documento',
      text: 'Ayúdame a redactar un documento claro y profesional. Objetivo, audiencia, tono y resultado esperado: ',
    },
    { cmd: '/nuevo', desc: 'Nueva conversación', run: () => app()?.resetConversation() },
    { cmd: '/historial', desc: 'Abrir historial', run: () => openDrawer() },
    { cmd: '/estudio', desc: 'Abrir Studio local', run: () => app()?.openPanel?.('studio') },
    { cmd: '/inspeccionar', desc: 'Inspeccionar la sesión', run: () => app()?.openInspector?.() },
    { cmd: '/enfoque', desc: 'Modo enfoque', run: () => toggleFocus() },
    { cmd: '/exportar', desc: 'Exportar .md', run: () => $('exportChat')?.click() },
    { cmd: '/voz', desc: 'Activar o desactivar voz', run: () => $('soundToggle')?.click() },
    { cmd: '/atajos', desc: 'Ver atajos de teclado', run: () => openShortcuts() },
  ];
  const menu = el('div', 'slash-menu');
  menu.hidden = true;
  menu.setAttribute('role', 'listbox');
  form.parentElement?.insertBefore(menu, form);
  let menuItems = [],
    menuIndex = 0;
  const paintMenu = () =>
    menu.querySelectorAll('.slash-item').forEach((n, i) => {
      n.classList.toggle('is-active', i === menuIndex);
      n.setAttribute('aria-selected', String(i === menuIndex));
    });
  const closeMenu = () => {
    menu.hidden = true;
    menuItems = [];
  };
  const applySlash = (item) => {
    closeMenu();
    if (item.run) {
      prompt.value = '';
      prompt.dispatchEvent(new Event('input'));
      item.run();
      return;
    }
    prompt.value = item.text;
    prompt.dispatchEvent(new Event('input'));
    prompt.focus();
    prompt.setSelectionRange(prompt.value.length, prompt.value.length);
  };
  const updateMenu = () => {
    const v = prompt.value;
    if (!/^\/[a-záéíóúñ]*$/i.test(v)) {
      closeMenu();
      return;
    }
    menuItems = SLASH.filter((s) => s.cmd.startsWith(v.toLowerCase()));
    if (!menuItems.length) {
      closeMenu();
      return;
    }
    menuIndex = 0;
    menu.replaceChildren();
    menuItems.forEach((s, i) => {
      const b = el('button', 'slash-item');
      b.type = 'button';
      b.setAttribute('role', 'option');
      b.append(el('b', '', s.cmd), el('span', '', s.desc));
      b.addEventListener('mousedown', (e) => {
        e.preventDefault();
        applySlash(s);
      });
      b.addEventListener('mousemove', () => {
        menuIndex = i;
        paintMenu();
      });
      menu.append(b);
    });
    paintMenu();
    menu.hidden = false;
  };
  prompt.addEventListener('input', updateMenu);
  form.addEventListener(
    'keydown',
    (e) => {
      if (e.target !== prompt) return;
      if (!menu.hidden && menuItems.length) {
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
          e.preventDefault();
          e.stopPropagation();
          menuIndex =
            (menuIndex + (e.key === 'ArrowDown' ? 1 : -1) + menuItems.length) % menuItems.length;
          paintMenu();
          return;
        }
        if (e.key === 'Enter' || e.key === 'Tab') {
          e.preventDefault();
          e.stopPropagation();
          const item = menuItems[menuIndex];
          if (item) applySlash(item);
          return;
        }
        if (e.key === 'Escape') {
          e.preventDefault();
          e.stopPropagation();
          closeMenu();
          return;
        }
      }
      if (e.key === 'ArrowUp' && !prompt.value && !e.shiftKey) {
        e.preventDefault();
        editLast();
      }
    },
    true
  );

  /* ---------------------------------------------------- composer: counter + drop */
  const counter = el('span', 'char-counter');
  counter.hidden = true;
  const hint = el('p', 'composer-hint');
  hint.append(
    'Enter envía · Shift+Enter nueva línea · ',
    el('kbd', '', '/'),
    ' comandos · ',
    el('kbd', '', '?'),
    ' atajos'
  );
  form.parentElement?.insertBefore(hint, form.nextSibling);
  form.append(counter);
  prompt.addEventListener('input', () => {
    const n = prompt.value.length;
    counter.hidden = n < 9000;
    counter.textContent = `${n.toLocaleString('es-MX')} / 18,000`;
    counter.classList.toggle('is-over', n > 18000);
  });
  const fileInput = $('localFile');
  const handleFiles = (files) => {
    if (!files?.length || !fileInput) return;
    const dt = new DataTransfer();
    dt.items.add(files[0]);
    fileInput.files = dt.files;
    fileInput.dispatchEvent(new Event('change'));
  };
  ['dragenter', 'dragover'].forEach((t) =>
    form.addEventListener(t, (e) => {
      e.preventDefault();
      form.classList.add('is-drop');
    })
  );
  ['dragleave', 'drop'].forEach((t) =>
    form.addEventListener(t, (e) => {
      e.preventDefault();
      form.classList.remove('is-drop');
    })
  );
  form.addEventListener('drop', (e) => handleFiles(e.dataTransfer?.files));
  prompt.addEventListener('paste', (e) => {
    if (e.clipboardData?.files?.length) {
      e.preventDefault();
      handleFiles(e.clipboardData.files);
    }
  });

  /* ------------------------------------------------------------- stop generation */
  let activeController = null;
  const submit = form.querySelector('button[type="submit"]');
  const setSendingUi = (busy) => {
    if (!submit) return;
    submit.classList.toggle('is-stop', busy);
    submit.textContent = busy ? '■' : '↑';
    submit.setAttribute('aria-label', busy ? 'Detener generación' : 'Enviar mensaje');
  };
  submit?.addEventListener(
    'click',
    (e) => {
      if (form.getAttribute('aria-busy') === 'true' && activeController) {
        e.preventDefault();
        e.stopImmediatePropagation();
        activeController.abort();
      }
    },
    true
  );
  new MutationObserver(() => setSendingUi(form.getAttribute('aria-busy') === 'true')).observe(
    form,
    { attributes: true, attributeFilter: ['aria-busy'] }
  );

  /* ----------------------------------------------------------------- empty state */
  const greeting = () => {
    const h = new Date().getHours();
    return h < 6
      ? 'Buenas noches'
      : h < 12
        ? 'Buenos días'
        : h < 19
          ? 'Buenas tardes'
          : 'Buenas noches';
  };
  const CARDS = [
    ['Investigar', 'Evidencias, contradicciones y conclusiones provisionales', '/investigar'],
    ['Redactar', 'Un documento claro, con audiencia y tono definidos', '/redactar'],
    ['Revisar código', 'Errores, riesgos, deuda técnica y pruebas faltantes', '/codigo'],
    ['Planificar', 'Fases, entregables, dependencias y criterios de aceptación', '/plan'],
  ];
  const paintEmpty = () => {
    const nodes = messages.querySelectorAll('.message');
    if (
      nodes.length !== 1 ||
      nodes[0].classList.contains('user') ||
      messages.querySelector('.empty-state')
    )
      return;
    const box = el('div', 'empty-state');
    box.append(
      el('p', 'es-hello', `${greeting()}.`),
      el(
        'p',
        'es-sub',
        '¿En qué trabajamos hoy? Escribe, adjunta un archivo o empieza con una de estas rutas.'
      )
    );
    const grid = el('div', 'es-grid');
    CARDS.forEach(([title, text, cmd]) => {
      const c = el('button', 'es-card');
      c.type = 'button';
      c.append(el('b', '', title), el('span', '', text));
      c.addEventListener('click', () => {
        const item = SLASH.find((s) => s.cmd === cmd);
        if (item) applySlash(item);
      });
      grid.append(c);
    });
    box.append(grid);
    messages.append(box);
  };
  new MutationObserver(() => {
    const users = messages.querySelector('.message.user');
    if (users) messages.querySelector('.empty-state')?.remove();
    else paintEmpty();
  }).observe(messages, { childList: true });
  paintEmpty();

  /* ----------------------------------------------------------------- shortcuts */
  const dlg = el('dialog', 'shortcuts-dialog');
  const dlgTitle = el('h2', '', 'Atajos de teclado');
  const dl = el('dl');
  [
    ['Ctrl/⌘ + K', 'Paleta de comandos'],
    ['/', 'Menú de comandos en el compositor'],
    ['Enter · Shift+Enter', 'Enviar · nueva línea'],
    ['↑ (compositor vacío)', 'Editar último mensaje'],
    ['Ctrl/⌘ + Shift + H', 'Historial'],
    ['Ctrl/⌘ + Shift + F', 'Modo enfoque'],
    ['Ctrl/⌘ + Shift + O', 'Nueva conversación'],
    ['Esc', 'Cerrar paneles / salir de enfoque'],
    ['?', 'Esta ayuda'],
  ].forEach(([k, v]) => {
    dl.append(el('dt', '', k), el('dd', '', v));
  });
  const dlgClose = el('button', 'subtle-action', 'Cerrar');
  dlgClose.type = 'button';
  dlgClose.addEventListener('click', () => dlg.close());
  dlg.append(dlgTitle, dl, dlgClose);
  document.body.append(dlg);
  function openShortcuts() {
    if (typeof dlg.showModal === 'function') {
      if (!dlg.open) dlg.showModal();
    } else dlg.setAttribute('open', '');
    dlgClose.focus({ preventScroll: true });
  }
  document.addEventListener('keydown', (e) => {
    const typing = ['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName || '');
    const mod = e.ctrlKey || e.metaKey;
    if (e.key === '?' && !typing && !document.querySelector('dialog[open]')) {
      e.preventDefault();
      openShortcuts();
    }
    if (mod && e.shiftKey && e.key.toLowerCase() === 'h') {
      e.preventDefault();
      toggleDrawer();
    }
    if (mod && e.shiftKey && e.key.toLowerCase() === 'f') {
      e.preventDefault();
      toggleFocus();
    }
    if (mod && e.shiftKey && e.key.toLowerCase() === 'o') {
      e.preventDefault();
      app()?.resetConversation();
    }
    if (e.key === 'Escape') {
      if (document.body.classList.contains('chat-focus') && !document.querySelector('dialog[open]'))
        setFocusMode(false);
      if (!drawer.hidden) closeDrawer();
    }
  });

  /* ----------------------------------------------------------------- focus lens */
  const LENSES = [
    ['general', 'General'],
    ['territorial', 'Territorial'],
    ['epistemic', 'Epistémico'],
    ['security', 'Seguridad'],
    ['governance', 'Gobernanza'],
  ];
  const LENS_KEY = 'isabella.lens.v1';
  let lens = LENSES.some(([id]) => id === safeStorage.get(LENS_KEY))
    ? safeStorage.get(LENS_KEY)
    : 'general';
  const lensBar = el('div', 'lens-bar');
  lensBar.setAttribute('role', 'radiogroup');
  lensBar.setAttribute('aria-label', 'Lente de análisis');
  lensBar.append(el('span', 'lens-label', 'LENTE'));
  const lensButtons = LENSES.map(([id, label]) => {
    const b = el('button', 'lens-chip', label);
    b.type = 'button';
    b.setAttribute('role', 'radio');
    b.dataset.lens = id;
    b.addEventListener('click', () => setLens(id));
    lensBar.append(b);
    return b;
  });
  const basePlaceholder = prompt.placeholder;
  function setLens(id) {
    lens = id;
    safeStorage.set(LENS_KEY, id);
    lensButtons.forEach((b) => {
      const on = b.dataset.lens === id;
      b.classList.toggle('is-active', on);
      b.setAttribute('aria-checked', String(on));
    });
    prompt.placeholder =
      id === 'general'
        ? basePlaceholder
        : `Lente ${LENSES.find(([k]) => k === id)?.[1].toLowerCase()} activa · ${basePlaceholder}`;
  }
  form.before(lensBar);
  setLens(lens);

  /* ---------------------------------------------------------------------- plans */
  const plansGrid = $('plansGrid');
  if (plansGrid) {
    let catalog = null;
    let interval = 'month';
    const usd = new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    });
    const paint = () => {
      plansGrid.replaceChildren();
      if (!catalog) {
        plansGrid.append(
          el(
            'p',
            'plans-loading',
            'El catálogo no está disponible ahora. Inténtalo de nuevo más tarde.'
          )
        );
        return;
      }
      for (const plan of catalog.plans) {
        const price = interval === 'year' ? plan.yearly : plan.monthly;
        const card = el('article', `plan-card${plan.recommended ? ' is-recommended' : ''}`);
        if (plan.recommended) card.append(el('span', 'plan-badge', 'MÁS ELEGIDO'));
        card.append(el('h3', '', plan.label));
        const amount = el('p', 'plan-price');
        if (plan.contactSales)
          amount.append(el('strong', '', 'A medida'), el('span', '', 'contrato'));
        else if (!price) amount.append(el('strong', '', usd.format(0)), el('span', '', 'siempre'));
        else {
          const shown = interval === 'year' ? price.effectiveMonthly : price.unitAmount;
          amount.append(
            el('strong', '', usd.format(shown / 100)),
            el('span', '', interval === 'year' ? '/mes · facturado anual' : '/mes')
          );
        }
        card.append(amount);
        if (interval === 'year' && plan.yearlySavingsPct > 0)
          card.append(
            el(
              'p',
              'plan-save',
              `Ahorras ${plan.yearlySavingsPct}% · ${plan.monthsFree} meses gratis`
            )
          );
        card.append(el('p', 'plan-desc', plan.description.split('. ')[0].replace(/\.$/, '') + '.'));
        const list = el('ul', 'plan-list');
        plan.highlights.forEach((h) => list.append(el('li', '', h)));
        card.append(list);
        const cta = el(
          'button',
          'plan-cta',
          plan.contactSales
            ? 'Hablar con ventas'
            : plan.id === 'free'
              ? 'Empezar gratis'
              : `Consultar ${plan.label}`
        );
        cta.type = 'button';
        cta.addEventListener('click', () => {
          document
            .getElementById('chat')
            ?.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth' });
          prompt.value =
            plan.id === 'free'
              ? 'Quiero empezar con el plan gratuito. ¿Qué puedo hacer en él?'
              : `Quiero conocer el plan ${plan.label} (${interval === 'year' ? 'anual' : 'mensual'}). ¿Qué incluye y cómo se contrata?`;
          prompt.dispatchEvent(new Event('input'));
          prompt.focus();
        });
        card.append(cta);
        plansGrid.append(card);
      }
      const save = $('plansSave');
      const best = Math.max(0, ...catalog.plans.map((p) => p.yearlySavingsPct));
      if (save) {
        save.hidden = best <= 0;
        save.textContent = `−${best}%`;
      }
    };
    document.querySelectorAll('.plans-interval').forEach((b) =>
      b.addEventListener('click', () => {
        interval = b.dataset.interval === 'year' ? 'year' : 'month';
        document.querySelectorAll('.plans-interval').forEach((o) => {
          const on = o === b;
          o.classList.toggle('is-active', on);
          o.setAttribute('aria-pressed', String(on));
        });
        paint();
      })
    );
    fetch('/api/v1/billing/prices', { headers: { accept: 'application/json' } })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        catalog = j?.catalog?.plans ? j.catalog : null;
        paint();
      })
      .catch(() => paint());
  }

  /* --------------------------------------------------------------------- bridge */
  window.IsabellaChatPlus = Object.freeze({
    renderInto,
    beginPending,
    latencySince,
    decorate,
    persist,
    getLens: () => lens,
    openHistory: openDrawer,
    closeHistory: closeDrawer,
    openShortcuts,
    setAbort(controller) {
      activeController = controller;
    },
    stamp(article) {
      if (article) article.dataset.ts = String(Date.now());
    },
  });
})();
