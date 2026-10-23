import { createHash } from "node:crypto";
import { jsonResponse, safeTokenMatch } from "@/lib/isabella/omega/core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function digest(value: string) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function authorized(request: Request) {
  const supplied = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? null;
  return safeTokenMatch(supplied, process.env.ISABELLA_OMEGA_API_TOKEN);
}

function config() {
  return {
    url: process.env.SUPABASE_URL?.replace(/\/$/, ""),
    key: process.env.SUPABASE_SERVICE_ROLE_KEY,
  };
}

export async function GET(request: Request) {
  if (!authorized(request)) return jsonResponse({ error: "unauthorized" }, 401);
  const { url, key } = config();
  if (!url || !key) return jsonResponse({ error: "durable_store_unconfigured" }, 503);
  const params = new URL(request.url).searchParams;
  const tenantId = params.get("tenantId");
  const ownerId = params.get("ownerId");
  if (!tenantId || !ownerId || tenantId.length > 160 || ownerId.length > 160) {
    return jsonResponse({ error: "tenantId_and_ownerId_required" }, 400);
  }
  const query = new URLSearchParams({
    select: "id,memory_key,content,content_sha256,sensitivity,expires_at,created_at,updated_at",
    tenant_id: `eq.${tenantId}`,
    owner_id: `eq.${ownerId}`,
    order: "updated_at.desc",
    limit: "100",
  });
  const response = await fetch(`${url}/rest/v1/isabella_omega_memory?${query}`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
    cache: "no-store",
  });
  if (!response.ok) return jsonResponse({ error: "memory_read_failed", upstreamStatus: response.status }, 502);
  return jsonResponse({ memories: await response.json() });
}

export async function POST(request: Request) {
  if (!authorized(request)) return jsonResponse({ error: "unauthorized" }, 401);
  const { url, key } = config();
  if (!url || !key) return jsonResponse({ error: "durable_store_unconfigured" }, 503);
  let body: Record<string, unknown>;
  try {
    const parsed: unknown = await request.json();
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return jsonResponse({ error: "invalid_body" }, 400);
    body = parsed as Record<string, unknown>;
  } catch {
    return jsonResponse({ error: "invalid_json" }, 400);
  }
  const tenantId = typeof body.tenantId === "string" ? body.tenantId.trim() : "";
  const ownerId = typeof body.ownerId === "string" ? body.ownerId.trim() : "";
  const memoryKey = typeof body.key === "string" ? body.key.trim() : "";
  const sensitivity = typeof body.sensitivity === "string" ? body.sensitivity : "internal";
  const content = body.content;
  if (!tenantId || !ownerId || !memoryKey || tenantId.length > 160 || ownerId.length > 160 || memoryKey.length > 200) {
    return jsonResponse({ error: "invalid_memory_identity" }, 400);
  }
  if (!["public", "internal", "confidential", "restricted"].includes(sensitivity)) return jsonResponse({ error: "invalid_sensitivity" }, 400);
  const contentText = JSON.stringify(content);
  if (contentText.length > 24_000) return jsonResponse({ error: "content_too_large" }, 413);
  const contentSha256 = digest(contentText);
  const response = await fetch(`${url}/rest/v1/isabella_omega_memory?on_conflict=tenant_id,owner_id,memory_key`, {
    method: "POST",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates,return=representation",
    },
    body: JSON.stringify([{
      tenant_id: tenantId,
      owner_id: ownerId,
      memory_key: memoryKey,
      content,
      content_sha256: contentSha256,
      sensitivity,
      updated_at: new Date().toISOString(),
    }]),
    cache: "no-store",
  });
  if (!response.ok) return jsonResponse({ error: "memory_persist_failed", upstreamStatus: response.status }, 502);
  return jsonResponse({ stored: true, contentSha256, memory: (await response.json() as unknown[])[0] ?? null }, 201);
}
