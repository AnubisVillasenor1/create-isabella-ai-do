# RFC-0009 — Sanitización documental

## Reglas
1. Un README resume; el estado operativo informa evidencia y SHA; el runbook lista acciones.
2. Una sola fuente primaria por tema.
3. No duplicar el mismo dictamen.
4. No fusionar contratos canónicos, OpenAPI, migraciones, políticas de seguridad ni inventarios generados con informes narrativos.
5. Los inventarios generados se modifican mediante su generador.
6. Nunca declarar verified/wired/production sin evidencia reproducible.
7. Antes de borrar una fuente, comprobar referencias entrantes y corregir scripts dependientes.

## Acción realizada
- Se creó `docs/rfc/` como capa unificada.
- Se archivaron documentos narrativos redundantes en `docs/history/archive/`.
- Se conservaron intactos los artefactos load-bearing (STATUS, API, spec, security, runbooks, SSOT, reference, canonical unificado).
