import { jsonResponse, safeTokenMatch } from "@/lib/isabella/omega/core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const supplied = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? null;
  if (!safeTokenMatch(supplied, process.env.ISABELLA_OMEGA_API_TOKEN)) {
    return jsonResponse({ error: "unauthorized" }, 401);
  }

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return jsonResponse({ error: "durable_store_unconfigured" }, 503);

  let input: Record<string, unknown>;
  try {
    const parsed: unknown = await request.json();
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return jsonResponse({ error: "invalid_body" }, 400);
    input = parsed as Record<string, unknown>;
  } catch {
    return jsonResponse({ error: "invalid_json" }, 400);
  }

  const sourceEventId = typeof input.sourceEventId === "string" ? input.sourceEventId.trim() : "";
  const creatorUserId = typeof input.creatorUserId === "string" ? input.creatorUserId.trim() : "";
  const currency = typeof input.currency === "string" ? input.currency.toUpperCase() : "USD";
  const grossCents = input.grossCents;
  if (sourceEventId.length < 8 || sourceEventId.length > 200) return jsonResponse({ error: "invalid_source_event_id" }, 400);
  if (!creatorUserId || creatorUserId.length > 160) return jsonResponse({ error: "invalid_creator_user_id" }, 400);
  if (!Number.isSafeInteger(grossCents) || (grossCents as number) <= 0 || (grossCents as number) > 100_000_000) return jsonResponse({ error: "invalid_gross_cents" }, 400);
  if (!/^[A-Z]{3}$/.test(currency)) return jsonResponse({ error: "invalid_currency" }, 400);

  // This privileged service route must only be called after a trusted payment-provider
  // webhook has been signature-verified. Client-supplied subscription status/tier are ignored.
  const metadata = input.metadata && typeof input.metadata === "object" && !Array.isArray(input.metadata)
    ? input.metadata as Record<string, unknown>
    : {};
  const safeMetadata = {
    provider: typeof metadata.provider === "string" ? metadata.provider.slice(0, 32) : "unverified-source",
    providerEventId: sourceEventId,
    settlementKind: "accrual_only",
    fundsMoved: false,
  };

  const response = await fetch(`${url.replace(/\/$/, "")}/rest/v1/rpc/record_isabella_revenue_accrual`, {
    method: "POST",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      p_source_event_id: sourceEventId,
      p_creator_user_id: creatorUserId,
      p_gross_cents: grossCents,
      p_currency: currency,
      p_metadata: safeMetadata,
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(12_000),
  });

  const result = await response.json().catch(() => null) as Record<string, unknown> | null;
  if (!response.ok) {
    const upstreamMessage = typeof result?.message === "string" ? result.message : "";
    const known = [
      "CREATOR_REQUIRES_ACTIVE_PAID_SUBSCRIPTION",
      "CREATOR_NOT_APPROVED",
      "INVALID_SOURCE_EVENT_ID",
      "INVALID_CREATOR_ID",
      "INVALID_GROSS_CENTS",
      "INVALID_CURRENCY",
    ];
    const code = known.find((item) => upstreamMessage.includes(item));
    if (code === "CREATOR_REQUIRES_ACTIVE_PAID_SUBSCRIPTION" || code === "CREATOR_NOT_APPROVED") {
      return jsonResponse({ error: code, settlementExecuted: false, fundsMoved: false }, 403);
    }
    if (code) return jsonResponse({ error: code, settlementExecuted: false, fundsMoved: false }, 400);
    return jsonResponse({ error: "revenue_accrual_persist_failed", settlementExecuted: false, fundsMoved: false }, 502);
  }

  return jsonResponse({
    result,
    settlementExecuted: true,
    fundsMoved: false,
    note: "Se registró un devengo contable. Esto no inicia transferencia, payout ni cumplimiento fiscal.",
  }, 201);
}
