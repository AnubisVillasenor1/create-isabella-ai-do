import { CREATOR_TIERS, getMonthlyPricing } from "@/lib/isabella/commerce";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const pricing = getMonthlyPricing();
  return Response.json({
    product: "Isabella Ecosystem",
    status: "catalog_preview",
    pricing,
    plans: [
      {
        id: "free",
        name: "Free",
        monthlyCents: 0,
        currency: "USD",
        monetizationEligible: false,
        features: ["Acceso básico al workspace", "Exploración de modelos y herramientas públicas"],
      },
      {
        id: "isabella_plus",
        name: "Isabella Plus",
        monthlyCents: pricing.monthlyCents,
        currency: pricing.currency,
        monetizationEligible: true,
        features: ["Workspace ampliado", "Acceso a herramientas monetizables sujetas a cuota", "Elegibilidad de creador tras activación de suscripción y revisión"],
        billingStatus: "not_connected",
      },
      {
        id: "enterprise",
        name: "Enterprise",
        monthlyCents: null,
        currency: pricing.currency,
        monetizationEligible: false,
        features: ["Contrato y propuesta personalizada", "Gobernanza y despliegue empresarial"],
      },
    ],
    creatorTiers: Object.entries(CREATOR_TIERS).map(([id, tier]) => ({
      id,
      label: tier.label,
      creatorPercent: tier.userBps / 100,
      platformPercent: tier.platformBps / 100,
    })),
    platformAllocation: {
      phoenixFundPercent: 20,
      infrastructurePercent: 30,
      daoPercent: 50,
      appliesTo: "platform_share_only",
    },
    capabilities: {
      checkout: false,
      payouts: false,
      persistentFinancialLedger: false,
      stripeConnect: Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_WEBHOOK_SECRET),
    },
    notice: "Catálogo y cálculo informativo. No se cobra, no se liquidan ingresos y no se mueven fondos desde este endpoint.",
  }, { headers: { "Cache-Control": "no-store" } });
}
