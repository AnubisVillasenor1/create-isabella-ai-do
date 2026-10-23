import { jsonResponse } from "@/lib/isabella/omega/core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const env = {
    modelGateway: Boolean(process.env.AI_GATEWAY_API_KEY || process.env.VERCEL),
    modelCatalogAuth: Boolean(process.env.AI_GATEWAY_API_KEY || process.env.VERCEL_OIDC_TOKEN),
    primaryModelConfigured: Boolean(process.env.AI_GATEWAY_MODEL || process.env.VERCEL),
    terminusConfigured: Boolean(process.env.ISABELLA_TERMINUS_URL && process.env.ISABELLA_TERMINUS_TOKEN),
    durableStoreConfigured: Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY),
    omegaApiGateConfigured: Boolean(process.env.ISABELLA_OMEGA_API_TOKEN),
  };

  const missing: string[] = [];
  if (!env.durableStoreConfigured) missing.push("durable_store");
  if (!env.omegaApiGateConfigured) missing.push("omega_api_auth");
  if (!env.modelGateway) missing.push("model_gateway");
  if (!env.modelCatalogAuth) missing.push("model_catalog_auth");

  return jsonResponse({
    service: "isabella-omega",
    status: missing.length === 0 ? "configured" : "degraded",
    productionReady: false,
    checks: env,
    missing,
    invariants: [
      "CAPABILITY != AUTHORITY",
      "AUTHORITY != EXECUTION",
      "EXECUTION != EVIDENCE",
      "EVIDENCE != LEARNING",
      "LEARNING != PRODUCTION",
    ],
    timestamp: new Date().toISOString(),
  });
}
