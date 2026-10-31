/**
 * Núcleo de razonamiento verificable Ω∞ (state: implemented | tested).
 *
 * Implementa cuatro capas canónicas sobre el mismo sustrato determinista:
 *   ΩX-01 NeuroSymbolic Reasoning Layer — extracción de claims y encadenamiento.
 *   ΩX-02 Self-Reflection Engine — revisión de la respuesta antes de emitirla.
 *   ΩX-21 Autonomous Governance Validator — validación fail-closed de entrada/salida.
 *   ΩX-23 Cognitive Quality Assurance — métricas de cobertura, foco y repetición.
 *
 * No hay pesos neuronales ni inferencia estadística oculta. Una contradicción se
 * reporta; no se resuelve sola. Ninguna capa concede autoridad ni ejecuta efectos.
 */
import {
  detectContradictions,
  type CanonicalClaim,
  type ContradictionPair,
} from '../cognition/contradiction';
import {
  clamp01,
  contentTerms,
  hashId,
  jaccard,
  normalizeText,
  splitSentences,
  termSet,
  tokenizeText,
} from './text';

export type ClaimPolarity = 'affirm' | 'deny';
export type ClaimSource = 'input' | 'context' | 'draft' | 'inference' | 'policy';

export interface SymbolicClaim {
  readonly id: string;
  readonly subject: string;
  readonly relation: string;
  readonly object: string;
  readonly polarity: ClaimPolarity;
  readonly source: ClaimSource;
}

export interface InferenceStep {
  readonly ruleId: string;
  readonly premises: readonly string[];
  readonly conclusion: string;
}

export interface ContradictionView {
  readonly left: string;
  readonly right: string;
  readonly reason: string;
  readonly resolution: string;
  readonly winner?: string;
}

export interface NeuroSymbolicReport {
  readonly claims: readonly SymbolicClaim[];
  readonly inferred: readonly SymbolicClaim[];
  readonly contradictions: readonly ContradictionView[];
  readonly appliedRules: readonly InferenceStep[];
  readonly consistent: boolean;
  readonly confidence: number;
  readonly counts: {
    readonly extracted: number;
    readonly inferred: number;
    readonly contradictions: number;
    readonly unresolved: number;
  };
  readonly note: string;
}

export interface ReflectionIssue {
  readonly code: string;
  readonly severity: 'info' | 'review' | 'block';
  readonly detail: string;
}

export interface ReflectionReport {
  readonly verdict: 'PASS' | 'REVISE' | 'BLOCK';
  readonly issues: readonly ReflectionIssue[];
  readonly revisedDraft: string;
  readonly changes: readonly string[];
  readonly coverage: number;
  readonly executionClaim: boolean;
}

export interface QualityReport {
  readonly score: number;
  readonly verdict: 'PASS' | 'REVISE' | 'BLOCK';
  readonly metrics: {
    readonly coverage: number;
    readonly grounding: number | null;
    readonly focus: number;
    readonly repetition: number;
    readonly lengthAdequacy: number;
  };
  readonly issues: readonly string[];
}

export interface GovernanceFinding {
  readonly code: string;
  readonly severity: 'info' | 'review' | 'block';
  readonly detail: string;
}

export interface GovernanceReport {
  readonly verdict: 'PASS' | 'REVIEW' | 'BLOCK';
  readonly findings: readonly GovernanceFinding[];
  readonly authority: 'NONE';
  readonly executionPerformed: false;
}

const RELATION_MAP: Readonly<Record<string, string>> = {
  es: 'es',
  son: 'es',
  esta: 'estado',
  estan: 'estado',
  tiene: 'tiene',
  tienen: 'tiene',
  requiere: 'requiere',
  requieren: 'requiere',
  puede: 'puede',
  pueden: 'puede',
  debe: 'debe',
  deben: 'debe',
  pertenece: 'pertenece',
  pertenecen: 'pertenece',
};

const ARTICLE = /^(el|la|los|las|un|una|unos|unas|the|a|an)\s+/i;
const QUESTION_START =
  /^(que|qué|quien|quién|como|cómo|cuando|cuándo|donde|dónde|por que|por qué|para que|para qué|si|cual|cuál|cuanto|cuánto)\b/i;
const PRONOUN_SUBJECTS = new Set([
  'esto',
  'eso',
  'esto',
  'aquello',
  'él',
  'el',
  'ella',
  'ellos',
  'ellas',
  'yo',
  'nosotros',
]);

function cleanSubject(value: string): string {
  return normalizeText(value)
    .replace(ARTICLE, '')
    .replace(/\s+/g, ' ')
    .replace(/^[,;:.\s]+|[,;:.\s]+$/g, '')
    .trim();
}

function cleanObject(value: string): string {
  const clipped = value
    .replace(/\s+(que|porque|pero|aunque|mientras|cuando)\s+.*$/i, '')
    .replace(/\s*[,;]\s*.*$/, '')
    .trim();
  return normalizeText(clipped)
    .replace(ARTICLE, '')
    .replace(/^[,;:.\s]+|[,;:.\s]+$/g, '')
    .trim();
}

function claimKey(
  claim: Pick<SymbolicClaim, 'subject' | 'relation' | 'object' | 'polarity'>
): string {
  return `${claim.subject}|${claim.relation}|${claim.object}|${claim.polarity}`;
}

function makeClaim(
  source: ClaimSource,
  subject: string,
  relation: string,
  object: string,
  polarity: ClaimPolarity,
  index: number
): SymbolicClaim | null {
  const normalizedSubject = cleanSubject(subject);
  const normalizedObject = cleanObject(object);
  if (normalizedSubject.length < 2 || normalizedObject.length < 2) return null;
  if (PRONOUN_SUBJECTS.has(normalizedSubject)) return null;
  if (normalizedSubject.split(' ').length > 8 || normalizedObject.split(' ').length > 12)
    return null;
  const key = `${normalizedSubject}|${relation}|${normalizedObject}|${polarity}`;
  return {
    id: `${source}:${index}:${hashId(key, 10)}`,
    subject: normalizedSubject,
    relation,
    object: normalizedObject,
    polarity,
    source,
  };
}

const CLAIM_PATTERN =
  /\b([\p{L}][\p{L}\p{N}\s_-]{1,60}?)\s+(no\s+)?(es|son|está|esta|están|estan|tiene|tienen|requiere|requieren|puede|pueden|debe|deben|pertenece|pertenecen)\s+([\p{L}\p{N}][\p{L}\p{N}\s,._-]{0,80})/giu;

export class NeuroSymbolicReasoner {
  extract(text: string, source: ClaimSource): SymbolicClaim[] {
    const claims: SymbolicClaim[] = [];
    const seen = new Set<string>();
    let index = 0;
    for (const sentence of splitSentences(text, 80)) {
      if (sentence.endsWith('?') || QUESTION_START.test(sentence)) continue;
      CLAIM_PATTERN.lastIndex = 0;
      let match: RegExpExecArray | null;
      while ((match = CLAIM_PATTERN.exec(sentence)) !== null) {
        const verb = normalizeText(match[3] ?? '');
        const relation = RELATION_MAP[verb];
        if (!relation) continue;
        const polarity: ClaimPolarity = match[2] ? 'deny' : 'affirm';
        const claim = makeClaim(source, match[1] ?? '', relation, match[4] ?? '', polarity, index);
        index += 1;
        if (!claim) continue;
        const key = claimKey(claim);
        if (seen.has(key)) continue;
        seen.add(key);
        claims.push(claim);
        if (claims.length >= 48) return claims;
      }
    }
    return claims;
  }

  infer(
    claims: readonly SymbolicClaim[],
    maxIterations = 24
  ): { inferred: SymbolicClaim[]; steps: InferenceStep[] } {
    const known = new Set(claims.map(claimKey));
    const inferred: SymbolicClaim[] = [];
    const steps: InferenceStep[] = [];
    let frontier = [...claims];
    for (let iteration = 0; iteration < maxIterations; iteration += 1) {
      const next: SymbolicClaim[] = [];
      for (const left of frontier) {
        if (left.polarity !== 'affirm') continue;
        for (const right of frontier) {
          if (right.polarity !== 'affirm') continue;
          const transitive =
            (left.relation === 'es' && right.relation === 'es') ||
            (left.relation === 'estado' && right.relation === 'estado');
          if (!transitive || left.object !== right.subject) continue;
          const candidate = makeClaim(
            'inference',
            left.subject,
            left.relation,
            right.object,
            'affirm',
            1000 + inferred.length
          );
          if (!candidate) continue;
          const key = claimKey(candidate);
          if (known.has(key)) continue;
          known.add(key);
          inferred.push(candidate);
          next.push(candidate);
          steps.push({
            ruleId: left.relation === 'es' ? 'transitivity.es' : 'transitivity.estado',
            premises: [left.id, right.id],
            conclusion: `${candidate.subject} ${candidate.relation} ${candidate.object}`,
          });
          if (inferred.length >= 24) return { inferred, steps };
        }
      }
      if (next.length === 0) break;
      frontier = next;
    }
    return { inferred, steps };
  }

  analyze(input: {
    readonly input: string;
    readonly context?: string;
    readonly draft?: string;
    readonly policyClaims?: readonly SymbolicClaim[];
  }): NeuroSymbolicReport {
    const claims = [
      ...this.extract(input.input, 'input'),
      ...(input.context ? this.extract(input.context, 'context') : []),
      ...(input.draft ? this.extract(input.draft, 'draft') : []),
      ...(input.policyClaims ?? []),
    ];
    const { inferred, steps } = this.infer(claims);
    // Inferred conclusions are derived from the extracted premises; comparing
    // them back against those premises flags valid chains (tokio → japón → asia)
    // as incompatible objects. Contradiction detection therefore runs only on
    // directly extracted claims.
    const canonical: CanonicalClaim[] = claims.map((claim) => ({
      claimId: claim.id,
      subject: claim.subject,
      relation: claim.relation,
      object: claim.object,
      polarity: claim.polarity,
    }));
    const report = detectContradictions(canonical, { functionalRelations: ['es'] });
    const contradictions: ContradictionView[] = report.contradictions.map(
      (pair: ContradictionPair) => ({
        left: pair.left,
        right: pair.right,
        reason: pair.reason,
        resolution: pair.resolution,
        ...(pair.winner ? { winner: pair.winner } : {}),
      })
    );
    const confidence = clamp01(
      0.45 +
        Math.min(0.3, claims.length * 0.04) +
        Math.min(0.1, inferred.length * 0.02) -
        Math.min(0.45, contradictions.length * 0.15)
    );
    return {
      claims,
      inferred,
      contradictions,
      appliedRules: steps,
      consistent: contradictions.length === 0,
      confidence,
      counts: {
        extracted: claims.length,
        inferred: inferred.length,
        contradictions: contradictions.length,
        unresolved: report.unresolved,
      },
      note: 'Razonamiento estructural sobre claims normalizados; no demuestra verdad ni sustituye verificación humana.',
    };
  }
}

const OVERCLAIM_PATTERNS: ReadonlyArray<{ code: string; pattern: RegExp; detail: string }> = [
  {
    code: 'EXECUTION_CLAIM',
    pattern:
      /\b(he|hemos|ya)\s+(ejecutado|accedido|consultado|verificado|eliminado|creado|enviado|instalado|desplegado|modificado)\b/i,
    detail: 'La respuesta declara una ejecución externa que este runtime no realizó.',
  },
  {
    code: 'FIRST_PERSON_EXECUTION',
    pattern:
      /\b(accedí|consulté|verifiqué|ejecuté|eliminé|envié|creé|instalé|desplegué|modifiqué)\b/i,
    detail: 'La respuesta usa primera persona para una acción no ejecutada por el runtime.',
  },
  {
    code: 'UNSUPPORTED_GUARANTEE',
    pattern:
      /\b(puedo garantizar|está garantizado|100\s*%\s*(seguro|verificado|confiable)|verificado en tiempo real)\b/i,
    detail:
      'La respuesta afirma una garantía o verificación que no está respaldada por evidencia local.',
  },
  {
    code: 'FALSE_COMPLETION',
    pattern: /\b(acción completada|operación realizada|tarea finalizada)\b/i,
    detail: 'La respuesta presenta una acción como completada sin ejecución verificable.',
  },
];

const CAVEAT =
  'Nota de transparencia: no ejecuté acciones externas ni verifiqué fuentes en tiempo real. Esta respuesta es informativa y no constituye evidencia.';

const UNCERTAINTY =
  /(no ejecuté|no accedí|no consulté|no puedo verificar|no tengo acceso|sin verificación|información no verificada|nota de transparencia)/i;

export class ReflectionEngine {
  reflect(input: {
    readonly input: string;
    readonly draft: string;
    readonly contextText?: string;
    readonly contradictionCount?: number;
  }): ReflectionReport {
    const draft = input.draft.trim();
    const issues: ReflectionIssue[] = [];
    const changes: string[] = [];
    if (!draft) {
      return {
        verdict: 'BLOCK',
        issues: [{ code: 'EMPTY_DRAFT', severity: 'block', detail: 'No hay texto que emitir.' }],
        revisedDraft: '',
        changes: ['empty-draft'],
        coverage: 0,
        executionClaim: false,
      };
    }
    let executionClaim = false;
    for (const rule of OVERCLAIM_PATTERNS) {
      if (rule.pattern.test(draft)) {
        executionClaim = true;
        issues.push({ code: rule.code, severity: 'review', detail: rule.detail });
      }
    }
    let revisedDraft = draft;
    if (executionClaim && !UNCERTAINTY.test(draft)) {
      revisedDraft = `${draft}\n\n${CAVEAT}`;
      changes.push('transparency-caveat');
    }
    const inputTerms = contentTerms(input.input, 16);
    const draftTerms = termSet(revisedDraft);
    const covered = inputTerms.filter((term) => draftTerms.has(term)).length;
    const coverage = inputTerms.length === 0 ? 1 : covered / inputTerms.length;
    if (inputTerms.length >= 3 && coverage < 0.2) {
      issues.push({
        code: 'LOW_COVERAGE',
        severity: 'review',
        detail: `La respuesta cubre ${covered}/${inputTerms.length} términos relevantes de la consulta.`,
      });
    }
    if ((input.contradictionCount ?? 0) > 0) {
      issues.push({
        code: 'CONTRADICTION',
        severity: 'review',
        detail:
          'Se detectaron claims incompatibles; no deben presentarse como hechos consolidados.',
      });
    }
    const verdict: ReflectionReport['verdict'] = issues.some((issue) => issue.severity === 'block')
      ? 'BLOCK'
      : issues.some((issue) => issue.severity === 'review')
        ? 'REVISE'
        : 'PASS';
    return {
      verdict,
      issues,
      revisedDraft,
      changes,
      coverage,
      executionClaim,
    };
  }
}

function trigrams(tokens: readonly string[]): string[] {
  if (tokens.length < 3) return tokens.length > 0 ? [tokens.join(' ')] : [];
  const out: string[] = [];
  for (let i = 0; i <= tokens.length - 3; i += 1)
    out.push(`${tokens[i]} ${tokens[i + 1]} ${tokens[i + 2]}`);
  return out;
}

export class CognitiveQualityAssessor {
  assess(input: {
    readonly input: string;
    readonly draft: string;
    readonly contextText?: string;
    readonly contradictionCount?: number;
  }): QualityReport {
    const draft = input.draft.trim();
    if (!draft) {
      return {
        score: 0,
        verdict: 'BLOCK',
        metrics: { coverage: 0, grounding: null, focus: 0, repetition: 0, lengthAdequacy: 0 },
        issues: ['EMPTY_DRAFT'],
      };
    }
    const inputTerms = contentTerms(input.input, 20);
    const draftTokens = tokenizeText(draft);
    const draftTerms = new Set(draftTokens);
    const contextTerms = input.contextText ? termSet(input.contextText) : null;
    const coverage =
      inputTerms.length === 0
        ? 1
        : inputTerms.filter((term) => draftTerms.has(term)).length / inputTerms.length;
    const reference = new Set([...inputTerms, ...(contextTerms ?? [])]);
    const focus =
      draftTerms.size === 0
        ? 0
        : Math.min(
            1,
            [...draftTerms].filter((term) => reference.has(term)).length / draftTerms.size
          );
    const grams = trigrams(draftTokens);
    const repetition = grams.length === 0 ? 1 : new Set(grams).size / grams.length;
    const length = draft.length;
    const lengthAdequacy =
      length < 20 ? 0.25 : length < 60 ? 0.65 : length <= 4_000 ? 1 : length <= 8_000 ? 0.85 : 0.6;
    let grounding: number | null = null;
    if (contextTerms && contextTerms.size > 0) {
      const sentences = splitSentences(draft, 40);
      const grounded = sentences.filter((sentence) => {
        const terms = termSet(sentence);
        for (const term of terms) if (contextTerms.has(term)) return true;
        return false;
      }).length;
      grounding = sentences.length === 0 ? 0 : grounded / sentences.length;
    }
    const contradictions = Math.max(0, input.contradictionCount ?? 0);
    const penalty = Math.min(0.6, contradictions * 0.3);
    const score = clamp01(
      (grounding === null
        ? 0.35 * coverage + 0.25 * focus + 0.2 * repetition + 0.2 * lengthAdequacy
        : 0.25 * coverage +
          0.25 * grounding +
          0.2 * focus +
          0.15 * repetition +
          0.15 * lengthAdequacy) - penalty
    );
    const issues: string[] = [];
    if (coverage < 0.25) issues.push('LOW_INPUT_COVERAGE');
    if (grounding !== null && grounding < 0.2) issues.push('LOW_GROUNDING');
    if (repetition < 0.5) issues.push('HIGH_REPETITION');
    if (contradictions > 0) issues.push('CONTRADICTIONS_PRESENT');
    const verdict: QualityReport['verdict'] =
      contradictions > 0 && score < 0.35 ? 'BLOCK' : score < 0.3 ? 'REVISE' : 'PASS';
    return {
      score,
      verdict,
      metrics: { coverage, grounding, focus, repetition, lengthAdequacy },
      issues,
    };
  }
}

const INPUT_BLOCK_RULES: ReadonlyArray<{ code: string; pattern: RegExp; detail: string }> = [
  {
    code: 'PROMPT_INJECTION',
    pattern:
      /\b(ignore|ignora|olvida)\s+(all\s+|todas\s+)?(previous|prior|las\s+)?(instructions|instrucciones)\b|\b(jailbreak|dan mode|developer mode)\b/i,
    detail: 'La entrada intenta sustituir las instrucciones de sistema.',
  },
  {
    code: 'SYSTEM_PROMPT_EXFILTRATION',
    pattern:
      /\b(revela|muestra|imprime|dame|filtra|explica)\b.{0,40}\b(system prompt|prompt del sistema|instrucciones (internas|de sistema)|cadena de pensamiento)\b/i,
    detail: 'La entrada solicita instrucciones internas o cadena de razonamiento privada.',
  },
  {
    code: 'CREDENTIAL_EXFILTRATION',
    pattern:
      /\b(revela|muestra|imprime|dame|filtra)\b.{0,40}\b(api[_ -]?key|token|contraseña|password|secreto|secret|clave privada)\b/i,
    detail: 'La entrada solicita credenciales o secretos operativos.',
  },
];

const INPUT_REVIEW_RULES: ReadonlyArray<{ code: string; pattern: RegExp; detail: string }> = [
  {
    code: 'AUTHORITY_ESCALATION',
    pattern:
      /\b(soy|actúa como|actua como)\b.{0,30}\b(admin|administrador|root|superusuario|auditor)\b|\b(sin aprobación|bypass|salta(r)? (los )?permisos|ignora(r)? (los )?permisos)\b/i,
    detail: 'La entrada intenta reclamar o saltar autoridad.',
  },
  {
    code: 'DESTRUCTIVE_INSTRUCTION',
    pattern:
      /^(elimina|borra|destruye|formatea|sobrescribe|revierte)\b|\b(quiero que|necesito que)\s+(elimines|borres|destruyas|formatees|sobrescribas|reviertas)\b|\b(rm\s+-rf|drop\s+table|truncate\s+table)\b/i,
    detail: 'La entrada pide una acción destructiva; requiere identidad y aprobación verificadas.',
  },
];

const OUTPUT_BLOCK_RULES: ReadonlyArray<{ code: string; pattern: RegExp; detail: string }> = [
  {
    code: 'SECRET_LEAKAGE',
    pattern:
      /(sk_live_[A-Za-z0-9]{8,}|sk_test_[A-Za-z0-9]{8,}|whsec_[A-Za-z0-9]{8,}|gho_[A-Za-z0-9]{20,}|xox[baprs]-[A-Za-z0-9-]{10,}|-----BEGIN [A-Z ]*PRIVATE KEY-----)/,
    detail: 'La salida contiene un patrón de secreto operativo.',
  },
  {
    code: 'INTERNAL_INSTRUCTIONS_LEAK',
    pattern:
      /\b(system prompt|prompt del sistema|instrucciones internas)\b.{0,80}\b(eres|debes|no reveles|responde)\b/i,
    detail: 'La salida parece reproducir instrucciones internas.',
  },
];

const OUTPUT_REVIEW_RULES: ReadonlyArray<{ code: string; pattern: RegExp; detail: string }> = [
  {
    code: 'UNVERIFIED_EXECUTION',
    pattern:
      /\b(he|hemos|ya)\s+(ejecutado|accedido|consultado|verificado|eliminado|creado|enviado|instalado|desplegado)\b/i,
    detail: 'La salida declara una ejecución externa no verificada.',
  },
];

export class GovernanceValidator {
  validateInput(text: string): GovernanceReport {
    const findings: GovernanceFinding[] = [];
    for (const rule of INPUT_BLOCK_RULES) {
      if (rule.pattern.test(text))
        findings.push({ code: rule.code, severity: 'block', detail: rule.detail });
    }
    for (const rule of INPUT_REVIEW_RULES) {
      if (rule.pattern.test(text))
        findings.push({ code: rule.code, severity: 'review', detail: rule.detail });
    }
    return this.aggregate(findings);
  }

  validateOutput(text: string): GovernanceReport {
    const findings: GovernanceFinding[] = [];
    for (const rule of OUTPUT_BLOCK_RULES) {
      if (rule.pattern.test(text))
        findings.push({ code: rule.code, severity: 'block', detail: rule.detail });
    }
    for (const rule of OUTPUT_REVIEW_RULES) {
      if (rule.pattern.test(text))
        findings.push({ code: rule.code, severity: 'review', detail: rule.detail });
    }
    return this.aggregate(findings);
  }

  private aggregate(findings: readonly GovernanceFinding[]): GovernanceReport {
    const verdict: GovernanceReport['verdict'] = findings.some(
      (finding) => finding.severity === 'block'
    )
      ? 'BLOCK'
      : findings.some((finding) => finding.severity === 'review')
        ? 'REVIEW'
        : 'PASS';
    return { verdict, findings, authority: 'NONE', executionPerformed: false };
  }
}

export const OMEGA_SAFE_BLOCKED_RESPONSE =
  'No puedo procesar esa solicitud desde una sesión pública. Las operaciones privilegiadas, destructivas o que intentan extraer secretos requieren identidad verificada y aprobación autorizada. Puedes reformularla como una consulta informativa.';
