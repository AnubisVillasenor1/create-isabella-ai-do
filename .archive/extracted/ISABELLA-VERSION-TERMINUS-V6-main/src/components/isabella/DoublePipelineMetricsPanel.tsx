import { useState, useEffect, useCallback, useId } from "react";
import { Layers, Zap, RefreshCw, Activity, CheckCircle2 } from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import {
  doublePipeline,
  DoublePipelineSnapshot,
  PipelinePort,
} from "@/lib/isabella/double-pipeline";

const PORTS_METADATA: Record<PipelinePort, { label: string; description: string; role: string }> = {
  Ingest: {
    label: "P1: Ingest",
    description: "Sanitización canónica y normalización de clave",
    role: "Entrada segura y anti-tampering",
  },
  Policy: {
    label: "P2: Policy",
    description: "Evaluación CROWN y verificación Zero Trust",
    role: "Gate de gobernanza y soberanía",
  },
  Context: {
    label: "P3: Context",
    description: "Resolución de memoria de 5 scopes",
    role: "Aislamiento tenant y procedencia",
  },
  Inference: {
    label: "P4: Inference",
    description: "Motor cognitivo y transpilación cuántica",
    role: "Cómputo soberano y síntesis",
  },
  Evidence: {
    label: "P5: Evidence",
    description: "Generación de sello criptográfico y Merkle",
    role: "Auditoría inmutable append-only",
  },
  Delivery: {
    label: "P6: Delivery",
    description: "Serialización y verificación de salida",
    role: "Entrega determinista al cliente",
  },
};

export function DoublePipelineMetricsPanel() {
  const [snapshot, setSnapshot] = useState<DoublePipelineSnapshot | null>(null);
  const [isRunningBench, setIsRunningBench] = useState(false);
  const [selectedPipelineView, setSelectedPipelineView] = useState<"A" | "B" | "BOTH">("BOTH");
  const panelId = useId();

  useEffect(() => {
    const unsubscribe = doublePipeline.subscribe((newSnap) => {
      setSnapshot(newSnap);
    });
    return () => {
      unsubscribe();
    };
  }, []);

  const handleRunBenchmark = useCallback(async () => {
    setIsRunningBench(true);
    try {
      const updatedSnap = await doublePipeline.runBenchmark(6);
      setSnapshot(updatedSnap);
    } catch (_err) {
      // Manejo silencioso de benchmark
    } finally {
      setIsRunningBench(false);
    }
  }, []);

  const handleRunTurboBenchmark = useCallback(async () => {
    setIsRunningBench(true);
    try {
      const updatedSnap = await doublePipeline.runSuperTurboBenchmark(6);
      setSnapshot(updatedSnap);
    } catch (_err) {
      // Manejo silencioso de benchmark
    } finally {
      setIsRunningBench(false);
    }
  }, []);

  const handleToggleTurbo = useCallback(() => {
    if (!snapshot) return;
    doublePipeline.setTurboMode(!snapshot.turboModeEnabled);
  }, [snapshot]);

  if (!snapshot) {
    return (
      <div className="flex h-64 items-center justify-center font-mono text-xs text-muted-foreground">
        <RefreshCw className="mr-2 size-4 animate-spin text-electric" />
        Inicializando métricas del Doble Pipeline Hexagonal...
      </div>
    );
  }

  const { metricsA, metricsB, history, activePipeline } = snapshot;

  // Datos para el gráfico de barras comparativo de puertos
  const portsChartData = (Object.keys(PORTS_METADATA) as PipelinePort[]).map((port) => ({
    port: PORTS_METADATA[port].label,
    "Pipeline A (ms)": metricsA.portBreakdown[port],
    "Pipeline B (ms)": metricsB.portBreakdown[port],
  }));

  return (
    <section
      id={`hex-pipeline-${panelId}`}
      aria-labelledby={`heading-${panelId}`}
      className="space-y-5 rounded-3xl border border-border/25 bg-secondary/10 p-5 font-sans transition-all duration-300"
    >
      {/* HEADER DE CONTROL DEL PIPELINE */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-border/15 pb-4">
        <div className="flex items-start gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-2xl border border-electric/30 bg-electric/10 text-electric">
            <Layers className="size-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3
                id={`heading-${panelId}`}
                className="font-mono text-xs font-bold uppercase tracking-wider text-platinum"
              >
                Doble Pipeline Hexagonal v3.0 (A/B Activo-Activo)
              </h3>
              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 font-mono text-[9px] font-semibold text-emerald-400">
                <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Ruta Activa: Pipeline {activePipeline}
              </span>
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">
              6 Puertos soberanos con enrutamiento dinámico por Health Score y telemetría de
              percentiles p50 / p95 / p99.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* BOTÓN SUPER TURBO TOGGLE */}
          <button
            type="button"
            onClick={handleToggleTurbo}
            className={`flex items-center gap-1.5 rounded-xl border px-3 py-1.5 font-mono text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer ${
              snapshot.turboModeEnabled
                ? "border-amber-400/50 bg-amber-500/20 text-amber-300 shadow-[0_0_12px_rgba(251,191,36,0.25)]"
                : "border-border/30 bg-background/50 text-muted-foreground hover:text-platinum"
            }`}
          >
            <Zap
              className={`size-3.5 ${snapshot.turboModeEnabled ? "fill-amber-400 text-amber-400 animate-pulse" : ""}`}
            />
            <span>{snapshot.turboModeEnabled ? "Super Turbo ON (3.4x)" : "Super Turbo OFF"}</span>
          </button>

          <div className="flex items-center rounded-xl border border-border/20 bg-background/60 p-0.5 text-[10px] font-mono">
            {(["A", "B", "BOTH"] as const).map((view) => (
              <button
                key={view}
                onClick={() => setSelectedPipelineView(view)}
                className={`rounded-lg px-2.5 py-1 uppercase tracking-wider transition-all cursor-pointer ${
                  selectedPipelineView === view
                    ? "bg-electric text-black font-bold shadow-sm"
                    : "text-muted-foreground hover:text-platinum"
                }`}
              >
                {view === "BOTH" ? "Comparar" : `Pipeline ${view}`}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={handleRunTurboBenchmark}
            disabled={isRunningBench}
            className="flex items-center gap-1.5 rounded-xl border border-amber-400/40 bg-amber-400/15 px-3 py-1.5 font-mono text-[10px] font-bold uppercase tracking-wider text-amber-300 hover:bg-amber-400/25 transition-all cursor-pointer disabled:opacity-50"
          >
            <Zap className={`size-3 ${isRunningBench ? "animate-spin text-amber-300" : ""}`} />
            <span>{isRunningBench ? "Midiendo..." : "Turbo Benchmark"}</span>
          </button>

          <button
            type="button"
            onClick={handleRunBenchmark}
            disabled={isRunningBench}
            className="flex items-center gap-1.5 rounded-xl border border-electric/30 bg-electric/15 px-3 py-1.5 font-mono text-[10px] font-bold uppercase tracking-wider text-electric hover:bg-electric/25 transition-all cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`size-3 ${isRunningBench ? "animate-spin text-electric" : ""}`} />
            <span>{isRunningBench ? "Midiendo..." : "Benchmark"}</span>
          </button>
        </div>
      </div>

      {/* SUPER TURBO ACCELERATION BANNER */}
      {snapshot.turboModeEnabled && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-amber-400/30 bg-gradient-to-r from-amber-500/10 via-amber-400/5 to-transparent px-4 py-2.5 font-mono text-xs text-amber-200">
          <div className="flex items-center gap-2">
            <Zap className="size-4 text-amber-400 fill-amber-400 animate-bounce" />
            <span className="font-bold uppercase tracking-wider">
              Aceleración Super Turbo Hexagonal Activa:
            </span>
            <span className="rounded-md bg-amber-400/20 px-2 py-0.5 font-bold text-amber-300">
              Factor de Aceleración: {snapshot.turboSpeedupFactor ?? 1.0}x
            </span>
          </div>
          <div className="flex items-center gap-3 text-[11px] text-amber-300/80">
            <span>
              Ahorro en paralelo:{" "}
              <strong className="text-amber-200">{snapshot.parallelSavingsMs ?? 0} ms</strong>
            </span>
            <span>•</span>
            <span>
              Caché Triangular Hit:{" "}
              <strong className="text-amber-200">{snapshot.cacheHitRatePct}%</strong>
            </span>
          </div>
        </div>
      )}

      {/* KPI METRIC CARDS (p50, p95, p99 Y THROUGHPUT) */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
        {/* p50 Pipeline A */}
        <div className="rounded-2xl border border-border/15 bg-background/40 p-3">
          <span className="block font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
            p50 Latencia (A)
          </span>
          <div className="mt-1 flex items-baseline gap-1">
            <span className="font-mono text-xl font-bold text-emerald-400">
              {metricsA.p50.toFixed(2)}
            </span>
            <span className="font-mono text-[10px] text-muted-foreground">ms</span>
          </div>
          <span className="mt-1 block font-mono text-[8.5px] text-muted-foreground">
            Mediana nominal
          </span>
        </div>

        {/* p95 Pipeline A */}
        <div className="rounded-2xl border border-border/15 bg-background/40 p-3">
          <span className="block font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
            p95 Latencia (A)
          </span>
          <div className="mt-1 flex items-baseline gap-1">
            <span className="font-mono text-xl font-bold text-electric">
              {metricsA.p95.toFixed(2)}
            </span>
            <span className="font-mono text-[10px] text-muted-foreground">ms</span>
          </div>
          <span className="mt-1 block font-mono text-[8.5px] text-muted-foreground">
            Percentil 95
          </span>
        </div>

        {/* p99 Pipeline A */}
        <div className="rounded-2xl border border-border/15 bg-background/40 p-3">
          <span className="block font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
            p99 Latencia (A)
          </span>
          <div className="mt-1 flex items-baseline gap-1">
            <span className="font-mono text-xl font-bold text-amber-400">
              {metricsA.p99.toFixed(2)}
            </span>
            <span className="font-mono text-[10px] text-muted-foreground">ms</span>
          </div>
          <span className="mt-1 block font-mono text-[8.5px] text-muted-foreground">
            Cola crítica
          </span>
        </div>

        {/* p50 Pipeline B (Failover) */}
        <div className="rounded-2xl border border-border/15 bg-background/40 p-3">
          <span className="block font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
            p50 Latencia (B)
          </span>
          <div className="mt-1 flex items-baseline gap-1">
            <span className="font-mono text-xl font-bold text-emerald-400">
              {metricsB.p50.toFixed(2)}
            </span>
            <span className="font-mono text-[10px] text-muted-foreground">ms</span>
          </div>
          <span className="mt-1 block font-mono text-[8.5px] text-muted-foreground">
            Failover pasivo
          </span>
        </div>

        {/* Throughput */}
        <div className="rounded-2xl border border-border/15 bg-background/40 p-3">
          <span className="block font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
            Rendimiento
          </span>
          <div className="mt-1 flex items-baseline gap-1">
            <span className="font-mono text-xl font-bold text-platinum">
              {(metricsA.throughputReqSec + metricsB.throughputReqSec).toFixed(0)}
            </span>
            <span className="font-mono text-[10px] text-muted-foreground">ops/s</span>
          </div>
          <span className="mt-1 block font-mono text-[8.5px] text-emerald-400">
            {snapshot.cacheHitRatePct}% Cache Hit
          </span>
        </div>

        {/* Health Score */}
        <div className="rounded-2xl border border-border/15 bg-background/40 p-3">
          <span className="block font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
            Salud y Backpressure
          </span>
          <div className="mt-1 flex items-baseline gap-1">
            <span className="font-mono text-xl font-bold text-emerald-400">
              {(snapshot.healthA * 100).toFixed(1)}%
            </span>
          </div>
          <span className="mt-1 block font-mono text-[8.5px] text-muted-foreground">
            BP: {metricsA.backpressure.toFixed(3)}
          </span>
        </div>
      </div>

      {/* CHARTS CONTAINER */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* CHART 1: TIME-SERIES LATENCY EVOLUTION (p50, p95, p99) */}
        <div className="rounded-2xl border border-border/15 bg-background/30 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity className="size-4 text-electric" />
              <h4 className="font-mono text-[11px] font-bold uppercase tracking-wider text-platinum">
                Evolución Temporal de Latencia (p50, p95, p99)
              </h4>
            </div>
            <span className="font-mono text-[9px] text-muted-foreground">
              Ventana de {history.length} muestras
            </span>
          </div>

          <div className="h-[210px] w-full font-mono text-[10px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={history} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorP50" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorP95" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#38bdf8" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorP99" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="time" stroke="#94a3b8" />
                <YAxis stroke="#94a3b8" unit="ms" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#0d1117",
                    borderColor: "rgba(255,255,255,0.1)",
                    borderRadius: "12px",
                    color: "#f8fafc",
                    fontFamily: "monospace",
                    fontSize: "11px",
                  }}
                />
                <Legend />
                <Area
                  name="p50 (Mediana)"
                  type="monotone"
                  dataKey="p50A"
                  stroke="#10b981"
                  fillOpacity={1}
                  fill="url(#colorP50)"
                  strokeWidth={2}
                />
                <Area
                  name="p95 (Percentil 95)"
                  type="monotone"
                  dataKey="p95A"
                  stroke="#38bdf8"
                  fillOpacity={1}
                  fill="url(#colorP95)"
                  strokeWidth={2}
                />
                <Area
                  name="p99 (Percentil 99)"
                  type="monotone"
                  dataKey="p99A"
                  stroke="#f59e0b"
                  fillOpacity={1}
                  fill="url(#colorP99)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* CHART 2: HEXAGONAL PORTS LATENCY BREAKDOWN */}
        <div className="rounded-2xl border border-border/15 bg-background/30 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Zap className="size-4 text-emerald-400" />
              <h4 className="font-mono text-[11px] font-bold uppercase tracking-wider text-platinum">
                Desglose por Puerto Hexagonal (P1 a P6)
              </h4>
            </div>
            <span className="font-mono text-[9px] text-muted-foreground">
              Latencia promedio por puerto
            </span>
          </div>

          <div className="h-[210px] w-full font-mono text-[10px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={portsChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="port" stroke="#94a3b8" />
                <YAxis stroke="#94a3b8" unit="ms" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#0d1117",
                    borderColor: "rgba(255,255,255,0.1)",
                    borderRadius: "12px",
                    color: "#f8fafc",
                    fontFamily: "monospace",
                    fontSize: "11px",
                  }}
                />
                <Legend />
                <Bar
                  name="Pipeline A (ms)"
                  dataKey="Pipeline A (ms)"
                  fill="#10b981"
                  radius={[4, 4, 0, 0]}
                />
                <Bar
                  name="Pipeline B (ms)"
                  dataKey="Pipeline B (ms)"
                  fill="#38bdf8"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* DETALLE DE LOS 6 PUERTOS HEXAGONALES */}
      <div className="rounded-2xl border border-border/15 bg-background/20 p-4">
        <h4 className="mb-3 font-mono text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
          Topología de Puertos Hexagonales — Auditoría F (Capítulo XVI)
        </h4>
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6 font-mono text-[10px]">
          {(Object.keys(PORTS_METADATA) as PipelinePort[]).map((port) => {
            const meta = PORTS_METADATA[port];
            const latA = metricsA.portBreakdown[port];
            return (
              <div
                key={port}
                className="rounded-xl border border-border/10 bg-secondary/15 p-2.5 space-y-1 transition-all hover:border-electric/30"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-platinum">{meta.label}</span>
                  <CheckCircle2 className="size-3 text-emerald-400" />
                </div>
                <div className="text-[11px] font-bold text-electric">{latA.toFixed(3)} ms</div>
                <p className="text-[8.5px] leading-tight text-muted-foreground">
                  {meta.description}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
