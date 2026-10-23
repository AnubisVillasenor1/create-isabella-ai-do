/**
 * Governed issue lifecycle — motor determinista de ciclo de vida (evolución 3×).
 *
 * Evoluciona los scripts de triage (comentario, stale y auto-cierre) a un motor de
 * política puro y testeable:
 *   1) Política declarativa única (label, timeout, mensajes).
 *   2) Detección de stale multi-señal con umbral de upvotes y protección ante
 *      actividad humana posterior a la etiqueta.
 *   3) Adjudicación de cierre con gate humano para casos controvertidos.
 *
 * No realiza I/O: decide. La ejecución (comentario/cierre) corresponde al invocador
 * autorizado, sujeto a GIT/QUALITY gates y auditoría BookPI.
 */

export interface LifecyclePolicy {
  label: string;
  days: number;
  reason: string;
  nudge: string;
}

/** Fuente única de verdad para etiquetas, timeouts y mensajes. */
export const LIFECYCLE: readonly LifecyclePolicy[] = Object.freeze([
  {
    label: "invalid",
    days: 3,
    reason: "this doesn't appear to be about the project",
    nudge: "This doesn't appear to be about the project. For general support, see the documentation.",
  },
  {
    label: "needs-repro",
    days: 7,
    reason: "we still need reproduction steps to investigate",
    nudge: "We weren't able to reproduce this. Could you provide steps to trigger the issue?",
  },
  {
    label: "needs-info",
    days: 7,
    reason: "we still need a bit more information to move forward",
    nudge: "We need more information to continue investigating. Please include version, OS and logs.",
  },
  {
    label: "stale",
    days: 14,
    reason: "inactive for too long",
    nudge: "This issue has been automatically marked as stale due to inactivity.",
  },
  {
    label: "autoclose",
    days: 14,
    reason: "inactive for too long",
    nudge: "This issue has been marked for automatic closure.",
  },
] as const);

export type LifecycleLabel = (typeof LIFECYCLE)[number]["label"];

export const STALE_UPVOTE_THRESHOLD = 15;

export interface LifecycleIssue {
  number: number;
  labels: readonly string[];
  /** Issue text is required to preserve the sensitive-content human gate. */
  title?: string;
  body?: string;
  /** Explicit upstream sensitivity flag takes precedence over text heuristics. */
  sensitive?: boolean;
  updatedAt: string;
  createdAt: string;
  locked?: boolean;
  assignees?: readonly string[];
  upvotes?: number;
  /** comentarios con autor humano (type != bot) y su fecha. */
  humanComments?: readonly { at: string }[];
}

const DAY_MS = 86_400_000;

function policyFor(label: string): LifecyclePolicy | undefined {
  return LIFECYCLE.find((entry) => entry.label === label);
}

function ageDays(iso: string, now: Date): number {
  return (now.getTime() - new Date(iso).getTime()) / DAY_MS;
}

function protectedFromAutomation(issue: LifecycleIssue): boolean {
  if (issue.locked) return true;
  if ((issue.assignees ?? []).length > 0) return true;
  if ((issue.upvotes ?? 0) >= STALE_UPVOTE_THRESHOLD) return true;
  return false;
}

export interface StaleDecision {
  markStale: boolean;
  reason: string;
}

/** Detecta si un issue debe marcarse `stale` (14 días sin actividad, no protegido). */
export function evaluateStale(issue: LifecycleIssue, now = new Date()): StaleDecision {
  const stalePolicy = policyFor("stale");
  if (!stalePolicy) return { markStale: false, reason: "no policy" };
  if (issue.labels.includes("stale") || issue.labels.includes("autoclose")) {
    return { markStale: false, reason: "already labelled" };
  }
  if (protectedFromAutomation(issue)) return { markStale: false, reason: "protected (locked/assigned/upvoted)" };
  if (ageDays(issue.updatedAt, now) < stalePolicy.days) return { markStale: false, reason: "recently updated" };
  return { markStale: true, reason: `inactive ${Math.floor(ageDays(issue.updatedAt, now))}d` };
}

export interface ClosureDecision {
  close: boolean;
  reason: string;
  message?: string;
}

/**
 * Decide el cierre automático por timeout. Protege ante actividad humana posterior
 * a la etiqueta y ante upvotes. Fail-closed: ante ambigüedad, no cierra.
 */
export function evaluateClosure(
  issue: LifecycleIssue,
  label: string,
  labelledAt: string,
  now = new Date(),
): ClosureDecision {
  const policy = policyFor(label);
  if (!policy) return { close: false, reason: "unknown label" };
  if (!issue.labels.includes(label)) return { close: false, reason: "label not present" };
  if (protectedFromAutomation(issue)) return { close: false, reason: "protected (locked/assigned/upvoted)" };
  if (ageDays(labelledAt, now) < policy.days) return { close: false, reason: "timeout not reached" };
  const humanActivity = (issue.humanComments ?? []).some((c) => new Date(c.at).getTime() > new Date(labelledAt).getTime());
  if (humanActivity) return { close: false, reason: "human activity after label" };
  return {
    close: true,
    reason: policy.reason,
    message: `Closing for now — ${policy.reason}. Please open a new issue if this is still relevant.`,
  };
}

export interface TriageInput {
  title: string;
  body: string;
  labels?: readonly string[];
}

export interface TriageDecision {
  addLabels: readonly string[];
  removeLabels: readonly string[];
  requiresHumanGate: boolean;
  reasons: readonly string[];
}

/**
 * Triage determinista basado en señales del título/cuerpo. Marca gate humano cuando
 * el contenido es ambiguo o controvertido (evita decisiones automáticas sensibles).
 */
export function evaluateTriage(input: TriageInput, now = new Date()): TriageDecision {
  void now;
  const text = `${input.title}\n${input.body}`.toLowerCase();
  const existing = new Set(input.labels ?? []);
  const add: string[] = [];
  const remove: string[] = [];
  const reasons: string[] = [];
  let requiresHumanGate = false;

  const hasRepro = /\b(?:steps to reproduce|reproduction|repro)\b/.test(text);
  const hasInfo = /\b(?:version|os|logs|error)\b/.test(text);
  const looksInvalid = /\b(?:not about|unrelated|spam|advertisement)\b/.test(text);
  const controversial = /\b(?:security|vulnerability|legal|gdpr|breach|privacy|personal data|credential|secret|ransomware|seguridad|vulnerabilidad|privacidad|datos personales|filtraci[oó]n|credenciales)\b/.test(text);

  if (looksInvalid) {
    if (!existing.has("invalid")) add.push("invalid");
    reasons.push("content appears off-topic");
  } else {
    if (!hasRepro && !existing.has("needs-repro")) add.push("needs-repro");
    if (!hasInfo && !existing.has("needs-info")) add.push("needs-info");
  }

  if (controversial) {
    requiresHumanGate = true;
    reasons.push("controversial/sensitive content requires human gate");
  }

  for (const label of ["stale", "autoclose", "invalid"]) {
    if (existing.has(label) && add.length > 0) remove.push(label);
  }

  return {
    addLabels: Object.freeze(add),
    removeLabels: Object.freeze(remove),
    requiresHumanGate,
    reasons: Object.freeze(reasons),
  };
}

export interface AdjudicationInput {
  issueNumber: number;
  duplicateOf?: number;
  confidence: number;
  authorDisagreed?: boolean;
  hasActivityAfterDetection?: boolean;
}

export interface AdjudicationDecision {
  action: "CLOSE_DUPLICATE" | "HOLD" | "ESCALATE";
  reason: string;
}

/**
 * Adjudica cierres por duplicado. Solo cierra con alta confianza, sin desacuerdo del
 * autor ni actividad posterior; en caso contrario mantiene o escala a humano.
 */
export function adjudicateDuplicate(input: AdjudicationInput): AdjudicationDecision {
  if (input.confidence < 0.8) return { action: "HOLD", reason: "insufficient duplicate confidence" };
  if (input.authorDisagreed) return { action: "ESCALATE", reason: "author disagreed with duplicate detection" };
  if (input.hasActivityAfterDetection) return { action: "HOLD", reason: "activity after duplicate detection" };
  if (input.duplicateOf === undefined) return { action: "HOLD", reason: "no duplicate target" };
  return { action: "CLOSE_DUPLICATE", reason: `duplicate of #${input.duplicateOf}` };
}

export interface LifecycleRunInput {
  issues: readonly LifecycleIssue[];
  now?: Date;
}

export interface LifecycleRunPlan {
  markStale: readonly number[];
  /** cierres propuestos: issue → etiqueta. */
  proposeClose: readonly { issue: number; label: string }[];
  humanGate: readonly number[];
}

/**
 * Produce un plan de ciclo de vida (no ejecuta). Es el "inspect → propose" previo al
 * policy gate; la ejecución requiere aprobación conforme a GIT/QUALITY gates.
 */
export function planLifecycleRun(input: LifecycleRunInput): LifecycleRunPlan {
  const now = input.now ?? new Date();
  const markStale: number[] = [];
  const proposeClose: { issue: number; label: string }[] = [];
  const humanGate: number[] = [];

  for (const issue of input.issues) {
    const triage = evaluateTriage({ title: issue.title ?? "", body: issue.body ?? "", labels: issue.labels }, now);
    const requiresHumanGate = issue.sensitive === true || triage.requiresHumanGate;
    if (requiresHumanGate) humanGate.push(issue.number);
    if (evaluateStale(issue, now).markStale && !requiresHumanGate) markStale.push(issue.number);
    for (const label of issue.labels) {
      if (!policyFor(label) || requiresHumanGate) continue;
      const labelledAt = issue.updatedAt;
      if (evaluateClosure(issue, label, labelledAt, now).close) {
        proposeClose.push({ issue: issue.number, label });
      }
    }
  }

  return {
    markStale: Object.freeze(markStale),
    proposeClose: Object.freeze(proposeClose),
    humanGate: Object.freeze(humanGate),
  };
}
