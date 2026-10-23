# World Model

The in-memory graph stores entities, typed relations and causal edges with bounded confidence/probability values. A causal edge is a declared hypothesis plus evidence labels, not proof of causation. SQL migrations prepare relational persistence, but the graph repository is not yet wired to PostgreSQL.


## Implementación PostgreSQL añadida en la fase de endurecimiento

`WorldModelRepository` persiste entidades con procedencia, relaciones y aristas causales. Todas las lecturas y escrituras están limitadas al tenant derivado del bearer token. Las relaciones y aristas causales comprueban que ambos extremos pertenecen al tenant; la migración `0006_world_model_tenant_integrity.sql` repite esta validación mediante triggers para impedir escrituras directas inconsistentes. Las mutaciones del gateway y su evento BookPI-X comparten una transacción: si no puede añadirse la evidencia, la mutación se revierte.

Rutas HTTP: `POST /api/v1/world/entities`, `GET /api/v1/world/entities/{entity_id}`, `POST /api/v1/world/relations`, `POST /api/v1/world/causal-edges`, `GET /api/v1/world/causes/{effect}`, `GET /api/v1/world/components/{entity_id}`. Los endpoints no aceptan `tenant_id` del cliente.
