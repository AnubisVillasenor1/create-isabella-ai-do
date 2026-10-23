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
| `service.yaml` | ClusterIP (80 → 3000) | — |
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
docker build --no-cache -t isabella-genesisai:v40.0.0 .

# Manifiestos
kubectl apply -k k8s/
kubectl -n isabella-genesis get all,networkpolicy,pdb,hpa

# Digest inmutable (una vez exista registry)
crane digest gcr.io/distroless/nodejs22-debian12:latest
crane digest <registry>/<repo>:v40.0.0
```