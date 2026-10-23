import React, { useEffect, useMemo, useRef, useState } from "react";
import { Activity, Radio, Sparkles, Volume2, Waves, type LucideIcon } from "lucide-react";
import { useCrown } from "../../context/CrownContext";

export type OscilloscopeMode = "beam" | "spectrum" | "harmonic" | "particles";
export type OscilloscopeVariant = "terminal" | "footer" | "standalone";

interface OscilloscopeWaveformProps {
  height?: number;
  className?: string;
  showControls?: boolean;
  compact?: boolean;
  variant?: OscilloscopeVariant;
}

type Rgb = { hue: number; saturation: number; lightness: number };
type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  alpha: number;
  phase: number;
};
type StateProfile = {
  label: string;
  shortLabel: string;
  primary: Rgb;
  secondary: Rgb;
  energy: number;
  speed: number;
  active: boolean;
  tone: "idle" | "processing" | "speaking" | "listening";
};

type CanvasRuntime = {
  phase: number;
  pulse: number;
  bars: Float32Array;
  particles: Particle[];
};

const BAR_COUNT = 48;
const PARTICLE_COUNT = 32;
const DEFAULT_WIDTH = 800;
const TAU = Math.PI * 2;

const MODE_OPTIONS: ReadonlyArray<{
  mode: OscilloscopeMode;
  label: string;
  Icon: LucideIcon;
}> = [
  { mode: "harmonic", label: "Ondas armónicas", Icon: Waves },
  { mode: "beam", label: "Haz de osciloscopio", Icon: Activity },
  { mode: "spectrum", label: "Espectro de frecuencia", Icon: Radio },
  { mode: "particles", label: "Campo de partículas", Icon: Sparkles },
];

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const rgba = (color: Rgb, alpha: number) =>
  `hsla(${color.hue}, ${color.saturation}%, ${color.lightness}%, ${clamp(alpha, 0, 1)})`;

const createParticles = (width: number, height: number): Particle[] =>
  Array.from({ length: PARTICLE_COUNT }, (_, index) => {
    const angle = index * 2.3999632297;
    return {
      x: ((index * 97.17) % 1) * width,
      y: ((index * 53.91) % 1) * height,
      vx: Math.cos(angle) * (0.15 + (index % 5) * 0.06),
      vy: Math.sin(angle) * (0.1 + (index % 4) * 0.05),
      radius: 0.8 + (index % 4) * 0.45,
      alpha: 0.22 + (index % 6) * 0.09,
      phase: angle,
    };
  });

const getProfile = (
  isProcessing: boolean,
  isSpeaking: boolean,
  isListening: boolean,
  activeModuleId?: string | null,
): StateProfile => {
  if (isSpeaking) {
    return {
      label: "SÍNTESIS DE AUDIO · VOZ DE ISABELLA",
      shortLabel: "TTS · 48 kHz",
      primary: { hue: 334, saturation: 92, lightness: 68 },
      secondary: { hue: 42, saturation: 92, lightness: 62 },
      energy: 1.85,
      speed: 0.105,
      active: true,
      tone: "speaking",
    };
  }

  if (isProcessing) {
    const modulePalette: Record<string, [Rgb, Rgb]> = {
      ISA: [
        { hue: 345, saturation: 90, lightness: 65 },
        { hue: 42, saturation: 90, lightness: 62 },
      ],
      SOPHIA: [
        { hue: 195, saturation: 92, lightness: 65 },
        { hue: 215, saturation: 88, lightness: 62 },
      ],
      ORION: [
        { hue: 42, saturation: 92, lightness: 63 },
        { hue: 25, saturation: 90, lightness: 58 },
      ],
      ARGUS: [
        { hue: 155, saturation: 86, lightness: 60 },
        { hue: 175, saturation: 80, lightness: 58 },
      ],
    };
    const [primary, secondary] = modulePalette[activeModuleId ?? ""] ?? [
      { hue: 215, saturation: 92, lightness: 65 },
      { hue: 45, saturation: 90, lightness: 62 },
    ];

    return {
      label: `PROCESAMIENTO COGNITIVO · ${activeModuleId || "CROWN"}`,
      shortLabel: "NEURAL · 120 Hz",
      primary,
      secondary,
      energy: 1.5,
      speed: 0.087,
      active: true,
      tone: "processing",
    };
  }

  if (isListening) {
    return {
      label: "RECEPTOR ACÚSTICO · ESCUCHANDO",
      shortLabel: "MIC · ACTIVE",
      primary: { hue: 12, saturation: 94, lightness: 62 },
      secondary: { hue: 38, saturation: 92, lightness: 60 },
      energy: 1.3,
      speed: 0.068,
      active: true,
      tone: "listening",
    };
  }

  return {
    label: "OSCILOSCOPIO CROWN · PORTADORA EN FASE",
    shortLabel: "STANDBY",
    primary: { hue: 215, saturation: 88, lightness: 63 },
    secondary: { hue: 45, saturation: 82, lightness: 58 },
    energy: 0.4,
    speed: 0.024,
    active: false,
    tone: "idle",
  };
};

const drawGrid = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
  ctx.save();
  ctx.strokeStyle = "rgba(255,255,255,0.035)";
  ctx.lineWidth = 1;

  for (let x = 0; x <= width; x += 32) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }

  for (let y = 0; y <= height; y += 16) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }
  ctx.restore();
};

const drawBaseline = (ctx: CanvasRenderingContext2D, width: number, centerY: number) => {
  ctx.save();
  ctx.strokeStyle = "rgba(255,255,255,0.11)";
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 5]);
  ctx.beginPath();
  ctx.moveTo(0, centerY);
  ctx.lineTo(width, centerY);
  ctx.stroke();
  ctx.restore();
};

const drawWave = (
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  centerY: number,
  profile: StateProfile,
  phase: number,
  mode: "beam" | "harmonic",
  reducedMotion: boolean,
) => {
  const step = width < 420 ? 3 : 2;
  const envelope = (x: number) => Math.sin((x / width) * Math.PI);

  const trace = (
    color: Rgb,
    lineWidth: number,
    alpha: number,
    amplitude: number,
    equation: (normalizedX: number) => number,
    glow = 0,
  ) => {
    ctx.save();
    ctx.strokeStyle = rgba(color, alpha);
    ctx.lineWidth = lineWidth;
    ctx.shadowColor = rgba(color, alpha * 0.9);
    ctx.shadowBlur = glow;
    ctx.beginPath();

    for (let x = 0; x <= width; x += step) {
      const normalizedX = x / width;
      const y =
        centerY +
        equation(normalizedX) *
          amplitude *
          profile.energy *
          envelope(x) *
          (reducedMotion ? 0.75 : 1);
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.restore();
  };

  if (mode === "beam") {
    trace(
      profile.primary,
      6,
      profile.active ? 0.22 : 0.1,
      height * 0.34,
      (x) => {
        const f1 = Math.sin(x * 24 + phase * 2.2);
        const f2 = Math.sin(x * 48 - phase * 3.1) * 0.4;
        const f3 = profile.tone === "speaking" ? Math.sin(x * 96 + phase * 4.5) * 0.2 : 0;
        return f1 + f2 + f3;
      },
      profile.active ? 18 : 6,
    );
    trace(
      profile.primary,
      2.2,
      profile.active ? 0.68 : 0.28,
      height * 0.34,
      (x) => {
        const f1 = Math.sin(x * 24 + phase * 2.2);
        const f2 = Math.sin(x * 48 - phase * 3.1) * 0.4;
        const f3 = profile.tone === "speaking" ? Math.sin(x * 96 + phase * 4.5) * 0.2 : 0;
        return f1 + f2 + f3;
      },
      6,
    );
    trace(
      profile.primary,
      1.1,
      profile.active ? 0.95 : 0.5,
      height * 0.34,
      (x) => {
        const f1 = Math.sin(x * 24 + phase * 2.2);
        const f2 = Math.sin(x * 48 - phase * 3.1) * 0.4;
        const f3 = profile.tone === "speaking" ? Math.sin(x * 96 + phase * 4.5) * 0.2 : 0;
        return f1 + f2 + f3;
      },
      2,
    );
    return;
  }

  trace(
    profile.secondary,
    1.6,
    profile.active ? 0.62 : 0.22,
    height * 0.29,
    (x) => Math.sin(x * 14 + phase) * Math.cos(x * 8 - phase * 0.6),
  );

  trace(
    { ...profile.primary, hue: profile.primary.hue + 38 },
    1.1,
    profile.active ? 0.4 : 0.13,
    height * 0.23,
    (x) => Math.cos(x * 20 - phase * 1.4) * Math.sin(x * 6 + phase * 0.4),
  );

  trace(
    profile.primary,
    profile.active ? 2.4 : 1.7,
    profile.active ? 0.94 : 0.48,
    height * 0.33,
    (x) => {
      const carrier = Math.sin(x * 18 + phase * 1.6);
      const harmonic = Math.sin(x * 36 - phase * 2.4) * (profile.tone === "speaking" ? 0.45 : 0.3);
      const overtone = profile.tone === "speaking" ? Math.sin(x * 72 + phase * 3.8) * 0.2 : 0;
      return carrier + harmonic + overtone;
    },
    profile.active ? 14 : 5,
  );
};

const drawSpectrum = (
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  profile: StateProfile,
  phase: number,
  bars: Float32Array,
) => {
  const gap = 2;
  const barWidth = Math.max(1, width / BAR_COUNT - gap);
  const centerY = height / 2;

  for (let index = 0; index < BAR_COUNT; index += 1) {
    const target = profile.active
      ? Math.abs(Math.sin(phase * 2 + index * 0.4) * Math.cos(phase * 0.8 + index * 0.2)) *
        (0.82 + ((index * 17) % 11) / 100)
      : 0.12 + Math.sin(phase + index * 0.2) * 0.07;

    bars[index] += (target - bars[index]) * 0.18;
    const barHeight = Math.max(4, bars[index] * height * 0.78 * profile.energy);
    const x = index * (barWidth + gap) + 1;
    const y = centerY - barHeight / 2;
    const hue = profile.primary.hue + (index / BAR_COUNT) * 42;
    const gradient = ctx.createLinearGradient(0, y, 0, y + barHeight);

    gradient.addColorStop(
      0,
      rgba({ hue, saturation: 92, lightness: 70 }, profile.active ? 0.92 : 0.38),
    );
    gradient.addColorStop(0.5, rgba(profile.secondary, profile.active ? 0.68 : 0.24));
    gradient.addColorStop(
      1,
      rgba({ hue, saturation: 92, lightness: 70 }, profile.active ? 0.92 : 0.38),
    );

    ctx.fillStyle = gradient;
    ctx.fillRect(x, y, barWidth, barHeight);

    if (profile.active) {
      ctx.fillStyle = rgba({ hue, saturation: 100, lightness: 82 }, 0.95);
      ctx.fillRect(x, y - 2, barWidth, 1.5);
      ctx.fillRect(x, y + barHeight + 0.5, barWidth, 1.5);
    }
  }
};

const drawParticles = (
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  profile: StateProfile,
  phase: number,
  particles: Particle[],
) => {
  const centerY = height / 2;

  ctx.save();
  ctx.beginPath();
  for (let x = 0; x <= width; x += 4) {
    const normalizedX = x / width;
    const y =
      centerY +
      Math.sin(normalizedX * 16 + phase * 1.5) *
        height *
        0.3 *
        profile.energy *
        Math.sin(normalizedX * Math.PI);
    if (x === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.strokeStyle = rgba(profile.primary, profile.active ? 0.62 : 0.2);
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.restore();

  for (const particle of particles) {
    particle.x += particle.vx * (profile.active ? 2.4 : 0.85);
    particle.y += particle.vy * (profile.active ? 2.4 : 0.85);

    if (particle.x < -4) particle.x = width + 4;
    if (particle.x > width + 4) particle.x = -4;
    if (particle.y < -4) particle.y = height + 4;
    if (particle.y > height + 4) particle.y = -4;

    const hue = profile.primary.hue + Math.sin(phase + particle.phase) * 28;
    ctx.save();
    ctx.beginPath();
    ctx.arc(particle.x, particle.y, particle.radius * (profile.active ? 1.45 : 1), 0, TAU);
    ctx.fillStyle = rgba(
      { hue, saturation: 92, lightness: 72 },
      particle.alpha * (profile.active ? 0.9 : 0.42),
    );
    ctx.shadowColor = rgba(profile.primary, 0.65);
    ctx.shadowBlur = 8;
    ctx.fill();
    ctx.restore();
  }
};

export const OscilloscopeWaveform: React.FC<OscilloscopeWaveformProps> = ({
  height = 54,
  className = "",
  showControls = true,
  compact = false,
  variant = "terminal",
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const runtimeRef = useRef<CanvasRuntime>({
    phase: 0,
    pulse: 0,
    bars: new Float32Array(BAR_COUNT).fill(0.1),
    particles: createParticles(DEFAULT_WIDTH, height),
  });
  const [visualMode, setVisualMode] = useState<OscilloscopeMode>("harmonic");
  const [reducedMotion, setReducedMotion] = useState(false);
  const { state, activeModuleId } = useCrown();
  const { isProcessing, isSpeaking, isListening, speechSynthesisEnabled } = state;

  const profile = useMemo(
    () => getProfile(isProcessing, isSpeaking, isListening, activeModuleId),
    [isProcessing, isSpeaking, isListening, activeModuleId],
  );

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d", { alpha: true });
    if (!context) return;

    let frameId = 0;
    let resizeFrameId: number | null = null;
    let disposed = false;
    let width = DEFAULT_WIDTH;
    let logicalHeight = Math.max(20, height);
    let pixelWidth = 0;
    let pixelHeight = 0;

    const resize = () => {
      resizeFrameId = null;
      if (disposed) return;
      const rect = canvas.getBoundingClientRect();
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      const nextWidth = Math.max(1, rect.width || DEFAULT_WIDTH);
      const nextHeight = Math.max(20, height);
      const nextPixelWidth = Math.floor(nextWidth * ratio);
      const nextPixelHeight = Math.floor(nextHeight * ratio);
      if (nextPixelWidth === pixelWidth && nextPixelHeight === pixelHeight) return;

      width = nextWidth;
      logicalHeight = nextHeight;
      pixelWidth = nextPixelWidth;
      pixelHeight = nextPixelHeight;
      canvas.width = pixelWidth;
      canvas.height = pixelHeight;
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      runtimeRef.current.particles = createParticles(width, logicalHeight);
    };

    const queueResize = () => {
      if (resizeFrameId !== null) return;
      resizeFrameId = requestAnimationFrame(resize);
    };
    const observer = new ResizeObserver(queueResize);
    observer.observe(canvas.parentElement ?? canvas);
    queueResize();

    const render = () => {
      if (disposed) return;
      const runtime = runtimeRef.current;
      const centerY = logicalHeight / 2;
      const motionFactor = reducedMotion ? 0.32 : 1;
      runtime.phase += profile.speed * motionFactor;
      runtime.pulse += 0.05 * motionFactor;

      context.clearRect(0, 0, width, logicalHeight);
      drawGrid(context, width, logicalHeight);

      if (visualMode === "spectrum") {
        drawSpectrum(context, width, logicalHeight, profile, runtime.phase, runtime.bars);
      } else if (visualMode === "particles") {
        drawParticles(context, width, logicalHeight, profile, runtime.phase, runtime.particles);
      } else {
        drawWave(
          context,
          width,
          logicalHeight,
          centerY,
          profile,
          runtime.phase,
          visualMode,
          reducedMotion,
        );
      }

      drawBaseline(context, width, centerY);
      frameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      disposed = true;
      cancelAnimationFrame(frameId);
      observer.disconnect();
    };
  }, [height, profile, reducedMotion, visualMode]);

  const statusColor = {
    speaking: "bg-pink-500",
    processing: "bg-purple-500",
    listening: "bg-amber-500",
    idle: "bg-emerald-500",
  }[profile.tone];

  const borderColor = {
    speaking: "border-pink-500/50 shadow-pink-500/10 ring-pink-500/30",
    processing: "border-purple-500/50 shadow-purple-500/10 ring-purple-500/30",
    listening: "border-amber-500/50 shadow-amber-500/10 ring-amber-500/30",
    idle: "border-slate-800/80 shadow-transparent ring-transparent",
  }[profile.tone];

  return (
    <section
      aria-label="Telemetría visual del núcleo CROWN"
      data-variant={variant}
      className={`relative w-full overflow-hidden rounded-2xl border bg-slate-950/75 shadow-lg backdrop-blur-xl transition-all duration-500 ${borderColor} ${profile.active ? "ring-1" : ""} ${className}`}
    >
      <header className="flex min-h-9 items-center justify-between gap-3 border-b border-slate-900/90 px-3 py-1.5 font-mono text-[10px]">
        <div className="flex min-w-0 items-center gap-2">
          <span className="relative flex h-2.5 w-2.5 shrink-0" aria-hidden="true">
            {profile.active && (
              <span
                className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-70 ${statusColor}`}
              />
            )}
            <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${statusColor}`} />
          </span>
          <span
            className={`truncate font-semibold uppercase tracking-[0.16em] ${profile.active ? "text-slate-100" : "text-slate-400"}`}
          >
            {profile.label}
          </span>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {!compact && (
            <span className="hidden rounded border border-slate-800 bg-slate-900/80 px-1.5 py-0.5 text-slate-400 sm:inline-flex">
              {isSpeaking && speechSynthesisEnabled ? "TTS · 48 kHz" : profile.shortLabel}
            </span>
          )}

          {showControls && (
            <div
              className="flex items-center gap-0.5 rounded-lg border border-slate-800 bg-[#081220] p-0.5"
              role="group"
              aria-label="Modo de visualización"
            >
              {MODE_OPTIONS.map(({ mode, label, Icon }) => {
                const selected = visualMode === mode;
                return (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setVisualMode(mode)}
                    aria-label={label}
                    aria-pressed={selected}
                    title={label}
                    className={`rounded-md p-1.5 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 ${selected ? "bg-blue-600 text-white shadow-md shadow-blue-600/20" : "text-slate-500 hover:bg-slate-800 hover:text-slate-200"}`}
                  >
                    <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </header>

      <div className="relative p-1">
        <canvas
          ref={canvasRef}
          className="block w-full rounded-xl"
          style={{ height: `${height}px` }}
          aria-label={`Visualización ${visualMode} · ${profile.label}`}
        />
        {isSpeaking && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 bg-gradient-to-r from-transparent via-pink-500/10 to-transparent motion-safe:animate-pulse"
          />
        )}
      </div>

      <footer className="flex items-center justify-between border-t border-slate-900/70 px-3 py-1 text-[9px] font-mono uppercase tracking-widest text-slate-600">
        <span>NODE · CROWN</span>
        <span className="flex items-center gap-1">
          <Volume2 className="h-3 w-3" aria-hidden="true" />
          {profile.active ? "LIVE TELEMETRY" : "IDLE RESONANCE"}
        </span>
      </footer>
    </section>
  );
};
