import type { ExpertModule } from "../authority/method-id";

export const GENESIS_EXPERTS = [
  "E00_IDENTITY","E01_SECURITY","E02_ETHICS","E03_GOVERNANCE","E04_TERRITORY","E05_TOURISM",
  "E06_UX","E07_ECONOMY","E08_DATA","E09_MEMORY","E10_INFERENCE","E11_VERITAS",
  "E12_ANTI_MANIPULATION","E13_PRIVACY","E14_COGNITIVE_SAFETY","E15_ALGORITHMIC_JUSTICE",
  "E16_TRANSPARENCY","E17_COMPLIANCE","E18_PLANNING","E19_REFLECTION","E20_SELF_CRITIQUE",
  "E21_SYNTHESIS","E22_MEMORY_RAG","E23_IDENTITY_COHERENCE",
] as const satisfies readonly ExpertModule[];

export interface ExpertDescriptor {
  id: typeof GENESIS_EXPERTS[number];
  purpose: string;
  riskCeiling: "LOW" | "MEDIUM" | "HIGH";
}

export const EXPERT_REGISTRY: readonly ExpertDescriptor[] = GENESIS_EXPERTS.map((id) => ({
  id,
  purpose: purposeFor(id),
  riskCeiling: id==="E01_SECURITY" || id==="E13_PRIVACY" || id==="E14_COGNITIVE_SAFETY" ? "HIGH" : "MEDIUM",
}));

export interface ExpertPlan {
  selected: readonly ExpertDescriptor[];
  parallelizable: boolean;
  authorityPath: "FULL";
}

export function planExperts(ids: readonly typeof GENESIS_EXPERTS[number][]): ExpertPlan {
  const selected=ids.map((id)=>{
    const found=EXPERT_REGISTRY.find((e)=>e.id===id);
    if(!found) throw new Error(`EXPERTS: unknown module ${id}`);
    return found;
  });
  return Object.freeze({selected,parallelizable:selected.length>1,authorityPath:"FULL"});
}

function purposeFor(id: typeof GENESIS_EXPERTS[number]): string {
  const map: Record<typeof GENESIS_EXPERTS[number],string>={
    E00_IDENTITY:"identity coherence and principal context",E01_SECURITY:"security analysis",E02_ETHICS:"ethical consistency",E03_GOVERNANCE:"policy and governance reasoning",
    E04_TERRITORY:"territorial context",E05_TOURISM:"tourism context",E06_UX:"human interaction context",E07_ECONOMY:"economic context",
    E08_DATA:"data handling",E09_MEMORY:"memory operations",E10_INFERENCE:"inference strategy",E11_VERITAS:"verification",
    E12_ANTI_MANIPULATION:"anti-manipulation safeguards",E13_PRIVACY:"privacy safeguards",E14_COGNITIVE_SAFETY:"cognitive safety",
    E15_ALGORITHMIC_JUSTICE:"fairness and justice checks",E16_TRANSPARENCY:"explainability and transparency",E17_COMPLIANCE:"compliance",
    E18_PLANNING:"planning",E19_REFLECTION:"reflection",E20_SELF_CRITIQUE:"self-critique",E21_SYNTHESIS:"synthesis",
    E22_MEMORY_RAG:"retrieval-augmented memory",E23_IDENTITY_COHERENCE:"identity continuity",
  };
  return map[id];
}
