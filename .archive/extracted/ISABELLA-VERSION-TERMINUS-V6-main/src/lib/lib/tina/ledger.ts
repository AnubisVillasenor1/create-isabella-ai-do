/**
 * TINA BookPI hash-chain ledger (src/lib/tina/ledger.ts)
 * In-process append-only chain for TINA orchestration events.
 * Production durable ledger remains BookPI Postgres / bookpi-signer.
 */
import { sha256Hex } from "./ethical";

export interface TinaBookEvent {
  type: string;
  timestamp: string;
  payload: Record<string, unknown>;
  hash: string;
  previousHash: string | null;
}

export class TinaBookPI {
  private events: TinaBookEvent[] = [];

  async append(type: string, payload: Record<string, unknown>): Promise<TinaBookEvent> {
    const previous = this.events.at(-1)?.hash ?? null;
    const body = JSON.stringify({ type, payload, previous });
    const hash = sha256Hex(body);
    const event: TinaBookEvent = {
      type,
      timestamp: new Date().toISOString(),
      payload,
      hash,
      previousHash: previous,
    };
    this.events.push(event);
    return event;
  }

  list(): readonly TinaBookEvent[] {
    return [...this.events];
  }

  last(): TinaBookEvent | undefined {
    return this.events.at(-1);
  }

  verifyChain(): boolean {
    let prev: string | null = null;
    for (const e of this.events) {
      if (e.previousHash !== prev) return false;
      const body = JSON.stringify({ type: e.type, payload: e.payload, previous: e.previousHash });
      if (sha256Hex(body) !== e.hash) return false;
      prev = e.hash;
    }
    return true;
  }
}
