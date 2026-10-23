import { authenticateSupabaseRequest } from "@/lib/isabella/commerce-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return Response.json({ offers: [], marketplaceAvailable: false, error: "durable_store_unconfigured" }, { status: 503 });
  const query = new URLSearchParams({
    select: "id,title,description,price_cents,currency,created_at",
    status: "eq.published",
    order: "created_at.desc",
    limit: "50",
  });
  try {
    const response = await fetch(`${url.replace(/\/$/, "")}/rest/v1/isabella_creator_offers?${query}`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
      cache: "no-store",
      signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok) return Response.json({ offers: [], marketplaceAvailable: false, error: "marketplace_read_failed" }, { status: 502 });
    const rows = await response.json() as Array<{ id: string; title: string; description: string; price_cents: number; currency: string; created_at: string }>;
    return Response.json({
      marketplaceAvailable: true,
      offers: rows.map((row) => ({ id: row.id, title: row.title, description: row.description, priceCents: Number(row.price_cents), currency: row.currency, createdAt: row.created_at })),
      notice: "Las compras requieren registro. La liquidación al creador queda sujeta a elegibilidad, retenciones y futura integración de payouts.",
    }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ offers: [], marketplaceAvailable: false, error: "marketplace_unreachable" }, { status: 502 });
  }
}

export async function POST(request: Request) {
  const identity = await authenticateSupabaseRequest(request);
  if (!identity) return Response.json({ error: "authentication_required" }, { status: 401 });
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return Response.json({ error: "durable_store_unconfigured" }, { status: 503 });

  let body: Record<string, unknown>;
  try {
    const parsed: unknown = await request.json();
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return Response.json({ error: "invalid_body" }, { status: 400 });
    body = parsed as Record<string, unknown>;
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }
  const title = typeof body.title === "string" ? body.title.trim() : "";
  const description = typeof body.description === "string" ? body.description.trim() : "";
  const priceCents = body.priceCents;
  const currency = typeof body.currency === "string" ? body.currency.toUpperCase() : "USD";
  if (title.length < 3 || title.length > 120) return Response.json({ error: "title_must_be_3_to_120_characters" }, { status: 400 });
  if (description.length < 1 || description.length > 2000) return Response.json({ error: "description_must_be_1_to_2000_characters" }, { status: 400 });
  if (!Number.isSafeInteger(priceCents) || (priceCents as number) < 100 || (priceCents as number) > 100_000_000) return Response.json({ error: "price_must_be_between_100_and_100000000_cents" }, { status: 400 });
  if (currency !== "USD") return Response.json({ error: "currency_not_enabled_yet", supportedCurrencies: ["USD"] }, { status: 400 });

  const root = url.replace(/\/$/, "");
  const headers = { apikey: key, Authorization: `Bearer ${key}`, Accept: "application/json" };
  try {
    const subscriptionQuery = new URLSearchParams({
      select: "id",
      user_id: `eq.${identity.id}`,
      status: "eq.active",
      plan_id: "neq.free",
      current_period_end: `gt.${new Date().toISOString()}`,
      limit: "1",
    });
    const [subscriptionResponse, profileResponse] = await Promise.all([
      fetch(`${root}/rest/v1/isabella_commerce_subscriptions?${subscriptionQuery}`, { headers, cache: "no-store", signal: AbortSignal.timeout(8_000) }),
      fetch(`${root}/rest/v1/isabella_creator_profiles?${new URLSearchParams({ select: "status", user_id: `eq.${identity.id}`, limit: "1" })}`, { headers, cache: "no-store", signal: AbortSignal.timeout(8_000) }),
    ]);
    if (!subscriptionResponse.ok || !profileResponse.ok) return Response.json({ error: "creator_eligibility_lookup_failed" }, { status: 502 });
    const subscriptions = await subscriptionResponse.json() as unknown[];
    const profiles = await profileResponse.json() as Array<{ status: string }>;
    if (!subscriptions.length || profiles[0]?.status !== "approved") return Response.json({ error: "active_paid_subscription_and_creator_activation_required" }, { status: 403 });

    const insert = await fetch(`${root}/rest/v1/isabella_creator_offers`, {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json", Prefer: "return=representation" },
      body: JSON.stringify([{ creator_user_id: identity.id, title, description, price_cents: priceCents, currency, status: "published" }]),
      cache: "no-store",
      signal: AbortSignal.timeout(8_000),
    });
    if (!insert.ok) return Response.json({ error: "offer_creation_failed" }, { status: 502 });
    const rows = await insert.json() as Array<{ id: string; title: string; price_cents: number; currency: string; status: string }>;
    const offer = rows[0];
    return Response.json({ created: true, offer: offer ? { id: offer.id, title: offer.title, priceCents: Number(offer.price_cents), currency: offer.currency, status: offer.status } : null }, { status: 201 });
  } catch {
    return Response.json({ error: "offer_creation_unavailable", retryable: true }, { status: 502 });
  }
}
