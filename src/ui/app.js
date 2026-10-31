const byId = (id) => document.getElementById(id);

// DOM Elements
const intro = byId('cinematicIntro');
const immersionGate = byId('immersionGate');
const immersionConsent = byId('immersionConsent');
const immersionConsentStatus = byId('immersionConsentStatus');
const introVideo = byId('introVideo');
const introScenes = [...document.querySelectorAll('.intro-scene')];
const introProgressBar = byId('introProgressBar');
const introSceneLabel = byId('introSceneLabel');
const introTimecode = byId('introTimecode');
const skipIntro = byId('skipIntro');
const introQuickExit = byId('introQuickExit');
const newChat = byId('newChat');
const enterChat = byId('enterChat');
const commandLauncher = byId('commandLauncher');
const commandPalette = byId('commandPalette');
const commandSearch = byId('commandSearch');
const commandList = byId('commandList');
const studio = byId('studio');
const draftShelf = byId('draftShelf');
const exportChat = byId('exportChat');
const clearChat = byId('clearChat');
const attachText = byId('attachText');
const localFile = byId('localFile');
const attachmentChip = byId('attachmentChip');
const attachmentName = byId('attachmentName');
const removeAttachment = byId('removeAttachment');
const clearDrafts = byId('clearDrafts');
const contextInspector = byId('contextInspector');
const systemInspector = byId('systemInspector');
const closeSystemInspector = byId('closeSystemInspector');
const sessionBadge = byId('sessionBadge');
const inspectorRuntime = byId('inspectorRuntime');
const inspectorSession = byId('inspectorSession');
const inspectorVoice = byId('inspectorVoice');
const inspectorAttachment = byId('inspectorAttachment');
const voiceCapability = byId('voiceCapability');
const navToggle = byId('navToggle');
const primaryLinks = byId('primaryLinks');
const runtimeStatus = byId('runtimeStatus');
const soundToggle = byId('soundToggle');
const chatForm = byId('chatForm');
const prompt = byId('prompt');
const mic = byId('mic');

const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
const INTRO_SCENE_MS = 4_200; // 4.2 seconds per scene (matches test expectation)
const MAX_LOCAL_FILE_BYTES = 25 * 1024;
const MAX_LOCAL_FILE_CHARS = 12_000;
const MAX_COMBINED_PROMPT_CHARS = 18_000;
const DRAFT_STORAGE_KEY = 'isabella.drafts';
const introLabels = [
  'SECUENCIA 01 · APERTURA',
  'SECUENCIA 02 · EL ORIGEN',
  'SECUENCIA 03 · LA CALLE',
  'SECUENCIA 04 · NUESTRA GENTE',
  'SECUENCIA 05 · RESILIENCIA',
  'SECUENCIA 06 · IDENTIDAD',
  'SECUENCIA 07 · EL NÚCLEO',
  'SECUENCIA 08 · ARQUITECTURA',
  'SECUENCIA 09 · MEMORIA VIVA',
  'SECUENCIA 10 · PROPÓSITO',
  'SECUENCIA 11 · COMPROMISO',
  'SECUENCIA 12 · ACCESO',
];

const formatIntroTime = (milliseconds) => {
  const seconds = Math.floor(Math.max(0, milliseconds) / 1000);
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
};

// ─── Cinematic intro ────────────────────────────────────────────────────────────────────────────
// Single, flat media lifecycle. One rAF loop drives the narrative from the raw media clock
// (introVideo.currentTime * 1000); nothing else schedules frames. Consent starts playback at once
// and the dialog leaves the screen so the video is shown full view.
let introMediaFallbackLocked = false;
let introStartedAt = 0;
let introLastVideoTime = -1;
let introLastVideoProgressAt = 0;
let introWatchdog = 0;
let introWaitTimer = 0;
let introRunning = false;
let introLastScene = -1;
let introLastSecond = -1;
const introFallbackTotalMs = INTRO_SCENE_MS * introScenes.length;

const introTotalDurationMs = () =>
  introVideo && Number.isFinite(introVideo.duration) && introVideo.duration > 1
    ? introVideo.duration * 1000
    : introFallbackTotalMs;

const introElapsedMs = () => {
  if (introMediaFallbackLocked || !introVideo)
    return Math.max(0, performance.now() - introStartedAt);
  return Math.max(0, introVideo.currentTime * 1000);
};

const markIntroVideoReady = () => {
  window.clearTimeout(introWaitTimer);
  if (introMediaFallbackLocked) return;
  intro?.classList.add('media-ready');
  intro?.classList.remove('media-stalled', 'media-unavailable');
  introLastVideoProgressAt = performance.now();
};

const paintIntro = (elapsedMs) => {
  const introTotalMs = introTotalDurationMs();
  const boundedElapsed = Math.min(elapsedMs, introTotalMs);
  const idx = Math.min(
    introScenes.length - 1,
    Math.floor((boundedElapsed / Math.max(1, introTotalMs)) * introScenes.length)
  );
  if (idx !== introLastScene) {
    introLastScene = idx;
    introScenes.forEach((scene, i) => {
      const active = i === idx;
      scene.classList.toggle('is-active', active);
      scene.setAttribute('aria-hidden', String(!active));
      scene.inert = !active;
    });
    const sceneIndex = idx;
    intro.dataset.scene = String(sceneIndex);
    if (introSceneLabel)
      introSceneLabel.textContent =
        introLabels[idx] || `SECUENCIA ${String(idx + 1).padStart(2, '0')}`;
  }
  if (introProgressBar) {
    const sceneProgress = ((boundedElapsed / Math.max(1, introTotalMs)) * introScenes.length) % 1;
    introProgressBar.style.width = `${(sceneProgress * 100).toFixed(1)}%`;
  }
  const second = Math.floor(boundedElapsed / 1000);
  if (introTimecode && second !== introLastSecond) {
    introLastSecond = second;
    introTimecode.textContent = `${formatIntroTime(boundedElapsed)} / ${formatIntroTime(introTotalMs)}`;
  }
  return elapsedMs >= introTotalMs;
};

const finishIntro = () => {
  introRunning = false;
  window.clearInterval(introWatchdog);
  window.clearTimeout(introWaitTimer);
  introVideo?.pause();
  immersionGate?.classList.add('is-accepted');
  intro?.classList.add('is-dismissed');
  intro?.classList.remove('is-playing');
  document.body.classList.remove('intro-lock');
  byId('enterChat')?.focus({ preventScroll: true });
};

const renderIntroFrame = () => {
  if (!introRunning) return;
  if (!document.hidden && paintIntro(introElapsedMs())) {
    finishIntro();
    return;
  }
  window.requestAnimationFrame(renderIntroFrame);
};

const startIntroMedia = async () => {
  if (!introVideo) return;
  window.clearInterval(introWatchdog);
  introVideo.preload = 'auto';
  if (introVideo.readyState === HTMLMediaElement.HAVE_NOTHING) introVideo.load();
  // Unmute and play synchronously inside the consent gesture (browsers refuse audio after an await).
  // The file is a +faststart 540p rendition that has been preloading since the dialog appeared.
  introVideo.muted = false;
  introVideo.volume = 0.82;
  introLastVideoTime = introVideo.currentTime;
  introLastVideoProgressAt = performance.now();
  const playing = introVideo.play();

  // A stalled network must never pause or hide the picture: the browser re-buffers by itself and the
  // narrative clock follows the media clock. The watchdog only reports; "SALTAR INTRO" stays available.
  introWatchdog = window.setInterval(() => {
    if (!introVideo || introVideo.ended || document.hidden || introVideo.paused) return;
    const now = performance.now();
    if (introVideo.currentTime !== introLastVideoTime) {
      introLastVideoTime = introVideo.currentTime;
      introLastVideoProgressAt = now;
      intro?.classList.remove('media-stalled');
      return;
    }
    if (
      now - introLastVideoProgressAt > 1400 &&
      introVideo.readyState < HTMLMediaElement.HAVE_FUTURE_DATA
    ) {
      intro?.classList.add('media-stalled');
    }
  }, 500);

  try {
    await playing;
  } catch {
    introVideo.muted = true; // autoplay-with-sound refused: keep the picture running, silent
    try {
      await introVideo.play();
    } catch {
      introMediaFallbackLocked = true;
      introStartedAt = performance.now() - Math.max(0, introVideo.currentTime * 1000);
      intro?.classList.add('media-unavailable', 'media-stalled');
      window.clearInterval(introWatchdog);
      return;
    }
  }
  markIntroVideoReady();
};

const beginImmersion = () => {
  if (introRunning || !immersionConsent?.checked) return;
  introRunning = true;
  immersionGate?.classList.add('is-accepted'); // dialog leaves: full view of the video
  intro?.classList.add('is-playing');
  document.body.classList.add('intro-lock');
  paintIntro(0);
  window.requestAnimationFrame(renderIntroFrame);
  startIntroMedia();
};

const updateImmersionConsent = () => {
  const accepted = Boolean(immersionConsent?.checked);
  if (immersionConsentStatus) {
    immersionConsentStatus.textContent = accepted
      ? 'Autorización registrada. Iniciando la experiencia…'
      : 'La reproducción permanece desactivada hasta que la autorices.';
  }
  if (accepted) beginImmersion();
};
immersionConsent?.addEventListener('change', updateImmersionConsent);

introVideo?.addEventListener('waiting', () => {
  window.clearTimeout(introWaitTimer);
  // Only surface the fallback if buffering really persists; brief waits must not hide the picture.
  introWaitTimer = window.setTimeout(() => {
    if (introRunning && introVideo.readyState < HTMLMediaElement.HAVE_FUTURE_DATA)
      intro?.classList.add('media-stalled');
  }, 1200);
});
introVideo?.addEventListener('playing', markIntroVideoReady);
introVideo?.addEventListener('canplay', markIntroVideoReady);
introVideo?.addEventListener('timeupdate', () => {
  if (!introVideo) return;
  introLastVideoTime = introVideo.currentTime;
  introLastVideoProgressAt = performance.now();
});
introVideo?.addEventListener('error', () => {
  introMediaFallbackLocked = true;
  introStartedAt = performance.now() - Math.max(0, (introVideo?.currentTime || 0) * 1000);
  window.clearInterval(introWatchdog);
  intro?.classList.add('media-unavailable', 'media-stalled');
});
introVideo?.addEventListener('ended', finishIntro);
document.addEventListener('visibilitychange', () => {
  if (
    !document.hidden &&
    introRunning &&
    introVideo &&
    introVideo.paused &&
    !introVideo.ended &&
    !introMediaFallbackLocked
  ) {
    introVideo.play().catch(() => {});
  }
});

if (intro) {
  const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const cinematicDisabled = new URLSearchParams(window.location.search).get('intro') === '0';

  if (reducedMotion || cinematicDisabled) {
    finishIntro();
  } else {
    document.body.classList.add('intro-lock');
    introScenes.forEach((scene, i) => {
      const inactive = i !== 0;
      scene.setAttribute('aria-hidden', String(inactive));
      scene.inert = inactive;
    });

    const trapImmersionDialogFocus = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        finishIntro();
        return;
      }
      if (event.key !== 'Tab' || !immersionGate) return;
      const focusable = [
        ...immersionGate.querySelectorAll(
          'input:not(:disabled), button:not(:disabled), a[href], [tabindex]:not([tabindex="-1"])'
        ),
      ].filter(
        (node) => !node.hasAttribute('hidden') && node.getAttribute('aria-hidden') !== 'true'
      );
      if (!focusable.length) {
        event.preventDefault();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    immersionGate?.addEventListener('keydown', trapImmersionDialogFocus);
    immersionConsent?.focus({ preventScroll: true });
    skipIntro?.addEventListener('click', finishIntro);
    introQuickExit?.addEventListener('click', finishIntro);
    intro.querySelector('.intro-enter')?.addEventListener('click', finishIntro);
  }
}

// ... rest of the app.js (side rails, chat, etc.)
const closeSideRails = (exceptId = '') => {
  document.querySelectorAll('.side-rail').forEach((rail) => {
    if (rail.id !== exceptId) rail.classList.remove('is-open');
    syncRailMode(rail, rail.id === exceptId && rail.classList.contains('is-open'));
    const launcher = document.querySelector(`[aria-controls="${rail.id}"]`);
    if (launcher)
      launcher.setAttribute(
        'aria-expanded',
        String(rail.id === exceptId && rail.classList.contains('is-open'))
      );
  });
};
const syncRailMode = (rail, open) => {
  if (!rail) return;
  rail.setAttribute('aria-hidden', String(!open));
  if (open) rail.removeAttribute('inert');
  else rail.setAttribute('inert', '');
};
document.querySelectorAll('.rail-launcher').forEach((launcher) => {
  launcher.style.setProperty('display', 'flex', 'important');
  const controlledRail = byId(launcher.getAttribute('aria-controls') || '');
  controlledRail?.style.setProperty('display', 'flex', 'important');
  launcher.addEventListener('click', () => {
    const targetId = launcher.getAttribute('aria-controls');
    const target = targetId ? byId(targetId) : null;
    if (!target) return;
    const opening = !target.classList.contains('is-open');
    closeSideRails(opening ? target.id : '');
    target.classList.toggle('is-open', opening);
    syncRailMode(target, opening);
    launcher.setAttribute('aria-expanded', String(opening));
  });
});
document.querySelectorAll('.side-rail a[href^="#"]').forEach((link) => {
  link.addEventListener('click', () => closeSideRails());
});
document.addEventListener('click', (event) => {
  if (!(event.target instanceof Element)) return;
  if (event.target.closest('.side-rail, .rail-launcher')) return;
  closeSideRails();
});
navToggle?.addEventListener('click', () => {
  const expanded = navToggle.getAttribute('aria-expanded') === 'true';
  navToggle.setAttribute('aria-expanded', String(!expanded));
  primaryLinks?.classList.toggle('is-open', !expanded);
});
document.querySelectorAll('.workspace-mode').forEach((button) => {
  button.setAttribute('aria-pressed', String(button.classList.contains('is-active')));
  button.addEventListener('click', () => {
    const layout = button.dataset.layout || 'chat';
    document.body.dataset.workspaceLayout = layout;
    document.querySelectorAll('.workspace-mode').forEach((item) => {
      const active = item === button;
      item.classList.toggle('is-active', active);
      item.setAttribute('aria-pressed', String(active));
    });
    if (layout === 'chat') {
      closePanel(true);
      byId('chat')?.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
      prompt?.focus();
    } else {
      openPanel(layout === 'split-2' ? 'design' : 'control');
    }
  });
});
const messages = byId('messages');
const form = byId('chatForm');
const navLinks = byId('primaryLinks');
const setRuntimeStatus = (label, state, title) => {
  if (!runtimeStatus) return;
  runtimeStatus.dataset.state = state;
  runtimeStatus.replaceChildren();
  const indicator = document.createElement('i');
  indicator.setAttribute('aria-hidden', 'true');
  const text = document.createElement('span');
  text.textContent = label;
  runtimeStatus.append(indicator, text);
};

/* ------------------------------------------------------------ chat handling */
let sessionId = crypto.randomUUID?.() || Math.random().toString(36).slice(2);
let abortController = null;

const sanitizeFileName = (value) =>
  String(value || 'archivo')
    .replace(/[^\w.\- ]+/g, '_')
    .slice(0, 80);

const exportConversation = () => {
  const nodes = [...messages.querySelectorAll('.message')];
  if (!nodes.length) return;
  const transcript = nodes
    .map((message) => {
      const speaker = message.classList.contains('user') ? 'Tú' : 'Isabella';
      const raw =
        message.querySelector('p')?.dataset.raw ||
        message.querySelector('p')?.textContent?.trim() ||
        '';
      return `## ${speaker}\n\n${raw}`;
    })
    .join('\n\n');
  const header = `# Conversación Isabella\n\n- Sesión: ${sessionId}\n- Exportado: ${new Date().toISOString()}\n- Aviso: transcripción local; no certifica verificación ni ejecución.\n\n`;
  const blob = new Blob([header + transcript + '\n'], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `isabella-conversacion-${new Date().toISOString().slice(0, 10)}.md`;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
};
exportChat?.addEventListener('click', exportConversation);
byId('contextExport')?.addEventListener('click', exportConversation);

document.addEventListener('click', (event) => {
  const button =
    event.target instanceof Element ? event.target.closest('[data-message-action]') : null;
  if (!button) return;
  const article = button.closest('.message');
  const paragraph = article?.querySelector('p');
  const raw = paragraph ? paragraph.dataset.raw || paragraph.textContent || '' : '';
  if (!raw.trim()) return;
  const action = button.dataset.messageAction;
  const restore = button.textContent;
  if (action === 'copy') {
    if (!navigator.clipboard?.writeText) return;
    navigator.clipboard
      .writeText(raw)
      .then(() => {
        button.textContent = 'Copiado';
      })
      .catch(() => {
        button.textContent = 'No disponible';
      })
      .finally(() =>
        window.setTimeout(() => {
          button.textContent = restore;
        }, 1_400)
      );
  } else if (action === 'save') {
    const saved = saveDraft(paragraph.dataset.raw || paragraph.textContent || '');
    button.textContent = saved ? 'Guardado' : 'Sin texto';
    window.setTimeout(() => {
      button.textContent = restore;
    }, 1_400);
  } else if (action === 'speak') {
    if (currentAudio || window.speechSynthesis?.speaking) stopSpeech();
    else speakMessage(raw);
  }
});

const addMessage = (text, role = 'isabella') => {
  const article = document.createElement('article');
  article.className = `message ${role}`;
  article.dataset.ts = String(Date.now());
  const avatar = document.createElement('span');
  avatar.className = 'avatar';
  avatar.setAttribute('aria-hidden', 'true');
  avatar.textContent = role === 'user' ? 'TÚ' : 'IS';
  const body = document.createElement('div');
  body.className = 'message-body';
  const speaker = document.createElement('span');
  speaker.className = 'speaker';
  speaker.textContent = role === 'user' ? 'TÚ · AHORA' : 'ISABELLA · AHORA';
  const p = document.createElement('p');
  p.textContent = text;
  body.append(speaker, p);
  article.append(avatar, body);
  messages.append(article);
  refreshWorkspaceContext();
  return p;
};

let attachment = null;
const attachmentContext = () =>
  attachment ? `\n\nArchivo adjunto: ${attachment.name}\n${attachment.text}` : '';
const paintAttachment = () => {
  if (attachmentChip) attachmentChip.hidden = !attachment;
  if (attachmentName) attachmentName.textContent = attachment ? attachment.name : '';
  if (inspectorAttachment) inspectorAttachment.textContent = attachment ? attachment.name : 'NONE';
};
const clearAttachment = () => {
  attachment = null;
  if (localFile) localFile.value = '';
  paintAttachment();
};

const readFileAsContext = async (file) => {
  if (!file) return;
  if (file.size > MAX_LOCAL_FILE_BYTES) {
    addMessage(
      `El archivo supera el límite local de ${Math.round(MAX_LOCAL_FILE_BYTES / 1024)} KB. Adjunta un fragmento más pequeño.`,
      'isabella'
    );
    if (localFile) localFile.value = '';
    return;
  }
  try {
    const contents = (await file.text()).trim();
    if (!contents) {
      addMessage(
        'El archivo no contiene texto legible. Prueba con TXT, MD, CSV, JSON o LOG.',
        'isabella'
      );
      if (localFile) localFile.value = '';
      return;
    }
    attachment = {
      name: sanitizeFileName(file.name),
      text: contents.slice(0, MAX_LOCAL_FILE_CHARS),
    };
    paintAttachment();
    prompt?.focus();
  } catch {
    addMessage(
      'No pude leer el archivo en este navegador. Verifica el formato e inténtalo de nuevo.',
      'isabella'
    );
    if (localFile) localFile.value = '';
  }
};

const sendMessage = async (text) => {
  const typed = String(text || '').trim();
  const input = `${typed}${attachmentContext()}`.trim();
  if (!input) {
    addMessage('Escribe una solicitud o adjunta un archivo para continuar.', 'isabella');
    return;
  }
  if (input.length > 18_000) {
    addMessage(
      `La solicitud con el archivo adjunto supera el límite de ${MAX_COMBINED_PROMPT_CHARS.toLocaleString('es-MX')} caracteres. Recorta el texto e inténtalo de nuevo.`,
      'isabella'
    );
    return;
  }
  const display = typed || `Archivo adjunto: ${attachment?.name || 'archivo'}`;
  const userPara = addMessage(display, 'user');
  if (window.IsabellaChatPlus?.stamp) window.IsabellaChatPlus.stamp(userPara.closest('.message'));
  clearAttachment();

  const assistantPara = addMessage('', 'isabella');
  if (window.IsabellaChatPlus?.beginPending) window.IsabellaChatPlus.beginPending(assistantPara);

  abortController = new AbortController();
  if (window.IsabellaChatPlus?.setAbort) window.IsabellaChatPlus.setAbort(abortController);
  form?.setAttribute('aria-busy', 'true');
  const startedAt = performance.now();

  let streamed = '';
  let lastPaint = 0;
  const paintStream = (force = false) => {
    if (!streamed) return;
    const now = performance.now();
    if (!force && now - lastPaint < 70) return;
    lastPaint = now;
    if (window.IsabellaChatPlus?.renderInto) {
      window.IsabellaChatPlus.renderInto(assistantPara, streamed, { animate: false });
    } else {
      assistantPara.textContent = streamed;
    }
  };

  try {
    const cognition = window.IsabellaCognition;
    if (!cognition?.generate) throw new Error('COGNITION_CLIENT_UNAVAILABLE');
    const result = await cognition.generate({
      input,
      sessionId,
      modelEngine: 'auto',
      focusLens: window.IsabellaChatPlus?.getLens?.() || 'general',
      history: [...messages.querySelectorAll('.message')]
        .slice(-16)
        .map((message) => ({
          role: message.classList.contains('user') ? 'user' : 'assistant',
          content:
            message.querySelector('p')?.dataset.raw ||
            message.querySelector('p')?.textContent ||
            '',
        }))
        .filter((turn) => turn.content.trim()),
      signal: abortController.signal,
      onEvent: (event) => {
        if (event.type === 'chunk') {
          streamed += event.text;
          paintStream();
        }
      },
    });
    if (!streamed && result.text) streamed = result.text;
    paintStream(true);
    if (window.IsabellaChatPlus?.decorate) {
      window.IsabellaChatPlus.decorate(assistantPara, {
        engine: result.engine,
        latencyMs: Number.isFinite(result.latencyMs)
          ? result.latencyMs
          : performance.now() - startedAt,
        omega: result.omega,
        trace: result.trace,
        blocked: result.blocked,
        cacheHit: result.cacheHit,
        streamMode: result.streamMode,
      });
    }
    if (window.IsabellaChatPlus?.persist) window.IsabellaChatPlus.persist();
    refreshWorkspaceContext();
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error de red';
    if (err?.name === 'AbortError') {
      const partial = streamed.trim();
      window.IsabellaChatPlus?.renderInto?.(
        assistantPara,
        partial
          ? `${partial}\n\n*Generación detenida por la persona usuaria. El texto parcial se conserva.*`
          : 'Generación detenida por la persona usuaria. El contexto de la sesión se conserva.',
        { animate: false }
      );
      return;
    }
    if (streamed.trim()) {
      window.IsabellaChatPlus?.renderInto?.(
        assistantPara,
        `${streamed}\n\n---\n*La entrega se interrumpió: ${message}. El texto recibido se conserva; puedes regenerar la respuesta.*`,
        { animate: false }
      );
      return;
    }
    if (window.IsabellaChatPlus?.renderInto) {
      window.IsabellaChatPlus.renderInto(
        assistantPara,
        `No pude completar la respuesta: ${message}. Puedes reintentarlo sin perder el contexto de esta sesión.`,
        { animate: false }
      );
    } else {
      assistantPara.textContent = `Error: ${message}`;
    }
  } finally {
    form?.removeAttribute('aria-busy');
    abortController = null;
    refreshWorkspaceContext();
  }
};

prompt?.addEventListener('keydown', (event) => {
  if (
    event.key === 'Enter' &&
    !event.shiftKey &&
    !event.nativeEvent?.isComposing &&
    event.keyCode !== 229
  ) {
    event.preventDefault();
    form?.requestSubmit();
  }
});

form?.addEventListener('submit', (e) => {
  e.preventDefault();
  const text = prompt.value.trim();
  if (!text) return;
  prompt.value = '';
  prompt.dispatchEvent(new Event('input'));
  sendMessage(text);
});

const WELCOME_TEXT =
  'Estoy aquí. Puedes escribirme o activar tu micrófono para hablar de forma natural.';

const resetConversation = ({ keepFocus } = {}) => {
  messages.querySelectorAll('.message, .empty-state').forEach((node) => node.remove());
  sessionId = crypto.randomUUID?.() || Math.random().toString(36).slice(2);
  clearAttachment();
  addMessage(WELCOME_TEXT, 'isabella');
  refreshWorkspaceContext();
  if (!keepFocus) prompt?.focus();
};
clearChat?.addEventListener('click', () => resetConversation());
newChat?.addEventListener('click', () => resetConversation());

/* ------------------------------------------------------------------ studio */
const readDrafts = () => {
  try {
    const parsed = JSON.parse(localStorage.getItem(DRAFT_STORAGE_KEY) || '[]');
    return Array.isArray(parsed)
      ? parsed
          .filter((item) => item && typeof item.code === 'string' && item.code.trim())
          .slice(0, 20)
      : [];
  } catch {
    return [];
  }
};
const writeDrafts = (list) => {
  try {
    localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(list.slice(0, 20)));
  } catch {
    /* quota or privacy mode */
  }
};
const formatStamp = (ts) => {
  const date = new Date(Number(ts) || Date.now());
  return (
    date.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' }) +
    ' · ' +
    date.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })
  );
};
const renderDrafts = () => {
  if (!draftShelf) return;
  const drafts = readDrafts();
  draftShelf.replaceChildren();
  if (!drafts.length) {
    const empty = document.createElement('p');
    empty.className = 'empty-shelf';
    empty.textContent =
      'Tus respuestas guardadas aparecerán aquí. Usa «Guardar» debajo de una respuesta para conservarla.';
    draftShelf.append(empty);
    return;
  }
  drafts.forEach((draft, index) => {
    const card = document.createElement('article');
    card.className = 'draft-card';
    const title = document.createElement('h3');
    title.textContent = draft.code.replace(/\s+/g, ' ').slice(0, 72) || 'Fragmento guardado';
    const meta = document.createElement('p');
    meta.className = 'draft-meta';
    meta.textContent = formatStamp(draft.ts);
    const preview = document.createElement('p');
    preview.className = 'draft-preview';
    preview.textContent = draft.code.length > 280 ? draft.code.slice(0, 280) + '…' : draft.code;
    const actions = document.createElement('div');
    actions.className = 'draft-actions';
    const use = document.createElement('button');
    use.type = 'button';
    use.textContent = 'Usar';
    use.addEventListener('click', () => {
      closePanel();
      prompt.value = draft.code;
      prompt.dispatchEvent(new Event('input'));
      prompt.focus();
    });
    const copy = document.createElement('button');
    copy.type = 'button';
    copy.textContent = 'Copiar';
    copy.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(draft.code);
        copy.textContent = 'Copiado';
      } catch {
        copy.textContent = 'No disponible';
      }
      window.setTimeout(() => {
        copy.textContent = 'Copiar';
      }, 1400);
    });
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.textContent = 'Eliminar';
    remove.addEventListener('click', () => {
      const next = readDrafts().filter((_, i) => i !== index);
      writeDrafts(next);
      renderDrafts();
    });
    actions.append(use, copy, remove);
    card.append(title, meta, preview, actions);
    draftShelf.append(card);
  });
};
const saveDraft = (code) => {
  const value = String(code || '').trim();
  if (!value) return false;
  const drafts = readDrafts();
  drafts.unshift({ code: value.slice(0, 8_000), ts: Date.now() });
  writeDrafts(drafts);
  renderDrafts();
  return true;
};
clearDrafts?.addEventListener('click', () => {
  if (!readDrafts().length) return;
  if (!window.confirm('¿Vaciar los fragmentos guardados en este navegador?')) return;
  writeDrafts([]);
  renderDrafts();
});

const checkHealth = async () => {
  try {
    const res = await fetch('/api/v1/health', { headers: { accept: 'application/json' } });
    if (!res.ok) {
      setRuntimeStatus('Degradado', 'warn', `HTTP ${res.status}`);
      if (inspectorRuntime) inspectorRuntime.textContent = 'DEGRADADO';
      return;
    }
    const health = await res.json().catch(() => null);
    setRuntimeStatus('En línea', 'ok', health?.node ? String(health.node) : 'Nodo activo');
    if (inspectorRuntime) inspectorRuntime.textContent = 'EN LÍNEA';
  } catch {
    setRuntimeStatus('Fuera de línea', 'error', 'Sin respuesta del nodo');
    if (inspectorRuntime) inspectorRuntime.textContent = 'FUERA DE LÍNEA';
  }
};
checkHealth();
setInterval(checkHealth, 60_000);
window.addEventListener('focus', checkHealth);

const refreshWorkspaceContext = () => {
  const turns = messages.querySelectorAll('.message').length;
  const userTurns = messages.querySelectorAll('.message.user').length;
  const short = sessionId.slice(0, 8).toUpperCase();
  if (sessionBadge)
    sessionBadge.textContent = `SESIÓN ${short} · ${turns} ${turns === 1 ? 'MENSAJE' : 'MENSAJES'}`;
  if (inspectorSession) inspectorSession.textContent = short;
  document.body.classList.toggle('has-conversation', userTurns > 0);
};
refreshWorkspaceContext();

/* ------------------------------------------------------------ TTS / Speech */
let currentAudio = null;
const stopSpeech = () => {
  if (currentAudio) {
    try {
      currentAudio.pause();
    } catch {
      /* noop */
    }
    currentAudio = null;
  }
  try {
    window.speechSynthesis?.cancel();
  } catch {
    /* noop */
  }
};
const speakMessage = async (text) => {
  const clean = String(text || '')
    .trim()
    .slice(0, 1_200);
  if (!clean) return;
  stopSpeech();
  const payloadFor = (audio) =>
    audio?.dataUrl ||
    audio?.audio ||
    (typeof audio?.audioBase64 === 'string' && audio.audioBase64.startsWith('data:')
      ? audio.audioBase64
      : '');
  const headers = {
    'Content-Type': 'application/json',
    ...(sessionId ? { 'X-Session-Id': sessionId } : {}),
  };
  try {
    let response = await fetch('/api/v1/voice/speak', {
      method: 'POST',
      headers,
      body: JSON.stringify({ text: clean, sessionId, format: 'mp3' }),
    });
    if (!response.ok) {
      response = await fetch('/api/v1/tts/synthesize', {
        method: 'POST',
        headers,
        body: JSON.stringify({ text: clean, sessionId, format: 'mp3' }),
      });
    }
    if (!response.ok) {
      response = await fetch('/api/v1/cognition/speech', {
        method: 'POST',
        headers,
        body: JSON.stringify({ text: clean, sessionId, format: 'mp3' }),
      });
    }
    if (response.ok) {
      const audioUrl = payloadFor(await response.json());
      if (/^data:audio\/(?:mpeg|mp3|wav);base64,/.test(audioUrl)) {
        currentAudio = new Audio(audioUrl);
        currentAudio.addEventListener(
          'ended',
          () => {
            currentAudio = null;
          },
          { once: true }
        );
        await currentAudio.play();
        return;
      }
    }
  } catch (error) {
    console.warn('[Isabella] server TTS unavailable', error);
  }
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(clean);
    if (window.IsabellaVoice) {
      window.IsabellaVoice.apply(utterance);
    } else {
      utterance.lang = 'es-MX';
      utterance.rate = 0.93;
      utterance.pitch = 1;
    }
    window.speechSynthesis.speak(utterance);
  }
};

const lastAssistantRaw = () => {
  const paragraphs = [...messages.querySelectorAll('.message.isabella p')];
  const last = paragraphs.at(-1);
  return last ? last.dataset.raw || last.textContent || '' : '';
};
const playLastAssistantMessage = () => {
  const raw = lastAssistantRaw();
  if (raw.trim()) speakMessage(raw);
};
const copyLastAssistant = async () => {
  const raw = lastAssistantRaw();
  if (!raw.trim() || !navigator.clipboard?.writeText) return;
  try {
    await navigator.clipboard.writeText(raw);
  } catch {
    /* clipboard unavailable */
  }
};

const VOICE_KEY = 'isabella.voice.v1';
const readVoicePreference = () => {
  try {
    return localStorage.getItem(VOICE_KEY) === '1';
  } catch {
    return false;
  }
};
const writeVoicePreference = (on) => {
  try {
    localStorage.setItem(VOICE_KEY, on ? '1' : '0');
  } catch {
    /* private mode */
  }
};
let voiceEnabled = readVoicePreference();
const paintVoice = () => {
  if (soundToggle) {
    soundToggle.setAttribute('aria-pressed', String(voiceEnabled));
    soundToggle.textContent = voiceEnabled ? 'VOZ: ON' : 'VOZ: OFF';
    soundToggle.classList.toggle('is-on', voiceEnabled);
  }
  if (voiceCapability) {
    voiceCapability.classList.toggle('is-active', voiceEnabled);
    voiceCapability.textContent = voiceEnabled ? 'VOICE ON' : 'VOICE';
  }
};
paintVoice();
soundToggle?.addEventListener('click', () => {
  voiceEnabled = !voiceEnabled;
  writeVoicePreference(voiceEnabled);
  paintVoice();
  if (voiceEnabled) playLastAssistantMessage();
  else stopSpeech();
});

/* ------------------------------------------------------------- microphone */
const RecognitionCtor = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition = null;
let listening = false;
const setListening = (on) => {
  listening = on;
  if (!mic) return;
  mic.classList.toggle('is-listening', on);
  mic.setAttribute('aria-pressed', String(on));
  mic.setAttribute('aria-label', on ? 'Detener dictado' : 'Dictar mensaje');
  mic.title = on ? 'Detener dictado' : 'Dictar mensaje';
};
if (RecognitionCtor) {
  recognition = new RecognitionCtor();
  recognition.lang = 'es-MX';
  recognition.interimResults = false;
  recognition.continuous = false;
  recognition.maxAlternatives = 1;
  recognition.addEventListener('result', (event) => {
    const transcript = Array.from(event.results || [])
      .map((result) => result[0]?.transcript || '')
      .join(' ')
      .trim();
    if (!transcript) return;
    prompt.value = prompt.value ? `${prompt.value.trim()} ${transcript}` : transcript;
    prompt.dispatchEvent(new Event('input'));
    prompt.focus();
  });
  recognition.addEventListener('end', () => setListening(false));
  recognition.addEventListener('error', (event) => {
    setListening(false);
    if (event?.error === 'not-allowed' || event?.error === 'service-not-allowed') {
      addMessage(
        'El navegador bloqueó el micrófono. Habilita el permiso de voz para este sitio y vuelve a intentarlo.',
        'isabella'
      );
    }
  });
  if (inspectorVoice) inspectorVoice.textContent = 'WEB STT + TTS';
} else {
  if (mic) {
    mic.disabled = true;
    mic.title = 'Reconocimiento de voz no disponible en este navegador';
    mic.setAttribute('aria-label', 'Reconocimiento de voz no disponible');
  }
  if (inspectorVoice) inspectorVoice.textContent = 'BROWSER TTS';
}
const toggleMic = () => {
  if (!recognition) {
    addMessage(
      'Este navegador no expone reconocimiento de voz. Puedes escribir o adjuntar un archivo de texto.',
      'isabella'
    );
    return;
  }
  if (listening) {
    try {
      recognition.stop();
    } catch {
      /* already stopped */
    }
    setListening(false);
    return;
  }
  try {
    recognition.start();
    setListening(true);
  } catch {
    setListening(false);
  }
};
mic?.addEventListener('click', toggleMic);
document.querySelectorAll('.mode[data-mode]').forEach((button) => {
  button.addEventListener('click', () => {
    const isVoice = button.dataset.mode === 'voice';
    document.querySelectorAll('.mode[data-mode]').forEach((item) => {
      item.classList.toggle('active', item === button);
      item.setAttribute('aria-pressed', String(item === button));
    });
    if (isVoice) toggleMic();
    else {
      closePanel(true);
      prompt?.focus();
    }
  });
});

/* ------------------------------------------------------------- attachments */
attachText?.addEventListener('click', () => localFile?.click());
localFile?.addEventListener('change', () => {
  void readFileAsContext(localFile.files?.[0]);
});
removeAttachment?.addEventListener('click', clearAttachment);
paintAttachment();

/* ---------------------------------------------------------------- inspector */
const inspectorState = () => {
  const state = runtimeStatus?.dataset.state;
  if (state === 'ok') return 'EN LÍNEA';
  if (state === 'warn') return 'DEGRADADO';
  if (state === 'error') return 'FUERA DE LÍNEA';
  return 'VERIFICANDO';
};
const openInspector = () => {
  refreshWorkspaceContext();
  if (inspectorRuntime) inspectorRuntime.textContent = inspectorState();
  if (inspectorAttachment) inspectorAttachment.textContent = attachment ? attachment.name : 'NONE';
  if (inspectorVoice) inspectorVoice.textContent = recognition ? 'WEB STT + TTS' : 'BROWSER TTS';
  if (typeof systemInspector?.showModal === 'function') {
    if (!systemInspector.open) systemInspector.showModal();
  } else {
    systemInspector?.setAttribute('open', '');
  }
  closeSystemInspector?.focus({ preventScroll: true });
};
const closeInspector = () => {
  if (typeof systemInspector?.close === 'function') systemInspector.close();
  else systemInspector?.removeAttribute('open');
};
contextInspector?.addEventListener('click', openInspector);
closeSystemInspector?.addEventListener('click', closeInspector);
systemInspector?.addEventListener('click', (event) => {
  if (event.target === systemInspector) closeInspector();
});

/* ------------------------------------------------------------------ panels */
const PANEL_SELECTOR = '.studio-panel, .access-section, .workspace-pane';
const panelBackdrop = document.createElement('div');
panelBackdrop.className = 'panel-backdrop';
panelBackdrop.hidden = true;
panelBackdrop.addEventListener('click', () => closePanel());
// Panels live inside .stage (z-index:1); the backdrop must share that stacking context or it paints above them.
(byId('top') || document.body).append(panelBackdrop);
let lastPanelTrigger = null;

function ensurePanelChrome(section) {
  if (section.querySelector(':scope > .panel-close')) return;
  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'panel-close';
  close.dataset.panelClose = '';
  close.textContent = 'Cerrar ×';
  close.setAttribute('aria-label', 'Cerrar panel');
  close.addEventListener('click', () => closePanel());
  section.prepend(close);
}
function openPanel(id) {
  const section = byId(id);
  if (!section || !section.matches?.(PANEL_SELECTOR)) return false;
  if (document.body.classList.contains('panel-open') && document.body.dataset.panel === id)
    return true;
  const active = document.activeElement;
  if (active instanceof HTMLElement && !active.closest('.panel-visible')) lastPanelTrigger = active;
  if (document.body.classList.contains('panel-open')) closePanel(true);
  closeSideRails();
  ensurePanelChrome(section);
  section.classList.add('panel-visible');
  section.setAttribute('role', 'dialog');
  section.setAttribute('aria-modal', 'true');
  section.setAttribute('tabindex', '-1');
  document.body.classList.add('panel-open');
  document.body.dataset.panel = id;
  panelBackdrop.hidden = false;
  if (id === 'studio') renderDrafts();
  section.scrollTop = 0;
  section.focus({ preventScroll: true });
  return true;
}
function closePanel(silent = false) {
  const section = document.querySelector('.panel-visible');
  if (!section) return;
  section.classList.remove('panel-visible');
  section.removeAttribute('role');
  section.removeAttribute('aria-modal');
  section.removeAttribute('tabindex');
  if (document.body.dataset.panel === section.id) delete document.body.dataset.panel;
  document.body.classList.remove('panel-open');
  panelBackdrop.hidden = true;
  if (!silent && lastPanelTrigger?.isConnected) lastPanelTrigger.focus({ preventScroll: true });
  lastPanelTrigger = null;
}

/* --------------------------------------------------------- command palette */
const paletteEmpty = document.createElement('p');
paletteEmpty.className = 'command-empty';
paletteEmpty.hidden = true;
paletteEmpty.textContent = 'Sin resultados. Prueba con otra palabra.';
commandList?.append(paletteEmpty);

const normalizeSearch = (value) =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
const visibleCommands = () =>
  [...(commandList?.querySelectorAll('button[data-command]') || [])].filter(
    (button) => !button.hidden
  );
const filterCommands = () => {
  if (!commandList) return;
  const query = normalizeSearch(commandSearch?.value);
  commandList.querySelectorAll('button[data-command]').forEach((button) => {
    const haystack = normalizeSearch(
      `${button.textContent || ''} ${button.dataset.keywords || ''} ${button.dataset.command || ''}`
    );
    button.hidden = Boolean(query) && !haystack.includes(query);
  });
  const visible = visibleCommands();
  paletteEmpty.hidden = visible.length > 0;
};
const openPalette = () => {
  if (!commandPalette) return;
  if (typeof commandPalette.showModal === 'function') {
    if (!commandPalette.open) commandPalette.showModal();
  } else {
    commandPalette.setAttribute('open', '');
  }
  if (commandSearch) {
    commandSearch.value = '';
    filterCommands();
    commandSearch.focus();
  }
};
const closePalette = () => {
  if (typeof commandPalette?.close === 'function') commandPalette.close();
  else commandPalette?.removeAttribute('open');
};
const focusNexus = (tab) => {
  closePanel(true);
  closeSideRails();
  window.IsabellaNexus?.activate?.(tab);
  byId('nexus')?.scrollIntoView({
    behavior: reduceMotion ? 'auto' : 'smooth',
    block: 'start',
  });
};
const runCommand = (command) => {
  closePalette();
  switch (command) {
    case 'go-chat':
    case 'focus-prompt':
      closePanel(true);
      byId('chat')?.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
      window.setTimeout(() => prompt?.focus(), 120);
      break;
    case 'new-chat':
      resetConversation();
      break;
    case 'export-chat':
      exportConversation();
      break;
    case 'go-studio':
      openPanel('studio');
      break;
    case 'go-tools':
      openPanel('tools');
      break;
    case 'go-skills':
      openPanel('skills');
      break;
    case 'go-economy':
      openPanel('plans');
      break;
    case 'go-evidence':
      openPanel('evidence');
      break;
    case 'go-governance':
      openPanel('governance');
      break;
    case 'go-nexus':
      focusNexus('workbench');
      break;
    case 'go-nexus-keys':
      focusNexus('keys');
      break;
    case 'go-nexus-connectors':
      focusNexus('connectors');
      break;
    case 'go-platform-chat':
      window.location.assign('/chat');
      break;
    case 'go-platform':
      window.location.assign('/platform');
      break;
    case 'go-library':
      window.location.assign('/platform/library');
      break;
    case 'go-profile':
      window.location.assign('/platform/profile');
      break;
    case 'go-developers':
      window.location.assign('/platform/developers');
      break;
    case 'toggle-voice':
      soundToggle?.click();
      break;
    case 'copy-last':
      void copyLastAssistant();
      break;
    case 'read-last':
      playLastAssistantMessage();
      break;
    case 'open-inspector':
      openInspector();
      break;
    case 'open-history':
      window.IsabellaChatPlus?.openHistory?.();
      break;
    case 'open-shortcuts':
      window.IsabellaChatPlus?.openShortcuts?.();
      break;
    default:
      break;
  }
};
const movePaletteFocus = (direction) => {
  const buttons = visibleCommands();
  if (!buttons.length) return;
  const current = buttons.indexOf(document.activeElement);
  const index =
    current === -1
      ? direction > 0
        ? 0
        : buttons.length - 1
      : (current + direction + buttons.length) % buttons.length;
  buttons[index].focus();
};
document.addEventListener('keydown', (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
    event.preventDefault();
    openPalette();
  }
});
commandLauncher?.addEventListener('click', openPalette);
byId('closeCommandPalette')?.addEventListener('click', closePalette);
commandSearch?.addEventListener('input', filterCommands);
commandList?.addEventListener('click', (event) => {
  const button =
    event.target instanceof Element ? event.target.closest('button[data-command]') : null;
  if (button) runCommand(button.dataset.command);
});
commandList?.addEventListener('keydown', (event) => {
  if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
  event.preventDefault();
  movePaletteFocus(event.key === 'ArrowDown' ? 1 : -1);
});
commandSearch?.addEventListener('keydown', (event) => {
  if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
  const buttons = visibleCommands();
  if (!buttons.length) return;
  event.preventDefault();
  (event.key === 'ArrowDown' ? buttons[0] : buttons[buttons.length - 1]).focus();
});
commandPalette?.addEventListener('keydown', (event) => {
  if (event.key !== 'Enter') return;
  const buttons = visibleCommands();
  const active =
    document.activeElement instanceof HTMLElement &&
    document.activeElement.matches('button[data-command]')
      ? document.activeElement
      : buttons[0];
  if (active) {
    event.preventDefault();
    runCommand(active.dataset.command);
  }
});
commandPalette?.addEventListener('click', (event) => {
  if (event.target === commandPalette) closePalette();
});

/* ----------------------------------------------------- section / rail links */
const runAction = (action) => {
  switch (action) {
    case 'new-chat':
      resetConversation();
      closeSideRails();
      break;
    case 'export':
      exportConversation();
      closeSideRails();
      break;
    case 'history':
      closeSideRails();
      window.IsabellaChatPlus?.openHistory?.();
      break;
    case 'close-rails':
      closeSideRails();
      break;
    case 'mic':
      toggleMic();
      break;
    case 'shortcuts':
      closeSideRails();
      window.IsabellaChatPlus?.openShortcuts?.();
      break;
    case 'inspector':
      closeSideRails();
      openInspector();
      break;
    case 'focus-prompt':
      closeSideRails();
      closePanel(true);
      prompt?.focus();
      break;
    case 'copy-last':
      void copyLastAssistant();
      break;
    case 'read-last':
      playLastAssistantMessage();
      break;
    default:
      break;
  }
};
const applyStarter = (value) => {
  if (!value) return;
  closePanel(true);
  prompt.value = value;
  prompt.dispatchEvent(new Event('input'));
  byId('chat')?.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
  window.setTimeout(() => prompt.focus(), 120);
};
document.addEventListener('click', (event) => {
  const target = event.target instanceof Element ? event.target : null;
  if (!target) return;
  const actionEl = target.closest('[data-action]');
  if (actionEl) {
    event.preventDefault();
    runAction(actionEl.dataset.action);
    return;
  }
  const starterEl = target.closest('[data-starter]');
  if (starterEl) {
    event.preventDefault();
    applyStarter(starterEl.dataset.starter);
    return;
  }
  const anchor = target.closest('a[href^="#"]');
  if (!anchor) return;
  const id = (anchor.getAttribute('href') || '').slice(1);
  if (!id) return;
  if (id === 'top') {
    closePanel();
    closeSideRails();
    window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
    return;
  }
  if (id === 'chat') {
    closePanel(true);
    if (anchor.hasAttribute('data-focus-prompt')) window.setTimeout(() => prompt?.focus(), 180);
    return;
  }
  if (openPanel(id)) event.preventDefault();
});
document.addEventListener('keydown', (event) => {
  if (!document.body.classList.contains('panel-open')) return;
  if (event.key === 'Escape') {
    event.preventDefault();
    closePanel();
    return;
  }
  if (event.key !== 'Tab') return;
  const panel = document.querySelector('.panel-visible');
  if (!panel) return;
  const focusable = [
    ...panel.querySelectorAll(
      'a[href], button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])'
    ),
  ].filter((node) => node instanceof HTMLElement && node.offsetParent !== null);
  if (!focusable.length) {
    event.preventDefault();
    panel.focus({ preventScroll: true });
    return;
  }
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
});

/* ------------------------------------------------------ ambient quantum mesh */
const mountMeshCanvas = (host, canvas, options = {}) => {
  if (!host || !canvas || canvas.dataset.meshMounted === 'true') return;
  const context = canvas.getContext('2d', { alpha: true });
  if (!context) return;
  canvas.dataset.meshMounted = 'true';
  const nodeCount = options.nodeCount ?? (window.innerWidth < 700 ? 16 : 26);
  const linkDistance = options.linkDistance ?? 150;
  const lineAlpha = options.lineAlpha ?? 0.14;
  const nodeAlpha = options.nodeAlpha ?? 0.5;
  const drift = options.drift ?? 0.00028;
  const nodes = Array.from({ length: nodeCount }, () => ({
    x: Math.random(),
    y: Math.random(),
    vx: (Math.random() - 0.5) * drift,
    vy: (Math.random() - 0.5) * drift,
    r: Math.random() * 1.4 + 0.7,
  }));
  let width = 0;
  let height = 0;
  let frame = 0;
  let running = false;
  const palette = ['159,247,255', '201,184,255', '169,245,208'];
  const resize = () => {
    const rect = canvas.getBoundingClientRect();
    width = Math.max(1, Math.round(rect.width));
    height = Math.max(1, Math.round(rect.height));
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
  };
  const paint = () => {
    context.clearRect(0, 0, width, height);
    for (let i = 0; i < nodes.length; i += 1) {
      const a = nodes[i];
      if (!reduceMotion) {
        a.x += a.vx;
        a.y += a.vy;
        if (a.x < -0.05) a.x = 1.05;
        if (a.x > 1.05) a.x = -0.05;
        if (a.y < -0.05) a.y = 1.05;
        if (a.y > 1.05) a.y = -0.05;
      }
      for (let j = i + 1; j < nodes.length; j += 1) {
        const b = nodes[j];
        const dx = (a.x - b.x) * width;
        const dy = (a.y - b.y) * height;
        const distance = Math.hypot(dx, dy);
        if (distance > linkDistance) continue;
        context.strokeStyle = `rgba(${palette[(i + j) % palette.length]},${(1 - distance / linkDistance) * lineAlpha})`;
        context.lineWidth = 0.7;
        context.beginPath();
        context.moveTo(a.x * width, a.y * height);
        context.lineTo(b.x * width, b.y * height);
        context.stroke();
      }
    }
    for (let index = 0; index < nodes.length; index += 1) {
      const node = nodes[index];
      context.fillStyle = `rgba(${palette[index % palette.length]},${nodeAlpha})`;
      context.beginPath();
      context.arc(node.x * width, node.y * height, node.r, 0, Math.PI * 2);
      context.fill();
    }
  };
  const start = () => {
    if (running) return;
    resize();
    if (reduceMotion) {
      paint();
      return;
    }
    running = true;
    const loop = () => {
      if (!running) return;
      paint();
      frame = window.requestAnimationFrame(loop);
    };
    frame = window.requestAnimationFrame(loop);
  };
  const stop = () => {
    running = false;
    window.cancelAnimationFrame(frame);
  };
  if (typeof ResizeObserver === 'function') {
    new ResizeObserver(() => {
      resize();
      if (!running) paint();
    }).observe(host);
  } else {
    window.addEventListener('resize', () => {
      resize();
      if (!running) paint();
    });
  }
  if (typeof IntersectionObserver === 'function') {
    new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) start();
          else stop();
        });
      },
      { threshold: 0 }
    ).observe(host);
  }
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stop();
    else start();
  });
  start();
};

const mountAmbientMesh = () => {
  // #quantumMesh ya no se pinta aquí: universe-map.js lo gobierna con los registros de /api/v1/status.
  const chat = byId('chat');
  if (!chat) return;
  const compact = window.innerWidth < 700;
  const canvas = document.createElement('canvas');
  canvas.className = 'console-ambient';
  canvas.setAttribute('aria-hidden', 'true');
  chat.prepend(canvas);
  mountMeshCanvas(chat, canvas, {
    nodeCount: compact ? 14 : 24,
    linkDistance: 150,
    lineAlpha: 0.13,
    nodeAlpha: 0.48,
  });
};
mountAmbientMesh();

/* ---------------------------------------------- initial UI + public bridge */
const navObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      document.querySelectorAll('.nav-links a').forEach((link) => {
        const active = link.getAttribute('href') === `#${entry.target.id}`;
        link.classList.toggle('is-active', active);
        if (active) link.setAttribute('aria-current', 'page');
        else link.removeAttribute('aria-current');
      });
    });
  },
  { rootMargin: '-20% 0px -70% 0px' }
);
document.querySelectorAll('section[id]').forEach((section) => navObserver.observe(section));
document.querySelectorAll('.nav-links a[href^="#"]').forEach((link) => {
  link.dataset.focusPrompt = link.hasAttribute('data-focus-prompt') ? 'true' : 'false';
  link.addEventListener('click', () => {
    if (link.dataset.focusPrompt === 'true') window.setTimeout(() => prompt?.focus(), 180);
  });
});

enterChat?.addEventListener('click', () => {
  byId('chat')?.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
  window.setTimeout(() => prompt?.focus({ preventScroll: true }), reduceMotion ? 60 : 540);
});

renderDrafts();
refreshWorkspaceContext();
if (inspectorAttachment) inspectorAttachment.textContent = 'NONE';

window.IsabellaApp = Object.freeze({
  addMessage,
  getSessionId: () => sessionId,
  setSessionId: (id) => {
    if (typeof id === 'string' && id) {
      sessionId = id;
      refreshWorkspaceContext();
    }
  },
  resetConversation,
  saveDraft,
  renderDrafts,
  exportConversation,
  speak: speakMessage,
  stopSpeech,
  openPanel,
  closePanel,
  openInspector,
  refreshWorkspaceContext,
  getAttachmentName: () => (attachment ? attachment.name : null),
  getVoiceEnabled: () => voiceEnabled,
  copyLastAssistant,
});
