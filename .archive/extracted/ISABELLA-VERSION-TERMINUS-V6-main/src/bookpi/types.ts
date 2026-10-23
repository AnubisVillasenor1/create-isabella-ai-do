export type JsonValue =
  | null
  | boolean
  | number
  | string
  | JsonValue[]
  | { [key: string]: JsonValue };

export const BOOKPI_PROTOCOL = "tamv-federation-v1" as const;

/** Structurally assignable a `{ [key: string]: JsonValue }` (alias, no interface). */
export type HeHePContext = {
  hexagon: string;
  domain: string;
};

/** Structurally assignable a `{ [key: string]: JsonValue }` (alias, no interface). */
export type BookPiHeader = {
  type: string;
  source: string;
  protocol: typeof BOOKPI_PROTOCOL;
  hehepcontext: HeHePContext;
};

export type BookPiEventMeta = Record<string, JsonValue>;

export interface BookPiEventSeed {
  header: BookPiHeader;
  payload: JsonValue;
  schemaVersion: string;
  meta?: BookPiEventMeta;
}

export interface BookPiEventContext {
  sequence: number;
  prevHash: string;
  timestamp: string;
  actorId?: string;
  secret?: string;
}

export interface BookPiEventRecord {
  type: string;
  id: string;
  sequence: number;
  prevHash: string;
  timestamp: string;
  integrity: string;
  hash: string;
  canonical: string;
  actorId?: string;
  header: BookPiHeader;
  payload: JsonValue;
  schemaVersion: string;
  meta: BookPiEventMeta;
}

/** Núcleo del evento previo al sellado (sin hash/integrity/canonical). */
export type BookPiEventCore = Omit<BookPiEventRecord, "integrity" | "hash" | "canonical">;

export interface BookPiSeed {
  type: string;
  id: string;
  sequence: number;
  prevHash: string;
  timestamp: string;
  actorId?: string;
  header: BookPiHeader;
  payload: JsonValue;
  schemaVersion: string;
  meta: BookPiEventMeta;
}

export type BookPiChainLink = {
  hash: string;
  previous: BookPiChainLink | null;
};

export interface BookPiStorage {
  getLastEvent(): Promise<BookPiEventRecord | null>;
  appendEvent(seed: BookPiEventSeed, ctx?: Partial<BookPiEventContext>): Promise<BookPiEventRecord>;
  listEvents(): Promise<BookPiEventRecord[]>;
  verifyChain(opts?: { secret?: string }): Promise<{
    valid: boolean;
    count: number;
    failures: string[];
  }>;
}