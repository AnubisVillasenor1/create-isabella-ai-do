import { randomUUID } from "node:crypto";
import { authenticateSupabaseRequest } from "@/lib/isabella/commerce-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const identity = await authenticateSupabaseRequest(request);
  if (!identity) return Response.json({ error: "authentication_required" }, { status: 401 });
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  const publicUrl = process.env.ISABELLA_PUBLIC_URL;
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!stripeKey || !publicUrl) return Response.json({ error: "billing_not_configured" }, { status: 503 });
  if (!supabaseUrl || !serviceKey) return Response.json({ error: "durable_store_unconfigured" }, { status: 503 });

  let body: Record<string, unknown>;
  try {
    const parsed: unknown = await request.json();
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return Response.json({ error: "invalid_body" }, { status: 400 });
    body = parsed as Record<string, unknown>;
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }
  const offerId = typeof body.offerId === "string" ? body.offerId.trim() : "";
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(offerId)) {
    return Response.json({ error: "invalid_offer_id" }, { status: 400 });
  }

  let base: URL;
  try {
    base = new URL(publicUrl);
    if (base.protocol !== "https:" && base.hostname !== "localhost" && base.hostname !== "127.0.0.1") throw new Error("https_required");
  } catch {
    return Response.json({ error: "invalid_public_url" }, { status: 500 });
  }

  const root = supabaseUrl.replace(/\/$/, "");
  const headers = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, Accept: "application/json" };
  try {
    const offerQuery = new URLSearchParams({ select: "id,creator_user_id,title,description,price_cents,currency", id: `eq.${offerId}`, status: "eq.published", limit: "1" });
    const offerResponse = await fetch(`${root}/rest/v1/isabella_creator_offers?${offerQuery}`, { headers, cache: "no-store", signal: AbortSignal.timeout(8_000) });
    if (!offerResponse.ok) return Response.json({ error: "offer_lookup_failed" }, { status: 502 });
    const offers = await offerResponse.json() as Array<{ id: string; creator_user_id: string; title: string; description: string; price_cents: number; currency: string }>;
    const offer = offers[0];
    if (!offer) return Response.json({ error: "offer_not_found" }, { status: 404 });
    if (offer.creator_user_id === identity.id) return Response.json({ error: "self_purchase_not_allowed" }, { status: 400 });
    if (offer.currency !== "USD") return Response.json({ error: "currency_not_enabled_yet" }, { status: 400 });

    const creatorQuery = new URLSearchParams({ select: "id", user_id: `eq.${offer.creator_user_id}`, status: "eq.active", plan_id: "neq.free", current_period_end: `gt.${new Date().toISOString()}`, limit: "1" });
    const profileQuery = new URLSearchParams({ select: "status", user_id: `eq.${offer.creator_user_id}`, limit: "1" });
    const [subscriptionResponse, profileResponse] = await Promise.all([
      fetch(`${root}/rest/v1/isabella_commerce_subscriptions?${creatorQuery}`, { headers, cache: "no-store", signal: AbortSignal.timeout(8_000) }),
      fetch(`${root}/rest/v1/isabella_creator_profiles?${profileQuery}`, { headers, cache: "no-store", signal: AbortSignal.timeout(8_000) }),
    ]);
    if (!subscriptionResponse.ok || !profileResponse.ok) return Response.json({ error: "creator_eligibility_lookup_failed" }, { status: 502 });
    const subs = await subscriptionResponse.json() as unknown[];
    const profiles = await profileResponse.json() as Array<{ status: string }>;
    if (!subs.length || profiles[0]?.status !== "approved") return Response.json({ error: "creator_not_eligible" }, { status: 409 });

    const form = new URLSearchParams();
    form.set("mode", "payment");
    form.set("success_url", new URL("/?purchase=success&session_id={CHECKOUT_SESSION_ID}", base).toString());
    form.set("cancel_url", new URL("/?purchase=cancelled", base).toString());
    form.set("client_reference_id", identity.id);
    if (identity.email) form.set("customer_email", identity.email);
    form.set("line_items[0][price_data][currency]", offer.currency.toLowerCase());
    form.set("line_items[0][price_data][unit_amount]", String(offer.price_cents));
    form.set("line_items[0][price_data][product_data][name]", offer.title);
    form.set("line_items[0][price_data][product_data][description]", offer.description.slice(0, 500));
    form.set("metadata[isabella_marketplace]", "true");
    form.set("metadata[offer_id]", offer.id);
    form.set("metadata[creator_user_id]", offer.creator_user_id);
    form.set("metadata[buyer_user_id]", identity.id);
    form.set("payment_intent_data[metadata][isabella_marketplace]", "true");
    form.set("payment_intent_data[metadata][offer_id]", offer.id);
    form.set("payment_intent_data[metadata][creator_user_id]", offer.creator_user_id);
    form.set("payment_intent_data[metadata][buyer_user_id]", identity.id);

    const checkout = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: { Authorization: `Bearer ${stripeKey}`, "Content-Type": "application/x-www-form-urlencoded", "Idempotency-Key": `isabella-market-${identity.id}-${randomUUID()}` },
      body: form,
      cache: "no-store",
      signal: AbortSignal.timeout(12_000),
    });
    const data = await checkout.json() as { id?: string; url?: string };
    if (!checkout.ok || !data.url) return Response.json({ error: "marketplace_checkout_failed" }, { status: 502 });
    return Response.json({ checkoutUrl: data.url, sessionId: data.id, priceCents: Number(offer.price_cents), currency: offer.currency }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ error: "marketplace_checkout_unavailable", retryable: true }, { status: 502 });
  }
}
