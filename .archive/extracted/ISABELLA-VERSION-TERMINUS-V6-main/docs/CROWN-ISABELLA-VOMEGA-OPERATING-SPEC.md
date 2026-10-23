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
