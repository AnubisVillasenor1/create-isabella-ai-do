export type HeHepContext = {
  hexagon: string;
  domain: string;
};

export type AtlasUser = {
  id: string;
  handle: string;
  displayName: string;
  roles: string[];
  memberships: string[];
  he_hep_context: HeHepContext;
  createdAt: string;
};

export type AtlasProtocolExecution = {
  id: string;
  protocolId: string;
  actorId: string;
  phase: "completed";
  selectedPath: unknown;
  evaluatedPaths: unknown;
  collapsedAt: string;
  he_hep_context: HeHepContext;
};

export type LedgerEntry = {
  id: string;
  userId: string;
  amount: number;
  reason: string;
  kind: "credit" | "debit";
  he_hep_context: HeHepContext;
  createdAt: string;
};

export type CreateUserInput = {
  handle: string;
  displayName: string;
  he_hep_context?: HeHepContext;
};

export type RecordProtocolExecutionInput = {
  protocolId: string;
  actorId: string;
  selectedPath: unknown;
  evaluatedPaths: unknown;
  collapsedAt?: string;
  he_hep_context?: HeHepContext;
};

export type RecordEconomyEntryInput = {
  userId: string;
  amount: number;
  reason: string;
  kind: "credit" | "debit";
  he_hep_context?: HeHepContext;
};

export type AtlasXrEventRow = {
  id: string;
  event_type: string;
  payload: unknown;
  created_at?: string;
};

export type CreateSignalInput = {
  roomId: string;
  senderId: string;
  targetId?: string | null;
  signalType: string;
  payload?: unknown;
};

export type AtlasSignalRow = {
  id: string;
  room_id: string;
  sender_id: string;
  target_id: string | null;
  signal_type: string;
  payload: unknown;
  created_at?: string;
};
