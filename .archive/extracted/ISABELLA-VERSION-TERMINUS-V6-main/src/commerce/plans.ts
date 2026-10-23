/** COMMERCE — planes FREE / PREMIUM / VIP / ENTERPRISE y límites operativos. */

import type { FeatureCode, PlanConfig, PlanId, QuotaKey } from "./types";

export const UNLIMITED = -1;

export const PLANS: Readonly<Record<PlanId, PlanConfig>> = {
  free: {
    id: "free",
    label: "FREE",
    description:
      "Exploración y aprendizaje: cuenta, demo, simulación y oportunidades. Sin publicación, cobro, afiliados, dashboard operativo, funnels, leads comerciales ni automatización monetizable.",
    features: [],
    quotas: {
      active_offers: 0,
      active_campaigns: 0,
      connections_per_platform: 0,
      attribution_events_per_day: 0,
      leads_per_month: 0,
      workspaces: 1,
    },
    contractRequired: false,
  },
  premium: {
    id: "premium",
    label: "PREMIUM",
    description:
      "Offers, campañas, landing pages, checkout, leads, publicación autorizada, atribución, analítica y recomendaciones.",
    features: [
      "offer",
      "campaign",
      "landing",
      "checkout",
      "lead_process",
      "publish",
      "attribution",
      "analytics",
      "recommendations",
    ],
    quotas: {
      active_offers: 3,
      active_campaigns: 5,
      connections_per_platform: 2,
      attribution_events_per_day: 1000,
      leads_per_month: 500,
      workspaces: 1,
    },
    contractRequired: false,
  },
  vip: {
    id: "vip",
    label: "VIP",
    description:
      "Incluye Premium con límites ampliados, revisión humana prioritaria, automatización programada, múltiples workspaces, soporte prioritario y controles de riesgo reforzados.",
    features: [
      "offer",
      "campaign",
      "landing",
      "checkout",
      "lead_process",
      "publish",
      "attribution",
      "analytics",
      "recommendations",
      "funnel",
      "revenue_dashboard",
      "affiliate",
      "collect_payment",
      "marketplace",
      "monetizable_automation",
      "multi_workspace",
      "scheduled_automation",
      "priority_review",
    ],
    quotas: {
      active_offers: 10,
      active_campaigns: 20,
      connections_per_platform: 5,
      attribution_events_per_day: 10000,
      leads_per_month: 5000,
      workspaces: 3,
    },
    contractRequired: false,
  },
  enterprise: {
    id: "enterprise",
    label: "ENTERPRISE",
    description:
      "Requiere contrato: SSO, SCIM, roles personalizados, aislamiento por tenant, logs exportables, retención negociada, DPA, SLA, revisión de seguridad y facturación empresarial. Límites negociados (sin límite operativo local).",
    features: [
      "offer",
      "campaign",
      "landing",
      "checkout",
      "lead_process",
      "publish",
      "attribution",
      "analytics",
      "recommendations",
      "funnel",
      "revenue_dashboard",
      "affiliate",
      "collect_payment",
      "marketplace",
      "monetizable_automation",
      "multi_workspace",
      "scheduled_automation",
      "priority_review",
    ],
    quotas: {
      active_offers: UNLIMITED,
      active_campaigns: UNLIMITED,
      connections_per_platform: UNLIMITED,
      attribution_events_per_day: UNLIMITED,
      leads_per_month: UNLIMITED,
      workspaces: UNLIMITED,
    },
    contractRequired: true,
  },
};

export const PLAN_ORDER: readonly PlanId[] = ["free", "premium", "vip", "enterprise"];

export function getPlan(plan: PlanId): PlanConfig {
  return PLANS[plan];
}

export function planIncludes(plan: PlanId | PlanConfig, feature: FeatureCode): boolean {
  const config = typeof plan === "string" ? PLANS[plan] : plan;
  return config.features.includes(feature);
}

export function quotaFor(plan: PlanId | PlanConfig, key: QuotaKey): number {
  const config = typeof plan === "string" ? PLANS[plan] : plan;
  return config.quotas[key];
}

export function planUpgradePath(plan: PlanId): readonly PlanId[] {
  const from = PLAN_ORDER.indexOf(plan);
  return PLAN_ORDER.slice(from + 1);
}

export function assertNotContractRequired(
  context: Pick<AuthContextLike, "planCode">,
): void {
  if (PLANS[context.planCode].contractRequired) {
    throw new Error("CONTRACT_REQUIRED: plan ENTERPRISE requiere configuración contractual.");
  }
}

export type AuthContextLike = { planCode: PlanId };