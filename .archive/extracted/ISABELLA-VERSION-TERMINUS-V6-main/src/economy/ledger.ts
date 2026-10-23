import { createHash } from "node:crypto";
import type { EconomicEvent, EconomicEventKind } from "./types";

// SCER Economic Ledger (state: draft | engine-generated).
// Libro económico append-only con encadenamiento por hash (BookPI-style). Cada
// asiento enlaza el hash del anterior; `verifyIntegrity()` re-deriva la cadena y
// detecta cualquier manipulación. Registrar NO mueve fondos (fundsMoved=false).

function canonicalize(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).sort();
  return `{${keys.map((key) => `${JSON.stringify(key)}:${canonicalize(record[key])}`).join(",")}}`;
}

function sha256(input: string): string {
  return createHash("sha256").update(input, "utf8").digest("hex");
}

export interface AppendEconomicEvent {
  readonly kind: EconomicEventKind;
  readonly payload: unknown;
  readonly occurredAt?: string;
  readonly id?: string;
}

export class EconomicLedger {
  private readonly events: EconomicEvent[] = [];
  private readonly clock: () => string;

  constructor(clock: () => string = () => new Date().toISOString()) {
    this.clock = clock;
  }

  private digest(entry: Omit<EconomicEvent, "hash">): string {
    return sha256(
      `${entry.previousHash}\n${entry.sequence}\n${entry.id}\n${entry.kind}\n${entry.occurredAt}\n${entry.payloadHash}`,
    );
  }

  append(input: AppendEconomicEvent): EconomicEvent {
    const previous = this.events[this.events.length - 1];
    const previousHash = previous ? previous.hash : "GENESIS";
    const occurredAt = input.occurredAt ?? this.clock();
    const payloadHash = sha256(canonicalize(input.payload));
    const sequence = this.events.length;
    const id = input.id ?? `eco-${sequence}-${payloadHash.slice(0, 12)}`;

    const draft: Omit<EconomicEvent, "hash"> = {
      sequence,
      id,
      kind: input.kind,
      occurredAt,
      payloadHash,
      previousHash,
    };
    const event: EconomicEvent = { ...draft, hash: this.digest(draft) };
    this.events.push(event);
    return event;
  }

  entries(): readonly EconomicEvent[] {
    return [...this.events];
  }

  head(): EconomicEvent | null {
    return this.events[this.events.length - 1] ?? null;
  }

  size(): number {
    return this.events.length;
  }

  verifyIntegrity(): boolean {
    let previousHash = "GENESIS";
    for (const event of this.events) {
      if (event.previousHash !== previousHash) return false;
      const expected = this.digest({
        sequence: event.sequence,
        id: event.id,
        kind: event.kind,
        occurredAt: event.occurredAt,
        payloadHash: event.payloadHash,
        previousHash: event.previousHash,
      });
      if (expected !== event.hash) return false;
      previousHash = event.hash;
    }
    return true;
  }
}
