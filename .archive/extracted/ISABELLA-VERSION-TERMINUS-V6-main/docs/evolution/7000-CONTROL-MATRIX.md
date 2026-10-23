# Isabella — 7,000-Control Evolution Matrix

The V5 evolution program defines exactly **7,000 addressable engineering controls**: 70 domains × 10 engineering axes × 10 improvement primitives.

The controls are generated deterministically by `src/evolution/catalog.ts`. They cover correctness, security, performance, reliability, governance, privacy, observability, operability, testability and evolvability across identity, memory, ML, tools, skills, agents, telemetry, inference and production engineering.

### Control states

- `declared`: contract exists and requires runtime evidence.
- `wired`: control is connected to the evolution fabric and is fail-closed where applicable.
- `verified`: backed by runtime/test evidence.
- `blocked`: explicitly prevented from activation until its evidence requirements pass.

A generated control is not falsely presented as a verified capability.

### Runtime

`GET /api/v1/evolution` returns the catalog summary.

`GET /api/v1/evolution?domain=memory` returns controls scoped to a domain.

The runtime integrity digest is computed from the canonical control sequence, target and verification contract.
