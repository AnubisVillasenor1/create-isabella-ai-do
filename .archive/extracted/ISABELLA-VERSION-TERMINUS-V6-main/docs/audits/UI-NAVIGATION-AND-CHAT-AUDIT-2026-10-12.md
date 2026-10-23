# Auditoría de navegación y conversación — Isabella V6 TINA

**Fecha:** 12 de octubre de 2026  
**Repositorio:** `OsoPanda1/isabella-V6-TINA-h6`  
**SHA validado en Preview:** `cccaede3c21c2516ec8ec6a61c1d69d72d106875`  
**Deployment:** [Vercel READY](https://isabella-v6-tina-4jp7lerbg-isabella-mexa.vercel.app/)  
**Alcance:** interfaz servida por Express (`src/ui/index.html`, `src/ui/app.js`, `src/ui/cinematic.css`), flujo de chat asociado y documentación de usuario.

## Resumen ejecutivo

Se encontraron defectos funcionales y de veracidad de estado en la navegación y la conversación. Se corrigieron en `main`, se añadió un smoke de UI integrado al build y se validó el SHA indicado en Preview. Esta revisión es una auditoría estática más smoke de runtime; no equivale a una prueba E2E con navegador real, lector de pantalla, múltiples dispositivos ni proveedor generativo externo.

## Hallazgos y correcciones

| Severidad | Hallazgo previo | Corrección aplicada | Estado |
|---|---|---|---|
| Alta | `.topbar` declaraba `position: sticky` y luego lo anulaba con `position: relative`. | Se eliminó la sobrescritura y se corrigió el contexto de overflow para permitir sticky. | Corregido; smoke CSS aprobado |
| Alta | La navegación móvil no tenía un control de apertura/cierre. | Botón accesible con `aria-expanded`, `aria-controls`, cierre por Escape, clic fuera y selección de enlace. | Corregido; smoke UI aprobado |
| Alta | El historial de chat se construía después de insertar el mensaje actual; podía volver a enviarse como contexto previo. | El historial se captura antes de insertar el mensaje actual y se limita a ocho mensajes previos. | Corregido en código; falta E2E de navegador |
| Alta | La respuesta HTTP no exitosa podía tratarse como respuesta conversacional normal. | Se verifica `response.ok`, se maneja JSON inválido, respuesta vacía y estados de carga; se bloquea el envío concurrente. | Corregido en código |
| Media | El modo de voz habilitaba TTS, pero no enviaba automáticamente el dictado. | En modo voz, el resultado de reconocimiento se envía; captura admite inicio/parada y manejo de errores/permisos. | Corregido en código; depende del navegador |
| Media | La interfaz afirmaba “NODO CERO · EN LÍNEA” sin comprobar el runtime. | El indicador consulta `/api/v1/health` y diferencia API disponible de estado limitado. | Verificado por HTTP; no afirma que el proveedor LLM esté activo |
| Media | La visualización afirmaba latencia fija de 12 ms sin medición. | Se reemplazó por etiquetas de contexto de sesión y runtime observable. | Corregido |
| Media | Las rutas de la interfaz repetían lecturas síncronas de archivos en cada petición y el primer handler de `/` impedía usar el fallback registrado después. | El HTML/CSS se sirven desde assets cargados en el arranque; si el HTML no está disponible, el handler continúa al fallback. El smoke verifica las rutas cacheadas. | Corregido y validado por build |
| Media | La introducción y animaciones no respetaban el ajuste de movimiento reducido. | Se añadió una ruta de salida inmediata para `prefers-reduced-motion` y CSS de movimiento reducido. | Corregido en código |

## Pruebas observadas en el SHA

- Vercel: **READY**.
- TypeScript build y bundle esbuild completados.
- Vitest: **519 pruebas aprobadas en 100 archivos**.
- Sintaxis de `src/ui/app.js`: comprobada mediante `node --check`.
- `UI_NAVIGATION_SMOKE_OK`: enlaces/anclas con destino, controles requeridos, rutas de API, CSS del menú móvil, rutas de assets cacheados y ausencia de latencia fija sin evidencia.
- `LOCAL_CONVERSATION_SMOKE_OK`: health/chat/follow-up HTTP 200 en el smoke.
- `PUBLIC_API_GUARDRAILS_OK`: entrada vacía 400, entrada excesiva 413, memoria sin scope 403 y solicitud destructiva pública 403.
- `OPENROUTER_PAID_ID_BLOCK_OK`: modelo OpenRouter no gratuito bloqueado sin opt-in.
- GET `/`, `/ui/app.js`, `/styles/cinematic.css` y `/api/v1/health`: HTTP 200.
- `LLM_GATEWAY_SMOKE_SKIPPED`: no hay credenciales elegibles para demostrar inferencia externa.

## Limitaciones que permanecen

1. GitHub Actions sigue mostrando `startup_failure` con cero jobs en el run consultado; Vercel verde no hace que GitHub CI esté verde.
2. No se ha probado una respuesta real de un proveedor generativo en el Preview actual.
3. No se ejecutó una prueba E2E de navegador real (desktop/mobile), pruebas de accesibilidad automatizadas ni una matriz de permisos de micrófono por navegador.
4. La navegación enlaza secciones de la interfaz. Las tarjetas “Tools”, “Skills” y “Monetización” no deben interpretarse como integración productiva de herramientas, cobros o campañas.
5. La readiness global se mantiene en **44.25% (≈44%)** conforme a los gates ponderados documentados; las mejoras de interfaz no cierran los bloqueadores de inferencia externa, CI, Rust, persistencia/recuperación y validación de producción.

## Próximos gates recomendados

- Recuperar un run de GitHub Actions que cree jobs y concluya correctamente.
- Ejecutar Playwright u otra herramienta E2E en escritorio y móvil: navegación, hash/deep link, menú, chat, respuestas 4xx/5xx, permiso denegado de micrófono y modo de voz.
- Configurar credenciales gratuitas elegibles solo en variables de entorno del servidor/Preview y demostrar inferencia externa.
- Mantener una revisión manual del SHA exacto antes de promoción o cambios de política de coste.
