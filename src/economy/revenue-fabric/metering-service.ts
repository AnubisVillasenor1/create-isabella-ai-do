/**
 * Metering Service - Usage-based billing for API, Cloud, and Agents
 * state: engine-generated
 * Part of Isabella Sovereign Revenue Fabric v4
 */

import { createHash, timingSafeEqual } from 'node:crypto';

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

export type MeteringConfig = {
  readonly aggregationWindow: 'hourly' | 'daily' | 'monthly';
  readonly retentionDays: number;
  readonly flushIntervalMs: number;
};

export type AggregatedUsage = {
  readonly userId: string;
  readonly resourceType: string;
  readonly resourceId: string;
  readonly metricName: string;
  readonly unit: string;
  readonly quantity: number;
  readonly windowStart: string;
  readonly windowEnd: string;
  readonly currency: string;
  readonly unitPrice: number;
  readonly estimatedCost: number;
};

const DEFAULT_CONFIG: MeteringConfig = {
  aggregationWindow: 'hourly',
  retentionDays: 90,
  flushIntervalMs: 60_000,
};

export class MeteringService {
  private events: Map<string, UsageEvent[]> = new Map();
  private aggregated: Map<string, AggregatedUsage[]> = new Map();
  private config: MeteringConfig;
  private flushTimer: NodeJS.Timeout | null = null;

  constructor(config: Partial<MeteringConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.startFlushTimer();
  }

  private startFlushTimer(): void {
    this.flushTimer = setInterval(() => {
      this.aggregatePendingEvents();
    }, this.config.flushIntervalMs);
  }

  stop(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
  }

  recordUsage(event: UsageEvent): { accepted: boolean; reason?: string } {
    if (!event.idempotencyKey) {
      return { accepted: false, reason: 'IDEMPOTENCY_KEY_REQUIRED' };
    }
    if (!event.userId) {
      return { accepted: false, reason: 'USER_ID_REQUIRED' };
    }
    if (event.quantity <= 0) {
      return { accepted: false, reason: 'QUANTITY_MUST_BE_POSITIVE' };
    }
    if (!Number.isFinite(event.quantity)) {
      return { accepted: false, reason: 'QUANTITY_MUST_BE_FINITE' };
    }

    const userEvents = this.events.get(event.userId) || [];

    // Check idempotency
    const existing = userEvents.find((e) => e.idempotencyKey === event.idempotencyKey);
    if (existing) {
      return { accepted: true, reason: 'DUPLICATE_ACCEPTED' };
    }

    // Validate timestamp
    const occurredAt = new Date(event.occurredAt);
    if (isNaN(occurredAt.getTime())) {
      return { accepted: false, reason: 'INVALID_TIMESTAMP' };
    }

    // Add event
    userEvents.push(event);
    this.events.set(event.userId, userEvents);

    return { accepted: true };
  }

  private aggregatePendingEvents(): void {
    for (const [userId, userEvents] of this.events.entries()) {
      const now = new Date();
      const windowStart = this.getWindowStart(now);
      const windowEnd = this.getWindowEnd(now);

      // Group by resource/metric
      const groups = new Map<string, UsageEvent[]>();
      for (const event of userEvents) {
        const key = `${event.resourceType}:${event.resourceId}:${event.metricName}:${event.unit}`;
        const group = groups.get(key) || [];
        group.push(event);
        groups.set(key, group);
      }

      for (const [key, events] of groups.entries()) {
        const parts = key.split(':');
        const resourceType = parts[0] ?? '';
        const resourceId = parts[1] ?? '';
        const metricName = parts[2] ?? '';
        const unit = parts[3] ?? '';
        const totalQuantity = events.reduce((sum, e) => sum + e.quantity, 0);

        // Get pricing (in real impl, would query pricing service)
        const { unitPrice, currency } = this.getPricing(resourceType, metricName);

        const aggregated: AggregatedUsage = {
          userId,
          resourceType,
          resourceId,
          metricName,
          unit,
          quantity: totalQuantity,
          windowStart: windowStart.toISOString(),
          windowEnd: windowEnd.toISOString(),
          currency,
          unitPrice,
          estimatedCost: totalQuantity * unitPrice,
        };

        const userAgg = this.aggregated.get(userId) || [];
        userAgg.push(aggregated);
        this.aggregated.set(userId, userAgg);
      }
    }
  }

  private getWindowStart(date: Date): Date {
    const d = new Date(date);
    if (this.config.aggregationWindow === 'hourly') {
      d.setMinutes(0, 0, 0);
    } else if (this.config.aggregationWindow === 'daily') {
      d.setHours(0, 0, 0, 0);
    } else if (this.config.aggregationWindow === 'monthly') {
      d.setDate(1);
      d.setHours(0, 0, 0, 0);
    }
    return d;
  }

  private getWindowEnd(date: Date): Date {
    const d = new Date(date);
    if (this.config.aggregationWindow === 'hourly') {
      d.setMinutes(59, 59, 999);
    } else if (this.config.aggregationWindow === 'daily') {
      d.setHours(23, 59, 59, 999);
    } else if (this.config.aggregationWindow === 'monthly') {
      d.setMonth(d.getMonth() + 1);
      d.setDate(0);
      d.setHours(23, 59, 59, 999);
    }
    return d;
  }

  private getPricing(
    resourceType: string,
    metricName: string
  ): { unitPrice: number; currency: string } {
    // Simplified pricing - in real impl would query pricing service
    const pricing: Record<string, Record<string, { unitPrice: number; currency: string }>> = {
      ISA_API: {
        tokens: { unitPrice: 0.000002, currency: 'USD' },
        requests: { unitPrice: 0.0001, currency: 'USD' },
      },
      AI_CLOUD: {
        'gpu-seconds': { unitPrice: 0.0005, currency: 'USD' },
        'cpu-seconds': { unitPrice: 0.00005, currency: 'USD' },
        'storage-gb-hours': { unitPrice: 0.00001, currency: 'USD' },
      },
      AGENT_HOSTING: {
        'agent-hours': { unitPrice: 0.01, currency: 'USD' },
      },
      SKILL_MARKETPLACE: {
        executions: { unitPrice: 0.001, currency: 'USD' },
      },
    };

    return pricing[resourceType]?.[metricName] || { unitPrice: 0, currency: 'USD' };
  }

  getUserUsage(userId: string, since?: Date): readonly AggregatedUsage[] {
    const userAgg = this.aggregated.get(userId) || [];
    if (!since) return userAgg;
    return userAgg.filter((a) => new Date(a.windowStart) >= since);
  }

  getUsageForBilling(
    userId: string,
    windowStart: Date,
    windowEnd: Date
  ): readonly AggregatedUsage[] {
    return this.getUserUsage(userId).filter((a) => {
      const start = new Date(a.windowStart);
      return start >= windowStart && start <= windowEnd;
    });
  }

  generateInvoiceData(
    userId: string,
    periodStart: Date,
    periodEnd: Date
  ): {
    readonly userId: string;
    readonly periodStart: string;
    readonly periodEnd: string;
    readonly lineItems: readonly {
      readonly resourceType: string;
      readonly resourceId: string;
      readonly metricName: string;
      readonly quantity: number;
      readonly unit: string;
      readonly unitPrice: number;
      readonly currency: string;
      readonly estimatedCost: number;
    }[];
    readonly totalEstimatedCost: number;
    readonly currency: string;
  } {
    const usage = this.getUsageForBilling(userId, periodStart, periodEnd);
    const lineItems = usage.map((u) => ({
      resourceType: u.resourceType,
      resourceId: u.resourceId,
      metricName: u.metricName,
      quantity: u.quantity,
      unit: u.unit,
      unitPrice: u.unitPrice,
      currency: u.currency,
      estimatedCost: u.estimatedCost,
    }));

    const currency = usage[0]?.currency || 'USD';
    const totalEstimatedCost = lineItems.reduce((sum, item) => sum + item.estimatedCost, 0);

    return {
      userId,
      periodStart: periodStart.toISOString(),
      periodEnd: periodEnd.toISOString(),
      lineItems,
      totalEstimatedCost,
      currency,
    };
  }
}

export const meteringService = new MeteringService();
