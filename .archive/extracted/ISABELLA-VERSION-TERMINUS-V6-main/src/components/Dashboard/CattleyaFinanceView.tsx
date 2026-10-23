import React, { useState } from "react";
import { CreditCard, ShieldCheck, Activity, Lock, Wallet, ArrowUpRight, ArrowDownRight, Sparkles, RefreshCw, CheckCircle2 } from "lucide-react";
import { useCrown } from "../../context/CrownContext";
import { soundManager } from "../../utils/soundEffects";
import { signLedgerBlockPQC } from "../../lib/postQuantumCrypto";

interface Transaction {
  id: string;
  desc: string;
  amt: string;
  status: string;
  icon: typeof ArrowUpRight;
  color: string;
  pqcHash: string;
  timestamp: string;
}

export const CattleyaFinanceView: React.FC = () => {
  const { state } = useCrown();
  const [balance, setBalance] = useState(14204.50);
  const [cardStatus, setCardStatus] = useState<"ACTIVE" | "FROZEN">("ACTIVE");
  const [transactions, setTransactions] = useState<Transaction[]>([
    {
      id: "tx-1",
      desc: "Suscripción API Isabella Enterprise",
      amt: "-$499.00 MXN",
      status: "ML-DSA-87 Firmado",
      icon: ArrowUpRight,
      color: "text-rose-400",
      pqcHash: "mldsa87_sig_499_rdm",
      timestamp: "Hace 10 min",
    },
    {
      id: "tx-2",
      desc: "Recarga Nodo Cero Soberano",
      amt: "+$2,000.00 MXN",
      status: "BookPI Ledger Aprobado",
      icon: ArrowDownRight,
      color: "text-emerald-400",
      pqcHash: "mldsa87_sig_2000_rdm",
      timestamp: "Hace 1 hora",
    },
    {
      id: "tx-3",
      desc: "Instancia GPU A100 Tensor-Core",
      amt: "-$1,250.00 MXN",
      status: "LITLE 32 Gates Validado",
      icon: ArrowUpRight,
      color: "text-rose-400",
      pqcHash: "mldsa87_sig_1250_rdm",
      timestamp: "Hace 3 horas",
    },
  ]);

  const [isSimulatingTx, setIsSimulatingTx] = useState(false);

  const handleSimulatePayment = () => {
    setIsSimulatingTx(true);
    soundManager.playBeep(880, 0.04);

    setTimeout(() => {
      const newAmount = 150.0;
      const proof = signLedgerBlockPQC(`tx-${Date.now()}`, `amt-${newAmount}`);
      const newTx: Transaction = {
        id: `tx-${Date.now()}`,
        desc: "Inferencia In situ & Inyección Memoria Episódica",
        amt: `-$${newAmount.toFixed(2)} MXN`,
        status: "PQC Dual ML-DSA-87 Firmado",
        icon: ArrowUpRight,
        color: "text-rose-400",
        pqcHash: proof.mlDsaSignature.slice(0, 24) + "...",
        timestamp: "Ahora",
      };

      setTransactions((prev) => [newTx, ...prev]);
      setBalance((prev) => prev - newAmount);
      setIsSimulatingTx(false);
      soundManager.playSuccess();
    }, 400);
  };

  const toggleCardLock = () => {
    soundManager.playBeep(700, 0.04);
    setCardStatus((prev) => (prev === "ACTIVE" ? "FROZEN" : "ACTIVE"));
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-8 animate-fade-in text-slate-200">
      <header className="flex flex-col items-center text-center space-y-4">
        <div className="inline-flex items-center justify-center p-3 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-teal-500/10 border border-emerald-500/40 text-emerald-400 shadow-[0_0_25px_rgba(16,185,129,0.25)]">
          <Wallet className="w-8 h-8" />
        </div>
        <div className="space-y-2">
          <h2 className="text-3xl font-light font-mono text-slate-100 tracking-wide flex items-center justify-center gap-3">
            <span>CATTLEYA™ Finance Hub</span>
            <span className="text-xs bg-emerald-500/20 text-emerald-300 font-mono px-2.5 py-1 rounded-full border border-emerald-500/30">
              TAMV DM-X4™
            </span>
          </h2>
          <p className="text-sm font-mono text-slate-400 max-w-2xl mx-auto leading-relaxed">
            Módulo Financiero Simbiótico de alta seguridad poscuántica. Gestión de tarjetas virtuales, créditos computacionales y firmas criptográficas ML-DSA-87.
          </p>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Virtual Card Showcase - AAA Metallic Carbon Fiber Hologram */}
        <div className="lg:col-span-5 bg-gradient-to-br from-slate-900 via-[#070F1E] to-slate-950 border border-slate-800 rounded-3xl p-6 shadow-2xl relative overflow-hidden flex flex-col justify-between space-y-6">
          <div className="absolute -top-20 -right-20 w-48 h-48 bg-emerald-500/15 blur-3xl rounded-full" />
          <div className="flex justify-between items-center relative z-10">
            <h3 className="text-xs font-mono tracking-widest text-slate-400 flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-emerald-400" />
              TARJETA VIRTUAL SIMBIÓTICA
            </h3>
            <button
              type="button"
              onClick={toggleCardLock}
              className={`text-[10px] font-mono px-2.5 py-1 rounded-lg border transition-all cursor-pointer ${
                cardStatus === "ACTIVE"
                  ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40 hover:bg-emerald-500/30"
                  : "bg-rose-500/20 text-rose-300 border-rose-500/40 hover:bg-rose-500/30"
              }`}
            >
              {cardStatus === "ACTIVE" ? "CONGELAR TARJETA" : "DESCONGELAR TARJETA"}
            </button>
          </div>
          
          {/* Card Physical Mesh Render */}
          <div className={`bg-gradient-to-br from-emerald-600 via-teal-800 to-slate-900 rounded-2xl p-6 text-white shadow-2xl relative overflow-hidden aspect-[1.58/1] transition-transform duration-300 ${cardStatus === "FROZEN" ? "opacity-60 grayscale" : "hover:scale-[1.01]"}`}>
            <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-40 mix-blend-overlay" />
            <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-amber-400/20 blur-2xl rounded-full mix-blend-screen" />
            
            <div className="flex justify-between items-start mb-8 relative z-10">
              <div className="flex items-center gap-3">
                <div className="w-11 h-7 bg-gradient-to-r from-amber-200 to-amber-400 rounded-md shadow-md border border-amber-300/40" />
                <span className="text-[10px] font-mono bg-black/40 text-amber-300 px-2 py-0.5 rounded border border-amber-400/30 backdrop-blur-md">
                  PQC ML-DSA-87
                </span>
              </div>
              <span className={`text-[10px] font-mono px-2.5 py-0.5 rounded-full border backdrop-blur-md font-bold ${cardStatus === "ACTIVE" ? "bg-emerald-400/20 text-emerald-100 border-emerald-400/40" : "bg-rose-500/30 text-rose-200 border-rose-400/40"}`}>
                {cardStatus}
              </span>
            </div>

            <div className="text-2xl font-mono tracking-[0.22em] mb-6 relative z-10 drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] text-slate-100">
              •••• •••• •••• 4096
            </div>

            <div className="flex justify-between items-end relative z-10 text-emerald-50">
              <div>
                <p className="text-[9px] font-mono opacity-80 mb-0.5 tracking-wider">TITULAR SIMBIÓTICO</p>
                <p className="text-xs font-bold uppercase tracking-wider font-mono text-slate-100">Investigador RDM</p>
              </div>
              <div className="text-right">
                <p className="text-[9px] font-mono opacity-80 mb-0.5 tracking-wider">EXPIRACIÓN</p>
                <p className="text-xs font-mono font-bold text-amber-200">12/28</p>
              </div>
            </div>
          </div>

          <div className="space-y-3 font-mono text-xs">
            <div className="flex justify-between p-3.5 bg-[#030712] rounded-xl border border-slate-800/80">
              <span className="text-slate-400">Límite Diario:</span>
              <span className="text-emerald-400 font-bold">$5,000.00 MXN</span>
            </div>
            <div className="flex justify-between p-3.5 bg-[#030712] rounded-xl border border-slate-800/80">
              <span className="text-slate-400">Límite Mensual:</span>
              <span className="text-emerald-400 font-bold">$20,000.00 MXN</span>
            </div>

            <button
              type="button"
              onClick={handleSimulatePayment}
              disabled={isSimulatingTx || cardStatus === "FROZEN"}
              className="w-full py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold rounded-xl transition-all shadow-lg flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {isSimulatingTx ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Firmando Transacción PQC...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-amber-300" />
                  <span>Simular Transacción PQC (-$150.00)</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Dashboard Metrics & Transaction Ledger */}
        <div className="lg:col-span-7 space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-gradient-to-br from-[#070F1E] to-[#030712] border border-slate-800 rounded-2xl p-5 flex flex-col justify-center shadow-xl">
              <span className="text-[10px] font-mono text-slate-500 uppercase flex items-center gap-1.5 mb-2">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                Estado KYC/AML (ARGUS Zero-Trust)
              </span>
              <div className="text-xl font-light text-slate-100 flex items-center gap-2 font-mono">
                <span>Verificación Premium</span>
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="text-xs text-emerald-400 mt-1 font-mono">Firma PQC: ML-DSA-87 Aprobada</div>
            </div>

            <div className="bg-gradient-to-br from-[#070F1E] to-[#030712] border border-slate-800 rounded-2xl p-5 flex flex-col justify-center shadow-xl">
              <span className="text-[10px] font-mono text-slate-500 uppercase flex items-center gap-1.5 mb-2">
                <Activity className="w-3.5 h-3.5 text-sky-400" />
                TAMV Créditos™ Disponibles
              </span>
              <div className="text-2xl font-mono font-bold text-sky-300">
                ${balance.toLocaleString("es-MX", { minimumFractionDigits: 2 })}
              </div>
              <div className="text-xs text-slate-400 mt-1 font-mono">Recompensas éticas de Nodo Cero</div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-[#070F1E] to-[#030712] border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-4">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h3 className="text-xs font-mono font-bold tracking-widest text-slate-300 flex items-center gap-2">
                <Lock className="w-4 h-4 text-amber-300" />
                HISTORIAL TRANSACCIONAL FIRMADO EN BOOKPI (MEA)
              </h3>
              <span className="text-[10px] font-mono text-slate-500">{transactions.length} Transacciones</span>
            </div>

            <div className="space-y-3">
              {transactions.map((tx) => (
                <div
                  key={tx.id}
                  className="flex items-center justify-between p-3.5 bg-[#030712] border border-slate-800/80 rounded-xl hover:border-slate-700 transition-colors font-mono"
                >
                  <div className="flex items-center gap-3">
                    <div className={`p-2.5 rounded-xl bg-slate-900 border border-slate-800 ${tx.color}`}>
                      <tx.icon className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-slate-200">{tx.desc}</p>
                      <p className="text-[10px] text-slate-500 mt-0.5 flex items-center gap-1.5">
                        <span className="text-emerald-400 font-bold">{tx.status}</span>
                        <span>•</span>
                        <span>{tx.timestamp}</span>
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={`text-sm font-bold ${tx.color}`}>{tx.amt}</div>
                    <div className="text-[9px] text-slate-500">{tx.pqcHash}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
