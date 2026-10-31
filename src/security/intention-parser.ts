export type IntentDomain =
  | 'submission'
  | 'library'
  | 'constitution'
  | 'governance'
  | 'ecosystem'
  | 'education'
  | 'skills'
  | 'ethics';

export interface IntentResult {
  domain: IntentDomain;
  confidence: number;
  traceId: string;
}

const PATTERNS: Array<{ domain: IntentDomain; patterns: RegExp[]; weight: number }> = [
  { domain: 'submission', patterns: [/enviar|submit|upload|subir|publicar/i], weight: 0.8 },
  { domain: 'library', patterns: [/biblioteca|library|documento|archivo|buscar/i], weight: 0.7 },
  {
    domain: 'constitution',
    patterns: [/constituci.n|constitution|crown|manifiesto/i],
    weight: 0.9,
  },
  { domain: 'governance', patterns: [/gobernanza|governance|policy|pol.tica|rbac/i], weight: 0.85 },
  { domain: 'ecosystem', patterns: [/ecosistema|ecosystem|tamv|isabella/i], weight: 0.75 },
  { domain: 'education', patterns: [/educaci.n|education|aprender|tutorial|curso/i], weight: 0.7 },
  { domain: 'skills', patterns: [/skill|habilidad|tool|herramienta|automatizar/i], weight: 0.8 },
  { domain: 'ethics', patterns: [/ética|etica|ethics|moral|responsabilidad/i], weight: 0.85 },
];

export function parseIntent(input: string): IntentResult {
  const traceId = `trace-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  let best: { domain: IntentDomain; confidence: number } = { domain: 'ecosystem', confidence: 0.3 };
  for (const rule of PATTERNS) {
    if (rule.patterns.some((p) => p.test(input))) {
      if (rule.weight > best.confidence) {
        best = { domain: rule.domain, confidence: rule.weight };
      }
    }
  }
  return { domain: best.domain, confidence: best.confidence, traceId };
}
