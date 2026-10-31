// state: draft | engine-generated
// Read-only local runtime probes. No credentials, external provider calls or state writes.
import { readFileSync, writeFileSync } from 'node:fs';
import { generateControls, controlSummary } from '../src/evolution/catalog';
import { PLATFORM_GIFTS } from '../src/platform';
import { handleNetlifyRequest } from '../src/http/netlify-handler';

const paths = [
  '/',
  '/health',
  '/api/v1/health',
  '/api/v1/healthz',
  '/api/v1/runtime/capabilities',
  '/api/v1/yun/events',
  '/api/v1/reina/status',
  '/api/v1/integrations/graph',
  '/api/v1/platform/capabilities',
  '/api/v1/revenue/health',
  '/healthz',
  '/readyz',
  '/status',
  '/metrics',
];
const probes: { path: string; status: number; contentType: string | null; evidence: unknown }[] =
  [];
for (const path of paths) {
  try {
    const response = await handleNetlifyRequest(new Request(`http://localhost${path}`));
    const contentType = response.headers.get('content-type');
    const body = contentType?.includes('application/json')
      ? ((await response.json()) as Record<string, unknown>)
      : null;
    // Explicit allowlist: no arbitrary response fields or environment contents are persisted.
    const evidence = body
      ? {
          responseKeys: Object.keys(body),
          ...(typeof body.status === 'string' ? { status: body.status } : {}),
          ...(typeof body.scope === 'string' ? { scope: body.scope } : {}),
          ...(typeof body.success === 'boolean' ? { success: body.success } : {}),
          ...(typeof body.count === 'number' ? { count: body.count } : {}),
          ...(Array.isArray(body.evidence)
            ? {
                dependencyStates: body.evidence.map((entry: Record<string, unknown>) => ({
                  name: entry.name ?? entry.dependency,
                  status: entry.status,
                  required: entry.required,
                })),
              }
            : {}),
        }
      : { bodyNotRecorded: true };
    probes.push({ path, status: response.status, contentType, evidence });
  } catch {
    probes.push({ path, status: 0, contentType: null, evidence: { error: 'LOCAL_PROBE_FAILED' } });
  }
}
const report = {
  state: 'draft',
  authorship: 'engine-generated',
  generatedAt: new Date().toISOString(),
  scope: 'local in-process Netlify HTTP adapter; not the published deployment',
  catalogEvidence: {
    controls: controlSummary(generateControls()),
    platformEntries: PLATFORM_GIFTS.length,
    platformHttpCountInSource: (() => {
      const source = readFileSync('src/server.ts', 'utf8');
      const match = source.match(
        /app\.get\("\/api\/v1\/platform\/capabilities"[\s\S]*?count:\s*(\d+)/
      );
      return match ? Number(match[1]) : null;
    })(),
  },
  probes,
};
writeFileSync(
  'docs/audits/SONDEO-OPERATIVO-2026-10-24.json',
  JSON.stringify(report, null, 2) + '\n'
);
console.log(JSON.stringify(report, null, 2));

// The imported runtime owns recurring maintenance timers; this diagnostic is a finite job.
process.exit(0);
