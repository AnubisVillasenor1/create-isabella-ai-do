import { computeRevenueSplit, type CreatorTier, type SubscriptionStatus } from "@/lib/isabella/commerce";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const tiers = new Set(["standard", "sovereign", "elite"]);
const statuses = new Set(["active", "trialing", "past_due", "canceled", "inactive"]);

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return Response.json({ error: "invalid_body" }, { status: 400 });
  }

  const input = body as Record<string, unknown>;
  if (!Number.isSafeInteger(input.grossCents) || (input.grossCents as number) < 0 || (input.grossCents as number) > 100_000_000) {
    return Response.json({ error: "grossCents_must_be_integer_cents_between_0_and_100000000" }, { status: 400 });
  }
  if (typeof input.creatorTier !== "string" || !tiers.has(input.creatorTier)) {
    return Response.json({ error: "invalid_creator_tier" }, { status: 400 });
  }
  if (typeof input.subscriptionStatus !== "string" || !statuses.has(input.subscriptionStatus)) {
    return Response.json({ error: "invalid_subscription_status" }, { status: 400 });
  }
  if (typeof input.planId !== "string" || input.planId.length > 64) {
    return Response.json({ error: "invalid_plan_id" }, { status: 400 });
  }
  if (input.currency !== undefined && (typeof input.currency !== "string" || !/^[A-Za-z]{3}$/.test(input.currency))) {
    return Response.json({ error: "invalid_currency" }, { status: 400 });
  }

  try {
    const result = computeRevenueSplit({
      grossCents: input.grossCents as number,
      currency: typeof input.currency === "string" ? input.currency : "USD",
      creatorTier: input.creatorTier as CreatorTier,
      subscriptionStatus: input.subscriptionStatus as SubscriptionStatus,
      planId: input.planId,
    });
    return Response.json({
      ...result,
      mode: "simulation",
      settlementExecuted: false,
      fundsMoved: false,
      trustBoundary: "Subscription and creator tier are caller-supplied in this preview and MUST NOT be used for payout decisions.",
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const code = error instanceof Error ? error.message : "invalid_revenue_input";
    return Response.json({ error: code }, { status: 400 });
  }
}
