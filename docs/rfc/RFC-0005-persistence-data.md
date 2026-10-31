# RFC-0005 — Persistencia e integridad

## Requisitos
- Postgres durable para BookPI y suscripciones.
- `BOOKPI_INTEGRITY_SECRET` obligatorio y fuerte.
- Aplicar migraciones `supabase/migrations` y `infra/db/migrations`.
- Supabase Atlas/IKES requiere URL + service role + anon/publishable key.
- IKES fail-closed en lectura/escritura.
- BookPI Postgres append transaccional y actor-scoped.
- Ledger legacy sigue separado (no unificado aún).
- Sin DB, estado degradado explícito, no datos simulados.
