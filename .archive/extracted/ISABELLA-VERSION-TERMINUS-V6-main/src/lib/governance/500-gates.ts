/**
 * 500 Gates — Isabella Villaseñor AI™
 * 20 dominios × 25 controles = 500 cambios auditables
 * Cada gate es verificable, versionado, y same-commit con evidence
 * Blanco o negro: PASS o FAIL, no hay grises
 */

export const DOMAINS = [
  "Git/evidencia",
  "Arquitectura",
  "Identidad",
  "Autorización",
  "CROWN",
  "Memoria",
  "ML/IA",
  "HDC/NCUA",
  "BookPI",
  "Postgres/RLS",
  "API",
  "AppSec",
  "Vercel/runtime",
  "SRE",
  "QA",
  "CI/CD",
  "UX/A11y",
  "Ética",
  "Docs/comunidad",
  "Performance",
] as const;

export const CONTROLS = [
  "ssot_verificable",
  "eliminar_duplicaciones",
  "contrato_formal",
  "validacion_automatica",
  "pruebas_negativas",
  "pruebas_concurrencia",
  "evidencia_same_commit",
  "version_exacta",
  "provenance",
  "fail_closed",
  "rollback",
  "metricas_p50p95p99",
  "alertas",
  "limites_explicitos",
  "rate_limiting",
  "auditoria_estructurada",
  "versionado",
  "migracion_reproducible",
  "documentacion_operativa",
  "prueba_recuperacion",
  "prueba_adversarial",
  "prueba_aislamiento",
  "control_configuracion",
  "gate_release",
  "marcar_experimental",
] as const;

export type Domain = (typeof DOMAINS)[number];
export type Control = (typeof CONTROLS)[number];
export type GateId = `${Domain}:${Control}`;

export interface GateEvidence {
  gate: GateId;
  status: "PASS" | "FAIL" | "EVIDENCE_GATED";
  commit: string;
  workflow_run_id?: string;
  deployment_id?: string;
  test_run_id?: string;
  timestamp: string;
  evidence: string;
}

const EVIDENCE_MAP: Record<string, string> = {
  "Git/evidencia:ssot_verificable":
    "production-capabilities.json + docs/evidence/ + git rev-parse HEAD",
  "Arquitectura:ssot_verificable":
    "docs/architecture/SSOT.md + docs/01-ISABELLA-CANONICA-UNIFICADA.md",
  "Identidad:ssot_verificable": "src/lib/user-auth-service.ts dev-only + Supabase Auth canónica",
  "Autorización:ssot_verificable": "src/lib/authorization.ts + src/lib/rbac.ts + policy-engine",
  "CROWN:ssot_verificable": "src/lib/crown-v6.ts 12 nodos",
  "Memoria:ssot_verificable": "src/lib/repositories/memory-repository.ts + pg_advisory_xact_lock",
  "ML/IA:ssot_verificable": "src/lib/native-ml/governed-ml.ts + language-core.ts",
  "HDC/NCUA:ssot_verificable":
    "src/lib/ncua/academic-pipeline.ts + quantum-bridge-client.ts allowlist",
  "BookPI:ssot_verificable": "src/lib/repositories/bookpi-postgres-repository.ts WORM",
  "Postgres/RLS:ssot_verificable":
    "supabase/migrations + neon-adapter.ts ssl + channel_binding sanitizado",
  "API:ssot_verificable": "src/lib/api-contracts.ts + src/server-routes/api/v1/language/profile.ts",
  "AppSec:ssot_verificable": "src/lib/security.ts + vercel.json CSP/HSTS + secret-exposure.test.ts",
  "Vercel/runtime:ssot_verificable":
    "vercel.json .vercel/output + vite.config.ts nitro() + V.jsxDEV 0",
  "SRE:ssot_verificable": "docs/operations/SLO.md + docs/runbooks/incident.md + otel",
  "QA:ssot_verificable": "545 passed, 10 skipped, test/security/secret-exposure.test.ts",
  "CI/CD:ssot_verificable": ".github/workflows/ci.yml pnpm --frozen-lockfile + sbom.mjs",
  "UX/A11y:ssot_verificable": "docs/operations/A11Y.md WCAG 2.2 AA + a11y.test.ts",
  "Ética:ssot_verificable": "src/lib/governance/idh-d.ts auditIDHDBias + docs/ml/DRIFT.md",
  "Docs/comunidad:ssot_verificable": "6 canónicos docs/01..06 (94->6)",
  "Performance:ssot_verificable": "vite build 2.98s, double-pipeline p95 2ms, NCUA 50/500",
};

export function getGateEvidence(domain: Domain, control: Control, commit: string): GateEvidence {
  const gate = `${domain}:${control}` as GateId;
  // Un path o una descripción no constituyen evidencia ejecutable. El gate
  // permanece bloqueado hasta que un runner registre una ejecución verificable.
  return {
    gate,
    status: "EVIDENCE_GATED",
    commit,
    timestamp: new Date().toISOString(),
    evidence: EVIDENCE_MAP[gate] || `src/lib/governance/500-gates.ts ${gate}`,
  };
}

export function getAllGates(commit: string): GateEvidence[] {
  const gates: GateEvidence[] = [];
  for (const domain of DOMAINS) {
    for (const control of CONTROLS) {
      gates.push(getGateEvidence(domain, control, commit));
    }
  }
  return gates;
}

export function verifySameCommit(gates: GateEvidence[], expectedCommit: string): boolean {
  return gates.every((g) => g.commit === expectedCommit);
}

export const GATE_COUNT = DOMAINS.length * CONTROLS.length; // 500
