/**
 * Revenue Fabric Types
 * state: engine-generated
 * Central type definitions for the Sovereign Revenue Fabric v4.
 */

export type RevenueStream =
  | 'SUBSCRIPTION'
  | 'ISA_API'
  | 'SKILL_MARKETPLACE'
  | 'AGENT_MARKETPLACE'
  | 'AGENT_HOSTING'
  | 'AI_CLOUD'
  | 'AGENT_REVENUE_SHARING'
  | 'HYPERAUTOMATION'
  | 'WHITE_LABEL'
  | 'CERTIFICATION'
  | 'DATA_VAULT'
  | 'ECOSYSTEM_TREASURY';

export type RevenueStreamConfig = {
  readonly stream: RevenueStream;
  readonly name: string;
  readonly model:
    | 'recurring'
    | 'transactional'
    | 'marketplace'
    | 'consumption'
    | 'b2b'
    | 'enterprise'
    | 'education'
    | 'data'
    | 'strategic';
  readonly baseSplit: {
    readonly user: number;
    readonly platform: number;
  };
  readonly dynamicSplit: boolean;
  readonly description: string;
};

export const REVENUE_STREAMS: readonly RevenueStreamConfig[] = [
  {
    stream: 'SUBSCRIPTION',
    name: 'Suscripciones Isabella',
    model: 'recurring',
    baseSplit: { user: 0.0, platform: 1.0 },
    dynamicSplit: false,
    description: 'Planes mensuales/anuales - 100% plataforma',
  },
  {
    stream: 'ISA_API',
    name: 'ISA API Pay-per-token',
    model: 'transactional',
    baseSplit: { user: 0.7, platform: 0.3 },
    dynamicSplit: true,
    description: 'API de terceros - Reparto dinámico por IETS',
  },
  {
    stream: 'SKILL_MARKETPLACE',
    name: 'Marketplace de Skills',
    model: 'marketplace',
    baseSplit: { user: 0.7, platform: 0.3 },
    dynamicSplit: true,
    description: 'Skills, prompts, workflows, plugins - Dinámico 50/50 a 90/10',
  },
  {
    stream: 'AGENT_MARKETPLACE',
    name: 'Marketplace de Agentes',
    model: 'marketplace',
    baseSplit: { user: 0.7, platform: 0.3 },
    dynamicSplit: true,
    description: 'Agentes publicados - Dinámico 50/50 a 90/10',
  },
  {
    stream: 'AGENT_HOSTING',
    name: 'Hosting de Agentes',
    model: 'recurring',
    baseSplit: { user: 0.0, platform: 1.0 },
    dynamicSplit: false,
    description: 'Starter / Pro / Enterprise - 100% plataforma',
  },
  {
    stream: 'AI_CLOUD',
    name: 'Sovereign AI Cloud',
    model: 'consumption',
    baseSplit: { user: 0.0, platform: 1.0 },
    dynamicSplit: false,
    description: 'GPU, CPU, inferencia, storage - Margen sobre costo',
  },
  {
    stream: 'AGENT_REVENUE_SHARING',
    name: 'Revenue Sharing de Agentes',
    model: 'recurring',
    baseSplit: { user: 0.7, platform: 0.3 },
    dynamicSplit: true,
    description: 'Ingresos generados por agentes - Dinámico por IETS',
  },
  {
    stream: 'HYPERAUTOMATION',
    name: 'Hyperautomation',
    model: 'b2b',
    baseSplit: { user: 0.75, platform: 0.25 },
    dynamicSplit: true,
    description: 'CRM, ERP, facturación, ventas - 15-25% plataforma',
  },
  {
    stream: 'WHITE_LABEL',
    name: 'White Label',
    model: 'enterprise',
    baseSplit: { user: 0.0, platform: 1.0 },
    dynamicSplit: false,
    description: 'Licencia anual - 100% plataforma',
  },
  {
    stream: 'CERTIFICATION',
    name: 'Certificaciones',
    model: 'education',
    baseSplit: { user: 0.0, platform: 1.0 },
    dynamicSplit: false,
    description: 'Exámenes y credenciales - 100% plataforma',
  },
  {
    stream: 'DATA_VAULT',
    name: 'Data Vault',
    model: 'data',
    baseSplit: { user: 0.5, platform: 0.5 },
    dynamicSplit: true,
    description: 'Datasets anonimizados - Según consentimiento y compliance',
  },
  {
    stream: 'ECOSYSTEM_TREASURY',
    name: 'Ecosystem Treasury',
    model: 'strategic',
    baseSplit: { user: 0.0, platform: 1.0 },
    dynamicSplit: false,
    description: 'Inversión, licencias, partnerships - 100% plataforma',
  },
] as const;

export function getStreamConfig(stream: RevenueStream): RevenueStreamConfig {
  const config = REVENUE_STREAMS.find((s) => s.stream === stream);
  if (!config) throw new Error(`REVENUE_STREAM_NOT_FOUND: ${stream}`);
  return config;
}

export function getDynamicSplitStreams(): RevenueStream[] {
  return REVENUE_STREAMS.filter((s) => s.dynamicSplit).map((s) => s.stream);
}

export function getStaticSplitStreams(): RevenueStream[] {
  return REVENUE_STREAMS.filter((s) => !s.dynamicSplit).map((s) => s.stream);
}

export type IETSTier = 'STARTER' | 'PROFESSIONAL' | 'ADVANCED' | 'ELITE' | 'SOVEREIGN';

export type IETSInputs = {
  readonly referrals: number;
  readonly revenue: number;
  readonly retention: number;
  readonly skills: number;
  readonly agents: number;
  readonly reputation: number;
  readonly age: number;
  readonly compliance: number;
};

export type SettlementPolicy = {
  readonly version: string;
  readonly emergencyRate: number;
  readonly innovationRate: number;
  readonly treasuryRate: number;
};

export type SettlementInputs = {
  readonly grossAmount: number;
  readonly directCost: number;
  readonly taxAmount: number;
  readonly gatewayFee: number;
  readonly ietsInputs: IETSInputs;
  readonly policy?: SettlementPolicy;
  readonly stream: RevenueStream;
  readonly currency: string;
  readonly idempotencyKey: string;
  readonly externalPaymentId?: string;
  readonly occurredAt?: string;
};

export type SettlementResult = {
  readonly idempotencyKey: string;
  readonly stream: RevenueStream;
  readonly currency: string;
  readonly grossAmount: number;
  readonly directCost: number;
  readonly taxAmount: number;
  readonly gatewayFee: number;
  readonly operatingIncome: number;
  readonly emergencyAmount: number;
  readonly innovationAmount: number;
  readonly treasuryAmount: number;
  readonly distributablePool: number;
  readonly userRate: number;
  readonly platformRate: number;
  readonly userShare: number;
  readonly platformShare: number;
  readonly ietsScore: number;
  readonly ietsTier: IETSTier;
  readonly policyVersion: string;
  readonly occurredAt: string;
  readonly externalPaymentId?: string;
};

export type LedgerAccount =
  | 'GATEWAY_CLEARING'
  | 'GROSS_REVENUE'
  | 'DIRECT_COST'
  | 'TAX_PAYABLE'
  | 'GATEWAY_FEES'
  | 'EMERGENCY_VAULT'
  | 'INNOVATION_VAULT'
  | 'TREASURY_VAULT'
  | 'CREATOR_WALLET'
  | 'PLATFORM_REVENUE';

export type LedgerDirection = 'DEBIT' | 'CREDIT';

export type LedgerPosting = {
  readonly account: LedgerAccount;
  readonly direction: LedgerDirection;
  readonly amount: number;
  readonly memo: string;
};

export type LedgerJournal = {
  readonly journalId: string;
  readonly idempotencyKey: string;
  readonly settlementId?: string;
  readonly postings: readonly LedgerPosting[];
  readonly previousHash: string;
  readonly entryHash: string;
  readonly occurredAt: string;
  readonly policyVersion: string;
};

export type UsageEvent = {
  readonly idempotencyKey: string;
  readonly userId: string;
  readonly resourceType: string;
  readonly resourceId: string;
  readonly metricName: string;
  readonly quantity: number;
  readonly unit: string;
  readonly occurredAt: string;
  readonly metadata?: Record<string, unknown>;
};

export type Wallet = {
  readonly id: string;
  readonly userId: string;
  readonly walletType: string;
  readonly currency: string;
  readonly availableBalance: number;
  readonly pendingBalance: number;
  readonly reservedBalance: number;
  readonly version: number;
};

export type TrustScore = {
  readonly id: string;
  readonly userId: string;
  readonly referralsScore: number;
  readonly revenueScore: number;
  readonly retentionScore: number;
  readonly skillsScore: number;
  readonly agentsScore: number;
  readonly reputationScore: number;
  readonly ageScore: number;
  readonly complianceScore: number;
  readonly totalScore: number;
  readonly tier: IETSTier;
  readonly policyVersion: string;
  readonly validFrom: string;
  readonly validTo?: string;
  readonly createdAt: string;
};

export type OutboxEvent = {
  readonly id: string;
  readonly aggregateType: string;
  readonly aggregateId: string;
  readonly eventType: string;
  readonly eventId: string;
  readonly payload: unknown;
  readonly status: 'PENDING' | 'PUBLISHED' | 'FAILED';
  readonly attempts: number;
  readonly createdAt: string;
  readonly publishedAt?: string;
};

export type InboxEvent = {
  readonly eventId: string;
  readonly consumerName: string;
  readonly processedAt: string;
};
