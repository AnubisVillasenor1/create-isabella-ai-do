/**
 * Puerta de proveedor para algoritmos post-cuánticos (FIPS 203 / FIPS 204).
 *
 * state: draft | engine-generated. `ml-kem.ts` y `ml-dsa.ts` no implementan los
 * algoritmos: generan material aleatorio del tamaño correcto. Eso no es una
 * degradación inofensiva — un KEM simulado nunca pone de acuerdo a las dos partes
 * sobre la misma clave y un `verify` simulado acepta cualquier blob bien formado,
 * así que una firma forjada pasa el control. Ninguna de las dos cosas puede
 * presentarse como seguridad, por eso cada operación lanzaba este error en lugar
 * de devolver material criptográfico. La firma real del repositorio es Ed25519 en
 * `../post-quantum.ts`, que usa `node:crypto` y verifica de verdad.
 */

export const PQC_BACKEND_UNAVAILABLE_CODE = 'PQC_BACKEND_UNAVAILABLE';

/** Algoritmo FIPS 203/204 solicitado sin proveedor externo auditado. */
export class PqcProviderRequired extends Error {
  readonly code = PQC_BACKEND_UNAVAILABLE_CODE;
  readonly algorithm: string;
  constructor(algorithm: string, operation: string) {
    super(
      `${PQC_BACKEND_UNAVAILABLE_CODE}: ${operation} con ${algorithm} requiere un proveedor externo ` +
        '(HSM/KMS o librería PQC auditada); este repositorio no simula FIPS 203/204.'
    );
    this.name = 'PqcProviderRequired';
    this.algorithm = algorithm;
  }
}

/** Punto único de bloqueo: nunca devuelve, para que ningún llamador obtenga material falso. */
export function pqcProviderRequired(algorithm: string, operation: string): never {
  throw new PqcProviderRequired(algorithm, operation);
}
