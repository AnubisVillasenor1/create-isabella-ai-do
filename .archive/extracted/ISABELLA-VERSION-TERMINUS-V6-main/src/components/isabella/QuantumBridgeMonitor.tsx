import React from "react";
import { Activity, CircleHelp, Clock, Cpu, Gauge, Shield, Zap } from "lucide-react";

export interface QuantumTelemetryPoint {
  timestamp: string;
  circuitId: string;
  latencyMs: number;
  throughputOps: number;
  timeoutThresholdMs: number;
  wiresUsed: number;
  shotsExecuted: number;
  fidelity: number;
  status: "COMPLETED" | "EXECUTING" | "TRANSPILED" | "TIMEOUT" | "ERROR";
}

export interface QuantumEnvConfig {
  bridgeTimeoutMs: number;
  maxLatencyMs: number;
  maxWires: number;
  maxShots: number;
  maxFeatures: number;
  maxWeights: number;
  bridgeScript: string;
  pythonBin: string;
}

/**
 * Quantum runtime telemetry is not fabricated in the client.
 *
 * The repository currently contains the PennyLane bridge/export contract, but
 * no canonical /api/quantum telemetry endpoint. Until that backend boundary
 * exists, this panel reports the capability as UNVERIFIED instead of inventing
 * latency, throughput, fidelity, QNode counts or execution history.
 */
export function QuantumBridgeMonitor() {
  const bridgeTimeoutMs = Number(import.meta.env.VITE_QUANTUM_BRIDGE_TIMEOUT_MS) || 8000;
  const maxLatencyMs = Number(import.meta.env.VITE_QUANTUM_MAX_LATENCY_MS) || 45000;
  const maxWires = Number(import.meta.env.VITE_QUANTUM_MAX_WIRES) || 32;
  const maxShots = Number(import.meta.env.VITE_QUANTUM_MAX_SHOTS) || 500000;

  return (
    <section
      id="quantum-bridge-monitor"
      className="w-full rounded-2xl border border-slate-800 bg-slate-950 p-6 text-slate-100 shadow-2xl space-y-6"
      aria-label="Estado del puente cuántico"
    >
      <header className="flex items-center gap-3 border-b border-slate-800 pb-4">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-800 border border-slate-700 text-slate-300">
          <Zap className="h-6 w-6" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h2 className="font-mono text-xs uppercase tracking-widest text-slate-400 font-semibold">
              Puente Cuántico PennyLane · Xanadu QML
            </h2>
            <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-mono font-bold text-amber-300">
              NO VERIFICADO
            </span>
          </div>
          <h3 className="text-xl font-bold tracking-tight text-white">
            Telemetría runtime no disponible
          </h3>
        </div>
      </header>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono">
        <Metric icon={<Clock className="size-3 text-purple-400" />} label="Timeout configurado">
          {bridgeTimeoutMs} ms
        </Metric>
        <Metric icon={<Gauge className="size-3 text-sky-400" />} label="Latencia máxima">
          {maxLatencyMs} ms
        </Metric>
        <Metric icon={<Cpu className="size-3 text-emerald-400" />} label="Wires máximos">
          {maxWires}
        </Metric>
        <Metric icon={<Activity className="size-3 text-amber-400" />} label="Shots máximos">
          {maxShots.toLocaleString()}
        </Metric>
      </div>

      <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-5">
        <div className="flex items-start gap-3">
          <CircleHelp className="mt-0.5 size-5 shrink-0 text-amber-300" />
          <div className="space-y-2">
            <p className="text-sm font-semibold text-white">No se muestran métricas simuladas.</p>
            <p className="text-xs leading-relaxed text-slate-400">
              El frontend no dispone actualmente de un endpoint canónico que entregue latencia,
              throughput, fidelidad, ejecuciones o QNodes reales del bridge. Por diseño, el panel
              permanece en estado <strong>NO VERIFICADO</strong>
              hasta que exista esa frontera backend y su evidencia de ejecución.
            </p>
            <p className="text-xs leading-relaxed text-slate-500">
              El contrato de configuración puede visualizarse; los resultados de hardware o
              simulador deben provenir del runtime cuántico real.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Evidence title="Integración de bridge">
          <span className="text-amber-300">Contrato presente · runtime no verificado</span>
        </Evidence>
        <Evidence title="Telemetría">
          <span className="text-amber-300">Endpoint canónico pendiente</span>
        </Evidence>
        <Evidence title="Ejecución QNode">
          <span className="text-amber-300">Sin evidencia runtime en cliente</span>
        </Evidence>
        <Evidence title="Fidelidad / throughput">
          <span className="text-amber-300">Sin medición verificable</span>
        </Evidence>
      </div>

      <div className="flex items-center gap-2 text-[11px] text-slate-500 font-mono">
        <Shield className="size-3.5" />
        ARGUS policy: synthetic quantum telemetry is prohibited.
      </div>
    </section>
  );
}

function Metric({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-slate-800/80 bg-slate-900/60 p-3 space-y-1">
      <span className="flex items-center gap-1 text-[10px] uppercase text-slate-400">
        {icon}
        {label}
      </span>
      <p className="text-base font-bold text-white">{children}</p>
    </div>
  );
}

function Evidence({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-800/80 bg-slate-900/40 p-4 space-y-2">
      <span className="block text-[10px] uppercase font-mono text-slate-500">{title}</span>
      <div className="text-xs font-mono">{children}</div>
    </div>
  );
}

export default QuantumBridgeMonitor;
