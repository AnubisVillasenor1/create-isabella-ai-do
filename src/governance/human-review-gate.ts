export interface ReviewItem {
  id: string;
  action: string;
  payload: unknown;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: number;
  resolvedAt?: number;
  approver?: string;
}

export class HumanReviewGate {
  private items = new Map<string, ReviewItem>();

  submit(action: string, payload: unknown): ReviewItem {
    const item: ReviewItem = {
      id: `review-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      action,
      payload,
      status: 'pending',
      createdAt: Date.now(),
    };
    this.items.set(item.id, item);
    return item;
  }

  approve(id: string, approver: string): ReviewItem | null {
    const item = this.items.get(id);
    if (!item || item.status !== 'pending') return null;
    item.status = 'approved';
    item.resolvedAt = Date.now();
    item.approver = approver;
    return item;
  }

  reject(id: string, approver: string): ReviewItem | null {
    const item = this.items.get(id);
    if (!item || item.status !== 'pending') return null;
    item.status = 'rejected';
    item.resolvedAt = Date.now();
    item.approver = approver;
    return item;
  }

  list(status?: ReviewItem['status']): ReviewItem[] {
    const all = [...this.items.values()];
    return status ? all.filter((i) => i.status === status) : all;
  }

  get(id: string): ReviewItem | null {
    return this.items.get(id) ?? null;
  }
}

export const humanReviewGate = new HumanReviewGate();
