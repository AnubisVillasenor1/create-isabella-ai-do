# Auditoría focalizada: interfaz empresarial y comunicación conversacional

Fecha de intervención: 2026-10-17  
Rama de trabajo: `feat/isabella-enterprise-ui-live-chat`  
Base inspeccionada: `main` (árbol del repositorio y fuentes consultadas durante la intervención)

## Alcance

Esta intervención se concentra en dos objetivos: (1) elevar la presentación visual sin retirar controles ni módulos existentes y (2) verificar el camino conversacional de extremo a extremo, diferenciando el fallback local de la inferencia generativa externa.

## Cambios implementados en esta rama

### 1. Refinamiento visual empresarial

Archivo: `src/ui/cinematic.css`

- Paleta más sobria de obsidiana, platino, azul hielo y lavanda contenida.
- Jerarquía tipográfica, espaciado y navegación más consistentes.
- Paneles, consola, tarjetas y campos con bordes, superficies y sombras más discretas.
- Mejor presentación de mensajes de usuario y asistente, con anchura legible y saltos de línea seguros.
- Mejoras para foco visible, selección de texto, estados deshabilitados y navegación con teclado.
- Ajustes responsive para móvil y pantallas intermedias.
- Respeto de `prefers-reduced-motion`; las reglas son overrides progresivos y no eliminan componentes existentes.

No se afirma una medición de rendimiento visual ni un resultado de pruebas de navegador hasta ejecutar los checks del commit.

### 2. Comunicación conversacional: estado real observado

El cliente `src/ui/app.js` envía mensajes mediante `POST /api/v1/cognition/route`, con historial acotado y un `AbortController`. El servidor en `src/server.ts` aplica límites, evaluación de políticas, presupuesto de inferencia y selección de proveedores. Si el proveedor no entrega texto, existe un fallback conversacional local identificado como `sovereign-fallback`.

La ruta local permite responder sin proveedor remoto, pero **no es un modelo de lenguaje generativo**. No debe anunciarse como inferencia generativa.

La ruta intenta proveedores externos según su configuración y política. La variable `ISABELLA_KEYLESS_FREE_PROVIDER=pollinations` habilita explícitamente un proveedor externo sin clave; activar esta opción implica que el prompt y parte del historial pueden salir del servidor hacia un tercero. Por privacidad, no se habilita silenciosamente desde el código de interfaz.

## Bloqueadores de validación externa

El README existente declara estado de preproducción y menciona que la ruta de readiness ha devuelto HTTP 503 por dependencias/configuración incompletas, incluida la configuración de integridad BookPI y servicios Atlas/IKES. El README también documenta que un smoke generativo externo fue omitido por falta de credenciales de proveedor. Estos datos son advertencias documentadas del repositorio, no una medición en vivo de la rama nueva.

Para demostrar comunicación generativa en el despliegue elegido, se necesita:
1. Seleccionar y autorizar al menos un proveedor/modelo.
2. Configurar las variables de entorno requeridas en el entorno de despliegue (sin subir secretos al repositorio).
3. Ejecutar una prueba HTTP real con un prompt inocuo y confirmar `responseEngine` distinto de `sovereign-fallback`.
4. Probar indisponibilidad del proveedor y verificar que el fallback responde dentro del presupuesto de tiempo.
5. Confirmar que los mensajes y el historial no se envían a terceros sin una decisión explícita del operador.

## Criterio de aceptación

- UI: typecheck y smoke existentes pasan; verificación visual en escritorio y móvil; navegación por teclado y reducción de movimiento verificadas.
- Conversación local: salud HTTP, envío de saludo, respuesta, continuidad con historial y nueva sesión verificadas.
- Inferencia generativa: respuesta procedente de proveedor real, proveedor identificado en metadatos, latencia medida y fallback tras error verificados.
- Producción: readiness y dependencias requeridas saludables; no basta con un build correcto.

## Límites de esta intervención

Esta rama contiene un refinamiento visual de CSS. No declara que la inferencia externa esté conectada, que la aplicación haya sido desplegada, que los checks de CI hayan pasado ni que el sistema esté listo para producción. La configuración del proveedor y la validación real en el entorno desplegado son pasos separados y necesarios.

## Cambios adicionales de esta ampliación — 2026-10-17

### Puerta de inmersión: consentimiento real, sin CAPTCHA ficticio

- Se eliminó el desafío numérico generado y validado completamente en cliente. No constituía protección contra bots ni verificación de identidad.
- Se reemplazó por un consentimiento audiovisual explícito, con estado accesible y mensaje que aclara su alcance.
- El botón para omitir la intro ahora permanece dentro del diálogo modal; el foco entra al diálogo, queda contenido con Tab/Shift+Tab, Escape permite cerrar y al salir se devuelve el foco a la entrada del chat.
- La protección contra abuso sigue dependiendo de controles de servidor, como rate limiting; el consentimiento no se presenta como seguridad de identidad.

### Video y sincronización de la narrativa

- Se quitó `loop` del vídeo: el final de reproducción puede disparar `ended` y cerrar correctamente la intro.
- El progreso de escenas usa `requestAnimationFrame`, no un intervalo fijo de 80 ms.
- Cuando hay metadatos válidos, el avance de la narrativa deriva del tiempo reproducido del vídeo, para que el texto no avance mientras el vídeo está detenido en buffering.
- Los eventos `waiting`, `stalled` y `error` habilitan una capa de respaldo CSS más ligera en lugar de invocar repetidamente `play()` y agravar los intentos de recuperación.
- La pestaña oculta pausa vídeo y tiempo narrativo; al volver intenta reanudar el vídeo y conserva el mecanismo alternativo si falla.
- Se reduce el desenfoque de pantalla completa y se retira `will-change: transform` permanente del vídeo, reduciendo la presión potencial sobre composición/GPU. No se afirma una mejora cuantificada de FPS ni una reproducción perfecta sin medición en navegador y dispositivo.

### Pruebas de regresión añadidas

El smoke de UI verifica la existencia del consentimiento y su cableado, ausencia del antiguo código de “verificación humana”, la ausencia de `loop`, el reloj de escenas basado en el vídeo, la respuesta a buffering, el alcance del botón de omisión y el control de foco del diálogo. Estas comprobaciones son estáticas; la reproducción real y la accesibilidad deben validarse además en navegador.

### Estado de validación

Los cambios están en la rama de la PR #23, no en `main`. No se ha ejecutado un smoke de navegador ni se dispone de una ejecución de CI utilizable para certificar estas correcciones. Las Actions observadas en el repo han terminado en pocos segundos con cero pasos expuestos y registros inaccesibles; no se interpretan como un resultado verde ni como diagnóstico concluyente del código.
