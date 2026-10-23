# Arquitectura

IGE-Ω es un sub-workspace Rust dentro del monorepo Isabella V6 · TINA, separado del runtime TypeScript para permitir evolución gradual. Cognition crea propuestas; ABX/CROWN arbitra; BookPI registra; PostgreSQL persiste memoria; Axum expone la API. No existe ejecución externa en el MVP. Consulte [la especificación canónica](IGE-OMEGA-v2.0.0.md).


## Persistencia del World Model

`WorldModelRepository` escribe entidades, relaciones y aristas causales en PostgreSQL. Las consultas de entidad, causas y componentes conectados siempre filtran por tenant. Las mutaciones del grafo y su evento BookPI-X usan la misma transacción y el mismo advisory lock del ledger; si falla el registro de evidencia, la mutación se revierte. Las probabilidades/confianzas se validan como valores finitos en [0,1], y la migración `0006_world_model_tenant_integrity.sql` agrega índices y triggers de consistencia de tenant.
