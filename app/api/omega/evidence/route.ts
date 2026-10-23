import { createHash } from "node:crypto";
import { jsonResponse, safeTokenMatch, type EvidenceKind } from "@/lib/isabella/omega/core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const kinds = new Set<EvidenceKind>(["claim", "decision", "tool", "model", "policy", "error"]);

function authorized(request: Request) {
  const supplied = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? null;
  return safeTokenMatch(supplied, process.env.ISABELLA_OMEGA_API_TOKEN);
}

function digest(value: string) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

export async function POST(request: Request) {
  if (!authorized(request)) return jsonResponse({ error: "unauthorized" }, 401);
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
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
  const actorId = typeof body.actorId === "string" ? body.actorId.trim() : "";
  const kind = body.eventKind;
  const payload = body.payload ?? {};
  const sessionId = typeof body.sessionId === "string" ? body.sessionId : null;
  if (!tenantId || tenantId.length > 160 || !actorId || actorId.length > 160 || typeof kind !== "string" || !kinds.has(kind as EvidenceKind)) {
    return jsonResponse({ error: "invalid_event_metadata" }, 400);
  }
  const payloadText = JSON.stringify(payload);
  if (payloadText.length > 32_000) return jsonResponse({ error: "payload_too_large" }, 413);

  const payloadSha256 = digest(payloadText);
  const eventMaterial = JSON.stringify({ tenantId, actorId, sessionId, eventKind: kind, payloadSha256 });
  const eventHash = digest(eventMaterial);
  const response = await fetch(`${url.replace(/\/$/, "")}/rest/v1/isabella_omega_evidence`, {
    method: "POST",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify([{
      tenant_id: tenantId,
      session_id: sessionId,
      event_kind: kind,
      actor_id: actorId,
      payload,
      payload_sha256: payloadSha256,
      previous_hash: null,
      event_hash: eventHash,
    }]),
    cache: "no-store",
  });
  if (!response.ok) return jsonResponse({ error: "evidence_persist_failed", upstreamStatus: response.status }, 502);
  const rows = await response.json() as Array<{ id: string; created_at: string }>;
  return jsonResponse({ stored: true, event: rows[0] ?? null, payloadSha256, eventHash }, 201);
}

export async function GET(request: Request) {
  if (!authorized(request)) return jsonResponse({ error: "unauthorized" }, 401);
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return jsonResponse({ error: "durable_store_unconfigured" }, 503);
  const tenantId = new URL(request.url).searchParams.get("tenantId");
  if (!tenantId || tenantId.length > 160) return jsonResponse({ error: "tenantId_required" }, 400);
  const query = new URLSearchParams({
    select: "id,session_id,event_kind,actor_id,payload,payload_sha256,previous_hash,event_hash,created_at",
    tenant_id: `eq.${tenantId}`,
    order: "created_at.desc",
    limit: "100",
  });
  const response = await fetch(`${url.replace(/\/$/, "")}/rest/v1/isabella_omega_evidence?${query}`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
    cache: "no-store",
  });
  if (!response.ok) return jsonResponse({ error: "evidence_read_failed", upstreamStatus: response.status }, 502);
  return jsonResponse({ events: await response.json() });
}
