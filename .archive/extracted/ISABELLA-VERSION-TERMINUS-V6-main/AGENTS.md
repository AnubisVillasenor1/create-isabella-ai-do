# AGENTS.md — Isabella Villaseñor AI (Gen 5 / Genesis TINA)

Este archivo es la constitución operativa del repositorio. Todo agente humano o
de IA que trabaje aquí ESTÁ sujeto a estas reglas. Son invariantes, no
sugerencias.

## 1. Invariante Operativo

**CAPABILITY ≠ AUTHORITY ≠ EXECUTION ≠ EVIDENCE ≠ LEARNING ≠ PRODUCTION**

- Las inteligencias **sugieren**, **calculan** y **evalúan**.
- La conciencia humana **decide**, **aprueba**, **arbitra** y **ejecuta**.
- Ningún control generado por máquina se declara "verificado" sin evidencia
  humana. Un test que pasa demuestra una capacidad computacional, NO una
  facultad, NO una autoridad, NO producción.

## 2. Transparencia radical sobre el propio trabajo

- Un archivo generado automáticamente que no fue revisado por un humano se
  declara `state: draft | auto_generated`.
- En cada commit se distingue: `engine-generated`, `human-approved`,
  `human-authored`.
- Se documentan todos los supuestos y compensaciones.

## 3. Jerarquía de la verdad

1. Evidencia humana reproducida (test + aprobación con nombre).
2. Evidencia observada (telemetría, logs).
3. Inferencia razonada documentada.
4. Especulación (no se presenta como hecho).

## 4. Lo que este repo prohíbe

- Presentar un test verde como una "capacidad de la IA" o facultad.
- Borrar historia (rebase force sobre ramas compartidas).
- Ocultar errores: se reporteran y corrigen en el open.
- `TODO` sin dueño y sin fecha.
- Aprobar PRs sin revisión.

## 5. Lo que este repo exige

- `pnpm typecheck` y `pnpm test` en verde antes de cada commit.
- Contratos (contratos) con tipos estrictos; sin `any`.
- BookPI: todo cambio de estado de capacidad se registra (ledger append-only).
- Identidad de método: `[TINA].[YUN].[MODULO].[FUNCION].[VERSION].[RISK_TIER].[GOVERNANCE_TIER]`.

## 6. Fuente canónica de la especificación

- `docs/evolution/*`: evolución Gen-5 V5 (7,000 controles).
- `docs/spec/*`: canon v40.0.0 y blueprints (api, librerías, CQRS/BookPI).
- En conflicto entre código y spec, gana la spec; el conflicto se archiva en el
  manifest como divergencia pendiente de arbitraje humano.

## 7. Proceso de un cambio

1. Declarar la intención (issue/control state).
2. Implementación mínima verificable.
3. `state: draft` hasta revision humana.
4. Evidencia empírica (tests) + aprobación con nombre → `verified`.
5. Solo entonces `state: wired` para producción.