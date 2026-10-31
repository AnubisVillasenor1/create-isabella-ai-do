/**
 * Deterministic local intent detection for the HyperCore Turbo fast lane.
 *
 * state: wired | tested (unit). Only short, unambiguous conversational intents are
 * recognised. A match lets Isabella answer from deterministic local code without
 * waiting for an external provider. It never grants authority, executes a side
 * effect, or claims to be a language model.
 */

export type LocalIntent =
  | 'greeting'
  | 'thanks'
  | 'identity'
  | 'capabilities'
  | 'privacy'
  | 'presence'
  | 'calculation'
  | 'time'
  | 'platform-status'
  | 'skills'
  | 'knowledge';

export function normalizeLocalInput(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^[¿¡\s]+/, '')
    .replace(/[\s?!.,;:]+$/, '');
}

const GREETING =
  /^(hola|holi|buenas|buenos dias|buenas tardes|buenas noches|que tal|hey|hello|hi)[.!?, ]*$/;
const THANKS = /^(gracias|muchas gracias|mil gracias|te agradezco|thanks|thank you)[.!?, ]*$/;
const IDENTITY = /^(quien eres|quien es isabella|que eres|como te llamas|tu identidad)[.!?, ]*$/;
const CAPABILITIES =
  /^(que puedes hacer|como me puedes ayudar|que sabes hacer|capacidades|ayuda|que herramientas tienes|que skills tienes)[.!?, ]*$/;
const PRIVACY =
  /^(privacidad|mis datos|guardas mis datos|almacenas mi historial|donde esta mi historial)[.!?, ]*$/;
const PRESENCE =
  /^(estas ahi|me escuchas|puedes conversar|funcionas|respondes|sigues ahi)[.!?, ]*$/;
const TIME =
  /^(que hora es|que hora tienes|hora actual|dime la hora|me dices la hora|fecha de hoy|que dia es hoy|fecha actual)[.!?, ]*$/;
const PLATFORM_STATUS =
  /^(estado|status|estado del nodo|estado del sistema|estado de la plataforma|como esta el nodo|como esta el sistema|salud del nodo|healthcheck|health check)[.!?, ]*$/;
const PLATFORM_STATUS_REQUEST =
  /^(dame|dime|muestra|muestrame|necesito|quiero|puedes (darme|mostrarme|decirme)|podrias (darme|mostrarme|decirme))\b.{0,160}\b(estado|status|salud)\b.{0,80}\b(nodo|sistema|plataforma|servicio|proceso)\b/;
const SKILLS =
  /^(skills|que skills hay|skills disponibles|habilidades|que habilidades hay|lista de skills)[.!?, ]*$/;
const KNOWLEDGE_QUERY =
  /^(que es|que son|explica|explicame|hablame de|cuentame de|informacion sobre|info sobre|como funciona|como funcionan|para que sirve|que significa|detalles de)\b/;
const KNOWLEDGE_TOPIC =
  /\b(hypercore|turbo|bookpi|marketplace|gobernanza|invariante|privacidad|planes|precios|facturacion|stripe|integraciones|api|openai|mcp|skills|agentes|modelos gratuitos|open source|ollama|openrouter|voz|multimodal|subpaginas|plataforma|readiness|salud|limites|tamv|isabella)\b/;
const MATH_PREFIX = /^(calcula|calcular|cuanto es|cuanto da|resuelve|resolver)\b/;
const MATH_ONLY = /^[\d\s().+\-*/%^]+$/;
const ISO_DATE = /^\d{4}[/-]\d{1,2}[/-]\d{1,2}$/;

/** Extract a bounded arithmetic expression from a recognised calculation request. */
export function extractMathExpression(input: string): string | null {
  const normalized = input
    .trim()
    .replace(/^[¿?¡!\s]+/, '')
    .replace(/[¿?¡!\s]+$/, '');
  const normalizedLower = normalizeLocalInput(normalized);
  const withoutPrefix = normalizedLower.replace(MATH_PREFIX, '').replace(/^[\s:]+/, '');
  const hasOperator = /[+\-*/%^]/.test(withoutPrefix);
  // Take only the leading numeric expression so a trailing explanation does not
  // disqualify a valid calculation. A bare date is never treated as arithmetic.
  const candidate = (withoutPrefix.replace(/\s+/g, '').match(/^[\d().+\-*/%^]+/) ?? [''])[0];
  if (
    hasOperator &&
    MATH_ONLY.test(candidate) &&
    !ISO_DATE.test(candidate) &&
    candidate.length >= 3 &&
    candidate.length <= 120
  ) {
    return candidate;
  }
  return null;
}

/**
 * Detect one of the bounded local intents. Long or ambiguous prompts return null
 * so the governed provider path keeps responsibility for general questions.
 */
export function detectLocalIntent(input: string): LocalIntent | null {
  const raw = input.trim();
  if (raw.length === 0 || raw.length > 240) return null;
  const normalized = normalizeLocalInput(raw);
  if (GREETING.test(normalized)) return 'greeting';
  if (THANKS.test(normalized)) return 'thanks';
  if (IDENTITY.test(normalized)) return 'identity';
  if (CAPABILITIES.test(normalized)) return 'capabilities';
  if (PRIVACY.test(normalized)) return 'privacy';
  if (PRESENCE.test(normalized)) return 'presence';
  if (TIME.test(normalized)) return 'time';
  if (PLATFORM_STATUS.test(normalized) || PLATFORM_STATUS_REQUEST.test(normalized))
    return 'platform-status';
  if (SKILLS.test(normalized)) return 'skills';
  if (extractMathExpression(raw) !== null) return 'calculation';
  if (KNOWLEDGE_QUERY.test(normalized) && KNOWLEDGE_TOPIC.test(normalized)) return 'knowledge';
  return null;
}

export function isAgentableIntent(intent: LocalIntent | null): intent is LocalIntent {
  return (
    intent === 'calculation' ||
    intent === 'time' ||
    intent === 'platform-status' ||
    intent === 'skills' ||
    intent === 'knowledge'
  );
}

export function isConversationalIntent(intent: LocalIntent | null): intent is LocalIntent {
  return (
    intent === 'greeting' ||
    intent === 'thanks' ||
    intent === 'identity' ||
    intent === 'capabilities' ||
    intent === 'privacy' ||
    intent === 'presence'
  );
}
