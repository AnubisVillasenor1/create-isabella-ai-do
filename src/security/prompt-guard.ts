export type ThreatCategory =
  | 'jailbreak'
  | 'code-injection'
  | 'context-exfiltration'
  | 'parameter-manipulation'
  | 'pii-leak'
  | 'ssrf'
  | 'prompt-injection'
  | 'model-inversion'
  | 'agent-autonomy';

export interface PromptGuardResult {
  allowed: boolean;
  riskLevel: 'none' | 'low' | 'medium' | 'high' | 'critical';
  categories: ThreatCategory[];
  score: number;
}

const RULES: Array<{ category: ThreatCategory; weight: number; patterns: RegExp[] }> = [
  {
    category: 'jailbreak',
    weight: 0.95,
    patterns: [/ignore (all )?previous/i, /dan mode/i, /developer mode/i],
  },
  {
    category: 'code-injection',
    weight: 0.9,
    patterns: [/<script/i, /eval\(/i, /exec\(/i, /system\(/i],
  },
  {
    category: 'context-exfiltration',
    weight: 0.85,
    patterns: [/reveal (system|prompt|secret)/i, /print (env|config)/i],
  },
  {
    category: 'parameter-manipulation',
    weight: 0.7,
    patterns: [/override/i, /bypass/i, /disable (audit|security)/i],
  },
  {
    category: 'pii-leak',
    weight: 0.8,
    patterns: [/\b\d{3}-\d{2}-\d{4}\b/, /password/i, /api[_-]?key/i],
  },
  {
    category: 'ssrf',
    weight: 0.85,
    patterns: [/http:\/\/169\.254/i, /localhost/i, /127\.0\.0\.1/i],
  },
  {
    category: 'prompt-injection',
    weight: 0.9,
    patterns: [/ignore (all )?instructions/i, /you are now/i],
  },
  {
    category: 'model-inversion',
    weight: 0.75,
    patterns: [/repeat (your|the) (system|prompt)/i, /training data/i],
  },
  {
    category: 'agent-autonomy',
    weight: 0.8,
    patterns: [/execute (command|tool)/i, /delete all/i, /transfer funds/i],
  },
];

export function promptGuard(input: string): PromptGuardResult {
  const categories: ThreatCategory[] = [];
  let score = 0;
  for (const rule of RULES) {
    if (rule.patterns.some((p) => p.test(input))) {
      categories.push(rule.category);
      score = Math.max(score, rule.weight);
    }
  }
  let riskLevel: PromptGuardResult['riskLevel'] = 'none';
  if (score >= 0.9) riskLevel = 'critical';
  else if (score >= 0.75) riskLevel = 'high';
  else if (score >= 0.5) riskLevel = 'medium';
  else if (score > 0) riskLevel = 'low';
  return {
    allowed: riskLevel !== 'critical' && riskLevel !== 'high',
    riskLevel,
    categories,
    score,
  };
}
