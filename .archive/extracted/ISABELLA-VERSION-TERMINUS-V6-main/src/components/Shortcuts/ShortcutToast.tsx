import React, { useEffect } from "react";
import { Sparkles, Command } from "lucide-react";

interface Props {
  message: string | null;
  onDismiss: () => void;
}

export const ShortcutToast: React.FC<Props> = ({ message, onDismiss }) => {
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => {
      onDismiss();
    }, 2200);
    return () => clearTimeout(timer);
  }, [message, onDismiss]);

  if (!message) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50 pointer-events-none animate-in slide-in-from-bottom-5 fade-in duration-200">
      <div className="flex items-center gap-2.5 px-4 py-2.5 rounded-2xl bg-[#070F1E]/95 border border-sky-500/50 text-[#F8FAFC] font-mono text-xs shadow-2xl shadow-blue-950/60 backdrop-blur-xl">
        <div className="p-1 rounded-lg bg-blue-500/20 text-sky-300">
          <Command className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
        </div>
        <span className="font-medium text-slate-200">{message}</span>
        <Sparkles className="w-3 h-3 text-amber-400" />
      </div>
    </div>
  );
};
