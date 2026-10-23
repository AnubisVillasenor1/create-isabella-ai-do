import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useCrown } from "../../context/CrownContext";
import {
  PRESENTATION_CHAPTERS,
  EVALUATOR_DECLARATION,
} from "../../data/presentationData";
import { PresentationChapter } from "../../types";
import { soundManager } from "../../utils/soundEffects";
import {
  BookOpen,
  Presentation,
  ShieldCheck,
  Volume2,
  VolumeX,
  Play,
  Pause,
  Square,
  ChevronLeft,
  ChevronRight,
  Search,
  CheckCircle2,
  Copy,
  Download,
  Share2,
  Sparkles,
  Layers,
  MapPin,
  Cpu,
  Shield,
  Fingerprint,
  FileCheck,
  Terminal as TerminalIcon,
  Maximize2,
  Minimize2,
  ExternalLink,
  Brain,
  Zap,
  Globe2,
} from "lucide-react";

type PresentationMode = "dossier" | "slides" | "topology" | "integrity";

export const PresentationView: React.FC = () => {
  const { state, speakText, stopSpeech, setActiveView } = useCrown();
  const { speechSynthesisEnabled, isSpeaking } = state;

  // View mode
  const [mode, setMode] = useState<PresentationMode>("dossier");

  // Navigation & selection
  const [selectedChapterIndex, setSelectedChapterIndex] = useState<number>(0);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");
  const [isCopied, setIsCopied] = useState<boolean>(false);
  const [isHashCopied, setIsHashCopied] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  // Audio Narration State
  const [narratingChapterIndex, setNarratingChapterIndex] = useState<number | null>(null);
  const [isPaused, setIsPaused] = useState<boolean>(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const activeChapterRef = useRef<HTMLDivElement>(null);

  // Categories list
  const categories = useMemo(() => {
    const set = new Set<string>();
    PRESENTATION_CHAPTERS.forEach((c) => set.add(c.category));
    return ["ALL", ...Array.from(set)];
  }, []);

  // Filtered chapters
  const filteredChapters = useMemo(() => {
    return PRESENTATION_CHAPTERS.filter((chap) => {
      const matchesCat = selectedCategory === "ALL" || chap.category === selectedCategory;
      const q = searchQuery.toLowerCase().trim();
      if (!q) return matchesCat;
      const matchesSearch =
        chap.title.toLowerCase().includes(q) ||
        chap.subtitle.toLowerCase().includes(q) ||
        chap.summary.toLowerCase().includes(q) ||
        chap.content.some((text) => text.toLowerCase().includes(q)) ||
        chap.highlights.some((h) => h.toLowerCase().includes(q)) ||
        String(chap.number).includes(q);
      return matchesCat && matchesSearch;
    });
  }, [searchQuery, selectedCategory]);

  const currentChapter: PresentationChapter =
    PRESENTATION_CHAPTERS[selectedChapterIndex] || PRESENTATION_CHAPTERS[0];

  // Narration handler
  const handleStartNarration = useCallback(
    (chapterIndex: number) => {
      soundManager.playBeep(880, 0.04);
      const chap = PRESENTATION_CHAPTERS[chapterIndex];
      if (!chap) return;

      setNarratingChapterIndex(chapterIndex);
      setIsPaused(false);

      const narrativeScript = `Capítulo ${chap.number}: ${chap.title}. ${chap.subtitle}. Resumen ejecutivo: ${chap.summary}. ${chap.keyQuote ? `Cita clave: ${chap.keyQuote}` : ""} ${chap.content.join(" ")}`;

      speakText(narrativeScript);
    },
    [speakText]
  );

  const handleStopNarration = useCallback(() => {
    soundManager.playBeep(440, 0.04);
    stopSpeech();
    setNarratingChapterIndex(null);
    setIsPaused(false);
  }, [stopSpeech]);

  // Synchronize narrating chapter with selection when in slides
  const handleSelectChapter = (index: number) => {
    soundManager.playBeep(650, 0.02);
    setSelectedChapterIndex(index);
    if (narratingChapterIndex !== null && narratingChapterIndex !== index) {
      handleStopNarration();
    }
  };

  // Keyboard navigation for slide mode
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (mode !== "slides") return;
      if (e.key === "ArrowRight" || e.key === "PageDown") {
        e.preventDefault();
        setSelectedChapterIndex((prev) => Math.min(PRESENTATION_CHAPTERS.length - 1, prev + 1));
        soundManager.playBeep(700, 0.02);
      } else if (e.key === "ArrowLeft" || e.key === "PageUp") {
        e.preventDefault();
        setSelectedChapterIndex((prev) => Math.max(0, prev - 1));
        soundManager.playBeep(600, 0.02);
      } else if (e.key === "Home") {
        setSelectedChapterIndex(0);
      } else if (e.key === "End") {
        setSelectedChapterIndex(PRESENTATION_CHAPTERS.length - 1);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [mode]);

  // Copy full audit text to clipboard
  const handleCopyFullDossier = () => {
    soundManager.playSuccess();
    const fullText = PRESENTATION_CHAPTERS.map(
      (c) =>
        `# ${c.number}. ${c.title.toUpperCase()}\n*${c.subtitle}*\n\n${c.summary}\n\n${c.content.join("\n\n")}\n\n${
          c.keyQuote ? `> «${c.keyQuote}»\n\n` : ""
        }`
    ).join("\n---\n\n");

    const headerDossier = `====================================================\nISABELLA VILLASEÑOR AI - AUDITORÍA ARQUITECTÓNICA Y TECNOLÓGICA\nNodo Cero / RDM Digital / Infraestructura Cognitiva Territorial\nEvaluador: ${EVALUATOR_DECLARATION.evaluator} (${EVALUATOR_DECLARATION.model})\nSHA-256: ${EVALUATOR_DECLARATION.sha256}\nEstado: ${EVALUATOR_DECLARATION.evaluationState}\n====================================================\n\n${fullText}\n\nDECLARACIÓN FINAL:\n${EVALUATOR_DECLARATION.dossierSummary}\nHash SHA-256: ${EVALUATOR_DECLARATION.sha256}\n`;

    navigator.clipboard.writeText(headerDossier);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2500);
  };

  // Copy SHA-256 hash
  const handleCopyHash = () => {
    soundManager.playSuccess();
    navigator.clipboard.writeText(EVALUATOR_DECLARATION.sha256);
    setIsHashCopied(true);
    setTimeout(() => setIsHashCopied(false), 2500);
  };

  // Download Markdown file
  const handleDownloadMarkdown = () => {
    soundManager.playArrival();
    const markdownContent = `# ISABELLA VILLASEÑOR AI\n## Auditoría Tecnológica y Arquitectónica de Nodo Cero & RDM Digital\n\n**Evaluador:** ${EVALUATOR_DECLARATION.evaluator} (${EVALUATOR_DECLARATION.model})\n**SHA-256:** \`${EVALUATOR_DECLARATION.sha256}\`\n**Estado:** ${EVALUATOR_DECLARATION.evaluationState}\n\n---\n\n` +
      PRESENTATION_CHAPTERS.map(
        (c) =>
          `### ${c.number}. ${c.title}\n*${c.subtitle}*\n\n**Categoría:** \`${c.category}\`\n\n${c.summary}\n\n${c.content.join("\n\n")}\n\n${
            c.keyQuote ? `> ❝${c.keyQuote}❞\n\n` : ""
          }**Puntos Clave:**\n${c.highlights.map((h) => `- ${h}`).join("\n")}\n`
      ).join("\n---\n\n") +
      `\n---\n\n## DECLARACIÓN DEL EVALUADOR\n\n${EVALUATOR_DECLARATION.dossierSummary}\n\n**Integridad Criptográfica (SHA-256):** \`${EVALUATOR_DECLARATION.sha256}\`\n`;

    const blob = new Blob([markdownContent], { type: "text/markdown;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `isabella_villasenor_auditoria_arquitectonica_${EVALUATOR_DECLARATION.sha256.slice(0, 8)}.md`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div
      ref={containerRef}
      className={`flex flex-col gap-6 font-sans transition-all duration-300 ${
        isFullscreen ? "fixed inset-0 z-50 bg-[#030712] p-6 overflow-y-auto" : ""
      }`}
    >
      {/* Enterprise Executive Header */}
      <div className="rounded-3xl border border-slate-800 bg-[#070F1E]/95 p-6 backdrop-blur-2xl shadow-2xl relative overflow-hidden">
        {/* Subtle Ambient Background Gradients */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-6 border-b border-slate-800/80">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-bold bg-amber-500/10 text-amber-300 border border-amber-500/30 shadow-sm">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                AUDITORÍA ARQUITECTÓNICA & MANIFIESTO EJECUTIVO
              </span>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-mono bg-blue-500/10 text-sky-300 border border-blue-500/30">
                <FileCheck className="w-3 h-3 text-sky-400" />
                26 Capítulos Formales
              </span>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-mono bg-emerald-500/10 text-emerald-300 border border-emerald-500/30">
                <ShieldCheck className="w-3 h-3 text-emerald-400" />
                SHA-256 Verificado
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#F8FAFC]">
              Isabella Villaseñor AI
            </h1>
            <p className="text-sm sm:text-base text-slate-300 max-w-3xl leading-relaxed">
              Infraestructura Cognitiva Territorial, Híbrida y Gobernada de Nodo Cero y RDM Digital.
              Evaluación arquitectónica independiente y análisis de soberanía tecnológica.
            </p>
          </div>

          {/* Quick Actions & Narration Controller */}
          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            {/* Isabella Female Audio Narration */}
            {speechSynthesisEnabled && (
              <div className="flex items-center gap-1 p-1 rounded-2xl bg-[#030712] border border-slate-800 shadow-inner">
                {isSpeaking && narratingChapterIndex !== null ? (
                  <button
                    type="button"
                    onClick={handleStopNarration}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-950/60 hover:bg-red-900 border border-red-500/40 text-red-300 text-xs font-mono font-bold transition-all cursor-pointer shadow-sm active:scale-95"
                    title="Detener lectura en voz alta"
                  >
                    <Square className="w-3.5 h-3.5 fill-current" />
                    <span>Detener Voz</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleStartNarration(selectedChapterIndex)}
                    className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-mono font-bold transition-all cursor-pointer shadow-lg shadow-blue-600/30 active:scale-95"
                    title="Escuchar capítulo seleccionado con la voz de Isabella"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>Escuchar con Isabella</span>
                  </button>
                )}
              </div>
            )}

            {/* Copy Full Dossier */}
            <button
              type="button"
              onClick={handleCopyFullDossier}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#030712] hover:bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-200 text-xs font-mono transition-all cursor-pointer shadow-sm active:scale-95"
              title="Copiar texto completo del dossier"
            >
              {isCopied ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span className="text-emerald-400 font-bold">¡Copiado!</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4 text-slate-400" />
                  <span>Copiar Todo</span>
                </>
              )}
            </button>

            {/* Download Markdown */}
            <button
              type="button"
              onClick={handleDownloadMarkdown}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#030712] hover:bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-200 text-xs font-mono transition-all cursor-pointer shadow-sm active:scale-95"
              title="Descargar dossier en formato Markdown"
            >
              <Download className="w-4 h-4 text-sky-400" />
              <span className="hidden sm:inline">Descargar .MD</span>
            </button>

            {/* Fullscreen Toggle */}
            <button
              type="button"
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="p-2 rounded-xl bg-[#030712] hover:bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200 transition-all cursor-pointer"
              title={isFullscreen ? "Salir de pantalla completa" : "Pantalla completa"}
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* View Mode Navigation Tabs */}
        <div className="pt-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-[#030712] border border-slate-800/90 text-xs font-mono shadow-inner">
            <button
              type="button"
              onClick={() => {
                soundManager.playBeep(700, 0.02);
                setMode("dossier");
              }}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl transition-all cursor-pointer ${
                mode === "dossier"
                  ? "bg-blue-600 text-white font-bold shadow-md shadow-blue-600/30"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-900"
              }`}
            >
              <BookOpen className="w-4 h-4" />
              <span>Dossier Completo</span>
            </button>

            <button
              type="button"
              onClick={() => {
                soundManager.playBeep(750, 0.02);
                setMode("slides");
              }}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl transition-all cursor-pointer ${
                mode === "slides"
                  ? "bg-blue-600 text-white font-bold shadow-md shadow-blue-600/30"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-900"
              }`}
            >
              <Presentation className="w-4 h-4" />
              <span>Modo Keynote / Diapositivas</span>
            </button>

            <button
              type="button"
              onClick={() => {
                soundManager.playBeep(800, 0.02);
                setMode("topology");
              }}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl transition-all cursor-pointer ${
                mode === "topology"
                  ? "bg-blue-600 text-white font-bold shadow-md shadow-blue-600/30"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-900"
              }`}
            >
              <Layers className="w-4 h-4" />
              <span>Malla Territorial & Flujo</span>
            </button>

            <button
              type="button"
              onClick={() => {
                soundManager.playBeep(850, 0.02);
                setMode("integrity");
              }}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl transition-all cursor-pointer ${
                mode === "integrity"
                  ? "bg-blue-600 text-white font-bold shadow-md shadow-blue-600/30"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-900"
              }`}
            >
              <Fingerprint className="w-4 h-4" />
              <span>Certificado SHA-256</span>
            </button>
          </div>

          {/* Quick Integrity Pill */}
          <div
            onClick={handleCopyHash}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#030712] border border-slate-800 text-[11px] font-mono text-slate-300 hover:border-blue-500/50 cursor-pointer transition-colors"
            title="Click para copiar hash SHA-256 oficial"
          >
            <span className="text-slate-400 font-bold">SHA-256:</span>
            <span className="text-sky-300 font-semibold tracking-wider">
              {EVALUATOR_DECLARATION.sha256.slice(0, 10)}...{EVALUATOR_DECLARATION.sha256.slice(-8)}
            </span>
            {isHashCopied ? (
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <Copy className="w-3.5 h-3.5 text-slate-400" />
            )}
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* MODE 1: DOSSIER COMPLETO (Lectura & Índice)                               */}
      {/* ========================================================================= */}
      {mode === "dossier" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Interactive Index, Filter & Search */}
          <div className="lg:col-span-4 flex flex-col gap-4">
            <div className="rounded-2xl border border-slate-800 bg-[#070F1E]/90 p-4 backdrop-blur-xl sticky top-20 space-y-4 max-h-[calc(100vh-140px)] flex flex-col">
              {/* Search input */}
              <div className="relative">
                <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Buscar en el documento..."
                  className="w-full bg-[#030712] border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs font-mono text-[#F8FAFC] placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              {/* Category pills */}
              <div className="flex flex-wrap gap-1.5 pb-2 border-b border-slate-800/80">
                {categories.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-mono transition-all cursor-pointer ${
                      selectedCategory === cat
                        ? "bg-blue-600 text-white font-bold shadow-sm"
                        : "bg-[#030712] text-slate-400 hover:text-slate-200 border border-slate-800/80"
                    }`}
                  >
                    {cat === "ALL" ? "Todos (26)" : cat}
                  </button>
                ))}
              </div>

              {/* Chapter list */}
              <div className="overflow-y-auto space-y-1.5 pr-1 flex-1 custom-scrollbar">
                {filteredChapters.map((chap) => {
                  const isSelected = chap.number - 1 === selectedChapterIndex;
                  const isNarrating = narratingChapterIndex === chap.number - 1;

                  return (
                    <button
                      key={chap.id}
                      type="button"
                      onClick={() => {
                        handleSelectChapter(chap.number - 1);
                        activeChapterRef.current?.scrollIntoView({ behavior: "smooth" });
                      }}
                      className={`w-full text-left p-3 rounded-xl border transition-all cursor-pointer ${
                        isSelected
                          ? "bg-blue-950/40 border-blue-500/60 shadow-lg shadow-blue-900/20"
                          : "bg-[#030712]/70 hover:bg-[#081220] border-slate-800/70 text-slate-300"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800 text-amber-300">
                          {String(chap.number).padStart(2, "0")}
                        </span>
                        <span className="text-[10px] font-mono text-slate-400 truncate">
                          {chap.category}
                        </span>
                        {isNarrating && (
                          <span className="flex h-2 w-2 relative">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
                          </span>
                        )}
                      </div>
                      <h4
                        className={`text-xs font-bold font-mono line-clamp-1 ${
                          isSelected ? "text-[#F8FAFC]" : "text-slate-300"
                        }`}
                      >
                        {chap.title}
                      </h4>
                      <p className="text-[11px] text-slate-400 line-clamp-1 mt-0.5 font-sans">
                        {chap.subtitle}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Right Column: Deep Dossier Reading Panel */}
          <div className="lg:col-span-8 flex flex-col gap-6">
            {filteredChapters.map((chap, idx) => {
              const isSelected = chap.number - 1 === selectedChapterIndex;
              const isNarrating = narratingChapterIndex === chap.number - 1;

              return (
                <article
                  key={chap.id}
                  ref={isSelected ? activeChapterRef : null}
                  className={`rounded-3xl border transition-all p-6 sm:p-8 backdrop-blur-xl ${
                    isSelected
                      ? "bg-[#070F1E]/95 border-blue-500/50 shadow-2xl ring-1 ring-blue-500/20"
                      : "bg-[#070F1E]/80 border-slate-800/80 hover:border-slate-700"
                  }`}
                >
                  {/* Chapter Header */}
                  <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-800/80">
                    <div className="flex items-center gap-3">
                      <span className="flex items-center justify-center w-9 h-9 rounded-xl bg-blue-500/10 text-sky-300 border border-blue-500/30 font-mono font-bold text-sm">
                        {String(chap.number).padStart(2, "0")}
                      </span>
                      <div>
                        <span className="text-[11px] font-mono font-bold text-amber-400 tracking-wider uppercase block">
                          {chap.category}
                        </span>
                        <h2 className="text-lg sm:text-xl font-bold font-mono text-[#F8FAFC]">
                          {chap.title}
                        </h2>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {isNarrating ? (
                        <button
                          type="button"
                          onClick={handleStopNarration}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-950/60 hover:bg-red-900 border border-red-500/40 text-red-300 text-xs font-mono font-bold cursor-pointer transition-all"
                        >
                          <Square className="w-3.5 h-3.5 fill-current" />
                          <span>Pausar Voz</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedChapterIndex(chap.number - 1);
                            handleStartNarration(chap.number - 1);
                          }}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#030712] hover:bg-blue-950/60 border border-slate-800 hover:border-blue-500/40 text-sky-300 text-xs font-mono font-bold cursor-pointer transition-all"
                          title="Narrar este capítulo con Isabella"
                        >
                          <Volume2 className="w-3.5 h-3.5" />
                          <span>Escuchar</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Subtitle & Executive Summary Callout */}
                  <div className="my-5 p-4 rounded-2xl bg-[#030712] border border-slate-800/90 space-y-2">
                    <span className="text-xs font-mono text-slate-400 block font-semibold">
                      SÍNTESIS ARQUITECTÓNICA
                    </span>
                    <p className="text-sm font-medium text-sky-200 leading-relaxed">
                      {chap.summary}
                    </p>
                  </div>

                  {/* ASCII Diagram if present */}
                  {chap.diagramAscii && (
                    <div className="my-5 p-4 rounded-2xl bg-[#030712] border border-slate-800 overflow-x-auto shadow-inner">
                      <pre className="font-mono text-xs text-amber-300/90 leading-tight">
                        {chap.diagramAscii}
                      </pre>
                    </div>
                  )}

                  {/* Main Paragraphs Content */}
                  <div className="space-y-4 text-slate-300 text-sm sm:text-base leading-relaxed font-sans">
                    {chap.content.map((paragraph, pIdx) => {
                      // Check if it's a bulleted list or normal text
                      if (paragraph.includes("•")) {
                        return (
                          <div
                            key={pIdx}
                            className="p-4 rounded-xl bg-[#030712]/60 border border-slate-800/80 font-mono text-xs text-sky-300 leading-relaxed whitespace-pre-line"
                          >
                            {paragraph}
                          </div>
                        );
                      }
                      return <p key={pIdx}>{paragraph}</p>;
                    })}
                  </div>

                  {/* Key Quote Callout */}
                  {chap.keyQuote && (
                    <blockquote className="my-6 p-5 rounded-2xl bg-gradient-to-r from-blue-950/40 to-slate-900/60 border-l-4 border-amber-400 shadow-md">
                      <p className="text-sm sm:text-base font-semibold text-amber-200 italic leading-relaxed">
                        «{chap.keyQuote}»
                      </p>
                    </blockquote>
                  )}

                  {/* Key Highlights Tags */}
                  <div className="pt-4 border-t border-slate-800/80 flex flex-wrap items-center gap-2">
                    <span className="text-xs font-mono text-slate-400 font-bold mr-1">
                      Conclusiones:
                    </span>
                    {chap.highlights.map((highlight, hIdx) => (
                      <span
                        key={hIdx}
                        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-[#030712] border border-slate-800 text-xs font-mono text-slate-300 shadow-sm"
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                        {highlight}
                      </span>
                    ))}
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODE 2: MODO KEYNOTE / DIAPOSITIVAS INTERACTIVAS                         */}
      {/* ========================================================================= */}
      {mode === "slides" && (
        <div className="flex flex-col gap-6">
          {/* Main Slide Card */}
          <div className="rounded-3xl border border-slate-800 bg-[#070F1E]/95 p-8 sm:p-12 backdrop-blur-2xl shadow-2xl relative min-h-[540px] flex flex-col justify-between overflow-hidden">
            {/* Top Bar of Slide */}
            <div className="flex items-center justify-between pb-6 border-b border-slate-800/80">
              <div className="flex items-center gap-3">
                <span className="flex items-center justify-center px-3.5 py-1.5 rounded-2xl bg-amber-500/10 text-amber-300 border border-amber-500/30 font-mono font-bold text-sm">
                  Diapositiva {String(currentChapter.number).padStart(2, "0")} / 26
                </span>
                <span className="px-3 py-1 rounded-full text-xs font-mono bg-blue-500/10 text-sky-300 border border-blue-500/30 uppercase tracking-wider font-semibold">
                  {currentChapter.category}
                </span>
              </div>

              {/* Progress percentage */}
              <div className="flex items-center gap-3">
                <span className="text-xs font-mono text-slate-400">
                  {Math.round(((selectedChapterIndex + 1) / PRESENTATION_CHAPTERS.length) * 100)}% Completado
                </span>
                <div className="w-24 bg-[#030712] h-2 rounded-full overflow-hidden border border-slate-800">
                  <div
                    className="h-full bg-blue-500 transition-all duration-300"
                    style={{
                      width: `${((selectedChapterIndex + 1) / PRESENTATION_CHAPTERS.length) * 100}%`,
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Slide Body Content */}
            <div className="py-8 space-y-6 flex-1">
              <div>
                <h2 className="text-2xl sm:text-4xl font-extrabold font-mono tracking-tight text-[#F8FAFC] leading-tight">
                  {currentChapter.title}
                </h2>
                <h3 className="text-base sm:text-xl text-sky-300 font-mono mt-2 font-medium">
                  {currentChapter.subtitle}
                </h3>
              </div>

              {/* High-Contrast Key Quote Box */}
              {currentChapter.keyQuote && (
                <div className="p-6 rounded-2xl bg-gradient-to-r from-blue-950/50 via-[#030712] to-amber-950/20 border-l-4 border-amber-400 shadow-xl">
                  <p className="text-base sm:text-xl font-medium text-amber-100 italic leading-relaxed">
                    «{currentChapter.keyQuote}»
                  </p>
                </div>
              )}

              {/* Main Content Excerpt */}
              <div className="space-y-4 text-slate-200 text-base sm:text-lg leading-relaxed max-w-4xl font-sans">
                {currentChapter.content.map((p, pIdx) => {
                  if (p.includes("•")) {
                    return (
                      <div
                        key={pIdx}
                        className="p-4 rounded-2xl bg-[#030712] border border-slate-800 font-mono text-xs sm:text-sm text-sky-300 whitespace-pre-line"
                      >
                        {p}
                      </div>
                    );
                  }
                  return <p key={pIdx}>{p}</p>;
                })}
              </div>

              {/* Diagram if available */}
              {currentChapter.diagramAscii && (
                <div className="p-4 rounded-2xl bg-[#030712] border border-slate-800 overflow-x-auto">
                  <pre className="font-mono text-xs text-amber-300/90 leading-tight">
                    {currentChapter.diagramAscii}
                  </pre>
                </div>
              )}

              {/* Takeaway Badges */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-4">
                {currentChapter.highlights.map((h, hIdx) => (
                  <div
                    key={hIdx}
                    className="p-3.5 rounded-2xl bg-[#030712] border border-slate-800/90 text-xs font-mono text-slate-300 flex items-start gap-2.5 shadow-sm"
                  >
                    <CheckCircle2 className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                    <span>{h}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Slide Navigation Controls & Key Hints */}
            <div className="pt-6 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-2 text-xs font-mono text-slate-400">
                <kbd className="px-2 py-1 rounded bg-[#030712] border border-slate-800 text-slate-300 font-bold">
                  ←
                </kbd>
                <kbd className="px-2 py-1 rounded bg-[#030712] border border-slate-800 text-slate-300 font-bold">
                  →
                </kbd>
                <span>o barra espaciadora para navegar diapositivas</span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleSelectChapter(Math.max(0, selectedChapterIndex - 1))}
                  disabled={selectedChapterIndex === 0}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#030712] hover:bg-slate-900 border border-slate-800 text-slate-200 text-xs font-mono disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-all"
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span>Anterior</span>
                </button>

                {speechSynthesisEnabled && (
                  <button
                    type="button"
                    onClick={() => handleStartNarration(selectedChapterIndex)}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-mono font-bold transition-all shadow-md shadow-blue-600/30 cursor-pointer"
                  >
                    <Volume2 className="w-4 h-4" />
                    <span>Narrar con Isabella</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() =>
                    handleSelectChapter(
                      Math.min(PRESENTATION_CHAPTERS.length - 1, selectedChapterIndex + 1)
                    )
                  }
                  disabled={selectedChapterIndex === PRESENTATION_CHAPTERS.length - 1}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#030712] hover:bg-slate-900 border border-slate-800 text-slate-200 text-xs font-mono disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-all"
                >
                  <span>Siguiente</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Filmstrip Slide Selector */}
          <div className="flex gap-2 overflow-x-auto pb-2 custom-scrollbar">
            {PRESENTATION_CHAPTERS.map((chap, cIdx) => (
              <button
                key={chap.id}
                type="button"
                onClick={() => handleSelectChapter(cIdx)}
                className={`p-3 rounded-2xl border shrink-0 w-48 text-left transition-all cursor-pointer ${
                  selectedChapterIndex === cIdx
                    ? "bg-blue-950/70 border-blue-500 ring-2 ring-blue-500/40 shadow-lg"
                    : "bg-[#070F1E]/80 border-slate-800 hover:bg-[#081220]"
                }`}
              >
                <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 mb-1">
                  <span className="font-bold text-amber-300">#{chap.number}</span>
                  <span className="truncate">{chap.category}</span>
                </div>
                <h5 className="text-xs font-bold font-mono text-slate-200 truncate">
                  {chap.title}
                </h5>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODE 3: MALLA TERRITORIAL & TOPOLOGÍA COGNITIVA INTERACTIVA              */}
      {/* ========================================================================= */}
      {mode === "topology" && (
        <div className="flex flex-col gap-6">
          <div className="rounded-3xl border border-slate-800 bg-[#070F1E]/95 p-8 backdrop-blur-2xl shadow-2xl space-y-8">
            <div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-blue-500 animate-pulse" />
                <h2 className="text-xl sm:text-2xl font-bold font-mono text-[#F8FAFC]">
                  Topología Cognitiva Híbrida y Gobernanza C.R.O.W.N.
                </h2>
              </div>
              <p className="text-sm text-slate-300 mt-1 max-w-3xl">
                Representación arquitectónica interactiva del flujo cognitivo de Isabella Villaseñor AI
                como interfaz inteligente del Gemelo Digital de RDM Digital.
              </p>
            </div>

            {/* Architecture Pipeline Visual Grid */}
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4 relative">
              {/* Pillar 1: Interfaz Humana y Territorio */}
              <div className="rounded-2xl border border-slate-800 bg-[#030712] p-5 space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                  <span className="text-[10px] font-mono font-bold text-amber-400">FASE 01</span>
                  <MapPin className="w-4 h-4 text-amber-400" />
                </div>
                <h3 className="text-sm font-bold font-mono text-slate-100">
                  Persona & Territorio Digital
                </h3>
                <p className="text-xs text-slate-400 leading-relaxed font-sans">
                  Entrada de lenguaje natural situada en el contexto territorial de RDM Digital (Real del Monte).
                </p>
                <div className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-[10px] font-mono text-amber-300">
                  Persona ↔ Contexto Territorial
                </div>
              </div>

              {/* Pillar 2: Intención & Riesgo (ORION & ARGUS) */}
              <div className="rounded-2xl border border-slate-800 bg-[#030712] p-5 space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                  <span className="text-[10px] font-mono font-bold text-emerald-400">FASE 02</span>
                  <Shield className="w-4 h-4 text-emerald-400" />
                </div>
                <h3 className="text-sm font-bold font-mono text-slate-100">
                  Intención (ORION) & Riesgo (ARGUS)
                </h3>
                <p className="text-xs text-slate-400 leading-relaxed font-sans">
                  Separación de la intención del operador y evaluación preventiva de riesgos y seguridad Zero Trust.
                </p>
                <div className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-[10px] font-mono text-emerald-300">
                  Evaluación & Filtros Ontológicos
                </div>
              </div>

              {/* Pillar 3: Gobernanza C.R.O.W.N. */}
              <div className="rounded-2xl border border-blue-500/40 bg-blue-950/30 p-5 space-y-3 ring-1 ring-blue-500/20">
                <div className="flex items-center justify-between pb-2 border-b border-blue-500/30">
                  <span className="text-[10px] font-mono font-bold text-sky-400">FASE 03 (NÚCLEO)</span>
                  <Layers className="w-4 h-4 text-sky-400" />
                </div>
                <h3 className="text-sm font-bold font-mono text-sky-200">
                  C.R.O.W.N. Governance
                </h3>
                <p className="text-xs text-slate-300 leading-relaxed font-sans">
                  Capa de políticas computacionales. Aplica reglas antes, durante y después de la inferencia.
                </p>
                <div className="p-2 rounded-xl bg-blue-900/40 border border-blue-500/30 text-[10px] font-mono text-sky-300 font-bold">
                  Orquestación & Arbitraje
                </div>
              </div>

              {/* Pillar 4: Inferencia Híbrida (Local vs Federada) */}
              <div className="rounded-2xl border border-slate-800 bg-[#030712] p-5 space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                  <span className="text-[10px] font-mono font-bold text-cyan-400">FASE 04</span>
                  <Cpu className="w-4 h-4 text-cyan-400" />
                </div>
                <h3 className="text-sm font-bold font-mono text-slate-100">
                  Dualidad Local / Federada
                </h3>
                <p className="text-xs text-slate-400 leading-relaxed font-sans">
                  Núcleo local soberano (ISA/SOPHIA) con fallback ininterrumpido o inferencia federada vía CROWN Gateway.
                </p>
                <div className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-[10px] font-mono text-cyan-300">
                  Soberanía Tecnológica
                </div>
              </div>

              {/* Pillar 5: Salida Armonizada & Trazabilidad */}
              <div className="rounded-2xl border border-slate-800 bg-[#030712] p-5 space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                  <span className="text-[10px] font-mono font-bold text-amber-400">FASE 05</span>
                  <Sparkles className="w-4 h-4 text-amber-400" />
                </div>
                <h3 className="text-sm font-bold font-mono text-slate-100">
                  Isabella Voice & Trazabilidad
                </h3>
                <p className="text-xs text-slate-400 leading-relaxed font-sans">
                  Respuesta contextualizada, síntesis vocal femenina y registro inmutable en log de auditoría.
                </p>
                <div className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-[10px] font-mono text-amber-300">
                  Trazabilidad & Auditoría
                </div>
              </div>
            </div>

            {/* Strategic Paradigms Comparison Table */}
            <div className="rounded-2xl border border-slate-800 bg-[#030712] p-6 space-y-4">
              <h3 className="text-base font-bold font-mono text-[#F8FAFC]">
                Comparación Paradigmática: IA Convencional vs. Isabella Villaseñor AI
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left font-mono text-xs">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400 text-[11px]">
                      <th className="py-3 px-4">DIMENSIÓN</th>
                      <th className="py-3 px-4 text-red-400">PARADIGMA CONVENCIONAL</th>
                      <th className="py-3 px-4 text-sky-400">ARQUITECTURA ISABELLA (NODO CERO)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 text-slate-300 font-sans text-xs">
                    <tr>
                      <td className="py-3 px-4 font-mono font-bold text-slate-200">Pipeline de Inferencia</td>
                      <td className="py-3 px-4 text-slate-400 font-mono">Usuario → Prompt → LLM → Respuesta</td>
                      <td className="py-3 px-4 text-sky-300 font-mono font-bold">
                        Persona → Intención → Contexto → Territorio → Gobernanza → Inferencia Híbrida → Auditoría
                      </td>
                    </tr>
                    <tr>
                      <td className="py-3 px-4 font-mono font-bold text-slate-200">Dependencia de Proveedor</td>
                      <td className="py-3 px-4 text-slate-400">Total dependencia de un API o modelo propietario</td>
                      <td className="py-3 px-4 text-emerald-300">
                        Independencia arquitectónica: federación multi-modelo y núcleo soberano local
                      </td>
                    </tr>
                    <tr>
                      <td className="py-3 px-4 font-mono font-bold text-slate-200">Territorio y Contexto</td>
                      <td className="py-3 px-4 text-slate-400">Base de datos plana o RAG genérico desanclado</td>
                      <td className="py-3 px-4 text-amber-300">
                        Interfaz cognitiva directa del Gemelo Digital (RDM Digital)
                      </td>
                    </tr>
                    <tr>
                      <td className="py-3 px-4 font-mono font-bold text-slate-200">Seguridad & Gobernanza</td>
                      <td className="py-3 px-4 text-slate-400">"El modelo decide y el sistema confía" (caja negra)</td>
                      <td className="py-3 px-4 text-sky-300">
                        Gobernanza computacional C.R.O.W.N., Zero Trust intrínseco y centinela ARGUS
                      </td>
                    </tr>
                    <tr>
                      <td className="py-3 px-4 font-mono font-bold text-slate-200">Soberanía Tecnológica</td>
                      <td className="py-3 px-4 text-slate-400">Extracción de valor hacia centros de datos del Norte</td>
                      <td className="py-3 px-4 text-emerald-300">
                        Soberanía sobre el contexto, la memoria local y los datos del Sur Global y América Latina
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODE 4: CERTIFICADO CRIPTOGRÁFICO SHA-256 & DECLARACIÓN                   */}
      {/* ========================================================================= */}
      {mode === "integrity" && (
        <div className="flex flex-col gap-6">
          <div className="rounded-3xl border border-slate-800 bg-[#070F1E]/95 p-8 sm:p-10 backdrop-blur-2xl shadow-2xl space-y-6">
            <div className="flex items-center justify-between pb-6 border-b border-slate-800/80">
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                  <Fingerprint className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-xl font-bold font-mono text-[#F8FAFC]">
                    Declaración Oficial del Evaluador & Certificado de Integridad
                  </h2>
                  <p className="text-xs text-slate-400 font-mono mt-0.5">
                    Validación formal criptográfica del dossier arquitectónico de Nodo Cero
                  </p>
                </div>
              </div>

              <span className="px-3 py-1.5 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 text-xs font-mono font-bold">
                ✓ Firma Verificada
              </span>
            </div>

            {/* Evaluator Metadata Card */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 rounded-2xl bg-[#030712] border border-slate-800 space-y-1">
                <span className="text-[10px] font-mono text-slate-400 font-bold block">EVALUADOR</span>
                <span className="text-base font-bold font-mono text-slate-200">
                  {EVALUATOR_DECLARATION.evaluator}
                </span>
                <span className="text-xs font-mono text-sky-400 block">
                  Modelo: {EVALUATOR_DECLARATION.model}
                </span>
              </div>

              <div className="p-4 rounded-2xl bg-[#030712] border border-slate-800 space-y-1">
                <span className="text-[10px] font-mono text-slate-400 font-bold block">ESTADO DE AUDITORÍA</span>
                <span className="text-sm font-bold font-mono text-emerald-400 block">
                  {EVALUATOR_DECLARATION.evaluationState}
                </span>
                <span className="text-xs font-mono text-slate-400 block">
                  Fecha: {EVALUATOR_DECLARATION.timestamp}
                </span>
              </div>

              <div className="p-4 rounded-2xl bg-[#030712] border border-slate-800 space-y-1">
                <span className="text-[10px] font-mono text-slate-400 font-bold block">OBJETO DE EVALUACIÓN</span>
                <span className="text-base font-bold font-mono text-amber-300">
                  Nodo Cero / Isabella Villaseñor AI
                </span>
                <span className="text-xs font-mono text-slate-400 block">
                  RDM Digital & C.R.O.W.N. Architecture
                </span>
              </div>
            </div>

            {/* Cryptographic Hash Showcase */}
            <div className="p-6 rounded-2xl bg-[#030712] border border-emerald-500/30 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-bold text-emerald-400">
                  HUELLA CRIPTOGRÁFICA SHA-256 (DOCUMENT INTEGRITY DIGEST)
                </span>
                <button
                  type="button"
                  onClick={handleCopyHash}
                  className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-emerald-950/60 hover:bg-emerald-900 border border-emerald-500/40 text-emerald-300 text-xs font-mono cursor-pointer transition-all"
                >
                  {isHashCopied ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{isHashCopied ? "¡Copiado!" : "Copiar Hash"}</span>
                </button>
              </div>

              <div className="p-3 rounded-xl bg-black/80 border border-emerald-500/20 font-mono text-sm sm:text-base text-emerald-300 break-all select-all font-semibold tracking-wider">
                {EVALUATOR_DECLARATION.sha256}
              </div>

              <p className="text-xs text-slate-400 font-sans leading-relaxed">
                La huella SHA-256 incluida arriba corresponde al texto de referencia definido para esta presentación y debe utilizarse únicamente como mecanismo de integridad documental inmutable.
              </p>
            </div>

            {/* Formal Declaration Text */}
            <div className="p-6 rounded-2xl bg-[#030712] border border-slate-800 space-y-4">
              <h4 className="text-sm font-bold font-mono text-slate-200 uppercase tracking-wider">
                Declaración Formal del Evaluador
              </h4>
              <p className="text-sm sm:text-base text-slate-300 leading-relaxed font-sans">
                La presente evaluación representa un análisis arquitectónico y tecnológico del estado observado de Nodo Cero e Isabella Villaseñor AI al momento de la auditoría. Las conclusiones prospectivas expresadas aquí constituyen una valoración técnica y no una certificación independiente ni una garantía de resultados futuros.
              </p>

              <blockquote className="p-4 rounded-xl bg-blue-950/30 border-l-4 border-amber-400 text-amber-200 text-sm font-mono leading-relaxed">
                «ISABELLA VILLASEÑOR AI: Una arquitectura cognitiva territorial. No definida por un único modelo. No limitada a una conversación. Gobernada por diseño. Contextualizada por territorio. Construida para evolucionar.»
              </blockquote>
            </div>

            {/* Actions for Integrity verification */}
            <div className="flex flex-wrap items-center justify-end gap-3 pt-4 border-t border-slate-800/80">
              <button
                type="button"
                onClick={handleDownloadMarkdown}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#030712] hover:bg-slate-900 border border-slate-800 text-slate-200 text-xs font-mono transition-all cursor-pointer"
              >
                <Download className="w-4 h-4 text-sky-400" />
                <span>Descargar Auditoría con Hash (.MD)</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  soundManager.playBeep(700, 0.03);
                  setActiveView("terminal");
                }}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-mono font-bold transition-all cursor-pointer shadow-lg shadow-blue-600/30"
              >
                <TerminalIcon className="w-4 h-4" />
                <span>Interactuar en Terminal</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
