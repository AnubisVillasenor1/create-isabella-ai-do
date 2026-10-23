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
