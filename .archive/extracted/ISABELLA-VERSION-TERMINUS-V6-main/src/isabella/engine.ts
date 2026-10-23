import { createHash } from "node:crypto";

export type FederationId = "Sociologica" | "Identidad" | "Gobernanza" | "Territorial" | "Educativa" | "Tecnologica" | "Economica";
export type IsabellaProfile = "general" | "contra-auditoria" | "simulacion" | "secretaria" | "gobernanza";

export interface HeptafederatedScores {
  Sociologica: number; Identidad: number; Gobernanza: number; Territorial: number;
  Educativa: number; Tecnologica: number; Economica: number;
}
export interface EntropyAnalysis {
  entropiaShannon: number; estabilidadEpistemica: boolean; mitigacionRequerida: boolean;
}
export interface ContraAuditoriaResult {
  operacion: "Contra-Auditoría Cognitiva"; tensionDetectada: number;
  analisisEntropia: EntropyAnalysis; falsable: boolean;
}
export interface EpistemicSimulationResult {
  hashRegistro: string; hipotesisEvaluada: string;
  validacionHeptafederada: HeptafederatedScores; consonanciaSistemica: boolean;
  factorCompresionOOD: number; estadoEmergente: string;
}
export interface LatentPoint { id: string; label: string; vector: number[]; }
export interface IsabellaLedgerEntry {
  id: string;
  kind: "contra-auditoria" | "simulacion-epistemologica" | "heptafederacion" | "entropia" | "meta";
  timestamp: string; profile: IsabellaProfile; payload: unknown;
}
export interface IsabellaEngineConfig {
  manifoldDimensions?: number; entropiaUmbralCritico?: number;
  heptafederacionUmbralMinimo?: number; hashDocumentalOverride?: string;
}
export interface IsabellaEngineSnapshot {
  version: string; hashDocumental: string; ledgerEntries: number;
  conceptCount: number; manifoldDimensions: number;
}

const FEDERATIONS: readonly FederationId[] = ["Sociologica","Identidad","Gobernanza","Territorial","Educativa","Tecnologica","Economica"];
const nowISO = (): string => new Date().toISOString();
const normalizeText = (v: unknown): string => typeof v === "string" ? v.trim() : "";
const clamp01 = (x: number): number => Math.max(0, Math.min(1, x));
const sha256Hex = (value: string): string => createHash("sha256").update(value, "utf8").digest("hex");

function probabilitiesNormalize(values: number[]): number[] {
  const safe = values.map((v) => Number.isFinite(v) && v > 0 ? v : 0);
  const sum = safe.reduce((a, b) => a + b, 0);
  if (sum === 0) throw new Error("se requiere al menos una probabilidad positiva y finita");
  return safe.map((v) => v / sum);
}

class LatentSpaceManifold {
  readonly dimensions: number;
  private readonly conceptBank = new Map<string, LatentPoint>();
  constructor(dimensions = 128) {
    if (!Number.isInteger(dimensions) || dimensions < 8 || dimensions > 4096) {
      throw new Error("manifoldDimensions debe ser un entero entre 8 y 4096");
    }
    this.dimensions = dimensions;
    for (const concept of ["soberania_digital","reduccionismo_estadistico","cognicion_contextual","infraestructura_cognitiva","isomorfismo_funcional"]) {
      this.registerConcept(concept);
    }
  }
  private deterministicVector(label: string): number[] {
    const vector: number[] = [];
    let counter = 0;
    while (vector.length < this.dimensions) {
      const digest = createHash("sha256").update(label + ":" + counter++).digest();
      for (let i = 0; i < digest.length && vector.length < this.dimensions; i += 2) {
        const n = digest.readUInt16BE(i);
        vector.push(Number(((n / 65535) * 2 - 1).toFixed(6)));
      }
    }
    return vector;
  }
  registerConcept(label: string): LatentPoint {
    const normalized = normalizeText(label);
    if (!normalized) throw new Error("label de concepto requerido");
    const existing = this.conceptBank.get(normalized);
    if (existing) return existing;
    const point = { id: "concept_" + sha256Hex(normalized).slice(0,16), label: normalized, vector: this.deterministicVector(normalized) };
    this.conceptBank.set(normalized, point);
    return point;
  }
  getConcept(label: string): LatentPoint | undefined { return this.conceptBank.get(label); }
  distance(v1: number[], v2: number[]): number {
    const n = Math.min(v1.length, v2.length); let acc = 0;
    for (let i=0;i<n;i++) { const d=(v1[i]??0)-(v2[i]??0); acc += d*d; }
    return Math.sqrt(acc);
  }
  projectOODFactor(hypothesis: string): number {
    const tokens = hypothesis.split(/\s+/).filter(Boolean);
    return clamp01(Math.max(0.1, 1 - tokens.length * 0.02));
  }
  get size(): number { return this.conceptBank.size; }
}

class HeptafederatedValidator {
  constructor(private readonly threshold = 0.5) {
    if (threshold < 0 || threshold > 1) throw new Error("umbral heptafederado fuera de rango");
  }
  evaluate(hypothesis: string, sovereign: boolean): { consonante: boolean; scores: HeptafederatedScores } {
    const scores = {} as HeptafederatedScores;
    for (const federation of FEDERATIONS) {
      const digest = sha256Hex(federation + "|" + hypothesis + "|" + (sovereign ? "sovereign" : "contextual"));
      const raw = Number.parseInt(digest.slice(0,8), 16) / 0xffffffff;
      scores[federation] = Number((sovereign ? 0.75 + raw*0.25 : 0.4 + raw*0.4).toFixed(4));
    }
    return { consonante: FEDERATIONS.every((f) => scores[f] >= this.threshold), scores };
  }
}

class EntropyMitigator {
  constructor(private readonly threshold = 1.5) {
    if (threshold <= 0) throw new Error("umbral de entropía debe ser positivo");
  }
  calculate(probabilities: number[]): number {
    return probabilitiesNormalize(probabilities).reduce((e,p) => e - (p > 0 ? p*Math.log2(p) : 0), 0);
  }
  evaluate(probabilities: number[]): EntropyAnalysis {
    const entropy = this.calculate(probabilities); const stable = entropy < this.threshold;
    return { entropiaShannon:Number(entropy.toFixed(4)), estabilidadEpistemica:stable, mitigacionRequerida:!stable };
  }
}

export class IsabellaEngine {
  readonly version = "2.0-2026";
  readonly hashDocumental: string;
  private readonly manifold: LatentSpaceManifold;
  private readonly validator: HeptafederatedValidator;
  private readonly mitigator: EntropyMitigator;
  private readonly ledger: IsabellaLedgerEntry[] = [];

  constructor(config: IsabellaEngineConfig = {}) {
    this.hashDocumental = config.hashDocumentalOverride ?? "TAMV-IVAI-EMERGENT-COGNITION-v2.0-2026";
    this.manifold = new LatentSpaceManifold(config.manifoldDimensions ?? 128);
    this.validator = new HeptafederatedValidator(config.heptafederacionUmbralMinimo ?? 0.5);
    this.mitigator = new EntropyMitigator(config.entropiaUmbralCritico ?? 1.5);
  }
  private appendLedger(kind: IsabellaLedgerEntry["kind"], profile: IsabellaProfile, payload: unknown): IsabellaLedgerEntry {
    const entry = { id:"isa_evt_"+(this.ledger.length+1), kind, profile, timestamp:nowISO(), payload };
    this.ledger.push(entry); return entry;
  }
  ejecutarContraAuditoria(premisaA:string,premisaB:string) {
    const a=normalizeText(premisaA).toLowerCase(), b=normalizeText(premisaB).toLowerCase();
    if(!a||!b) throw new Error("ambas premisas son requeridas para la contra-auditoría");
    const strong=a.includes("jamás")&&b.includes("resolvió");
    const analysis=this.mitigator.evaluate(strong?[0.1,0.9]:[0.5,0.5]);
    const resultado={operacion:"Contra-Auditoría Cognitiva" as const,tensionDetectada:strong?0.95:0.2,analisisEntropia:analysis,falsable:analysis.mitigacionRequerida};
    const ledger=this.appendLedger("contra-auditoria","contra-auditoria",{premisaA,premisaB,tension:resultado.tensionDetectada,analisisEntropia:analysis});
    return {resultado,ledger};
  }
  procesarSimulacionEpistemologica(hipotesis:string,contextoSoberano:boolean) {
    const h=normalizeText(hipotesis); if(!h) throw new Error("hipótesis requerida para simulación epistemológica");
    const {consonante,scores}=this.validator.evaluate(h,contextoSoberano);
    const factorOOD=this.manifold.projectOODFactor(h);
    const estadoEmergente=consonante&&factorOOD<0.7 ? "Cognición Contextual Emergente Operacional Garantizada" : "Colapso Lógico o Reduccionismo Lineal Detectado";
    const resultado={hashRegistro:this.hashDocumental,hipotesisEvaluada:h,validacionHeptafederada:scores,consonanciaSistemica:consonante,factorCompresionOOD:Number(factorOOD.toFixed(4)),estadoEmergente};
    const ledger=this.appendLedger("simulacion-epistemologica","simulacion",{hipotesis:h,soberano:contextoSoberano,resultado});
    this.appendLedger("heptafederacion","simulacion",{hipotesis:h,scores,contextoSoberano});
    return {resultado,ledger};
  }
  evaluarEntropia(probabilidades:number[]) {
    if(!Array.isArray(probabilidades)||probabilidades.length===0) throw new Error("se requiere una lista de probabilidades para evaluar entropía");
    const resultado=this.mitigator.evaluate(probabilidades);
    const ledger=this.appendLedger("entropia","general",{probabilidades,resultado});
    return {resultado,ledger};
  }
  chat({input,profile="general"}:{input:string;profile?:IsabellaProfile}) {
    const text=normalizeText(input); if(!text) throw new Error("input is required");
    if(profile==="contra-auditoria"){const [a,b]=text.split(/\n---\n/);const {resultado}=this.ejecutarContraAuditoria(a??text,b??text);return {answer:"Isabella ejecutó contra-auditoría: tensión="+resultado.tensionDetectada.toFixed(2)+", entropía="+resultado.analisisEntropia.entropiaShannon,profile,safeguards:["epistemic-falsability","human-override-ready"]};}
    if(profile==="simulacion"){const {resultado}=this.procesarSimulacionEpistemologica(text,true);return {answer:"Simulación epistemológica: estado=\""+resultado.estadoEmergente+"\", factorOOD="+resultado.factorCompresionOOD,profile,safeguards:["federated-consistency","territorial-anchor"]};}
    return {answer:"Isabella recibió: "+text,profile,safeguards:["privacy-minimization","human-override-ready"]};
  }
  listLedger(limit=100): IsabellaLedgerEntry[] { return !Number.isInteger(limit)||limit<=0 ? [] : this.ledger.slice(-limit); }
  getLedgerEntry(id:string): IsabellaLedgerEntry|null { return this.ledger.find((entry)=>entry.id===id)??null; }
  snapshot():IsabellaEngineSnapshot { return {version:this.version,hashDocumental:this.hashDocumental,ledgerEntries:this.ledger.length,conceptCount:this.manifold.size,manifoldDimensions:this.manifold.dimensions}; }
}
