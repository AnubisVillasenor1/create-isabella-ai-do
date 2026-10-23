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

  if (!["customer.subscription.created", "customer.subscription.updated", "customer.subscription.deleted"].includes(eventType)) {
    return Response.json({ received: true, ignored: true, eventType });
  }

  const data = event.data && typeof event.data === "object" ? event.data as Record<string, unknown> : {};
  const subscription = data.object && typeof data.object === "object" ? data.object as Record<string, unknown> : {};
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
