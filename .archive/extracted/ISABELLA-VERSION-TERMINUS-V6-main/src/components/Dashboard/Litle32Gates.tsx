import React, { useEffect, useState } from "react";
import { Lock } from "lucide-react";

export const Litle32Gates: React.FC = () => {
  const [gates, setGates] = useState<boolean[]>(Array(32).fill(true));

  useEffect(() => {
    const interval = setInterval(() => {
      // Randomly flicker some gates to simulate active evaluation
      setGates(prev => prev.map(state => Math.random() > 0.95 ? !state : (Math.random() > 0.8 ? true : state)));
    }, 400);
    return () => clearInterval(interval);
  }, []);

  const groups = [
    { name: "Integrity (01-08)", start: 0, end: 8 },
    { name: "Ethical Filter (09-16)", start: 8, end: 16 },
    { name: "Math/Logic (17-24)", start: 16, end: 24 },
    { name: "Governance (25-32)", start: 24, end: 32 },
  ];

  return (
    <div className="p-4 rounded-xl border border-slate-800/60 bg-[#030712] relative overflow-hidden">
      <div className="flex justify-between items-start mb-4">
        <div>
          <h4 className="text-xs font-bold font-mono text-slate-400 flex items-center gap-2 uppercase tracking-wider">
            <Lock className="w-3.5 h-3.5" />
            LITLE-32 Gates (Verificación Lógica)
          </h4>
          <p className="text-[10px] text-slate-500 font-mono mt-1">Marco criptográfico interno de entropía</p>
        </div>
      </div>

      <div className="space-y-4">
        {groups.map((g, i) => (
          <div key={i} className="space-y-1.5">
            <div className="text-[9px] font-mono text-slate-500 uppercase tracking-widest">{g.name}</div>
            <div className="flex gap-1">
              {gates.slice(g.start, g.end).map((isActive, idx) => (
                <div
                  key={idx}
                  className={`h-4 flex-1 rounded-sm transition-colors duration-300 ${
                    isActive 
                      ? "bg-emerald-500/20 border border-emerald-500/40 shadow-[0_0_8px_rgba(16,185,129,0.15)]" 
                      : "bg-amber-500/80 border border-amber-400 shadow-[0_0_8px_rgba(245,158,11,0.5)]"
                  }`}
                  title={`Gate ${String(g.start + idx + 1).padStart(2, '0')} - ${isActive ? 'PASSED' : 'EVALUATING'}`}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
