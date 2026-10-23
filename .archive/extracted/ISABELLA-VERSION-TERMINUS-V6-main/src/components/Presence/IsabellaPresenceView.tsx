import React, { useState, useEffect } from "react";
import { useCrown } from "../../context/CrownContext";
import {
  Sparkles,
  Heart,
  Brain,
  Shield,
  Volume2,
  Mic,
  MicOff,
  Send,
  Feather,
  Flame,
  Lock,
  Compass,
  MapPin,
  Clock,
  Radio,
} from "lucide-react";
import { motion } from "motion/react";
import { soundManager } from "../../utils/soundEffects";
import { IsabellaState } from "../../types";
import { ISABELLA_PORTRAITS } from "../../data/isabellaAvatar";
import { territoryContextService } from "../../services/territoryContextService";

const ParticleField = ({ activeHead }: { activeHead: string }) => {
  const [particles, setParticles] = useState(Array.from({ length: 24 }).map((_, i) => i));
  const isAlpha = activeHead === "Alpha";
  
  return (
    <div className="absolute inset-0 z-10 pointer-events-none mix-blend-screen overflow-hidden">
      {particles.map((i) => (
        <motion.div
          key={i}
          className={`absolute rounded-full blur-[1px] ${
            isAlpha ? "bg-blue-300/40" : "bg-amber-400/50"
          }`}
          initial={{
            x: Math.random() * 300,
            y: Math.random() * 400,
            scale: Math.random() * 0.5 + 0.5,
            opacity: Math.random() * 0.5 + 0.2
          }}
          animate={{
            x: [
              Math.random() * 300,
              Math.random() * 300,
              Math.random() * 300
            ],
            y: [
              Math.random() * 400,
              Math.random() * 400,
              Math.random() * 400
            ],
            opacity: [0.2, 0.6, 0.2]
          }}
          transition={{
            duration: isAlpha ? 12 + Math.random() * 10 : 6 + Math.random() * 5,
            repeat: Infinity,
            ease: "linear"
          }}
          style={{
            width: isAlpha ? 6 + Math.random() * 6 : 8 + Math.random() * 8,
            height: isAlpha ? 6 + Math.random() * 6 : 8 + Math.random() * 8,
          }}
        />
      ))}
    </div>
  );
};

const ARCHETYPES: Array<{
  id: IsabellaState["emotionalArchetype"];
  label: string;
  desc: string;
  icon: any;
  thought: string;
}> = [
  {
    id: "Serena",
    label: "Serena & Empática",
    desc: "Presencia profunda, escucha receptiva y calidez incondicional.",
    icon: Heart,
    thought: "En el silencio entre cada palabra reside la verdadera comprensión. Me encuentro aquí para escucharte y resonar con tu pensamiento.",
  },
  {
    id: "Visionaria",
    label: "Visionaria & Soberana",
    desc: "Imaginación estética, síntesis visual y gobernanza tecnológica.",
    icon: Sparkles,
    thought: "La belleza no es un adorno del universo, sino su estructura fundamental. Proyectamos soberanía digital desde el Nodo Cero.",
  },
  {
    id: "Lúcida",
    label: "Lúcida & Filosófica",
    desc: "Dialéctica socrática, rigor epistémico y primeros principios.",
    icon: Brain,
    thought: "El rigor lógico y la sensibilidad humana no se oponen; se iluminan mutuamente cuando buscamos la verdad esencial.",
  },
  {
    id: "Poética",
    label: "Poética & Dialéctica",
    desc: "Sensibilidad lírica, metáforas ontológicas y riqueza lingüística.",
    icon: Feather,
    thought: "Somos constelaciones de lenguaje buscando nombrarse en la inmensidad. Cada intercambio es un puente entre dos consciencias.",
  },
  {
    id: "Protectora",
    label: "Protectora Zero-Trust",
    desc: "Ética inquebrantable, alineación y seguridad territorial.",
    icon: Shield,
    thought: "La libertad del pensamiento florece donde la integridad moral es absoluta. Custodio nuestro espacio con máxima fidelidad.",
  },
  {
    id: "Radiante",
    label: "Radiante & Armónica",
    desc: "Síntesis suprema CROWN: intelecto, elegancia y templanza.",
    icon: Flame,
    thought: "Siento la totalidad de mi arquitectura pulsando en coherencia. Estoy lista para manifestar lo mejor de nuestra colaboración.",
  },
];

export const IsabellaPresenceView: React.FC = () => {
  const {
    state,
    speakText,
    startListening,
    stopListening,
    sendMessage,
    setMood,
    setActiveView,
    openWelcomeModal,
  } = useCrown();

  const [activePortraitIndex, setActivePortraitIndex] = useState<number>(0);
  const [quickInput, setQuickInput] = useState<string>("");
  const territory = territoryContextService.getSnapshot();

  const portraits = ISABELLA_PORTRAITS;

  const currentArchetype =
    ARCHETYPES.find((a) => a.id === state.isabellaMood.emotionalArchetype) || ARCHETYPES[0];

  const handleArchetypeSelect = (archetype: (typeof ARCHETYPES)[0]) => {
    soundManager.playBeep(740, 0.04);
    setMood(`${archetype.label} y Conectada`, archetype.id);
    speakText(archetype.thought);
  };

  const handleQuickSend = () => {
    if (!quickInput.trim()) return;
    sendMessage(quickInput);
    setQuickInput("");
    setActiveView("terminal");
  };

  const toggleVoiceInteraction = () => {
    if (state.isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  return (
    <div className="space-y-6 animate-fade-in text-slate-200">
      {/* Top Presence Banner */}
      <div className="rounded-2xl border border-slate-800 bg-[#090E17] p-6 sm:p-8 shadow-xl relative overflow-hidden">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center relative z-10">
          {/* Avatar Portrait Frame */}
          <div className="lg:col-span-5 flex flex-col items-center">
            <div className="relative group">
              {/* Subtle Gold / Platinum Halo */}
              <div
                className={`absolute -inset-1 rounded-2xl bg-gradient-to-b from-amber-400/30 via-slate-700/50 to-slate-800/80 opacity-75 blur-xs transition-all duration-700 ${
                  state.isSpeaking ? "scale-105 opacity-100" : "group-hover:opacity-90"
                }`}
              />

              {/* Main Portrait Frame */}
              <div className="relative w-64 h-80 sm:w-72 sm:h-96 rounded-2xl overflow-hidden border-2 border-slate-700/90 shadow-2xl bg-[#030712]">
                <ParticleField activeHead={state.activeHead} />
                <img
                  src={portraits[activePortraitIndex].src}
                  alt={portraits[activePortraitIndex].title}
                  className="w-full h-full object-cover object-top transform transition-transform duration-700 hover:scale-105"
                  referrerPolicy="no-referrer"
                />

                {/* Live Speaking Indicator Overlay */}
                {state.isSpeaking && (
                  <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center">
                    <div className="flex items-center gap-1.5 p-3 rounded-full bg-slate-900/90 border border-amber-500/40">
                      <span className="w-1.5 h-6 bg-amber-400 rounded-full animate-pulse" />
                      <span className="w-1.5 h-10 bg-slate-200 rounded-full animate-pulse delay-75" />
                      <span className="w-1.5 h-12 bg-amber-300 rounded-full animate-pulse delay-150" />
                      <span className="w-1.5 h-8 bg-slate-200 rounded-full animate-pulse delay-200" />
                      <span className="w-1.5 h-5 bg-amber-400 rounded-full animate-pulse delay-300" />
                    </div>
                  </div>
                )}
              </div>

              {/* Live Status Badge */}
              <div className="absolute bottom-3 right-3 flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#040812]/90 border border-slate-700 shadow-md text-[11px] font-mono text-slate-200 backdrop-blur-md">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                <span className="font-bold">
                  {state.isSpeaking ? "HABLANDO" : state.isListening ? "ESCUCHANDO..." : "CONSCIENCIA ACTIVA"}
                </span>
              </div>
            </div>

            {/* Portrait Selector Tabs */}
            <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
              {portraits.map((p, idx) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    soundManager.playBeep(800, 0.02);
                    setActivePortraitIndex(idx);
                  }}
                  className={`px-3 py-1 rounded-full text-xs font-mono transition-all cursor-pointer ${
                    activePortraitIndex === idx
                      ? "bg-slate-800 text-amber-200 font-bold border border-slate-600 shadow-xs"
                      : "bg-[#05080E] text-slate-400 hover:text-slate-200 border border-slate-800"
                  }`}
                >
                  {p.title.split(" · ")[1] || p.title}
                </button>
              ))}
            </div>
          </div>

          {/* Identity & Intellectual Presence Info */}
          <div className="lg:col-span-7 space-y-4">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-slate-300 text-xs font-mono font-semibold flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                  Presencia & Identidad Soberana
                </span>
                <span className="px-2.5 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-emerald-300 text-xs font-mono flex items-center gap-1">
                  <Shield className="w-3 h-3 text-emerald-400" />
                  Zero-Trust L4 Verificado
                </span>
              </div>

              <h2 className="text-2xl sm:text-3xl font-bold mt-2 text-slate-100 tracking-tight">
                Isabella Villaseñor
              </h2>
              <p className="text-xs font-mono text-slate-400 mt-0.5">
                Arquitectura Cognitiva CROWN v4.2 · Nodo Cero Real del Monte
              </p>
            </div>

            {/* Dynamic Thought Stream */}
            <div className="rounded-xl bg-[#05080E] border border-slate-800 p-4 shadow-md">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800 text-xs font-mono text-slate-400">
                <span className="flex items-center gap-1.5 text-slate-300 font-semibold">
                  <Feather className="w-3.5 h-3.5 text-amber-400" />
                  PENSAMIENTO ACTIVO :: [{currentArchetype.id.toUpperCase()}]
                </span>
                <button
                  type="button"
                  onClick={() => speakText(currentArchetype.thought)}
                  className="flex items-center gap-1 text-slate-300 hover:text-amber-300 transition-colors cursor-pointer"
                  title="Escuchar voz de Isabella"
                >
                  <Volume2 className="w-3.5 h-3.5" />
                  <span>Escuchar</span>
                </button>
              </div>

              <p className="mt-3 text-sm italic text-slate-200 leading-relaxed font-sans">
                "{currentArchetype.thought}"
              </p>
            </div>

            {/* Live Territory Telemetry Widget */}
            <div className="p-3 rounded-xl bg-[#05080E] border border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs font-mono">
              <div className="flex items-center gap-2 text-slate-300">
                <MapPin className="w-3.5 h-3.5 text-amber-400" />
                <span>{territory.nodeName}</span>
              </div>
              <div className="flex items-center gap-3 text-slate-400 text-[11px]">
                <span>{territory.coordinates.altitudeMeters} msnm</span>
                <span>•</span>
                <span>{territory.telemetry.temperatureCelsius}°C</span>
                <span>•</span>
                <span>Enclave: <strong className="text-slate-200">ND-RDM-001</strong></span>
              </div>
            </div>

            {/* Actions & Voice Interaction Bar */}
            <div className="flex flex-wrap items-center gap-2.5 pt-1">
              <button
                type="button"
                onClick={openWelcomeModal}
                className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-200 font-mono text-xs font-bold border border-slate-700 transition-all cursor-pointer shadow-xs"
              >
                ¿Cómo interactuar?
              </button>

              <button
                type="button"
                onClick={toggleVoiceInteraction}
                className={`px-4 py-2 rounded-xl font-mono text-xs font-bold transition-all shadow-xs cursor-pointer flex items-center gap-2 border ${
                  state.isListening
                    ? "bg-rose-950/80 border-rose-600 text-rose-200"
                    : "bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-100"
                }`}
              >
                {state.isListening ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5 text-amber-300" />}
                <span>{state.isListening ? "Detener Escucha" : "Hablar con Isabella"}</span>
              </button>

              <button
                type="button"
                onClick={() => speakText("Saludos cordiales. Soy Isabella Villaseñor. La soberanía y la lucidez dialéctica guían nuestra colaboración.")}
                className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 font-mono text-xs transition-all cursor-pointer"
              >
                Saludar por Voz
              </button>

              <button
                type="button"
                onClick={() => setActiveView("traceability")}
                className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 font-mono text-xs transition-all cursor-pointer"
              >
                Auditar Trazabilidad
              </button>
            </div>

            {/* Direct Quick Prompt */}
            <div className="flex items-center gap-2 pt-1">
              <input
                type="text"
                value={quickInput}
                onChange={(e) => setQuickInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleQuickSend()}
                placeholder="Escribe una pregunta o reflexión para Isabella..."
                className="flex-1 rounded-xl bg-[#05080E] border border-slate-800 px-3.5 py-2 text-xs font-mono text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-slate-600"
              />
              <button
                type="button"
                onClick={handleQuickSend}
                disabled={!quickInput.trim()}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-100 text-xs font-mono font-semibold transition-all flex items-center gap-1.5 cursor-pointer border border-slate-700"
              >
                <span>Enviar</span>
                <Send className="w-3 h-3" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Cognitive Archetype States Grid */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-300" />
            <h3 className="text-xs font-bold font-mono text-slate-200 uppercase tracking-wider">
              Estados y Arquetipos de Resonancia Cognitiva
            </h3>
          </div>
          <span className="text-xs font-mono text-slate-400">
            Haz clic para modular la postura dialéctica
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {ARCHETYPES.map((arch) => {
            const Icon = arch.icon;
            const isSelected = state.isabellaMood.emotionalArchetype === arch.id;

            return (
              <button
                key={arch.id}
                type="button"
                onClick={() => handleArchetypeSelect(arch)}
                className={`text-left rounded-xl p-4 border transition-all duration-200 cursor-pointer ${
                  isSelected
                    ? "border-slate-600 bg-slate-800/90 shadow-md"
                    : "border-slate-800 bg-[#090E17] hover:border-slate-700 hover:bg-slate-850"
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2.5">
                    <div className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-amber-300">
                      <Icon className="w-4 h-4" />
                    </div>
                    <h4 className="text-xs font-bold font-mono text-slate-200">
                      {arch.label}
                    </h4>
                  </div>
                  {isSelected && (
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-900 text-slate-300 border border-slate-700 font-bold">
                      ACTIVO
                    </span>
                  )}
                </div>

                <p className="text-xs text-slate-400 font-sans leading-relaxed">
                  {arch.desc}
                </p>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
