/**
 * DEPLOYMENT_POLICY — despliegue gradual de la capa de aplicación sin confundir
 * prototipo visual con backend soberano (Lovable, GitHub, Vercel).
 *
 * Separación:
 *   - tamv-spec: especificaciones y documentación.
 *   - tamv-app: aplicación ejecutable.
 *   - IKES: bibliotecas y evidencia.
 *
 * Gates canónicos:
 *   build → tests → secret scan → dependency scan → security scan
 *   → auth/RLS → smoke → health/readiness → canary → rollback plan
 *
 * DNS, dominios personalizados y registros A/TXT/CNAME deben documentarse con
 * valores reales del proveedor; nunca usar IPs de ejemplo en producción.
 */

export const DEPLOYMENT_GATES = [
  "build",
  "tests",
  "secret_scan",
  "dependency_scan",
  "security_scan",
  "auth_rls",
  "smoke",
  "health_readiness",
  "canary",
  "rollback_plan",
] as const;

export type DeploymentGate = (typeof DEPLOYMENT_GATES)[number];

export type GateStatus = "passed" | "failed" | "skipped";

export interface DeploymentTarget {
  /** Destino: repositorio de spec, app ejecutable o bibliotecas IKES. */
  layer: "tamv-spec" | "tamv-app" | "ikes";
  provider: "github" | "vercel" | "lovable" | "self-hosted";
  url?: string;
}

export interface DeploymentGateReport {
  gate: DeploymentGate;
  status: GateStatus;
  detail: string;
}

export interface DeploymentAssessment {
  target: DeploymentTarget;
  deployable: boolean;
  blockers: readonly string[];
  reports: readonly DeploymentGateReport[];
}

const EXAMPLE_IP = /^(?:0\.0\.0\.0|127\.0\.0\.1|192\.0\.2\.\d+|198\.51\.100\.\d+|203\.0\.113\.\d+|example\.)/i;

/**
 * Evalúa los gates de despliegue. Fail-closed: cualquier gate fallido o ausente
 * bloquea el despliegue. Ningún gate requerido puede quedar `skipped`.
 */
export function assessDeployment(
  target: DeploymentTarget,
  gates: Readonly<Partial<Record<DeploymentGate, GateStatus>>>,
  opts: { dnsRecords?: readonly string[] } = {},
): DeploymentAssessment {
  const reports: DeploymentGateReport[] = [];
  const blockers = new Set<string>();
  // Gates de seguridad que se marcan explícitamente como críticos en el reporte.
  const CRITICAL: readonly DeploymentGate[] = ["secret_scan", "dependency_scan", "security_scan", "rollback_plan"];

  for (const gate of DEPLOYMENT_GATES) {
    const status = gates[gate] ?? "skipped";
    const critical = CRITICAL.includes(gate);
    // Fail-closed: cualquier gate que no esté `passed` bloquea el despliegue.
    if (status !== "passed") blockers.add(gate);
    reports.push({ gate, status, detail: status === "passed" ? "ok" : critical ? "critical gate not passed" : "not passed" });
  }

  const dnsRecords = opts.dnsRecords ?? [];
  const exampleRecords = dnsRecords.filter((record) => EXAMPLE_IP.test(record.trim()));
  if (exampleRecords.length > 0) {
    blockers.add("dns_example_value_in_production");
    reports.push({ gate: "health_readiness", status: "failed", detail: `example DNS values: ${exampleRecords.join(", ")}` });
  }

  return {
    target,
    deployable: blockers.size === 0,
    blockers: Object.freeze([...blockers]),
    reports: Object.freeze(reports),
  };
}
