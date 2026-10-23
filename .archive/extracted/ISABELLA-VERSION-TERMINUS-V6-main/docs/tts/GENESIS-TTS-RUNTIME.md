# Génesis TTS MX-Prime — runtime nativo en Isabella

state: engine-generated · Confidencial TAMV Online Network: este documento describe SOLO la implementación en este repositorio; no reproduce el texto de la especificación fundacional.

## Qué corre hoy (implementado y probado)

| Capa | Archivo | Qué hace de verdad |
|---|---|---|
| Normalización es-MX | `src/tts/normalize.ts` | Markdown/URLs, números hasta 10¹², dinero (`$` = pesos, centavos), %, decimales con «punto», horas, siglas (deletreo/diccionario), abreviaturas |
| MCPΩ (reglas) | `src/tts/prosody.ts` | Pistas culturales con confianza declarada (litotes «no estuvo tan mal», «ahorita» desambiguado, coloquialismos, empatía, posible sarcasmo) |
| Emoción | `src/tts/prosody.ts` | 12 ejes inferidos por léxico/puntuación; un vector explícito del usuario prevalece (subconjunto de la matriz Ω-X128 de la especificación) |
| Hyper Prosody | `src/tts/prosody.ts` | Plan por frase: ritmo, tono, volumen, pausas (calibradas con el perfil medido: pausa de párrafo ≈707 ms), respiración marcada |
| Router Cognitivo | `src/tts/router.ts` | softmax + top-k + pérdida de balanceo sobre backends REALES (pesos fijos, no aprendidos); enmascara los no disponibles |
| Memory Voice Core | `src/tts/memory.ts` | Pronunciaciones por sesión (`/pronuncia Kubernetes = Kúbernetes`), acotada, borrable; solo por instrucción explícita |
| Gobernanza | `src/tts/governance.ts` | Nonce anti-replay con TTL, actor obligatorio opcional (`TTS_STRICT_GOVERNANCE=1`), topes de tamaño |
| Evidencia | `src/tts/governance.ts` | Sello SHA3-512 sobre el digest del texto COMPLETO (no un prefijo) + evento BookPI |
| Backends | `src/tts/engine.ts` | (1) servicio neuronal del operador, (2) TTS por clave (`GROQ_*`), (3) voz del navegador guiada por el plan |
| HTTP | `src/routes/tts.ts` | `GET /api/v1/tts/status`, `POST /plan`, `POST /synthesize`, `POST|DELETE /memory` |
| UI | `src/ui/app.js` | `speak()` pide el plan al servidor y habla por frases con su prosodia; reproduce audio real si un backend lo entrega; cae al modo local si falla |

Si ningún backend entrega bytes de audio, `synthesize` devuelve `status: "client-plan"` (nunca un audio falso).

## Solo especificación (NO implementado aquí)

AMoSE neuronal, MTAA-Ω (6 niveles de atención), vocoder BigVGAN, Acoustic DNA, kernels HCT-L/HCT-Q de GPU, Emotion Matrix de 128 ejes, y las metas (MOS > 4.8, similitud > 0.95, TTFB < 40 ms, WER < 1.5 %): son **objetivos de diseño sin medir**. La demostración de que existe una «voz neuronal propia» depende de que el servicio externo exista y entregue audio real (contrato abajo).

## Contrato del servicio neuronal (`GENESIS_TTS_URL`)

```
GET  /v1/status      → { "state": "OPERATIONAL", ... }
POST /v1/synthesize  ← { text, language:"es-MX", region, mode, emotion_vector, actor_id, nonce, voice_id? }
                     → { "status":"success", "audio_base64":"…", "audio_mime":"audio/wav", "trace_id"?, "experts_used"? }
```

Diferencias con el borrador de servicio de la especificación (hay que cerrarlas para que Isabella lo use):

1. El borrador responde `audio_path` (ruta local del servidor): un cliente remoto no puede leerla. Debe responder `audio_base64` + `audio_mime` (≤ 8 MiB).
2. El borrador tokeniza con `torch.randint`, no sintetiza ni escribe el WAV y no tiene pesos entrenados: aunque arranque, no produce voz.
3. Con `NODE_ENV=production` el adaptador rechaza `http://` fuera de localhost; use HTTPS o un túnel privado.

Variables: `GENESIS_TTS_URL`, `GENESIS_TTS_TOKEN` (Bearer opcional), `TTS_STRICT_GOVERNANCE`.

## Verificación realizada (17–19 oct 2026, sandbox)

- 40+ pruebas unitarias (`test/tts/*`, `test/routes/tts.test.ts`), incluida una prueba contra un servidor HTTP real que sigue el contrato y entrega un WAV decodificado y medido (F0 205 Hz).
- Prueba en navegador (Chromium + Playwright) con la voz del navegador sustituida por un doble: la UI pidió `/api/v1/tts/plan`, normalizó «$19 USD» → «diecinueve dólares» y habló 3 frases con tono/ritmo distintos por frase; `/pronuncia` guardó la entrada.
- **No verificado:** sonido audible real, calidad de voz, latencias de un servicio neuronal real.
