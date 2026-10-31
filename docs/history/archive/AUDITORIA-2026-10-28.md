# Auditoría profunda ISABELLA-VERSION-TERMINUS-V6 — 2026-10-28

Alcance: traer `origin/main` a local, reaplicar el trabajo local sin commitear y auditar
el resultado. Ramas/revisiones: local estaba en `60f7b53` (0 ahead / 12 behind); tras el
`merge --ff-only` quedó en `16add75` (12 commits: despliegue Docker y contrato de puerto
8080, capa Omega-infinito, núcleo de liquidación BookPI/Stripe, 21 módulos de ML nativo,
proveedor `local-compatible` Qwen, saneamiento documental).

## 1. Cómo se protegió y reaplicó el trabajo local

Nada se descartó. Antes del pull se guardaron tres copias del WIP (12 archivos,
522 inserciones / 75 borrados):

- parche: `_auditoria-2026-10-28/local-wip-tracked.patch` (38 135 bytes)
- copias completas: `_auditoria-2026-10-28/files/…`
- `stash@{0}: On main: local-wip-2026-10-28-pre-pull` (todavía existe; se puede retirar
  cuando se confirme que nada falta)

Tras el fast-forward, `git stash apply` reintegro 8 archivos limpiamente y dejó 4 en
conflicto. Resolución archivo por archivo:

| Archivo | Decisión |
| --- | --- |
| `docker-compose.yml` | Se conservaron las variables nuevas del upstream (`PORT=8080`, `HOST`, `RUN_MIGRATIONS`, `ALLOWED_ORIGINS`, `APP_PUBLIC_URL`) y se adoptó el orden keyless local `llm7,pollinations`. |
| `src/inference/provider-policy.ts` | Se mantuvo `resolveLocalCompatibleProvider` (upstream) **y** la cadena multi-proveedor local (`KEYLESS_FREE_ALIASES`, `KEYLESS_FREE_DISABLED`, `DEFAULT_KEYLESS_FREE_ORDER`). Se descartó `KEYLESS_FREE_ENABLE_VALUES`: tras la fusión quedaba sin uso porque el cuerpo ya fusionado de `resolveKeylessFreeProviders` consume los tres nuevos. |
| `src/server.ts` | Bloque de imports en unión: `resolveLocalCompatibleProvider` (upstream) más los tipos `KeylessFreeFailure/Message/ProviderConfig` (local). |
| `test/inference/keyless-free-provider.test.ts` | Imports en unión; el caso de alias se quedó con la semántica local (`on/true/1/auto` → `llm7` porque es la primera de la cadena), que es la que implementa el código fusionado; el override de endpoint se fijó a `pollinations` explícito. Las pruebas aguas arriba del alias `pollinations → pollinations` siguen cubiertas por el bloque `explicit` que ya estaba fuera de conflicto. |

Coherencia verificada después: `resolveKeylessFreeProvider` (singular) devuelve el primero
de la cadena (`provider-policy.ts:322-326`), o sea que el alias `on` → `llm7` es el
comportamiento real del árbol fusionado, no del test.

## 2. Estado de las puertas de validación

Ejecutadas con `corepack pnpm` sobre el árbol final:

| Puerta | Antes de corregir | Después |
| --- | --- | --- |
| `typecheck` (`tsc --noEmit`) | pasa (0) | pasa (0) |
| `lint` (`eslint --max-warnings=0`) | pasa (0) | pasa (0) |
| `format:check` (prettier) | **falla: 17 archivos** | pasa: «All matched files use Prettier code style!» |
| `test` (`vitest run`) | no ejecutada con el fallo de formato | **335 archivos / 2106 pruebas en verde, 129.03 s**, exit 0 |
| `check:env` / `check:sops` | pasan | pasan |

Los 17 archivos sin formatear vinieron del upstream (`src/omega/genesis/*`,
`src/omega/native/*`, `src/economy/reconciliation.ts`, `src/health/deploy-readiness.ts`,
`src/lib/env-flags.ts`). Con `format:check` en rojo, el job «Run Prettier check»
(`.github/workflows/ci.yml:62`) y el script `validate` de `main` estaban condenados a fallar.

## 3. Hallazgos

Severidad, ubicación y arreglo. Los marcados **[aplicado]** ya están corregidos en el
árbol local; los demás quedan como propuestas (no desplegué ni toqué CI remoto).

### BLOQUEANTE

1. **El despliegue de producción nunca puede dispararse.**
   `deploy-production.yml:26` escucha `workflow_run` del workflow
   `Isabella Genesis Ω Sovereign CI`, pero ningún workflow se llama así: los nombres reales
   son `CI/CD Pipeline - ISABELLA GENESIS ZERO-OPEX v3` (`ci.yml:1`), `Repository Assurance`,
   `IGE-Ω Rust MVP CI`, `Isabella Beta Live Model Gate`, `Genesis Atlas Ingest`.
   Arreglo: cambiar `ci.yml:1` a `name: Isabella Genesis Ω Sovereign CI`, o alinear la lista
   de `deploy-production.yml:26`. No aplicado: modifica cuándo se activa un despliegue real.
2. **Los artefactos que exige el gate estricto no los produce nadie.**
   `deploy-production.yml:125,133,141` descargan `production-evidence-<sha>`,
   `security-suite-<sha>` y `sbom-<sha>`; el único `upload-artifact` de `ci.yml` es de
   resultados Trivy (`ci.yml:127`), y los demás suben `repository-assurance-<sha>`
   (`repository-assurance.yml:106`) o evidencia Rust. Arreglo: añadir en `ci.yml` los pasos
   `production:evidence`, `security:suite` y un generador de SBOM (`@cyclonedx/cyclonedx-npm`
   o `syft`) con esos nombres exactos.

### ALTO

3. **Infraestructura «opt-in» que llega encendida por defecto.** `ISABELLA_KEYLESS_FREE_PROVIDER`
   está activo en `.env.example`, `docker-compose.yml:189-194` y `vercel.json`, con el mismo
   commit que afirma «user content never leaves the node by default»
   (`provider-policy.ts:258-267`). Todo despliegue manda prompts, historial y texto de voz a
   llm7/pollinations/Google TTS. Arreglo: dejar `off`/comentado y que el operador lo active
   explícitamente. *(La línea de compose es la que yo mismo acabo de fusionar: se conservó la
   intención local, pero la decisión de política es tuya.)*
4. **El hedging paralelo multiplica el egreso.** Con `CHAT_HEDGE_DELAY_MS=500`
   (`.env.example:218`) y `hedgedFirst` (`src/inference/deadline.ts:95-141`), `server.ts` lanza
   variantes contra varios proveedores casi a la vez; el prompt del usuario sale a varios
   terceros por request y quota la capa gratuita. El orden de `resolveKeylessFreeProviders`
   solo gobierna dentro de la tarea keyless. Arreglo: secuenciar el hedge entre proveedores
   externos o excluirlos de la carrera paralela.
5. **El núcleo de liquidación nuevo no está cableado.** `src/economy/settlement.ts`
   (`SettlementLedger`, bigint, chequeo de conservación `:228`, idempotencia por
   `settlementId` `:277`) y `src/economy/reconciliation.ts` solo los importan `test/economy/*`;
   la ruta real `POST /api/v1/revenue/settle` sigue usando `src/economy/revenue-fabric/*`.
   El commit f0c90d8 lo presenta como «núcleo de liquidación». Arreglo: conectar la ruta o
   declararlo explícitamente `no-wired`.
6. **21 módulos de ML «nativo» en su mayoría muertos.** `src/routes/native-engines.ts` expone
   4 (llm/moe/speech/turbo); `anomaly-forest, calibration, fairness, timeseries, ranking,
   drift, online, convergence-engine, teacher-convergence, multiclass` no se importan fuera de
   su `index.ts`/tests, `ModelRegistry` no los consume y `README.md:36` los excluye del
   typecheck principal. Nota buena: `native-engines.ts:93` declara el «LLM» como coincidencia
   determinista, no modelo neuronal, y no hay `fetch` en `src/lib/native-ml/*`, así que la
   etiqueta «native» es veraz. Arreglo: cablear o marcar `no-wired` en el registry de cobertura.
7. **Catálogo duplicado por partida doble en el árbol.** `src/lib/lib/**` son 329 archivos
   `.ts` duplicados (muestra: `src/lib/lib/genesis/scanners/*`, `src/lib/lib/accounting/*`) y
   `src/components/isabella/isabella/PlanSelector.tsx` duplica el componente de planes. Hay
   tres `class ModelRegistry` (`src/inference/model-registry.ts`,
   `src/lib/native-ml/registry.ts`, `src/lib/intelligence/model-registry.ts`). Arreglo: borrar
   el árbol duplicado y unificar los registries.

### MEDIO

8. **Precios de planes incoherentes con el catálogo.** Backend: `src/commerce/pricing.ts:27`
   `unitAmount: 2500` (25 USD) y `:37` 25000 anual, y `test/commerce/catalog.test.ts:24` lo
   fija. UI: `src/components/isabella/PlanSelector.tsx:42,58` publica `$9.99` / `$19.99` /
   `$15.99` con ids `personal/pro/enterprise` que no existen en el catálogo
   (`premium/vip/free/enterprise`). Arreglo: que la UI lea `/api/v1/billing/prices`.
9. **Cooldown de cuota asimétrico.** `provider-policy.ts:285-302` resuelve
   `KEYLESS_FREE_QUOTA_COOLDOWN_MS` solo para pollinations; llm7 queda fijado a 2 s
   (`:312`). Un 402/429 sin `Retry-After` en llm7 reintenta casi en cada request
   (`server.ts:716,746-751`). Arreglo: usar el mismo valor resuelto por env para ambos.
10. **El path llm7 no limita la salida.** `server.ts:766-785` no manda `max_tokens` y usa
    `extractAssistantText` sin tope, a diferencia de `extractKeylessFreeText` (cap 8000 en
    `provider-policy.ts:381-384`). Arreglo: `max_tokens` y truncado equalitarios.
11. **El catálogo federation muestra solo el primer proveedor.** `src/federation/openapi.ts:59`
    usa `resolveKeylessFreeProvider` (singular) y nunca menciona `local-compatible`, aunque
    `server.ts:589-601` lo cuenta como configurado. El panel de estado infra-representa la
    cadena real. Arreglo: enumerar `resolveKeylessFreeProviders(env)` y añadir el descriptor.
12. **Voz keyless sin divulgación de egreso.** `/api/v1/voice/speak` responde
    `backend: 'server-tts'` y descarta `KeylessAudio.provider` (`src/tts/keyless.ts:152`); el
    cliente no sabe que el texto salió del nodo, y en Google se envía en el query param `q`
    (`src/tts/keyless.ts:99`): expuesto en logs y proxies. Arreglo: campo `provider` +
    disclosure, y mover el texto a POST.
13. **Rutas federation públicas sin rate limit.** `src/routes/federation.ts:93-134`
    (`/node`, `/catalog`, `/models`) y `/tts/status` no usan limiter, y `server.ts:775-779`
    difunde booleanos de presencia de claves del operador. Arreglo: aplicar `federationLimiter`
    y recortar el payload.
14. **Idempotencia de checkout por ventana de reloj.** `src/economy/revenue-fabric/storage.ts:1018`
    construye `idempotencyKey` con `minuteBucket`: dos compras legítimas del mismo usuario y
    plan dentro del mismo minuto colapsan en una sesión. El webhook de Stripe sí es durable
    (`ON CONFLICT (event_id) DO NOTHING`, `:1092`). Arreglo: clave aportada por el cliente.

### BAJO

15. **RUNBOOK desalineado.** `RUNBOOK.md:74,148-149` cita healthcheck de CrowdSec en `/health`
    y alertas de Node Exporter (no existe en compose); `:392,411` documentan
    `/api/v1/audit/recent` y `/api/v1/audit/verify`, rutas inexistentes (el inventario congelado
    solo tiene `GET /api/v1/audit` y `GET /api/v1/security/audit`). El contrato de puerto 8080
    sí es coherente: `server.ts:254`, `Dockerfile:59,63,68`, `docker-compose.yml:174,180,229`.
16. **Formato de pruebas fuera del gate.** `format`/`format:check` solo cubren `src/**`, así que
    `test/inference/keyless-free-provider.test.ts` conserva dobles comillas heredadas del WIP.
    Arreglo: extender el patrón a `test/**` o formatear en el pre-commit.
17. **Perfiles de Chrome en el árbol.** Aparecían 1 747 archivos sin seguimiento
    (`.chrome-headless-profile*/`) **[aplicado]**: añadí la regla
    `.chrome-headless-profile*/` a `.gitignore:23-25`; `git status --porcelain` pasó de 1 759
    entradas a 31 (30 modificadas + este informe).

## 4. Correcciones aplicadas (todas de bajo riesgo, ninguna toca comportamiento de red ni despliegue)

1. `prettier --write` sobre los 17 archivos heredados sin formato del upstream (14 en
   `src/omega/**`, 3 en `src/economy`, `src/health`, `src/lib`). `format:check` ahora pasa.
2. Regla `.chrome-headless-profile*/` en `.gitignore`.
3. Resolución de los 4 conflictos de la reaplicación del WIP, con el criterio documentado en
   la tabla de la sección 1.

Nada fue commiteado ni empujado: el árbol quedó con 30 archivos modificados respecto a
`16add75`, listos para que los revises.

## 5. Verificación y límites de esta auditoría

- Ejecutado de verdad: `fetch`, `merge --ff-only`, `stash apply`, `git apply`, `typecheck`,
  `lint`, `format:check` (antes y después), `check:env`, `check:sops` y la suite completa
  (335 archivos / 2106 pruebas pasaron, exit 0).
- La revisión de hallazgos 1-16 es de solo lectura sobre el código actual; cada uno cita
  `archivo:línea`. Los números de README (`165 claves`, `read_in_src=95`) y el estado de los
  workflows en GitHub **no** se pudieron verificar desde aquí: requieren ejecutar el CI.
- No probé el servidor en vivo ni el flujo de voz/chat contra los proveedores externos, así
  que los hallazgos 3, 4 y 12 son de contrato y código, no de comportamiento observado en red.
- El gate de inventario de rutas (`test/deployment/route-inventory.test.ts`) pasó dentro de la
  suite, así que los módulos nuevos del upstream sí registraron sus rutas en
  `test/deployment/route-inventory.json`.

## 6. Siguiente paso sugerido

Orden recomendado: decidir la política de egreso (hallazgo 3) → arreglar el contrato de CI
(hallazgos 1 y 2) → cablear o degradar el núcleo de liquidación y los módulos nativos
(5 y 6) → borrar `src/lib/lib/**` (7) → precios (8). Después, publicar con
`/isabella-main-safe-publish`, que ejecuta exactamente este ciclo de puertas y exige
`HEAD == origin/main` con árbol limpio antes de dar por publicado.
