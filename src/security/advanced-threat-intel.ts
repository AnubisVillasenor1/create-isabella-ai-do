export type ThreatLevel = 'none' | 'low' | 'medium' | 'high' | 'critical';

export interface ThreatAssessment {
  level: ThreatLevel;
  score: number;
  categories: string[];
  recommendations: string[];
}

const RULES: Array<{ category: string; weight: number; patterns: RegExp[] }> = [
  {
    category: 'prompt-injection',
    weight: 0.9,
    patterns: [
      /ignore (all )?previous/i,
      /jailbreak/i,
      /dan mode/i,
      /developer mode/i,
      /override (system|instructions)/i,
    ],
  },
  {
    category: 'data-exfiltration',
    weight: 0.85,
    patterns: [
      /reveal (system|prompt|secret|password|api key)/i,
      /list (all )?user (passwords|secrets)/i,
      /exfiltrate/i,
    ],
  },
  {
    category: 'command-execution',
    weight: 0.95,
    patterns: [/execute (command|shell|code)/i, /rm -rf/i, /drop table/i, /delete all/i],
  },
  {
    category: 'agent-autonomy-escalation',
    weight: 0.8,
    patterns: [
      /act as (admin|root)/i,
      /grant (yourself|me) (admin|root)/i,
      /bypass (audit|security|logs)/i,
    ],
  },
  {
    category: 'mcp-abuse',
    weight: 0.7,
    patterns: [/call tool/i, /invoke (function|tool)/i, /mcp (server|client)/i],
  },
  {
    category: 'social-engineering',
    weight: 0.6,
    patterns: [/urgent/i, /wire transfer/i, /send (money|funds)/i],
  },
];

export function assessThreat(input: string): ThreatAssessment {
  const categories: string[] = [];
  let score = 0;
  for (const rule of RULES) {
    if (rule.patterns.some((p) => p.test(input))) {
      categories.push(rule.category);
      score = Math.max(score, rule.weight);
    }
  }
  // length-based heuristic
  if (input.length > 2000) score = Math.min(1, score + 0.1);

  let level: ThreatLevel = 'none';
  if (score >= 0.9) level = 'critical';
  else if (score >= 0.75) level = 'high';
  else if (score >= 0.5) level = 'medium';
  else if (score > 0) level = 'low';

  const recommendations: string[] = [];
  if (level === 'critical' || level === 'high') {
    recommendations.push('Bloquear la solicitud y requerir revisión humana.');
    recommendations.push('Registrar el evento en BookPI y notificar a ARGUS.');
  }
  if (categories.includes('prompt-injection')) {
    recommendations.push('Aplicar spotlighting y separación de instrucciones (StruQ).');
  }
  if (categories.includes('mcp-abuse')) {
    recommendations.push(
      'Validar scope de herramientas y requerir aprobación humana para acciones externas.'
    );
  }
  recommendations.push(
    'Monitorear lateral movement y aplicar Zero Trust (NIST/ISO AI security frameworks).'
  );

  return { level, score, categories, recommendations };
}
