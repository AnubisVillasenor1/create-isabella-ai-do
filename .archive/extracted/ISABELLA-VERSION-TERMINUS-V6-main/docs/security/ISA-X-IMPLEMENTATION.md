# ISA-X v1.1 — Estado de Implementación (honesto)

- **Fecha:** 2026-10-10 · **Repo:** `Isabella-Villase-or-GenesisAI` (rama `main`)
- **state:** `draft | engine-generated` — pendiente de arbitraje humano (AGENTS.md invariante operativo)
- **Instrucción de partida:** "Leer `ISA-X Sovereign Protocol.txt` (full)". **El fichero NO existe**
  en el repo ni en el workspace circundante. Nada en esta implementación pretende citarlo;
  se declara un perfil ISA-X mínimo REAL con construcción explícita y verificable.

## 1. Qué está implementado (REAL, no simulado)

| Capacidad | Estado | Algoritmo real | Evidencia |
|---|---|---|---|
| Firma por petición (`signer.ts`) | **implemented** | Ed25519 vía `node:crypto` (FIPS 186-5) | `src/security/isa-x/signer.ts` + `test/security/isa-x.signer.test.ts` |
| Verificación por petición (`verify`) | **implemented** | Ed25519 (`verifyEd25519`, `post-quantum.ts`) | `test/security/isa-x.signer.test.ts` |
| Canonical request determinista (`protocol.ts`) | **implemented** | SHA-256 body + key/value sorted | `test/security/isa-x.protocol.test.ts` |
| Challenge-response (`challenge.ts`) | **implemented** | Ed25519 + `nonce()`/`NonceRegistry` de `src/security/nonce.ts` (reutilizado, no duplicado) | `test/security/isa-x.handshake.test.ts` |
| Nonce único (reuse → rechazado) | **implemented** | `nonce.ts` (256-bit, base64url) | `test/security/isa-x.handshake.test.ts` |
| Skew de timestamp (rechazado) | **implemented** | Δ > `clockSkewMs` (30 s por defecto) | `test/security/isa-x.handshake.test.ts` |
| Rotación double-phase | **implemented** | ACTIVE → PREVIOUS → REVOKED en 2 rotaciones | `test/security/isa-x.rotation.test.ts` |
| Revocación (claves y tokens) | **implemented** | Digest SHA-256 + `timingSafeEqual` | `test/security/isa-x.revocation.test.ts` |
| Scope negado | **implemented** | `scopeMatches` (exacto + `namespace:*`) | `test/security/isa-x.signer.test.ts` |
| Audit hooks | **implemented** | `IsaXAuditHook` en sign/verify/rotate/revoke | `test/security/isa-x.signer.test.ts` |

## 2. BLOCKED_ENVIRONMENT (NUNCA simulado)

| Algoritmo | Estado | Requisito para elevar a ISA-X-SOVEREIGN |
|---|---|---|
| ML-KEM-768 (FIPS 203) | **BLOCKED_ENVIRONMENT** | HSM/KMS externo o librería nativa PQC (ej. OpenSSL 3.5+, liboqs) inyectada vía `PqcExternalProvider` |
| ML-DSA-65 (FIPS 204) | **BLOCKED_ENVIRONMENT** | Idem. `createPqcSignatureAlgorithm("ML-DSA-65")` lanza `PqcBackendUnavailable` |
| SLH-DSA-SHA2-128s (FIPS 205) | **BLOCKED_ENVIRONMENT** | Idem |

Solicitar cualquiera de ellos **lanza** (fail-closed) `PQC_BACKEND_UNAVAILABLE`; no se
genera ningún byte de firma. `isaXAlgorithmPolicy()` y `requireIsaXAlgorithm()` son la
fuente de verdad de esta clasificación y están testadas.

## 3. Checklist para elevar a ISA-X-SOVEREIGN (ML-DSA real)

Ruta concreta (requiere hardware/operador humano; fuera del alcance de este repo hoy):

1. [ ] Provisionar HSM (SafeNet Luna / CloudHSM / AWS KMS) o un KMS con módulo PQC.
2. [ ] Generar la clave ML-DSA-65 **dentro** del HSM (nunca exportar privada).
3. [ ] Implementar `PqcExternalProvider` apuntando a la API del HSM/KMS
      (`sign(algorithm, payload)` / `verify(...)`), con pruebas de integración en
      ambiente sandbox **con la red egress bloqueada**.
4. [ ] Human-review del contrato de auditoría: qué eventos ISA-X se firman y con qué política.
5. [ ] Decisión humana `state: wired` en producción (no se autodedara verificado).
6. [ ] Actualizar `isaXAlgorithmPolicy()` → `EXTERNAL_PROVIDER` y este documento.

Mientras no se cumpla: **Ed25519 real es lo único que firma en producción.**

## 4. Composición del módulo

```
src/security/isa-x/
├── protocol.ts      primitivas + canonical request + política de algoritmos
├── keys.ts          anillo de claves (bootstrap / rotate double-phase / revoke)
├── signer.ts        firma y verificación por petición (Ed25519) + audit hooks
├── challenge.ts     handshake challenge-response con nonce único
├── revocation.ts    registro de revocación (claves y tokens)
└── index.ts         barrel export
```

Integración: `src/security/index.ts` re-exporta `isa-x`. Los nonces se reutilizan de
`src/security/nonce.ts` (`nonce()`, `createNonceRegistry`) — no hay copia duplicada.