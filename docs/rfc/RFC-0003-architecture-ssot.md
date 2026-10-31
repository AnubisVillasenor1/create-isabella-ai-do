# RFC-0003 — Arquitectura y SSOT

## Fuentes
- `docs/architecture/SSOT.md`
- `docs/reference/ARCHITECTURE.md`
- `src/server.ts` (wiring real)

## Capas excluidas del typecheck principal (no declarar production-ready)
Ver `docs/STATUS.md`: 21 áreas excluidas; 14 cubiertas por `tsconfig.layers.json`. Toda capa excluida es CAPABILITY ≠ PRODUCTION hasta que se incluya y pase typecheck.

## Regla operativa
`WIRED` describe una ruta de código, no prueba de credenciales, migraciones, persistencia, inferencia ni despliegue.
