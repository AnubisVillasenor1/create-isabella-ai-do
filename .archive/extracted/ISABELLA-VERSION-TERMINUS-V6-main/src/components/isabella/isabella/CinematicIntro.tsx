import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Play,
  SkipForward,
  Volume2,
  VolumeX,
  Activity,
  Shield,
  Cpu,
  Radio,
  Lock,
  Terminal,
  Wifi,
} from "lucide-react";

const DURATION = 59;
const TARGET_FPS = 60;
const FALLBACK_BACKDROP = "/assets/isabella-intro-backdrop.png";

export interface TelemetryPayload {
  elapsed: number;
  progress: number;
  sceneStage: string;
  fps: number;
  droppedFrames: number;
}

interface IntroMediaConfig {
  enabled?: boolean;
  playbackId?: string;
  metadata?: {
    title?: string;
    duration?: number;
    aspectRatio?: string;
  };
  fallback?: {
    type?: "static" | "procedural" | "none";
    url?: string;
  };
}

interface CinematicIntroProps {
  onComplete: () => void;
  onTelemetryUpdate?: (data: TelemetryPayload) => void;
}

const scenes = [
  {
    end: 10,
    kicker: "NODO CERO // REAL DEL MONTE · HIDALGO · MX",
    title: "LA INTELIGENCIA EMPIEZA ESCUCHANDO.",
    body: "Isabella Villaseñor AI sintetiza contexto, memoria y proveniencia territorial bajo estricto mandato y gobernanza humana.",
    tag: "COGNITIVE ARCHITECTURE // ACTIVE",
  },
  {
    end: 20,
    kicker: "CROWN CORE // ORQUESTACIÓN TÁCTICA AUDITABLE",
    title: "CADA RESPUESTA TIENE UN ORIGEN DECLARADO.",
    body: "La percepción transita por capas no-deterministas hacia políticas, decisiones y trazabilidad criptográfica LITLE.",
    tag: "TRACEABILITY // 100% VERIFIED",
  },
  {
    end: 30,
    kicker: "ARGUS GATE // PROTECCIÓN ZERO-TRUST",
    title: "LA CAPACIDAD NO ESTÁ POR ENCIMA DEL CUIDADO.",
    body: "Frente a la ambigüedad o el riesgo, el kernel frena el flujo autónomo y eleva la solicitud al supervisor humano.",
    tag: "ZERO-TRUST GOVERNANCE // ENGAGED",
  },
  {
    end: 40,
    kicker: "TRIADA ISA · SOPHIA · ORION // SEGREGACIÓN DE ROLES",
    title: "ROLES DIVERGENTES. UNA SOLA RESPONSABILIDAD.",
    body: "Presencia, razonamiento analítico y ejecución táctica operan con límites explícitos de acción, sin opacidad corporativa.",
    tag: "TRIAD KERNEL // SYNCED",
  },
  {
    end: 50,
    kicker: "SOBERANÍA TERRITORIAL // SANTUARIO DE MEMORIA",
    title: "EL TERRITORIO Y SU GENTE NO SON UN DATO MÁS.",
    body: "La memoria colectiva, la raíz cultural y la incertidumbre local se protegen y honran antes de cualquier abstracción.",
    tag: "LOCAL SOVEREIGNTY // PROTECTED",
  },
  {
    end: DURATION + 1,
    kicker: "ISABELLA VILLASEÑOR AI // KERNEL COGNITIVO LIBRE",
    title: "TÚ DECIDES. ISABELLA AYUDA A VER MEJOR.",
    body: "Una interfaz cognitiva comunitaria construida para pensar contigo, defender la verdad y potenciar la soberanía digital.",
    tag: "SYSTEM READY // STANDBY",
  },
] as const;

export function CinematicIntroContent({ onComplete, onTelemetryUpdate }: CinematicIntroProps) {
  const [showGate, setShowGate] = useState(true);
  const [muted, setMuted] = useState(false);
  const [mediaReady, setMediaReady] = useState(false);
  const [mediaFailed, setMediaFailed] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [fps, setFps] = useState(TARGET_FPS);
  const [media, setMedia] = useState<IntroMediaConfig>({
    fallback: { type: "static", url: FALLBACK_BACKDROP },
  });

  const completedRef = useRef(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const clockRef = useRef(0);
  const onCompleteRef = useRef(onComplete);
  const telemetryRef = useRef(onTelemetryUpdate);

  useEffect(() => {
    onCompleteRef.current = onComplete;
    telemetryRef.current = onTelemetryUpdate;
  }, [onComplete, onTelemetryUpdate]);

  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/mux-intro", {
      method: "GET",
      signal: controller.signal,
      headers: { accept: "application/json" },
      credentials: "same-origin",
    })
      .then(async (response) => {
        const payload = (await response.json()) as IntroMediaConfig;
        if (response.ok || response.status === 503) setMedia(payload);
      })
      .catch(() => {
        setMediaFailed(true);
        setMediaReady(true);
      });
    return () => controller.abort();
  }, []);

  const complete = useCallback(() => {
    if (completedRef.current) return;
    completedRef.current = true;
    videoRef.current?.pause();
    audioRef.current?.pause();
    if (audioRef.current) audioRef.current.currentTime = 0;
    onCompleteRef.current();
  }, []);

  const enter = useCallback(() => {
    if (completedRef.current) return;
    setShowGate(false);
    setElapsed(0);
    clockRef.current = performance.now();

    const video = videoRef.current;
    const audio = audioRef.current;
    if (audio) {
      audio.muted = muted;
      void audio.play().catch(() => undefined);
    }
    if (!video || mediaFailed) return;
    video.muted = muted;
    void video
      .play()
      .then(() => setMediaReady(true))
      .catch(() => {
        setMediaFailed(true);
        setMediaReady(true);
      });
  }, [mediaFailed, muted]);

  const handleMediaError = useCallback(() => {
    setMediaFailed(true);
    setMediaReady(true);
  }, []);

  // The media request can resolve after the user has already pressed
  // "INICIAR EXPERIENCIA". In that case the <video> element is mounted after
  // enter() and must be started here; otherwise the cinematic layer stays
  // paused/black even though the intro itself is already active.
  const playbackUrl =
    media.playbackId && !mediaFailed
      ? `https://stream.mux.com/${encodeURIComponent(media.playbackId)}/high.mp4`
      : undefined;

  useEffect(() => {
    if (showGate || !playbackUrl || mediaFailed) return;
    const video = videoRef.current;
    if (!video) return;

    video.muted = muted;
    void video
      .play()
      .then(() => setMediaReady(true))
      .catch(() => {
        setMediaFailed(true);
        setMediaReady(true);
      });
  }, [showGate, playbackUrl, mediaFailed, muted]);

  useEffect(() => {
    if (showGate) return;
    const prefersReducedMotion =
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReducedMotion) {
      const timer = window.setTimeout(complete, 600);
      return () => window.clearTimeout(timer);
    }

    let frame = 0;
    let last = performance.now();
    let frames = 0;

    const tick = (now: number) => {
      frames += 1;
      const current = Math.min(DURATION, Math.max(0, (now - clockRef.current) / 1000));
      setElapsed(current);
      if (now - last >= 1000) {
        const measured = Math.round((frames * 1000) / (now - last));
        setFps(measured);
        const scene = scenes.find((item) => current < item.end) ?? scenes[scenes.length - 1];
        telemetryRef.current?.({
          elapsed: current,
          progress: current / DURATION,
          sceneStage: scene.kicker,
          fps: measured,
          droppedFrames: Math.max(0, TARGET_FPS - measured),
        });
        frames = 0;
        last = now;
      }
      if (current >= DURATION) complete();
      else frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [complete, showGate]);

  useEffect(() => {
    const handleKeydown = (event: KeyboardEvent) => {
      if (showGate && (event.key === "Enter" || event.key === " ")) {
        event.preventDefault();
        enter();
      } else if (!showGate && event.key === "Escape") {
        event.preventDefault();
        complete();
      } else if (!showGate && event.key.toLowerCase() === "m") {
        setMuted((value) => !value);
      }
    };
    window.addEventListener("keydown", handleKeydown);
    return () => window.removeEventListener("keydown", handleKeydown);
  }, [complete, enter, showGate]);

  useEffect(() => {
    if (videoRef.current) videoRef.current.muted = muted;
    if (audioRef.current) audioRef.current.muted = muted;
  }, [muted]);

  const scene = useMemo(
    () => scenes.find((item) => elapsed < item.end) ?? scenes[scenes.length - 1],
    [elapsed],
  );
  const progress = Math.min(1, elapsed / DURATION);
  const timecode = `${Math.floor(elapsed / 60)
    .toString()
    .padStart(2, "0")}:${Math.floor(elapsed % 60)
    .toString()
    .padStart(2, "0")}`;

  const fallbackUrl =
    media.fallback?.type === "static"
      ? (media.fallback.url ?? FALLBACK_BACKDROP)
      : FALLBACK_BACKDROP;

  return (
    <section
      aria-labelledby="isabella-cinematic-title"
      className="relative h-screen w-screen overflow-hidden bg-[#020609] font-sans select-none"
    >
      {/* CSS Inyectado para animaciones puras GPU sin romper bundle */}
      <style>{`
        @keyframes hudScan {
          0% { transform: translateY(-100%); }
          100% { transform: translateY(1000%); }
        }
        @keyframes pulseRing {
          0%, 100% { transform: scale(1); opacity: 0.3; }
          50% { transform: scale(1.08); opacity: 0.7; }
        }
        @keyframes revealCinematic {
          0% { opacity: 0; transform: translateY(20px) scale(0.97); filter: blur(10px); }
          100% { opacity: 1; transform: translateY(0) scale(1); filter: blur(0); }
        }
        .animate-reveal {
          animation: revealCinematic 0.85s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
      `}</style>

      <audio
        ref={audioRef}
        src="/assets/isabella-intro-mashup.mp3"
        preload="auto"
        aria-label="Banda sonora de la introducción cinematográfica"
      />

      {/* REPRODUCTOR DE VIDEO O FALLBACK SOBERANO */}
      {playbackUrl ? (
        <video
          ref={videoRef}
          className="absolute inset-0 h-full w-full object-cover filter brightness-[0.85] contrast-[1.1]"
          src={playbackUrl}
          autoPlay={false}
          muted={muted}
          playsInline
          preload="metadata"
          onCanPlay={() => setMediaReady(true)}
          onLoadedData={() => setMediaReady(true)}
          onError={handleMediaError}
          aria-hidden="true"
        />
      ) : (
        <div
          className="absolute inset-0 bg-cover bg-center transition-all duration-1000 scale-105"
          style={{
            backgroundImage: `linear-gradient(135deg, rgba(2,6,9,0.88), rgba(6,18,28,0.95)), url("${fallbackUrl}")`,
          }}
          aria-hidden="true"
        />
      )}

      {/* OVERLAY TÁCTICO HUD: SCANLINES, RETÍCULA Y VIÑETA */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_20%,rgba(0,0,0,0.6)_65%,rgba(1,4,7,0.98)_100%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:100%_4px] opacity-40" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[10vh] bg-gradient-to-b from-black/90 via-black/40 to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[12vh] bg-gradient-to-t from-black/95 via-black/50 to-transparent" />

      {/* ESQUINAS HUD TÁCTICAS */}
      <div className="pointer-events-none absolute top-6 left-6 size-8 border-l-2 border-t-2 border-cyan-400/40" />
      <div className="pointer-events-none absolute top-6 right-6 size-8 border-r-2 border-t-2 border-cyan-400/40" />
      <div className="pointer-events-none absolute bottom-6 left-6 size-8 border-l-2 border-b-2 border-cyan-400/40" />
      <div className="pointer-events-none absolute bottom-6 right-6 size-8 border-r-2 border-b-2 border-cyan-400/40" />

      {/* EXPERIENCIA PRINCIPAL DE REPRODUCCIÓN */}
      {!showGate && (
        <>
          {/* HEADER DEL HUD */}
          <header className="absolute inset-x-8 top-[8vh] z-20 flex items-center justify-between text-[11px] font-mono tracking-[0.3em] uppercase text-cyan-200/70 sm:inset-x-12">
            <div className="flex items-center gap-3">
              <span className="relative flex size-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan-400 opacity-75" />
                <span className="relative inline-flex size-2 rounded-full bg-cyan-300" />
              </span>
              <span className="font-semibold text-cyan-100">{scene.kicker}</span>
            </div>

            <div className="hidden items-center gap-6 sm:flex text-white/50">
              <div className="flex items-center gap-2">
                <Activity className="size-3.5 text-cyan-400" />
                <span>{fps} FPS</span>
              </div>
              <span className="text-white/20">//</span>
              <div className="flex items-center gap-2">
                <Shield className="size-3.5 text-cyan-400" />
                <span>LITLE VERIFIED</span>
              </div>
              <span className="text-white/20">//</span>
              <span className="font-mono text-cyan-300">{timecode} / 00:59</span>
            </div>
          </header>

          {/* CONTENIDO CINEMÁTICO CENTRAL */}
          <div className="absolute inset-0 z-10 flex items-center px-8 sm:px-16 lg:px-24">
            <div key={scene.title} className="max-w-4xl animate-reveal">
              <div className="mb-4 inline-flex items-center gap-2 rounded-sm border border-cyan-500/30 bg-cyan-950/40 px-3 py-1 backdrop-blur-md">
                <Cpu className="size-3 text-cyan-300" />
                <span className="text-[10px] font-mono tracking-[0.35em] text-cyan-200 uppercase">
                  {scene.tag}
                </span>
              </div>

              <h1
                id="isabella-cinematic-title"
                className="text-4xl font-black leading-[0.92] tracking-tight text-white drop-shadow-[0_0_35px_rgba(34,211,238,0.2)] sm:text-6xl md:text-8xl"
              >
                {scene.title}
              </h1>

              <p className="mt-8 max-w-2xl border-l-2 border-cyan-400/80 pl-6 text-base leading-relaxed tracking-wide text-cyan-50/80 sm:text-lg">
                {scene.body}
              </p>
            </div>
          </div>

          {/* FOOTER DEL HUD Y BARRA DE PROGRESO */}
          <footer className="absolute inset-x-8 bottom-[8vh] z-20 sm:inset-x-12">
            <div className="mb-3 flex items-center justify-between text-[10px] font-mono tracking-[0.25em] uppercase text-white/50">
              <div className="flex items-center gap-2">
                <Terminal className="size-3.5 text-cyan-400" />
                <span>ISABELLA AI // TAMV OS MD-X5</span>
              </div>

              <div className="flex items-center gap-4">
                <button
                  type="button"
                  onClick={() => setMuted((val) => !val)}
                  className="hidden sm:flex items-center gap-1.5 transition-colors hover:text-cyan-200"
                >
                  {muted ? <VolumeX className="size-3.5" /> : <Volume2 className="size-3.5" />}
                  <span>[M] {muted ? "UNMUTE" : "MUTE"}</span>
                </button>
                <button
                  type="button"
                  onClick={complete}
                  className="flex items-center gap-1.5 rounded border border-cyan-500/30 bg-black/40 px-3 py-1 text-cyan-200 transition-colors hover:border-cyan-300 hover:bg-cyan-900/30 focus-visible:outline-none"
                >
                  <span>OMITIR INTRO [ESC]</span>
                  <SkipForward className="size-3.5" />
                </button>
              </div>
            </div>

            {/* BARRA DE PROGRESO CON GLOW */}
            <div
              className="relative h-1 w-full overflow-hidden rounded-full bg-white/10 backdrop-blur-sm"
              role="progressbar"
              aria-label="Progreso de la introducción"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(progress * 100)}
            >
              <div
                className="h-full bg-gradient-to-r from-cyan-500 via-sky-300 to-white transition-all duration-100 ease-linear shadow-[0_0_15px_rgba(34,211,238,0.9)]"
                style={{ width: `${progress * 100}%` }}
              />
            </div>
          </footer>
        </>
      )}

      {/* PANTALLA DE ACCESO / START GATE */}
      {showGate && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-[#010508]/80 px-6 backdrop-blur-md">
          <div className="w-full max-w-2xl text-center animate-reveal">
            {/* LOGO NÚCLEO COGNITIVO */}
            <div className="relative mx-auto mb-8 flex size-28 items-center justify-center rounded-full border border-cyan-400/30 bg-black/60 shadow-[0_0_80px_rgba(34,211,238,0.25),inset_0_0_30px_rgba(34,211,238,0.15)]">
              <div
                className="absolute inset-0 rounded-full border border-cyan-300/20"
                style={{ animation: "pulseRing 3s infinite ease-in-out" }}
              />
              <div className="size-4 rounded-full bg-cyan-200 shadow-[0_0_25px_8px_rgba(34,211,238,0.8)]" />
              <Lock className="absolute size-5 text-cyan-300/40" />
            </div>

            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-500/20 bg-cyan-950/30 px-4 py-1 text-[10px] font-mono tracking-[0.4em] uppercase text-cyan-300/80 mb-4">
              <Radio className="size-3 animate-pulse text-cyan-400" />
              TAMV ONLINE // PRÓLOGO DE SISTEMA
            </div>

            <h2 className="text-5xl font-black tracking-tighter text-white sm:text-7xl">
              ISABELLA<span className="text-cyan-400">.</span>
            </h2>

            <p className="mx-auto mt-6 max-w-lg text-sm leading-relaxed text-cyan-100/70 sm:text-base">
              Interfaz cognitiva territorial. Contexto soberano antes que certeza; supervisión
              humana antes que automatismo irrestricto.
            </p>

            <div className="mx-auto mt-4 flex max-w-md items-center justify-center gap-4 text-[10px] font-mono tracking-[0.2em] uppercase text-white/40">
              <span className="flex items-center gap-1">
                <Wifi className="size-3 text-cyan-400" /> REAL DEL MONTE
              </span>
              <span>•</span>
              <span>ZERO TRUST</span>
              <span>•</span>
              <span>LITLE ARCHIVE</span>
            </div>

            <div
              className="mx-auto mt-8 flex items-center justify-center gap-2.5 text-[10px] font-mono tracking-[0.25em] text-white/40 uppercase"
              aria-live="polite"
            >
              <span
                className={`size-2 rounded-full ${
                  mediaReady
                    ? "bg-cyan-300 shadow-[0_0_12px_3px_rgba(34,211,238,0.7)]"
                    : "bg-white/20"
                }`}
              />
              {playbackUrl
                ? mediaReady
                  ? "Flujo de video soberano listo"
                  : "Cargando canal de video"
                : mediaFailed
                  ? "Respaldo territorial activo"
                  : "Modo de respaldo listo"}
            </div>

            {/* BOTONES DE ACCIÓN */}
            <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <button
                type="button"
                onClick={enter}
                aria-label="Iniciar la experiencia y el manifiesto"
                className="group relative flex items-center gap-3 overflow-hidden rounded border border-cyan-300/50 bg-cyan-500/10 px-9 py-4 text-xs font-mono font-bold tracking-[0.35em] text-white uppercase transition-all duration-300 hover:border-cyan-200 hover:bg-cyan-400/20 hover:shadow-[0_0_30px_rgba(34,211,238,0.4)] active:scale-95 focus-visible:outline-none"
              >
                <Play className="size-4 fill-cyan-300 text-cyan-300 transition-transform group-hover:scale-110" />
                <span>INICIAR EXPERIENCIA</span>
              </button>

              <button
                type="button"
                onClick={() => setMuted((value) => !value)}
                className="inline-flex items-center gap-2 rounded border border-white/10 bg-black/40 px-5 py-4 text-xs font-mono tracking-[0.25em] text-white/50 uppercase transition-colors hover:border-white/30 hover:text-white"
              >
                {muted ? (
                  <VolumeX className="size-4 text-red-400" />
                ) : (
                  <Volume2 className="size-4 text-cyan-300" />
                )}
                <span>{muted ? "AUDIO DESACTIVADO" : "AUDIO ACTIVADO"}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

export default function CinematicIntro(props: CinematicIntroProps) {
  return <CinematicIntroContent {...props} />;
}
