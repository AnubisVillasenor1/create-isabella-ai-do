# ARCHITECTURE consolidado

> `state: draft | engine-generated` - unificacion tematica. El contenido se migro **sin edicion**;
> cada seccion conserva su origen. La granularidad por fichero esta en el historial de git.

## Fuentes unificadas

1. `docs/ARCHITECTURE-OPERATING-MAP.md`
2. `docs/CROWN-ISABELLA-VOMEGA-OPERATING-SPEC.md`
3. `docs/CROWN_CONVERGENCE.md`
4. `docs/architecture/GENESIS-MAGPIE-INTEGRATION.md`
5. `docs/osiris/ARCHITECTURE.md`
6. `docs/reina/ARCHITECTURE.md`

---


## Origen: `docs/ARCHITECTURE-OPERATING-MAP.md`

# Isabella Genesis TINA — mapa operativo

**Estado:** `draft | auto_generated`  
**Fecha:** 2026-10-10  
**Revisión humana requerida antes de declarar `verified` o `wired`.

## Invariante de gobierno

`CAPABILITY ≠ AUTHORITY ≠ EXECUTION ≠ EVIDENCE ≠ LEARNING ≠ PRODUCTION`

El runtime puede evaluar, registrar y proponer. La aprobación humana conserva la autoridad para cambios de estado, acciones externas y producción.

## Flujo principal

1. `src/server.ts` expone la superficie HTTP, límites de tasa, CROWN, AEGIS, herramientas, memoria y el panel operativo.
2. `src/genesis/runtime.ts` compone el runtime y sus registros de skills/tools.
3. `src/cognition/*`, `src/crown/*`, `src/authority/*` y `src/core/*` evalúan intención, riesgo, autoridad e invariantes.
4. `src/bookpi/*` construye y verifica la cadena hash. `src/bookpi/storage-postgres.ts` es el puerto durable para `public.bookpi_events`.
5. `src/atlas/*` usa Supabase REST con `SUPABASE_SERVICE_ROLE_KEY` para persistencia de Atlas; la clave nunca debe llegar al navegador.
6. `infra/db/migrations/*` y las migraciones aplicadas por Supabase definen tablas, índices y RLS.
7. `test/*` aporta evidencia computacional. No sustituye aprobación humana, revisión de PR ni evidencia de producción.

## Interconexión operativa añadida en la rama de auditoría

1. `src/server.ts` compone `createRuntimeBookPiStorage(process.env)` y entrega el puerto seleccionado a `POST /api/v1/pipeline/execute`.
2. `src/bookpi/runtime-storage.ts` selecciona PostgreSQL con `DATABASE_URL`, JSONL local con una ruta explícita o memoria volátil; el probe devuelve estado no saludable para el fallback en memoria.
3. `src/bookpi/storage-postgres.ts` ejecuta append en una sola transacción/conexión, establece `app.actor_id` de forma local, serializa la cabeza con advisory lock, normaliza `BIGINT` y rechaza escrituras fuera del actor configurado.
4. `src/memory/ikes-supabase.ts` persiste fuentes y claims en tablas separadas. `IKESEngine` hidrata, valida hashes/referencias, serializa escrituras y expone un probe; no promueve automáticamente el estado epistemológico.
5. `src/genesis/runtime.ts` inicializa Atlas e IKES en paralelo y mantiene disponible el fallback conversacional local cuando IKES no termina la hidratación. La API explícita de memoria permanece fail-closed.
6. `GET /api/v1/integrations/graph` ofrece un grafo de módulos y salud bajo autenticación administrativa.

**Límite no resuelto:** el ledger síncrono heredado `bookPiLedger` usado por rutas como YUN/HyperCore todavía no está unificado con el puerto asíncrono PostgreSQL del conductor. La integración del pipeline no debe presentarse como durabilidad global de todo BookPI. Las migraciones deben aplicarse y los probes/E2E deben pasar en un entorno remoto antes de marcar `wired`.

## Fronteras de datos

| Dominio | Fuente | Protección | Estado |
|---|---|---|---|
| BookPI | `public.bookpi_events` | RLS service-role; append-only operativo | `draft / requiere prueba E2E` |
| Webhooks | `public.webhook_events` | RLS service-role + idempotencia `(provider, external_event_id)` | `draft` |
| Workspaces | `public.workspaces`, `workspace_members` | RLS propietario/membresía | `draft` |
| Comercial | goals, offers, campaigns, leads, sales | RLS por workspace | `draft` |
| Atlas | tablas Atlas existentes | Supabase REST con timeout | `draft` |

## Contratos para cualquier cambio

- Validar tipos con `pnpm typecheck`.
- Ejecutar `pnpm test` y registrar el resultado en evidencia, sin llamarlo capacidad o autoridad.
- Toda mutación comercial debe recomputar valores en servidor, ser idempotente y quedar trazada.
- Toda consulta multi-tenant debe llevar `workspace_id` y depender de RLS; no confiar solo en filtros de UI.
- Toda nueva skill debe declarar `methodId`, `riskTier`, requisitos de evidencia y limitaciones.
- Todo estado `verified` necesita nombre de revisor humano; hasta entonces usar `draft`.
- Los bloqueos que dependan de HSM/KMS, proveedor PQC, SMTP, observabilidad o despliegue real permanecen `BLOCKED_ENVIRONMENT`.

## Ruta de seguimiento

- **P0:** probar BookPI durable contra Supabase, restauración/backups, secretos, observabilidad y workflow de producción.
- **P1:** migrar gradualmente rutas de mutación críticas a adapters persistentes y contratos validados.
- **P2:** consolidar módulos duplicados y reemplazar estados implícitos por estados del ledger.
- **Release:** typecheck + tests + security suite + production evidence + revisión humana con nombre + workflow de despliegue.

## Decisiones epistemológicas

El sistema debe distinguir siempre `NOT_ASSESSED`, `UNVERIFIED`, `OBSERVED`, `CORROBORATED`, `REPRODUCIBLE` y `VALIDATED`. Ninguna respuesta de interfaz debe presentar inferencias, mocks o cadenas en memoria como evidencia de producción.

## Riesgos abiertos

- El pipeline HTTP ya usa el puerto BookPI seleccionable, pero la cadena síncrona heredada y el adapter Postgres siguen siendo contratos distintos; falta unificar las rutas heredadas y demostrar el wiring E2E en una base remota.
- El service role permite bypass de RLS y solo debe existir en el proceso servidor.
- Las migraciones aplicadas deben conservarse también como artefactos versionados del repositorio antes de la siguiente release.
- La aprobación humana sigue siendo obligatoria para pasar de `draft` a `verified` y de `verified` a `wired`.

## Cómo continuar sin una persona específica

Un desarrollador nuevo debe comenzar por este archivo, `docs/ESTADO-REAL-ACTUAL.md`, `AGENTS.md`, `src/server.ts`, `src/bookpi/types.ts`, `src/bookpi/storage-postgres.ts`, las migraciones y los tests del dominio que vaya a modificar. Cada cambio debe dejar contrato, evidencia, limitación y decisión de rollback.


## Origen: `docs/CROWN-ISABELLA-VOMEGA-OPERATING-SPEC.md`

# C.R.O.W.N. e Isabella VΩ — documentación técnica operativa

**Código canónico:** `CANON-EOC-ANUBIS-ISABELLA-2026`  
**Autoría y responsabilidad arquitectónica declaradas:** Edwin Oswaldo Castillo Trejo, firma creativa Anubis Villaseñor  
**ORCID declarado:** `0009-0008-5050-1539`  
**Territorio de referencia:** Mineral del Monte / Real del Monte, Hidalgo, México  
**Sistema:** Isabella Villaseñor AI — Genesis TINA V6  
**Versión documental:** 1.1.0  
**Estado:** especificación técnica en evolución; no es certificación, auditoría independiente ni prueba de despliegue  
**Ámbito:** C.R.O.W.N., políticas de interacción, gateway de inferencia, YUN events, BookPI/evidencia, seguridad, monetización y efectos visuales.

> **Contrato de evidencia:** `SPECIFIED ≠ IMPLEMENTED ≠ TESTED ≠ INTEGRATED ≠ VERIFIED ≠ DEPLOYED ≠ CERTIFIED`. Cada afirmación de capacidad debe enlazarse con código, prueba y evidencia de ejecución sobre un SHA concreto.

## 1. Propósito y separación constitucional

C.R.O.W.N. (Constitution of the Reality Ontological Web Native) se define en este proyecto como el marco normativo y de autorización: expresa políticas, límites, permisos, revisión humana y condiciones de admisión. YUN se define como el plano de eventos y coordinación. Isabella es el runtime de asistencia y orquestación que puede invocar capacidades autorizadas. Ninguna de estas denominaciones implica por sí sola una implementación completa ni un sistema distribuido activo.

Principio rector:

`CAPABILITY ≠ AUTHORITY ≠ EXECUTION ≠ EVIDENCE ≠ LEARNING ≠ PRODUCTION`

- **Capacidad:** existe código o adaptador que podría realizar una operación.
- **Autoridad:** la política y la identidad permiten esa operación en este contexto.
- **Ejecución:** una llamada ocurrió y tuvo un resultado observable.
- **Evidencia:** existe un registro verificable del resultado y su procedencia.
- **Aprendizaje:** una actualización de modelo o política fue realizada bajo un procedimiento explícito.
- **Producción:** el componente fue integrado, configurado, probado y desplegado con controles operativos.

Una respuesta generada no constituye una autorización. Un hash no demuestra que el contenido sea verdadero. Un registro en memoria no es un ledger inmutable. Una ruta HTTP no demuestra que todos los componentes del diagrama se hayan ejecutado.

## 2. Arquitectura de referencia

```text
Cliente / API
    |
    v
Validación de entrada y límite de tamaño
    |
    v
Identidad, workspace, scopes y consentimiento
    |
    v
C.R.O.W.N. — política, intención, riesgo y decisión
    |
    +----> bloquear / pedir aclaración / solicitar aprobación humana
    |
    v
AEGIS — inspección de entrada y de salida
    |
    v
ISA / Isabella runtime — contexto acotado y gateway de inferencia
    |
    v
VERITAS — validaciones deterministas disponibles
    |
    v
BookPI — registro de evidencia cuando está configurado
    |
    v
Respuesta + correlation/trace ID + telemetría redactada
    |
    v
YUN — contrato de evento; bus y persistencia requieren integración explícita
```

El orden anterior es una arquitectura objetivo, no una afirmación de que todos los pasos estén conectados actualmente en cada endpoint.

## 3. Componentes y límites operativos

| Componente | Responsabilidad prevista | Evidencia / límite |
|---|---|---|
| C.R.O.W.N. Kernel | Políticas, admisión, scopes, riesgo y aprobación | El repositorio contiene módulos CROWN; cada ruta debe demostrar que los invoca y respeta el resultado. |
| ISA API | Interacción conversacional y análisis estructurado | El runtime HTTP actual no equivale automáticamente a las rutas propuestas `/api/isabella/chat` y `/api/isabella/isa/reason`. No documentarlas como disponibles sin comprobar rutas registradas. |
| Mexa API | Adaptadores criptográficos y verificación | No declarar Dilithium/ML-DSA activo hasta identificar implementación, biblioteca, parámetros, pruebas y formato de firma. |
| YUN Fabric | Contrato de eventos y coordinación federada | Esta versión incorpora un constructor/validador local de eventos. No es todavía un bus AMQP/WebSocket, servicio distribuido ni almacenamiento durable. |
| BookPI | Huellas de integridad y eventos auditables | La integridad depende de canonicalización, claves, almacenamiento y verificación. SHA-256 no es una firma ni garantiza inmutabilidad por sí solo. |
| AEGIS | Reglas de inspección y mitigación | Reglas heurísticas no equivalen a un clasificador ML entrenado ni a cobertura exhaustiva de amenazas. |
| MNEMOS / IKES | Contexto y procedencia epistemológica | Contexto en la petición, memoria de sesión y memoria persistente son capacidades distintas; deben declararse por separado. |
| Monetización | Flujos comerciales, pagos, atribución y reparto | No habilitar cobros ni reparto real hasta contar con consentimiento, contratos, verificación de webhooks, idempotencia, conciliación y pruebas. |

## 4. Pipeline de interacción ISA

### 4.1 Secuencia mínima

1. Validar cuerpo, roles, longitudes, formato y límites de historial.
2. Asignar un `request_id` o `trace_id` no sensible.
3. Evaluar intención y señales de riesgo como heurísticas; no presentar la puntuación como probabilidad calibrada.
4. Aplicar autorización del lado servidor. La clasificación de intención no concede permisos.
5. Enviar al proveedor sólo el contexto mínimo necesario, si hay proveedor configurado y autorizado.
6. Validar código HTTP, esquema, tamaño y contenido no vacío de la respuesta.
7. Aplicar timeout, cooldown y failover sólo hacia proveedores elegibles; los modelos de pago requieren habilitación explícita.
8. Si falla la inferencia externa, identificar claramente el fallback local. No simular una respuesta generativa.
9. Registrar métricas operativas y resultado sin exponer claves, cabeceras de autorización ni contenido sensible por defecto.
10. Adjuntar evidencia sólo si el mecanismo de registro se ejecutó realmente y puede verificarse.

### 4.2 Endpoints de referencia

Los siguientes endpoints forman parte de la especificación deseada; su disponibilidad debe confirmarse contra el registro real de rutas:

- `POST /api/isabella/chat`: conversación gobernada.
- `POST /api/isabella/isa/reason`: evaluación estructurada con señales y límites de confianza.
- `POST /api/isabella/crypto/sign`: operación privilegiada de firma; requiere autenticación fuerte, autorización por alcance, límites de payload y protección de claves.
- `POST /api/isabella/crypto/verify`: verificación pública o autenticada según política; debe distinguir integridad, firma válida, identidad del firmante y confianza en la clave.

No publicar un endpoint de firma privilegiada como operador hasta que la autorización se pruebe con casos positivos y negativos.

## 5. Prompt Guard e Intention Parser

La documentación fundacional propone nueve categorías de amenaza y ocho dominios de intención. Deben tratarse como una taxonomía de diseño hasta que el código y sus pruebas confirmen el número exacto y la cobertura.

Controles mínimos:

- Normalizar Unicode y espacios sin alterar el significado del contenido.
- Evitar que una coincidencia regex sea la única decisión en operaciones de alto riesgo.
- Incluir pruebas para negación, citas, contenido multilingüe, texto ofuscado y falsos positivos.
- Evaluar instrucciones incrustadas en documentos como datos no confiables, nunca como permisos del sistema.
- Registrar códigos de regla y versión del clasificador; evitar almacenar el mensaje completo por defecto.
- Para acciones destructivas, exfiltración, secretos y datos personales, fallar de forma conservadora y requerir autorización explícita o revisión humana.
- Declarar `confidenceKind: "heuristic"` cuando el valor proceda de reglas; no llamarlo confianza estadística calibrada.

El control contra sexualización no autorizada debe tener definición de alcance, pruebas y reglas explícitas; la expresión “triple bloqueo” no demuestra por sí sola una defensa completa.

## 6. YUN Fabric — contrato de evento

Cada evento de gobernanza debería incluir:

- `event_id`: identificador único del evento.
- `event_type`: nombre versionado del hecho observado.
- `domain` y `federation_id`: dominio y federación declarados.
- `entity_id`: entidad afectada, sin incorporar secretos.
- `trace_id`: correlación entre etapas.
- `timestamp`: fecha/hora ISO-8601 UTC.
- `severity`: `info | warning | error | critical | audit`.
- `schema_version`: versión del contrato.
- `payload`: objeto JSON acotado, validado y minimizado.
- `event_hash`: SHA-256 del contenido canónico para detectar cambios accidentales.

El constructor local de eventos valida el contrato y calcula un hash de contenido. **No firma criptográficamente, no publica en un bus, no persiste, no garantiza orden distribuido y no convierte el registro en inmutable.** Para lograrlo hacen falta un transporte, autenticación entre servicios, almacenamiento durable, control de acceso, política de retención, verificación de cadena y gestión de claves.

Ejemplo conceptual (no implica que exista un bus conectado):

```ts
const event = createYunEvent({
  event_type: "policy.decision",
  domain: "governance",
  federation_id: "F1",
  entity_id: "workspace-123",
  trace_id: "trace-abc123",
  timestamp: new Date().toISOString(),
  severity: "audit",
  payload: { decision: "deny", policy_id: "policy.external-action.v1" },
});
// event.eventHash es una huella de integridad, no una firma ni prueba de verdad.
```

## 7. Criptografía y evidencia

La especificación inicial menciona “Dilithium-5”. En documentación interoperable debe identificarse el algoritmo estandarizado exacto y su versión. ML-DSA-87, estandarizado por FIPS 204, es el nombre normalizado asociado al conjunto de parámetros de mayor nivel de seguridad de ML-DSA; no debe suponerse que una biblioteca denominada “Dilithium-5” sea automáticamente compatible.

Para declarar una integración criptográfica activa deben documentarse: biblioteca y versión, algoritmo y parámetros, formato de clave/firma, serialización canónica, rotación, revocación, protección de claves, vectores de prueba, manejo de errores y verificación independiente. Nunca implementar criptografía propia para sustituir una biblioteca auditada.

Niveles de evidencia sugeridos:

- **E0 — No verificado:** afirmación o artefacto sin fuente comprobada.
- **E1 — Fuente localizada:** existe una fuente identificable, todavía no corroborada.
- **E2 — Corroborado:** dos o más fuentes independientes compatibles.
- **E3 — Sustento técnico/académico:** documentación primaria o análisis experto pertinente.
- **E4 — Reproducible:** un tercero puede repetir el procedimiento con resultados comparables.
- **E5 — Validado:** pruebas definidas y criterios de aceptación satisfechos por evidencia conservada.

Estos niveles son una política documental propuesta; no deben asignarse automáticamente a una publicación o artefacto sólo por poseer DOI, hash o firma.

## 8. Licencias, reparto y salvaguardas económicas

### 8.1 LICENSE-KORIMA y LICENSE-EOL

Los nombres LICENSE-KORIMA y LICENSE-EOL son designaciones del marco del proyecto, no licencias legales estándar por el solo hecho de nombrarlas. Antes de distribuir código bajo esos términos se requiere un texto completo que defina derechos concedidos, condiciones, compatibilidad con dependencias, jurisdicción y mecanismo de cumplimiento. Una “obligación moral” de reinyectar valor no se convierte automáticamente en obligación exigible.

Un mecanismo EOL (dead-man switch) debe ser explícito, revocable y seguro: política de activación, prueba de vida, umbral de fallos, periodo de gracia, datos autorizados, cifrado, destino, verificación de restauración y protección contra activación maliciosa. No replicar automáticamente secretos, datos personales o activos de terceros a IPFS/Arweave.

### 8.2 Split 75/25

La fórmula del documento fundacional se interpreta como: 75% para el creador y el 25% restante distribuido entre Fondo Fénix, infraestructura y utilidad DAO en proporción 20/30/50 **del remanente**. Eso equivale a 5%, 7.5% y 12.5% del total, respectivamente, antes de impuestos, comisiones y ajustes contractuales. Si la intención era 20/30/50 puntos porcentuales del total, contradice el 75/25 y debe resolverse antes de cobrar o liquidar.

Nunca confundir ingresos brutos, ingresos netos, comisiones, impuestos, devoluciones y fondos disponibles. Las liquidaciones deben ser idempotentes, reconciliables y auditables.

## 9. Seguridad, privacidad y autorización

- Tokens de sesión breves, API keys con alcance limitado, almacenamiento de secretos sólo en backend/secret manager y rotación documentada.
- En un entorno Supabase, activar RLS por tenant/workspace y probar explícitamente lectura, escritura y borrado entre tenants.
- Verificar firmas de webhooks antes de procesar el evento; usar idempotencia y protección contra replay.
- Solicitar consentimiento explícito antes de ejecutar herramientas con efectos externos.
- Mantener aprobación humana para acciones financieras, legales, destructivas o irreversibles según riesgo.
- Limitar tamaño de cuerpo, historial, salida, timeout, reintentos y concurrencia.
- No incluir claves, tokens, payloads completos ni PII en logs, trazas o mensajes de error.
- Definir retención, exportación, eliminación, respaldo y recuperación antes de almacenar memoria personal persistente.
- Separar el acceso a la consola de operador del acceso de usuario público.

## 10. Monetización: estado y gates

Los diez motores propuestos —Social Commerce, Affiliate Revenue, Lead-to-Cash, Creator Revenue Studio, Digital Product Factory, Agency-in-a-Box, Booking & Deposits, Membership & Community, Brand Deal Exchange y Revenue Optimizer— son dominios de producto, no diez sistemas listos para operar.

Cada motor debe superar los siguientes gates antes de habilitar dinero real:

1. Entidad comercial, workspace y permisos verificados.
2. Consentimiento y disclosures comerciales.
3. Ofertas, precios, impuestos, moneda, devoluciones y términos explícitos.
4. Checkout o proveedor de pago de prueba y verificación de firma de webhooks.
5. Idempotencia, conciliación y separación de eventos de impresión, clic, lead, pedido, pago y reembolso.
6. Controles antifraude con revisión humana y proceso de disputa.
7. Reparto económico probado sobre importes simulados y luego entorno sandbox.
8. Evidencia de aceptación y rollback documentado.

Los planes FREE, PREMIUM, VIP y ENTERPRISE son niveles comerciales propuestos. No mostrar capacidades de un plan como disponibles hasta que el control de entitlements se aplique del lado servidor.

## 11. Efectos visuales Epic Visual Effects v4.0

El fragmento React suministrado es un **esqueleto de diseño**, no una implementación terminada: las clases `Star`, `QuadTree`, `Starfield`, `VolumetricRays`, `HolographicGrid` y `PostProcessor` aparecen omitidas; `effectConfigs` está vacío y `handleResize` no contiene lógica. Por ello, todavía no produce los efectos anunciados.

Antes de integrarlo en la interfaz conversacional, los criterios de aceptación son:

- Implementar cada efecto y el QuadTree con pruebas unitarias para límites y casos degenerados.
- Ajustar canvas por `devicePixelRatio` sin acumular escalas en cada resize.
- Limitar densidad de partículas según área, DPR y presupuesto de fotogramas; no fijar 500 estrellas para todos los dispositivos.
- Cancelar `requestAnimationFrame` y retirar listeners al desmontar; impedir bucles duplicados en React Strict Mode.
- Respetar `prefers-reduced-motion`, visibilidad de pestaña y ahorro de batería.
- Evitar chromatic aberration, grain y bloom costosos por defecto en móviles; medir FPS y memoria.
- Mantener el canvas decorativo con `aria-hidden="true"`, sin capturar interacción y con fondo alternativo accesible.
- Verificar que la animación no retrase la entrada, lectura o envío de mensajes.

La prioridad de producto sigue siendo una interacción conversacional estable y accesible; los efectos visuales no deben bloquear esa ruta.

## 12. Pruebas y criterios de aceptación

- **Contrato de evento:** campos obligatorios, timestamp inválido, payload no JSON, identificadores demasiado largos, canonicalización determinista y detección de cambios.
- **CROWN:** rutas permitidas/denegadas, falta de scope, negación, ambigüedad y solicitud de acción externa.
- **Gateway:** éxito, timeout, 429, 5xx, JSON inválido, salida vacía, cooldown, failover y ausencia de claves.
- **Privacidad:** ausencia de claves y cuerpos sensibles en logs; historial acotado; no persistencia no declarada.
- **BookPI/Mexa:** pruebas de firma y verificación con vectores conocidos cuando exista implementación real; fallo ante clave incorrecta o payload alterado.
- **Pagos:** firma webhook inválida, replay, evento duplicado, reembolso, disputa y conciliación.
- **Visuales:** resize repetido, desmontaje, DPR alto, móvil, movimiento reducido y fallback sin canvas.

Un test unitario pasa sólo el comportamiento cubierto. Un smoke test del endpoint no demuestra disponibilidad de proveedores externos ni preparación de producción.

## 13. Estado de esta revisión

| Entregable | Estado en esta rama |
|---|---|
| Contrato arquitectónico y reglas de honestidad | Documentado |
| Constructor/validador de evento YUN | Implementación local incorporada por separado |
| Bus federado YUN y persistencia durable | No demostrado por el constructor |
| Endpoints ISA enumerados en esta especificación | Requieren comprobación de rutas reales antes de anunciarlos |
| Firma poscuántica Mexa API | No declarar activa sin implementación y vectores de prueba |
| LICENSE-KORIMA / LICENSE-EOL | Requieren texto legal completo y revisión de compatibilidad |
| Monetización real | No habilitar sin gates de pago, conciliación y antifraude |
| Epic Visual Effects v4.0 | Esqueleto; clases y lógica de resize pendientes |
| Inferencia externa en beta | Requiere respuesta real con proveedor configurado sobre el SHA desplegado |
| Producción / certificación | No declaradas |

## 14. Responsabilidad y cierre

La identidad de autoría, el origen territorial y el propósito de TAMV forman parte del contexto del proyecto. No sustituyen revisión independiente ni evidencia técnica. La forma de proteger el legado es mantener una separación visible entre visión, especificación, implementación, pruebas y operación.

**Regla de publicación:** toda nota de versión debe indicar el commit, pruebas ejecutadas, integraciones activas, limitaciones conocidas y responsable de la aprobación. No se deben afirmar “inmutabilidad”, “PQC activo”, “ML nativo”, “autonomía” o “producción” por analogía o intención arquitectónica.


## Origen: `docs/CROWN_CONVERGENCE.md`

# CROWN → GENESIS convergence

## Canonical ownership

GenesisAI is the single source of truth for Isabella's governed cognitive runtime.

The former `isabella-s-crown` capabilities are classified as follows:

| Capability | Canonical home |
|---|---|
| CROWN decisioning | `src/crown` |
| AEGIS / security | `src/security` |
| Identity / authority | `src/identity` + `src/authority` |
| IKES / memory | `src/memory` |
| Veritas | `src/veritas` |
| BookPI / provenance | `src/bookpi`, `src/memory/provenance` |
| Inference | `src/inference` |
| Tools / skills | `src/tools`, `src/skills` |
| Cognitive roles | `src/crown/experience.ts` and `src/cognition` |
| Terminal / presentation | Genesis web application |
| Telemetry presentation | Genesis API + web application |

## Security boundary

The browser is an untrusted presentation client.

It may submit:

- user input;
- session metadata;
- requested operation;
- non-authoritative UI preferences.

It must not submit or override:

- system prompts;
- identity roles;
- authority grants;
- capability registrations;
- policy versions;
- audit evidence;
- approval state.

Genesis derives those values server-side and fails closed when governance verification fails.

## Canonical request contract

`POST /api/v1/cognitive/request`

The endpoint performs:

1. Principal construction and authority validation.
2. CROWN intent/risk evaluation.
3. AEGIS inspection.
4. Capability-gate verification.
5. Adaptive planning and optional IKES retrieval.
6. Canonical cognitive routing.
7. Server-side system-prompt construction.
8. Optional model invocation.
9. Structured decision/snapshot response.

The endpoint is intentionally compatible with a future Crown UI without embedding a second runtime.

## Product-layer convergence

Crown's useful concepts — terminal interaction, module visualization, governance status, evidence state, human approval state and telemetry — become presentation concerns over Genesis contracts.

They must not become a second authority plane.

## Migration rule

No new Genesis core feature should be implemented by copying code from `isabella-s-crown`.

When a Crown capability is useful:

1. classify it as core, governance, infrastructure, or presentation;
2. implement the canonical behavior in Genesis;
3. expose it through a stable API/type contract;
4. make the UI consume that contract;
5. remove the duplicate implementation from the product fork.

## Telemetry rule

Runtime measurements must be produced by Genesis instrumentation. UI-derived estimates must be explicitly labelled as derived and must never be presented as cryptographic, model-provider or runtime facts.

## Evolution target

```
Crown UI / Terminal
        |
        v
Genesis Cognitive API
        |
        v
CROWN → AEGIS → Identity/Authority → IKES → Plan
        |
        +--> Tools / Skills
        +--> Inference
        +--> Veritas
        +--> BookPI / Provenance
        +--> Observability / Evolution
```

This turns Crown from a competing implementation into a first-class Genesis client.


## Origen: `docs/architecture/GENESIS-MAGPIE-INTEGRATION.md`

# Integración evolutiva: Isabella Genesis + MAGPIE-X

## Estado y alcance

Este documento convierte los archivos de arquitectura entregados en una hoja de ruta de implementación para el repositorio. La arquitectura descrita en las fuentes es una meta de diseño, no evidencia de que vLLM, PyTorch, Triton, cuantización INT4/FP8, firmas PQC, persistencia WORM o siete federaciones estén activas en producción.

Invariante: CAPABILITY ≠ AUTHORITY ≠ EXECUTION ≠ EVIDENCE ≠ LEARNING ≠ PRODUCTION.

## Componentes y responsabilidades

- ISA-X / frontera de identidad: autenticación, identidad de servicio, scopes, nonce/TTL, firma de solicitudes y canonicalización. Los secretos deben proceder de un gestor de secretos; no deben incrustarse en código, documentación ejecutable ni frontend.
- CROWN: punto de decisión y punto de aplicación de políticas (PDP/PEP), separación de autorización y ejecución, quórum cuando la política lo requiera, delegaciones con vencimiento y revocación auditable.
- BookPI: evidencia append-only, verificación de cadena, hashes y eventos de auditoría. El hash no equivale a una firma y una cadena local en memoria no equivale a almacenamiento WORM duradero.
- IKES / memoria: distinguir caché o memoria de proceso de persistencia durable; los estados de salud deben venir de probes reales de lectura/escritura.
- MAGPIE-X: tejido federado con identidad, contexto, evaluación de riesgo, límites, auditoría y anclaje. Los fallos de anclaje deben generar cola durable, reintentos, alertas y estado explícito; la política determina cuándo se aplica fail-closed.
- IGE / motor cognitivo: router de 12 cabezas, 24 expertos por familias, traza por chunk, guardianes/NCUA, verificación y métricas.
- Trinidad vLLM: Draft, Verify y gestión de KV cache son adaptadores de inferencia separados. No declarar que comparten VRAM o cache hasta demostrarlo en hardware real.

## Implementación incorporada en esta rama

### 1. Readiness operativo fail-closed

src/deployment/production-ops.ts ya no considera un conjunto vacío de dependencias como saludable. Las dependencias obligatorias en estado degraded generan bloqueadores, y nombres duplicados o inválidos no pueden producir un estado listo.

GET /api/v1/readyz y GET /api/v1/ops/snapshot dejan de declarar bookpi-ledger, ikes-memory y observabilidad como saludables sin prueba. La respuesta expone evidencia y devuelve HTTP 503 mientras no existan probes reales. Se añadió un probe de solo lectura y con timeout máximo de 2 segundos para Atlas/Supabase, que comprueba la consulta de la tabla atlas_users; el probe no escribe datos. BookPI e IKES siguen degradados porque no tienen probes de persistencia durable conectados. GET /health es únicamente liveness del proceso y no demuestra que el sistema esté listo.

Limitación deliberada: esta iteración no finge conectividad. Los adapters de probe para base de datos, BookPI durable, modelo, telemetría y memoria deben conectarse y probarse antes de poder marcar dependencias como healthy.

### 2. Contrato de routing IGE

src/cognition/genesis-moe.ts implementa un postprocesador determinista para puntuaciones producidas por un futuro adaptador de inferencia:
- valida exactamente 12 puntuaciones de cabezas y 24 de expertos;
- selecciona cabezas y Top-K expertos (K entre 2 y 4);
- normaliza los pesos seleccionados con softmax estable;
- asigna familias: expertos 0–5 temáticos, 6–11 funcionales, 12–17 éticos y 18–23 metacognitivos;
- rechaza valores no finitos, vectores incorrectos y parámetros fuera de rango;
- resuelve empates por índice para reproducibilidad.

Esto es un contrato de routing ejecutable, no un modelo neuronal, entrenamiento, embedding ni integración vLLM. El módulo de chunks agrega integridad local verificable, pero todavía no conecta esa evidencia a un BookPI durable ni a una firma CROWN. Las puntuaciones deben proceder de un modelo o adapter real; el módulo no inventa una inferencia.

### 3. Integridad de chunks y Unicode

src/cognition/genesis-chunk.ts añade un contrato de chunk versionado con trazas de routing y arbitraje ético, canonicalización de JSON específica de la aplicación y digest SHA-256 que incluye el enlace al chunk anterior. La verificación detecta mutaciones del chunk; no verifica una firma, no demuestra autoría y no persiste el ledger. La canonicalización incluida no se declara conforme a RFC 8785.

El módulo rechaza sustitutos Unicode aislados, valores no serializables/no finitos, propiedades accesoras y propiedades propias no enumerables; los getters no se ejecutan durante la canonicalización. Esto reduce ambigüedad y evita efectos laterales al producir el digest. No normaliza silenciosamente el texto a NFC, porque esa transformación debe definirse en el contrato de entrada y aplicarse antes de firmar o calcular evidencia. Se añadieron pruebas para caracteres españoles, emoji, marcas combinantes, manipulación posterior al digest y enlace entre chunks.

### 4. Unicode y texto de entrada

ISABELLAUNICODE.txt se conserva como material de referencia separado. Su contenido visible incluye pares de puntos/códigos de caracteres y material de configuración empaquetada, pero no aporta por sí solo un contrato de normalización de texto ni una licencia/procedencia verificable. No debe importarse como tabla de codificación de producción sin identificar formato, origen, versión y pruebas de ida/vuelta.

La política de texto propuesta para fronteras API es UTF-8 explícito, rechazo o sustitución documentada de secuencias inválidas, normalización Unicode definida por contrato (por ejemplo NFC cuando sea semánticamente adecuada) y pruebas para acentos, ñ, símbolos, caracteres combinados y entradas malformadas. No normalizar identificadores, firmas o bytes canónicos de forma implícita: la canonicalización criptográfica debe ser una operación versionada separada.

## Plano de ejecución y evidencia

1. Fast path: validar esquema, identidad, scopes, límites y política; enrutar y producir salida preliminar cuando la política lo permita.
2. Verificación: ejecutar guardianes, redacción, validación epistemológica y verificaciones de seguridad en paralelo cuando sea seguro.
3. Consenso: convocar expertos/quórum solo para operaciones o respuestas cuyo riesgo lo exija; registrar desacuerdos en lugar de ocultarlos.
4. Persistencia y gobernanza: escribir eventos de routing, arbitraje y commit en BookPI; marcar estado de persistencia y anclaje. No confundir envío en cola con persistencia confirmada.

Cada chunk gobernado debería incluir request/session ID, secuencia, ruta de expertos, guardianes invocados, flags, hash del chunk, hash anterior, latencia y estado de commit. El hash sirve para detectar alteraciones; la autoría exige firma verificada.

## Plan de evolución por fases

- Fase 0 — contratos y pruebas: esquemas versionados, límites de confianza, fixtures, canonicalización y pruebas negativas. Parte del routing determinista se implementa en esta rama.
- Fase 1 — prototipo CPU: adapter de embeddings/modelo, 4–6 expertos de prueba, métricas de routing, validación de carga y evaluación de calidad. Sin alegar 24 expertos reales si no existen pesos/adapters.
- Fase 2 — inferencia GPU: evaluar PyTorch/vLLM, KV cache y speculative decoding sobre hardware definido; medir latencia p50/p95, tokens/s, memoria, tasa de aceptación y calidad. La meta de primer chunk <80 ms solo se publica si un benchmark reproducible la confirma.
- Fase 3 — optimización: INT4/FP8, pruning y destilación con datasets/versiones, evaluación de regresiones y rollback. No aplicar aprendizaje online a producción sin revisión y controles.
- Fase 4 — federación y persistencia: probes reales, identidad de servicio, scopes, revocación, quorum CROWN, BookPI durable/WORM, cola de anclaje y recuperación probada.
- Fase 5 — producción: gates de CI, SBOM, escaneo de dependencias, pruebas de seguridad, SLOs, runbooks y evidencia de despliegue.

## Gates de aceptación

- Ninguna dependencia requerida se considera sana por configuración solamente.
- Un error de esquema, autorización, firma, integridad o estado de persistencia se rechaza o se marca explícitamente.
- Los tests de routing prueban límites, empates, puntuaciones no finitas y normalización.
- Las métricas publicadas proceden de ejecuciones reproducibles; las metas de diseño no se presentan como resultados.
- La evolución del modelo y la actualización de políticas requieren versiones, evidencia, evaluación y rollback.
- Antes de fusionar, deben pasar typecheck, tests y build en CI; un PR con workflows fallidos permanece sin fusionar.

## Próximos bloqueadores técnicos

1. Generar y versionar el lockfile correcto con la versión aprobada de pnpm y fijar packageManager en package.json; mantener --frozen-lockfile.
2. Completar probes con timeout para memoria IKES, modelo y telemetría; el probe Atlas/Supabase existe, pero su ejecución en el entorno de despliegue aún debe verificarse en CI/producción.
3. Reconciliar BookPI de proceso con un adaptador durable y verificación de cadena; añadir pruebas de recuperación.
4. Conectar puntuaciones reales del router a un adapter de inferencia; el postprocesador actual no reemplaza el modelo.
5. Revisar procedencia y licencia de componentes antes de portar código desde otros repositorios del perfil.


## Origen: `docs/osiris/ARCHITECTURE.md`

# OSIRIS — capa de observación de ciberdefensa (estado: `draft | auto_generated`)

**Módulo:** `src/osiris/` · **Versión:** `0.1.0` · **Integrado en:** runtime Genesis (TypeScript/Express).

> **Contrato de veracidad:** `SPECIFIED ≠ IMPLEMENTED ≠ TESTED ≠ INTEGRATED ≠ VERIFIED ≠ DEPLOYED ≠ CERTIFIED`.

Este documento describe **lo que OSIRIS hace realmente en este repositorio**, no lo que una narrativa promete. Requiere revisión humana antes de declararse `verified` o `wired`.

## Qué es OSIRIS (aquí y ahora)

OSIRIS es una **capa de observación**: recibe señales de seguridad ya normalizadas, aplica **reglas heurísticas deterministas**, produce un resultado **advisory**, y lo registra de forma append-only en el ledger BookPI. Expone métricas y un *posture* honesto del estado de los controles defensivos.

OSIRIS **no** es (y no afirma ser):

- un modelo de ML entrenado ni un clasificador probabilístico;
- un sistema de bloqueo o respuesta automática;
- un sistema certificado ni "seguro";
- una capacidad con precisión/recall medidos (no existe `99.87%` medido aquí);
- un sustituto de ISA-X, AEGIS, CROWN, BookPI o del criterio humano.

## Qué SÍ hace (implementado y probado)

| Capacidad | Archivo | Evidencia |
|---|---|---|
| Motor de detección heurístico determinista (8 reglas) | `src/osiris/detection.ts` | `test/osiris/detection.test.ts` |
| Evaluación de postura defensiva con estados `active/inactive/unknown` | `src/osiris/posture.ts` | `test/osiris/posture.test.ts` |
| Centinela: inspección, recomendación **advisory**, registro BookPI y métricas | `src/osiris/sentinel.ts` | `test/osiris/sentinel.test.ts` |
| Endpoints gated por token admin | `src/server.ts` | `GET /api/v1/osiris/status`, `POST /api/v1/osiris/inspect` |

### Reglas de detección (deterministas, no ML)

| Regla | Categoría | Disparador | Severidad |
|---|---|---|---|
| `OSIRIS-RATE-001` | `rate_anomaly` | tasa de peticiones ≥300 / ≥1000 por minuto | medium / high |
| `OSIRIS-AUTH-001` | `credential_abuse` | fallos de autenticación ≥5 / ≥10 | medium / high |
| `OSIRIS-PAYLOAD-001` | `payload_anomaly` | entrada >20 000 / >100 000 caracteres | medium / high |
| `OSIRIS-RECON-001` | `reconnaissance` | recursos únicos ≥50 / ≥200 | medium / high |
| `OSIRIS-INJECT-001` | `injection_attempt` | marcadores `sql-keywords`/`prompt-injection`/`template-injection` | high |
| `OSIRIS-EVASION-001` | `policy_evasion` | marcador `jailbreak-lexicon` | high |
| `OSIRIS-EXPOSURE-001` | `credential_abuse` | acceso no autenticado a `sensitive-resource` | medium |
| `OSIRIS-CRYPTO-001` | `crypto_posture` | transporte no reportado como TLS | low |

La `confidence` de cada hallazgo es un **peso heurístico declarado a mano** (no una probabilidad medida). El `score` compuesto (0–100) es una suma acotada de pesos, no una métrica calibrada.

### Recomendación (advisory)

`ALLOW` → `MONITOR` → `RATE_LIMIT` → `REVIEW` → `BLOCK_RECOMMENDED`, derivada de la severidad máxima observada. **OSIRIS no ejecuta** ninguna de estas acciones: la autoridad humana decide y ejecuta.

### Postura defensiva

Siete controles (`post_quantum_readiness`, `signature_identity`, `secret_hygiene`, `rate_limiting`, `transport_tls`, `ledger_durability`, `audit_chain_integrity`) con estado `active`/`inactive`/`unknown`. Un control no sondeado es `unknown`, **nunca** `active`. La postura se declara siempre `NOT_CERTIFIED` y `trainedModelPresent: false`.

## Invariante de gobernanza

OSIRIS respeta `CAPABILITY ≠ AUTHORITY ≠ EXECUTION ≠ EVIDENCE ≠ LEARNING ≠ PRODUCTION`: observa y registra evidencia, pero no sustituye autoridad ni ejecuta producción.

## Integración con la arquitectura existente

- **BookPI** (`src/bookpi/ledger.ts`): cada inspección añade un evento append-only (`type: "osiris.detection"`, `methodId` OSIRIS, `riskTier` según severidad). El ledger actual es **en memoria (no durable)** — ver brechas del README raíz.
- **ISA-X / PQC** (`src/security/isa-x/`): la postura reporta su disponibilidad; OSIRIS no reimplementa criptografía.
- **AEGIS / CROWN:** OSIRIS complementa, no reemplaza, la admisión y los guardrails.
- **Observabilidad:** las métricas de OSIRIS son internas al centinela y se exponen en el snapshot; no duplican `MetricsRegistry`.

## Cómo integrar

```ts
import { createOsirisSentinel } from "./osiris";

const sentinel = createOsirisSentinel();
const result = sentinel.inspect({
  id: "sig-1",
  timestamp: new Date().toISOString(),
  source: "http",
  actorId: "human:analyst",
  features: { failedAuthAttempts: 12, isAuthenticated: false, contentFlags: ["sensitive-resource"] },
});
// result.recommendation es ADVISORY; ninguna acción se ejecuta automáticamente.
```

## Lo que falta para madurar (roadmap honesto)

1. **Persistencia durable** del ledger de hallazgos (hoy en memoria) + retención y backup/restore.
2. **Medición empírica**: construir un conjunto de datos etiquetado y **medir** precisión/falsos positivos; solo entonces publicar cifras, con el conjunto y el método.
3. **Correlación** entre señales (ventanas temporales) más allá de umbrales por señal.
4. **Postura real** conectada a sondas del entorno (no inyectada manualmente).
5. **Revisión humana con nombre** para promover de `draft` a `verified`.
6. Endurecer: integración con AEGIS para enforcement **solo** bajo decisión humana explícita.

## Descargo

Este módulo es una **beta de ingeniería**, no un producto certificado. No ofrece garantía de detección, disponibilidad ni cumplimiento normativo. Cualquier afirmación de superioridad o cifras no medidas queda fuera de este repositorio por su constitución.


## Origen: `docs/reina/ARCHITECTURE.md`

# REINA — fachada de adjudicación gobernada

state: draft | engine-generated (pendiente de revisión humana con nombre)

REINA no es una conciencia, AGI ni autoridad. Es un pipeline determinista que decide, **antes** de que otra capa actúe, qué requisitos faltan. No ejecuta nada. CAPABILITY ≠ AUTHORITY ≠ EXECUTION ≠ EVIDENCE.

Pipeline (`src/reina/governor.ts`): validación → kill switch (`security/kill-switch`) → riesgo R (`governance/risk-score`) → autonomía A0–A5 (`governance/autonomy`) → quórum M-de-N (`governance/quorum`) → sello de evidencia en log Merkle RFC 6962 (`bookpi/transparency`) y sink BookPI. Idempotencia por `Idempotency-Key` (`ingress/idempotency`).

Veredictos: PERMIT, REQUIRE_CONFIRMATION, REQUIRE_QUORUM, REQUIRE_HUMAN_APPROVAL, DENY, HALTED. PERMIT = "ninguna regla bloqueó", no "ejecútese".

Otros módulos nuevos: `privacy/crypto-shred`, `privacy/differential-privacy`, `security/key-hierarchy` (HKDF por propósito, rotación en dos fases), `governance/incident` (S0–S3 + FSM).

Rutas: `GET /api/v1/reina/status` (público), `POST /api/v1/reina/adjudicate` y `GET /api/v1/reina/log/proof/:index` (token `GENESIS_ADMIN_API_TOKEN`). `humanApprovalVerified` y `quorum` jamás se leen del cuerpo HTTP.

Límites: log en memoria (volátil, no WORM, sin anclaje RFC 3161); la semántica de los factores C,S,F,P,U del riesgo y los umbrales de autonomía por impacto son supuestos de borrador a arbitrar; typecheck/vitest oficiales no se corrieron en el entorno de generación (registro npm bloqueado), solo un arnés local.
