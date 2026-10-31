/**
 * Deep dependency readiness — real configuration/IO probes for production readiness.
 *
 * Distinguishes CONFIGURED from VERIFIED (AGENTS.md hierarchy of truth): these
 * probes observe whether a dependency is present, writable, or credentialed in the
 * running process. They do NOT prove external reachability, quota, distributed
 * concurrency, or WORM durability. A report is `ready` only when every required
 * dependency is healthy; fail-closed when evidence is missing (RA-018).
 */
import { accessSync, constants, existsSync } from 'node:fs';
import { dirname } from 'node:path';
import {
  assessProductionReadiness,
  type DependencyHealth,
  type HealthStatus,
  type ProductionReadinessReport,
} from '../deployment/production-ops';

export type EnvLike = Readonly<Record<string, string | undefined>>;

export interface DependencyEvidence {
  dependency: string;
  status: HealthStatus;
  required: boolean;
  detail: string;
}

export interface DependencyReadinessReport {
  readiness: ProductionReadinessReport;
  dependencies: readonly DependencyHealth[];
  evidence: readonly DependencyEvidence[];
}

export interface FilesystemProbe {
  isWritableDirectory(targetPath: string): boolean;
}

/** Real filesystem probe: the ledger's parent directory must exist and be writable. */
export const nodeFilesystemProbe: FilesystemProbe = {
  isWritableDirectory(targetPath: string): boolean {
    const directory = dirname(targetPath);
    if (!existsSync(directory)) return false;
    try {
      accessSync(directory, constants.W_OK);
      return true;
    } catch {
      return false;
    }
  },
};

function isConfigured(env: EnvLike, keys: readonly string[]): boolean {
  return keys.some((key) => (env[key] ?? '').trim().length > 0);
}

export function probeBookPiLedger(env: EnvLike, filesystem: FilesystemProbe): DependencyEvidence {
  const ledgerPath = (env.BOOKPI_LEDGER_PATH ?? '').trim();
  if (ledgerPath.length === 0) {
    return {
      dependency: 'bookpi-ledger',
      status: 'degraded',
      required: true,
      detail: 'In-memory SHA-256 hash chain only; events do not survive a process restart.',
    };
  }
  if (!filesystem.isWritableDirectory(ledgerPath)) {
    return {
      dependency: 'bookpi-ledger',
      status: 'unavailable',
      required: true,
      detail: 'BOOKPI_LEDGER_PATH is set but its directory is missing or not writable.',
    };
  }
  return {
    dependency: 'bookpi-ledger',
    status: 'healthy',
    required: true,
    detail: 'Durable append-only JSONL path is writable (local scope; not shared storage or WORM).',
  };
}

export function probeInferenceProvider(env: EnvLike): DependencyEvidence {
  const singleKeyConfigured = isConfigured(env, [
    'OPENROUTER_API_KEY',
    'GEMINI_API_KEY',
    'INFERENCE_API_KEY',
    'MODEL_API_KEY',
    'OLLAMA_API_KEY',
    'GROQ_API_KEY',
    'CEREBRAS_API_KEY',
    'TOGETHER_API_KEY',
    'DEEPINFRA_API_KEY',
    'FIREWORKS_API_KEY',
  ]);
  const huggingFaceConfigured =
    isConfigured(env, ['HF_TOKEN']) && isConfigured(env, ['HF_FREE_MODELS']);
  const configured = singleKeyConfigured || huggingFaceConfigured;
  return {
    dependency: 'inference-provider',
    status: configured ? 'healthy' : 'degraded',
    required: false,
    detail: configured
      ? 'At least one external provider credential is configured; reachability and quota are not verified here.'
      : 'No external provider credential configured; only the local fallback engine is available.',
  };
}

export function probeAtlasPersistence(env: EnvLike): DependencyEvidence {
  const configured = isConfigured(env, [
    'POSTGRES_URL',
    'POSTGRES_URL_NON_POOLING',
    'SUPABASE_URL',
  ]);
  return {
    dependency: 'atlas-persistence',
    status: configured ? 'healthy' : 'degraded',
    required: false,
    detail: configured
      ? 'A persistence URL is configured; a live query, RLS and multi-tenant isolation are not performed here.'
      : 'No Postgres/Supabase persistence URL configured; Atlas storage is unavailable.',
  };
}

export function probeSigningAuthority(env: EnvLike): DependencyEvidence {
  const configured = isConfigured(env, ['HYPERCORE_SIGNING_KEY', 'BOOKPI_INTEGRITY_SECRET']);
  return {
    dependency: 'signing-authority',
    status: configured ? 'healthy' : 'degraded',
    required: true,
    detail: configured
      ? 'An HMAC evidence-signing secret is configured.'
      : 'No evidence signing secret configured; sealed manifests cannot be produced.',
  };
}

export function probeObservability(env: EnvLike): DependencyEvidence {
  const configured = isConfigured(env, ['OTEL_EXPORTER_OTLP_ENDPOINT']);
  return {
    dependency: 'observability',
    status: configured ? 'healthy' : 'degraded',
    required: false,
    detail: configured
      ? 'An OTLP exporter endpoint is configured; export success is not verified here.'
      : 'No telemetry exporter configured; observability is limited to in-process metrics.',
  };
}

export function collectDependencyReadiness(
  env: EnvLike,
  filesystem: FilesystemProbe = nodeFilesystemProbe,
  now: Date = new Date()
): DependencyReadinessReport {
  const evidence: DependencyEvidence[] = [
    probeBookPiLedger(env, filesystem),
    probeInferenceProvider(env),
    probeAtlasPersistence(env),
    probeSigningAuthority(env),
    probeObservability(env),
  ];
  const dependencies: DependencyHealth[] = evidence.map((entry) => ({
    name: entry.dependency,
    status: entry.status,
    required: entry.required,
  }));
  return {
    readiness: assessProductionReadiness(dependencies, now),
    dependencies,
    evidence,
  };
}
