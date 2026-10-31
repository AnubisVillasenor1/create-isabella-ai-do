import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  // 8080 is the contract shared by the Dockerfile, docker-compose and k8s manifests.
  PORT: z.coerce.number().int().min(1).max(65535).default(8080),
  HOST: z.string().default('0.0.0.0'),
  DATABASE_URL: z.string().min(1).optional(),
  REDIS_URL: z.string().min(1).optional(),
  GENESIS_ADMIN_API_TOKEN: z.string().min(1).optional(),
  GENESIS_HUMAN_APPROVAL_TOKEN: z.string().min(1).optional(),
  GENESIS_HUMAN_APPROVER_ID: z.string().min(1).optional(),
  BOOKPI_LEDGER_PATH: z.string().min(1).optional(),
  GAMEOVER_PASSPORT_PATH: z.string().min(1).optional(),
  STRICT_PREFLIGHT: z.string().optional(),
  APP_PUBLIC_URL: z.string().url().optional(),
  ALLOWED_ORIGINS: z.string().default('http://localhost:8080'),
});

export type AppConfig = z.infer<typeof envSchema>;

export interface PidConfig {
  identifiers?: {
    orcid?: string;
    zenodoDoi?: string;
    dataCiteDoi?: string;
    isni?: string;
  };
  strict?: boolean;
  expected?: { namespace?: string };
}

export const config: PidConfig = {
  identifiers: {
    orcid: process.env.ORCID_ID ?? '0009-0008-5050-1539',
    zenodoDoi: process.env.ZENODO_DOI ?? '10.5281/zenodo.20606361',
    dataCiteDoi: process.env.DATACITE_DOI,
    isni: process.env.ISNI ?? '0000 0005 3169 9229',
  },
  strict: process.env.PID_STRICT === '1',
  expected: { namespace: process.env.PID_NAMESPACE ?? 'tamv' },
};

export function loadConfig(env: Record<string, string | undefined> = process.env): AppConfig {
  const parsed = envSchema.safeParse(env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `${i.path.join('.') || 'env'}: ${i.message}`)
      .join('; ');
    throw new Error(`CONFIG_INVALID: ${issues}`);
  }

  const config = parsed.data;

  if (config.NODE_ENV === 'production') {
    const required = [
      'DATABASE_URL',
      'GENESIS_ADMIN_API_TOKEN',
      'GENESIS_HUMAN_APPROVAL_TOKEN',
      'GENESIS_HUMAN_APPROVER_ID',
    ];

    const missing = required.filter((key) => !env[key] || env[key]!.trim().length === 0);
    if (missing.length > 0) {
      throw new Error(`CONFIG_MISSING_PRODUCTION: ${missing.join(', ')}`);
    }

    if (!config.DATABASE_URL) {
      throw new Error('CONFIG_PRODUCTION_REQUIRES_DATABASE');
    }
  }

  return config;
}

export function isProduction(env: Record<string, string | undefined> = process.env): boolean {
  return env.NODE_ENV === 'production';
}
