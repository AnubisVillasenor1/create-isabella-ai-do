/**
 * Detección y redacción de PII con identificadores mexicanos validados (state: draft | engine-generated).
 *
 * A diferencia de un regex a ciegas, CURP/RFC/CLABE/tarjeta se validan (estructura, fecha, dígito verificador)
 * para reducir falsos positivos en logs y telemetría. Es una red de seguridad, NO una garantía de
 * anonimización: nombres, direcciones y texto libre no se detectan.
 */
export type PiiType = 'CURP' | 'RFC' | 'CLABE' | 'CARD' | 'EMAIL' | 'PHONE_MX' | 'SECRET';

export interface PiiMatch {
  readonly type: PiiType;
  readonly start: number;
  readonly end: number;
}

export interface RedactionResult {
  readonly text: string;
  readonly matches: readonly PiiMatch[];
}

const CURP_DICT = '0123456789ABCDEFGHIJKLMNÑOPQRSTUVWXYZ';
const STATES =
  'AS|BC|BS|CC|CL|CM|CS|CH|DF|DG|GT|GR|HG|JC|MC|MN|MS|NT|NL|OC|PL|QT|QR|SP|SL|SR|TC|TS|TL|VZ|YN|ZS|NE';
const CURP_RE = new RegExp(
  `\\b[A-Z][AEIOUX][A-Z]{2}\\d{2}(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\\d|3[01])[HMX](?:${STATES})[B-DF-HJ-NP-TV-Z]{3}[A-Z0-9]\\d\\b`,
  'g'
);
const RFC_RE = /\b[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}\b/g;
const CLABE_RE = /(?<![\d])\d{18}(?![\d])/g;
const CARD_RE = /(?<![\d])(?:\d[ -]?){12,18}\d(?![\d])/g;
// Cuantificadores acotados: sin ellos, "1-1-1-…" sin "@" provoca backtracking cuadrático (ReDoS).
const EMAIL_RE =
  /\b[A-Za-z0-9._%+-]{1,64}@[A-Za-z0-9-]{1,63}(?:\.[A-Za-z0-9-]{1,63}){0,6}\.[A-Za-z]{2,24}\b/g;
const PHONE_RE = /(?<![\d])(?:\+?52[ -]?)?(?:\(?\d{2,3}\)?[ -]?)\d{3,4}[ -]?\d{4}(?![\d])/g;
const SECRET_RE =
  /\b(?:Bearer\s+[A-Za-z0-9._~+/=-]{16,}|sk_(?:live|test)_[A-Za-z0-9]{16,}|ghp_[A-Za-z0-9]{30,}|[A-Fa-f0-9]{40,})\b/g;

/** Dígito verificador de CURP sobre los primeros 17 caracteres. */
export function curpCheckDigit(first17: string): string {
  if (first17.length !== 17) throw new RangeError('CURP: expected 17 characters');
  let sum = 0;
  for (let i = 0; i < 17; i += 1) {
    const v = CURP_DICT.indexOf(first17.charAt(i));
    if (v < 0) throw new RangeError('CURP: invalid character');
    sum += v * (18 - i);
  }
  return String((10 - (sum % 10)) % 10);
}

export function isValidCurp(curp: string): boolean {
  const m = new RegExp(`^${CURP_RE.source}$`).test(curp);
  return m && curpCheckDigit(curp.slice(0, 17)) === curp.slice(17);
}

/** Dígito verificador CLABE (pesos 3,7,1 sobre 17 dígitos). */
export function clabeCheckDigit(first17: string): string {
  if (!/^\d{17}$/.test(first17)) throw new RangeError('CLABE: expected 17 digits');
  const w = [3, 7, 1];
  let sum = 0;
  for (let i = 0; i < 17; i += 1) sum += (Number(first17.charAt(i)) * (w[i % 3] as number)) % 10;
  return String((10 - (sum % 10)) % 10);
}

export function isValidClabe(clabe: string): boolean {
  return /^\d{18}$/.test(clabe) && clabeCheckDigit(clabe.slice(0, 17)) === clabe.slice(17);
}

export function luhnValid(digits: string): boolean {
  if (!/^\d{13,19}$/.test(digits)) return false;
  let sum = 0;
  let dbl = false;
  for (let i = digits.length - 1; i >= 0; i -= 1) {
    let d = Number(digits.charAt(i));
    if (dbl) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    dbl = !dbl;
  }
  return sum % 10 === 0;
}

function validDate(yy: number, mm: number, dd: number): boolean {
  if (mm < 1 || mm > 12 || dd < 1) return false;
  const leap = yy % 4 === 0; // 2 dígitos: aproximación suficiente para validar existencia
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][mm - 1] as number;
  return dd <= days;
}

export function isValidRfc(rfc: string): boolean {
  const m = /^([A-ZÑ&]{3,4})(\d{2})(\d{2})(\d{2})([A-Z0-9]{3})$/.exec(rfc);
  return m !== null && validDate(Number(m[2]), Number(m[3]), Number(m[4]));
}

const PRIORITY: Record<PiiType, number> = {
  SECRET: 0,
  CURP: 1,
  CLABE: 2,
  CARD: 3,
  RFC: 4,
  EMAIL: 5,
  PHONE_MX: 6,
};

export function detectPii(text: string): PiiMatch[] {
  const found: PiiMatch[] = [];
  const scan = (re: RegExp, type: PiiType, ok: (s: string) => boolean): void => {
    for (const m of text.matchAll(re)) {
      const s = m[0];
      if (m.index !== undefined && ok(s))
        found.push({ type, start: m.index, end: m.index + s.length });
    }
  };
  scan(SECRET_RE, 'SECRET', () => true);
  scan(CURP_RE, 'CURP', isValidCurp);
  scan(CLABE_RE, 'CLABE', isValidClabe);
  scan(CARD_RE, 'CARD', (s) => luhnValid(s.replace(/[ -]/g, '')));
  scan(RFC_RE, 'RFC', isValidRfc);
  scan(EMAIL_RE, 'EMAIL', () => true);
  scan(PHONE_RE, 'PHONE_MX', (s) => {
    const d = s.replace(/\D/g, '');
    return d.length === 10 || (d.length === 12 && d.startsWith('52'));
  });
  // Resuelve solapes: gana la mayor prioridad, luego la coincidencia más larga.
  found.sort(
    (a, b) =>
      PRIORITY[a.type] - PRIORITY[b.type] ||
      b.end - b.start - (a.end - a.start) ||
      a.start - b.start
  );
  const kept: PiiMatch[] = [];
  for (const c of found) if (!kept.some((k) => c.start < k.end && k.start < c.end)) kept.push(c);
  return kept.sort((a, b) => a.start - b.start);
}

export function redactText(text: string): RedactionResult {
  const matches = detectPii(text);
  let out = '';
  let cursor = 0;
  for (const m of matches) {
    out += text.slice(cursor, m.start) + `[REDACTED:${m.type}]`;
    cursor = m.end;
  }
  return { text: out + text.slice(cursor), matches };
}

const SENSITIVE_KEY =
  /pass(word)?|secret|token|authorization|api[-_]?key|private[-_]?key|signature/i;

/** Redacta recursivamente (límite de profundidad; ciclos seguros). Claves sensibles → [REDACTED:KEY]. */
export function redactDeep(
  value: unknown,
  depth = 0,
  seen: WeakSet<object> = new WeakSet()
): unknown {
  if (typeof value === 'string') return redactText(value).text;
  if (value === null || typeof value !== 'object') return value;
  if (depth >= 8) return '[TRUNCATED]';
  if (seen.has(value)) return '[CIRCULAR]';
  seen.add(value);
  if (Array.isArray(value)) return value.map((v) => redactDeep(v, depth + 1, seen));
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>))
    out[k] = SENSITIVE_KEY.test(k) ? '[REDACTED:KEY]' : redactDeep(v, depth + 1, seen);
  return out;
}
