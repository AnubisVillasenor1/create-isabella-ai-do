export type ContextSignal = "calm" | "uncertain" | "frustrated" | "distressed" | "urgent" | "unknown";

export interface ContextualAffectSignal {
  signal: ContextSignal;
  confidence: number;
  source: "user_explicit" | "conversation_heuristic" | "external_sensor";
  observedAt: string;
  expiresAt: string;
}

export interface EmotionalTrace {
  traceId: string;
  signals: readonly ContextualAffectSignal[];
  purpose: "response_modulation" | "safety_routing" | "interaction_context";
  consentRequired: boolean;
}

export function createEmotionalTrace(traceId: string, signals: readonly ContextualAffectSignal[], purpose: EmotionalTrace["purpose"]): EmotionalTrace {
  for (const s of signals) {
    if (s.confidence < 0 || s.confidence > 1) throw new Error("EMOTIONAL_TRACE: confidence must be 0..1");
    if (Date.parse(s.expiresAt) <= Date.parse(s.observedAt)) throw new Error("EMOTIONAL_TRACE: signal expiry must be future relative to observation");
  }
  return Object.freeze({traceId,signals:[...signals],purpose,consentRequired:true});
}
