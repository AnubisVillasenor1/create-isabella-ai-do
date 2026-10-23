import React, { useEffect, useState } from "react";
import { Activity, ShieldAlert, BookOpen, Database, BrainCircuit, Globe, Landmark, Coins, ShieldCheck, Lock, Sparkles } from "lucide-react";
import { useServerFn } from "../../lib/tanstack-polyfill";
import { getCockpitSnapshot } from "../../lib/atlas.functions";
import { RScoreGauge } from "./RScoreGauge";
import { Litle32Gates } from "./Litle32Gates";
import { QuantumReflectionCard } from "./QuantumReflectionCard";
import { CrownGovernanceCard } from "./CrownGovernanceCard";

export const Cockpit: React.FC = () => {
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchSnapshot = useServerFn(getCockpitSnapshot);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const res = await fetchSnapshot();
        if (mounted) setData(res);
      } catch (e: any) {
        if (mounted) setError(e.message);
      }
    };
    load();
    const t = setInterval(load, 3000);
    return () => {
      mounted = false;
      clearInterval(t);
    };
  }, []);

  if (error) {
    return (
      <div className="p-6 bg-red-950/20 text-red-400 border border-red-500/30 rounded-2xl font-mono text-xs">
        Error en conexión de datos: {error}
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-12 text-center text-slate-400 font-mono text-xs animate-pulse flex flex-col items-center justify-center space-y-3">
        <Activity className="w-8 h-8 text-amber-400 animate-spin" />
        <span>Estableciendo telemetría con el Núcleo Civilizatorio Atlas...</span>
      </div>
    );
  }

  const { metrics, auditLogs, bookpi, anubis, isabella, eoct, economy, dao } = data;

  return (
    <div className="space-y-6 animate-in fade-in duration-500 text-slate-200">
      {/* Top Bar Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gradient-to-r from-[#050C1B] via-slate-900 to-[#050C1B] border border-slate-800 p-5 rounded-3xl shadow-xl">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-blue-500/10 text-blue-400 rounded-2xl border border-blue-500/30 shadow-[0_0_20px_rgba(59,130,246,0.2)]">
            <Globe className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-100 font-mono flex items-center gap-2">
              <span>Atlas Cockpit</span>
              <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded border border-emerald-500/30 font-mono">
                PQC VERIFIED
              </span>
            </h1>
            <p className="text-xs text-slate-400 font-mono">Telemetría en vivo de infraestructura cognitiva e institucional.</p>
          </div>
        </div>

        <div className="flex items-center gap-2 font-mono text-xs">
          <div className="text-slate-400 bg-[#030712] px-3.5 py-1.5 rounded-xl border border-slate-800 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            <span>UTC: {new Date(data.now).toLocaleTimeString()}</span>
          </div>
        </div>
      </div>

      {/* Security & Core State (4 Quadrants Balanced) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <RScoreGauge />
        <Litle32Gates />
        <QuantumReflectionCard />
        <CrownGovernanceCard />
      </div>

      {/* Primary KPI Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 font-mono">
        
        {/* BookPI */}
        <div className="bg-gradient-to-br from-slate-900 to-[#030712] border border-slate-800/80 p-5 rounded-2xl flex flex-col justify-between shadow-xl">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-slate-300 font-bold text-xs flex items-center gap-2">
              <Database className="w-4 h-4 text-emerald-400" /> BookPI Ledger
            </h3>
            <span className="text-[9px] bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded border border-emerald-500/20">
              ML-DSA-87
            </span>
          </div>
          <div>
            <div className="text-3xl font-bold text-white tracking-wider">{bookpi.stats.total}</div>
            <p className="text-[10px] text-slate-500 mt-1 uppercase tracking-wider">Bloques Minados</p>
          </div>
          <div className="mt-3 text-[10px] text-slate-500 truncate bg-[#030712] p-2 rounded border border-slate-800">
            HASH: {bookpi.stats.latestHash?.slice(0, 16)}...
          </div>
        </div>

        {/* Anubis */}
        <div className="bg-gradient-to-br from-slate-900 to-[#030712] border border-slate-800/80 p-5 rounded-2xl flex flex-col justify-between shadow-xl">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-slate-300 font-bold text-xs flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-rose-400" /> Anubis Sentinel
            </h3>
            {anubis.stats.criticals > 0 && (
              <span className="flex w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping" />
            )}
          </div>
          <div>
            <div className="text-3xl font-bold text-white tracking-wider">{anubis.stats.total}</div>
            <p className="text-[10px] text-slate-500 mt-1 uppercase tracking-wider">Políticas Evaluadas</p>
          </div>
          <div className="mt-3 flex justify-between text-[11px] text-slate-400 bg-[#030712] p-2 rounded border border-slate-800">
            <span>Críticos: <span className={anubis.stats.criticals > 0 ? "text-rose-400 font-bold" : "text-emerald-400"}>{anubis.stats.criticals}</span></span>
            <span>Riesgo: {(anubis.stats.avgAnomalyScore * 100).toFixed(1)}%</span>
          </div>
        </div>

        {/* Isabella */}
        <div className="bg-gradient-to-br from-slate-900 to-[#030712] border border-slate-800/80 p-5 rounded-2xl flex flex-col justify-between shadow-xl">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-slate-300 font-bold text-xs flex items-center gap-2">
              <BrainCircuit className="w-4 h-4 text-purple-400" /> Isabella Cognitive
            </h3>
            <span className="text-[9px] px-2 py-0.5 rounded bg-purple-500/10 text-purple-300 border border-purple-500/20 uppercase font-bold">
              {isabella.stats.emotionalState.dominant}
            </span>
          </div>
          <div>
            <div className="text-3xl font-bold text-white tracking-wider">{isabella.stats.episodesRecorded}</div>
            <p className="text-[10px] text-slate-500 mt-1 uppercase tracking-wider">Episodios en Memoria</p>
          </div>
          <div className="mt-3 w-full bg-slate-800 h-2 rounded-full overflow-hidden">
            <div
              className="bg-gradient-to-r from-purple-500 to-indigo-500 h-full rounded-full transition-all"
              style={{ width: `${Math.min(100, isabella.stats.episodesRecorded * 5)}%` }}
            />
          </div>
        </div>

        {/* Economy */}
        <div className="bg-gradient-to-br from-slate-900 to-[#030712] border border-slate-800/80 p-5 rounded-2xl flex flex-col justify-between shadow-xl">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-slate-300 font-bold text-xs flex items-center gap-2">
              <Coins className="w-4 h-4 text-amber-300" /> Ecosistema CATTLEYA
            </h3>
            <span className="text-[9px] bg-amber-500/10 text-amber-300 px-2 py-0.5 rounded border border-amber-500/20">
              DM-X4
            </span>
          </div>
          <div>
            <div className="text-3xl font-bold text-white tracking-wider">${economy.stats.totalVolume.toLocaleString()}</div>
            <p className="text-[10px] text-slate-500 mt-1 uppercase tracking-wider">Volumen Transaccionado</p>
          </div>
          <div className="mt-3 text-[10px] text-slate-400 flex justify-between bg-[#030712] p-2 rounded border border-slate-800">
            <span>Órdenes: {economy.stats.ordersCount}</span>
            <span>Pagadas: {economy.stats.paidOrdersCount}</span>
          </div>
        </div>

      </div>
    </div>
  );
};
