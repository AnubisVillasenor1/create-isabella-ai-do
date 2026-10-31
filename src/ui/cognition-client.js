/* Isabella · cliente cognitivo compartido — state: wired | tested (contract).
 * Una sola ruta de generación para la interfaz clásica y la plataforma:
 * SSE progresivo con fallback JSON, historial acotado y traza Ω∞ de solo lectura.
 * No concede autoridad, no ejecuta herramientas y no interpreta el historial
 * como instrucciones. */
(() => {
  'use strict';

  const ENDPOINTS = Object.freeze({
    stream: '/api/v1/cognition/stream',
    route: '/api/v1/cognition/route',
  });
  const MAX_INPUT = 20_000;
  const MAX_HISTORY_TURNS = 16;
  const MAX_HISTORY_CHARS = 6_000;

  const bounded = (value, max) => String(value ?? '').slice(0, max);

  const normalizeHistory = (history) => {
    if (!Array.isArray(history)) return [];
    return history
      .flatMap((turn) => {
        if (!turn || (turn.role !== 'user' && turn.role !== 'assistant')) return [];
        const content = bounded(turn.content, MAX_HISTORY_CHARS).trim();
        return content ? [{ role: turn.role, content }] : [];
      })
      .slice(-MAX_HISTORY_TURNS);
  };

  const buildPayload = (options = {}) => {
    const body = { input: bounded(options.input, MAX_INPUT) };
    if (typeof options.sessionId === 'string' && options.sessionId.trim()) {
      body.sessionId = bounded(options.sessionId.trim(), 128);
    }
    body.modelEngine = options.modelEngine === 'sovereign' ? 'sovereign' : 'auto';
    body.focusLens =
      typeof options.focusLens === 'string' && options.focusLens.trim()
        ? bounded(options.focusLens.trim(), 32)
        : 'general';
    const history = normalizeHistory(options.history);
    if (history.length > 0) body.history = history;
    return body;
  };

  const token = (value) =>
    typeof value === 'string' && value.trim() ? bounded(value.trim(), 48) : null;
  const count = (value) =>
    Number.isFinite(value) ? Math.max(0, Math.min(999, Math.round(value))) : 0;
  const fraction = (value) => (Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : null);

  const compactTrace = (omega, blocked) => {
    if (!omega || typeof omega !== 'object') return null;
    const plan = omega.plan && typeof omega.plan === 'object' ? omega.plan : {};
    const context = omega.context && typeof omega.context === 'object' ? omega.context : {};
    const quality = omega.quality && typeof omega.quality === 'object' ? omega.quality : null;
    const reflection =
      omega.reflection && typeof omega.reflection === 'object' ? omega.reflection : null;
    const governance =
      omega.outputGovernance && typeof omega.outputGovernance === 'object'
        ? omega.outputGovernance
        : null;
    const reasoning =
      omega.reasoning && typeof omega.reasoning === 'object' ? omega.reasoning : null;
    return {
      strategy: token(plan.strategy),
      intent: token(plan.intent),
      risk: token(plan.risk),
      steps: count(Array.isArray(plan.steps) ? plan.steps.length : 0),
      budgetMs: Number.isFinite(plan.budgetMs) ? plan.budgetMs : null,
      estimatedMs: Number.isFinite(plan.estimatedMs) ? plan.estimatedMs : null,
      contextHits: count(Array.isArray(context.hits) ? context.hits.length : 0),
      contextCacheHit: context.cacheHit === true,
      quality: quality ? fraction(quality.score) : null,
      qualityVerdict: quality ? token(quality.verdict) : null,
      reflection: reflection ? token(reflection.verdict) : null,
      governance: governance ? token(governance.verdict) : null,
      contradictions:
        reasoning && Number.isFinite(reasoning.contradictions)
          ? count(reasoning.contradictions)
          : null,
      consistent:
        reasoning && typeof reasoning.consistent === 'boolean' ? reasoning.consistent : null,
      authority: token(omega.authority),
      blocked: blocked === true,
      elapsedMs:
        omega.latency && Number.isFinite(omega.latency.elapsedMs) ? omega.latency.elapsedMs : null,
    };
  };

  const parseBlocks = (buffer, flush) => {
    const parts = buffer.split(/\r?\n\r?\n/);
    const remainder = flush ? '' : parts.pop() || '';
    const events = [];
    for (const block of parts) {
      if (!block.trim()) continue;
      let event = 'message';
      const dataLines = [];
      for (const line of block.split(/\r?\n/)) {
        if (line.startsWith('event:')) event = line.slice(6).trim();
        else if (line.startsWith('data:')) dataLines.push(line.slice(5).trimStart());
      }
      if (dataLines.length === 0) continue;
      try {
        events.push({ event, data: JSON.parse(dataLines.join('\n')) });
      } catch {
        /* A malformed frame is discarded; the transport continues with the next one. */
      }
    }
    return { events, remainder };
  };

  const readJson = async (response) => {
    try {
      return await response.json();
    } catch {
      return null;
    }
  };

  const failure = async (response) => {
    const data = await readJson(response);
    const error = new Error(
      typeof data?.error === 'string' ? data.error : `HTTP_${response.status}`
    );
    error.status = response.status;
    return error;
  };

  const streamRequest = async (payload, signal, emit) => {
    let response;
    try {
      response = await fetch(ENDPOINTS.stream, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          accept: 'text/event-stream',
        },
        body: JSON.stringify(payload),
        signal,
      });
    } catch (error) {
      if (error?.name === 'AbortError' || signal?.aborted) throw error;
      const wrapped = new Error('STREAM_UNREACHABLE');
      wrapped.cause = error;
      throw wrapped;
    }
    if (!response.ok) throw await failure(response);
    const contentType = response.headers.get('content-type') || '';
    if (!response.body || !contentType.includes('text/event-stream')) {
      throw new Error('STREAM_UNSUPPORTED');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let content = '';
    let chunks = 0;
    let delivered = false;
    let completed = false;
    let metaData = null;
    let doneData = null;
    let omega = null;

    const process = (flush) => {
      const parsed = parseBlocks(buffer, flush);
      buffer = parsed.remainder;
      for (const frame of parsed.events) {
        const data = frame.data && typeof frame.data === 'object' ? frame.data : {};
        if (frame.event === 'meta') {
          metaData = data;
          if (data.omegaRuntime) omega = data.omegaRuntime;
          emit({ type: 'meta', data, trace: compactTrace(omega, data.omegaBlocked === true) });
          continue;
        }
        if (frame.event === 'chunk') {
          const text = typeof data.text === 'string' ? data.text : '';
          if (!text) continue;
          content += text;
          chunks += 1;
          delivered = true;
          emit({ type: 'chunk', text, data });
          continue;
        }
        if (frame.event === 'done') {
          doneData = data;
          completed = true;
          if (data.omegaRuntime) omega = data.omegaRuntime;
          emit({ type: 'done', data, trace: compactTrace(omega, data.omegaBlocked === true) });
          continue;
        }
        if (frame.event === 'error') {
          const error = new Error(typeof data.error === 'string' ? data.error : 'STREAM_FAILED');
          error.delivered = delivered;
          throw error;
        }
      }
    };

    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        process(false);
      }
      buffer += decoder.decode();
      process(true);
    } finally {
      try {
        reader.releaseLock();
      } catch {
        /* already released */
      }
    }

    if (!completed) {
      const error = new Error(content ? 'STREAM_INCOMPLETE' : 'STREAM_EMPTY');
      error.delivered = delivered;
      throw error;
    }

    const blocked = doneData?.omegaBlocked === true || doneData?.success === false;
    const trace = compactTrace(omega, blocked);
    return {
      text: content,
      engine: typeof doneData?.responseEngine === 'string' ? doneData.responseEngine : '—',
      intent:
        typeof doneData?.fastLaneInfo?.intent === 'string' ? doneData.fastLaneInfo.intent : null,
      latencyMs: Number.isFinite(doneData?.latencyMs) ? doneData.latencyMs : null,
      chunks: Number.isFinite(doneData?.chunks) ? doneData.chunks : chunks,
      fastLane: doneData?.fastLane === true,
      cacheHit: false,
      admitted: doneData?.success !== false,
      blocked,
      omega,
      trace,
      trafficLight:
        (metaData && metaData.trafficLight) || (doneData && doneData.trafficLight) || null,
      contextBudget:
        (doneData && doneData.contextBudget) || (metaData && metaData.contextBudget) || null,
      requestId: doneData?.requestId || metaData?.requestId || null,
      streamMode: 'sse',
    };
  };

  const jsonRequest = async (payload, signal, emit) => {
    const startedAt = performance.now();
    let response;
    try {
      response = await fetch(ENDPOINTS.route, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          accept: 'application/json',
        },
        body: JSON.stringify(payload),
        signal,
      });
    } catch (error) {
      if (error?.name === 'AbortError' || signal?.aborted) throw error;
      const wrapped = new Error('ROUTE_UNREACHABLE');
      wrapped.cause = error;
      throw wrapped;
    }
    const data = await readJson(response);
    if (!response.ok) {
      const error = new Error(
        typeof data?.error === 'string' ? data.error : `HTTP_${response.status}`
      );
      error.status = response.status;
      throw error;
    }
    const output =
      typeof data?.output === 'string'
        ? data.output
        : typeof data?.generativeNarrative === 'string'
          ? data.generativeNarrative
          : '';
    if (!output.trim()) {
      throw new Error(typeof data?.error === 'string' ? data.error : 'INVALID_RESPONSE');
    }
    const timing = /cognition;dur=([\d.]+)/.exec(response.headers.get('server-timing') || '');
    const blocked = data?.omegaBlocked === true || data?.success === false;
    const omega = data?.omegaRuntime || null;
    const trace = compactTrace(omega, blocked);
    emit({ type: 'chunk', text: output, data });
    emit({ type: 'done', data, trace });
    return {
      text: output,
      engine: typeof data?.responseEngine === 'string' ? data.responseEngine : '—',
      intent: data?.fastLaneInfo?.intent || data?.nativeRouting?.category || 'general',
      latencyMs: timing ? Number(timing[1]) : Math.round(performance.now() - startedAt),
      chunks: 1,
      fastLane: data?.fastLane === true,
      cacheHit: data?.cacheHit === true,
      admitted: data?.success !== false,
      blocked,
      omega,
      trace,
      trafficLight: data?.trafficLight || null,
      contextBudget: data?.contextBudget || null,
      requestId: typeof data?.requestId === 'string' ? data.requestId : null,
      streamMode: 'json',
    };
  };

  const generate = async (options = {}) => {
    const payload = buildPayload(options.payload ?? options);
    const signal = options.signal;
    const stream = options.stream !== false;
    const onEvent = typeof options.onEvent === 'function' ? options.onEvent : () => {};
    const emit = (event) => {
      try {
        onEvent(event);
      } catch {
        /* Presentation failures must not corrupt the transport. */
      }
    };
    if (stream) {
      try {
        return await streamRequest(payload, signal, emit);
      } catch (error) {
        if (error?.name === 'AbortError' || signal?.aborted) throw error;
        if (error?.delivered === true) throw error;
        if (error?.status === 413 || error?.status === 429) throw error;
        emit({
          type: 'fallback',
          reason: error instanceof Error ? error.message : 'STREAM_UNAVAILABLE',
        });
      }
    }
    return jsonRequest(payload, signal, emit);
  };

  /* Canonical browser voice policy — mirrors src/inference/voice-profile.ts.
   * One female es-MX identity: no page may select another voice. */
  const VOICE_LANGUAGE = 'es-MX';
  const VOICE_RATE = 0.93;
  const VOICE_PITCH = 1.0;
  const PREFERRED_VOICE_NAMES = [
    'sabina',
    'paulina',
    'monica',
    'mónica',
    'marisol',
    'helena',
    'luciana',
    'dalia',
    'elvira',
    'salome',
    'ximena',
    'valentina',
    'camila',
    'lucia',
    'sofia',
    'sofía',
  ];
  const MALE_VOICE_NAME =
    /\b(jorge|diego|carlos|pablo|javier|enrique|raul|raúl|miguel|pedro|juan|alvaro|álvaro|marcos|lucas|mateo|andres|andrés|ricardo|fernando|gonzalo|roberto|eduardo|alex|daniel|david|mark|george|james|fred|ralph|thomas|oliver|arthur|eric|liam|guy|ryan|brian|christopher|steffan|aaron|tony|mason|troy|atlas|briggs|calum|cillian|mikail|mitch|quinn|thunder|zubenelgenubi|sadachbia|sadaltager)\b/i;
  const PREFERRED_VOICE_LANGS = ['es-MX', 'es-419', 'es-US', 'es-ES'];

  const scoreBrowserVoice = (voice) => {
    const lang = String(voice?.lang || '').replace('_', '-');
    if (!/^es/i.test(lang)) return -1;
    const name = String(voice?.name || '');
    if (MALE_VOICE_NAME.test(name)) return -1;
    const langIndex = PREFERRED_VOICE_LANGS.findIndex(
      (candidate) => candidate.toLowerCase() === lang.toLowerCase()
    );
    const named = PREFERRED_VOICE_NAMES.some((candidate) => name.toLowerCase().includes(candidate))
      ? 100
      : 0;
    return named + (langIndex >= 0 ? 40 - langIndex * 5 : 20) + (voice?.localService ? 2 : 0);
  };

  const listBrowserVoices = () => {
    try {
      return Array.from(window.speechSynthesis?.getVoices?.() || []);
    } catch {
      return [];
    }
  };

  const pickBrowserVoice = (voices = listBrowserVoices()) => {
    let best = null;
    let bestScore = 0;
    for (const voice of voices) {
      const score = scoreBrowserVoice(voice);
      if (score > bestScore) {
        best = voice;
        bestScore = score;
      }
    }
    return best;
  };

  const voicesReady = () =>
    new Promise((resolve) => {
      const synth = window.speechSynthesis;
      if (!synth) {
        resolve([]);
        return;
      }
      const current = listBrowserVoices();
      if (current.length > 0) {
        resolve(current);
        return;
      }
      let settled = false;
      const done = () => {
        if (settled) return;
        settled = true;
        try {
          synth.removeEventListener?.('voiceschanged', done);
        } catch {
          /* listener already gone */
        }
        resolve(listBrowserVoices());
      };
      try {
        synth.addEventListener?.('voiceschanged', done, { once: true });
      } catch {
        /* older engines lack addEventListener */
      }
      setTimeout(done, 800);
    });

  const applyBrowserVoice = (utterance, voices = listBrowserVoices()) => {
    if (!utterance) return utterance;
    utterance.lang = VOICE_LANGUAGE;
    utterance.rate = VOICE_RATE;
    utterance.pitch = VOICE_PITCH;
    const voice = pickBrowserVoice(voices);
    if (voice) utterance.voice = voice;
    return utterance;
  };

  const speakWithCanonicalVoice = async (text, handlers = {}) => {
    const clean = String(text ?? '').trim();
    const synth = window.speechSynthesis;
    if (!clean || !synth) return false;
    const voices = await voicesReady();
    return new Promise((resolve) => {
      const utterance = new SpeechSynthesisUtterance(clean);
      applyBrowserVoice(utterance, voices);
      utterance.onend = () => {
        try {
          handlers.onEnd?.();
        } finally {
          resolve(true);
        }
      };
      utterance.onerror = () => {
        try {
          handlers.onError?.();
        } finally {
          resolve(false);
        }
      };
      synth.speak(utterance);
    });
  };

  window.IsabellaCognition = Object.freeze({
    version: '1.0.0',
    endpoints: ENDPOINTS,
    buildPayload,
    normalizeHistory,
    compactTrace,
    generate,
  });

  window.IsabellaVoice = Object.freeze({
    id: 'isabella-esmx-female-v1',
    language: VOICE_LANGUAGE,
    rate: VOICE_RATE,
    pitch: VOICE_PITCH,
    pick: pickBrowserVoice,
    apply: applyBrowserVoice,
    speak: speakWithCanonicalVoice,
    voicesReady,
  });
})();
