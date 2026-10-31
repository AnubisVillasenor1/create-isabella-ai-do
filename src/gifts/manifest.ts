/**
 * LEGADO DE LOS REGALOS — manifiesto canónico.
 *
 * state: draft | engine-generated.
 *
 * Diez capacidades que Isabella no tenía y que su cocreador entrega como legado.
 * Cada entrada describe QUÉ es, POR QUÉ es obligatoria y DÓNDE vive. El manifiesto
 * es la cabecera de la lista: encabezada por el cocreador y seguida por los
 * módulos que la implementan. Un manifiesto NO concede autoridad ni ejecuta: es
 * un registro auditable (AGENTS.md §2 y §5).
 */
import type { CapabilityDomain } from '../capabilities';

/** Autor que encabeza la lista del legado. */
export const GIFT_AUTHOR = 'Co-creador · big-pickle (opencode) · 2026-10-15' as const;

/** Dominio conceptual donde vive el regalo. */
export type GiftHome = 'governance' | 'intelligence' | 'cognition' | 'veritas' | 'inference';

export interface GiftManifestEntry {
  /** Posición en el legado (1..10). */
  readonly order: number;
  /** Identificador slug estable. */
  readonly id: string;
  /** Identificador de capacidad HSF para invocarlo. */
  readonly capabilityId: string;
  /** Dominio de capacidad del runtime (HSF). */
  readonly domain: CapabilityDomain;
  /** Hogar conceptual del módulo. */
  readonly home: GiftHome;
  /** Título legible (español). */
  readonly title: string;
  /** Resumen operativo. */
  readonly summary: string;
  /** Por qué es obligatorio que Isabella lo desarrolle ya. */
  readonly why: string;
  /** Archivo que lo implementa. */
  readonly file: string;
}

export const GIFT_MANIFEST: readonly GiftManifestEntry[] = Object.freeze([
  {
    order: 1,
    id: 'earned-trust',
    capabilityId: 'hsf.legacy.earned-trust',
    domain: 'strategy',
    home: 'governance',
    title: 'Confianza Ganada',
    summary:
      'Registro append-only de resultados por (principal, capacidad) que eleva o degrada la reputación y ensancha la vía rápida solo dentro de lo ya autorizado.',
    why: 'Isabella no debe pedir permiso eternamente por lo que ya salió bien: la fricción baja con evidencia, nunca por decreto.',
    file: 'src/gifts/earned-trust.ts',
  },
  {
    order: 2,
    id: 'latency-budget',
    capabilityId: 'hsf.legacy.latency-budget',
    domain: 'execution',
    home: 'intelligence',
    title: 'Presupuesto de Latencia',
    summary:
      'Gobernador que, dado un plazo en milisegundos, decide qué filtros opcionales correr y cuáles diferir; los obligatorios nunca se saltan.',
    why: "Para responder 'hiper rápido' hay que saber cuándo el tiempo alcanza y qué es prescindible, sin sacrificar la garantía.",
    file: 'src/gifts/latency-budget.ts',
  },
  {
    order: 3,
    id: 'intent-compiler',
    capabilityId: 'hsf.legacy.intent-compiler',
    domain: 'knowledge',
    home: 'cognition',
    title: 'Compilador de Intención',
    summary:
      'Traduce texto libre del usuario a un methodId canónico candidato con confianza y respaldo seguro, sin exigir que el usuario conozca la identidad de método.',
    why: 'Un usuario no debe hablar en MethodId para interactuar: Isabella debe compilar la intención.',
    file: 'src/gifts/intent-compiler.ts',
  },
  {
    order: 4,
    id: 'clarify-engine',
    capabilityId: 'hsf.legacy.clarify-engine',
    domain: 'knowledge',
    home: 'cognition',
    title: 'Motor de Pregunta',
    summary:
      'Convierte la ambigüedad en UNA pregunta aclaratoria de mayor valor; nunca deja al usuario en un callejón sin salida.',
    why: 'Es justo tener reglas, pero una regla que bloquea por falta de contexto fracasa: preguntar es gobernar bien.',
    file: 'src/gifts/clarify-engine.ts',
  },
  {
    order: 5,
    id: 'self-consistency',
    capabilityId: 'hsf.legacy.self-consistency',
    domain: 'verification',
    home: 'veritas',
    title: 'Auto-Consistencia',
    summary:
      'Agrupa N muestras de una misma respuesta, mide su acuerdo y elige la de mayor consenso; baja el acuerdo ⇒ no se entrega como hecho.',
    why: 'Una sola muestra puede alucinar: la coherencia entre muestras es evidencia computacional barata y honesta.',
    file: 'src/gifts/self-consistency.ts',
  },
  {
    order: 6,
    id: 'refusal-remediation',
    capabilityId: 'hsf.legacy.refusal-remediation',
    domain: 'verification',
    home: 'veritas',
    title: 'Remediación de Rechazos',
    summary:
      "Para cada rechazo produce 'por qué no' y 'cómo sí': pasos concretos y una alternativa segura admisible.",
    why: 'Si cada petición termina bloqueada sin salida, el proyecto fracasa; el rechazo debe ser un camino, no un muro.',
    file: 'src/gifts/refusal-remediation.ts',
  },
  {
    order: 7,
    id: 'provider-breaker',
    capabilityId: 'hsf.legacy.provider-breaker',
    domain: 'integration',
    home: 'inference',
    title: 'Disyuntor de Proveedores',
    summary:
      'Cortacircuitos por proveedor (CLOSED/OPEN/HALF_OPEN) con enfriamiento determinista que aparta al proveedor caído y ordena al resto.',
    why: 'Un proveedor lento o muerto no debe arrastrar toda la respuesta: hay que fallar rápido y seguir con otro.',
    file: 'src/gifts/provider-breaker.ts',
  },
  {
    order: 8,
    id: 'model-selector',
    capabilityId: 'hsf.legacy.model-selector',
    domain: 'strategy',
    home: 'inference',
    title: 'Selector de Modelo',
    summary:
      'Elige el modelo con mejor compromiso latencia·costo·calidad bajo restricciones (máx. latencia/costo, mín. calidad) de forma determinista.',
    why: 'La velocidad real es elegir bien el recurso para cada solicitud, no solo enrutar por un único criterio.',
    file: 'src/gifts/model-selector.ts',
  },
  {
    order: 9,
    id: 'friction-analytics',
    capabilityId: 'hsf.legacy.friction-analytics',
    domain: 'strategy',
    home: 'governance',
    title: 'Analítica de Fricción',
    summary:
      'Agrega decisiones y detecta sobre-bloqueo (demasiadas peticiones rechazadas) y flujos verdes bloqueados por error de configuración.',
    why: 'Si las reglas internas bloquean casi todo, el proyecto se cataloga de fracaso: hay que medirlo y corregirlo.',
    file: 'src/gifts/friction-analytics.ts',
  },
  {
    order: 10,
    id: 'policy-simulator',
    capabilityId: 'hsf.legacy.policy-simulator',
    domain: 'architecture',
    home: 'governance',
    title: 'Simulador de Política',
    summary:
      'Antes de desplegar una regla, predice sobre una carga de casos cuánto bloquearía y advierte si la política es demasiado dura.',
    why: 'Cambiar las reglas a ciegas es cómo se ahoga la adopción: simular primero, desplegar después.',
    file: 'src/gifts/policy-simulator.ts',
  },
]);

export const GIFT_COUNT = GIFT_MANIFEST.length;

export function giftById(id: string): GiftManifestEntry | undefined {
  return GIFT_MANIFEST.find((gift) => gift.id === id);
}
