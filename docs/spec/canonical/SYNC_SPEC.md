# Synchronization and Manager Specification

**Contexto:** coordinación concurrente de ingestión, LSP, índice, Git y BookPI.

**Estado:** alpha.

**Dependencias:** IKES, asyncio, Git, BookPI, almacenamiento durable.

## Primitivas

`Lock`, `RLock`, `Semaphore`, `BoundedSemaphore`, `Condition`, `Event`, `Barrier`.

## Reglas

- Análisis paralelo; mutación serializada por `entity_id`.
- No mantener locks durante red, inferencia o Git remoto.
- Idempotencia y timeout obligatorios.
- Tenant, workspace y servicio forman el scope mínimo.
- Git, índice y BookPI deben reconciliarse antes de release.
- Locks en memoria no son coordinación multi-host.

## Lifecycle

```text
INITIAL → STARTED → STOPPING → SHUTDOWN
```

Tokens deben tener scope, expiración, capacidades, revocación y auditoría. Proxies no son autoridad epistemológica.
