# Isabella Villaseñor AI Génesis Ω∞ — TAMV ONLINE

Isabella es un **Runtime Web Operativo y Sistema Federado de Inteligencia Artificial Gobernada (FGAIS)** construido, propiedad y creado por **Edwin Oswaldo Castillo Trejo (Anubis Villaseñor)** bajo la marca **TAMV ONLINE ENTERPRISE**. No es un chatbot: es un runtime con gobernanza determinista, memoria jerárquica, LLM fundacional propio, RAG soberano, herramientas allowlisted, habilidades ejecutables, auditoría criptográfica y —desde esta versión— un sistema nativo de análisis audio-espectral en tiempo real: el **TAMV Kaos Audio System**.

> Estado del repositorio: `draft | engine-generated` hasta revisión humana nominal. No se declara conciencia, autonomía jurídica ni autoridad propia.
>
> Propiedad y uso: ver [`LICENSE`](LICENSE) y [`NOTICE`](NOTICE.md). La licencia publicada es **propietaria, con todos los derechos reservados**: clonar o leer el repositorio no autoriza ningún uso, y en ningún caso se transfieren la marca, la identidad territorial ni el diseño del Kaos Audio System.

## Contrato de evidencia

Este repositorio se rige por el invariante ontológico:

```text
SPECIFIED ≠ IMPLEMENTED ≠ TESTED ≠ PRODUCTION
CAPABILITY ≠ AUTHORITY ≠ EXECUTION ≠ EVIDENCE
```

Ningún documento, tabla o respuesta de API puede elevar una categoría a otra. El inventario de rutas (`docs/api/route-inventory.json`), el canon Ω∞ (`src/platform/omega-canon.ts`) y el mapa de integración TAMV (`src/territory/tamv-integration.ts`) declaran la madurez real de cada capacidad, y hay pruebas que fallan si una cifra inventada reaparece.

## TAMV Kaos Audio System

Innovación nativa: DSP de audio escrito en TypeScript dentro de este repositorio, sin dependencias nativas, sin WASM y sin servicio externo. Mide la señal que el cliente envía y deriva presets y planes. **No reproduce, no sintetiza, no separa fuentes.**

### Qué calcula de verdad

- **FFT radix-2 Cooley–Tukey in-place** sobre ventana de Hann simétrica; `DEFAULT_FFT_SIZE = 2048`, `DEFAULT_HOP_SIZE = 512`, promedio tipo Welch.
- **Centroide espectral**, **flatness** (razón geométrica/aritmética de magnitudes) y **energía por banda**: grave `0–250 Hz`, medio `250–2000 Hz`, agudo `2000 Hz–Nyquist`, banda de voz `300–3400 Hz`.
- **Transitorios por flujo espectral relativo**: cada avance normalizado por la energía de los dos cuadros involucrados; el umbral es `media + 2.5·σ` con un suelo de `0.08` y separación mínima de 40 ms. Sin este detalle los onsets se contaban sobre ruido de piso.
- **Estéreo M/S como proporción** `side / (mid + side)`: una señal en contrafase ya no colapsa a cero.
- **Niveles medidos**: pico y RMS en dBFS, factor de cresta, rango dinámico, proporción de silencio, latencia de análisis del request.
- **Perfil emocional y complejidad espacial** por ponderaciones visibles (documentadas en `src/tamv/analysis.ts`), no por un modelo entrenado.

### Qué declara y qué se niega a fingir

- 11 presets de fábrica con `processingChain` ordenada y matriz acústica interpretable (entorno × contenido × emoción × complejidad espacial × intensidad háptica).
- Preset adaptativo determinista: el mismo WAV produce el mismo `adaptive_<sha12>`.
- Plan de redefinición de **8 etapas** con **15 puertas de validación colgadas**; **7 etapas son reversiblemente recuperables** y todas nacen en estado `declared` con `audioRendered: false`.
- Monitor de telemetría con **10 lecturas**: las 4 de hardware (temperatura de CPU, uso de GPU, error de sincronía háptica, precisión espacial) se devuelven como `measured: false` con su motivo; de las 6 restantes se calculan 6 en material estéreo y 5 en mono —en mono no existe el par de canales que correlacionar— (invariante `CAPABILITY ≠ AUTHORITY ≠ EXECUTION ≠ EVIDENCE`).

### Gobernanza de la superficie

| Control | Valor real |
|---|---|
| Prefijo | `/api/v1/tamv` |
| Autorización POST | `GENESIS_ADMIN_API_TOKEN` vía `authorizeApiToken` (401 cerrado sin credencial) |
| Rate limit | ventana fija de 8 requests / 60 s por bucket y cliente |
| Ledger de evidencia | cada llamada appendea a BookPI su `methodId` `A.TWINS.E07_TAMV.*` |
| Blackout | alcance `VOICE_SYNTHESIS` en `src/governance/blackout.ts` |
| Escenario de riesgo | `NEGLIGIBLE` (lectura), `LOW` (análisis/preset), `MEDIUM` (plan de redefinición) |
| Cotas de entrada | 180 000 bytes crudos, mínimo 2048 muestras por canal, duración máxima 180 000 ms |
| Contenedor | WAV PCM 16; `audio/mpeg`, `audio/flac`, `audio/ogg`, `audio/mp4`, `audio/webm` se rechazan con código explícito |

```text
GET  /api/v1/tamv/status
GET  /api/v1/tamv/presets
GET  /api/v1/tamv/presets/:presetId
POST /api/v1/tamv/analyze
POST /api/v1/tamv/adaptive-preset
POST /api/v1/tamv/redefine-plan
```

Un rechazo 400 devuelve el motivo exacto (`TAMV_PAYLOAD_EMPTY`, `TAMV_BASE64_INVALID`, `TAMV_MIME_UNSUPPORTED`, `TAMV_PAYLOAD_TOO_LARGE`, `TAMV_WAV_UNDECODEABLE`, `TAMV_SIGNAL_TOO_SHORT`, `TAMV_DURATION_TOO_LONG`): "no es WAV" y "está vacío" no son el mismo error.

### Limitaciones del motor (no negociables en el texto)

- No hay reproducción en tiempo real: el motor mide y declara, no emite sonido.
- No hay separación de fuentes ejecutada; `source_separation` es un objetivo para un motor externo.
- No hay HRTF ni render binaural/ambisonic: `width`/`height`/`depth` son parámetros declarados.
- No hay medidor LUFS: la puerta de sonoridad usa RMS medido, que no es loudness percibida EBU R128.
- El clasificador es un conjunto de ponderaciones visibles; `confidence` no es probabilidad calibrada.
- Sin actuador háptico conectado: el patrón háptico es metadata para un dispositivo cliente.

## Categorización del sistema

| Categoría | Descripción | Módulos clave |
|---|---|---|
| **Kaos Audio System** | DSP espectral nativo, presets, preset adaptativo y plan de redefinición gobernado | `src/tamv/`, `src/routes/tamv.ts` |
| **Runtime & HTTP** | Servidor Express/TypeScript, rutas, rate limiting, hardening | `src/server.ts`, `src/http/`, `src/routes/` |
| **LLM Fundacional** | Orquestación de proveedores (HF, Ollama, Gratis, AI SDK Gateway) + fallback soberano | `src/inference/foundational-llm.ts`, `src/inference/free-providers.ts`, `src/inference/router.ts` |
| **RAG Soberano** | Embeddings deterministas + búsqueda por similitud coseno | `src/inference/rag.ts`, `src/inference/embeddings.ts` |
| **Memoria** | 5 niveles (immediate, session, project, territorial, historical) + IKES | `src/memory/hierarchical.ts`, `src/memory/ikes.ts` |
| **Gobernanza** | CROWN, AEGIS, Policy Gate, Zero Trust, Prompt Guard, blackout Terminus | `src/genesis/`, `src/security/`, `src/governance/` |
| **Evidencia** | Ledger BookPI con sello Ed25519 y canonicalización JCS (RFC 8785) | `src/governance/`, `src/ivcc/` |
| **Ciberseguridad** | Threat intel, JCS, fetchSafeUpstream, advanced threat intel | `src/security/advanced-threat-intel.ts`, `src/security/jcs.ts`, `src/security/fetch-safe.ts` |
| **Voz/IVCC** | IVCC, consentimiento, perfiles de voz, watermark | `src/ivcc/`, `src/routes/ivcc.ts`, `src/routes/tts.ts` |
| **Economía** | SCER, dynamic pricing, Profit Guard, tesorería, afiliados, fraude | `src/economy/`, `src/commerce/` |
| **Territorio** | Identidad e integración TAMV (MSR, MDD, DreamSpaces, Blindajes, Kaos Audio) | `src/territory/` |
| **Canon Ω∞** | Registro canónico de pilares, capas, implementaciones y madurez | `src/platform/omega-canon.ts`, `src/platform/catalog.ts` |
| **Integraciones** | MCP, dominios Vercel, Hugging Face Hub, malla federada TAMV | `src/infra/vercel-domains.ts`, `src/federation/`, `/api/mcp` |

## LLM fundacional nativo

`src/inference/foundational-llm.ts` orquesta proveedores open source/free (Hugging Face, Ollama, Gratis, AI SDK Gateway), inyecta memoria conversacional e historial, recupera contexto verificado (RAG + verified knowledge), garantiza respuesta con fallback soberano y cachea 60 s. El fallback determinista local **se declara como fallback**: nunca se presenta como inferencia de modelo.

## Herramientas y skills

- `IsabellaEngine` con 9 primitivas: `observe`, `pick`, `place`, `move`, `rotate`, `handover`, `release`, `wait`, `verify`.
- Fallback de 4 niveles: `PROGRAM → ACTION_CHUNK → HUMAN_REVIEW → DEGRADED`.
- Habilidades de alto impacto siempre terminan en `HUMAN_REVIEW`.
- Catálogo gobernado de herramientas registrado en `src/tools/catalog.ts`; cada ejecución deja evidencia en BookPI antes de que su salida llegue al llamador.

## Variables de entorno

El contrato completo está en [`.env.example`](.env.example): una línea por variable con su semántica y su modo de fallo. Tres reglas operativas:

1. Las variables `POST /api/v1/tamv/*` no introducen secretos propios: reutilizan `GENESIS_ADMIN_API_TOKEN`.
2. `ISABELLA_SIGNING_PRIVATE_KEY_PEM` / `ISABELLA_SIGNING_PUBLIC_KEY_PEM` son opcionales; sin ellos el servidor genera un par efímero por proceso y las firmas no sobreviven a un reinicio.
3. `MCP_SERVER_TOKEN` está sin configurar por defecto: `/api/mcp` responde 503 en lugar de ejecutar herramientas.

Nunca se escriben valores reales de credenciales en código, documentación, commits ni logs.

## Validación

```bash
corepack pnpm install --frozen-lockfile
corepack pnpm run typecheck
corepack pnpm run lint
corepack pnpm run format:check
corepack pnpm test
corepack pnpm run smoke:ui
corepack pnpm run smoke:runtime
corepack pnpm run build
corepack pnpm run deploy:readiness
```

Puertas duras del inventario y del canon: `test/deployment/route-inventory.test.ts` (las 304 rutas registradas en `src/` están congeladas; una extracción de módulo no puede perder ni renombrar un endpoint), `test/deployment/openapi-contract.test.ts` (ninguna operación documentada en `docs/api/openapi.yaml` puede ser fantasma: hoy 75 operaciones), `test/deployment/env-documentation.test.ts` y `test/deployment/readiness-consistency.test.ts`. La suite del Kaos Audio System son 8 archivos y 125 pruebas, con oráculo DFT ingenuo que valida la FFT y regresiones explícitas de los dos errores que ya se corrigieron.

El inventario se regenera con `node scripts/route-inventory.mjs`; las columnas Auth/Rate-limit/Validación son heurísticas de análisis estático, no pruebas en ejecución.

## Avance

Avance global de implementación: no publicado como porcentaje único. Mientras no exista un denominador de requisitos ponderados y reproducible, una cifra agregada sería especulación y no se presenta como hecho.

Lo que sí es verificable en este SHA: typecheck sin errores, 304 rutas congeladas, 75 operaciones OpenAPI sin fantasmas, superficie TAMV montada en `src/server.ts` con autorización, rate limit, ledger y blackout, y su suite de 125 pruebas en verde. Estado documentado y limitaciones: [`docs/ESTADO-REAL-ACTUAL.md`](docs/ESTADO-REAL-ACTUAL.md).

## Gates pendientes para liberar

Mientras estos gates no estén cerrados sobre el SHA candidato, el sistema **no** se declara en producción:

1. CI completo (typecheck, lint, format, pruebas, build, smokes) conservando logs válidos sobre el SHA.
2. Persistencia durable verificada: secretos del entorno, migraciones aplicadas, adaptadores Postgres de API-keys y federación, durabilidad y recuperación de BookPI.
3. Conversación generativa E2E con proveedor autorizado, incluyendo timeout, error y fallback comprobados.
4. E2E de navegador en desktop y móvil: navegación, conversación, accesibilidad y errores.
5. Despliegue, monitorización, backup/restore y rollback reales en el entorno objetivo; el incidente `500 FUNCTION_INVOCATION_FAILED` sigue abierto hasta reproducirse y cerrarse con evidencia.
6. Revisión humana nominal de todo artefacto marcado `engine-generated`.

## Propiedad

Copyright (c) 2026 **TAMV ONLINE ENTERPRISE** — **Edwin Oswaldo Castillo Trejo (Anubis Villaseñor)**. El TAMV Kaos Audio System, el canon Génesis Ω∞, la identidad Isabella Villaseñor y el branding TAMV ONLINE son creación y propiedad de su autor y no pueden utilizarse sin su consentimiento. Ver [`NOTICE`](NOTICE.md).

### Licencia

Este repositorio **no** está bajo una licencia de código abierto. Se publica bajo el aviso
propietario de [`LICENSE`](LICENSE): todos los derechos reservados, y ningún uso —incluidas
la copia, la redistribución, el despliegue como servicio y el aprovechamiento del código o
de su documentación para entrenar modelos de IA— sin consentimiento previo, expreso y por
escrito del titular. Las versiones anteriores circularon con un texto MIT; la sustitución es
prospectiva y su alcance está declarado en el §6 de `LICENSE`. Cada dependencia y cada
activo de terceros conservan la licencia que les dio su propio titular (§4).
