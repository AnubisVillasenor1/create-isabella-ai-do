# PLATFORM consolidado

> `state: draft | engine-generated` - unificacion tematica. El contenido se migro **sin edicion**;
> cada seccion conserva su origen. La granularidad por fichero esta en el historial de git.

## Fuentes unificadas

1. `docs/ISABELLA_HYPER_SKILL_FABRIC.md`
2. `docs/ISABELLA_PENNYLANE_BRIDGE.md`
3. `docs/LITLE_GENESIS_INTEGRATION.md`
4. `docs/platform/PLATFORM-GIFTS.md`
5. `docs/ASSURANCE-CONTROL-PLANE.md`

---


## Origen: `docs/ISABELLA_HYPER_SKILL_FABRIC.md`

# Isabella GenesisAI — Hyper Skill Fabric

## Propósito

El Hyper Skill Fabric (HSF) es la capa canónica de capacidades de Isabella GenesisAI. No modifica el modelo fundacional ni crea otro runtime.

La regla arquitectónica es:

`CAPABILITY ≠ AUTHORITY ≠ EXECUTION ≠ EVIDENCE ≠ LEARNING ≠ PRODUCTION`

Por ello, una capacidad sólo describe y ejecuta una función; CROWN/AEGIS y el runtime Genesis conservan autoridad y gobierno.

## Arquitectura

```
                         ISABELLA GENESISAI
                                  │
                    Cognitive Orchestrator
                                  │
                     CROWN + AEGIS + VERITAS
                                  │
                         Capability Gateway
                                  │
             ┌────────────────────┼────────────────────┐
             │                    │                    │
       Memory Fabric       Execution Fabric      Knowledge Fabric
             │                    │                    │
             ├──────────── Collective / Verification ─┤
             │                    │                    │
             └──── Architecture / Twin / Strategy ───┘
                                  │
                    APIs / MCP / providers
                                  │
             GitHub • PostgreSQL • Redis • Qdrant •
             Docker • Kubernetes • PennyLane • Atlas
```

Los proveedores externos son adaptadores. No adquieren soberanía sobre Genesis.

## Capacidades canónicas

| ID | Función | Estado |
|---|---|---|
| `hsf.memory.fabric` | memoria versionada y con hash | contrato + proveedor in-memory |
| `hsf.execution.fabric` | cola de tareas y scheduling | contrato + cola local |
| `hsf.knowledge.fabric` | ingestión/versionado de conocimiento | implementado local |
| `hsf.collective.consensus` | consenso con disenso explícito | implementado determinista |
| `hsf.truth.verification` | evidencia/contradicciones | implementado determinista |
| `hsf.architecture.reasoning` | análisis estructural | implementado determinista |
| `hsf.digital-twin` | gemelo digital de componentes/dependencias | implementado determinista |
| `hsf.strategic-intelligence` | escenarios y valor esperado | implementado determinista |
| `hsf.self-evaluation` | revisión posterior de salida | implementado determinista |
| `hsf.massive-context.parallel` | paralelización de unidades de análisis | implementado con Promise.all |

Estas implementaciones son el **núcleo de contratos y referencia local**, no una afirmación de que ya exista una infraestructura distribuida de 200 workers, Qdrant, Neo4j, Temporal o Kubernetes.

## Gateway

La entrada pública es:

- `GET /api/v1/hsf/status`
- `POST /api/v1/hsf/invoke`

El flujo de invocación es:

```
Request
  ↓
Principal
  ↓
Balanced Authority
  ↓
Genesis.evaluate()
  ↓
CROWN / AEGIS / Capability Gate
  ↓
CapabilityGateway
  ↓
Provider
  ↓
Result + trace/request ID
```

Una capacidad desconocida es rechazada. Un proveedor no disponible produce `unavailable`; nunca se simula ejecución.

## Memoria

El HSF no reemplaza IKES, BookPI ni Atlas. `InMemoryMemoryFabric` es una implementación de referencia para el contrato de capacidad.

La evolución de producción puede conectar el mismo contrato con:

- PostgreSQL para estado transaccional;
- Qdrant u otro vector store para recuperación semántica;
- Neo4j u otro grafo para relaciones;
- Redis para caché/locks;
- BookPI/LITLE para procedencia y evidencia.

La fuente de verdad y la política de retención deben seguir siendo explícitas.

## Execution Fabric

La implementación actual proporciona identidad, estado de tarea y programación lógica. No es todavía un daemon distribuido ni garantiza ejecución durante días.

Para producción, el contrato puede proyectarse a Temporal, Queues, Kubernetes u otro worker fabric sin cambiar Isabella.

## Massive Context y Collective

`parallelAnalyze()` proporciona el primitive de fan-out/fan-in. El límite de concurrencia real debe imponerse mediante un scheduler/queue, no creando cientos de promesas sin control.

El consenso conserva participantes, confianza y disenso. No convierte mayoría en verdad.

## Truth y Self Evaluation

Truth Verification calcula una señal de confianza únicamente a partir de evidencia y contradicciones suministradas. No realiza por sí misma búsquedas web ni certifica fuentes.

Self Evaluation revisa criterios explícitos sobre una salida. No altera el modelo base.

Para producción, ambos deben conectarse a IKES, VERITAS y LITLE, con evidencia identificable.

## Digital Twin

El gemelo digital representa nodos y relaciones de un sistema. Puede alimentarse posteriormente desde:

- repositorios Git;
- manifests;
- infraestructura;
- servicios;
- bases de datos;
- telemetría;
- Atlas.

La existencia del twin no implica que el sistema físico esté sincronizado en tiempo real.

## Strategic Intelligence

El motor acepta escenarios explícitos con probabilidad, coste y supuestos. No inventa probabilidades ni pretende predecir el futuro. Es un instrumento de decisión.

## Seguridad

Toda capacidad debe respetar:

1. autoridad balanceada;
2. CROWN;
3. AEGIS;
4. consentimiento cuando corresponda;
5. evidencia cuando corresponda;
6. ejecución aislada;
7. auditoría posterior.

Los secretos nunca forman parte de los descriptors.

## Integraciones

El HSF está preparado para federar:

- GitHub;
- MCP;
- APIs;
- Docker/Kubernetes;
- PostgreSQL;
- Redis;
- Atlas;
- LITLE/BookPI;
- PennyLane.

La integración de un proveedor debe conservar el mismo contrato y no introducir un runtime paralelo.

## Estado

**Implementado:** contratos HSF, registry, gateway, diez primitivas, endpoint gobernado, tests básicos y documentación.

**Pendiente para producción distribuida:** persistencia externa de memoria, scheduler durable, workers aislados, vector/grafo stores, evaluación de calidad, límites de concurrencia, observabilidad SLO y conectores concretos.


## Origen: `docs/ISABELLA_PENNYLANE_BRIDGE.md`

# Isabella GenesisAI — PennyLane Quantum Bridge

## Propósito

Este módulo establece a **Isabella Villaseñor GenesisAI como sistema canónico** y a PennyLane como un ecosistema externo de ejecución/investigación cuántica conectado mediante un contrato explícito.

No se copia el código de PennyLane dentro de GenesisAI. Isabella mantiene la gobernanza, identidad, autorización, evidencia, observabilidad y procedencia; PennyLane aporta las capacidades cuánticas a través de un servicio puente.

## Repositorios conectados

### PennyLane

https://github.com/PennyLaneAI/pennylane

Es la plataforma open source de PennyLane para computación cuántica, quantum machine learning y química cuántica. Es el punto principal del puente.

### PennyLane-Lightning

https://github.com/PennyLaneAI/pennylane-lightning

Aporta simuladores de alto rendimiento de estado y tensor network escritos en C++, incluyendo backends como `lightning.qubit` y `lightning.kokkos`.

### Catalyst

https://github.com/PennyLaneAI/catalyst

Aporta compilación JIT de programas híbridos clásico-cuánticos y un runtime orientado a workflows compilados.

### PennyLane-Qiskit

https://github.com/PennyLaneAI/pennylane-qiskit

Aporta interoperabilidad con el ecosistema Qiskit/IBM mediante el plugin de PennyLane.

## Arquitectura

```text
                    ISABELLA VILLASEÑOR GENESISAI
                               │
                    CROWN / AEGIS / AUTHORITY
                               │
                         Genesis Runtime
                               │
             ┌─────────────────┼─────────────────┐
             │                 │                 │
          Modules           Skills           Protocols
             │                 │                 │
             └─────────────────┼─────────────────┘
                               │
                  isabella.quantum.pennylane
                               │
                    PennyLane Bridge API
                               │
              ┌────────────────┼────────────────┐
              │                │                │
         PennyLane        Lightning          Catalyst
              │                │                │
              └────────────────┼────────────────┘
                               │
                         Qiskit bridge
                               │
                    Quantum backend/QPU
```

## Contrato

El contrato `isabella.quantum.pennylane.v1` transporta:

- circuito;
- número de qubits;
- operaciones;
- parámetros;
- backend;
- shots;
- seed;
- metadatos;
- request ID;
- hash SHA-256 de la solicitud.

El bridge valida localmente el circuito antes de realizar cualquier llamada de red.

## Seguridad

La ruta HTTP no llama directamente a PennyLane.

La secuencia es:

```text
request
  ↓
principal
  ↓
assertBalancedAuthority
  ↓
Genesis.evaluate()
  ↓
CROWN / AEGIS / capability gate
  ↓
PennyLaneBridge
  ↓
remote quantum service
```

Por diseño:

- endpoint ausente = `unavailable`;
- circuito inválido = `rejected`;
- error remoto = `unavailable`;
- no se simula una ejecución cuando PennyLane no está conectado;
- no se declara hardware cuántico disponible sin un backend real.

## Adaptador ejecutable

El repositorio incluye `services/pennylane_bridge.py`, un servidor HTTP opcional que ejecuta circuitos con PennyLane y, cuando está disponible, `lightning.qubit` y Catalyst. No sustituye al Genesis Runtime: sólo ejecuta solicitudes que ya pasaron la gobernanza de Genesis.

Instalación:

```bash
python -m pip install -r services/requirements-quantum.txt
npm run quantum:bridge
```

Por defecto escucha en `127.0.0.1:8000`.

## Configuración

Variables:

```bash
PENNYLANE_BRIDGE_URL=http://localhost:8000
PENNYLANE_BRIDGE_TIMEOUT_MS=5000
PENNYLANE_BACKEND=pennylane-lightning
```

El servicio externo debe exponer:

```text
GET  /health
POST /execute
```

La integración está deliberadamente desacoplada del lenguaje del proveedor. El backend PennyLane puede ser Python y GenesisAI continúa siendo TypeScript/Node.

## Estado epistemológico

El bridge no convierte el resultado de un simulador en evidencia científica por sí mismo.

Un resultado cuántico debe entrar posteriormente en:

```text
PennyLane result
      ↓
Genesis verification
      ↓
IKES provenance
      ↓
VERITAS
      ↓
LITLE evidence attestation
      ↓
BookPI provenance
```

Esto mantiene la separación:

```text
CAPABILITY ≠ AUTHORITY ≠ EXECUTION ≠ EVIDENCE
```

## Evolución

Las siguientes capacidades pueden conectarse detrás del mismo contrato sin crear otro runtime:

- simulación Lightning;
- compilación Catalyst;
- interoperabilidad Qiskit;
- estimación de recursos;
- ejecución en hardware;
- workflows híbridos cuántico-clásicos;
- evidencia reproducible de experimentos;
- datasets/resultados con provenance LITLE.

La misión de estos repositorios no es convertirse en otro núcleo de Isabella. Son proveedores especializados subordinados al Genesis Runtime.


## Origen: `docs/LITLE_GENESIS_INTEGRATION.md`

# LITLE Trust Fabric — GenesisAI

## Ownership
GenesisAI is the canonical runtime. LITLE is an internal trust/evidence/certification fabric; it is not a second cognitive runtime.

## Operational surface
- `POST /api/v1/litle/attest` creates a deterministic LITLE identity binding, evidence-chain root, epistemic profile and DAC certificate.
- `POST /api/v1/litle/verify` verifies the certificate and optional evidence chain. The HMAC secret never crosses the API boundary.
- `GET /api/v1/status` reports the LITLE fabric as an active Genesis subsystem.

## Cryptographic boundary
L-512.v1 is implemented as a fixed 512-byte container format. Canonical transport uses Bech32m. Evidence roots and container hashes use SHA3-512 through Node's native crypto implementation. Certificates use HMAC-SHA256 with the existing BOOKPI integrity secret.

This implementation does not claim to be a native ML-DSA/Dilithium implementation. Post-quantum signature integration remains a separate cryptographic-provider boundary.

## Epistemic layer
The current executable weighting follows the source implementation: methodological rigor 20%, reproducibility 18%, citation integrity 15%, peer review 12%, data transparency 12%, AI provenance 10%, longevity 8%, epistemological novelty 5%.

## Security
`BOOKPI_INTEGRITY_SECRET` must be configured externally with at least 32 characters in production. Certificate verification uses the server-side secret and does not accept a client-provided secret.


## Origen: `docs/platform/PLATFORM-GIFTS.md`

# Plataforma: diez capacidades añadidas (2026-10-16)

state: draft | engine-generated (pendiente de revisión humana con nombre). Manifiesto ejecutable: `src/platform/index.ts` (`PLATFORM_GIFTS`).

| # | Capacidad | Archivo | Cableado |
|---|-----------|---------|----------|
| 1 | Reintentos con backoff, jitter completo y deadline | `src/resilience/retry.ts` | biblioteca |
| 2 | Bulkhead (cola acotada, load shedding) | `src/resilience/bulkhead.ts` | biblioteca |
| 3 | Inbox de webhooks + guarda de orden | `src/ingress/webhook-inbox.ts` | webhook de Stripe |
| 4 | Preflight de configuración | `src/health/preflight.ts` | arranque (`STRICT_PREFLIGHT=1`) + `GET /api/v1/ops/preflight` |
| 5 | Redactor de PII (CURP/RFC/CLABE/tarjeta validados) | `src/privacy/pii-redactor.ts` | biblioteca |
| 6 | SLO y quema multi-ventana | `src/observability/slo.ts` | biblioteca |
| 7 | BM25 + RRF | `src/memory/bm25.ts` | biblioteca |
| 8 | Feature flags con rollout y kill switch | `src/governance/feature-flags.ts` | biblioteca |
| 9 | Presupuesto de costo con reservas | `src/inference/cost-budget.ts` | biblioteca |
| 10 | Paquete de evidencia verificable offline | `src/bookpi/evidence-bundle.ts` | biblioteca |

Honestidad: "biblioteca" significa implementada y probada pero NO invocada por el runtime todavía; integrarla en una ruta o flujo requiere decisión humana. Los límites de cada módulo están en el manifiesto. Los estados en memoria son por proceso. Ninguna capacidad concede autoridad ni ejecuta efectos externos.


## Origen: `docs/ASSURANCE-CONTROL-PLANE.md`

# Assurance Control Plane — Isabella Genesis V6

**Status:** additive engineering control; structural audit only.  
**Branch:** `evolution/assurance-control-plane-2026-10`  
**Purpose:** make repository-level regressions visible on every pull request and preserve a machine-readable audit artifact tied to the exact commit.

## Implemented in this change

1. `scripts/repository-assurance.mjs` performs dependency-free, read-only checks for package metadata, required scripts, lockfile ambiguity, pull-request CI coverage, frozen installs, and key security/evidence artifacts.
2. `.github/workflows/repository-assurance.yml` runs the audit on pull requests, pushes to main/evolution branches, and manual dispatch.
3. The workflow publishes JSON and Markdown reports named with the full Git SHA. Warnings remain visible without being misrepresented as blockers.
4. The audit also guards against structural regression of the README's veracity/reproducibility contract, the evidence-backed readiness endpoint, fail-closed dependency checks, and the presence of Genesis/IGE modules plus their tests. It additionally requires bounded route-latency telemetry and percentile benchmark tests, and rejects reintroduction of the audited placeholder IKES source seeds.
4. Structural blockers fail the job. The audit deliberately does not claim that a route is secure, a provider is connected, cryptography is post-quantum, or a deployment is healthy merely because a file exists.

## Reproduction

```bash
node scripts/repository-assurance.mjs
```

Outputs:
- `artifacts/assurance/repository-assurance.json`
- `artifacts/assurance/repository-assurance.md`

The generated directory should be treated as a build artifact, not committed as fresh evidence. CI attaches the reports to the exact workflow run.

## Acceptance and interpretation

- **PASS** means the named structural invariant was observed in the checked-out tree.
- **WARN** means the condition needs attention but is not automatically a release blocker.
- **FAIL** means a structural blocker is missing or invalid and the job exits non-zero.
- A report is not proof of runtime behavior, threat resistance, integration, production readiness, or legal/regulatory compliance.
- Existing typecheck, unit tests, security suite, and production-evidence gates remain authoritative for their own scopes; this audit supplements rather than replaces them.

## Initial findings to resolve

1. **Lockfile blocker:** the repository file API did not find `pnpm-lock.yaml`, `package-lock.json`, or `yarn.lock` on this branch. The existing CI uses `pnpm install --frozen-lockfile`; that combination is not reproducible and is expected to fail until the intended lockfile is generated and committed. The new gate reports this as a blocker rather than silently weakening installation policy.
2. **Package-manager pin:** `package.json` does not declare `packageManager`, although CI configures pnpm 10. Pin the exact approved pnpm version after generating and validating the lockfile.
3. The GitHub workflow runs associated with this branch SHA reported `failure`; logs were not available through the connected API, so the precise failing step remains unconfirmed. Do not attribute the failure solely to the missing lockfile without retrieving the full job log.

Do not silently modify the lockfile or claim reproducibility without running the actual install and validation suite.
