// Post-deployment smoke CLI (ISA-371).
// Usage: SMOKE_BASE_URL=https://host pnpm run smoke:production
// Exits non-zero if any deployment surface fails verification.
import { verifyDeployment } from "../src/deployment/production-smoke";

const baseUrl = process.env.SMOKE_BASE_URL ?? process.env.APP_PUBLIC_URL ?? process.env.APP_BASE_URL ?? "http://localhost:3000";

const result = await verifyDeployment(baseUrl);

for (const check of result.checks) {
  const status = check.status === 0 ? "-" : String(check.status);
  console.log(`[${check.ok ? "PASS" : "FAIL"}] ${check.name} (HTTP ${status}) — ${check.detail}`);
}

console.log(result.ok ? `PRODUCTION_SMOKE_OK baseUrl=${result.baseUrl}` : `PRODUCTION_SMOKE_FAILED baseUrl=${result.baseUrl}`);
if (!result.ok) process.exit(1);
