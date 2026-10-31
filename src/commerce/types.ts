/** COMMERCE — planos comerciales gobernados (canon v40, prototipo final empresarial). */

export type PlanId = 'free' | 'premium' | 'vip' | 'enterprise';

export type CommerceRiskLevel = 'low' | 'medium' | 'high' | 'critical';

export type WorkspaceRole = 'owner' | 'admin' | 'operator' | 'viewer';

export type SubscriptionStatus = 'active' | 'trialing' | 'past_due' | 'canceled' | 'suspended';

export interface AuthContext {
  userId: string;
  workspaceId: string;
  role: WorkspaceRole;
  planCode: PlanId;
  subscriptionStatus: SubscriptionStatus;
  riskLevel: CommerceRiskLevel;
  scopes: readonly string[];
  requestId: string;
}

export type FeatureCode =
  | 'publish'
  | 'collect_payment'
  | 'affiliate'
  | 'revenue_dashboard'
  | 'funnel'
  | 'lead_process'
  | 'marketplace'
  | 'monetizable_automation'
  | 'offer'
  | 'campaign'
  | 'landing'
  | 'checkout'
  | 'attribution'
  | 'analytics'
  | 'recommendations'
  | 'multi_workspace'
  | 'scheduled_automation'
  | 'priority_review';

export type QuotaKey =
  | 'active_offers'
  | 'active_campaigns'
  | 'connections_per_platform'
  | 'attribution_events_per_day'
  | 'leads_per_month'
  | 'workspaces';

export interface PlanConfig {
  id: PlanId;
  label: string;
  description: string;
  features: readonly FeatureCode[];
  quotas: Readonly<Record<QuotaKey, number>>;
  contractRequired: boolean;
}

export interface LockVerdict {
  locked: boolean;
  code: string;
  message: string;
  action: string;
  retryable: boolean;
  requiresHumanReview: boolean;
}

export interface RevenueSummary {
  grossConfirmed: number;
  fees: number;
  refunds: number;
  variableCost: number;
  netConfirmed: number;
  currency: string;
  updatedAt: string;
}

export type CommerceConfidenceLevel = 'low' | 'medium' | 'high';

export interface RevenueMetric {
  name: string;
  value: number;
  observations: number;
  confidence: CommerceConfidenceLevel;
  partialAttribution: boolean;
  updatedAt: string;
}

export type FraudCategory = 'identity' | 'device' | 'revenue' | 'affiliate' | 'lead';

export interface FraudSignal {
  category: FraudCategory;
  name: string;
  weight: number;
  detail: string;
}

export type FraudDecision = 'allow' | 'review' | 'block';

export interface FraudVerdict {
  level: CommerceRiskLevel;
  decision: FraudDecision;
  signals: readonly FraudSignal[];
  reviewedAt: string;
}
