---
state: draft
date: 2026-10-19
---
# Checklist de correcciones — Isabella V6 (auditoría 2026-10-19)

Pensado para entregarlo a otra IA. Cada ítem: **qué**, **dónde**, **cómo verificar**. Prioridad P0 (bloquea) → P3 (pulido).
Base: `main` @ commit 70361de. Honestidad: las pruebas de este checklist se hicieron en un sandbox sin `pg`/`express`/red npm, así que **ningún `pnpm test` completo se ha corrido aquí**; el primer paso es correrlo en CI/local.

## P0 — Rompe la compuerta de build
- [ ] **`scripts/ui-smoke.mjs` falla en `main`**: `AssertionError: Intro scenes must be distributed over the actual media duration` (línea ~93). Causa: el rewrite upstream de `src/ui/app.js` eliminó la lógica del video intro (`introVideo.currentTime * 1000`, `renderIntroFrame`, `scene.inert`, `introTotalMs`…) pero el smoke sigue exigiendo esas cadenas. `pnpm build` ejecuta este script → el build falla. Decidir: restaurar la lógica del intro en app.js **o** actualizar los guards. Verificar: `node scripts/ui-smoke.mjs` imprime OK completo.
- [ ] **Correr `pnpm install && pnpm typecheck && pnpm test && pnpm build` en limpio** y arreglar lo que salga. Nunca se ha visto verde de punta a punta en esta sesión (faltan `pg`, `express` en el sandbox; ~16 archivos de test no cargaron).
- [ ] **CI nunca confirmado verde**: revisar `.github/workflows/{ci,repository-assurance,ige-omega-ci,beta-live-model-gate,deploy-production,atlas-ingest}.yml` en GitHub Actions; corregir los rojos. Activar *branch protection* en `main` (checks requeridos) — hoy bots y humanos empujan directo y se pisan.
- [ ] **Dependabot**: GitHub avisa de alertas abiertas en el push. Revisar en Security → Dependabot y actualizar `pnpm-lock.yaml`.

## P0 — Producción (readiness real 61 %, ver `docs/ESTADO-REAL-ACTUAL.md`)
- [ ] `BOOKPI_INTEGRITY_SECRET` debe estar definido en el entorno desplegado (está vacío en `.env.example`); sin él el ledger no es verificable.
- [ ] **Ledger BookPI volátil** (en memoria): persistir en Postgres/Supabase (append-only) y probar recuperación tras reinicio.
- [ ] Endpoints Atlas/IKES devuelven 404 en el despliegue: desplegar o retirar de la UI/README.
- [ ] Sin OTLP/alertas ni rollback documentado y probado (`deploy/`, `k8s/`, `docs/ops`).
- [ ] Sin smoke contra proveedores de inferencia reales: ejecutar `pnpm smoke:production` / `verify:production` con claves reales y registrar latencias medidas (hoy no hay números reales).

## P1 — Monetización
- [ ] `POST /api/v1/billing/checkout` (src/server.ts ~2939) está protegido por token admin → el botón de planes de la UI **no puede completar una compra** un usuario normal. Diseñar flujo público autenticado por usuario/workspace.
- [ ] Verificar de extremo a extremo con Stripe en modo test: checkout → webhook (`STRIPE_WEBHOOK_SECRET`) → entitlement → límites por plan. Nada de esto se ha probado contra Stripe.
- [ ] Precios en `src/commerce/catalog.ts` (premium 1900/19000, vip 7900/79000 centavos) deben coincidir con los Price IDs reales de Stripe.

## P1 — TTS / voz
- [ ] **Dos rutas de voz paralelas**: la UI usa `/api/v1/cognition/speech` (`speakMessage` en `src/ui/app.js`); el motor nuevo `src/tts/*` + `src/routes/tts.ts` (`/api/v1/tts/{status,plan,synthesize}`) **no está conectado a la UI** (mi integración se perdió en el conflicto con el rewrite upstream). Conectar: en `speakMessage` pedir `/api/v1/tts/synthesize`, caer a `/cognition/speech`, y a `speechSynthesis` como último recurso; añadir comando `/pronuncia` (MemoryVoiceCore) y ajustar `scripts/ui-smoke.mjs`.
- [ ] **No existe audio neural**: sin servicio nativo (`GENESIS_TTS_URL`, contrato `GET /v1/status`, `POST /v1/synthesize → {audio_base64, audio_mime}`) el resultado es `client-plan` (prosodia + voz del navegador). La parte neural de la spec es solo documento; hay que construir/alojar ese servicio.
- [ ] AUD-17: modelo TTS del servidor por defecto vacío/inglés → es‑MX suena mal; fijar modelo/voz y probar con audio real.
- [ ] **Duplicados sin referencia**: `src/voice/emotion.ts` y `src/voice/normalize-esmx.ts` (no rastreados por mí; duplican `src/tts/*`). Borrar o fusionar.
- [ ] La voz de referencia no es clonación (perfil sintético F0 ≈ 205 Hz); no prometerlo en README.
- [ ] La especificación TTS es propiedad de TAMV: no está en el repo; mantenerla fuera.

## P1 — UI
- [ ] Churn upstream: bot v0 y humanos reescriben `app.js`, `chat-plus.js`, `index.html`, README en paralelo → conflictos constantes. Acordar un solo dueño por archivo o ramas/PR.
- [ ] `scripts/ui-smoke.mjs` está acoplado a cadenas literales: migrar a pruebas Playwright reales (chromium ya disponible) para intro, navbar móvil, chat, voz.
- [ ] Sin pruebas E2E reales de: video intro (fluidez), móvil, consentimiento `#immersionConsent`, envío de mensaje con proveedor real.
- [ ] `src/ui/chat-plus.js` está minificado/ilegible a mano; mantener fuente legible + build.

## P2 — Código / arquitectura
- [ ] `src/server.ts` ≈ 3850 líneas: seguir extrayendo grupos `register*Routes` (patrón de `src/routes/tts.ts`). Cada bloque debe contener literal `authorizeAdmin`/`authorizeApiToken` (`test/security/route-gate-wiring.test.ts`).
- [ ] **AUD-18 módulos sin cablear** (código que existe pero ningún runtime usa): `cognition/genesis-chunk`, `companion/*`, `deployment/{canary,production-smoke}`, `governance/incident`, `inference/adapters`, `platform/index`, `privacy/{crypto-shred,differential-privacy}`, `security/key-hierarchy`. Cablear o mover a `docs/archive`. Regla AGENTS.md: un test verde ≠ facultad.
- [ ] Reglas AGENTS.md: 0 `any` en `src` (verificado: solo aparece en comentario), sin `@ts-ignore`; 7 `console.log` en `src` → pasar a logger estructurado; sin TODO sin dueño (ninguno encontrado). Mantener.
- [ ] Marcadores `stub/placeholder/mock` en `src/server.ts`, `health/preflight.ts`, `governance/quality-gates.ts`, `security/post-quantum.ts`, `security/isa-x/protocol.ts`: revisar que no se presenten como capacidad real (post-quantum e ISA‑X en particular).
- [ ] Coherencia documental: README ↔ `docs/ESTADO-REAL-ACTUAL.md` deben decir lo mismo (61.0 %; hay test `readiness-consistency`). Cada reescritura upstream de README debe conservarlo.

## P2 — Contratos y guardas (mantener en verde al agregar rutas)
- [ ] Al añadir ruta: actualizar `test/deployment/route-inventory.json`, `docs/api/route-inventory.json` (`node scripts/route-inventory.mjs`), `docs/api/openapi.yaml`, y documentar cada variable nueva en `.env.example`.

## P3 — Tests / entorno
- [ ] El shim local no soporta `mockResolvedValueOnce`/`useRealTimers`: fallos falsos en `ige-omega` gateway-probe, `ikes-supabase`, cache de inferencia. Confirmar que pasan con vitest real.
- [ ] Añadir pruebas de carga/latencia (hedging, `DeadlineBudget`, `providerTimeoutMs` 8 s) contra proveedores reales; hoy solo hay pruebas unitarias.
- [ ] Re-verificar seguridad: rutas públicas, rate limits, throttle de auth (`pnpm security:suite` daba 14/14 antes del último rebase; volver a correr).

## Orden sugerido para la otra IA
1. `pnpm install && pnpm typecheck && pnpm test` → lista real de fallos.
2. Arreglar `ui-smoke` (P0).
3. Conectar UI ↔ `/api/v1/tts/*`.
4. Checkout público + prueba Stripe test.
5. Persistencia del ledger + secretos en el despliegue.
6. Branch protection + CI verde.
