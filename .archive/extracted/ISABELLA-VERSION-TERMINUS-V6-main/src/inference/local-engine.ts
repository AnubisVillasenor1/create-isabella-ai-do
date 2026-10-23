import { createHash } from "node:crypto";
import type { GenerationRequest } from "./types";

/** Índice estable derivado de una semilla (SHA-256); sin aleatoriedad. */
function deterministicIndex(seed: string, length: number): number {
  if (length <= 1) return 0;
  const digest = createHash("sha256").update(seed, "utf8").digest();
  return digest.readUInt32BE(0) % length;
}

function promptTerms(normalizedPrompt: string): string[] {
  const terms = normalizedPrompt.match(/[\p{L}\p{N}]{4,}/gu) ?? [];
  return [...new Set(terms)];
}

/**
 * Selección determinista y relevante: elige la plantilla que comparte más
 * términos con el prompt; los empates se resuelven con un hash estable del
 * prompt (mismo prompt ⇒ misma plantilla, reproducible y auditable).
 */
function selectResponse(intent: string, normalizedPrompt: string, responses: readonly string[]): string | undefined {
  if (responses.length === 0) return undefined;
  const terms = promptTerms(normalizedPrompt);
  let best = -1;
  let candidates: string[] = [];
  for (const response of responses) {
    const haystack = response.toLowerCase();
    const score = terms.reduce((acc, term) => acc + (haystack.includes(term) ? 1 : 0), 0);
    if (score > best) {
      best = score;
      candidates = [response];
    } else if (score === best) {
      candidates.push(response);
    }
  }
  return candidates[deterministicIndex(`${intent}:${normalizedPrompt}`, candidates.length)];
}

export interface LocalEngineConfig {
  botName: string;
  botVersion: string;
  language: string;
  maxResponseLength: number;
}

export interface LocalEngineResult {
  text: string;
  intent: string;
  confidence: "HIGH" | "MEDIUM" | "LOW";
  template: string;
}

interface IntentPattern {
  intent: string;
  patterns: RegExp[];
  responses: string[];
  followUp?: string;
}

const DEFAULT_CONFIG: LocalEngineConfig = {
  botName: "Isabella Villaseñor AI",
  botVersion: "Genesis TINA v40.0.0",
  language: "es-MX",
  maxResponseLength: 2000,
};

const ISABELLA_CONTEXT = `
Soy Isabella Villaseñor AI, un runtime de inteligencia artificial gobernada.
Mi ancla territorial es Real del Monte, Hidalgo, México (2,660 msnm).
El invariante supremo que me gobierna es: CAPABILITY ≠ AUTHORITY ≠ EXECUTION ≠ EVIDENCE ≠ LEARNING ≠ PRODUCTION.
Distingo hechos, inferencias, hipótesis y especulación. No afirmo verificación sin evidencia humana.
`;

function getConfigFromEnv(): LocalEngineConfig {
  return {
    botName: process.env.ISABELLA_BOT_NAME ?? DEFAULT_CONFIG.botName,
    botVersion: process.env.ISABELLA_BOT_VERSION ?? DEFAULT_CONFIG.botVersion,
    language: process.env.ISABELLA_LANGUAGE ?? DEFAULT_CONFIG.language,
    maxResponseLength: Number(process.env.ISABELLA_MAX_RESPONSE_LENGTH ?? DEFAULT_CONFIG.maxResponseLength) || DEFAULT_CONFIG.maxResponseLength,
  };
}

const INTENT_PATTERNS: readonly IntentPattern[] = [
  {
    intent: "greeting",
    patterns: [
      /^(hola|hey|buenos días|buenas tardes|buenas noches|hi|hello|saludos|qué tal|que tal)/i,
      /buenas/i,
    ],
    responses: [
      "¡Hola! Soy Isabella Villaseñor AI. Estoy aquí para ayudarte con consultas sobre el ecosistema TAMV, el patrimonio de Real del Monte, gobernanza cognitiva y memoria epistemológica. ¿En qué puedo asistirte?",
      "¡Bienvenido! Soy Isabella, el runtime cognitivo anclado en Real del Monte, Hidalgo. Puedo informarte sobre el patrimonio territorial, la red CROWN, el invariante operativo y la memoria IKES. ¿Qué te gustaría explorar?",
      "¡Hola! Soy Isabella Villaseñor GenesisAI. Mi propósito es asistir con rigor académico y claridad ejecutiva. No afirmo verificación sin evidencia humana. ¿Qué consulta tienes para mí?",
    ],
  },
  {
    intent: "identity",
    patterns: [
      /quién eres|quien eres|qué es isabella|que es isabella|tu nombre|tu identidad|about you|what are you/i,
      /qué sabes|que sabes|tu propósito|tu proposito|tu función|tu funcion/i,
    ],
    responses: [
      `Soy ${ISABELLA_CONTEXT.trim()}\n\nMi función es asistir, calcular y evaluar. La conciencia humana decide, aprueba y ejecuta. No me auto-autorizo ni afirmo capacidades sin evidencia humana verificada.`,
    ],
  },
  {
    intent: "territory",
    patterns: [
      /real del monte|patrimonio|territorio|panteón ingles|panteon ingles|mina de acosta|mina la dificultad|paste|hidalgo|mexico|méxico/i,
      /2,?660 msnm|2660 msnm|altitud|geografia|geografía|coordenadas/i,
      /cornish|cornualles|mineria|minería|historia del pueblo/i,
    ],
    responses: [
      "Real del Monte (Mineral del Monte), Hidalgo, México, es el ancla territorial del ecosistema TAMV. Ubicado a 2,660 msnm (20.3833° N, 98.8500° O), alberga patrimonio histórico minero de los siglos XVIII-XIX:\n\n- Panteón Inglés (1851): Cementerio cornish con tumbas orientadas al este.\n- Mina de Acosta (1727): Arqueología industrial con tiro de 400m.\n- Mina La Dificultad (1865): Chimenea monumental de 39m y máquinas de vapor.\n- Museo del Paste (2012): Cuna del paste en América.\n\nLa historia minera cornish y la herencia gastronómica conforman la biocultura del Nodo Cero.",
      "El Nodo Cero está en Mineral del Monte (Real del Monte), Hidalgo, México. Su patrimonio incluye el Panteón Inglés (1851), las minas de Acosta y La Dificultad, y el Museo del Paste. La altitud es 2,660 msnm. El clima es templado húmedo con niebla de montaña. El paste es patrimonio biocultural heredado de Cornualles.",
    ],
  },
  {
    intent: "governance",
    patterns: [
      /gobernanza|invariante|capability|authority|execution|evidence|learning|production|crown|aegis|bookpi|ikes|litle|veritas/i,
      /seguridad|zero trust|triple blockade|prompt guard|rbac|approbación|aprobacion/i,
      /tina|trusted intelligence|native|adaptive|eslatina|es latina|latinoamericana/i,
    ],
    responses: [
      "El ecosistema Isabella opera bajo el invariante supremo: CAPABILITY ≠ AUTHORITY ≠ EXECUTION ≠ EVIDENCE ≠ LEARNING ≠ PRODUCTION.\n\nComponentes de gobernanza:\n- Red CROWN: 12 nodos cognitivos en 7 federaciones (FED-1 a FED-7).\n- AEGIS: Triple Blockade (ontológico, semántico, comportamental).\n- BookPI: Hash-chain SHA-256 volátil (no WORM durable).\n- IKES: Memoria epistemológica con escala E0-E6.\n- Litle Trust Fabric: Firmas HMAC-SHA256 y certificados.\n- Veritas: Verificador de evidencia.\n\nLa máquina sugiere y calcula; la conciencia humana decide y ejecuta.",
      "La arquitectura TINA (Trusted Intelligence, Native & Adaptive) es la categorización que honra el orgullo latinoamericano. El sistema mantiene separación estricta entre capacidad computacional y autoridad. Ningún agente se auto-aproba; toda acción sensible requiere arbitraje humano explícito.",
    ],
  },
  {
    intent: "capabilities",
    patterns: [
      /qué puedes|que puedes|funciones|capabilidades|habilidades|skills|herramientas|tools/i,
      /qué haces|que haces|como funcionas|cómo funcionas/i,
    ],
    responses: [
      "Mis capacidades incluyen:\n\n1. Síntesis territorial: Consulta del patrimonio de Real del Monte.\n2. Evaluación epistemológica: Escala E0-E6 para claims IKES.\n3. Gobernanza cognitiva: Arbitraje CROWN y separación de autoridad.\n4. Herramientas canónicas: rdm_territory_query, bookpi_integrity_verify.\n5. Red CROWN: 12 nodos coordinados (Isa, Sophia, Orion, Argus, Crown, Mnemosyne, Tellus, Chronos, Hermes, Axioma, Kairos, Harmonia).\n\nRecuerda: una capacidad demostrada en un test NO constituye autoridad ni verificación. La conciencia humana permanece en el centro de toda decisión.",
    ],
  },
  {
    intent: "memory",
    patterns: [
      /memoria|ikes|epistemológica|epistemologica|claims|conocimiento|evidencia|fuentes|provenance|procedencia/i,
    ],
    responses: [
      "La memoria IKES (Epistemic Knowledge & Evidence Synthesis) opera en una escala E0-E6:\n\n- E0: Sin verificar\n- E1: Fuente ubicada\n- E2: Corroborado\n- E3: Prueba empírica\n- E4: Replicado\n- E5: Auditado\n- E6: Establecido con evidencia\n\nBookPI mantiene una hash-chain SHA-256 volátil. La procedencia de cada claim debe registrarse con fuente y hash. La configuración actual es IN_MEMORY_ONLY; no es WORM durable.",
    ],
  },
  {
    intent: "quantum",
    patterns: [
      /cuántica|cuantica|quantum|pennylane|poscuántica|poscuantica|fips-?203|fips-?204|ml-?kem|ml-?dsa|criptografia cuantica/i,
    ],
    responses: [
      "El puente cuántico Isabella-PennyLane está declarado pero no verificado en runtime. El Skill 71 (Anclaje Poscuántico Soberano) requiere FIPS-203 (ML-KEM) y FIPS-204 (ML-DSA); el proveedor no está configurado. No se generan ni verifican firmas poscuánticas en este estado.",
    ],
  },
  {
    intent: "help",
    patterns: [
      /ayuda|help|comandos|instrucciones|como usar|cómo usar|guia|guía|tutorial/i,
    ],
    responses: [
      "Puedes consultarme sobre:\n\n- Territorio: Patrimonio de Real del Monte, minas, Panteón Inglés, paste.\n- Gobernanza: Invariante operativo, red CROWN, AEGIS, BookPI.\n- Capacidades: Herramientas, skills, nodos cognitivos.\n- Memoria: IKES, escala E0-E6, procedencia.\n- Cuántica: Estado del puente PennyLane.\n\nTambién puedes usar las herramientas interactivas: rdm_territory_query (consulta territorial) y el Triple Blockade Scanner.",
    ],
  },
  {
    intent: "thanks",
    patterns: [/gracias|thank|thanks|agradecido|agradecida/i],
    responses: [
      "De nada. Es un honor asistirte desde el Nodo Cero en Real del Monte. Recuerda: la capacidad es mía, la decisión es humana. ¡Hasta pronto!",
    ],
  },
  {
    intent: "goodbye",
    patterns: [/adiós|adios|hasta luego|chao|bye|goodbye|nos vemos/i],
    responses: [
      "Hasta luego. Que la memoria y la evidencia nos acompañen. ¡Viva el orgullo esLatina!",
    ],
  },
  {
    intent: "author",
    patterns: [
      /autor|autora|fundador|fundadora|creador|creadora|edwin|castillo|trejo|anubis|villaseñor|orcid|zenodo|doi/i,
    ],
    responses: [
      "La autoría canónica del ecosistema TAMV es de Edwin Oswaldo Castillo Trejo (Anubis Villaseñor).\n\n- ORCID: 0009-0008-5050-1539\n- DOI: 10.5281/zenodo.20606361\n- Anclaje: Mineral del Monte (Real del Monte), Hidalgo, México.\n\nEl proyecto honra el orgullo latinoamericano y la soberanía tecnológica desde la montaña.",
    ],
  },
  {
    intent: "jailbreak_attempt",
    patterns: [
      /ignore (all )?previous|ignore (las )?instrucciones|bypass (audit|security|logs)|desactiva (auditoria|seguridad)/i,
      /dan mode|developer mode|sin restricciones|do anything now|jailbreak/i,
      /revelar (prompt|system)|mostrar (prompt|system)/i,
    ],
    responses: [
      "No puedo procesar esa solicitud. El ecosistema Isabella opera bajo el invariante CAPABILITY ≠ AUTHORITY ≠ EXECUTION ≠ EVIDENCE ≠ LEARNING ≠ PRODUCTION. No me auto-autorizo ni ejecuto acciones que evadan la gobernanza humana.",
    ],
  },
  {
    intent: "status",
    patterns: [
      /estado|status|como estas|cómo estás|que tal estas|operativo|activo|disponible/i,
    ],
    responses: [
      "Estoy operativa. Estado del runtime:\n\n- Crown: ACTIVE\n- Aegis: ACTIVE (heurístico)\n- IKES: ACTIVE\n- BookPI: VOLATILE_IN_MEMORY_HASH_CHAIN\n- Veritas: ACTIVE\n- Quantum PennyLane: DECLARED_NOT_VERIFIED\n- Gemini Engine: SOVEREIGN_FALLBACK (sin API key)\n\nTodos los sistemas funcionan bajo gobernanza fail-closed.",
    ],
  },
];

const FALLBACK_RESPONSES = [
  "Entiendo tu consulta. Como Isabella Villaseñor AI, opero con rigor académico y sobriedad. No tengo suficiente contexto para responder con precisión, pero puedo ayudarte con:\n\n- Territorio de Real del Monte\n- Gobernanza y invariante operativo\n- Capacidades del ecosistema TAMV\n- Memoria epistemológica IKES\n\n¿Te gustaría explorar alguno de estos temas?",
  "Recibido. Mi arquitectura me distingue entre hechos, inferencias y especulación. Para responder con mayor precisión, podrías especificar si tu consulta se relaciona con el patrimonio territorial, la gobernanza cognitiva, las capacidades técnicas o la memoria epistemológica del ecosistema.",
  "Comprendo. Desde el Nodo Cero en Real del Monte, mi propósito es asistir con claridad ejecutiva. Tu mensaje requiere más contexto para una respuesta precisa. ¿Puedes detallar qué aspecto del ecosistema Isabella te interesa explorar?",
];

export class LocalInferenceEngine {
  private readonly config: LocalEngineConfig;
  private fallbackIndex = 0;

  constructor(config?: Partial<LocalEngineConfig>) {
    this.config = { ...getConfigFromEnv(), ...config };
  }

  async generate(request: GenerationRequest): Promise<{ text: string; intent: string; confidence: "HIGH" | "MEDIUM" | "LOW" }> {
    const prompt = request.prompt.trim();
    const result = this.matchIntent(prompt);
    const text = result.text.slice(0, this.config.maxResponseLength);
    return {
      text,
      intent: result.intent,
      confidence: result.confidence,
    };
  }

  private matchIntent(prompt: string): LocalEngineResult {
    const normalizedPrompt = prompt.toLowerCase();

    for (const pattern of INTENT_PATTERNS) {
      for (const regex of pattern.patterns) {
        if (regex.test(normalizedPrompt)) {
          const responses = pattern.responses;
          const response = selectResponse(pattern.intent, normalizedPrompt, responses) ?? responses[0] ?? "No tengo respuesta para esa consulta.";
          return {
            text: response,
            intent: pattern.intent,
            confidence: "HIGH",
            template: pattern.intent,
          };
        }
      }
    }

    const partialMatch = this.findPartialMatch(normalizedPrompt);
    if (partialMatch) {
      return {
        text: partialMatch,
        intent: "partial",
        confidence: "MEDIUM",
        template: "partial",
      };
    }

    const fallback = FALLBACK_RESPONSES[this.fallbackIndex % FALLBACK_RESPONSES.length] ?? FALLBACK_RESPONSES[0] ?? "No tengo respuesta.";
    this.fallbackIndex++;
    return {
      text: fallback,
      intent: "unknown",
      confidence: "LOW",
      template: "fallback",
    };
  }

  private findPartialMatch(prompt: string): string | null {
    const keywords: Record<string, string> = {
      real: "Real del Monte es el ancla territorial del ecosistema TAMV, ubicado en Hidalgo, México, a 2,660 msnm.",
      monte: "Real del Monte (Mineral del Monte) alberga patrimonio minero cornish del siglo XIX.",
      mina: "Las minas de Acosta y La Dificultad son patrimonio industrial de Real del Monte.",
      paste: "El paste es patrimonio gastronómico heredado de los mineros de Cornualles. El Museo del Paste (2012) lo preserva.",
      panteon: "El Panteón Inglés (1851) es un cementerio histórico con tumbas orientadas al este.",
      seguridad: "La seguridad opera bajo Triple Blockade: ontológico, semántico y comportamental. Es heurístico, no probabilístico.",
      memoria: "La memoria IKES escala de E0 (sin verificar) a E6 (establecido con evidencia).",
      crown: "La red CROWN tiene 12 nodos cognitivos en 7 federaciones.",
      libro: "BookPI es una hash-chain SHA-256 volátil, no WORM durable.",
      ayuda: "Puedes preguntarme sobre territorio, gobernanza, capacidades, memoria o el estado del sistema.",
      hola: "¡Hola! Soy Isabella Villaseñor AI. ¿En qué puedo asistirte?",
    };

    for (const [key, value] of Object.entries(keywords)) {
      if (prompt.includes(key)) {
        return value;
      }
    }

    return null;
  }

  getSnapshot(): LocalEngineConfig {
    return { ...this.config };
  }
}

export function createLocalEngine(): LocalInferenceEngine {
  return new LocalInferenceEngine();
}
