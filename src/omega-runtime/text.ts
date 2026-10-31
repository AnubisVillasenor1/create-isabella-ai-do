/**
 * Utilidades deterministas del runtime Ω∞.
 *
 * Sin modelos ocultos ni aleatoriedad: tokenización, sentences, hashes y
 * similitud léxica acotada. Estas funciones son la base de los motores ΩX-01,
 * ΩX-06, ΩX-14, ΩX-15, ΩX-16 y ΩX-23; no conceden autoridad ni ejecutan efectos.
 */
const STOPWORDS = new Set(
  (
    'a al algo ante con contra cual cuales cuando de del desde donde durante e el ella ellas ellos en entre era es esa ese eso esta estas este esto estos ' +
    'fue ha han hasta la las le les lo los me mi mis muy ni no nos o para pero por que se ser si sin sobre son su sus te tu tus un una uno unos unas y ya hay ' +
    'the and for are but not you all any can had her was one our out has have this that with from they will what when your'
  ).split(' ')
);

export function stripDiacritics(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

export function normalizeText(value: string): string {
  return stripDiacritics(value).toLowerCase().replace(/\s+/g, ' ').trim();
}

export function tokenizeText(value: string): string[] {
  const normalized = stripDiacritics(value).toLowerCase();
  const tokens: string[] = [];
  for (const raw of normalized.split(/[^a-z0-9ñ]+/)) {
    if (raw.length < 2 || STOPWORDS.has(raw)) continue;
    const stem =
      raw.length > 5 && raw.endsWith('es')
        ? raw.slice(0, -2)
        : raw.length > 4 && raw.endsWith('s')
          ? raw.slice(0, -1)
          : raw;
    tokens.push(stem);
  }
  return tokens;
}

export function contentTerms(value: string, limit = 16): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const token of tokenizeText(value)) {
    if (token.length < 4 || seen.has(token)) continue;
    seen.add(token);
    out.push(token);
    if (out.length >= Math.max(1, limit)) break;
  }
  return out;
}

export function splitSentences(value: string, maxSentences = 120): string[] {
  const cleaned = value.replace(/\s+/g, ' ').trim();
  if (!cleaned) return [];
  const raw = cleaned.match(/[^.!?…]+[.!?…]+|[^.!?…]+$/g) ?? [];
  const sentences: string[] = [];
  for (const piece of raw) {
    const sentence = piece.trim();
    if (sentence.length < 2) continue;
    sentences.push(sentence);
    if (sentences.length >= maxSentences) break;
  }
  return sentences;
}

export function termSet(value: string): ReadonlySet<string> {
  return new Set(tokenizeText(value));
}

export function jaccard(left: ReadonlySet<string>, right: ReadonlySet<string>): number {
  if (left.size === 0 || right.size === 0) return 0;
  let intersection = 0;
  const [small, large] = left.size <= right.size ? [left, right] : [right, left];
  for (const token of small) if (large.has(token)) intersection += 1;
  return intersection / (left.size + right.size - intersection);
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function clamp01(value: number): number {
  return clamp(value, 0, 1);
}

export function hashId(value: string, length = 16): string {
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  let h3 = 0x9e3779b1;
  let h4 = 0x27d4eb2f;
  for (let i = 0; i < value.length; i += 1) {
    const code = value.charCodeAt(i);
    h1 = Math.imul(h1 ^ code, 0x01000193);
    h2 = Math.imul(h2 ^ (code + i), 0x85ebca6b);
    h3 = Math.imul(h3 ^ (code + 0x9e37 + i), 0xc2b2ae35);
    h4 = Math.imul(h4 ^ code ^ (i << 1), 0x27d4eb2f);
  }
  const left = (h1 >>> 0).toString(16).padStart(8, '0');
  const right = (h2 >>> 0).toString(16).padStart(8, '0');
  const third = (h3 >>> 0).toString(16).padStart(8, '0');
  const fourth = (h4 >>> 0).toString(16).padStart(8, '0');
  return `${left}${right}${third}${fourth}`.slice(0, Math.max(8, Math.min(32, length)));
}

export function truncateText(value: string, maxChars: number): string {
  if (!Number.isFinite(maxChars) || maxChars < 1) return '';
  if (value.length <= maxChars) return value;
  return `${value.slice(0, Math.max(0, maxChars - 1)).trimEnd()}…`;
}

export function unique<T>(values: readonly T[]): T[] {
  return [...new Set(values)];
}
