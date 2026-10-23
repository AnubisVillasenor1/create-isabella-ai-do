// Ω∞-15 · CONSTITUTION ENGINE (state: draft | engine-generated).
// Capa suprema de constitución ejecutable. No políticas, no reglas: artículos.
// Toda operación debe recorrer el flujo obligatorio Constitución → Política →
// Mandato → Capacidad → Ejecución y satisfacer los 10 artículos. Es fail-closed:
// cualquier vacío estructural o incumplimiento devuelve allowed=false.

export interface ConstitutionalArticle {
  readonly id: number;
  readonly key: string;
  readonly name: string;
  readonly principle: string;
}

/** Los 10 artículos constitucionales de Isabella Ω∞. */
export const CONSTITUTION_ARTICLES: readonly ConstitutionalArticle[] = [
  { id: 1, key: "identity_first", name: "Identity First", principle: "La identidad precede a la acción; ningún mandato puede ejecutarse sin trazabilidad de origen." },
  { id: 2, key: "evidence_before_authority", name: "Evidence Before Authority", principle: "La evidencia precede a la autoridad; ninguna decisión invoca legitimidad sin soporte verificable." },
  { id: 3, key: "authority_before_action", name: "Authority Before Action", principle: "La autoridad precede a la acción; ningún agente ejecuta sin mandato legítimo." },
  { id: 4, key: "audit_before_trust", name: "Audit Before Trust", principle: "La auditoría precede a la confianza; ningún resultado es confiable sin trazabilidad." },
  { id: 5, key: "human_override", name: "Human Override", principle: "La intervención humana prevalece sobre la autonomía artificial en decisiones críticas." },
  { id: 6, key: "economic_accountability", name: "Economic Accountability", principle: "Toda acción con impacto económico debe ser trazable, explicable y justificable." },
  { id: 7, key: "territorial_sovereignty", name: "Territorial Sovereignty", principle: "La soberanía territorial y comunitaria no puede subordinarse a lógicas centralizadas." },
  { id: 8, key: "explainability", name: "Explainability", principle: "Toda decisión relevante debe poder explicarse en términos comprensibles." },
  { id: 9, key: "recoverability", name: "Recoverability", principle: "Todo estado crítico debe poder recuperarse sin pérdida de integridad." },
  { id: 10, key: "antifragility", name: "Antifragility", principle: "El sistema debe aprender de la crisis y fortalecerse con ella." },
];

export type ConstitutionalStage = "constitution" | "policy" | "mandate" | "capability" | "execution";

/** Flujo obligatorio: Constitución → Política → Mandato → Capacidad → Ejecución. */
export const CONSTITUTIONAL_FLOW: readonly ConstitutionalStage[] = [
  "constitution",
  "policy",
  "mandate",
  "capability",
  "execution",
];

/** Declaración de una etapa del flujo con las pruebas que exige la constitución. */
export interface ConstitutionalAssertion {
  readonly stage: ConstitutionalStage;
  readonly identity?: string;
  readonly evidence?: readonly string[];
  readonly authority?: string;
  readonly auditTrail?: readonly string[];
  readonly humanOverrideAvailable?: boolean;
  readonly economicJustification?: string;
  readonly territory?: string;
  readonly explanation?: string;
  readonly recoveryPlan?: string;
  readonly learningRecord?: string;
}

export interface ConstitutionalViolation {
  readonly article: number;
  readonly key: string;
  readonly name: string;
  readonly detail: string;
}

export interface ConstitutionalDecision {
  readonly allowed: boolean;
  readonly flow: readonly ConstitutionalStage[];
  readonly evaluated: readonly number[];
  readonly violations: readonly ConstitutionalViolation[];
  readonly decidedAt: string;
}

function article(id: number): ConstitutionalArticle {
  return CONSTITUTION_ARTICLES[id - 1] as ConstitutionalArticle;
}

function nonEmpty(value: unknown): boolean {
  return typeof value === "string" && value.trim() !== "";
}

function nonEmptyList(value: unknown): boolean {
  return Array.isArray(value) && value.length > 0;
}

/**
 * Evalúa una propuesta contra la constitución. Determinista y fail-closed:
 * `allowed` sólo es true cuando no hay ninguna violación. Verifica primero el
 * flujo obligatorio (todas las etapas, en orden) y luego los 10 artículos.
 */
export function evaluateConstitution(
  assertions: readonly ConstitutionalAssertion[],
  clock: () => string = () => new Date().toISOString(),
): ConstitutionalDecision {
  const violations: ConstitutionalViolation[] = [];
  const fail = (id: number, detail: string): void => {
    const a = article(id);
    violations.push({ article: a.id, key: a.key, name: a.name, detail });
  };

  if (!Array.isArray(assertions) || assertions.length === 0) {
    fail(3, "No se aportó ningún mandato; el flujo Constitución→…→Ejecución es obligatorio.");
    return { allowed: false, flow: CONSTITUTIONAL_FLOW, evaluated: CONSTITUTION_ARTICLES.map((a) => a.id), violations, decidedAt: clock() };
  }

  const missing = CONSTITUTIONAL_FLOW.filter((stage) => !assertions.some((assertion) => assertion.stage === stage));
  if (missing.length > 0) fail(1, `Faltan etapas del flujo obligatorio: ${missing.join(", ")}.`);

  const indices = assertions.map((assertion) => CONSTITUTIONAL_FLOW.indexOf(assertion.stage));
  for (let i = 1; i < indices.length; i += 1) {
    if ((indices[i] as number) < (indices[i - 1] as number)) {
      fail(3, "El orden Constitución→Política→Mandato→Capacidad→Ejecución se invirtió.");
      break;
    }
  }

  const merged = <T>(pick: (assertion: ConstitutionalAssertion) => T | undefined): T | undefined => {
    for (const assertion of assertions) {
      const value = pick(assertion);
      if (value !== undefined) return value;
    }
    return undefined;
  };

  if (!nonEmpty(merged((a) => a.identity))) fail(1, "Falta identidad (trazabilidad de origen).");
  if (!nonEmptyList(merged((a) => a.evidence))) fail(2, "Falta evidencia verificable.");
  if (!nonEmpty(merged((a) => a.authority))) fail(3, "Falta autoridad/mandato legítimo.");
  if (!nonEmptyList(merged((a) => a.auditTrail))) fail(4, "Falta traza de auditoría.");
  if (merged((a) => a.humanOverrideAvailable) !== true) fail(5, "No se declaró human override disponible.");
  if (!nonEmpty(merged((a) => a.economicJustification))) fail(6, "Falta justificación económica.");
  if (!nonEmpty(merged((a) => a.territory))) fail(7, "Falta territorio/soberanía declarada.");
  if (!nonEmpty(merged((a) => a.explanation))) fail(8, "Falta explicación comprensible.");
  if (!nonEmpty(merged((a) => a.recoveryPlan))) fail(9, "Falta plan de recuperación.");
  if (!nonEmpty(merged((a) => a.learningRecord))) fail(10, "Falta registro de aprendizaje (antifragilidad).");

  return {
    allowed: violations.length === 0,
    flow: CONSTITUTIONAL_FLOW,
    evaluated: CONSTITUTION_ARTICLES.map((a) => a.id),
    violations,
    decidedAt: clock(),
  };
}
