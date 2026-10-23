/**
 * ISA-X v1.1 — soberanía de firma por petición.
 *
 * Advertencia de honestidad: el fichero `ISA-X Sovereign Protocol.txt` no está
 * presente en el repo; este barrel exporta la implementación mínima REAL que se
 * documenta en `docs/security/ISA-X-IMPLEMENTATION.md` (Ed25519 real vía
 * node:crypto; ML-KEM/ML-DSA/SLH-DSA = BLOCKED_ENVIRONMENT hasta HSM/KMS).
 */
export * from "./protocol";
export * from "./keys";
export * from "./revocation";
export * from "./signer";
export * from "./challenge";