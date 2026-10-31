import { createHash } from 'node:crypto';
import type { Principal } from '../identity/principal';
import type { ToolDescriptor } from './registry';

function record(input: unknown): Record<string, unknown> {
  return input && typeof input === 'object' && !Array.isArray(input)
    ? (input as Record<string, unknown>)
    : { value: input };
}

function stable(input: unknown): string {
  return JSON.stringify(input, Object.keys(record(input)).sort()) ?? 'null';
}

function digest(input: unknown): string {
  return createHash('sha256').update(stable(input), 'utf8').digest('hex');
}

function text(input: unknown): string {
  const value = record(input).text ?? record(input).value ?? '';
  return String(value).normalize('NFC').trim();
}

function descriptor(
  id: string,
  operation: string,
  description: string,
  execute: (input: unknown, principal: Principal) => unknown
): ToolDescriptor {
  return {
    id,
    version: '1.0.0',
    methodId: `N.IDENTITY.E00_IDENTITY.${operation}.v1.0.0.LOW.INSTITUTIONAL`,
    owner: 'isabella-local-deterministic',
    riskTier: 'LOW',
    scopes: ['read:deterministic-tools'],
    description,
    execute: async (input, principal) => execute(input, principal),
  };
}

export const DETERMINISTIC_TOOLS: readonly ToolDescriptor[] = [
  descriptor(
    'local_text_normalize',
    'normalize_text',
    'Normaliza Unicode NFC y espacios sin efectos externos.',
    (input) => ({ text: text(input), length: text(input).length })
  ),
  descriptor(
    'local_text_tokenize',
    'tokenize_text',
    'Tokeniza texto por palabras Unicode de forma reproducible.',
    (input) => ({ tokens: text(input).match(/[\\p{L}\\p{N}]+/gu) ?? [] })
  ),
  descriptor(
    'local_text_hash',
    'hash_text',
    'Calcula SHA-256 de un texto normalizado.',
    (input) => ({ sha256: digest(text(input)), algorithm: 'SHA-256' })
  ),
  descriptor(
    'local_text_stats',
    'text_stats',
    'Calcula estadísticas básicas de texto sin inferencia generativa.',
    (input) => {
      const value = text(input);
      return {
        characters: value.length,
        words: value.match(/[\\p{L}\\p{N}]+/gu)?.length ?? 0,
        lines: value ? value.split(/\\r?\\n/).length : 0,
      };
    }
  ),
  descriptor(
    'local_json_canonicalize',
    'canonicalize_json',
    'Produce una representación JSON estable y su hash.',
    (input) => ({ canonical: stable(input), sha256: digest(input) })
  ),
  descriptor(
    'local_array_unique',
    'unique_values',
    'Elimina duplicados preservando el orden de entrada.',
    (input) => ({
      values: [
        ...new Set(Array.isArray(input) ? input : ((record(input).values as unknown[]) ?? [])),
      ],
    })
  ),
  descriptor(
    'local_array_sort',
    'sort_values',
    'Ordena valores escalares de manera determinista.',
    (input) => ({
      values: [
        ...(Array.isArray(input) ? input : ((record(input).values as unknown[]) ?? [])),
      ].sort((a, b) => String(a).localeCompare(String(b), 'es')),
    })
  ),
  descriptor(
    'local_number_stats',
    'number_stats',
    'Calcula suma, mínimo, máximo y promedio de números finitos.',
    (input) => {
      const values = (Array.isArray(input) ? input : ((record(input).values as unknown[]) ?? []))
        .map(Number)
        .filter(Number.isFinite);
      const sum = values.reduce((a, b) => a + b, 0);
      return {
        count: values.length,
        sum,
        min: values.length ? Math.min(...values) : null,
        max: values.length ? Math.max(...values) : null,
        mean: values.length ? sum / values.length : null,
      };
    }
  ),
  descriptor(
    'local_date_normalize',
    'normalize_date',
    'Normaliza una fecha ISO y declara si es válida.',
    (input) => {
      const value = String(record(input).date ?? record(input).value ?? '');
      const date = new Date(value);
      return {
        input: value,
        valid: !Number.isNaN(date.valueOf()),
        iso: Number.isNaN(date.valueOf()) ? null : date.toISOString(),
      };
    }
  ),
  descriptor(
    'local_claim_frame',
    'frame_claim',
    'Clasifica un enunciado como hecho, inferencia o hipótesis declarada.',
    (input) => {
      const value = text(input);
      const lower = value.toLowerCase();
      const type = /podría|quizá|tal vez|hipótesis/.test(lower)
        ? 'HYPOTHESIS'
        : /porque|por tanto|se infiere|sugiere/.test(lower)
          ? 'INFERENCE'
          : 'CLAIM_REQUIRES_EVIDENCE';
      return { type, text: value, evidenceRequired: type !== 'HYPOTHESIS' };
    }
  ),
  descriptor(
    'local_similarity_terms',
    'compare_terms',
    'Compara intersección y diferencia de términos entre dos textos.',
    (input) => {
      const data = record(input);
      const words = (value: unknown) =>
        new Set(
          String(value ?? '')
            .toLowerCase()
            .match(/[\\p{L}\\p{N}]+/gu) ?? []
        );
      const left = words(data.left);
      const right = words(data.right);
      return {
        intersection: [...left].filter((item) => right.has(item)),
        onlyLeft: [...left].filter((item) => !right.has(item)),
        onlyRight: [...right].filter((item) => !left.has(item)),
      };
    }
  ),
  descriptor(
    'local_provenance_stamp',
    'stamp_provenance',
    'Genera una huella de procedencia sin afirmar verificación humana.',
    (input, principal) => ({
      inputHash: digest(input),
      principalId: principal.id,
      state: 'draft',
      verifiedByHuman: false,
      timestamp: new Date().toISOString(),
    })
  ),
];
