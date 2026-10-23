"use client";

import { useEffect, useState } from "react";

type Health = {
  service?: string;
  status?: string;
  productionReady?: boolean;
  checks?: Record<string, boolean>;
  missing?: string[];
  timestamp?: string;
};

const modules = [
  ["Cognitive Core", "Gobernanza determinista y separación de autoridad"],
  ["Evidence Ledger", "Eventos con hashes SHA-256 y procedencia visible"],
  ["Memory Mesh", "Persistencia por tenant y propietario"],
  ["Research Integrity", "Claims y fuentes marcados como no verificados hasta su validación"],
  ["Music Genesis", "Plan de composición; no generación de audio"],
];

export default function OmegaControlPlane() {
  const [health, setHealth] = useState<Health | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    fetch("/api/omega/health", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("No se pudo consultar el estado de Ω.");
        return response.json() as Promise<Health>;
      })
      .then((value) => { if (active) setHealth(value); })
      .catch((reason: unknown) => { if (active) setError(reason instanceof Error ? reason.message : "Error de estado"); });
    return () => { active = false; };
  }, []);

  return (
    <main className="min-h-screen bg-[#080a10] px-5 py-10 text-slate-100 md:px-10">
      <div className="mx-auto max-w-6xl">
        <header className="mb-10 flex flex-wrap items-end justify-between gap-4 border-b border-white/10 pb-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-sky-300">Isabella Villaseñor AI</p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight md:text-5xl">Ω Genesis Control Plane</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400">Panel operativo de módulos, integridad y estado de configuración. El estado reportado no equivale a certificación de producción.</p>
          </div>
          <a href="/" className="rounded-xl border border-white/15 px-4 py-2 text-sm text-slate-200 transition hover:border-sky-300/60">Volver al chat</a>
        </header>

        <section className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <article className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
            <p className="text-xs uppercase tracking-wider text-slate-500">Servicio</p>
            <p className="mt-2 text-xl font-medium">{health?.service ?? "isabella-omega"}</p>
          </article>
          <article className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
            <p className="text-xs uppercase tracking-wider text-slate-500">Configuración</p>
            <p className="mt-2 text-xl font-medium">{health?.status ?? (error ? "desconocido" : "consultando…")}</p>
          </article>
          <article className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
            <p className="text-xs uppercase tracking-wider text-slate-500">Preparación productiva</p>
            <p className="mt-2 text-xl font-medium">{health?.productionReady === true ? "Verificada" : "No certificada"}</p>
          </article>
          <article className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
            <p className="text-xs uppercase tracking-wider text-slate-500">Configuraciones faltantes</p>
            <p className="mt-2 text-xl font-medium">{health ? (health.missing?.length ?? 0) : "—"}</p>
          </article>
        </section>

        {error && <p role="alert" className="mb-5 rounded-xl border border-rose-400/30 bg-rose-400/5 p-4 text-sm text-rose-200">{error}</p>}

        <section className="grid gap-4 md:grid-cols-2">
          {modules.map(([name, description], index) => (
            <article key={name} className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.045] to-transparent p-6">
              <div className="flex items-start gap-4">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-sky-300/25 bg-sky-300/10 text-sm text-sky-200">{String(index + 1).padStart(2, "0")}</span>
                <div>
                  <h2 className="text-lg font-medium">{name}</h2>
                  <p className="mt-2 text-sm leading-6 text-slate-400">{description}</p>
                </div>
              </div>
            </article>
          ))}
        </section>

        <section className="mt-8 rounded-2xl border border-white/10 bg-white/[0.025] p-6">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-300">Invariantes del sistema</h2>
          <div className="mt-4 grid gap-3 text-sm text-slate-400 sm:grid-cols-2 lg:grid-cols-3">
            <p className="rounded-lg bg-black/20 p-3">Capacidad ≠ Autoridad</p>
            <p className="rounded-lg bg-black/20 p-3">Autoridad ≠ Ejecución</p>
            <p className="rounded-lg bg-black/20 p-3">Ejecución ≠ Evidencia</p>
            <p className="rounded-lg bg-black/20 p-3">Evidencia ≠ Aprendizaje</p>
            <p className="rounded-lg bg-black/20 p-3">Aprendizaje ≠ Producción</p>
          </div>
          {health?.checks && <div className="mt-6 border-t border-white/10 pt-5">
            <h3 className="mb-3 text-sm font-medium">Configuración de dependencias</h3>
            <ul className="grid gap-2 text-sm sm:grid-cols-2">
              {Object.entries(health.checks).map(([name, configured]) => (
                <li key={name} className="flex items-center justify-between gap-4 rounded-lg bg-black/20 px-3 py-2">
                  <span className="text-slate-400">{name}</span>
                  <span className={configured ? "text-emerald-300" : "text-amber-300"}>{configured ? "Configurado" : "Pendiente"}</span>
                </li>
              ))}
            </ul>
          </div>}
          <p className="mt-5 text-xs leading-5 text-slate-500">Última comprobación: {health?.timestamp ? new Date(health.timestamp).toLocaleString() : "sin datos"}. No se muestran ni se devuelven secretos.</p>
        </section>
      </div>
    </main>
  );
}
