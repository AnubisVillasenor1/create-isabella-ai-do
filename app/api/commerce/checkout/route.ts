import { randomUUID } from "node:crypto";
import { authenticateSupabaseRequest } from "@/lib/isabella/commerce-auth";
import { getMonthlyPricing } from "@/lib/isabella/commerce";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const identity = await authenticateSupabaseRequest(request);
  if (!identity) return Response.json({ error: "authentication_required" }, { status: 401 });
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  const publicUrl = process.env.ISABELLA_PUBLIC_URL;
  if (!stripeKey || !publicUrl) return Response.json({
    error: "billing_not_configured",
    message: "Configura STRIPE_SECRET_KEY e ISABELLA_PUBLIC_URL en el servidor antes de habilitar cobros.",
  }, { status: 503 });

  let base: URL;
  try {
    base = new URL(publicUrl);
    if (base.protocol !== "https:" && base.hostname !== "localhost" && base.hostname !== "127.0.0.1") throw new Error("https_required");
  } catch {
    return Response.json({ error: "invalid_public_url" }, { status: 500 });
  }

  const pricing = getMonthlyPricing();
  const form = new URLSearchParams();
  form.set("mode", "subscription");
  form.set("success_url", new URL("/?billing=success&session_id={CHECKOUT_SESSION_ID}", base).toString());
  form.set("cancel_url", new URL("/?billing=cancelled", base).toString());
  form.set("client_reference_id", identity.id);
  if (identity.email) form.set("customer_email", identity.email);
  form.set("allow_promotion_codes", "true");
  form.set("line_items[0][price_data][currency]", "usd");
  form.set("line_items[0][price_data][unit_amount]", String(pricing.monthlyCents));
  form.set("line_items[0][price_data][recurring][interval]", "month");
  form.set("line_items[0][price_data][product_data][name]", "Isabella Plus");
  form.set("line_items[0][price_data][product_data][description]", "Suscripción mensual al ecosistema Isabella");
  form.set("metadata[supabase_user_id]", identity.id);
  form.set("metadata[plan_id]", "isabella_plus");
  form.set("subscription_data[metadata][supabase_user_id]", identity.id);
  form.set("subscription_data[metadata][plan_id]", "isabella_plus");

  try {
    const response = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${stripeKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
        "Idempotency-Key": `isabella-checkout-${identity.id}-${randomUUID()}`,
      },
      body: form,
      cache: "no-store",
      signal: AbortSignal.timeout(12_000),
    });
    const data = await response.json() as { id?: string; url?: string; error?: { message?: string } };
    if (!response.ok || !data.url) return Response.json({
      error: "stripe_checkout_creation_failed",
      message: "El proveedor de pagos no pudo crear la sesión. Revisa la configuración de Stripe.",
    }, { status: 502 });
    return Response.json({ checkoutUrl: data.url, sessionId: data.id, priceCents: pricing.monthlyCents, currency: "USD" }, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return Response.json({ error: "stripe_unreachable", retryable: true }, { status: 502 });
  }
}
