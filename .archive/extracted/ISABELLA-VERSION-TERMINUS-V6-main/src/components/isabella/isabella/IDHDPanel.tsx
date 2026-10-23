import { useState } from "react";
import { computeIDHD } from "@/lib/governance/idh-d";

export function IDHDPanel() {
  const [vals, setVals] = useState({
    autonomy: 0.85,
    privacy: 0.9,
    valueRetention: 0.75,
    cohesion: 0.8,
    delta: 0.08,
  });
  const r = computeIDHD(vals);
  return (
    <div className="rounded-2xl border border-border/20 bg-secondary/10 p-4">
      <h3 className="font-mono text-[11px] uppercase tracking-[0.24em] text-electric">
        IDH-D · Índice de Dignidad Humana Digital
      </h3>
      <p className="mt-1 text-xs text-muted-foreground">
        v3.0 — {r.policyVersion} · {r.evidenceStatus} · no bloquea sin revisión humana
      </p>
      <div className="mt-3 grid grid-cols-5 gap-2">
        {Object.entries(vals).map(([k, v]) => (
          <label key={k} className="flex flex-col gap-1">
            <span className="font-mono text-[9px] uppercase text-muted-foreground">{k}</span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={v as number}
              onChange={(e) => setVals((s) => ({ ...s, [k]: parseFloat(e.target.value) }))}
              className="accent-electric"
            />
            <span className="text-center font-mono text-xs">{(v as number).toFixed(2)}</span>
          </label>
        ))}
      </div>
      <div className="mt-4 rounded-xl bg-background/60 p-3 font-mono text-xs">
        <div className="text-lg font-bold text-platinum">
          {r.score}/100{" "}
          <span className="text-xs font-normal text-muted-foreground">· hash {r.hash}</span>
        </div>
        <div className="mt-2 text-[10px] leading-4 text-muted-foreground">
          {r.explainability.join(" · ")}
        </div>
        <div className="mt-2 text-[10px] text-emerald-400">
          Apelable: sí · SLA 72h · {r.appealable ? "Revisión humana requerida si <40" : ""}
        </div>
      </div>
    </div>
  );
}
