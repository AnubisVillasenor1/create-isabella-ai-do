/**
 * Preflight de producción: valida la CONFIGURACIÓN antes de recibir tráfico (state: draft | engine-generated).
 * Complementa `dependency-readiness` (presencia/IO) con calidad de secretos y coherencia entre variables.
 * Nunca incluye valores de secretos en el informe. No verifica alcance de red de dependencias externas.
 */
export type PreflightSeverity = "ERROR" | "WARN";

export interface PreflightFinding {
  readonly id: string;
  readonly severity: PreflightSeverity;
  readonly message: string;
}

export interface PreflightReport {
  readonly status: "PASS" | "WARN" | "FAIL";
  readonly production: boolean;
  readonly findings: readonly PreflightFinding[];
}

type Env = Readonly<Record<string, string | undefined>>;

const TOKEN_VARS = ["GENESIS_ADMIN_API_TOKEN", "OPS_API_TOKEN", "HYPERCORE_API_TOKEN", "HSF_API_TOKEN"] as const;
const PLACEHOLDER = /^(changeme|change-me|change_me|secret|password|token|test|example|placeholder|todo|xxx+|your[-_ ]?token.*|replace.*)$/i;

/** Entropía de Shannon estimada en bits totales (cota optimista: asume símbolos iid). */
export function estimateEntropyBits(value: string): number {
  if (value.length === 0) return 0;
  const counts = new Map<string, number>();
  for (const ch of value) counts.set(ch, (counts.get(ch) ?? 0) + 1);
  let h = 0;
  for (const c of counts.values()) {
    const p = c / value.length;
    h -= p * Math.log2(p);
  }
  return h * value.length;
}

export function weakSecretReason(value: string): string | null {
  if (value.length < 32) return "shorter than 32 characters";
  if (PLACEHOLDER.test(value.trim())) return "looks like a placeholder";
  if (new Set(value).size < 8) return "too few distinct characters";
  if (estimateEntropyBits(value) < 96) return "estimated entropy below 96 bits";
  return null;
}

function trimmed(env: Env, name: string): string | undefined {
  const v = env[name]?.trim();
  return v ? v : undefined;
}

export function runPreflight(env: Env): PreflightReport {
  const production = env.NODE_ENV === "production";
  const findings: PreflightFinding[] = [];
  const add = (id: string, severity: PreflightSeverity, message: string): void => void findings.push({ id, severity, message });

  const seen = new Map<string, string>();
  for (const name of TOKEN_VARS) {
    const v = trimmed(env, name);
    if (v === undefined) {
      if (name === "GENESIS_ADMIN_API_TOKEN") add("PF-TOKEN-ADMIN-MISSING", production ? "ERROR" : "WARN", "GENESIS_ADMIN_API_TOKEN is not set: every admin route answers 503.");
      continue;
    }
    const weak = weakSecretReason(v);
    if (weak !== null) add(`PF-TOKEN-WEAK-${name}`, production ? "ERROR" : "WARN", `${name} is weak (${weak}).`);
    const prior = seen.get(v);
    if (prior !== undefined) add(`PF-TOKEN-REUSED-${name}`, "ERROR", `${name} reuses the value of ${prior}; privileges are not separated.`);
    else seen.set(v, name);
  }

  const publicUrl = trimmed(env, "APP_PUBLIC_URL");
  if (publicUrl === undefined) {
    if (production) add("PF-PUBLIC-URL-MISSING", "WARN", "APP_PUBLIC_URL is not set: redirect URLs fall back to the request Host header.");
  } else {
    let parsed: URL | null = null;
    try { parsed = new URL(publicUrl); } catch { parsed = null; }
    if (parsed === null) add("PF-PUBLIC-URL-INVALID", "ERROR", "APP_PUBLIC_URL is not a valid absolute URL.");
    else if (production && parsed.protocol !== "https:") add("PF-PUBLIC-URL-INSECURE", "ERROR", "APP_PUBLIC_URL must use https in production.");
  }

  const tp = trimmed(env, "TRUST_PROXY");
  if (tp !== undefined && !/^(?:[1-9]|10)$/.test(tp)) add("PF-TRUST-PROXY-INVALID", "ERROR", "TRUST_PROXY must be an integer 1..10; any other value is ignored (X-Forwarded-For untrusted).");

  const port = env.PORT;
  if (port !== undefined && port !== "" && !(Number.isInteger(Number(port)) && Number(port) >= 1 && Number(port) <= 65535)) add("PF-PORT-INVALID", "ERROR", "PORT must be an integer between 1 and 65535.");

  if (production && trimmed(env, "BOOKPI_LEDGER_PATH") === undefined && !env.VERCEL) add("PF-BOOKPI-VOLATILE", "WARN", "BOOKPI_LEDGER_PATH is not set: the evidence ledger is volatile (lost on restart).");

  const stripeKey = trimmed(env, "STRIPE_SECRET_KEY");
  if (stripeKey !== undefined) {
    if (trimmed(env, "STRIPE_WEBHOOK_SECRET") === undefined) add("PF-STRIPE-WEBHOOK-MISSING", "ERROR", "STRIPE_SECRET_KEY is set without STRIPE_WEBHOOK_SECRET: subscription events cannot be verified.");
    if (production && stripeKey.startsWith("sk_test_")) add("PF-STRIPE-TEST-KEY", "ERROR", "A Stripe test key is configured in production.");
  }

  if (env.ISA_KILL_SWITCH === "1" || env.ISA_KILL_SWITCH === "true") add("PF-KILL-SWITCH-ENGAGED", "WARN", "ISA_KILL_SWITCH is engaged: every governed scope is HALTED.");

  const status = findings.some((f) => f.severity === "ERROR") ? "FAIL" : findings.length > 0 ? "WARN" : "PASS";
  return { status, production, findings };
}

/** Lanza si hay errores bloqueantes. Úsalo detrás de un interruptor explícito (STRICT_PREFLIGHT=1). */
export function assertPreflight(env: Env): PreflightReport {
  const report = runPreflight(env);
  if (report.status === "FAIL") {
    const ids = report.findings.filter((f) => f.severity === "ERROR").map((f) => f.id).join(", ");
    throw new Error(`PREFLIGHT_FAILED: ${ids}`);
  }
  return report;
}
