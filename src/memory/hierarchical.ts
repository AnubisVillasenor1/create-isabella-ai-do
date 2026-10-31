export type MemoryScope = 'immediate' | 'session' | 'project' | 'territorial' | 'historical';

export interface MemoryEntry {
  scope: MemoryScope;
  key: string;
  value: unknown;
  createdAt: number;
  expiresAt: number | null;
}

export class HierarchicalMemory {
  private store = new Map<string, MemoryEntry>();

  private k(scope: MemoryScope, key: string): string {
    return `${scope}::${key}`;
  }

  set(scope: MemoryScope, key: string, value: unknown, ttlMs?: number): void {
    const now = Date.now();
    this.store.set(this.k(scope, key), {
      scope,
      key,
      value,
      createdAt: now,
      expiresAt: ttlMs ? now + ttlMs : null,
    });
  }

  get(scope: MemoryScope, key: string): MemoryEntry | null {
    const entry = this.store.get(this.k(scope, key));
    if (!entry) return null;
    if (entry.expiresAt && entry.expiresAt < Date.now()) {
      this.store.delete(this.k(scope, key));
      return null;
    }
    return entry;
  }

  list(scope?: MemoryScope): MemoryEntry[] {
    const now = Date.now();
    const out: MemoryEntry[] = [];
    for (const e of this.store.values()) {
      if (e.expiresAt && e.expiresAt < now) continue;
      if (scope && e.scope !== scope) continue;
      out.push(e);
    }
    return out;
  }

  clear(scope?: MemoryScope): void {
    if (!scope) {
      this.store.clear();
      return;
    }
    for (const [k, v] of this.store) {
      if (v.scope === scope) this.store.delete(k);
    }
  }
}

export const hierarchicalMemory = new HierarchicalMemory();
