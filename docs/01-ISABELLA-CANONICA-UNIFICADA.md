# Isabella — Documento Canónico Unificado (RFC-00)

> `state: draft | engine-generated` — índice unificador generado por motor. **No** es una
> aprobación humana ni declara `verified`/`wired`/`production`. Su única función es ser el
> **punto de entrada único** al corpus canónico y resolver las referencias dispersas que antes
> apuntaban a ficheros inexistentes.

## 1. Propósito

Este repositorio acumuló documentación repartida en decenas de ficheros y carpetas temáticas.
Este documento canónico unifica el mapa: declara **qué es canon**, **dónde vive cada verdad** y
**en qué orden prevalecen** cuando dos fuentes discuerdan. No duplica el contenido; lo referencia.

## 2. Jerarquía de la verdad (AGENTS.md §3)

1. Evidencia humana reproducida (test + aprobación con nombre).
2. Evidencia observada (telemetría, logs, inventarios generados).
3. Inferencia razonada documentada.
4. Especulación (nunca presentada como hecho).

**Axioma operativo:** `CAPABILITY ≠ AUTHORITY ≠ EXECUTION ≠ EVIDENCE ≠ LEARNING ≠ PRODUCTION`.
Un test verde demuestra capacidad computacional, no autoridad ni producción.

## 3. Fuentes canónicas por dominio

| Dominio | Fuente primaria | Naturaleza |
| --- | --- | --- |
| Spec canónica v40 / blueprints | [`spec/`](spec/) | canon (gana en conflicto, §6 AGENTS) |
| Evolución Gen-5 V5 (7 000 controles) | [`evolution/`](evolution/) | canon |
| Arquitectura y SSOT | [`architecture/SSOT.md`](architecture/SSOT.md) + [`reference/ARCHITECTURE.md`](reference/ARCHITECTURE.md) | consolidado |
| Contrato API | [`api/openapi.yaml`](api/openapi.yaml), [`api/route-inventory.json`](api/route-inventory.json) | generado |
| Gobernanza (CROWN / GAME OVER / UAGP-1) | [`reference/GOVERNANCE.md`](reference/GOVERNANCE.md) | consolidado |
| Economía (BookPI / billing / tenancy) | [`reference/ECONOMY.md`](reference/ECONOMY.md) | consolidado |
| Plataforma (Hyper Skill / PennyLane / LITLE) | [`reference/PLATFORM.md`](reference/PLATFORM.md) | consolidado |
| Operación y despliegue | [`reference/OPERATIONS.md`](reference/OPERATIONS.md) + [`runbooks/`](runbooks/) | operativo |
| Investigación y UX | [`reference/RESEARCH.md`](reference/RESEARCH.md) | estudio |
| Voz / TTS | [`tts/GENESIS-TTS-RUNTIME.md`](tts/GENESIS-TTS-RUNTIME.md) | runtime |
| Seguridad | [`../SECURITY.md`](../SECURITY.md) + [`security/`](security/) | política + threat model |
| Estado real y bloqueadores | [`ESTADO-REAL-ACTUAL.md`](ESTADO-REAL-ACTUAL.md), [`STATUS.md`](STATUS.md) | evidencia |
| Entorno | [`ENVIRONMENT.md`](ENVIRONMENT.md) + [`../.env.example`](../.env.example) | configuración |
| Historia de auditorías | [`history/audits.md`](history/audits.md) | archivo punto-en-tiempo |

## 4. Especificación formal (LaTeX)

La memoria normativa de la Capa Genesis está en [`isabella_genesis_omega.tex`](isabella_genesis_omega.tex):
axioma Ω∞, las 12 capas L0–L11, Zero-Trust (`ALLOW = I×A×C×P×E`), memoria FEM de 6 niveles,
evolución controlada y anclaje Merkle del ledger BookPI.

## 5. Límites honestos

- Los contratos OpenAPI/AsyncAPI de la Capa Genesis son **especificación**, no endpoints en
  producción (inventario de rutas congelado).
- Post-quantum (PQC): `BLOCKED_ENVIRONMENT`. No se afirman claims de criptografía cuántica sin
  evidencia de entorno.
- Ningún control generado por máquina se declara verificado sin aprobación humana con nombre.

## 6. Cómo navegar el corpus

Empieza en el [`Índice de documentación`](README.md). Para una verdad concreta, usa la tabla de
la sección 3. Si dos fuentes discuerdan, prevalece `spec/`/`evolution/` y el conflicto se archiva
en [`spec/canonical/DIVERGENCE-REGISTER.md`](spec/canonical/DIVERGENCE-REGISTER.md) para
arbitraje humano.
