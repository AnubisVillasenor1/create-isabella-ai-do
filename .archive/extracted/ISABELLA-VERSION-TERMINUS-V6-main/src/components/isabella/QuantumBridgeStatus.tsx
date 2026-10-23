import React, { useState } from "react";
import { Zap, Wifi, WifiOff, RefreshCw, Cpu, Activity, Clock, CircleHelp } from "lucide-react";

export interface QuantumBridgeStatusProps {
  connected?: boolean;
  executionCount?: number;
  lastExecutionTime?: string;
  latencyMs?: number;
  activeQubits?: number;
  onRefreshStatus?: () => void;
}

/**
 * QuantumBridgeStatus deliberately renders only evidence supplied by its caller.
 * It does not simulate heartbeats, executions, latency or qubit counts.
 * A missing value is shown as "No disponible / No verificado".
 */
export function QuantumBridgeStatus({
  connected,
  executionCount,
  lastExecutionTime,
  latencyMs,
  activeQubits,
  onRefreshStatus,
}: QuantumBridgeStatusProps) {
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    if (!onRefreshStatus) return;
    setIsRefreshing(true);
    try {
      await onRefreshStatus();
    } finally {
      setIsRefreshing(false);
    }
  };

  const connectionLabel =
    connected === true ? "CONECTADO" : connected === false ? "DESCONECTADO" : "NO VERIFICADO";
  const ConnectionIcon = connected === true ? Wifi : connected === false ? WifiOff : CircleHelp;

  return (
    <div
      id="quantum-bridge-status-panel"
      className="w-full rounded-xl border border-purple-500/20 bg-slate-900/80 p-4 text-slate-100 shadow-md backdrop-blur-sm"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-700 bg-slate-800/60 text-purple-400">
            <Zap className="size-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-[10px] uppercase tracking-wider text-slate-400 font-semibold">
                Puente Cuántico PennyLane QUP-v3
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold border bg-slate-800 text-slate-300 border-slate-700">
                <ConnectionIcon className="size-3" />
                {connectionLabel}
              </span>
            </div>
            <h4 className="text-sm font-bold text-white tracking-tight">
              Estado de Enlace & Monitoreo de Ejecuciones
            </h4>
          </div>
        </div>

        {onRefreshStatus && (
          <button
            type="button"
            onClick={() => void handleRefresh()}
            disabled={isRefreshing}
            className="self-start sm:self-auto px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 text-xs font-mono text-slate-200 flex items-center gap-1.5 transition-all disabled:opacity-50"
          >
            <RefreshCw
              className={`size-3.5 ${isRefreshing ? "animate-spin text-purple-400" : ""}`}
            />
            <span>Verificar Estado</span>
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3 font-mono text-xs">
        <Metric icon={<Activity className="size-3 text-purple-400" />} label="Ejecuciones Totales">
          {executionCount == null ? "No disponible" : `${executionCount.toLocaleString()} QNodes`}
        </Metric>
        <Metric icon={<Clock className="size-3 text-sky-400" />} label="Latencia de Enlace">
          {latencyMs == null ? "No disponible" : `${latencyMs} ms`}
        </Metric>
        <Metric icon={<Cpu className="size-3 text-emerald-400" />} label="Qubits / Wires">
          {activeQubits == null ? "No disponible" : `${activeQubits} asignados`}
        </Metric>
        <Metric icon={<Clock className="size-3 text-amber-400" />} label="Última Evidencia">
          {lastExecutionTime ?? "No disponible"}
        </Metric>
      </div>
    </div>
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
    <div className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800/80 space-y-0.5">
      <span className="text-[10px] uppercase text-slate-400 flex items-center gap-1">
        {icon} {label}
      </span>
      <p className="text-sm font-bold text-white">{children}</p>
    </div>
  );
}

export default QuantumBridgeStatus;
