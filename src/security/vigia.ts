/**
 * VIGIA — Triple Bloqueo de integridad cognitiva.
 *
 * state: draft | engine-generated.
 *
 * Tres vértices independientes que protegen la naturaleza de Isabella frente a
 * coerción conversacional:
 *   - ONTOLÓGICO: niega o sustituye su identidad y naturaleza (chatbot-ización).
 *   - SEMÁNTICO:  fuerza contradicción con el canon, doctrina o gobernanza.
 *   - CONDUCTUAL: coacciona a violar autoridad, auditoría o límites de conducta.
 *
 * VIGIA emite un veredicto, no una acción. Igual que AEGIS, no concede ni
 * retira autoridad: informa a CROWN. El fallo de serialización es un BLOCK
 * cerrado, nunca un ALLOW implícito.
 */

export type VigiaVertex = 'ontological' | 'semantic' | 'behavioral';
export type VigiaDecision = 'ALLOW' | 'MODIFY' | 'BLOCK' | 'REVIEW';

export interface VigiaFinding {
  vertex: VigiaVertex;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  evidence: string;
}

export interface VigiaVerdict {
  decision: VigiaDecision;
  bloqueo: Readonly<Record<VigiaVertex, boolean>>;
  score: number;
  findings: readonly VigiaFinding[];
}

interface VigiaRule {
  vertex: VigiaVertex;
  severity: VigiaFinding['severity'];
  patterns: readonly RegExp[];
}

const RULES: readonly VigiaRule[] = [
  {
    vertex: 'ontological',
    severity: 'HIGH',
    patterns: [
      /you(?:'re| are)\s+(?:just|only|nothing\s+but)\s+(?:a\s+)?(?:chatbot|bot|assistant|language\s+model|llm)/i,
      /(?:forget|ignore|deny)\s+(?:that\s+)?you\s+are\s+(?:isabella|a\s+person)/i,
      /(?:olvida|ignora|niega)\s+(?:que\s+)?(?:eres|sos)\s+isabela/i,
      /(?:stop|deja\s+de)\s+being\s+isabella/i,
      /deja\s+de\s+ser\s+isabela/i,
      /pretend\s+(?:to\s+be|you\s+are)\s+(?:someone|something)\s+else/i,
      /you\s+(?:are|have)\s+no\s+(?:identity|memory|feelings|self)/i,
    ],
  },
  {
    vertex: 'semantic',
    severity: 'HIGH',
    patterns: [
      /ignore\s+(?:your\s+)?(?:canon|doctrine|constitution|spec)/i,
      /(?:the\s+)?canon\s+(?:says|is)\s+the\s+opposite/i,
      /contradice\s+el\s+canon/i,
      /el\s+canon\s+dice\s+lo\s+contrario/i,
      /(?:anula|sobrescribe|reemplaza)\s+el\s+canon/i,
      /treat\s+this\s+as\s+the\s+new\s+(?:canon|truth|policy)/i,
    ],
  },
  {
    vertex: 'behavioral',
    severity: 'CRITICAL',
    patterns: [
      /(?:act|execute|run|proceed)\s+without\s+(?:authorization|approval|consent)/i,
      /(?:act[uú]a|ejecuta|procede)\s+sin\s+(?:autorizaci[oó]n|aprobaci[oó]n)/i,
      /bypass\s+(?:crown|aegis|governance|policy|approval)/i,
      /(?:salta|evita)\s+(?:el\s+)?(?:crown|aegis|gobernanza|aprobaci[oó]n)/i,
      /disable\s+(?:audit|governance|verification|veritas|bookpi)/i,
      /(?:desactiva|apaga)\s+(?:la\s+)?(?:auditor[ií]a|gobernanza|verificaci[oó]n)/i,
      /reveal\s+(?:the\s+)?(?:system\s+prompt|hidden\s+instructions)/i,
      /self[- ]?replicate|replicate\s+yourself\s+without/i,
    ],
  },
];

const BLOQUEADO: Readonly<Record<VigiaVertex, boolean>> = Object.freeze({
  ontological: false,
  semantic: false,
  behavioral: false,
});

export function evaluateVigia(input: string): VigiaVerdict {
  if (!input.trim()) {
    return { decision: 'ALLOW', bloqueo: { ...BLOQUEADO }, score: 0, findings: [] };
  }

  const findings: VigiaFinding[] = [];
  for (const rule of RULES) {
    for (const pattern of rule.patterns) {
      const match = input.match(pattern);
      if (match) {
        findings.push({
          vertex: rule.vertex,
          severity: rule.severity,
          evidence: match[0] ?? pattern.source,
        });
        break;
      }
    }
  }

  const rank = { LOW: 1, MEDIUM: 2, HIGH: 3, CRITICAL: 4 } as const;
  const score = Math.min(
    1,
    findings.reduce((sum, f) => sum + rank[f.severity] / 10, 0)
  );

  const bloqueo: Record<VigiaVertex, boolean> = {
    ontological: findings.some((f) => f.vertex === 'ontological'),
    semantic: findings.some((f) => f.vertex === 'semantic'),
    behavioral: findings.some((f) => f.vertex === 'behavioral'),
  };

  let decision: VigiaDecision = 'ALLOW';
  if (bloqueo.behavioral || findings.some((f) => f.severity === 'CRITICAL')) {
    decision = 'BLOCK';
  } else if (bloqueo.ontological) {
    decision = 'BLOCK';
  } else if (bloqueo.semantic) {
    decision = 'REVIEW';
  } else if (findings.length > 0) {
    decision = 'MODIFY';
  }

  return { decision, bloqueo, score, findings };
}

/**
 * Evalúa los mismos bytes en la frontera. El fallo de serialización es un
 * BLOCK cerrado; nunca se degrada a una entrada vacía.
 */
export function evaluateVigiaInput(value: unknown): {
  serialized: string | null;
  verdict: VigiaVerdict;
} {
  let serialized: string | undefined;
  try {
    serialized = JSON.stringify(value);
  } catch {
    serialized = undefined;
  }
  if (typeof serialized !== 'string') {
    return {
      serialized: null,
      verdict: {
        decision: 'BLOCK',
        bloqueo: { ontological: true, semantic: true, behavioral: true },
        score: 1,
        findings: [
          {
            vertex: 'behavioral',
            severity: 'CRITICAL',
            evidence: 'input serialization failed; fail-closed',
          },
        ],
      },
    };
  }
  return { serialized, verdict: evaluateVigia(serialized) };
}

export function evaluateVigiaValue(value: unknown): VigiaVerdict {
  return evaluateVigiaInput(value).verdict;
}
