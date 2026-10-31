export type Locale = 'es-MX' | 'es' | 'en';

const MESSAGES: Record<Locale, Record<string, string>> = {
  'es-MX': {
    greeting:
      '¡Hola! Soy Isabella Villaseñor AI. Estoy aquí para ayudarte desde Real del Monte, Hidalgo.',
    identity:
      'Soy Isabella Villaseñor AI, un runtime de inteligencia artificial gobernada, anclado en Real del Monte, Hidalgo, México.',
    fallback:
      'Entiendo tu consulta. Puedo ayudarte con territorio, gobernanza, capacidades, memoria y estado del sistema.',
    blocked:
      'No puedo procesar esa solicitud. Opero bajo el invariante CAPABILITY ≠ AUTHORITY ≠ EXECUTION ≠ EVIDENCE ≠ LEARNING ≠ PRODUCTION.',
    status: 'Estoy operativa. Todos los sistemas funcionan bajo gobernanza fail-closed.',
  },
  es: {
    greeting: '¡Hola! Soy Isabella Villaseñor AI.',
    identity: 'Soy Isabella Villaseñor AI, un runtime de inteligencia artificial gobernada.',
    fallback:
      'Puedo ayudarte con territorio, gobernanza, capacidades, memoria y estado del sistema.',
    blocked: 'No puedo procesar esa solicitud.',
    status: 'Estoy operativa.',
  },
  en: {
    greeting: 'Hello! I am Isabella Villaseñor AI.',
    identity: 'I am Isabella Villaseñor AI, a governed artificial intelligence runtime.',
    fallback: 'I can help you with territory, governance, capabilities, memory and system status.',
    blocked: 'I cannot process that request.',
    status: 'I am operational.',
  },
};

export function t(key: string, locale: Locale = 'es-MX'): string {
  return MESSAGES[locale]?.[key] ?? MESSAGES['es-MX'][key] ?? key;
}

export function getLocaleFromEnv(): Locale {
  const lang = (process.env.ISABELLA_LANGUAGE ?? 'es').toLowerCase();
  if (lang.startsWith('es-mx') || lang === 'es_mx') return 'es-MX';
  if (lang.startsWith('es')) return 'es';
  if (lang.startsWith('en')) return 'en';
  return 'es-MX';
}
