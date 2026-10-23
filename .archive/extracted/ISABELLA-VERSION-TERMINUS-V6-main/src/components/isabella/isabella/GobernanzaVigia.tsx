import { useState } from "react";
import { ShieldCheck, Sliders } from "lucide-react";
import { toast } from "sonner";

interface GovModule {
  id: string;
  name: string;
  role: string;
  status: "ACTIVE" | "AUDITING" | "STANDBY";
  complianceScore: number | null;
  mode: "STRICT_ENFORCE" | "MONITOR_ONLY";
  description: string;
  metricLabel: string;
  metricValue: string;
}

export function GobernanzaVigia() {
  const [modules, setModules] = useState<GovModule[]>([
    {
      id: "atlas",
      name: "ATLAS Node",
      role: "Simulador de impacto territorial y ético social",
      status: "STANDBY",
      complianceScore: null,
      mode: "STRICT_ENFORCE",
      description:
        "Modula la entrega de información para que se alinee rigurosamente con el bienestar comunitario y el canon histórico.",
      metricLabel: "Índice de Alineación Ética",
      metricValue: "No verificado",
    },
    {
      id: "anubis",
      name: "ANUBIS Node",
      role: "Guardián de integridad criptográfica de artefactos",
      status: "STANDBY",
      complianceScore: null,
      mode: "STRICT_ENFORCE",
      description:
        "Verifica y firma digitalmente la procedencia e inmutabilidad de archivos, reportes y hashes contables del sistema.",
      metricLabel: "Integridad de Archivos",
      metricValue: "No verificado",
    },
    {
      id: "themis",
      name: "THEMIS Node",
      role: "Motor de auditabilidad algorítmica e historial",
      status: "STANDBY",
      complianceScore: null,
      mode: "MONITOR_ONLY",
      description:
        "Genera expedientes estructurados explicables de cada decisión y los enlaza al ledger de BookPI para auditorías externas.",
      metricLabel: "Expedientes Firmados",
      metricValue: "No disponible",
    },
    {
      id: "vigia",
      name: "VIGIA Sentinel",
      role: "Firewall y Gate de políticas en vivo",
      status: "STANDBY",
      complianceScore: null,
      mode: "STRICT_ENFORCE",
      description:
        "Evalúa vectores de entrada contra restricciones constitucionales, rechazando solicitudes hostiles o inyecciones.",
      metricLabel: "Veto de Restricción",
      metricValue: "No disponible",
    },
  ]);

  const handleToggleMode = (id: string) => {
    setModules((prev) =>
      prev.map((mod) => {
        if (mod.id === id) {
          const nextMode = mod.mode === "STRICT_ENFORCE" ? "MONITOR_ONLY" : "STRICT_ENFORCE";
          toast.success(`${mod.name} reconfigurado a modo: ${nextMode}`);
          return {
            ...mod,
            mode: nextMode,
            complianceScore: mod.complianceScore,
          };
        }
        return mod;
      }),
    );
  };

  return (
    <div
      className="p-5 rounded-2xl bg-[#13151f] border border-border/10 space-y-4 text-muted-foreground text-xs"
      id="gobernanza-vigia-panel"
    >
      <div className="flex items-center gap-2 pb-2 border-b border-border/5">
        <ShieldCheck className="size-4 text-crown" />
        <h3 className="text-sm font-bold font-mono text-white uppercase tracking-wider">
          Módulos de Gobernanza Ética e Integridad (VIGIA Panel)
        </h3>
      </div>

      <p className="text-[11px] leading-relaxed">
        Verifique el estado operativo de los cuatro nodos cognitivos de gobernanza soberana. Cada
        nodo opera de forma paralela en el pipeline C.R.O.W.N. para auditar, firmar, simular o
        bloquear flujos de trabajo según políticas territoriales.
      </p>

      {/* COMPLIANCE LIST */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {modules.map((mod) => (
          <div
            key={mod.id}
            className="p-4 rounded-xl bg-black/25 border border-border/5 space-y-3 relative overflow-hidden flex flex-col justify-between"
          >
            {/* Top Indicator */}
            <div className="flex justify-between items-start">
              <div className="space-y-1">
                <div className="flex items-center gap-1.5">
                  <span className="size-2 rounded-full bg-emerald-400 animate-ping shrink-0" />
                  <h4 className="text-xs font-bold text-white font-mono">{mod.name}</h4>
                </div>
                <p className="text-[9.5px] text-muted-foreground font-mono leading-tight max-w-[85%]">
                  {mod.role}
                </p>
              </div>
              <span className="text-[9px] font-mono font-bold bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full capitalize">
                {mod.status}
              </span>
            </div>

            {/* Description */}
            <p className="text-[10.5px] leading-relaxed text-muted-foreground">{mod.description}</p>

            {/* Metrics & Mode Controllers */}
            <div className="pt-2 border-t border-border/5 flex items-center justify-between text-[10px] font-mono gap-2">
              <div className="space-y-0.5">
                <span className="text-muted-foreground text-[9px] block uppercase">
                  {mod.metricLabel}:
                </span>
                <strong className="text-white font-semibold block">{mod.metricValue}</strong>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleToggleMode(mod.id)}
                  className={`px-2 py-1 rounded-lg border font-bold text-[8.5px] uppercase flex items-center gap-1 transition-all ${
                    mod.mode === "STRICT_ENFORCE"
                      ? "bg-crown/10 border-crown text-crown"
                      : "bg-black/40 border-border/10 text-muted-foreground"
                  }`}
                >
                  <Sliders className="size-3" />{" "}
                  {mod.mode === "STRICT_ENFORCE" ? "Estricto" : "Monitor"}
                </button>
                <div className="text-right">
                  <span className="text-muted-foreground text-[8.5px] block">PUNTAJE:</span>
                  <strong className="text-emerald-400 font-bold">
                    {mod.complianceScore === null
                      ? "NO VERIFICADO"
                      : `${mod.complianceScore.toFixed(1)}%`}
                  </strong>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
