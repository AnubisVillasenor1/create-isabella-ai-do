export type XrSafetySignal = "harassment" | "personal_space" | "simulated_violence" | "grooming" | "unknown";
export interface XrSafetyEvent {
  sessionId: string;
  signal: XrSafetySignal;
  severity: "LOW"|"MEDIUM"|"HIGH"|"CRITICAL";
  subjectId?: string;
  at: string;
  source: "user_report"|"moderator"|"system";
}
export interface XrSafetyDecision {
  action: "ALLOW"|"WARN"|"PAUSE"|"ESCALATE";
  event: XrSafetyEvent;
  humanReviewRequired: boolean;
}
export function evaluateXrSafety(event: XrSafetyEvent): XrSafetyDecision {
  if(event.severity==="CRITICAL" || event.signal==="grooming") return {action:"ESCALATE",event,humanReviewRequired:true};
  if(event.severity==="HIGH" || event.signal==="harassment" || event.signal==="personal_space") return {action:"WARN",event,humanReviewRequired:false};
  if(event.signal==="simulated_violence" && event.severity==="MEDIUM") return {action:"PAUSE",event,humanReviewRequired:false};
  return {action:"ALLOW",event,humanReviewRequired:false};
}
