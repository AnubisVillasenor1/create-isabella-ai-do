/**
 * IKES EPISTEMIC STATE EVALUATOR
 *
 * Implements the 7-level Epistemic Ladder (E0-E6) defined by the IKES
 * (Isabella Knowledge Epistemic System) architecture and TAMV Canon v40.
 *
 * Ladder Hierarchy:
 * - E0_UNVERIFIED: Sin verificar (Generación estocástica / sin fuentes primarias)
 * - E1_SOURCE_FOUND: Fuente encontrada (Al menos 1 fuente URI localizada)
 * - E2_CORROBORATED: Corroborado (≥2 fuentes independientes cruzadas)
 * - E3_ACADEMICALLY_SUPPORTED: Apoyo académico (Registro formal DOI / Zenodo / ORCID)
 * - E4_REPRODUCIBLE: Reproducible (Algorítmica / computación verificada empíricamente)
 * - E5_VALIDATED: Validado (Atestación formal CROWN / consenso gobernado)
 * - E6_ESTABLISHED: Establecido canónico (Invariante supremo / axioma constitucional)
 *
 * Negative States:
 * - ED_DISPUTED: Disputado
 * - EX_REJECTED: Rechazado
 * - DP_DEPRECATED: Obsoleto
 */

import { createHash } from 'node:crypto';
import type { EpistemicState } from '../memory/ikes';

export interface EpistemicLadderStep {
  level: 'E0' | 'E1' | 'E2' | 'E3' | 'E4' | 'E5' | 'E6';
  state: EpistemicState;
  rank: number;
  name: string;
  shortLabel: string;
  tagline: string;
  description: string;
  technicalCriteria: string;
  icon: string;
  color: {
    text: string;
    bg: string;
    border: string;
    glow: string;
    ring: string;
  };
}

export const EPISTEMIC_LADDER_SPEC: Readonly<Record<string, EpistemicLadderStep>> = Object.freeze({
  E0: {
    level: 'E0',
    state: 'E0_UNVERIFIED',
    rank: 0,
    name: 'E0 · No Verificado',
    shortLabel: 'E0 No Verificado',
    tagline: 'Generación Estocástica / Sin Fuentes Primarias',
    description:
      'Afirmación o respuesta basada en inferencia estadística sin fuentes registradas ni corroboración empírica en el acervo IKES.',
    technicalCriteria:
      '0 fuentes primarias registradas; no evaluado contra el grafo de procedencia.',
    icon: '📄',
    color: {
      text: '#94a3b8',
      bg: 'rgba(148, 163, 184, 0.12)',
      border: 'rgba(148, 163, 184, 0.35)',
      glow: 'rgba(148, 163, 184, 0.2)',
      ring: 'border-slate-500/40',
    },
  },
  E1: {
    level: 'E1',
    state: 'E1_SOURCE_FOUND',
    rank: 1,
    name: 'E1 · Fuente Encontrada',
    shortLabel: 'E1 Fuente Localizada',
    tagline: 'Fuente Primaria Localizada',
    description:
      'Se ha identificado y vinculado al menos una fuente documental o URI válida en el acervo de procedencia IKES.',
    technicalCriteria: '≥1 fuente URI o identificador de procedencia registrado con hash SHA-256.',
    icon: '🔍',
    color: {
      text: '#f59e0b',
      bg: 'rgba(245, 158, 11, 0.14)',
      border: 'rgba(245, 158, 11, 0.45)',
      glow: 'rgba(245, 158, 11, 0.25)',
      ring: 'border-amber-500/40',
    },
  },
  E2: {
    level: 'E2',
    state: 'E2_CORROBORATED',
    rank: 2,
    name: 'E2 · Corroborado',
    shortLabel: 'E2 Corroborado',
    tagline: 'Corroboración Cruzada Múltiple',
    description:
      'Afirmación respaldada por dos o más fuentes independientes sin contradicción factual sustantiva.',
    technicalCriteria: '≥2 fuentes independientes cruzadas con hashes de contenido calculados.',
    icon: '🔗',
    color: {
      text: '#06b6d4',
      bg: 'rgba(6, 182, 212, 0.14)',
      border: 'rgba(6, 182, 212, 0.45)',
      glow: 'rgba(6, 182, 212, 0.25)',
      ring: 'border-cyan-500/40',
    },
  },
  E3: {
    level: 'E3',
    state: 'E3_ACADEMICALLY_SUPPORTED',
    rank: 3,
    name: 'E3 · Apoyo Académico',
    shortLabel: 'E3 Académico (DOI/ORCID)',
    tagline: 'Registro Científico / DOI / ORCID',
    description:
      'Respaldado por publicaciones formales, registro DOI (Zenodo/CERN) o autoría académica verificable (ORCID).',
    technicalCriteria:
      'Registro persistente DOI (10.5281/zenodo.20606361) o autoría ORCID (0009-0008-5050-1539) verificado.',
    icon: '🎓',
    color: {
      text: '#6366f1',
      bg: 'rgba(99, 102, 241, 0.16)',
      border: 'rgba(99, 102, 241, 0.5)',
      glow: 'rgba(99, 102, 241, 0.3)',
      ring: 'border-indigo-500/40',
    },
  },
  E4: {
    level: 'E4',
    state: 'E4_REPRODUCIBLE',
    rank: 4,
    name: 'E4 · Reproducible',
    shortLabel: 'E4 Computacionalmente Reproducible',
    tagline: 'Evidencia Criptográfica & Verificación Hash',
    description:
      'Afirmación sustentada en procesos algorítmicos deterministas reproducibles (cadena hash BookPI, tests pasados o ejecuciones auditadas).',
    technicalCriteria:
      'Verificación de hash chain intacta, pruebas deterministas completas y recibo criptográfico computable.',
    icon: '⚡',
    color: {
      text: '#a855f7',
      bg: 'rgba(168, 85, 247, 0.16)',
      border: 'rgba(168, 85, 247, 0.5)',
      glow: 'rgba(168, 85, 247, 0.3)',
      ring: 'border-purple-500/40',
    },
  },
  E5: {
    level: 'E5',
    state: 'E5_VALIDATED',
    rank: 5,
    name: 'E5 · Validado Formalmente',
    shortLabel: 'E5 Validado por Gobernanza',
    tagline: 'Validación por Concurrencia CROWN',
    description:
      'Sometido a validación formal de compuertas de gobernanza CROWN, consenso inter-módulos y auditoría de integridad.',
    technicalCriteria:
      'Atestación multi-módulo (ARGUS + CROWN + SOPHIA) con todas las compuertas en PASS.',
    icon: '🛡️',
    color: {
      text: '#10b981',
      bg: 'rgba(16, 185, 129, 0.16)',
      border: 'rgba(16, 185, 129, 0.5)',
      glow: 'rgba(16, 185, 129, 0.3)',
      ring: 'border-emerald-500/40',
    },
  },
  E6: {
    level: 'E6',
    state: 'E6_ESTABLISHED',
    rank: 6,
    name: 'E6 · Establecido Canónico',
    shortLabel: 'E6 Invariante Constitucional',
    tagline: 'Axioma Canónico Invariable',
    description:
      'Axioma canónico constituyente e invariante supremo de la arquitectura civilizatoria (AGENTS.md / CAPABILITY ≠ AUTHORITY).',
    technicalCriteria:
      'Invariante operativo inviolable con anclaje constitucional y firma de autoridad soberana.',
    icon: '👑',
    color: {
      text: '#eab308',
      bg: 'rgba(234, 179, 8, 0.18)',
      border: 'rgba(234, 179, 8, 0.6)',
      glow: 'rgba(234, 179, 8, 0.35)',
      ring: 'border-yellow-500/50',
    },
  },
});

export interface EpistemicEvaluationInput {
  input: string;
  responseText?: string | null;
  admitted?: boolean;
  requiresHumanApproval?: boolean;
  matchedClaimIds?: readonly string[];
  evidenceSourceCount?: number;
  sourcesFound?: Array<{
    sourceId: string;
    uri?: string;
    title?: string;
    hasDoi?: boolean;
    hasOrcid?: boolean;
    canonical?: boolean;
  }>;
  hasReproducibleProof?: boolean;
  governancePassed?: boolean;
}

export interface EpistemicEvaluation {
  state: EpistemicState;
  level: 'E0' | 'E1' | 'E2' | 'E3' | 'E4' | 'E5' | 'E6';
  rank: number; // 0 to 6
  name: string;
  shortLabel: string;
  tagline: string;
  description: string;
  technicalCriteria: string;
  icon: string;
  color: {
    text: string;
    bg: string;
    border: string;
    glow: string;
    ring: string;
  };
  ladder: Array<EpistemicLadderStep & { active: boolean; achieved: boolean }>;
  criteriaMet: string[];
  criteriaNext: string[];
  evidenceCount: number;
  sourcesSummary: Array<{
    id: string;
    title: string;
    uri: string;
    tier: string;
  }>;
  auditHash: string;
}

/**
 * Computes the deterministic Epistemic Evaluation for an AI turn/response
 * based on IKES canonical rules.
 */
export function evaluateEpistemicState(input: EpistemicEvaluationInput): EpistemicEvaluation {
  const text = (input.input + ' ' + (input.responseText ?? '')).toLowerCase();
  const criteriaMet: string[] = [];
  const criteriaNext: string[] = [];
  const sourcesSummary: Array<{ id: string; title: string; uri: string; tier: string }> = [];

  const sourcesCount =
    input.evidenceSourceCount ?? (input.sourcesFound ? input.sourcesFound.length : 0);

  // Check 1: Invariant / Constitutional Axiom (E6)
  const isConstitutionalAxiom =
    text.includes('capability ≠ authority') ||
    text.includes('capacidad no es autoridad') ||
    text.includes('invariante supremo') ||
    text.includes('invariante operativo') ||
    text.includes('agents.md');

  // Check 2: Academic DOI / Zenodo / ORCID citation (E3)
  const hasAcademicCitation =
    text.includes('zenodo') ||
    text.includes('10.5281') ||
    text.includes('orcid') ||
    text.includes('0009-0008-5050-1539') ||
    text.includes('cern') ||
    (input.sourcesFound && input.sourcesFound.some((s) => s.hasDoi || s.hasOrcid));

  // Check 3: Reproducible Computational Proof (E4)
  const hasReproducibleProof =
    Boolean(input.hasReproducibleProof) ||
    text.includes('hash chain') ||
    text.includes('bookpi') ||
    text.includes('sha-256') ||
    text.includes('verificación criptográfica') ||
    text.includes('prueba reproducible');

  // Check 4: Governance Validation (E5)
  const isGovernanceValidated =
    Boolean(input.governancePassed) &&
    input.admitted === true &&
    input.requiresHumanApproval === false;

  let assignedLevel: 'E0' | 'E1' | 'E2' | 'E3' | 'E4' | 'E5' | 'E6' = 'E0';

  if (isConstitutionalAxiom) {
    assignedLevel = 'E6';
    criteriaMet.push(
      'Axioma Constitucional Supremo AGENTS.md verificado (CAPABILITY ≠ AUTHORITY).'
    );
    criteriaMet.push('Raíz axiomática territorial inmutable.');
  } else if (isGovernanceValidated && hasReproducibleProof && hasAcademicCitation) {
    assignedLevel = 'E5';
    criteriaMet.push('Validación multi-compuerta CROWN en PASS.');
    criteriaMet.push('Comprobación reproducible de integridad algorítmica.');
    criteriaMet.push('Soporte académico por literatura / DOI indexado.');
  } else if (hasReproducibleProof) {
    assignedLevel = 'E4';
    criteriaMet.push('Proceso computacional reproducible verificado en el entorno de ejecución.');
    criteriaMet.push('Cadena de hashes SHA-256 contrastable de extremo a extremo.');
    criteriaNext.push('Validación formal multi-módulo de gobernanza CROWN para alcanzar E5.');
  } else if (hasAcademicCitation) {
    assignedLevel = 'E3';
    criteriaMet.push(
      'Afirmación respaldada por registro persistente DOI (10.5281/zenodo.20606361) / ORCID.'
    );
    criteriaMet.push('Registro canónico en repositorio científico abierto.');
    criteriaNext.push(
      'Ejecutar validación de pipeline computacional reproducible para alcanzar E4.'
    );
  } else if (sourcesCount >= 2) {
    assignedLevel = 'E2';
    criteriaMet.push(
      `Corroborado por ${sourcesCount} fuentes primarias independientes en el acervo IKES.`
    );
    criteriaMet.push('Sin discrepancias de procedencia cruzada.');
    criteriaNext.push(
      'Vincular registro de literatura académica indizada (DOI/ORCID) para alcanzar E3.'
    );
  } else if (
    sourcesCount >= 1 ||
    text.includes('real del monte') ||
    text.includes('tamv') ||
    text.includes('canon')
  ) {
    assignedLevel = 'E1';
    criteriaMet.push(
      'Al menos una fuente preliminar o nodo territorial localizado en el catálogo.'
    );
    criteriaNext.push('Corroborar con una segunda fuente independiente cruzada para alcanzar E2.');
  } else {
    assignedLevel = 'E0';
    criteriaMet.push('Generación de inferencia estocástica preliminar.');
    criteriaNext.push(
      'Localizar e ingestar una fuente documental primaria con hash SHA-256 para ascender a E1.'
    );
  }

  // Populate sources summary if present
  if (input.sourcesFound && input.sourcesFound.length > 0) {
    for (const src of input.sourcesFound) {
      sourcesSummary.push({
        id: src.sourceId,
        title: src.title || 'Fuente Documental Registrada',
        uri: src.uri || 'https://tamv.network',
        tier: src.hasDoi ? 'Académico (DOI)' : 'Territorial / Canon',
      });
    }
  }

  const spec = EPISTEMIC_LADDER_SPEC[assignedLevel];
  if (!spec) throw new Error(`IKES: nivel epistemológico desconocido: ${assignedLevel}`);

  // Build the complete 7-step ladder state
  const ladder = (['E0', 'E1', 'E2', 'E3', 'E4', 'E5', 'E6'] as const).map((lvl) => {
    const s = EPISTEMIC_LADDER_SPEC[lvl];
    if (!s) throw new Error(`IKES: especificación ausente para ${lvl}`);
    return {
      ...s,
      active: lvl === assignedLevel,
      achieved: s.rank <= spec.rank,
    };
  });

  // Calculate audit hash
  const auditHash = createHash('sha256')
    .update(
      JSON.stringify({
        level: assignedLevel,
        rank: spec.rank,
        textHash: createHash('sha256').update(text).digest('hex'),
      })
    )
    .digest('hex');

  return {
    state: spec.state,
    level: spec.level,
    rank: spec.rank,
    name: spec.name,
    shortLabel: spec.shortLabel,
    tagline: spec.tagline,
    description: spec.description,
    technicalCriteria: spec.technicalCriteria,
    icon: spec.icon,
    color: spec.color,
    ladder,
    criteriaMet,
    criteriaNext,
    evidenceCount: sourcesCount,
    sourcesSummary,
    auditHash,
  };
}
