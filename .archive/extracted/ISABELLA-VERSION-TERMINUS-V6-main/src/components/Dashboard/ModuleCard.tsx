import React, { useState } from "react";
import { CognitiveModule } from "../../types";
import { useCrown } from "../../context/CrownContext";
import {
  Brain,
  Heart,
  Zap,
  Shield,
  Layers,
  Activity,
  Sliders,
  Settings2,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  Cpu,
  Power,
} from "lucide-react";
import { soundManager } from "../../utils/soundEffects";

interface ModuleCardProps {
  module: CognitiveModule;
  isFocused?: boolean;
}

export const ModuleCard: React.FC<ModuleCardProps> = ({ module, isFocused = false }) => {
  const { updateModuleParameter, activeModuleId } = useCrown();
  const [showSettings, setShowSettings] = useState(false);

  const isCurrentActive = activeModuleId === module.id;

  const getModuleIcon = () => {
    switch (module.id) {
      case "ISA":
        return Heart;
      case "SOPHIA":
        return Brain;
      case "ORION":
        return Zap;
      case "ARGUS":
        return Shield;
      case "CROWN_GATEWAY":
      default:
        return Layers;
    }
  };

  const Icon = getModuleIcon();

  const handleWeightChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    updateModuleParameter(module.id, "weight", parseFloat(e.target.value));
  };

  const handleSensitivityChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    updateModuleParameter(module.id, "sensitivity", parseFloat(e.target.value));
  };

  const handleToggle = () => {
    soundManager.playBeep(module.parameters.enabled ? 400 : 800, 0.03);
    updateModuleParameter(module.id, "enabled", !module.parameters.enabled);
  };

  return (
    <div
      className={`relative flex flex-col justify-between rounded-2xl border transition-all duration-300 p-5 backdrop-blur-xl bg-[#070F1E]/80 ${
        isCurrentActive
          ? `border-blue-500 ring-2 ring-blue-500/40 shadow-2xl shadow-blue-500/20 scale-[1.02]`
          : `border-slate-800 hover:border-slate-700`
      } ${!module.parameters.enabled ? "opacity-50 grayscale" : ""}`}
    >
      {/* Active pulse highlight badge */}
      {isCurrentActive && (
        <div className="absolute -top-2.5 right-4 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase bg-blue-600 text-white shadow-md animate-pulse">
          ⚡ Enrutamiento Activo
        </div>
      )}

      <div>
        {/* Module Header */}
        <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-800/80">
          <div className="flex items-center gap-3">
            <div
              className={`flex items-center justify-center w-11 h-11 rounded-xl border shadow-inner ${module.themeColor.badge}`}
            >
              <Icon className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base text-[#F8FAFC] font-mono tracking-wide">
                  {module.name}
                </h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-[#030712] text-slate-400 border border-slate-800">
                  {module.acronym}
                </span>
              </div>
              <p className="text-xs text-slate-400 font-medium">{module.role}</p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setShowSettings(!showSettings)}
              className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
                showSettings
                  ? "bg-blue-950/60 border-blue-500/50 text-sky-300"
                  : "bg-[#030712] border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-[#081220]"
              }`}
              title="Ajustar parámetros cognitivos"
            >
              <Sliders className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={handleToggle}
              className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
                module.parameters.enabled
                  ? "bg-emerald-950/40 border-emerald-500/40 text-emerald-400"
                  : "bg-red-950/40 border-red-500/40 text-red-400"
              }`}
              title={module.parameters.enabled ? "Módulo activado" : "Módulo en pausa"}
            >
              <Power className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Full Name & Description */}
        <div className="py-2.5 space-y-1">
          <p className="text-[11px] font-mono font-medium text-sky-300/90">
            {module.fullName}
          </p>
          <p className="text-xs text-slate-300 leading-relaxed font-sans">
            {module.description}
          </p>
        </div>

        {/* Core Pillars */}
        <div className="flex flex-wrap gap-1.5 py-2">
          {module.corePillars.map((pillar) => (
            <span
              key={pillar}
              className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-[#030712] text-slate-300 border border-slate-800"
            >
              • {pillar}
            </span>
          ))}
        </div>
      </div>

      {/* Real-time Telemetry Metrics & Sliders */}
      <div className="pt-3 border-t border-slate-800/80 space-y-3">
        {/* Real-time Metric Gauges */}
        <div className="grid grid-cols-3 gap-2 text-center font-mono">
          <div className="p-2 rounded-xl bg-[#030712] border border-slate-800/80">
            <span className="text-[10px] text-slate-400 block">ACTIVACIÓN</span>
            <span className="text-sm font-bold text-slate-100">
              {module.metrics.activation}%
            </span>
            <div className="w-full bg-slate-900 h-1 rounded-full overflow-hidden mt-1">
              <div
                className="h-full rounded-full bg-blue-500 transition-all duration-300"
                style={{ width: `${module.metrics.activation}%` }}
              />
            </div>
          </div>

          <div className="p-2 rounded-xl bg-[#030712] border border-slate-800/80">
            <span className="text-[10px] text-slate-400 block">LATENCIA</span>
            <span className="text-sm font-bold text-sky-400">
              {module.metrics.latencyMs}ms
            </span>
            <span className="text-[9px] text-slate-400 block mt-0.5">
              {module.metrics.throughput}
            </span>
          </div>

          <div className="p-2 rounded-xl bg-[#030712] border border-slate-800/80">
            <span className="text-[10px] text-slate-400 block">CONFIANZA</span>
            <span className="text-sm font-bold text-emerald-400">
              {module.metrics.confidence}%
            </span>
            <span className="text-[9px] text-slate-400 block mt-0.5">
              {module.metrics.activeThreads} hilos
            </span>
          </div>
        </div>

        {/* Dynamic Parameter Tuning Drawer */}
        {showSettings && (
          <div className="p-3 rounded-xl bg-[#030712] border border-slate-800 space-y-2.5 text-xs font-mono animate-in fade-in duration-150">
            <div className="space-y-1">
              <div className="flex justify-between text-[11px]">
                <span className="text-slate-300">Peso de Enrutamiento CROWN:</span>
                <span className="text-sky-400 font-bold">
                  {(module.parameters.weight * 100).toFixed(0)}%
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={module.parameters.weight}
                onChange={handleWeightChange}
                className="w-full accent-blue-500 cursor-pointer h-1.5 bg-slate-900 rounded-lg"
              />
            </div>

            <div className="space-y-1">
              <div className="flex justify-between text-[11px]">
                <span className="text-slate-300">Sensibilidad Semántica:</span>
                <span className="text-amber-400 font-bold">
                  {(module.parameters.sensitivity * 100).toFixed(0)}%
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={module.parameters.sensitivity}
                onChange={handleSensitivityChange}
                className="w-full accent-amber-500 cursor-pointer h-1.5 bg-slate-900 rounded-lg"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
