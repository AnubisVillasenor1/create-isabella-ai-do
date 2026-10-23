---
state: draft
date: 2026-10-19
supersedes: CHECKLIST-2026-10-19.md (se mantiene; este v2 lo amplía)
---
# Checklist v2 — Isabella V6: auditoría profunda + plan de ejecución (para otro agente)

Base: `main`. Cada ítem trae **dónde** y **cómo verificar**. Prioridad P0 → P3.
Límite honesto: el sandbox no tiene `pg`/`express`/red npm; nada de lo "verde" aquí sustituye a `pnpm install && pnpm typecheck && pnpm test && pnpm build` real.

## 0. Hechos medidos en esta pasada
- 0 archivos duplicados por hash (md5) en el repo; 0 `any`/`@ts-ignore`; 7 `console.log` en `src`.
- Módulos huérfanos (nadie los importa): `src/voice/emotion.ts`, `src/voice/normalize-esmx.ts` (duplican `src/tts/*`), `src/cli/{bookpiMaintenance,reconcilePids}.ts` (solo scripts npm; ok).
- No hay ESLint ni Prettier (`lint` = `tsc --noEmit`). `src/server.ts` = 3848 líneas.
- CSP en `src/server.ts:107` permite `script-src 'unsafe-inline'` y `style-src 'unsafe-inline'`.
- Docker: `USER 10001` correcto, sin HEALTHCHECK (documentado, distroless).
- 279 archivos de test; ~16 no cargan en sandbox (pg/express).
- Video intro committed en `src/assets/video/` (revisar peso del repo; mover a CDN/Git LFS).

## 1. P0 — Build/CI
- [ ] `scripts/ui-smoke.mjs` falla en main ("Intro scenes must be distributed…"): el rewrite upstream de `src/ui/app.js` quitó la lógica del intro (`introVideo.currentTime`, `renderIntroFrame`, `scene.inert`, `introTotalMs`). Restaurar lógica o reescribir guards (mejor: Playwright).
- [ ] Correr y arreglar `pnpm install && typecheck && test && build` limpios.
- [ ] Workflows `.github/workflows/*.yml` en verde; activar branch protection en `main` (checks requeridos, PR obligatorio para bots).
- [ ] Dependabot: resolver alertas; fijar versiones.

## 2. P0 — Producción (readiness real 61 %)
- [ ] `BOOKPI_INTEGRITY_SECRET` en el entorno desplegado; ledger BookPI persistente (Postgres append-only) + prueba de recuperación.
- [ ] Atlas/IKES 404 → desplegar o retirar de UI/README.
- [ ] OTLP + alertas + rollback documentado y ensayado (`deploy/`, `k8s/`).
- [ ] Smoke real contra proveedores de inferencia y latencias medidas (`pnpm smoke:production`, `verify:production`).

## 3. P0/P1 — Monetización 70 % usuarios / 30 % plataforma (REGLA)
Regla de negocio acordada por el dueño:
1. El pool repartible de un periodo = ingreso **neto confirmado** (cobrado, menos reembolsos/contracargos/comisión del procesador/impuestos).
2. **70 %** va a los usuarios elegibles, **30 %** a la plataforma.
3. **Elegible = usuario con plan de pago activo (premium/vip/enterprise) con Isabella.** Usuarios `free` **no** tienen derecho a monetización (cero reparto, aunque generen actividad).
4. El 70 % se prorratea entre elegibles por puntos de contribución (definir métrica auditable, sin granularidad que permita fraude).
Implementación (checklist):
- [ ] `src/commerce/revenue-share.ts`: función pura determinista `computeRevenueShare` (enteros en centavos, sin pérdida de centavos: el resto va a plataforma) + tests. (Esta sesión lo implementa si alcanza; verificar en `git log`.)
- [ ] Guardia en `src/commerce/entitlements.ts`: `canEarn(plan, subscriptionStatus)` — solo planes de pago `active`/`trialing` sin impago.
- [ ] Persistir `revenue_share_runs` y `revenue_share_lines` (migración Supabase en `supabase/`), append-only + sello BookPI por corrida.
- [ ] Retención/holdback (p. ej. 30 días) para absorber reembolsos y contracargos; clawback si hay fraude (`src/commerce/anti-fraud.ts`).
- [ ] **Pago real**: Stripe Connect (cuentas conectadas, KYC), umbral mínimo de pago, moneda MXN, comprobante CFDI/retenciones ISR-IVA según régimen del usuario. Esto requiere decisión legal/fiscal; no está implementado ni probado.
- [ ] Rutas: `GET /api/v1/commerce/earnings` (usuario autenticado, solo lo suyo) y `POST /api/v1/commerce/revenue-share/run` (admin). Agregar a inventario de rutas, OpenAPI y env doc.
- [ ] Checkout público: `POST /api/v1/billing/checkout` (src/server.ts ~2939) hoy exige token admin; un usuario normal no puede pagar. Autenticar por usuario/workspace.
- [ ] Prueba E2E Stripe modo test: checkout → webhook → entitlement → elegibilidad → corrida de reparto.
- [ ] Precios `src/commerce/catalog.ts` ↔ Price IDs reales de Stripe.
- [ ] Términos/UI: explicar claramente que solo planes de pago participan; evitar promesas de ingreso garantizado.

## 4. P1 — Sistemas "turbo" (rapidez por proceso)
Ya existen: `DeadlineBudget`, `hedgedFirst`, cooldowns, `turbo-planner`. Pendiente de medir y ampliar:
- [ ] Caché semántica/exacta de respuestas (LRU con TTL, clave = hash de prompt normalizado + lente) con invalidación por plan.
- [ ] Streaming SSE de tokens al chat (primer byte < 400 ms) + cancelación por `AbortController`.
- [ ] Precalentamiento (warm) de conexiones a proveedores y pool keep-alive HTTP/2.
- [ ] Compresión (br/gzip) y `Cache-Control` inmutable con hash para `src/ui/*`; `preload` de fuentes y poster del video.
- [ ] Video intro: servir `IntroVideoIsabella-web.mp4` con `Range`, `preload="metadata"`, poster y lazy en móvil; sacar el original de 23 MB del bundle (la versión web pesa 8.8 MB).
- [ ] Batching/deduplicación de llamadas idénticas concurrentes (single-flight).
- [ ] Presupuesto por etapa y métricas p50/p95 en `/metrics`; alerta si p95 > objetivo.
- [ ] Prueba de carga (k6/autocannon) con resultados guardados en `docs/ops`.

## 5. P1 — Endurecimiento / sanitización
- [ ] CSP: quitar `'unsafe-inline'` de scripts (nonces/hashes); añadir `object-src 'none'`, `Permissions-Policy`, `Referrer-Policy`, `Cross-Origin-Opener-Policy`.
- [ ] Revisar el único uso de `innerHTML` en `src/ui/chat-plus.js` (sanitizar o reemplazar por nodos DOM).
- [ ] Comparaciones de token con `timingSafeEqual` en TODAS las rutas admin (29 usos existen; auditar las que faltan).
- [ ] Rate limit + throttle de auth en rutas públicas nuevas (`/api/v1/tts/*`, billing, earnings).
- [ ] Añadir ESLint (`@typescript-eslint`, `no-explicit-any`, `no-floating-promises`) y Prettier; gate en CI.
- [ ] `console.log` → logger estructurado con redacción de PII (`src/privacy/pii-redactor.ts`).
- [ ] `pnpm audit`/OSV en CI; SBOM; escaneo de secretos (gitleaks).
- [ ] Revisar marcadores stub/mock en `health/preflight.ts`, `governance/quality-gates.ts`, `security/post-quantum.ts`, `security/isa-x/protocol.ts`: no presentarlos como capacidad real.

## 6. P1 — Deduplicación / limpieza
- [ ] Borrar o fusionar `src/voice/emotion.ts` y `src/voice/normalize-esmx.ts` con `src/tts/*` (hoy duplicados sin uso).
- [ ] Dos rutas de voz: UI usa `/api/v1/cognition/speech`; `src/tts/*` + `/api/v1/tts/*` no está cableado a la UI. Unificar (fallback en cadena: tts → cognition/speech → speechSynthesis).
- [ ] AUD-18 módulos sin cablear: `cognition/genesis-chunk`, `companion/*`, `deployment/{canary,production-smoke}`, `governance/incident`, `inference/adapters`, `platform/index`, `privacy/{crypto-shred,differential-privacy}`, `security/key-hierarchy` → cablear o archivar en `docs/archive`.
- [ ] Documentación solapada (`docs/AUDIT_*`, `docs/audit/`, `docs/audits/`, `docs/archive/`): consolidar en `docs/audits/` con índice.
- [ ] Partir `src/server.ts` (3848 líneas) en `register*Routes` por dominio (patrón `src/routes/tts.ts`); cada bloque con literal `authorizeAdmin`/`authorizeApiToken` (test `route-gate-wiring`).

## 7. P1 — TTS / voz
- [ ] No hay audio neural: sin `GENESIS_TTS_URL` el resultado es `client-plan`. Construir/alojar el servicio nativo (contrato `GET /v1/status`, `POST /v1/synthesize → {audio_base64, audio_mime}`).
- [ ] AUD-17: modelo TTS del servidor vacío/inglés → fijar voz es‑MX y probar con audio real.
- [ ] `/pronuncia` y memoria de pronunciación aún sin UI.
- [ ] La spec TTS de TAMV no debe entrar al repo.

## 8. P2 — Evolución visual (elegancia/innovación)
- [ ] Sistema de diseño único (tokens: color, tipografía, espacio, radios, sombras, movimiento) en `src/ui/cinematic.css`; modo claro/oscuro/alto contraste.
- [ ] Respetar `prefers-reduced-motion`; accesibilidad AA (foco visible, contraste, aria en chat y navbars).
- [ ] Chat: streaming con cursor, bloques de código con copiar, citas/fuentes, adjuntos, atajos de teclado, paleta de comandos.
- [ ] Navbar móvil/escritorio unificada; transiciones de vista; skeletons en vez de spinners.
- [ ] Panel "Mi plan y ganancias" (solo planes de pago ven ganancias; free ve CTA a mejorar plan).
- [ ] Pruebas visuales Playwright (capturas por breakpoint) en CI.
- [ ] Acordar un solo dueño por `app.js`/`chat-plus.js`/`index.html`/README para frenar conflictos con el bot v0.

## 9. P2/P3 — Pruebas
- [ ] Shim local sin `mockResolvedValueOnce`/`useRealTimers`: validar esos tests con vitest real.
- [ ] E2E Playwright: consentimiento `#immersionConsent`, chat con proveedor real, voz, móvil, intro.
- [ ] Mantener guardas al agregar rutas: `test/deployment/route-inventory.json`, `docs/api/route-inventory.json` (`node scripts/route-inventory.mjs`), `docs/api/openapi.yaml`, `.env.example`.
- [ ] README ↔ `docs/ESTADO-REAL-ACTUAL.md` coherentes (61.0 %; test `readiness-consistency`).

## Orden sugerido
1) install/typecheck/test/build reales → 2) arreglar ui-smoke → 3) checkout público + elegibilidad + reparto 70/30 + Stripe test → 4) persistencia ledger/secretos → 5) CSP/ESLint/gitleaks → 6) streaming + caché + video optimizado → 7) UI↔TTS → 8) rediseño por tokens + Playwright → 9) limpieza de duplicados y partición de server.ts.
