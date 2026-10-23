import { randomUUID } from "node:crypto";

export interface ProtocolContext {
  requestId?: string;
  traceId?: string;
  input: unknown;
}

export interface ProtocolDescriptor {
  id: string;
  version: string;
  description: string;
  execute: (context: ProtocolContext) => Promise<unknown>;
}

export class ProtocolRegistry {
  private readonly protocols = new Map<string, ProtocolDescriptor>();

  register(protocol: ProtocolDescriptor): void {
    if (this.protocols.has(protocol.id)) throw new Error(`PROTOCOLS: duplicate protocol ${protocol.id}`);
    this.protocols.set(protocol.id, Object.freeze({ ...protocol }));
  }

  get(id: string): ProtocolDescriptor {
    const protocol = this.protocols.get(id);
    if (!protocol) throw new Error(`PROTOCOLS: unknown protocol ${id}`);
    return protocol;
  }

  list(): readonly ProtocolDescriptor[] {
    return [...this.protocols.values()];
  }

  async execute(id: string, input: unknown, requestId: string = randomUUID()): Promise<unknown> {
    return this.get(id).execute({ requestId, traceId: requestId, input });
  }
}
