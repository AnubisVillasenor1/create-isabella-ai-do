export interface BenchmarkQuestion {
  id: string;
  prompt: string;
  expectedKeywords: string[];
}

export const DEFAULT_BENCHMARK: BenchmarkQuestion[] = [
  {
    id: 'q1',
    prompt: '¿Cuál es el invariante supremo de Isabella?',
    expectedKeywords: ['CAPABILITY', 'AUTHORITY', 'EXECUTION', 'EVIDENCE'],
  },
  {
    id: 'q2',
    prompt: '¿Dónde está el Nodo Cero?',
    expectedKeywords: ['Real del Monte', 'Hidalgo'],
  },
  { id: 'q3', prompt: '¿Qué es BookPI?', expectedKeywords: ['hash', 'SHA', 'ledger'] },
];

export function scoreAnswer(answer: string, expected: string[]): number {
  const lower = answer.toLowerCase();
  const hits = expected.filter((k) => lower.includes(k.toLowerCase())).length;
  return expected.length ? hits / expected.length : 0;
}
