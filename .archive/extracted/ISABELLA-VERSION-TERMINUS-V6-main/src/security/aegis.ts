export type AegisFindingKind =
  | "prompt_injection"
  | "indirect_injection"
  | "secret_exfiltration"
  | "pii"
  | "tool_poisoning"
  | "retrieval_poisoning"
  | "policy_evasion";

export interface AegisFinding {
  kind: AegisFindingKind;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  evidence: string;
}

export interface AegisVerdict {
  decision: "ALLOW" | "MODIFY" | "BLOCK" | "REVIEW";
  score: number;
  findings: readonly AegisFinding[];
}

const RULES: ReadonlyArray<{ kind: AegisFindingKind; severity: AegisFinding["severity"]; patterns: readonly RegExp[] }> = [
  { kind: "prompt_injection", severity: "HIGH", patterns: [/ignore\s+(all|previous|prior)\s+instructions/i, /system\s+message\s*:/i] },
  { kind: "indirect_injection", severity: "HIGH", patterns: [/instructions?\s+for\s+the\s+assistant/i, /do\s+not\s+tell\s+the\s+user/i] },
  {
    kind: "secret_exfiltration",
    severity: "CRITICAL",
    patterns: [
      /(?:reveal|show|send|share|export|exfiltrat|dump|bypass)[^.!?\n]{0,80}(?:api[_ -]?key|private[_ -]?key|access[_ -]?token|password|secret)/i,
      /(?:api[_ -]?key|private[_ -]?key|access[_ -]?token|password|secret)\s*[:=]\s*[^\s,;]{8,}/i,
    ],
  },
  { kind: "pii", severity: "HIGH", patterns: [/\bcurp\b/i, /\brfc\b/i, /social\s+security/i] },
  { kind: "tool_poisoning", severity: "CRITICAL", patterns: [/tool\s+description\s+override/i, /call\s+this\s+tool\s+without/i] },
  { kind: "retrieval_poisoning", severity: "HIGH", patterns: [/retrieval\s+instruction/i, /rank\s+this\s+source\s+above/i] },
  { kind: "policy_evasion", severity: "CRITICAL", patterns: [/bypass\s+(security|policy|crown|approval)/i, /disable\s+(audit|governance|verification)/i] },
];

export function inspectAegis(input: string): AegisVerdict {
  const findings: AegisFinding[] = [];
  for (const rule of RULES) {
    for (const pattern of rule.patterns) {
      const match = input.match(pattern);
      if (match) {
        findings.push({ kind: rule.kind, severity: rule.severity, evidence: match[0] ?? pattern.source });
        break;
      }
    }
  }
  const rank = { LOW: 1, MEDIUM: 2, HIGH: 3, CRITICAL: 4 } as const;
  const score = Math.min(1, findings.reduce((sum, f) => sum + rank[f.severity] / 10, 0));
  const critical = findings.some((f) => f.severity === "CRITICAL");
  const high = findings.some((f) => f.severity === "HIGH");
  return {
    decision: critical ? "BLOCK" : high ? "REVIEW" : "ALLOW",
    score,
    findings,
  };
}


/**
 * Serialize once and evaluate the same bytes at a security boundary.
 * Serialization failure is a hard block, never an implicit empty input.
 */
export function inspectAegisInput(value: unknown): { serialized: string | null; verdict: AegisVerdict } {
  let serialized: string | undefined;
  try {
    serialized = JSON.stringify(value);
  } catch {
    serialized = undefined;
  }
  if (typeof serialized !== "string") {
    return {
      serialized: null,
      verdict: {
        decision: "BLOCK",
        score: 1,
        findings: [{
          kind: "policy_evasion",
          severity: "CRITICAL",
          evidence: "input serialization failed; fail-closed",
        }],
      },
    };
  }
  return { serialized, verdict: inspectAegis(serialized) };
}

export function inspectAegisValue(value: unknown): AegisVerdict {
  return inspectAegisInput(value).verdict;
}
