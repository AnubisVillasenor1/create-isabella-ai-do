/**
 * Machine Learning Gobernado — Isabella v3.0 Capítulo XV
 * Cubre: supervisado, no supervisado, federado, reforzado (sandbox), generativo, GraphRAG, XAI, baseline clásico
 * Principio: ningún agente reforzado puede modificar políticas críticas sin POLICY + aprobación humana.
 */
export type MLType =
  | "supervised"
  | "unsupervised"
  | "federated"
  | "reinforced"
  | "generative"
  | "graphrag"
  | "xai"
  | "quantum-research";
export type MLJob = {
  id: string;
  type: MLType;
  datasetVersion?: string;
  tenantId: string;
  status: "DESIGNED" | "IMPLEMENTED" | "TESTED" | "VERIFIED" | "DEPLOYED" | "CERTIFIED";
  evidenceRequired: string[];
  risks: string[];
  controls: string[];
};

const CONTROLS: Record<MLType, { use: string; control: string }> = {
  supervised: {
    use: "Riesgo, fraude, clasificación",
    control: "Dataset versionado, fairness y drift monitoring",
  },
  unsupervised: { use: "Anomalías, clustering", control: "Revisión humana y falsos positivos" },
  federated: {
    use: "Entrenamiento entre territorios",
    control: "Secure aggregation, consentimiento y salida",
  },
  reinforced: { use: "Simulación de políticas", control: "Sandbox, límites y aprobación humana" },
  generative: { use: "Borradores y escenarios", control: "Provenance, abstención y filtro" },
  graphrag: { use: "Relaciones y fuentes", control: "Citas, versiones y conflictos" },
  xai: { use: "Explicación", control: "Atribución, contraste y apelación" },
  "quantum-research": {
    use: "Kernels y optimización experimental",
    control: "Baseline clásico y no claims automáticos",
  },
};

export function createMLJob(type: MLType, tenantId: string, datasetVersion = "v1"): MLJob {
  const base = CONTROLS[type];
  return {
    id: `ml_${type}_${Date.now().toString(36)}`,
    type,
    tenantId,
    datasetVersion,
    status: "DESIGNED",
    evidenceRequired: [
      "dataset hash",
      "train log",
      "eval metrics",
      "fairness report",
      "drift check",
    ],
    risks:
      type === "reinforced"
        ? ["No modificar permisos/políticas automáticamente — requiere POLICY + humano"]
        : [],
    controls: [base.control, "XAI con atribución", "Baseline clásico antes de claim cuántico"],
  };
}

export function validateRLPolicyChange(
  job: MLJob,
  requesterRole: string,
): { allowed: boolean; reason: string } {
  if (job.type !== "reinforced") return { allowed: true, reason: "No es RL, flujo normal" };
  if (["SovereignOwner", "Operator"].includes(requesterRole))
    return {
      allowed: false,
      reason:
        "RL solo puede PROPONER política en sandbox; POLICY y humano deben aprobar (v3.0 Cap. XV)",
    };
  return { allowed: false, reason: "RL blocked: requiere aprobación humana explícita" };
}

export function quantumBaselineCheck(metric: {
  classical: number;
  quantum: number;
  pValue?: number;
}): { claim: "verified" | "inconclusive" | "rejected"; reason: string } {
  if (metric.quantum <= metric.classical)
    return {
      claim: "rejected",
      reason: `Quantum ${metric.quantum} no supera baseline clásico ${metric.classical} — no claim automático`,
    };
  if (metric.pValue !== undefined && metric.pValue > 0.05)
    return { claim: "inconclusive", reason: `p=${metric.pValue} >0.05 — no significativo` };
  return { claim: "verified", reason: "Supera baseline clásico con significancia" };
}

export function graphRAGWithProvenance(
  query: string,
  sources: Array<{
    id: string;
    content: string;
    provenanceHash: string;
    confidence: number;
    status: "verified" | "hypothesis" | "conflict";
  }>,
) {
  const verified = sources.filter((s) => s.status === "verified");
  const conflicts = sources.filter((s) => s.status === "conflict");
  return {
    query,
    sources,
    evidenceStatus: conflicts.length
      ? "E3"
      : verified.length >= 2
        ? "E0"
        : verified.length === 1
          ? "E1"
          : "E2",
    provenanceRequired: true,
    toResponse: () => ({
      answer: `GraphRAG: ${verified.length} fuentes verificadas, ${conflicts.length} conflictos. Query: ${query}`,
      citations: sources.map((s) => ({
        id: s.id,
        hash: s.provenanceHash,
        confidence: s.confidence,
        status: s.status,
      })),
      requiresHumanReview: conflicts.length > 0,
    }),
  };
}

// --- Drift, Fairness y Velocidad (v3.1) ---
export type DriftReport = {
  drift: number;
  threshold: number;
  triggered: boolean;
  recommendation: string;
};
export function detectDrift(baseline: number[], current: number[], threshold = 0.15): DriftReport {
  if (baseline.length === 0 || current.length === 0)
    return { drift: 0, threshold, triggered: false, recommendation: "Sin datos suficientes" };
  const bAvg = baseline.reduce((a, b) => a + b, 0) / baseline.length;
  const cAvg = current.reduce((a, b) => a + b, 0) / current.length;
  const drift = Math.abs(cAvg - bAvg) / (Math.abs(bAvg) || 1);
  return {
    drift: Number(drift.toFixed(4)),
    threshold,
    triggered: drift > threshold,
    recommendation:
      drift > threshold
        ? `Drift ${drift.toFixed(3)} > ${threshold} — reentrenar con dataset versionado y auditar fairness`
        : "Drift dentro de umbral",
  };
}

export type FairnessReport = { disparateImpact: number; passed: boolean; groups: string[] };
export function auditFairness(scores: Array<{ group: string; score: number }>): FairnessReport {
  if (scores.length < 2) return { disparateImpact: 1, passed: true, groups: [] };
  const byGroup = new Map<string, number[]>();
  for (const s of scores) {
    const arr = byGroup.get(s.group) ?? [];
    arr.push(s.score);
    byGroup.set(s.group, arr);
  }
  const avgs = [...byGroup.entries()].map(([g, v]) => ({
    g,
    avg: v.reduce((a, b) => a + b, 0) / v.length,
  }));
  const max = Math.max(...avgs.map((x) => x.avg));
  const min = Math.min(...avgs.map((x) => x.avg));
  const disparateImpact = min / (max || 1);
  return {
    disparateImpact: Number(disparateImpact.toFixed(3)),
    passed: disparateImpact >= 0.8,
    groups: avgs.map((x) => x.g),
  };
}

export type VelocityMetrics = { p50: number; p95: number; p99: number; throughput: number };
export function measureVelocity(latencies: number[]): VelocityMetrics {
  if (latencies.length === 0) return { p50: 0, p95: 0, p99: 0, throughput: 0 };
  const s = [...latencies].sort((a, b) => a - b);
  const pct = (p: number) => s[Math.floor(s.length * p)] ?? 0;
  const totalSec = s.reduce((a, b) => a + b, 0) / 1000;
  return {
    p50: pct(0.5),
    p95: pct(0.95),
    p99: pct(0.99),
    throughput: totalSec ? Math.round((s.length / totalSec) * 100) / 100 : 0,
  };
}
