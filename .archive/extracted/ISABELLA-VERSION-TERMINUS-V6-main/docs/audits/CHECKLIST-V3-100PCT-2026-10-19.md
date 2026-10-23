---
state: draft
date: 2026-10-19
supersedes: CHECKLIST-V2-2026-10-19.md
---
# Checklist v3 — camino al 100 % (auditoría robusta, con evidencia)

Cada ítem: **ID · sev · qué · evidencia/dónde · criterio de cierre**. Sev: C=crítico, H=alto, M=medio, L=bajo.
Límite honesto: el sandbox de auditoría no tiene `pg`/`express`/red npm ni decodifica H.264; nada de lo medido aquí reemplaza `pnpm install && typecheck && test && build` en CI real.
Correcciones a v2: (a) `innerHTML` en `chat-plus.js` solo aparece en un comentario, no hay uso real; (b) el video intro pesa 23 MB (original) / 8.8 MB (web).

## A. Veracidad del estado (sesgos e inconsistencias)
- **A1·C** README afirma "Avance global 78 %" y "pnpm test 1659/1659 ✓, build verde al SHA 30f5dac" (README:11,17,27,292), mientras `docs/ESTADO-REAL-ACTUAL.md:11` dice **61.0 %** con otra rúbrica. Dos cifras públicas contradictorias. El commit 32ce336 **invirtió** el test `readiness-consistency` (antes exigía NO publicar un porcentaje no sustentado; ahora exige "78%"). Además el mensaje de commit dice 1666 tests vs 1659 en README. → Una sola cifra, derivada de la rúbrica, con comando reproducible y enlace a la corrida de CI; restaurar el test que protege contra porcentajes sin evidencia. Cierre: test verde + CI run enlazado.
- **A2·H** Sesgo de autoevaluación: los porcentajes los calcula quien implementa. → Que CI genere `evidence/readiness.json` y el README lo cite; prohibido editarlo a mano.
- **A3·M** Documentos de auditoría dispersos y solapados (`docs/AUDIT_*`, `docs/audit/`, `docs/audits/`, `docs/archive/`). → Índice único `docs/audits/INDEX.md`, archivar el resto.

## B. Build / CI / calidad
- **B1·C** Validar `pnpm install && pnpm typecheck && pnpm test && pnpm build` en limpio y registrar el run. (Este sandbox no puede.)
- **B2·C** Branch protection en `main` (PR + checks requeridos). Hoy bots (v0), humanos y agentes empujan directo y se pisan (conflictos repetidos en `app.js`, `index.html`, README).
- **B3·H** Reglas AGENTS.md violadas: 3 `any` en `src/routes/revenue-fabric.ts:20-22` (`limiter: any`). 18 `console.log/warn` en `src`. → tipar el limiter; logger estructurado; ESLint `no-explicit-any` en CI.
- **B4·H** No hay ESLint/Prettier (`lint` = `tsc --noEmit`). → añadir y bloquear en CI.
- **B5·M** Workflows: revisar `.github/workflows/*.yml` (6) en GitHub; ninguno verificado verde por esta auditoría. Dependabot: resolver alertas.
- **B6·M** Variables usadas y no documentadas en `.env.example`: `BOOKPI_LEDGER_PATH`, `HOST`, `PORT` (VERCEL*/VITEST son de plataforma).
- **B7·M** Tests de rutas solo parciales: `/api/v1/revenue/*` (16 rutas) sin test de rutas (solo test unitario del motor).

## C. Contratos de API
- **C1·H** OpenAPI cubre 57 paths de 175 rutas del inventario → **111 rutas sin documentar** (incluye billing, revenue, citemesh, civilization, cognitive-capital…). El test solo comprueba "documentado ⇒ existe", no lo inverso. → Añadir test inverso (con lista de excepciones explícita) y documentar.
- **C2·M** Inventario congelado `test/deployment/route-inventory.json` y `docs/api/route-inventory.json` duplican fuente; generar uno del otro.

## D. Monetización — evolución (CRÍTICO)
Regla del dueño: **70 % usuarios / 30 % plataforma; solo usuarios con plan de pago activo; `free` no monetiza.**
- **D1·C** Existen **al menos 5 motores de ingresos solapados** y ninguno impone la regla: `src/commerce/revenue.ts` + `revenue-share.ts` (mío, 70/30 + `canEarn`), `src/economy/sovereign-revenue-fabric.ts` (tasas de creador por tier IETS 50–90 %, sin gating por plan), `economy/revenue-fabric/normalized-settlement.ts` (`userRate`), `economy/{monetization-engine,dynamic-pricing,royalty,affiliates,cognitive-capital-market}`, `bookpi` royalties. → **Una sola fuente de verdad**: Revenue Fabric como libro mayor; `computeRevenueShare` como política de reparto invocada por `settle`; borrar o marcar `deprecated` el resto. Cierre: test que prueba que `free`/`trialing`/`past_due` reciben 0 a través de `POST /revenue/settle`.
- **D2·C** Estado volátil: ledger, liquidaciones, uso y wallets son `Map` en memoria (`sovereign-revenue-fabric.ts:233`, `immutable-ledger.ts:51`, `metering-service.ts:48`) aunque exista `migrations/001_initial_schema.sql`. Un reinicio borra dinero contabilizado. → Persistencia Postgres transaccional con idempotencia y `outbox` real; prueba de recuperación.
- **D3·C** Checkout público inexistente: `/api/v1/billing/checkout` exige token admin; usuario normal no puede pagar. Sin flujo Stripe E2E (checkout→webhook→entitlement→elegibilidad→reparto) probado.
- **D4·C** Pago real no implementado: Stripe Connect/KYC, umbral mínimo, MXN, CFDI/retenciones ISR‑IVA, holdback 30 días para contracargos, clawback por fraude. Requiere decisión legal/fiscal del dueño.
- **D5·H** `wallet/:userId/credit|debit` solo admin y sin vínculo con suscripción; riesgo de acreditar a `free`. → validar `canEarn` en crédito de ganancias.
- **D6·H** Rutas `/api/v1/revenue/usage*` y `wallet*` usan `authorizeProviderRoute` (token de proveedor) para leer datos por `:userId`: cualquier titular del token lee cualquier usuario. → autorización por sujeto (usuario solo lo suyo).
- **D7·M** Métrica de contribución (puntos) que reparte el 70 % no está definida ni es auditable (riesgo de fraude/gaming). → definir, firmar con BookPI, tope por usuario.
- **D8·M** UI: planes/CTA no completan compra; no hay panel "Mi plan y ganancias" (free ve CTA a mejorar; planes de pago ven ganancias estimadas con aviso de no garantizado).
- **D9·M** Términos y avisos: ganancias no garantizadas, solo planes de pago, retención y reembolsos.

## E. Seguridad / endurecimiento
- **E1·H** CSP permite `script-src 'unsafe-inline'` y `style-src 'unsafe-inline'` (`src/server.ts:107`). → nonces/hashes; añadir `object-src 'none'`, `Permissions-Policy`, `Referrer-Policy`, `COOP`.
- **E2·H** Rutas con `authorizeProviderRoute` vs `authorizeAdmin` mezclan niveles de privilegio; documentar matriz ruta→actor y testearla (existe `route-gate-wiring`).
- **E3·M** `any` en limiter oculta contratos de rate-limit. (ver B3)
- **E4·M** Escaneo de secretos (gitleaks) y OSV/`pnpm audit` en CI; SBOM. Los hits de patrones tipo clave están en tests/preflight (revisar que sean fixtures).
- **E5·M** `Math.random` en `src/cli/reconcilePids.ts:50` (jitter; aceptable) — documentar.
- **E6·M** `BOOKPI_INTEGRITY_SECRET` obligatorio en el entorno desplegado; ledger BookPI persistente.

## F. Producción (readiness real)
- **F1·C** Atlas/IKES 404 en despliegue; OTLP/alertas ausentes; rollback no ensayado (`deploy/`, `k8s/`).
- **F2·C** Sin smoke ni latencias medidas contra proveedores de inferencia reales (`smoke:production`, `verify:production`).
- **F3·H** Sin HEALTHCHECK de contenedor (distroless; documentado) → probe en k8s verificado.
- **F4·M** Prueba de carga (k6/autocannon) con resultados en `docs/ops`.

## G. Archivos incompletos / infuncionales / huérfanos
- **G1·H** `src/voice/emotion.ts` y `src/voice/normalize-esmx.ts`: huérfanos, duplican `src/tts/*`. Borrar o fusionar.
- **G2·H** UI no está conectada a `/api/v1/tts/*`; usa `/api/v1/cognition/speech`. No hay audio neural (solo `client-plan` sin `GENESIS_TTS_URL`). AUD‑17 (modelo TTS vacío/inglés).
- **G3·H** AUD‑18 módulos sin cablear: `cognition/genesis-chunk`, `companion/*`, `deployment/{canary,production-smoke}`, `governance/incident`, `inference/adapters`, `platform/index`, `privacy/{crypto-shred,differential-privacy}`, `security/key-hierarchy`.
- **G4·M** Marcadores stub/placeholder: `health/preflight.ts`, `governance/quality-gates.ts`, `security/post-quantum.ts`, `security/isa-x/protocol.ts` → no presentarlos como capacidad real.
- **G5·M** `src/server.ts` ≈ 3850 líneas → extraer `register*Routes` por dominio.
- **G6·M** `src/assets/video/IntroVideoIsabella.mp4` (23 MB) en el repo; el runtime sirve la web de 8.8 MB. → Git LFS/CDN y eliminar el original del bundle.
- **G7·L** `src/assets/video/uno.md` (32 bytes) sin propósito claro.

## H. UI / visual inmersivo
Hecho esta jornada: intro sin display:none, tarjeta −20 %, sale al autorizar, sin capas sobre el video (≈100→≈500 frames presentados medidos en Chromium con copia VP9), `ui-smoke` verde.
- **H1·H** Verificar el intro real con H.264 en Chrome/Safari/iOS/Android (el sandbox no decodifica H.264); medir `droppedVideoFrames` con `getVideoPlaybackQuality`. Considerar WebM/AV1 además de MP4.
- **H2·H** `command-center.css` ("chat-only home") oculta hero, rails, paneles y navegación con `display:none!important` (línea 3): el sitio pierde navegación y secciones (planes, gobernanza). Decidir producto: chat-only a propósito, o restaurar navegación; hoy es un override ciego por `!important`.
- **H3·M** `cinematic.css` pesa 141 KB sin minificar, mezcla capas antiguas y nuevas (`backdrop-filter` en muchas tarjetas) → tokens de diseño únicos, purgar CSS no usado, presupuesto de blur.
- **H4·M** Accesibilidad: `index.html` sin `<img>`/`svg` con alt (decorativos con `aria-hidden` ok); solo 25 `aria-label`; solo 16 reglas `prefers-*`; fuentes de 6–9 px en mono (169 declaraciones `font-size` en px). → AA de contraste, tamaño mínimo 12 px, foco visible, `prefers-reduced-motion` verificado en intro.
- **H5·M** Pruebas visuales Playwright por breakpoint (hoy solo cadenas literales en `ui-smoke`).
- **H6·M** Chat: streaming SSE con cursor, copiar código, citas/fuentes, adjuntos, paleta de comandos, estados vacío/error/offline.
- **H7·L** Transición intro→app (fundido del video al chat), poster y `preload` escalonado; skeletons en vez de spinners; micro‑interacciones coherentes.
- **H8·L** Un solo dueño por `app.js`/`chat-plus.js`/`index.html`/README para parar conflictos con el bot v0.

## I. Sistemas turbo (rapidez)
Existen `DeadlineBudget`, `hedgedFirst`, cooldowns, `turbo-planner`. Falta:
- **I1·H** Streaming de tokens (SSE) y primer byte < 400 ms.
- **I2·H** Caché exacta/semántica con TTL e invalidación por plan; single‑flight para peticiones idénticas.
- **I3·M** HTTP/2 keep‑alive y precalentamiento a proveedores; compresión br/gzip; `Cache-Control` inmutable con hash.
- **I4·M** Presupuestos por etapa + métricas p50/p95 en `/metrics` con alerta.
- **I5·M** Carga real y resultados versionados (ver F4).

## J. Tests y entorno
- **J1·M** Shim local sin `mockResolvedValueOnce`/`useRealTimers` (falsos fallos en ige-omega, ikes-supabase, inference cache) → confirmar con vitest real.
- **J2·M** E2E Playwright: consentimiento `#immersionConsent`, intro, chat, voz, móvil.
- **J3·L** Mantener guardas al añadir rutas: `test/deployment/route-inventory.json`, `docs/api/*`, `.env.example`.

## Ruta al 100 % (orden)
1. B1+B2+A1 (verdad y CI) → 2. D1–D3 (un motor, persistencia, checkout) → 3. E1,E2,D6 (seguridad) → 4. C1 (OpenAPI) → 5. F1–F2 (producción real) → 6. G1–G3 (limpieza/cableado) → 7. H1,H2,H4 (UI) → 8. I1–I2 (turbo) → 9. D4 (pagos reales, decisión legal).
Definición de 100 %: CI verde en `main` con branch protection; readiness generado por CI; un solo motor de ingresos persistente con regla 70/30 y gating por plan probado E2E con Stripe test; OpenAPI = inventario; 0 `any`; CSP sin inline; intro verificado en dispositivos reales; 0 huérfanos.
