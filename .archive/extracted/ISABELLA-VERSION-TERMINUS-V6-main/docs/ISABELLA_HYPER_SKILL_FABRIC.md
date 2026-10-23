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

