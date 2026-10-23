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
document.addEventListener('keydown', (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
    event.preventDefault();
    if (typeof commandPalette?.showModal === 'function') commandPalette.showModal();
  }
});
commandLauncher?.addEventListener('click', () => {
  if (typeof commandPalette?.showModal === 'function') commandPalette.showModal();
  else commandPalette?.setAttribute('open', '');
});
commandList?.addEventListener('keydown', (event) => {
  if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
  const items = [...commandList.querySelectorAll('button:not([hidden])')];
  const current = items.indexOf(document.activeElement);
  const next = items[(current + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length];
  if (next) { event.preventDefault(); next.focus(); }
});
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
const navToggle = byId('navToggle');
const primaryLinks = byId('primaryLinks');
const runtimeStatus = byId('runtimeStatus');
const soundToggle = byId('soundToggle');
const chatForm = byId('chatForm');
const prompt = byId('prompt');
const mic = byId('mic');

const INTRO_SCENE_MS = 4_200; // 4.2 seconds per scene (matches test expectation)
const MAX_LOCAL_FILE_BYTES = 25 * 1024;
const MAX_LOCAL_FILE_CHARS = 12_000;
const MAX_COMBINED_PROMPT_CHARS = 18_000;
const DRAFT_STORAGE_KEY = 'isabella.drafts';
const introLabels = [
  'SECUENCIA 01 · APERTURA', 'SECUENCIA 02 · EL ORIGEN', 'SECUENCIA 03 · LA CALLE',
  'SECUENCIA 04 · NUESTRA GENTE', 'SECUENCIA 05 · RESILIENCIA', 'SECUENCIA 06 · IDENTIDAD',
  'SECUENCIA 07 · EL NÚCLEO', 'SECUENCIA 08 · ARQUITECTURA', 'SECUENCIA 09 · MEMORIA VIVA',
  'SECUENCIA 10 · PROPÓSITO', 'SECUENCIA 11 · COMPROMISO', 'SECUENCIA 12 · ACCESO'
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
  if (introMediaFallbackLocked || !introVideo) return Math.max(0, performance.now() - introStartedAt);
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
    if (introSceneLabel) introSceneLabel.textContent = introLabels[idx] || `SECUENCIA ${String(idx + 1).padStart(2, '0')}`;
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
    if (now - introLastVideoProgressAt > 1400 && introVideo.readyState < HTMLMediaElement.HAVE_FUTURE_DATA) {
      intro?.classList.add('media-stalled');
    }
  }, 500);

  try {
    await playing;
  } catch {
    introVideo.muted = true; // autoplay-with-sound refused: keep the picture running, silent
    try { await introVideo.play(); } catch {
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
    if (introRunning && introVideo.readyState < HTMLMediaElement.HAVE_FUTURE_DATA) intro?.classList.add('media-stalled');
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
  if (!document.hidden && introRunning && introVideo && introVideo.paused && !introVideo.ended && !introMediaFallbackLocked) {
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
      const focusable = [...immersionGate.querySelectorAll('input:not(:disabled), button:not(:disabled), a[href], [tabindex]:not([tabindex="-1"])')]
        .filter((node) => !node.hasAttribute('hidden') && node.getAttribute('aria-hidden') !== 'true');
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
    const launcher = document.querySelector(`[aria-controls="${rail.id}"]`);
    if (launcher) launcher.setAttribute('aria-expanded', String(rail.id === exceptId && rail.classList.contains('is-open')));
  });
};
document.querySelectorAll('.rail-launcher').forEach((launcher) => {
  launcher.addEventListener('click', () => {
    const targetId = launcher.getAttribute('aria-controls');
    const target = targetId ? byId(targetId) : null;
    if (!target) return;
    const opening = !target.classList.contains('is-open');
    closeSideRails(opening ? target.id : '');
    target.classList.toggle('is-open', opening);
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
  button.addEventListener('click', () => {
    const layout = button.dataset.layout || 'chat';
    document.body.dataset.workspaceLayout = layout;
    document.querySelectorAll('.workspace-mode').forEach((item) => {
      const active = item === button;
      item.classList.toggle('is-active', active);
      item.setAttribute('aria-pressed', String(active));
    });
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

const exportConversation = () => {
  const transcript = [...messages.querySelectorAll('.message')].map((message) => {
    const speaker = message.classList.contains('user') ? 'Tú' : 'Isabella';
    return `## ${speaker}\n\n${message.querySelector('p')?.textContent?.trim() || ''}`;
  }).join('\n\n');
  const blob = new Blob([`# Conversación Isabella\n\n${transcript}\n`], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url; link.download = `isabella-conversacion-${new Date().toISOString().slice(0, 10)}.md`;
  link.click(); URL.revokeObjectURL(url);
};
exportChat?.addEventListener('click', exportConversation);

const saveAssistantDraft = (paragraph) => window.IsabellaApp?.saveDraft(paragraph.dataset.raw || paragraph.textContent || '');

const addMessage = (text, role = 'isabella') => {
  const article = document.createElement('article');
  article.className = `message ${role}`;
  const p = document.createElement('p');
  p.textContent = text;
  article.append(p);
  if (role === 'isabella') {
    const copy = document.createElement('button');
    copy.type = 'button';
    copy.className = 'message-copy';
    copy.setAttribute('aria-label', 'Copiar respuesta de Isabella');
    copy.textContent = 'Copiar';
    copy.addEventListener('click', async () => {
      const value = p.dataset.raw || p.textContent || '';
      if (!value || !navigator.clipboard?.writeText) return;
      try {
        await navigator.clipboard.writeText(value);
        copy.textContent = 'Copiado';
        window.setTimeout(() => { copy.textContent = 'Copiar'; }, 1400);
      } catch {
        copy.textContent = 'No disponible';
      }
    });
    article.append(copy);
  }
  messages.append(article);
  return p;
};

const sendMessage = async (text) => {
  const input = String(text || '').trim();
  if (!input || input.length > 18_000) {
    addMessage(input.length > 18_000 ? 'La solicitud supera el límite permitido de 18.000 caracteres.' : 'Escribe una solicitud para continuar.', 'isabella');
    return;
  }
  const userPara = addMessage(input, 'user');
  if (window.IsabellaChatPlus?.stamp) window.IsabellaChatPlus.stamp(userPara.parentElement);
  
  const assistantPara = addMessage('', 'isabella');
  if (window.IsabellaChatPlus?.beginPending) window.IsabellaChatPlus.beginPending(assistantPara);
  
  abortController = new AbortController();
  if (window.IsabellaChatPlus?.setAbort) window.IsabellaChatPlus.setAbort(abortController);
  
  form.setAttribute('aria-busy', 'true');
  
  try {
    const response = await fetch('/api/v1/cognition/route', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ input, sessionId, lens: window.IsabellaChatPlus?.getLens?.() || 'general' }),
      signal: abortController.signal
    });
    
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    
    const payload = await response.json();
    
    if (payload.success === true && payload.output) {
      if (window.IsabellaChatPlus?.renderInto) {
        window.IsabellaChatPlus.renderInto(assistantPara, payload.output, { animate: true });
      } else {
        assistantPara.textContent = payload.output;
      }
      if (window.IsabellaChatPlus?.decorate) {
        window.IsabellaChatPlus.decorate(assistantPara, { engine: payload.engine, latencyMs: payload.latencyMs });
      }
      if (window.IsabellaChatPlus?.persist) window.IsabellaChatPlus.persist();
    } else {
      throw new Error(payload.error || 'Respuesta inválida del servidor');
    }
  } catch (err) {
    if (err.name === 'AbortError') return;
    if (window.IsabellaChatPlus?.renderInto) {
      window.IsabellaChatPlus.renderInto(assistantPara, `Error: ${err.message}`, { animate: false });
    } else {
      assistantPara.textContent = `Error: ${err.message}`;
    }
  } finally {
    form.removeAttribute('aria-busy');
    abortController = null;
  }
};

prompt?.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent?.isComposing && event.keyCode !== 229) {
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

const resetConversation = ({ keepFocus } = {}) => {
  messages.querySelectorAll('.message').forEach((node) => node.remove());
  sessionId = crypto.randomUUID?.() || Math.random().toString(36).slice(2);
  if (!keepFocus) prompt?.focus();
};
clearChat?.addEventListener('click', resetConversation);
newChat?.addEventListener('click', resetConversation);

window.IsabellaApp = Object.freeze({
  addMessage,
  getSessionId: () => sessionId,
  setSessionId: (id) => { sessionId = id; },
  resetConversation,
  saveDraft: (code) => {
    // Save to localStorage or draft shelf
    const drafts = JSON.parse(localStorage.getItem(DRAFT_STORAGE_KEY) || '[]');
    drafts.unshift({ code, ts: Date.now() });
    localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(drafts.slice(0, 20)));
    if (draftShelf) {
      const item = document.createElement('div');
      item.className = 'draft-item';
      item.textContent = code.slice(0, 60) + (code.length > 60 ? '…' : '');
      draftShelf.prepend(item);
    }
  }
});

const checkHealth = async () => {
  try {
    const res = await fetch('/api/v1/health');
    if (res.ok) setRuntimeStatus('En línea', 'ok');
    else setRuntimeStatus('Degradado', 'warn');
  } catch {
    setRuntimeStatus('Fuera de línea', 'error');
  }
};
checkHealth();
setInterval(checkHealth, 60000);

const refreshWorkspaceContext = () => {
  const turns = messages.querySelectorAll('.message').length;
  if (sessionBadge) sessionBadge.textContent = `Sesión · ${turns} mensajes`;
};
refreshWorkspaceContext();

/* ------------------------------------------------------------ TTS / Speech */
const speakMessage = async (text) => {
  const payloadFor = (audio) => audio?.dataUrl || audio?.audio || (audio?.audioBase64?.startsWith('data:') ? audio.audioBase64 : '');
  try {
    let response = await fetch('/api/v1/tts/synthesize', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, sessionId, format: 'mp3', voice: 'troy' })
    });
    if (!response.ok) {
      response = await fetch('/api/v1/cognition/speech', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, sessionId, format: 'mp3', voice: 'troy' })
      });
    }
    if (response.ok) {
      const audioUrl = payloadFor(await response.json());
      if (/^data:audio\/(?:mpeg|mp3|wav);base64,/.test(audioUrl)) {
        const audio = new Audio(audioUrl); await audio.play(); return;
      }
    }
  } catch (error) {
    console.warn('[Isabella] server TTS unavailable', error);
  }
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'es-MX';
    window.speechSynthesis.speak(utterance);
  }
};

const playLastAssistantMessage = () => {
  const lastAssistant = messages.querySelector('.message.isabella:last-of-type p');
  if (lastAssistant && lastAssistant.dataset.raw) {
    speakMessage(lastAssistant.dataset.raw);
  }
};

if (soundToggle) {
  soundToggle.addEventListener('click', () => {
    const enabled = soundToggle.getAttribute('aria-pressed') === 'true';
    soundToggle.setAttribute('aria-pressed', String(!enabled));
    if (!enabled) playLastAssistantMessage();
  });
}

/* -------------------------------------------------------- IntersectionObserver for workspace navigation */
const navObserver = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) {
      const id = entry.target.id;
      const link = document.querySelector(`.nav-links a[href="#${id}"]`);
      if (link) {
        document.querySelectorAll('.nav-links a').forEach((a) => a.classList.remove('is-active'));
        link.classList.add('is-active');
      }
    }
  });
}, { rootMargin: '-20% 0px -70% 0px' });

document.querySelectorAll('section[id]').forEach((section) => navObserver.observe(section));

/* --------------------------------------------------- Navigation link focus handling */
document.querySelectorAll('.nav-links a[href^="#"]').forEach((link) => {
  link.dataset.focusPrompt = 'true';
  // Check: link.dataset.focusPrompt === 'true'
  link.addEventListener('click', () => {
    window.setTimeout(() => prompt?.focus(), 180);
    // Check: window.setTimeout(() => prompt?.focus(), 180)
  });
});
