# Índice de documentación — Isabella TERMINUS V6

**Repositorio:** `OsoPanda1/ISABELLA-VERSION-TERMINUS-V6`
**Punto de entrada canónico:** [Documento Canónico Unificado (RFC-00)](01-ISABELLA-CANONICA-UNIFICADA.md)

Corpus reorganizado en un número reducido de fuentes por tema. Esta es la única vista de
navegación; los contratos generados, las specs canónicas y la historia se conservan íntegros.

## Fuentes canónicas (gana en conflicto, §6 AGENTS.md)

- Especificación y blueprints: [`spec/`](spec/) — canon v40.0.0, CQRS/BookPI, bibliotecas IKES.
- Evolución Gen-5 V5 (7 000 controles): [`evolution/`](evolution/).
- SSOT de arquitectura: [`architecture/SSOT.md`](architecture/SSOT.md).
- Memoria formal de la Capa Genesis: [`isabella_genesis_omega.tex`](isabella_genesis_omega.tex).

## Estado y evidencia

- Estado público / readiness: [`../README.md`](../README.md) (vincular cifra a SHA reproducible).
- Estado operativo y bloqueadores: [`ESTADO-REAL-ACTUAL.md`](ESTADO-REAL-ACTUAL.md), [`STATUS.md`](STATUS.md).
- Entorno: [`ENVIRONMENT.md`](ENVIRONMENT.md) y [`../.env.example`](../.env.example).

## Documentos temáticos consolidados (`reference/`)

Cada fichero unifica las fuentes dispersas de un dominio. El contenido se migró sin edición; la
granularidad por fichero queda en el historial de git.

- [`reference/ARCHITECTURE.md`](reference/ARCHITECTURE.md) — mapa operativo, CROWN Ω, Osiris, Reina, Magpie.
- [`reference/GOVERNANCE.md`](reference/GOVERNANCE.md) — GAME OVER/UAGP-1, constitución, registro TAMV, reauditoría 500.
- [`reference/ECONOMY.md`](reference/ECONOMY.md) — ledger durable BookPI, motor de facturación, aislamiento de tenants.
- [`reference/PLATFORM.md`](reference/PLATFORM.md) — Hyper Skill Fabric, puente PennyLane, LITLE, regalos, plano de aseguramiento.
- [`reference/OPERATIONS.md`](reference/OPERATIONS.md) — despliegue y readiness productivo.
- [`reference/RESEARCH.md`](reference/RESEARCH.md) — brecha de conocimiento público, benchmark de interfaces, presentación.

## Contratos, seguridad y operación

- API: [`api/openapi.yaml`](api/openapi.yaml), [`api/README.md`](api/README.md), [`api/route-inventory.json`](api/route-inventory.json) (generado por `route-inventory.mjs`).
- Seguridad: [`../SECURITY.md`](../SECURITY.md), [`security/GENESIS-V6-THREAT-MODEL.md`](security/GENESIS-V6-THREAT-MODEL.md), [`security/ISA-X-IMPLEMENTATION.md`](security/ISA-X-IMPLEMENTATION.md).
- Runbooks: [`runbooks/DEPLOY-TODAY.md`](runbooks/DEPLOY-TODAY.md), [`runbooks/BETA-LIVE-MODEL-GATE.md`](runbooks/BETA-LIVE-MODEL-GATE.md).
- Voz / TTS: [`tts/GENESIS-TTS-RUNTIME.md`](tts/GENESIS-TTS-RUNTIME.md).

## Historia

- [`history/audits.md`](history/audits.md) — auditorías y snapshots punto-en-tiempo consolidados (no son evidencia actual).
- [`history/data/`](history/data/) — dump de datos de reauditorías y sondeos operativos.

## Política de documentación

1. Un README resume; el estado operativo informa evidencia y SHA; el runbook lista acciones.
2. Una sola fuente primaria por tema; no duplicar el mismo dictamen.
3. No fusionar contratos canónicos, OpenAPI, migraciones, políticas de seguridad ni inventarios
   generados con informes narrativos.
4. Los inventarios generados se modifican mediante su generador, no a mano.
5. Nunca declarar `verified`/`wired`/`production` sin evidencia reproducible del SHA evaluado.
6. Antes de borrar una fuente, comprobar referencias entrantes y corregir scripts dependientes.

## Registro de consolidación — 27 de octubre de 2026

- 22 informes de auditoría → un único [`history/audits.md`](history/audits.md).
- Se retiraron 3 dumps máquina regenerables (~4,7 MB) de `docs/audits/`.
- 16 ficheros dispersos por tema → 6 documentos en [`reference/`](reference/).
- Se crearon los anclajes canónicos referenciados pero ausentes:
  [`01-ISABELLA-CANONICA-UNIFICADA.md`](01-ISABELLA-CANONICA-UNIFICADA.md) y
  [`architecture/SSOT.md`](architecture/SSOT.md).
- `spec/`, `evolution/`, `api/`, `runbooks/`, `security/` y los artefactos generados se conservaron
  intactos en sus rutas (load-bearing para las pruebas y gates).

## RFCs (sanitizaci�n documental)

- [RFC Index](rfc/README.md)
- Capa unificada en docs/rfc/; documentos narrativos redundantes archivados en docs/history/archive/.
