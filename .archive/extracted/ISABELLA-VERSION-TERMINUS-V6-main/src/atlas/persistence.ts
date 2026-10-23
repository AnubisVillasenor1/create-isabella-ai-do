import { randomUUID } from "node:crypto";
import type {
  AtlasProtocolExecution,
  AtlasSignalRow,
  AtlasUser,
  AtlasXrEventRow,
  CreateSignalInput,
  CreateUserInput,
  LedgerEntry,
  RecordEconomyEntryInput,
  RecordProtocolExecutionInput,
} from "./types";

export type AtlasStoreConfig = {
  supabaseUrl: string;
  supabaseServiceRoleKey: string;
  requestTimeoutMs?: number;
};

type AtlasUserRow = {
  id: string;
  handle: string;
  display_name: string;
  created_at: string;
};

type AtlasProtocolExecutionRow = {
  id: string;
  protocol_id: string;
  actor_id: string;
  selected_path: unknown;
  evaluated_paths: unknown;
  collapsed_at: string;
};

type AtlasLedgerRow = {
  id: string;
  user_id: string;
  amount: number;
  reason: string;
  kind: "credit" | "debit";
  created_at?: string;
};

type XrEventListener = (event: AtlasXrEventRow) => void;
type SignalListener = (signal: AtlasSignalRow) => void;

async function supabaseRequest<T>(
  config: AtlasStoreConfig,
  path: string,
  options: {
    method?: "GET" | "POST" | "PATCH" | "DELETE";
    body?: unknown;
  } = {},
): Promise<T> {
  const timeoutMs = config.requestTimeoutMs ?? 10_000;
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    throw new Error("AtlasStore requiere requestTimeoutMs > 0");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const url = `${config.supabaseUrl.replace(/\/+$/, "")}/rest/v1/${path}`;
    const response = await fetch(url, {
      method: options.method ?? "GET",
      headers: {
        apikey: config.supabaseServiceRoleKey,
        authorization: `Bearer ${config.supabaseServiceRoleKey}`,
        "content-type": "application/json",
        prefer: "return=representation",
      },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: controller.signal,
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      throw new Error(
        `Supabase REST error ${response.status}: ${detail || response.statusText}`,
      );
    }

    if (response.status === 204) return [] as unknown as T;
    return (await response.json()) as T;
  } finally {
    clearTimeout(timeout);
  }
}

export interface AtlasPersistencePort {
  init?(): Promise<void>;
  /** Read-only provider probe. Returns true only after a successful database query. */
  health?(): Promise<boolean>;
  createUser(input: CreateUserInput): Promise<AtlasUser>;
  listUsers(): Promise<AtlasUser[]>;
  recordProtocolExecution(input: RecordProtocolExecutionInput): Promise<AtlasProtocolExecution>;
  recordEconomyEntry(input: RecordEconomyEntryInput): Promise<LedgerEntry>;
  publishXrEvent(eventType: string, payload: unknown): Promise<AtlasXrEventRow>;
  onXrEvent(listener: XrEventListener): () => void;
  createSignal(input: CreateSignalInput): Promise<AtlasSignalRow>;
  onSignal(listener: SignalListener): () => void;
}

export function createAtlasStoreFromEnv(env: NodeJS.ProcessEnv = process.env): AtlasStore {
  const supabaseUrl = env.SUPABASE_URL?.trim();
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  const rawTimeout = env.ATLAS_STORE_TIMEOUT_MS?.trim();
  const requestTimeoutMs = rawTimeout ? Number(rawTimeout) : undefined;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("AtlasStore requiere SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY");
  }
  if (rawTimeout && (requestTimeoutMs === undefined || !Number.isFinite(requestTimeoutMs) || requestTimeoutMs <= 0)) {
    throw new Error("ATLAS_STORE_TIMEOUT_MS debe ser un número mayor que cero");
  }

  return new AtlasStore({ supabaseUrl, supabaseServiceRoleKey: serviceRoleKey, requestTimeoutMs });
}

export class AtlasStore implements AtlasPersistencePort {
  private readonly config: AtlasStoreConfig;
  private readonly xrListeners = new Set<XrEventListener>();
  private readonly signalingListeners = new Set<SignalListener>();

  constructor(config: AtlasStoreConfig) {
    const url = config.supabaseUrl.trim();
    const key = config.supabaseServiceRoleKey.trim();
    if (!url || !key) {
      throw new Error("AtlasStore requiere SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY");
    }
    this.config = { ...config, supabaseUrl: url, supabaseServiceRoleKey: key };
  }

  async init(): Promise<void> {
    // Reserved for controlled warmup or migrations; readiness uses health().
  }

  async health(): Promise<boolean> {
    // Read-only probe with a bounded timeout; never mutates application data.
    const configuredTimeout = this.config.requestTimeoutMs ?? 10_000;
    const probeConfig = { ...this.config, requestTimeoutMs: Math.min(configuredTimeout, 2_000) };
    const rows = await supabaseRequest<unknown[]>(probeConfig, "atlas_users?select=id&limit=1");
    return Array.isArray(rows);
  }

  async createUser(input: CreateUserInput): Promise<AtlasUser> {
    const handle = input.handle?.trim();
    const displayName = input.displayName?.trim();
    if (!handle || !displayName) {
      throw new Error("AtlasStore::createUser requiere handle y displayName");
    }

    const rows = await supabaseRequest<AtlasUserRow[]>(this.config, "atlas_users", {
      method: "POST",
      body: [{ id: randomUUID(), handle, display_name: displayName }],
    });
    const row = rows[0];
    if (!row) throw new Error("AtlasStore::createUser no devolvió ninguna fila");

    return {
      id: row.id,
      handle: row.handle,
      displayName: row.display_name,
      roles: ["citizen"],
      memberships: ["free"],
      he_hep_context: input.he_hep_context ?? { hexagon: "HE-Identity", domain: "HEP-1" },
      createdAt: row.created_at,
    };
  }

  async listUsers(): Promise<AtlasUser[]> {
    const rows = await supabaseRequest<AtlasUserRow[]>(
      this.config,
      "atlas_users?select=id,handle,display_name,created_at&order=created_at.desc&limit=500",
    );
    return rows.map((row) => ({
      id: row.id,
      handle: row.handle,
      displayName: row.display_name,
      roles: ["citizen"],
      memberships: ["free"],
      he_hep_context: { hexagon: "HE-Identity", domain: "HEP-1" },
      createdAt: row.created_at,
    }));
  }

  async recordProtocolExecution(
    input: RecordProtocolExecutionInput,
  ): Promise<AtlasProtocolExecution> {
    if (!input.protocolId?.trim() || !input.actorId?.trim()) {
      throw new Error("AtlasStore::recordProtocolExecution requiere protocolId y actorId");
    }

    const rows = await supabaseRequest<AtlasProtocolExecutionRow[]>(
      this.config,
      "atlas_protocols",
      {
        method: "POST",
        body: [{
          id: randomUUID(),
          protocol_id: input.protocolId,
          actor_id: input.actorId,
          selected_path: input.selectedPath,
          evaluated_paths: input.evaluatedPaths,
          collapsed_at: input.collapsedAt ?? new Date().toISOString(),
        }],
      },
    );
    const row = rows[0];
    if (!row) throw new Error("AtlasStore::recordProtocolExecution no devolvió ninguna fila");

    return {
      id: row.id,
      protocolId: row.protocol_id,
      actorId: row.actor_id,
      phase: "completed",
      selectedPath: row.selected_path,
      evaluatedPaths: row.evaluated_paths,
      collapsedAt: row.collapsed_at,
      he_hep_context: input.he_hep_context ?? { hexagon: "HE-Transform", domain: "HEP-2" },
    };
  }

  async recordEconomyEntry(input: RecordEconomyEntryInput): Promise<LedgerEntry> {
    if (!input.userId?.trim()) throw new Error("AtlasStore::recordEconomyEntry requiere userId");
    if (!Number.isFinite(input.amount) || input.amount <= 0) {
      throw new Error("AtlasStore::recordEconomyEntry requiere amount > 0");
    }
    if (!input.reason?.trim()) throw new Error("AtlasStore::recordEconomyEntry requiere reason");
    if (input.kind !== "credit" && input.kind !== "debit") {
      throw new Error("AtlasStore::recordEconomyEntry requiere kind = 'credit' | 'debit'");
    }

    const rows = await supabaseRequest<AtlasLedgerRow[]>(this.config, "atlas_ledger", {
      method: "POST",
      body: [{
        id: randomUUID(),
        user_id: input.userId,
        amount: input.amount,
        reason: input.reason,
        kind: input.kind,
      }],
    });
    const row = rows[0];
    if (!row) throw new Error("AtlasStore::recordEconomyEntry no devolvió ninguna fila");

    return {
      id: row.id,
      userId: row.user_id,
      amount: row.amount,
      reason: row.reason,
      kind: row.kind,
      he_hep_context: input.he_hep_context ?? { hexagon: "HE-Economy", domain: "HEP-1" },
      createdAt: row.created_at ?? new Date().toISOString(),
    };
  }

  async publishXrEvent(eventType: string, payload: unknown): Promise<AtlasXrEventRow> {
    if (!eventType?.trim()) throw new Error("AtlasStore::publishXrEvent requiere eventType");

    const rows = await supabaseRequest<AtlasXrEventRow[]>(this.config, "atlas_xr_events", {
      method: "POST",
      body: [{ id: randomUUID(), event_type: eventType, payload }],
    });
    const event = rows[0];
    if (!event) throw new Error("AtlasStore::publishXrEvent no devolvió ninguna fila");

    this.xrListeners.forEach((listener) => {
      try { listener(event); } catch (error) { console.error("[AtlasStore] XR listener error:", error); }
    });
    return event;
  }

  onXrEvent(listener: XrEventListener): () => void {
    this.xrListeners.add(listener);
    return () => this.xrListeners.delete(listener);
  }

  async createSignal(input: CreateSignalInput): Promise<AtlasSignalRow> {
    if (!input.roomId?.trim() || !input.senderId?.trim() || !input.signalType?.trim()) {
      throw new Error("AtlasStore::createSignal requiere roomId, senderId y signalType");
    }

    const rows = await supabaseRequest<AtlasSignalRow[]>(this.config, "atlas_webrtc_signals", {
      method: "POST",
      body: [{
        id: randomUUID(),
        room_id: input.roomId,
        sender_id: input.senderId,
        target_id: input.targetId ?? null,
        signal_type: input.signalType,
        payload: input.payload ?? {},
      }],
    });
    const signal = rows[0];
    if (!signal) throw new Error("AtlasStore::createSignal no devolvió ninguna fila");

    this.signalingListeners.forEach((listener) => {
      try { listener(signal); } catch (error) { console.error("[AtlasStore] Signal listener error:", error); }
    });
    return signal;
  }

  onSignal(listener: SignalListener): () => void {
    this.signalingListeners.add(listener);
    return () => this.signalingListeners.delete(listener);
  }
}
