import React, { useEffect, useState } from "react";
import { Network, Zap, Cpu, CheckCircle2, AlertTriangle } from "lucide-react";
import { useServerFn } from "../../lib/tanstack-polyfill";
import { getQuantumReflection } from "../../lib/atlas.functions";

export const QuantumReflectionCard: React.FC = () => {
  const [data, setData] = useState<any>(null);
  const fetchReflection = useServerFn(getQuantumReflection);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const res = await fetchReflection();
        if (mounted) setData(res);
      } catch (e) {
        console.error(e);
      }
    };
    load();
    const t = setInterval(load, 5000);
    return () => { mounted = false; clearInterval(t); };
  }, []);

  if (!data) return <div className="p-4 bg-slate-900 animate-pulse rounded-xl h-48"></div>;

  return (
    <div className="p-5 rounded-xl border border-indigo-500/30 bg-gradient-to-br from-indigo-900/10 to-slate-900 relative overflow-hidden group col-span-1 lg:col-span-2">
      {/* Background decoration */}
      <div className="absolute -right-12 -top-12 opacity-5 pointer-events-none group-hover:opacity-10 transition-opacity">
        <Network className="w-48 h-48 text-indigo-400" />
      </div>

      <div className="flex justify-between items-start mb-6 border-b border-indigo-500/20 pb-4">
        <div>
          <h4 className="text-sm font-bold font-mono text-indigo-400 flex items-center gap-2 uppercase tracking-wider">
            <Zap className="w-4 h-4 text-indigo-400" />
            Puente Cuántico & Reflexión (PennyLane)
          </h4>
          <p className="text-[10px] text-slate-400 font-mono mt-1">Federación: {data.target}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
          </span>
          <span className="text-[10px] text-indigo-300 font-mono tracking-widest">{data.federationStatus}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 relative z-10">
        <div className="space-y-4">
          <div className="space-y-2">
            <h5 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
              <CheckCircle2 className="w-3 h-3 text-emerald-400" /> Fortalezas Detectadas
            </h5>
            <ul className="space-y-1">
              {data.selfReflection.strengths.map((s: string, i: number) => (
                <li key={i} className="text-xs text-slate-300 font-sans flex items-start gap-2">
                  <span className="text-emerald-500 mt-0.5">•</span> {s}
                </li>
              ))}
            </ul>
          </div>
          <div className="space-y-2">
            <h5 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
              <AlertTriangle className="w-3 h-3 text-amber-400" /> Vulnerabilidades & Errores
            </h5>
            <ul className="space-y-1">
              {data.selfReflection.weaknesses.map((w: string, i: number) => (
                <li key={i} className="text-xs text-slate-300 font-sans flex items-start gap-2">
                  <span className="text-amber-500 mt-0.5">•</span> {w}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="space-y-4">
          <div className="bg-indigo-950/30 p-4 rounded-lg border border-indigo-500/20">
            <h5 className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest mb-2 flex items-center gap-2">
              <Cpu className="w-3 h-3" /> Módulos QML Ingeridos
            </h5>
            <div className="flex flex-wrap gap-2">
              {data.ingestedModules.map((m: string) => (
                <span key={m} className="px-2 py-1 text-[9px] font-mono bg-indigo-900/40 text-indigo-200 rounded border border-indigo-500/30">
                  {m}
                </span>
              ))}
            </div>
          </div>
          <div className="bg-slate-900/50 p-4 rounded-lg border border-slate-800/50">
             <h5 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Síntesis Reflexiva</h5>
             <p className="text-xs text-slate-300 leading-relaxed font-sans italic">
               "{data.selfReflection.insights}"
             </p>
          </div>
        </div>
      </div>
    </div>
  );
};
