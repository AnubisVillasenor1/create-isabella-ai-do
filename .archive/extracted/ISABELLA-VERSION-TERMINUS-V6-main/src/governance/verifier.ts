/**
 * VERIFIER_SPEC — subagente verificador de aplicaciones Python basadas en Agent SDK.
 *
 * Alcance: SDK/versiones, Python, dependencias, imports, prompts, modelos, permisos,
 * MCP, subagentes, `.env.example`, `.gitignore`, secretos, errores, sintaxis y documentación.
 *
 * Estados: PASS, PASS_WITH_WARNINGS, FAIL, INCONCLUSIVE, NOT_APPLICABLE.
 * El resultado es evidencia de una revisión concreta; no es certificación universal
 * de producción.
 */

export type VerifierState = "PASS" | "PASS_WITH_WARNINGS" | "FAIL" | "INCONCLUSIVE" | "NOT_APPLICABLE";

export const VERIFIER_CHECKS = [
  "sdk_version",
  "python_version",
  "dependencies",
  "imports",
  "prompts",
  "models",
  "permissions",
  "mcp",
  "subagents",
  "env_example",
  "gitignore",
  "secrets",
  "errors",
  "syntax",
  "documentation",
] as const;

export type VerifierCheck = (typeof VERIFIER_CHECKS)[number];

export interface VerifierFinding {
  check: VerifierCheck;
  state: VerifierState;
  detail: string;
}

export interface VerifierInput {
  isAgentSdkApp: boolean;
  sdkVersion?: string;
  pythonVersion?: string;
  hasRequirements?: boolean;
  hasEnvExample?: boolean;
  hasGitignore?: boolean;
  secretPatternsFound?: number;
  importErrors?: readonly string[];
  syntaxErrors?: readonly string[];
  mcpConfigured?: boolean;
  subagentsDeclared?: number;
  documentationPresent?: boolean;
  /** Explicitly supplied evidence for checks not represented by dedicated fields. */
  reviewedChecks?: Partial<Record<VerifierCheck, boolean>>;
}

export interface VerifierReport {
  overall: VerifierState;
  findings: readonly VerifierFinding[];
  /** advertencia de alcance: no es certificación de producción. */
  scope: string;
}

/**
 * Ejecuta la revisión del subagente. Fail-closed en lo crítico (secretos, sintaxis,
 * imports) y tolerante en lo informativo (documentación, subagentes).
 */
export function verifyAgentSdkApp(input: VerifierInput): VerifierReport {
  if (!input.isAgentSdkApp) {
    return {
      overall: "NOT_APPLICABLE",
      findings: Object.freeze([{ check: "sdk_version", state: "NOT_APPLICABLE", detail: "not an Agent SDK application" }]),
      scope: "revisión concreta; no es certificación universal de producción",
    };
  }

  const findings: VerifierFinding[] = [];
  const add = (check: VerifierCheck, state: VerifierState, detail: string) => findings.push({ check, state, detail });
  const reviewed = (check: VerifierCheck): VerifierState => {
    const evidence = input.reviewedChecks?.[check];
    return evidence === true ? "PASS" : evidence === false ? "FAIL" : "INCONCLUSIVE";
  };

  add("sdk_version", input.sdkVersion ? "PASS" : "INCONCLUSIVE", input.sdkVersion ?? "SDK version not verified");
  add("python_version", input.pythonVersion ? "PASS" : "INCONCLUSIVE", input.pythonVersion ?? "Python version not verified");
  add("dependencies", input.hasRequirements === true ? "PASS" : input.hasRequirements === false ? "PASS_WITH_WARNINGS" : "INCONCLUSIVE",
    input.hasRequirements === true ? "requirements present" : input.hasRequirements === false ? "no requirements file" : "dependency evidence not supplied");
  add("imports", input.importErrors === undefined ? "INCONCLUSIVE" : input.importErrors.length === 0 ? "PASS" : "FAIL",
    input.importErrors === undefined ? "imports not checked" : `${input.importErrors.length} import errors`);
  add("syntax", input.syntaxErrors === undefined ? "INCONCLUSIVE" : input.syntaxErrors.length === 0 ? "PASS" : "FAIL",
    input.syntaxErrors === undefined ? "syntax not checked" : `${input.syntaxErrors.length} syntax errors`);
  add("secrets", input.secretPatternsFound === undefined ? "INCONCLUSIVE" : input.secretPatternsFound === 0 ? "PASS" : "FAIL",
    input.secretPatternsFound === undefined ? "secret scan not run" : `${input.secretPatternsFound} secret patterns`);
  add("env_example", input.hasEnvExample === true ? "PASS" : input.hasEnvExample === false ? "PASS_WITH_WARNINGS" : "INCONCLUSIVE",
    input.hasEnvExample === true ? "present" : input.hasEnvExample === false ? "missing .env.example" : ".env.example not checked");
  add("gitignore", input.hasGitignore === true ? "PASS" : input.hasGitignore === false ? "PASS_WITH_WARNINGS" : "INCONCLUSIVE",
    input.hasGitignore === true ? "present" : input.hasGitignore === false ? "missing .gitignore" : ".gitignore not checked");
  add("mcp", input.mcpConfigured === true ? "PASS" : input.mcpConfigured === false ? "PASS_WITH_WARNINGS" : "INCONCLUSIVE",
    input.mcpConfigured === true ? "configured" : input.mcpConfigured === false ? "not configured" : "MCP configuration not checked");
  add("subagents", input.subagentsDeclared === undefined ? "INCONCLUSIVE" : input.subagentsDeclared > 0 ? "PASS" : "PASS_WITH_WARNINGS",
    input.subagentsDeclared === undefined ? "subagents not checked" : `${input.subagentsDeclared} subagents`);
  add("documentation", input.documentationPresent === true ? "PASS" : input.documentationPresent === false ? "PASS_WITH_WARNINGS" : "INCONCLUSIVE",
    input.documentationPresent === true ? "present" : input.documentationPresent === false ? "missing documentation" : "documentation not checked");

  for (const check of ["prompts", "models", "permissions", "errors"] as const) {
    const checkEvidence = input.reviewedChecks?.[check];
    add(check, reviewed(check), checkEvidence === undefined ? "review evidence not supplied" : checkEvidence ? "reviewed and passed" : "review failed");
  }

  const failed = findings.some((finding) => finding.state === "FAIL");
  const inconclusive = findings.some((finding) => finding.state === "INCONCLUSIVE");
  const warnings = findings.some((finding) => finding.state === "PASS_WITH_WARNINGS");
  const overall: VerifierState = failed ? "FAIL" : inconclusive ? "INCONCLUSIVE" : warnings ? "PASS_WITH_WARNINGS" : "PASS";

  return {
    overall,
    findings: Object.freeze(findings),
    scope: "revisión concreta; no es certificación universal de producción",
  };
}
