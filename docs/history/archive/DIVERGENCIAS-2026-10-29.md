---
state: draft | auto_generated
---

# Divergencias entre el documento Ω∞‑TOTAL‑IMPLEMENTATION‑1.0 y el código (2026-10-29)

Documento auditado: «DOCUMENTO TOTAL FINAL DE IMPLEMENTACIÓN INTEGRAL», versión
`Ω∞‑TOTAL‑IMPLEMENTATION‑1.0`, recibido como archivo suelto (no vive en este repositorio:
`docs/spec/ISABELLA-OMEGA-INFINITY-GENESIS-CANON.md` no contiene la palabra «Implementado»).

Método: cada afirmación se buscó en `src/**` y se clasificó con la regla del propio documento
(línea 484): **SPECIFIED ≠ IMPLEMENTED ≠ TESTED ≠ VERIFIED**. Referencia a AGENTS.md §6: cuando la
especificación y el código se contradicen, se archiva la divergencia y **no** se reescribe el código
para que la afirmación resulte cierta. Nada de este informe declara «implementado» lo que hoy es
función pura sin consumidor, cuota sin registro o maqueta sin verificador.

## 1. Afirmaciones de estado («Implementado») que no se sostienen

| # | Afirmación del documento | Lo que existe en el repositorio | Veredicto |
|---|---|---|---|
| 1 | «Trust Ω — TrustVector (5 dimensiones) — Implementado» (línea 116) | No hay símbolo `TrustVector`, ni vector de confianza persistido, ni función que lo calcule. Lo más cercano es una **maqueta de UI**: `src/components/Dashboard/RScoreGauge.tsx:20` calcula `R = 0.25C + 0.25S + 0.20F + 0.15P + 0.15U` para pintar un medidor, y las dimensiones que alimenta se mueven con un paseo aleatorio en el propio componente (`Math.random()` en la línea 14). Ningún consumidor de gobernanza lo lee. | **NO IMPLEMENTADO** (proyección visual con datos sintéticos) |
| 2 | Ecuación `TRUST = I × Integridad × …` con propagación de cero | No existe tal producto en `src/**` (tampoco el símbolo `TrustVector`: cero coincidencias). Lo que sí existe y **sí** tiene propagación de cero es la Ecuación de Legitimidad: `src/omega/native/legitimacy.ts:109` (`allowed: product === 1 && constitution.allowed`, dentro de `computeLegitimacy`). Son cosas distintas con nombre parecido. | **DIVERGENCIA DE NOMBRE**: la ecuación real es de legitimidad, no de trust |
| 3 | «Motor Híbrido AGI‑MoE‑TTS‑LLM — 250 Herramientas Gobernadas» (líneas 26 y 521) | Herramientas declaradas: 28 en `src/tools/catalog.ts` + 9 en `src/tools/protocol-catalog.ts` = **37 descriptores**, registrados en `src/genesis/runtime.ts:323`. 250 es una cuota de diseño, no un registro. | **NO IMPLEMENTADO** (7× de sobredeclaración) |
| 4 | «250 herramientas gobernadas **con sello BookPI obligatorio**» (línea 523) | Antes de este cambio el sello no era obligatorio ni estaba en el plano de ejecución: existían 19 llamadas dispersas a `bookPiLedger.append(...)` en rutas concretas, y la única ruta de herramientas sellaba a mano con un `methodId` **no parseable** (`T.TOOL.<id>.execute.v1.0.0.LOW.TERRITORIAL`: `TOOL` no es federación YUN y el módulo no es `E00–E23` ni motor arquitectónico, según `src/authority/method-id.ts`). | **PARCIAL → RESUELTO en este cambio** (§2.3) |
| 5 | «Modo Terminus Blackout como última línea de defensa constitucional» (línea 528) | No existía. Había autoridad criptográfica (`src/security/kill-switch.ts`) y una recomendación sin efecto: el módulo se describe a sí mismo como «compuerta de CONSULTA» (línea 4) y ningún camino HTTP lo consultaba. | **NO EXISTÍA → CABLEADO en este cambio** (§2.1–2.2) |
| 6 | «Security Ω — ML‑KEM, ML‑DSA, AES‑GCM, HKDF, SHA3 — Implementado» (línea 117) | AES‑GCM/ChaCha20‑Poly1305, HKDF y SHA3‑512 **sí** son reales (`src/security/pqc/hybrid-crypto.ts:50`, `src/security/key-hierarchy.ts:122`, `src/bookpi/crypto.ts:25`). ML‑KEM/ML‑DSA eran **maquetas de tamaño correcto**: `mlKemEncaps` sellaba un secreto efímero aleatorio que `mlKemDecaps` no podía recuperar, así que las dos partes derivaban secretos distintos (sonda: `KEX_MATCH=false` y `ROUNDTRIP_FAILED=Unsupported state or unable to authenticate data`). `mlDsaVerify` devolvía `true` midiendo solo la longitud y `hybridVerify` fijaba `ed25519Valid = true`: una firma forjada pasaba el control. La superficie declarada tampoco coincidía con la etiqueta: `src/server.ts:1476` ya lo decía — `suite: 'FIPS-203 (ML-KEM) + FIPS-204 (ML-DSA) — algorithm labels only'`, `status: 'NOT_CONFIGURED'`, `verificationPerformed: false` (líneas 1468‑1480). | **FALLO DE SEGURIDAD → CERRADO en este cambio** (§2.5); el algoritmo real sigue pendiente de proveedor (§3.5) |
| 7 | «100+ microagentes en sociedad cognitiva» (línea 524) | `src/agents/` son 5 módulos de soporte (`knowledge`, `math`, `runtime`, `tools`, `types`), no un registro de ≥100 agentes. | **NO IMPLEMENTADO** |
| 8 | «Observability Ω — OpenTelemetry + Prometheus — Implementado» (línea 122) | Hay métricas propias del proceso (`src/deployment/latency-metrics.ts`, `src/observability/metrics.ts`) y variables `OTEL_*` documentadas; no se exporta a un colector OTel ni se sirve `/metrics` en el inventario HTTP. | **PARCIAL** (métricas internas ≠ pipeline OTel verificado) |
| 9 | «Preflight bloqueante» como puerta de producción | `src/server.ts:267`: solo aborta con `STRICT_PREFLIGHT=1|true|yes`; sin esa bandera, en producción **adviste y sigue**. El bloqueo es opt‑in, no el default que sugiere el documento. | **DIVERGENCIA OPERATIVA** (queda sin cambiar: decidir el default es arbitraje humano) |

## 2. Lo que este cambio sí dejó operativo (con prueba)

### 2.1 Blackout gobernable
`src/governance/blackout.ts` (nuevo) convierte la autoridad existente en apagado real sin crear un
quinto sistema de confianza:

- Lista **cerrada** de alcances (`BLACKOUT_SCOPES` + `GLOBAL`) con `assertGovernableScope`: un scope
  con typo ya no puede halta una cadena que nadie consulta (apagado silencioso).
- Tabla `GOVERNED_ROUTE_SCOPES` construida sobre prefijos que existen hoy en
  `test/deployment/route-inventory.json` (voz, LLM —incluida la superficie del gateway `54e8b78`:
  `/v1/messages`, `/v1beta/models`, `/llama/v1/chat/completions`—, agentes, pagos, federación).
- `BLACKOUT_SURVIVOR_PREFIXES`: BookPI, evidencia, auditoría, emergencia, REINA, salud, seguridad y
  constitución siguen vivos bajo `GLOBAL`; sin eso, apagar el nodo apagaría la puerta de reencendido.
- `READ_ONLY_METHODS`: `GET/HEAD/OPTIONS` no se cortan. Un apagado no ciega a quien viene a auditarlo.
- `evaluateBlackoutRequest` consulta `GLOBAL` explícitamente (no delega la cobertura al predicado).

### 2.2 Superficie HTTP de control
`src/routes/governance-blackout.ts` (nuevo), con gate `GENESIS_ADMIN_API_TOKEN` y límite de peticiones:

- `POST /api/v1/governance/blackout/engage` — orden Ed25519 verificada por `KillSwitch`.
- `POST /api/v1/governance/blackout/release` — `GLOBAL` exige 2 emisores distintos; **sin evidencia
  escrita en BookPI no se reactiva capacidad** (dirección segura asimétrica: apagar puede ocurrir
  con el libro caído y se reporta `sealed:false`; reanudar no).
- `GET /api/v1/governance/blackout/status` — estado del apagado + `assessConstitutionalIntegrity`
  (`CLEAN / DEGRADED / CORRUPTED`; cadena rota ⇒ `CORRUPTED` y `engagementSuggested`).
- `POST /api/v1/governance/legitimacy/evaluate` — primera consumidora HTTP de `computeLegitimacy`
  (que hasta hoy no tenía **ninguna** prueba ni llamada). Responde
  `authorizationPerformed:false, executionPerformed:false, approvalPerformed:false`.

### 2.3 Sello obligatorio en el plano de ejecución
`src/tools/registry.ts`: el `ToolRegistry` selló su propio `methodId` canónico en cada terminación
(`EXECUTED:ok`, `AEGIS_BLOCK`, `AEGIS_REVIEW`, `APPROVAL_REQUIRED`, `EXECUTION_FAILED`) **antes** de
entregar la salida; si el libro falla, la salida **se retiene** (`withheldResults`) en vez de
presentar un efecto sin evidencia como autoridad. `register()` rechaza ahora `methodId` no
canónicos (§5 AGENTS.md). Se eliminó el append manual ilegible de la ruta y `POST
/api/v1/tools/execute` reporta `success` según `admitted` (antes devolvía 200/`success:true` a una
herramienta bloqueada).

### 2.4 Un solo apagador por proceso
`src/reina/runtime.ts` aceptaba construir su propio `KillSwitch` sin claves: un `GLOBAL` firmado por
el plano HTTP dejaba a REINA adjudicando como si el nodo estuviera vivo. Ahora recibe la instancia
compartida (`src/server.ts`, bloque REINA) y el halt gobernedor también la detiene.

### 2.5 Capa post‑cuántica convertida en fail‑closed
`src/security/pqc/provider-gate.ts` (nuevo) define `PqcProviderRequired` con el mismo
`code: 'PQC_BACKEND_UNAVAILABLE'` que ya usaba `src/security/post-quantum.ts:56`, y
`ml-kem.ts` / `ml-dsa.ts` lanzan esa puerta en **cada** entrada criptográfica
(`mlKemKeyGen/Encaps/Decaps`, `hybridKeyEncaps/Decaps`, `mlDsaKeyGen/Sign/Verify`,
`hybridSign/Verify`, `generateHybridKeyPair`). Consecuencia verificable: el `HybridCryptoEngine`
ya no puede devolver dos secretos distintos ni aceptar una firma forjada; `generateIdentity`,
`initiateKeyExchange`, `encrypt` y `sign/verify` fallan ruidosamente. Se conserva lo que sí es
criptografía: el AEAD con clave explícita y `Ed25519Signer`. Esto alineó el código con la regla que
el propio repositorio ya declaraba (`src/security/post-quantum.ts:11`: «this repo does NOT implement
them and no backend is faked») y con el
estado que reporta el orquestador ω‑native (`src/omega/native/orchestrator.ts:275`:
`pqc_provider: 'NONE (BLOCKED_ENVIRONMENT)'`). Ningún camino de producción consumía estos módulos: la
superficie afectada son `src/security/pqc/*` y su prueba.

Pruebas: `test/governance/blackout.test.ts` (24), `test/governance/blackout-routes.test.ts` (14),
6 casos nuevos en `test/tools/registry.test.ts`, 6 en `test/security/pqc-provider-gate.test.ts`.
Inventario HTTP recongelado con `node scripts/regen-inventory.mjs` y con el generador canónico
`node scripts/route-inventory.mjs`: **266 → 270** rutas (las 4 nuevas, ninguna perdida). Suite completa:
**2163 pruebas en 339 archivos, todas en verde**, con `check:env`, `check:sops`, `typecheck`,
`typecheck:layers`, `lint`, `format:check`, `STATUS_OK` y `security:suite` también en verde.

## 3. Sigue sin implementar (no declarar como hecho)

1. **Ecuación canónica de Trust** (producto con propagación de cero sobre 5 dimensiones): no existe
   ni como función. Requiere arbitraje humano: ¿se adopta la de legitimidad o se especifica otra?
2. **250 herramientas gobernadas**: seguiría siendo una cuota. Registrar herramientas sin `execute`
   real sería peor que confesar 37.
3. **100+ microagentes** y la «sociedad cognitiva»: sin registro ni scheduler.
4. **WORM real** para BookPI: `wormEnforced:false` en toda verificación; Postgres compartido no es
   inmutabilidad de hardware.
5. **Firma e intercambio post‑cuánticos reales**: hoy están bloqueados por puerta de proveedor, no
   implementados. Cablear FIPS 203/204 exige un proveedor externo (liboqs, HSM o KMS) y verificación
   humana contra vectores de prueba publicados; mientras tanto la firma disponible es Ed25519.
6. **Exportación OTel/Prometheus** y `/metrics` en el contrato HTTP.
7. **Bloqueo por defecto del preflight en producción**: comportamiento opt‑in (`STRICT_PREFLIGHT`).
8. **Claves de emisores**: sin `ISA_KILL_PUBKEY_*` configuradas por un camino revisado, la superficie
   de apagado está montada pero inerte (fail‑closed). Es el punto de decisión operativo siguiente.

## 4. Nota de seguridad sobre el documento recibido

El archivo adjunto incluye **dos URL prefirmadas de Amazon S3 con credenciales temporales**
(`X-Amz-Security-Token` y un access key `ASIA…`) y números de teléfono personales de contactos de
verificación. No se copiaron ni se comitearon en este repositorio. Esos tokens deben considerarse
expuestos y rotarse; si el `.docx` se compartió, conviene redistribuir una versión sin URL firmadas.

## 5. Segunda tanda (2026-10-29): mock data servido por HTTP y mapa del universo

### 5.1 Datos inventados que se eliminaron de la superficie real

| Sitio | Lo que publicaba | Lo que publica ahora |
|---|---|---|
| `GET /api/v1/status` | `toolsCount: 2` (el registro tiene 37 descriptores) | 37 medidos en vivo, más 9 subsistemas con sus conteos reales y la distribución de riesgo derivada del catálogo |
| `GET /api/v1/status` → `engines` | 6 motores con `state: 'ACTIVE'` inventado | taxonomía `UNIVERSE_STATE_LEGEND` derivada del cableado; el PDP se declara `MODULE_NOT_WIRED_TO_HTTP` (verificado: `decidePdp` no se importa en `src/server.ts`) |
| `#quantumMesh` (hero) | posiciones y estados generados con `Math.random()` | `src/ui/universe-map.js` pinta exclusivamente lo que devuelve `/api/v1/status`; si la lectura falla muestra `SIN DATOS · MAPA NO DISPONIBLE` y no dibuja nada |
| `AlertManager.evaluate` (antes en `observability-stack.ts:663`) | `const firing = Math.random() > 0.95` en cada pasada de los 30 s → `GET /api/v1/observability/alerts` entregaba alertas fabricadas | umbral comparado contra la métrica real, ventana `for` respetada y valor observado en la alerta; la ruta añade `ruleOutcomes` con `evaluated / no_data / not_evaluable` |
| `SLOManager.evaluate` (antes en `:624`) | `const value = 0.99; // Simulated SLI value` | `good / total` medidos sobre los contadores del proceso; sin datos devuelve `value: null` y `state: 'INSUFFICIENT_DATA'` |
| bucle de recolección (antes en `:1239`) | `counter('process_cpu_seconds_total', 0.01) // Approximate` y `process_max_memory_bytes` inexistente | delta real de `process.cpuUsage()` y límite de heap real de V8; la regla `memory_pressure` compara heap contra su propio límite |
| `SmartRouter.getMetrics()` | 11 campos en cero constante bajo el comentario «Aggregate metrics from both executors», publicados en `GET /api/v1/pipeline/hyper-turbo/metrics` | conteos de ruteo, llamadas y errores por etapa, media y máximo medidos; `errorRate`/`avgLatencyMs` son `null` si no hay llamadas, y `notInstrumented` lista lo que sigue sin medida (`throughputRps`, `stageLatencies`, `backpressureEvents`, percentil del camino frío) |
| `getHotPathStats()` | `speculativeCacheSize: 0, // Would need access to private` | tamaño real de la caché, `speculativeHits`, `speculativeMisses` y percentil 99 del camino caliente |

Ningún percentil se inventa: el `p99` se calcula por rango más cercano sobre una ventana
deslizante de 4096 latencias realmente medidas.

### 5.2 Fallo funcional descubierto al quitar el `eval`

`SmartRouter.evaluateCondition` hacía `eval(condition.replace(/\binput\./g, ''))`. Borrar el prefijo
dejaba `input.batchSize > 10` convertido en `batchSize > 10`, una variable inexistente cuyo
`ReferenceError` silenciaba el `catch` devolviendo `false`. Consecuencia real: **ninguna regla de
ruteo con campos se cumplía nunca** — sólo las literales `'true'` funcionaban — y todo el tráfico
`path:'auto'` caía en la ruta caliente. Lo mismo valía para las reglas de los 4 pipelines por
defecto. El reemplazo (`evaluateRoutingGuard` en el mismo módulo) resuelve rutas anidadas,
`=== !== == != >= <= > <`, `&&` con precedencia sobre `||` y literales, y no ejecuta código; la
prueba incluye una cadena que bajo `eval` habría escrito en `globalThis`.

### 5.3 Mapa del universo: fuente única y contrato probado

`src/genesis/universe.ts` (puro, independiente de Express) deriva el snapshot desde los registros
del runtime (`CROWN_NODES`, `EXPERT_REGISTRY`, `runtime.tools/capabilities/skills/modules`,
`killSwitch.status()`, `runtime.quantum.describe()`, contadores del sello BookPI) y
`/api/v1/status` lo publica bajo `schema: 'isabella.universe.v1'`. El cliente rechaza pintar
cualquier payload que no declare ese esquema. Pruebas: 10 unitarias
(`test/genesis/universe-snapshot.test.ts`), 16 aserciones en `scripts/ui-smoke.mjs` y ~25 en
`scripts/runtime-smoke.mjs` contra el servidor construido, incluidas «ningún motor puede estar
`ACTIVE`», «cada `state` del snapshot existe en la leyenda» y `toolsCount ↔ universe.counts.tools ↔
universe.evidence.tools`.

**Límite de esta verificación:** el renderizado en navegador no se pudo comprobar. `browser-use`
agotó sus timeouts (`navigate_page`, `take_screenshot`, `take_snapshot`, `evaluate_script`) aunque
la página respondía. Lo que sí se ejecutó fue el cliente real contra el servidor en un DOM mínimo:
46 marcas (núcleo + 12 nodos + 24 expertos + 9 subsistemas), 12 chips accesibles, 19 ítems de
leyenda y la rama de error. Ese arnés no cuenta los trazos de `fillText`, así que la calidad visual
(siguiendo tipografía, solapamientos) **queda sin verificar**.

### 5.4 Lo que sigue sin ser cierto (no declarar como hecho)

1. `HotPathExecutor.verifyResult()` devuelve `true` siempre («In production, would call verification
   callback»): `metadata.verified` y el evento `speculative:verified` **no** son evidencia de
   verificación. No se tocó: cambiarlo exige decidir qué se verifica.
2. El árbol React `src/components/**` es código muerto: no lo compila esbuild (que sólo empaqueta
   `src/server.ts`), no lo sirve Express y está excluido de `tsconfig.json` y de `eslint.config.mjs`.
   Ahí vive el mock data restante —`VideoEngineXDashboard.tsx:736-739` inventa workers `ONLINE` con
   VRAM fija, `RScoreGauge.tsx:14` mueve sus dimensiones con `Math.random()`— y tiene imports a
   módulos inexistentes (`Cockpit.tsx:16` y `QuantumReflectionCard.tsx:4` referencian
   `../../lib/atlas.functions`, que no existe en `src/lib`). La decisión (borrar el árbol o darle
   bundler y datos reales) es arbitraje humano y no se tomó aquí.
3. Espejos duplicados sin dueño: `src/lib/lib/**`, `src/components/isabella/isabella/**`,
   `src/components/ui/ui/**`. Ninguno es importado desde el servidor.
4. El typecheck no cubre todo el árbol: `src/lib`, `src/components`, `src/hooks`, `src/core`,
   `src/authz-runtime` y `src/hypercore-runtime` no pasan por `tsc` ni por eslint en ninguna puerta.
   `src/observability`, `src/pipeline/hyper-turbo` y `src/security/pqc` sí se typecheckean, pero sólo
   en `typecheck:layers`.

