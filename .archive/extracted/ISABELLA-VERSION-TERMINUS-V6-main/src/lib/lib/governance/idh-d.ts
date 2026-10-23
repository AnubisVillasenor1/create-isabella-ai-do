/**
 * IDH-D — Índice de Dignidad Humana Digital
 * Capítulo IX del Documento Maestro v3.0-MASTER-EXTENDED
 * Indicador de gobernanza, no medición clínica. Versionado, auditable, apelable.
 * Fórmula: IDH-D = w1*A + w2*P + w3*V + w4*C - delta_e
 * No bloquea automáticamente persona/cuenta sin base normativa, revisión y registro.
 */
import { createHash } from "node:crypto";

export type IDHDComponent = {
  autonomy: number;
  privacy: number;
  valueRetention: number;
  cohesion: number;
  delta: number;
};
export type IDHDWeights = { w1: number; w2: number; w3: number; w4: number };
export type IDHDResult = {
  score: number; // 0-100
  normalizedScore: number; // 0-1
  components: IDHDComponent;
  weights: IDHDWeights;
  version: string;
  policyVersion: string;
  evidenceStatus: "E0" | "E1" | "E2" | "E3" | "E4";
  hash: string;
  explainability: string[];
  appealable: boolean;
  computedAt: string;
};

const DEFAULT_WEIGHTS: IDHDWeights = { w1: 0.3, w2: 0.3, w3: 0.2, w4: 0.2 };
const POLICY_VERSION = "idh-d-v3.0-2026-09-21";

function clamp01(n: number) {
  return Math.max(0, Math.min(1, n));
}

export function computeIDHD(
  input: Partial<IDHDComponent> & { weights?: Partial<IDHDWeights>; policyVersion?: string },
): IDHDResult {
  // P1-01: No defaults silenciosos — exigir componentes explícitos para evitar sesgo por dato faltante
  if (
    input.autonomy === undefined ||
    input.privacy === undefined ||
    input.valueRetention === undefined ||
    input.cohesion === undefined
  ) {
    throw new Error(
      "IDH-D requiere autonomy, privacy, valueRetention, cohesion explícitos (no defaults)",
    );
  }
  const c: IDHDComponent = {
    autonomy: clamp01(input.autonomy),
    privacy: clamp01(input.privacy),
    valueRetention: clamp01(input.valueRetention),
    cohesion: clamp01(input.cohesion),
    delta: clamp01(input.delta ?? 0),
  };
  const w: IDHDWeights = {
    w1: input.weights?.w1 ?? DEFAULT_WEIGHTS.w1,
    w2: input.weights?.w2 ?? DEFAULT_WEIGHTS.w2,
    w3: input.weights?.w3 ?? DEFAULT_WEIGHTS.w3,
    w4: input.weights?.w4 ?? DEFAULT_WEIGHTS.w4,
  };
  // Validación de pesos: deben sumar 1.0 ±0.01 para evitar sesgo por ponderación incorrecta (mejora, no simplifica)
  const sumW = w.w1 + w.w2 + w.w3 + w.w4;
  if (Math.abs(sumW - 1) > 0.01) {
    throw new Error(
      `IDH-D pesos inválidos: w1+w2+w3+w4=${sumW.toFixed(3)} debe ser 1.0 ±0.01 (v3.1)`,
    );
  }
  const raw =
    w.w1 * c.autonomy + w.w2 * c.privacy + w.w3 * c.valueRetention + w.w4 * c.cohesion - c.delta;
  const normalized = clamp01(raw);
  const score = Math.round(normalized * 100);
  const evidenceStatus: IDHDResult["evidenceStatus"] =
    score >= 80 ? "E0" : score >= 60 ? "E1" : score >= 40 ? "E2" : score >= 20 ? "E3" : "E4";
  const explainability = [
    `A(autonomía)=${c.autonomy.toFixed(2)}*w1=${w.w1}`,
    `P(privacidad)=${c.privacy.toFixed(2)}*w2=${w.w2}`,
    `V(valor)=${c.valueRetention.toFixed(2)}*w3=${w.w3}`,
    `C(cohesión)=${c.cohesion.toFixed(2)}*w4=${w.w4}`,
    `delta_e(penalización)=${c.delta.toFixed(2)}`,
    `Fórmula: ${w.w1}*A+${w.w2}*P+${w.w3}*V+${w.w4}*C - delta => ${score}/100 (${evidenceStatus})`,
    `Policy: ${input.policyVersion ?? POLICY_VERSION} — pesos publicados, apelable, no bloqueo automático sin revisión humana.`,
  ];
  const hash = createHash("sha256")
    .update(JSON.stringify({ c, w, score, version: POLICY_VERSION }))
    .digest("hex")
    .slice(0, 16);
  return {
    score,
    normalizedScore: normalized,
    components: c,
    weights: w,
    version: POLICY_VERSION,
    policyVersion: input.policyVersion ?? POLICY_VERSION,
    evidenceStatus,
    hash,
    explainability,
    appealable: true,
    computedAt: new Date().toISOString(),
  };
}

export function idhdAppealRoute(tenantId: string, score: number) {
  return {
    tenantId,
    score,
    requiresHumanReview: score < 40,
    appealUrl: `/api/v1/governance/dignity-index?tenant=${encodeURIComponent(tenantId)}&appeal=true`,
    slaHours: 72,
  };
}

// --- Mitigación de sesgos (v3.1) ---
export type BiasAudit = {
  metric: string;
  disparateImpact: number;
  passed: boolean;
  recommendation: string;
};
export function auditIDHDBias(
  scores: Array<{ tenantId: string; score: number; components: IDHDComponent }>,
): BiasAudit[] {
  if (scores.length < 2) return [];
  const avg = scores.reduce((s, x) => s + x.score, 0) / scores.length;
  const min = Math.min(...scores.map((s) => s.score));
  const disparateImpact = min / (avg || 1); // 0-1, <0.8 indica impacto dispar (regla 80%)
  const audits: BiasAudit[] = [];
  audits.push({
    metric: "disparateImpact",
    disparateImpact: Number(disparateImpact.toFixed(3)),
    passed: disparateImpact >= 0.8,
    recommendation:
      disparateImpact < 0.8
        ? "Revisar pesos w1-w4 y delta_e: posible penalización desproporcionada a un tenant. Ajustar con comité y re-evaluar fairness."
        : "Sin disparate impact significativo (≥0.8).",
  });
  // Auditoría por componente: si un componente sistemáticamente bajo para un grupo, flag
  for (const comp of ["autonomy", "privacy", "valueRetention", "cohesion"] as const) {
    const vals = scores.map((s) => s.components[comp]);
    const compAvg = vals.reduce((a, b) => a + b, 0) / vals.length;
    const compMin = Math.min(...vals);
    const ratio = compMin / (compAvg || 1);
    if (ratio < 0.75) {
      audits.push({
        metric: `bias:${comp}`,
        disparateImpact: Number(ratio.toFixed(3)),
        passed: false,
        recommendation: `Componente ${comp} muestra sesgo: min/avg=${ratio.toFixed(2)} <0.75. Revisar fuente de datos y ponderación.`,
      });
    }
  }
  return audits;
}
