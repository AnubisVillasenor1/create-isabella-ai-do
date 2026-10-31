/* Mapa del universo operativo.
 * Pinta EXCLUSIVAMENTE lo que `/api/v1/status` deriva de los registros del proceso: los nodos
 * CROWN declarados, los módulos expertos con su techo de riesgo y los conteos reales de
 * herramientas, habilidades, módulos y protocolos. Ninguna posición, peso o estado se inventa
 * aquí: sin respuesta del servidor no hay mapa, hay un estado explícito "sin datos".
 */
(() => {
  'use strict';

  const ENDPOINT = '/api/v1/status';
  const SCHEMA = 'isabella.universe.v1';
  const STALE_MS = 45_000;

  const reduceMotion =
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches === true;

  const palette = [
    '159,247,255',
    '201,184,255',
    '169,245,208',
    '255,214,153',
    '255,167,196',
    '167,216,255',
    '224,255,167',
  ];
  const riskColor = { LOW: '169,245,208', MEDIUM: '255,214,153', HIGH: '255,120,120' };

  const canvas = document.getElementById('quantumMesh');
  const board = document.getElementById('universeBoard');
  const readout = document.getElementById('universeReadout');
  const legendHost = document.getElementById('universeLegend');
  if (!canvas || !board || !readout || !legendHost) return;

  const context = canvas.getContext ? canvas.getContext('2d', { alpha: true }) : null;

  let state = { kind: 'loading' };
  let marks = [];
  let width = 0;
  let height = 0;
  let frame = 0;
  let running = false;
  let spin = 0;
  let selected = null;

  const setText = (node, value) => {
    node.textContent = value;
  };

  const make = (tag, className, text) => {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
  };

  const swatch = (rgb, shape) => {
    const dot = make('span', 'universe-swatch');
    dot.style.setProperty('--universe-swatch-color', `rgb(${rgb})`);
    if (shape) dot.dataset.shape = shape;
    return dot;
  };

  /* ------------------------------------------------------------- lectura de datos */
  const readUniverse = (payload) => {
    if (!payload || payload.universe?.schema !== SCHEMA) return null;
    const universe = payload.universe;
    if (!Array.isArray(universe.nodes) || universe.nodes.length === 0) return null;
    return universe;
  };

  const load = async () => {
    try {
      const response = await fetch(ENDPOINT, { headers: { accept: 'application/json' } });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const universe = readUniverse(await response.json());
      if (universe === null) throw new Error(`respuesta sin ${SCHEMA}`);
      state = { kind: 'ready', universe, at: Date.now() };
      selected = universe.nodes[0]?.id ?? null;
    } catch (error) {
      state = { kind: 'error', reason: error instanceof Error ? error.message : String(error) };
    }
    renderLegend();
    resize();
    paint();
  };

  /* --------------------------------------------------------------------- geometría */
  const federationsOf = (universe) => {
    const groups = new Map();
    for (const node of universe.nodes) {
      const key =
        typeof node.federation === 'string' && node.federation ? node.federation : 'SIN FEDERACIÓN';
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(node);
    }
    return [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0], 'es'));
  };

  const layout = () => {
    marks = [];
    if (state.kind !== 'ready' || width === 0) return;
    const universe = state.universe;
    const center = { x: width / 2, y: height / 2 };
    const radius = Math.min(width, height);
    const outer = radius * 0.4;
    const inner = radius * 0.225;
    const groups = federationsOf(universe);
    const total = universe.nodes.length;
    const gap = groups.length > 1 ? 0.14 : 0;
    const span = Math.max(0.05, (Math.PI * 2 - gap * groups.length) / Math.max(1, total));

    let cursor = -Math.PI / 2;
    groups.forEach(([label, members], groupIndex) => {
      const sweep = span * members.length;
      const start = cursor + gap / 2;
      members.forEach((node, index) => {
        const weight = Number.isFinite(node.weight) ? Math.min(1, Math.max(0.1, node.weight)) : 0.5;
        const angle = start + sweep * ((index + 0.5) / members.length) + spin;
        marks.push({
          kind: 'node',
          id: node.id,
          label: node.id,
          title: typeof node.name === 'string' ? node.name : node.id,
          role: typeof node.role === 'string' ? node.role : '',
          federation: label,
          status: typeof node.status === 'string' ? node.status : 'UNKNOWN',
          weight,
          color: palette[groupIndex % palette.length],
          radius: 3.4 + weight * 6.2,
          x: center.x + Math.cos(angle) * outer,
          y: center.y + Math.sin(angle) * outer,
          angle,
        });
      });
      cursor += sweep + gap;
    });

    const experts = Array.isArray(universe.expertModules) ? universe.expertModules : [];
    experts.forEach((expert, index) => {
      const angle = (Math.PI * 2 * index) / Math.max(1, experts.length) - spin * 1.6;
      const ceiling = riskColor[expert.riskCeiling] ? expert.riskCeiling : 'MEDIUM';
      marks.push({
        kind: 'expert',
        id: expert.id,
        label: String(expert.id).replace(/^E\d+_/, ''),
        title: `${expert.id} · riesgo ${ceiling}`,
        role: typeof expert.purpose === 'string' ? expert.purpose : '',
        status: ceiling,
        color: riskColor[ceiling],
        radius: 2.1,
        x: center.x + Math.cos(angle) * inner,
        y: center.y + Math.sin(angle) * inner,
        angle,
      });
    });

    const subsystems = Array.isArray(universe.subsystems) ? universe.subsystems : [];
    subsystems.forEach((item, index) => {
      const angle = (Math.PI * 2 * (index + 0.5)) / Math.max(1, subsystems.length) - Math.PI / 2;
      const ring = radius * 0.12;
      marks.push({
        kind: 'subsystem',
        id: item.id,
        label: `${item.count}`,
        title: item.label || item.id,
        role: typeof item.state === 'string' ? item.state : '',
        status: typeof item.state === 'string' ? item.state : 'UNKNOWN',
        color: '236,244,252',
        radius: 2.4,
        x: center.x + Math.cos(angle) * ring,
        y: center.y + Math.sin(angle) * ring,
        angle,
      });
    });

    marks.unshift({
      kind: 'core',
      id: 'CORE',
      label: 'ISABELLA',
      title: `Núcleo · ${total} nodos declarados`,
      role: '',
      status: universe.nodeStatusMeaning || 'DECLARED',
      color: '159,247,255',
      radius: radius * 0.075,
      x: center.x,
      y: center.y,
      angle: 0,
    });
  };

  /* ----------------------------------------------------------------------- pintado */
  const resize = () => {
    const rect = canvas.getBoundingClientRect();
    width = Math.max(1, Math.round(rect.width));
    height = Math.max(1, Math.round(rect.height));
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    if (context) context.setTransform(dpr, 0, 0, dpr, 0, 0);
    layout();
  };

  const paintEmpty = (message) => {
    if (!context) return;
    context.clearRect(0, 0, width, height);
    context.font = '600 11px ui-monospace, "SFMono-Regular", monospace';
    context.textAlign = 'center';
    context.fillStyle = 'rgba(201,184,255,0.55)';
    context.fillText(message, width / 2, height / 2);
    context.textAlign = 'start';
  };

  const paint = () => {
    if (!context) return;
    context.clearRect(0, 0, width, height);
    if (state.kind === 'loading') {
      paintEmpty('LEYENDO REGISTROS REALES…');
      return;
    }
    if (state.kind === 'error') {
      paintEmpty('SIN DATOS · MAPA NO DISPONIBLE');
      return;
    }
    const center = { x: width / 2, y: height / 2 };
    const radius = Math.min(width, height);

    for (const ring of [radius * 0.225, radius * 0.4]) {
      context.beginPath();
      context.arc(center.x, center.y, ring, 0, Math.PI * 2);
      context.strokeStyle = 'rgba(206,222,236,0.09)';
      context.lineWidth = 1;
      context.stroke();
    }

    for (const mark of marks) {
      if (mark.kind === 'core') continue;
      const dimmed = selected !== null && mark.id !== selected && mark.kind === 'node';
      context.beginPath();
      context.moveTo(center.x, center.y);
      context.lineTo(mark.x, mark.y);
      const alpha = mark.kind === 'node' ? (dimmed ? 0.04 : 0.16) : 0.06;
      context.strokeStyle = `rgba(${mark.color},${alpha})`;
      context.lineWidth = mark.id === selected ? 1.2 : 0.6;
      context.stroke();
    }

    for (const mark of marks) {
      const active = mark.id === selected;
      context.beginPath();
      context.arc(mark.x, mark.y, mark.radius, 0, Math.PI * 2);
      if (mark.kind === 'core') {
        const glow = context.createRadialGradient(mark.x, mark.y, 0, mark.x, mark.y, mark.radius);
        glow.addColorStop(0, `rgba(${mark.color},0.42)`);
        glow.addColorStop(1, `rgba(${mark.color},0.04)`);
        context.fillStyle = glow;
        context.fill();
        context.strokeStyle = `rgba(${mark.color},0.7)`;
        context.lineWidth = 1;
        context.stroke();
      } else if (mark.status === 'ACTIVE' || active) {
        context.fillStyle = `rgba(${mark.color},${active ? 0.9 : 0.62})`;
        context.fill();
      } else {
        context.strokeStyle = `rgba(${mark.color},${mark.status === 'DECLARED' ? 0.62 : 0.3})`;
        context.lineWidth = mark.status === 'DECLARED' ? 1.4 : 1;
        context.setLineDash(mark.status === 'DECLARED' ? [] : [2, 3]);
        context.stroke();
        context.setLineDash([]);
      }
    }

    context.font = '600 9px ui-monospace, "SFMono-Regular", monospace';
    context.textAlign = 'center';
    for (const mark of marks) {
      if (mark.kind !== 'node') continue;
      const outward = mark.radius + 9;
      const lx = mark.x + Math.cos(mark.angle) * outward;
      const ly = mark.y + Math.sin(mark.angle) * outward;
      const dimmed = selected !== null && mark.id !== selected;
      context.fillStyle = `rgba(${mark.color},${dimmed ? 0.4 : 0.92})`;
      context.fillText(String(mark.label), lx, ly + 3);
    }
    context.textAlign = 'start';
  };

  const loop = () => {
    if (!running) return;
    spin += 0.0016;
    layout();
    paint();
    frame = window.requestAnimationFrame(loop);
  };

  const start = () => {
    if (running || reduceMotion || state.kind !== 'ready') return;
    running = true;
    frame = window.requestAnimationFrame(loop);
  };

  const stop = () => {
    running = false;
    window.cancelAnimationFrame(frame);
  };

  /* ------------------------------------------------------------------ capa de texto */
  const renderLegend = () => {
    while (legendHost.firstChild) legendHost.removeChild(legendHost.firstChild);
    if (state.kind === 'loading') {
      legendHost.appendChild(make('p', 'universe-state', 'Consultando los registros del runtime…'));
      setText(readout, 'SIN LECTURA TODAVÍA');
      return;
    }
    if (state.kind === 'error') {
      legendHost.appendChild(
        make(
          'p',
          'universe-state is-error',
          `SIN DATOS: ${ENDPOINT} no respondió (${state.reason}).`
        )
      );
      const retry = make('button', 'universe-retry', 'REINTENTAR');
      retry.type = 'button';
      retry.addEventListener('click', () => {
        state = { kind: 'loading' };
        renderLegend();
        void load();
      });
      legendHost.appendChild(retry);
      setText(readout, `MAPA NO DISPONIBLE · ${state.reason}`);
      return;
    }

    const universe = state.universe;
    const groups = federationsOf(universe);

    const nodeRow = make('div', 'universe-group');
    nodeRow.appendChild(make('h4', 'universe-group-title', 'NODOS CROWN POR FEDERACIÓN'));
    const list = make('ul', 'universe-items');
    groups.forEach(([label, members], groupIndex) => {
      const item = make('li', 'universe-item');
      item.appendChild(swatch(palette[groupIndex % palette.length], 'ring'));
      item.appendChild(make('span', 'universe-item-label', `${label} · ${members.length}`));
      list.appendChild(item);
    });
    nodeRow.appendChild(list);
    legendHost.appendChild(nodeRow);

    const picker = make('div', 'universe-picker');
    picker.appendChild(make('h4', 'universe-group-title', 'SELECCIONA UN NODO'));
    const buttons = make('div', 'universe-chips');
    for (const node of universe.nodes) {
      const chip = make('button', 'universe-chip', `${node.icon ? `${node.icon} ` : ''}${node.id}`);
      chip.type = 'button';
      chip.setAttribute('aria-pressed', String(node.id === selected));
      const show = () => {
        selected = node.id;
        for (const chip2 of buttons.querySelectorAll('.universe-chip')) {
          chip2.setAttribute('aria-pressed', String(chip2 === chip));
        }
        setText(
          readout,
          `${node.id} · ${node.name} — ${node.role} · ${node.federation} · peso ${node.weight} · ${node.status}`
        );
        paint();
      };
      chip.addEventListener('click', show);
      chip.addEventListener('focus', show);
      chip.addEventListener('pointerenter', show);
      buttons.appendChild(chip);
    }
    picker.appendChild(buttons);
    legendHost.appendChild(picker);

    const experts = Array.isArray(universe.expertModules) ? universe.expertModules : [];
    const counts = experts.reduce((accumulator, expert) => {
      const key = riskColor[expert.riskCeiling] ? expert.riskCeiling : 'MEDIUM';
      accumulator[key] = (accumulator[key] || 0) + 1;
      return accumulator;
    }, {});
    const expertRow = make('div', 'universe-group');
    expertRow.appendChild(
      make('h4', 'universe-group-title', `MÓDULOS EXPERTOS (${experts.length}) · TECHO DE RIESGO`)
    );
    const expertList = make('ul', 'universe-items');
    for (const ceiling of ['HIGH', 'MEDIUM', 'LOW']) {
      if (!counts[ceiling]) continue;
      const item = make('li', 'universe-item');
      item.appendChild(swatch(riskColor[ceiling], 'dot'));
      item.appendChild(make('span', 'universe-item-label', `${ceiling} · ${counts[ceiling]}`));
      expertList.appendChild(item);
    }
    expertRow.appendChild(expertList);
    legendHost.appendChild(expertRow);

    const subsystems = Array.isArray(universe.subsystems) ? universe.subsystems : [];
    const systemRow = make('div', 'universe-group');
    systemRow.appendChild(make('h4', 'universe-group-title', 'REGISTROS DEL PROCESO'));
    const systemList = make('ul', 'universe-items');
    for (const item of subsystems) {
      const row = make('li', 'universe-item');
      row.appendChild(swatch('236,244,252', 'dot'));
      row.appendChild(make('span', 'universe-item-label', `${item.label} · ${item.count}`));
      row.appendChild(make('span', 'universe-item-state', item.state || 'UNKNOWN'));
      systemList.appendChild(row);
    }
    systemRow.appendChild(systemList);
    legendHost.appendChild(systemRow);

    const evidence = universe.evidence;
    if (evidence && typeof evidence === 'object') {
      const evidenceRow = make('div', 'universe-group');
      evidenceRow.appendChild(
        make('h4', 'universe-group-title', 'EVIDENCIA BOOKPI (DEL REGISTRO REAL)')
      );
      const text = make(
        'p',
        'universe-note',
        `sumidero ${evidence.configured ? 'ADJUNTO' : 'NO ADJUNTO'} · eventos sellados ${evidence.sealedEvents}` +
          ` · fallos de sello ${evidence.sealFailures} · resultados retenidos ${evidence.withheldResults}`
      );
      evidenceRow.appendChild(text);
      legendHost.appendChild(evidenceRow);
    }

    setText(
      readout,
      universe.provenance ||
        `MAPA DERIVADO DE ${ENDPOINT}: ${universe.nodes.length} nodos, ${experts.length} módulos.`
    );
  };

  /* ---------------------------------------------------------------------- montaje */
  if (context) {
    if (typeof ResizeObserver === 'function') {
      new ResizeObserver(() => {
        resize();
        paint();
      }).observe(canvas.parentElement || canvas);
    } else {
      window.addEventListener('resize', () => {
        resize();
        paint();
      });
    }
    if (typeof IntersectionObserver === 'function') {
      new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (entry.isIntersecting) {
              resize();
              paint();
              start();
            } else {
              stop();
            }
          }
        },
        { threshold: 0 }
      ).observe(canvas);
    }
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        stop();
        return;
      }
      if (state.kind === 'ready' && Date.now() - state.at > STALE_MS) void load();
      start();
    });
    canvas.parentElement?.addEventListener('pointermove', (event) => {
      if (state.kind !== 'ready' || marks.length === 0) return;
      const rect = canvas.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      let best = null;
      let bestDistance = Number.POSITIVE_INFINITY;
      for (const mark of marks) {
        if (mark.kind === 'core') continue;
        const distance = Math.hypot(mark.x - x, mark.y - y);
        if (distance < Math.max(14, mark.radius + 8) && distance < bestDistance) {
          best = mark;
          bestDistance = distance;
        }
      }
      if (best === null) return;
      selected = best.id;
      paint();
      setText(
        readout,
        [best.title, best.role, best.federation, best.status].filter(Boolean).join(' · ')
      );
    });
    canvas.parentElement?.addEventListener('pointerleave', () => {
      paint();
    });
  }

  void load();

  window.IsabellaUniverse = {
    schema: SCHEMA,
    endpoint: ENDPOINT,
    reload: () => load(),
    snapshot: () => (state.kind === 'ready' ? state.universe : null),
    marks: () => marks.length,
  };
})();
