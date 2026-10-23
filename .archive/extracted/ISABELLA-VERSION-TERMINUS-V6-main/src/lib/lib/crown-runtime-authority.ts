/**
 * CROWN RUNTIME AUTHORITY (src/lib/crown-runtime-authority.ts)
 * -----------------------------------------------------------------
 * Punto de entrada canónico para consumidores runtime (sovereign-pipeline,
 * constitutional gate, chat gateway). Publica dos cosas con alcances distintos:
 *
 *  1. El REGISTRY CROWN v6 (`crown-v6.ts`): catálogo de 12 nodos y 7 módulos
 *     extendidos con su metadata. Es un catálogo/registry, NO arbitraje.
 *  2. El ADAPTER de evaluación (`crown.ts`, CROWN_VERSION 2.0.0): es el que
 *     realmente ejecuta el arbitraje de políticas en el pipeline.
 *
 * LIMITACIÓN DECLARADA (auditoría P1-03/P0-08): los 7 módulos extendidos de
 * CROWN v6 existen como registro con metadata, pero NO están cableados en el
 * pipeline de decisión; la evaluación real sigue siendo la de los 5 módulos
 * base del compatibility adapter. Esto no es "CROWN v6 completo en runtime".
 *
 * Auditoría P1-03: la documentación declara CROWN v6; el runtime debe
 * importar desde esta autoridad, no desde crown.ts directamente.
 */

export * from "./crown";
export { CROWN_V6, NODES_12, MODULES_12, EXTENDED_MODULES, MODULE_TO_NODE } from "./crown-v6";
export type { NodeId } from "./crown-v6";

/** Registro de la autoridad (catálogo CROWN v6). */
export const CROWN_RUNTIME_AUTHORITY = "CROWN_V6" as const;
export const CROWN_AUTHORITY_VERSION = "6.0.0-fusion" as const;
/** Versión del compatibility adapter de los 5 módulos base (quien evalúa de verdad). */
export const CROWN_COMPAT_ADAPTER_VERSION = "2.0.0" as const;
/**
 * Falso: los módulos extendidos de v6 (7) NO están cableados al pipeline de
 * decisión. Se expone como constante para que ningún consumidor pueda
 * afirmar lo contrario sin cambiar este valor y su prueba asociada.
 */
export const CROWN_EXTENDED_MODULES_WIRED = false as const;
