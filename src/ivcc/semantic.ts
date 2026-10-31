/**
 * Layer 1: Cognitive Semantic Interpreter (deterministic).
 * Intent, urgency, certainty, sentiment, entities, clause boundaries and emphasis
 * candidates are lexical/punctuation heuristics with explicit confidence. This is
 * not a trained language model and does not persist the text it reads.
 */
import { splitSentences, stripDiacritics } from '../omega-runtime/text';
import { clamp01, round } from './util';
import type { EmphasisTarget, SemanticClause, SemanticInterpretation, SpeechIntent } from './types';

const WARN_RE =
  /\b(?:alerta|advertencia|peligro|riesgo|error|falla|fallo|vulnerabilidad|crítico|critico|urgente|emergencia|aviso)\b/;
const APOLOGY_RE = /\b(?:lo siento|lamento|perdón|perdon|disculpa|disculpe|mis disculpas)\b/;
const CELEBRATE_RE =
  /\b(?:felicidades|felicitaciones|celebremos|celebramos|logramos|excelente|genial|increíble|increible|bravo|enhorabuena)\b/;
const REQUEST_RE =
  /\b(?:por favor|necesito|necesitamos|quiero que|quisiera|podrías|podrias|puedes|ayúdame|ayudame|solicito|requiero|haz|hazme|genera|crea|envía|envia|revisa|corrige|implementa)\b/;
const QUESTION_START_RE =
  /^(?:qué|que|quién|quien|cuándo|cuando|dónde|donde|cómo|como|por qué|por que|cuál|cual|puedes|podrías|podrias|hay|is|are|what|when|where|how|why|who|can|could|do|does|did)\b/;
const GREETING_RE = /^(?:hola|buenas|buenos días|buenos dias|qué tal|que tal|hey|hi|hello)\b/;
const URGENCY_RE =
  /\b(?:urgente|inmediato|inmediata|ahora mismo|ya mismo|cuanto antes|emergencia|crítico|critico|hoy|antes de|plazo|vence|vencemos)\b/g;
const HEDGE_RE =
  /\b(?:quizá|quiza|tal vez|puede ser|creo|diría|diria|probablemente|posiblemente|aproximadamente|supongo)\b/g;
const BOOSTER_RE =
  /\b(?:definitivamente|sin duda|seguro|segura|confirmado|confirmada|siempre|obviamente|claramente)\b/g;
const NEGATION_RE = /\b(?:no|nunca|jamás|jamas|nada|ningún|ningun|ninguna|tampoco|ni)\b/;
const CONTRAST_RE = /\b(?:pero|sin embargo|aunque|no obstante|en cambio|mientras que)\b/;
const SUPERVISIVE_RE =
  /\b(?:mejor|peor|máximo|maximo|mínimo|minimo|primero|último|ultimo|más|mas|menos|muy|totalmente|absolutamente)\b/;
const POSITIVE_RE =
  /\b(?:bien|bueno|buena|excelente|genial|gracias|felicidades|logramos|listo|correcto|seguro|confiable|mejor|amor|gusta|encanta|perfecto|increíble|increible|éxito|exito)\b/g;
const NEGATIVE_RE =
  /\b(?:mal|malo|mala|error|falla|fallo|problema|riesgo|peligro|triste|enojado|molesto|no funciona|perdimos|fallamos|grave|crítico|critico|urgente)\b/g;

const SPANISH_STOPWORDS = new Set(
  'a al algo ante con contra cual cuales cuando de del desde donde durante e el ella ellas ellos en entre era es esa ese eso esta estas este esto estos fue ha han hasta la las le les lo los me mi mis muy ni no nos o para pero por que se ser si sin sobre son su sus te tu tus un una uno unos unas y ya hay como más mas está estan están este esta'.split(
    ' '
  )
);
const ENGLISH_STOPWORDS = new Set(
  'the and for are but not you all any can had her was one our out has have this that with from they will what when your about into over just also than then them these those'.split(
    ' '
  )
);
const TOPIC_STOPWORDS = new Set([...SPANISH_STOPWORDS, ...ENGLISH_STOPWORDS]);

function words(value: string): string[] {
  return (
    stripDiacritics(value)
      .toLowerCase()
      .match(/[a-z0-9ñ]+/g) ?? []
  );
}

function detectLanguage(normalized: string): 'es' | 'en' | 'mixed' {
  let es = 0;
  let en = 0;
  for (const word of words(normalized)) {
    if (SPANISH_STOPWORDS.has(word)) es += 1;
    else if (ENGLISH_STOPWORDS.has(word)) en += 1;
  }
  if (es === 0 && en === 0) return 'es';
  if (es > 0 && en > 0 && Math.min(es, en) / Math.max(es, en) >= 0.35) return 'mixed';
  return en > es ? 'en' : 'es';
}

function hasQuestion(text: string, normalized: string): boolean {
  return /[?¿]/.test(text) || QUESTION_START_RE.test(normalized);
}

function clauseIntent(text: string, normalized: string): SpeechIntent {
  if (WARN_RE.test(normalized)) return 'WARN';
  if (APOLOGY_RE.test(normalized)) return 'APOLOGIZE';
  if (CELEBRATE_RE.test(normalized)) return 'CELEBRATE';
  if (hasQuestion(text, normalized)) return 'QUESTION';
  if (REQUEST_RE.test(normalized)) return 'REQUEST';
  if (GREETING_RE.test(normalized) && words(normalized).length <= 6) return 'CONVERSATIONAL';
  return 'INFORM';
}

function sentimentOf(normalized: string): number {
  const tokens = words(normalized);
  let positive = 0;
  let negative = 0;
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index]!;
    const isPositive = new RegExp(POSITIVE_RE.source).test(token);
    const isNegative = new RegExp(NEGATIVE_RE.source).test(token);
    if (!isPositive && !isNegative) continue;
    const negated = tokens.slice(Math.max(0, index - 3), index).some((w) => NEGATION_RE.test(w));
    if ((isPositive && !negated) || (isNegative && negated)) positive += 1;
    else negative += 1;
  }
  const total = positive + negative;
  return total === 0 ? 0 : round((positive - negative) / total, 3);
}

function urgencyOf(text: string, normalized: string): number {
  let urgency = 0;
  for (const match of normalized.match(URGENCY_RE) ?? []) {
    urgency +=
      match === 'hoy' || match === 'plazo' || match === 'vence' || match === 'vencemos'
        ? 0.2
        : 0.42;
  }
  urgency += Math.min(0.24, (text.match(/!/g) ?? []).length * 0.12);
  return round(clamp01(urgency), 3);
}

function certaintyOf(text: string, normalized: string): number {
  const hedges = (normalized.match(HEDGE_RE) ?? []).length;
  const boosters = (normalized.match(BOOSTER_RE) ?? []).length;
  let certainty = 0.55 + boosters * 0.18 - hedges * 0.2;
  if (hasQuestion(text, normalized)) certainty -= 0.12;
  return round(Math.min(0.95, Math.max(0.08, certainty)), 3);
}

function topicsOf(normalized: string): string[] {
  const counts = new Map<string, { count: number; first: number }>();
  words(normalized).forEach((word, index) => {
    if (word.length < 4 || TOPIC_STOPWORDS.has(word) || /^\d+$/.test(word)) return;
    const entry = counts.get(word);
    if (entry) entry.count += 1;
    else counts.set(word, { count: 1, first: index });
  });
  return [...counts.entries()]
    .sort((a, b) => b[1].count - a[1].count || a[1].first - b[1].first)
    .slice(0, 8)
    .map(([word]) => word);
}

function entitiesOf(text: string): string[] {
  const found = new Set<string>();
  for (const match of text.matchAll(/\b[A-ZÁÉÍÓÚÜÑ][\wÁÉÍÓÚÑáéíóúüñ.-]{1,30}\b/g)) {
    const value = match[0].replace(/[.-]+$/, '');
    if (value.length < 2) continue;
    if (SPANISH_STOPWORDS.has(value.toLowerCase())) continue;
    found.add(value);
    if (found.size >= 12) break;
  }
  return [...found];
}

interface Candidate {
  readonly text: string;
  readonly strength: number;
  readonly reasons: string[];
}

function emphasisForClause(text: string, entities: readonly string[]): Candidate[] {
  const matches = [...text.matchAll(/[A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9$%€]+/g)];
  const candidates: Candidate[] = [];
  const lastTokenIndex = matches.length - 1;
  matches.forEach((match, index) => {
    const token = match[0];
    const lower = stripDiacritics(token).toLowerCase();
    if (lower.length < 2 || TOPIC_STOPWORDS.has(lower)) return;
    const reasons: string[] = [];
    let strength = 0;
    if (/[$%€]|\d/.test(token) && token.length <= 16) {
      strength += 0.55;
      reasons.push('cantidad verificable');
    }
    if (NEGATION_RE.test(lower)) {
      strength += 0.4;
      reasons.push('negación');
    }
    if (new RegExp(URGENCY_RE.source).test(lower) || /urgente|inmediat|crític|critic/.test(lower)) {
      strength += 0.45;
      reasons.push('marcador de urgencia');
    }
    if (WARN_RE.test(lower)) {
      strength += 0.4;
      reasons.push('término de riesgo');
    }
    if (SUPERVISIVE_RE.test(lower)) {
      strength += 0.28;
      reasons.push('cuantificador o superlativo');
    }
    if (CONTRAST_RE.test(lower)) {
      strength += 0.25;
      reasons.push('contraste');
    }
    if (entities.some((entity) => stripDiacritics(entity).toLowerCase() === lower)) {
      strength += 0.3;
      reasons.push('nombre propio');
    }
    if (/^[A-ZÁÉÍÓÚÜÑ]{2,}$/.test(token)) {
      strength += 0.4;
      reasons.push('mayúsculas sostenidas');
    }
    if (index === lastTokenIndex && lower.length >= 5) {
      strength += 0.12;
      reasons.push('cierre de cláusula');
    }
    if (strength >= 0.35) {
      candidates.push({ text: token, strength: round(clamp01(strength), 3), reasons });
    }
  });
  return candidates.sort((a, b) => b.strength - a.strength).slice(0, 4);
}

function clausesOf(
  text: string,
  normalized: string
): { clauses: SemanticClause[]; emphasis: EmphasisTarget[] } {
  const sentences = splitSentences(text, 120);
  const clauses: SemanticClause[] = [];
  const emphasis: EmphasisTarget[] = [];
  let cursor = 0;
  sentences.forEach((sentence, index) => {
    const found = text.indexOf(sentence, cursor);
    const start = found >= 0 ? found : cursor;
    const end = start + sentence.length;
    cursor = end;
    const normalizedSentence = stripDiacritics(sentence).toLowerCase().trim();
    const intent = clauseIntent(sentence, normalizedSentence);
    const localEntities = entitiesOf(sentence);
    const candidates = emphasisForClause(sentence, localEntities);
    clauses.push({
      index,
      text: sentence,
      start,
      end,
      terminal: /[.!?…]$/.test(sentence) ? sentence.slice(-1) : '',
      intent,
      sentiment: sentimentOf(normalizedSentence),
      emphasis: candidates.map((candidate) => candidate.text),
    });
    for (const candidate of candidates) {
      emphasis.push({
        text: candidate.text,
        clauseIndex: index,
        strength: candidate.strength,
        reasons: candidate.reasons,
      });
    }
  });
  if (!clauses.length && normalized) {
    const intent = clauseIntent(text, normalized);
    clauses.push({
      index: 0,
      text,
      start: 0,
      end: text.length,
      terminal: '',
      intent,
      sentiment: sentimentOf(normalized),
      emphasis: [],
    });
  }
  return { clauses, emphasis };
}

function overallIntent(clauses: readonly SemanticClause[]): SpeechIntent {
  if (!clauses.length) return 'INFORM';
  const counts = new Map<SpeechIntent, number>();
  for (const clause of clauses) counts.set(clause.intent, (counts.get(clause.intent) ?? 0) + 1);
  for (const priority of ['WARN', 'APOLOGIZE', 'CELEBRATE', 'QUESTION', 'REQUEST'] as const) {
    if ((counts.get(priority) ?? 0) > 0) return priority;
  }
  if ((counts.get('CONVERSATIONAL') ?? 0) === clauses.length) return 'CONVERSATIONAL';
  return 'INFORM';
}

export function interpretSemantics(text: string): SemanticInterpretation {
  const normalized = stripDiacritics(text).toLowerCase().replace(/\s+/g, ' ').trim();
  const { clauses, emphasis } = clausesOf(text, normalized);
  const intent = overallIntent(clauses);
  const tokenCount = words(normalized).length;
  const urgency = urgencyOf(text, normalized);
  const certainty = certaintyOf(text, normalized);
  const confidence = round(
    clamp01(0.35 + Math.min(0.4, tokenCount / 40) + (urgency > 0.3 ? 0.15 : 0)),
    3
  );
  return {
    intent,
    language: detectLanguage(normalized),
    sentiment: sentimentOf(normalized),
    urgency,
    certainty,
    confidence,
    topics: topicsOf(normalized),
    entities: entitiesOf(text),
    clauses,
    emphasis,
    tokens: tokenCount,
  };
}
