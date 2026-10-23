import { createHmac, timingSafeEqual } from "node:crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function verifyStripeSignature(raw: string, signature: string, secret: string): boolean {
  const parts = signature.split(",").map((part) => part.trim().split("=", 2));
  const timestamp = parts.find(([key]) => key === "t")?.[1];
  const signatures = parts.filter(([key]) => key === "v1").map(([, value]) => value);
  if (!timestamp || !/^\d+$/.test(timestamp) || signatures.length === 0) return false;
  const seconds = Number(timestamp);
  if (!Number.isSafeInteger(seconds) || Math.abs(Date.now() / 1000 - seconds) > 300) return false;
  const expected = createHmac("sha256", secret).update(`${timestamp}.${raw}`, "utf8").digest();
  return signatures.some((candidate) => {
    if (!/^[a-f0-9]{64}$/i.test(candidate)) return false;
    const supplied = Buffer.from(candidate, "hex");
    return supplied.length === expected.length && timingSafeEqual(supplied, expected);
  });
}

function normalizeStatus(status: unknown): "active" | "trialing" | "past_due" | "canceled" | "inactive" {
  if (status === "active") return "active";
  if (status === "trialing") return "trialing";
  if (status === "past_due" || status === "unpaid") return "past_due";
  if (status === "canceled" || status === "incomplete_expired") return "canceled";
  return "inactive";
}

export async function POST(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const stripeSignature = request.headers.get("stripe-signature");
  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret || !stripeSignature) return Response.json({ error: "stripe_webhook_not_configured" }, { status: 503 });
  if (!url || !serviceKey) return Response.json({ error: "durable_store_unconfigured" }, { status: 503 });

  const raw = await request.text();
  if (new TextEncoder().encode(raw).byteLength > 1_000_000) return Response.json({ error: "payload_too_large" }, { status: 413 });
  if (!verifyStripeSignature(raw, stripeSignature, secret)) return Response.json({ error: "invalid_stripe_signature" }, { status: 400 });

  let event: Record<string, unknown>;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("invalid_event");
    event = parsed as Record<string, unknown>;
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }

  const eventType = typeof event.type === "string" ? event.type : "";
  const eventId = typeof event.id === "string" ? event.id : "";
  const eventCreated = event.created;
  if (!eventId || eventId.length > 200 || !Number.isSafeInteger(eventCreated) || (eventCreated as number) < 1) {
    return Response.json({ error: "invalid_stripe_event_metadata" }, { status: 400 });
  }

  const data = event.data && typeof event.data === "object" ? event.data as Record<string, unknown> : {};
  const object = data.object && typeof data.object === "object" ? data.object as Record<string, unknown> : {};

  if (eventType === "checkout.session.completed") {
    const metadata = object.metadata && typeof object.metadata === "object" ? object.metadata as Record<string, unknown> : {};
    if (object.mode !== "payment" || object.payment_status !== "paid" || metadata.isabella_marketplace !== "true") {
      return Response.json({ received: true, ignored: true, eventType });
    }

    const offerId = typeof metadata.offer_id === "string" ? metadata.offer_id : "";
    const creatorUserId = typeof metadata.creator_user_id === "string" ? metadata.creator_user_id : "";
    const buyerUserId = typeof metadata.buyer_user_id === "string" ? metadata.buyer_user_id : "";
    const sessionId = typeof object.id === "string" ? object.id : "";
    const grossCents = object.amount_total;
    const currency = typeof object.currency === "string" ? object.currency.toUpperCase() : "";
    if (!offerId || !creatorUserId || !buyerUserId || !sessionId || !Number.isSafeInteger(grossCents) || (grossCents as number) <= 0 || !/^[A-Z]{3}$/.test(currency)) {
      return Response.json({ error: "marketplace_checkout_metadata_invalid" }, { status: 400 });
    }

    try {
      const root = url.replace(/\/$/, "");
      const headers = { apikey: serviceKey, Authorization: "Bearer " + serviceKey, Accept: "application/json" };
      const offerQuery = new URLSearchParams({ select: "id,creator_user_id", id: "eq." + offerId, limit: "1" });
      const offerResponse = await fetch(root + "/rest/v1/isabella_creator_offers?" + offerQuery, { headers, cache: "no-store", signal: AbortSignal.timeout(8_000) });
      if (!offerResponse.ok) return Response.json({ error: "marketplace_offer_verification_failed" }, { status: 502 });
      const offers = await offerResponse.json() as Array<{ id: string; creator_user_id: string }>;
      if (!offers[0] || offers[0].creator_user_id !== creatorUserId) {
        return Response.json({ error: "marketplace_offer_owner_mismatch" }, { status: 400 });
      }

      const accrualResponse = await fetch(root + "/rest/v1/rpc/record_isabella_revenue_accrual", {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({
          p_source_event_id: "stripe-checkout-" + sessionId,
          p_creator_user_id: creatorUserId,
          p_gross_cents: grossCents,
          p_currency: currency,
          p_metadata: { provider: "stripe", providerEventId: eventId, offerId, checkoutSessionId: sessionId, buyerUserId },
        }),
        cache: "no-store",
        signal: AbortSignal.timeout(12_000),
      });
      let revenueRunId: string | null = null;
      let reviewRequired = false;
      if (accrualResponse.ok) {
        const accrual = await accrualResponse.json() as { run?: { id?: string } };
        revenueRunId = typeof accrual.run?.id === "string" ? accrual.run.id : null;
      } else {
        const failure = await accrualResponse.json().catch(() => null) as { message?: string } | null;
        if (failure?.message?.includes("CREATOR_REQUIRES_ACTIVE_PAID_SUBSCRIPTION") || failure?.message?.includes("CREATOR_NOT_APPROVED")) {
          reviewRequired = true;
        } else {
          return Response.json({ error: "marketplace_accrual_failed", retryable: true }, { status: 502 });
        }
      }

      const orderResponse = await fetch(root + "/rest/v1/isabella_marketplace_orders?on_conflict=checkout_session_id", {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json", Prefer: "resolution=merge-duplicates,return=representation" },
        body: JSON.stringify([{
          checkout_session_id: sessionId,
          source_event_id: eventId,
          offer_id: offerId,
          buyer_user_id: buyerUserId,
          creator_user_id: creatorUserId,
          gross_cents: grossCents,
          currency,
          revenue_run_id: revenueRunId,
          payment_status: "paid",
          review_required: reviewRequired,
        }]),
        cache: "no-store",
        signal: AbortSignal.timeout(12_000),
      });
      if (!orderResponse.ok) return Response.json({ error: "marketplace_order_persist_failed", retryable: true }, { status: 502 });
      return Response.json({
        received: true,
        marketplacePurchaseRecorded: true,
        revenueAccrued: Boolean(revenueRunId),
        reviewRequired,
        fundsMoved: false,
        note: "Stripe confirmó el pago; el reparto es un devengo contable y no una transferencia al creador.",
      }, { headers: { "Cache-Control": "no-store" } });
    } catch {
      return Response.json({ error: "marketplace_webhook_processing_failed", retryable: true }, { status: 502 });
    }
  }

  if (!["customer.subscription.created", "customer.subscription.updated", "customer.subscription.deleted"].includes(eventType)) {
    return Response.json({ received: true, ignored: true, eventType });
  }

  const subscription = object;
  const metadata = subscription.metadata && typeof subscription.metadata === "object"
    ? subscription.metadata as Record<string, unknown>
    : {};
  const userId = typeof metadata.supabase_user_id === "string" ? metadata.supabase_user_id : "";
  const planId = typeof metadata.plan_id === "string" ? metadata.plan_id : "";
  const subscriptionId = typeof subscription.id === "string" ? subscription.id : "";
  const customerId = typeof subscription.customer === "string" ? subscription.customer : "";
  const periodEnd = typeof subscription.current_period_end === "number" ? new Date(subscription.current_period_end * 1000).toISOString() : null;
  const status = normalizeStatus(subscription.status);

  if (!userId || userId.length > 160 || !["isabella_plus", "enterprise"].includes(planId) || !subscriptionId) {
    return Response.json({ error: "subscription_metadata_missing_or_invalid" }, { status: 400 });
  }

  try {
    const response = await fetch(`${url.replace(/\/$/, "")}/rest/v1/rpc/apply_isabella_stripe_subscription_event`, {
      method: "POST",
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        p_event_id: eventId,
        p_event_type: eventType,
        p_event_created: eventCreated,
        p_user_id: userId,
        p_plan_id: planId,
        p_subscription_id: subscriptionId,
        p_customer_id: customerId || null,
        p_status: status,
        p_period_end: periodEnd,
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(12_000),
    });
    if (!response.ok) return Response.json({ error: "subscription_event_persist_failed" }, { status: 502 });
    const result = await response.json();
    return Response.json({ received: true, result, fundsMoved: false }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ error: "subscription_event_processing_failed", retryable: true }, { status: 502 });
  }
}
