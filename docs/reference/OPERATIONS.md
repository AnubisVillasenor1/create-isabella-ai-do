# OPERATIONS consolidado

> `state: draft | engine-generated` - unificacion tematica. El contenido se migro **sin edicion**;
> cada seccion conserva su origen. La granularidad por fichero esta en el historial de git.

## Fuentes unificadas

1. `docs/deployment/README.md`
2. `docs/ops/DEPLOY.md`
3. `docs/ops/PRODUCTION-READINESS-RUNBOOK.md`

---


## Origen: `docs/deployment/README.md`

# Implementación de deployment — Isabella GenesisAI (Cluster E)

- **state: draft | auto_generated**
- **Autor:** Cluster E (motores de empaquetado & Kubernetes) — pendiente revisión humana.
- **Tracker:** `ISABELLA-GENESIS-500-CHECKLIST.csv` → domain `Containers / Kubernetes / deployment`.
- **Fecha:** 2026-10-09
- **Jerarquía de verdad (AGENTS.md):** nada de este documento es `verified` sin evidencia
  humana reproducida y aprobación con nombre.

---

## 1. Racional

El repositorio no tenía `Dockerfile`, `.dockerignore`, ni `k8s/` (verificado). Esto dejaba
debilidades estructurales en el dominio *Containers / Kubernetes / deployment*: sin imagen
reproducible, sin referencias explícitas de secretos, y sin política de red de "deny-by-default".

Este paquete introduce:

1. **Imagen multi-stage distroless** (build en `node:22-alpine`, runtime
   `gcr.io/distroless/nodejs22-debian12`, usuario no-root `10001`).
2. **Manifiestos Kubernetes** en `k8s/` ordenados con `kustomize`, con
   probes, recursos, securityContext, seccomp, NetworkPolicy deny-by-default,
   PDB, HPA, topology spread, priority class y service account dedicada.
3. **Inyección de secretos por referencia** (jamás literales).
4. **Este README** como traza de estado por ISA con sus verificaciones pendientes.

### Verdad de partida auditada

| Ítem | Estado previo | Evidencia |
| --- | --- | --- |
| `Dockerfile` | No existía | `Test-Path` = False |
| `.dockerignore` | No existía | `Test-Path` = False |
| `k8s/` | No existía | `Test-Path` = False |
| `infra/docker/` | No existía | `Test-Path` = False |
| `docs/deployment/` | No existía | `Test-Path` = False |
| ISA-355..368 | DEBIL/INDIRECTO por ausencia | checklist CSV |

---

## 2. Endpoints de salud verificados (probes)

No se inventaron endpoints. Se grepeó `src/server.ts`:

| Ruta | Método | Línea | Uso |
| --- | --- | --- | --- |
| `/health` | GET | `src/server.ts:378` | **liveness** (estático, independiente de dependencias — ISA-357) |
| `/api/v1/health` | GET | `src/server.ts:388` | **readiness** (ISA-356) |
| `/api/v1/status` | GET | `src/server.ts:399` | diagnóstico operativo |
| `/api/v1/ops/snapshot` | GET | `src/server.ts:1415` | snapshot readiness/mantenimiento (no usado como probe) |
| `/api/v1/ops/readiness` | POST | `src/server.ts:1404` | readiness SUJETA a cuerpo (no usable como probe HTTP GET) |

> `REQUIERE_VERIFICACION`: ISA-356 pide que readiness valide dependencias reales. Hoy no hay
> endpoint GET de readiness profunda de dependencias; `POST /api/v1/ops/readiness` exige un
> body (`dependencies`) y el snapshot `GET /api/v1/ops/snapshot` hardcodea dependencias como
> `healthy`. Decisión para el humano: crear `GET /api/v1/healthz` (o equivalente) que consulte
> estado real (Supabase/Gemini/BookPI) y apuntar ahí la readinessProbe.

---

## 3. Imagen de contenedor

### 3.1 Estructura (`Dockerfile`)

```
build  node:22-alpine        corepack enable → pnpm install --frozen-lockfile → pnpm run build (→ dist/)
runtime distroless nodejs22  USER 10001:10001, NODE_ENV=production, sin shell/npm/wget
```

- **Node 22 LTS** (engines `node: >=22`, package.json). Si a fecha de revisión existe una
  LTS más reciente, reetiquetar y re-pinear digests.
- **pnpm congelado**: `--frozen-lockfile` falla si `package.json` y `pnpm-lock.yaml` divergen.
  `REQUIERE_VERIFICACION`: el repo no declara `packageManager`; confirmar `pnpm --version` == 9.x
  (lockfileVersion 9).
- **Entrypoint = `tsx src/server.ts`** (script `start` canónico verificado del repo).
  `node dist/server.js` **no** está listo: `tsc` (moduleResolution `Bundler`) emite ESM sin
  extensiones relativas y Node ESM requiere extensiones. `REQUIERE_VERIFICACION`.
- **Sin `HEALTHCHECK` Docker** (documentado): distroless no trae `wget`/`curl`; la orquestación
  (k8s probes) es la autoridad de salud.
- **RSI / no-write**: el runtime solo lee los assets de la interfaz (`src/ui/index.html`, `src/ui/cinematic.css`, `src/ui/app.js`) al arrancar y mantiene BookPI en
  memoria (volátil); no escribe en disco ⇒ válido `readOnlyRootFilesystem: true`. Verificado en
  `src/bookpi/ledger.ts` (singleton en memoria) y `src/server.ts`.
- `REQUIERE_VERIFICACION`: `node_modules` incluye devDependencies porque `tsx` es hoy
  devDependency. Optimización futura: mover `tsx` a `dependencies` o validar `node dist/server.js`.

### 3.2 Registry y digests — `BLOCKED_ENVIRONMENT`

No hay registry real del cliente (ECR/Harbor/GHCR comercial). Sin registry no se puede:

1. **Pin de digest de base** (ISA-349): resolver con `crane digest gcr.io/distroless/nodejs22-debian12:latest`
   y `crane digest node:22-alpine:<tag>` y fijar `FROM ...@sha256:...` en ambas etapas.
2. **Pin de digest de la imagen de la app** (ISA-355): tras el primer push, sustituir el tag
   `:v40.0.0` por `<registry>/<repo>@sha256:<digest-resuelto>` en `k8s/deployment.yaml` y dejar
   `imagePullPolicy: IfNotPresent`.
3. **SBOM y firma** (ISA-353/354): generan en cadena de CI (`.github/`) — fuera del alcance
   de Cluster E (no toco `.github/`).

---

## 4. Secretos (ISA-362)

**Regla:** el repo no contiene ni debe contener secretos. Todos los valores vienen de fuera.

- El Deployment usa `envFrom.secretRef.name: isabella-genesis-secrets` (referencias únicamente;
  verificado con `grep` que ninguna línea del manifiesto incrusta valor alguno).
- Claves consumidas por el runtime (nombres verificados en `src/` y `docs/ENVIRONMENT.md`):
  `GEMINI_API_KEY`, `MODEL_API_KEY`, `HSF_API_TOKEN`, `GENESIS_ADMIN_API_TOKEN`,
  `BOOKPI_INTEGRITY_SECRET`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`,
  `PENNYLANE_BRIDGE_URL`, `ISABELLA_APPROVAL_*`, `OTEL_EXPORTER_OTLP_ENDPOINT`,
  y claves de comercio (`PAYMENT_PROVIDER_SECRET`, `WEBHOOK_SIGNING_SECRET`, `TOKEN_ENCRYPTION_KEY`).
- `k8s/sealed-secret-example.yaml`: plantilla **placeholder** (no aplicable tal cual) con
  instrucciones de kubeseal. Alternativa recomendada en cloud: **External Secrets Operator + KMS**
  o **Secrets Store CSI Driver**. `BLOCKED_ENVIRONMENT` hasta que exista el gestor destino.
- `BLOCKED_ENVIRONMENT`: el Secret `isabella-genesis-secrets` debe existir en el clúster antes
  de aplicar el Deployment; de lo contrario el pod entra en `ErrImagePull`/`CreateContainerConfigError`.

---

## 5. Manifiestos (`k8s/`)

| Archivo | Propósito | ISA |
| --- | --- | --- |
| `namespace.yaml` | Namespace aislado | — |
| `serviceaccount.yaml` | SA dedicada, token no montado | ISA-361 |
| `deployment.yaml` | Despliegue con probes/recursos/securityContext | ISA-355/356/357/362/363/366/367 |
| `service.yaml` | ClusterIP (80 → 8080) | — |
| `ingress.yaml` | TLS por referencia, host provisional | — |
| `networkpolicy.yaml` | Default-deny + allowlist | ISA-360/368 |
| `pdb.yaml` | PodDisruptionBudget minAvailable | ISA-358 |
| `hpa.yaml` | Autoscaling CPU | ISA-359 |
| `priorityclass.yaml` | Prioridad del runtime | ISA-365 |
| `kustomization.yaml` | Orden de aplicación `kubectl apply -k k8s` | — |
| `sealed-secret-example.yaml` | Plantilla de secretos (NO en kustomize) | ISA-362 |

---

## 6. Tabla de estado ISA-347..371

`state: draft | auto_generated`. Leyenda de estado: **C** = configurado/en manifiesto,
**RV** = REQUIERE_VERIFICACION humana, **BE** = BLOCKED_ENVIRONMENT (no resoluble sin entorno real),
**OOS** = fuera de alcance del Cluster E.

| ISA | Título | Estado | Evidencia / comentario |
| --- | --- | --- | --- |
| ISA-347 | Docker Node version parity | C | `node:22-alpine` == engines `>=22`. |
| ISA-348 | Docker COPY path | C | COPY de `src`, `tsconfig*`, `package.json`, lockfiles. |
| ISA-349 | Docker base digest | BE | Digest real de distroless: resolver con `crane digest`. |
| ISA-350 | Docker package manager pin | C/RV | pnpm congelado + corepack; confirmar versión 9.x (sin campo `packageManager`). |
| ISA-351 | Docker multi-stage minimal | C/RV | 2 etapas, distroless; devDeps (tsx) dentro del runtime = pendiente optimizar. |
| ISA-352 | Docker healthcheck | C | Sin HEALTHCHECK Docker; delegado a probes k8s (documentado). |
| ISA-353 | Docker SBOM | OOS | Acción en `.github/workflows` (no tocado por Cluster E). |
| ISA-354 | Docker signing | OOS | Acción en `.github/workflows` (no tocado por Cluster E). |
| ISA-355 | K8s digest pin | BE | Tag `:v40.0.0` provisional en `deployment.yaml`; sustituir por `@sha256:...` tras push real. |
| ISA-356 | K8s readiness | C/RV | probe `GET /api/v1/health` (verificado, `server.ts:388`); falta readiness profunda de dependencias. |
| ISA-357 | K8s liveness | C | probe `GET /health` (verificado, `server.ts:378`), independiente de dependencias. |
| ISA-358 | K8s PDB | C | `pdb.yaml` minAvailable 1 (replicas 3). |
| ISA-359 | K8s HPA | C/RV | `hpa.yaml` CPU 60%; requiere metrics-server + validación de métricas. |
| ISA-360 | K8s NetworkPolicy | C/RV | Default-deny ingress/egress + excepciones en `networkpolicy.yaml`; requiere CNI compatible. |
| ISA-361 | K8s service account | C | SA `isabella-genesis`, `automountServiceAccountToken: false`. |
| ISA-362 | K8s secret references | C | `envFrom.secretRef`; plantilla placeholder; provisión = BE. |
| ISA-363 | K8s resource limits | C/RV | requests/limits iniciales; validar contra benchmarks de carga. |
| ISA-364 | K8s topology spread | C | `topologySpreadConstraints` hostname, maxSkew 1. |
| ISA-365 | K8s priority class | C | `isabella-genesis-critical` (50000). |
| ISA-366 | K8s security context | C/RV | `runAsNonRoot/runAsUser:10001/drop:[ALL]/readOnlyRootFilesystem`; verificar runtime. |
| ISA-367 | K8s seccomp | C/RV | `seccompProfile: RuntimeDefault`; verificar aplicación efectiva. |
| ISA-368 | K8s egress allowlist | C/BE | Egress DNS + HTTPS provisional `0.0.0.0/0`; sustituir por CIDR/IP de hosts de confianza. |
| ISA-369 | K8s image admission | OOS | Requiere OPA/Kyverno + registry; fuera de alcance/EE. |
| ISA-370 | K8s rollback | C/RV | `RollingUpdate (maxUnavailable:0)`, `revisionHistoryLimit:5`; lógica canary/rollback ya en `src/deployment/` (canary.ts, rollback.ts). |
| ISA-371 | K8s runtime smoke | OOS | `scripts/production-smoke.mjs` **no existe**; el proxy más cercano es `scripts/production-evidence.mjs`. |

---

## 7. Verificación humana requerida (checklist)

- [ ] Registry destino definido (ECR/Harbor/GHCR) → pines de digest (ISA-349/355).
- [ ] `kubeseal`/ESO + KMS para materializar `isabella-genesis-secrets` (ISA-362).
- [ ] Confirmar `pnpm --version` == 9.x y entrypoint `tsx` en distroless (ISA-350/351).
- [ ] Crear `GET /api/v1/healthz` con dependencias reales y re-apuntar readinessProbe (ISA-356).
- [ ] Verificar seccomp `RuntimeDefault` y securityContext aplicados (ISA-366/367).
- [ ] Sustituir egress `0.0.0.0/0` por allowlist de IPs de hosts de confianza (ISA-368).
- [ ] Validar requests/limits frente a benchmarks (ISA-363) y HPA con metrics-server (ISA-359).
- [ ] Configurar CNI con NetworkPolicy y ajustar namespaceSelector del ingress (ISA-360).
- [ ] Resolver host del Ingress y TLS (ISA — infra).
- [ ] Ejercitar rollback real (ISA-370) y añadir smoke script faltante (ISA-371).

---

## 8. Comandos de referencia (entorno con acceso)

```bash
# Imagen (BuildKit)
docker build --no-cache -t isabella-terminus-v6:local .

# Manifiestos
kubectl apply -k k8s/
kubectl -n isabella-genesis get all,networkpolicy,pdb,hpa

# Digest inmutable (una vez exista registry)
crane digest gcr.io/distroless/nodejs22-debian12:latest
crane digest <registry>/<repo>:production
```


## Origen: `docs/ops/DEPLOY.md`

---
state: draft
date: 2026-10-27
---
# Despliegue — Isabella TERMINUS V6

Guía operativa verificada contra el repo el 2026-10-27. Lo que no se pudo probar sin infraestructura real está marcado **[NO PROBADO]**.

## 0. Antes de cualquier despliegue
1. `pnpm install --frozen-lockfile && pnpm typecheck && pnpm test && pnpm build` en CI limpio (el build ejecuta ui-smoke, runtime-smoke y security-suite).
2. `pnpm deploy:readiness path/al/.env.production` — falla (exit 1) si falta `BOOKPI_INTEGRITY_SECRET`, la base de datos, tokens admin válidos, etc. Nunca imprime valores.
3. Migraciones: `scripts/migrate.sh migrate` aplica `scripts/schema.sql` + `infra/db/migrations/001..005` (BookPI, RLS comercial, idempotencia de webhooks, `commerce_subscriptions`). `docker-compose.yml` las aplica solo en el primer arranque de Postgres. Supabase (Atlas/IKES): `supabase/migrations/*` por el flujo de migraciones del proyecto.

## 1. Camino A — contenedor (compose / k8s)
- El workflow `Deploy Production Ω` (tras CI verde, gate de evidencia y aprobación del entorno `production`) publica `ghcr.io/<owner>/isabella-terminus-v6:<sha>` y `:production`.
- Compose: crear `.env` con `POSTGRES_PASSWORD` y `DATABASE_URL` (con la misma contraseña); `docker compose up -d`. La imagen aplica migraciones al arrancar (`RUN_MIGRATIONS=1`).
- k8s: `k8s/deployment.yaml` debe apuntar al digest/tag publicado (`kustomize edit set image`); hoy el test lo marca `BLOCKED_ENVIRONMENT` hasta fijar un digest real. Secretos con SealedSecrets (plantilla en `k8s/sealed-secret-example.yaml`).
- Salud: liveness `/health`, readiness `/api/v1/health`, profunda (admin) `/api/v1/healthz`, `/api/v1/readyz`.

## 2. Camino B — Vercel
- Secretos del entorno `production` en GitHub: `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`. Sin ellos el job lo declara en el resumen y no despliega.
- Variables de la app en el proyecto Vercel (mismas que `.env.example`). En serverless `ISABELLA_API_KEY_STORE=memory` y `ISABELLA_FEDERATION_STORE=memory` pierden estado en cada cold start: usar Postgres para producción real.
- El job corre `pnpm run smoke:production` contra la URL desplegada y falla si algún check falla.

## 3. Verificación post-despliegue
`SMOKE_BASE_URL=https://host pnpm run smoke:production` · `GET /api/v1/readyz` (503 = dependencia degradada, no ocultarlo).

## 4. Rollback
Contenedor: redeploy del tag `<sha>` anterior (las imágenes por SHA no se sobrescriben). Vercel: `vercel rollback`. Base de datos: las migraciones son aditivas (`IF NOT EXISTS`); el rollback de datos es manual con backup (`scripts/backup.sh`, `scripts/rollback.sh`).

## 5. Bloqueos que ningún cambio de código resuelve
Ejecutar CI real sobre el SHA candidato; secretos reales; base Postgres con TLS; probar `readyz` en verde; E2E con proveedor de inferencia autorizado; latencia p50/p95 medida; Stripe en modo test de punta a punta; prueba de backup/restore y rollback en el entorno destino.


## Origen: `docs/ops/PRODUCTION-READINESS-RUNBOOK.md`

# Runbook de cierre de bloqueos de producción — Isabella TERMINUS V6

**Estado:** plan operativo basado en evidencia del preview; no constituye certificación de producción.
**Objetivo:** convertir bloqueadores observados en comprobaciones reproducibles sin marcar como saludable una dependencia que no ha sido probada.

## Evidencia observada

En el preview consultado, `GET /api/v1/readyz` devolvió HTTP 503. El informe indicó:
- BookPI utiliza una cadena hash en memoria, por lo que los eventos no sobreviven a un reinicio.
- La consulta de solo lectura a Atlas/Supabase no quedó verificada.
- IKES no tiene un probe conectado a memoria durable.
- No existe una comprobación de exportación de telemetría en readiness.

El smoke test local sí verificó `health=200`, `chat=200` y `followUp=200` mediante el motor soberano local. El smoke test del gateway LLM externo se omitió porque no encontró credenciales gratuitas/de código abierto configuradas. Esto demuestra interacción local, no una ruta generativa externa disponible.

## Acciones necesarias

### 1. Aplicar el esquema de Atlas en Supabase

Migración versionada: `supabase/migrations/20261017000000_atlas-store-core.sql`.
Migración de memoria: `supabase/migrations/20261017000001_ikes-memory.sql`.
Migraciones del ledger PostgreSQL: `infra/db/migrations/001_create_bookpi_events.sql` y `infra/db/migrations/002_bookpi_canonical_immutability.sql`.

1. Revisar el SQL con el responsable de la base de datos.
2. Aplicarlo mediante el flujo de migraciones aprobado del proyecto Supabase (no pegar secretos en issues, PRs o logs).
3. Confirmar que existen las cinco tablas `atlas_users`, `atlas_protocols`, `atlas_ledger`, `atlas_xr_events` y `atlas_webrtc_signals`.
4. Verificar RLS habilitado y ausencia de permisos directos para `anon` y `authenticated`; el adaptador de servidor usa `SUPABASE_SERVICE_ROLE_KEY`.
5. Validar `GET /api/v1/readyz` y confirmar que la evidencia informa éxito real del probe de solo lectura.

**No resuelto por la migración:** que el valor de las variables de entorno sea válido, que el esquema existente sea compatible o que las operaciones funcionales cumplan aislamiento multi-tenant. La migración no se ha aplicado a la base remota desde este cambio.

### 2. Activar el BookPI compartido del pipeline

El código de esta rama conecta `POST /api/v1/pipeline/execute` al puerto `createRuntimeBookPiStorage`. Selecciona PostgreSQL automáticamente con `DATABASE_URL`, `POSTGRES_URL` o `POSTGRES_URL_NON_POOLING`; también se puede indicar `BOOKPI_PIPELINE_STORAGE=postgres`.

1. Aplicar las dos migraciones de BookPI a la base PostgreSQL de la aplicación.
2. Configurar `DATABASE_URL`, `POSTGRES_URL` o `POSTGRES_URL_NON_POOLING` con TLS y privilegios mínimos; nunca incluir el valor en logs, issues ni README.
3. Configurar `BOOKPI_INTEGRITY_SECRET` como secreto de al menos 32 caracteres, generado de forma segura y gestionado en el entorno servidor. No reutilizar una clave sin verificar la procedencia/integridad de los eventos existentes.
4. Confirmar que la tabla `bookpi_events` existe y que el actor de pipeline `human:pipeline-session` puede leer/escribir bajo RLS.
5. Ejecutar `pnpm run postgres:e2e` contra una base de pruebas desechable y comprobar cadena, inserción concurrente y reinicio.
6. Confirmar que el probe de `pipeline-bookpi-storage` indica `POSTGRES`, cadena válida y recuento observado.

**Límite actual:** esto vuelve durable el ledger del conductor del pipeline, no sustituye todavía el singleton síncrono `bookPiLedger` utilizado por las rutas heredadas (YUN, HyperCore y otras). Ese singleton permanece degradado hasta una migración coordinada de su API síncrona o hasta que esas rutas se trasladen explícitamente al puerto asíncrono. No declarar que todo BookPI es compartido sólo porque el pipeline use PostgreSQL.

### 3. Hidratar y persistir IKES

El código de esta rama incorpora `SupabaseIkesPersistence` y conecta el motor al arranque del runtime. Las fuentes y claims se escriben en tablas separadas; la hidratación valida hashes y referencias y no eleva estados epistémicos automáticamente.

1. Aplicar `supabase/migrations/20261017000001_ikes-memory.sql`.
2. Confirmar acceso server-only mediante `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY`; nunca exponer la clave al cliente.
3. Esperar a que el runtime complete hidratación antes de consultar o mutar IKES.
4. Probar alta de fuente, persistencia de claim admitido, reinicio del proceso y recuperación de los mismos hashes/estados.
5. Confirmar que un error de escritura devuelve fallo y mantiene degradado el probe; no tratar una mutación en memoria como éxito durable.

**Límite actual:** la cola serializa las escrituras, pero no reemplaza una transacción única entre fuentes y claims. El estado epistemológico sigue sujeto al flujo gobernado; almacenar un claim no es evidencia independiente de su veracidad.

### 4. Sustituir BookPI volátil en producción

- No configurar un archivo local o `/tmp` como si fuera almacenamiento durable de Vercel/serverless.
- `createPostgresStorage` ya existe como adaptador asíncrono, pero el singleton `bookPiLedger` usado por rutas sigue siendo síncrono y selecciona memoria/JSONL local.
- Implementar y probar un adaptador durable integrado a los consumidores reales, con migración, concurrencia transaccional, verificación de cadena, backup/restore y control de acceso.
- No declarar WORM: el adaptador Postgres por sí solo no proporciona almacenamiento WORM ni inmutabilidad física.

### 5. Validar inferencia real sin violar privacidad

- La inferencia externa keyless queda desactivada por defecto.
- Para habilitar un proveedor externo, el operador debe configurar expresamente `ISABELLA_KEYLESS_FREE_PROVIDER=pollinations` o un proveedor con credenciales, tras revisar tratamiento de datos, límites, disponibilidad y condiciones.
- Superficies explícitas de opt-in ya revisadas: `npm run start:free` / `npm run dev:free` (solo proceso local), `vercel.json` (`env`) y `docker-compose.yml` (servicio `app`). Retirar la variable o fijarla en `off` desactiva el proveedor.
- Con el opt-in activo, el prompt y el historial acotado pueden salir hacia `text.pollinations.ai`; la respuesta se divulga como `keyless-free`, nunca como inferencia soberana. El límite gratuito por IP es best-effort y no sustituye un proveedor con credenciales.
- No enviar información confidencial a proveedores gratuitos sin aprobación explícita.
- Voz canónica única: todo el runtime resuelve `isabella-esmx-female-v1` (es-MX, femenina). `GROQ_TTS_VOICE` solo acepta voces femeninas conocidas de PlayAI; un valor masculino o desconocido vuelve a `Celeste-PlayAI`. Los cuerpos de solicitud no pueden elegir voz y el navegador aplica la misma política (nombres femeninos preferidos y exclusión de voces masculinas).
- Ejecutar el smoke test del gateway y registrar proveedor/modelo efectivo, latencia, fallback y errores sin registrar prompts o secretos.

### 6. Instrumentar observabilidad

- Configurar `OTEL_EXPORTER_OTLP_ENDPOINT` y credenciales de exportación cuando corresponda.
- Añadir una comprobación de exportación real y acotada, no sólo de presencia de variable.
- Verificar correlación trace/request, retención, acceso, alertas y ausencia de PII en logs.

### 7. Verificar el gateway Rust IGE-Ω

- El runtime Node dispone de un probe acotado mediante `IGE_OMEGA_GATEWAY_URL`; comprueba `GET /health` y `GET /ready` con timeout limitado, valida el contrato JSON y no envía tokens ni contenido del usuario.
- En producción, configurar una URL HTTPS del gateway ya desplegado. No incluir usuario/contraseña, query strings ni fragmentos en la URL.
- `GET /api/v1/integrations/graph` reportará `HEALTHY`, `DEGRADED` o `NOT_CONFIGURED` según la prueba observada. El probe sólo confirma salud/readiness y conectividad a base de datos; **no** demuestra que la inferencia autenticada desde Node esté conectada.
- La integración de inferencia autenticada requiere un diseño separado de identidad/tenant, gestión del token de servicio, autorización y pruebas de aislamiento; no reutilizar un token de un usuario para todos los clientes.

### 7. Cerrar CI/CD y producción

- Esperar CI verde en el SHA candidato, incluidos typecheck, tests, build, auditoría Rust, Trivy, SBOM y artefactos de seguridad.
- Confirmar que el workflow de liberación descarga evidencia del mismo SHA y rechaza runs que no sean un push exitoso a `main`.
- El workflow actual valida evidencia y llega a un handoff; no prueba por sí mismo una promoción real a producción. Confirmar el mecanismo real de despliegue, health check post-deploy, rollback y aprobación del entorno.
- Habilitar reglas de protección de `main`: PR obligatorio, checks requeridos, resolución de conversaciones y restricción de force-push/deleción.
- No elevar el porcentaje de preparación hasta comprobar despliegue, persistencia y recuperación reales.

## Criterios mínimos de cierre

- [ ] CI verde en el SHA candidato y checks obligatorios configurados en `main`.
- [ ] Preview más reciente en estado READY y smoke HTTP exitoso.
- [ ] `/api/v1/readyz` devuelve 200 sólo con todas las dependencias requeridas verificadas.
- [ ] El pipeline usa PostgreSQL compartido y pasa E2E; backup/restore y verificación de cadena aprobados.
- [ ] Las rutas heredadas de BookPI dejan de usar el singleton volátil o están explícitamente bloqueadas en producción.
- [ ] IKES recupera fuentes/claims tras reinicio y conserva hashes/versiones; migración aplicada y probe saludable.
- [ ] Proveedor de inferencia configurado por decisión explícita y smoke generativo aprobado.
- [ ] Telemetría exportada y alertas probadas.
- [ ] Despliegue de producción y rollback demostrados sobre un SHA trazable.

**Regla de evidencia:** una migración en Git no equivale a una migración aplicada; un endpoint local 200 no demuestra salud de dependencias; un preview READY no equivale a producción desplegada.
