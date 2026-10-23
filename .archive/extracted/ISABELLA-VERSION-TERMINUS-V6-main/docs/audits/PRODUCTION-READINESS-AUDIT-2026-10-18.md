# Auditoría técnico-operativa de preparación para producción
**Proyecto:** ISABELLA-VERSION-TERMINUS-V6  
**Fecha de corte:** 18 de octubre de 2026  
**Rama inspeccionada:** `main`  
**Commit de referencia:** `bf99c682de8493fa9ccd28e1652bb319338f4122`  
**Despliegue Vercel observado:** `dpl_9VpW8DjZJFU4bxypnkeNVjup7CRD`  
**Dictamen:** **NO APTO PARA DECLARAR PRODUCCIÓN COMPLETA**. El servicio HTTP responde, pero la readiness profunda es HTTP 503 y la evidencia CI más reciente no es satisfactoria.

## 1. Resumen ejecutivo

La aplicación está desplegada en Vercel y el endpoint superficial `GET /health` respondió HTTP 200 con estado `healthy`. Esto demuestra que una instancia del runtime está atendiendo solicitudes, pero no certifica que todas las dependencias de negocio, persistencia, inferencia, telemetría ni controles de producción estén listas.

En la inspección en vivo de `GET /api/v1/readyz`, el servicio respondió HTTP 503. La respuesta identificó cuatro bloqueos de readiness y una degradación de observabilidad. El workflow `Isabella Genesis Ω Sovereign CI` más reciente, para el commit indicado, terminó en `failure`; el workflow `Repository Assurance` también terminó en `failure`, y el despliegue de producción de GitHub Actions fue rechazado. Los jobs consultados no expusieron pasos ejecutados en la respuesta disponible, por lo que no se atribuye el fallo a una prueba concreta sin logs concluyentes.

**No se publica un porcentaje global de preparación:** no existe evidencia suficiente y consistente para calcularlo de forma defendible. Estado comprobable: despliegue HTTP activo; readiness profunda bloqueada; CI pendiente de diagnóstico y verde reproducible.

## 2. Evidencia reproducible y alcance

### Evidencia de repositorio
- El repositorio remoto existe y la conexión GitHub informa permiso de lectura y escritura sobre `OsoPanda1/ISABELLA-VERSION-TERMINUS-V6`.
- La rama por defecto es `main`.
- El commit inspeccionado es `bf99c682de8493fa9ccd28e1652bb319338f4122`.
- `package.json` declara Node.js `24.x`, pnpm `10.28.0`, TypeScript, Vitest y scripts de validación.
- `vercel.json` declara `pnpm run build:dist` y empaquetado de recursos para la función Express.
- La estructura contiene una aplicación Express exportada desde `src/server.ts`, pruebas de smoke, scripts de seguridad, un subsistema Rust `ige-omega`, un plugin Maven y recursos de infraestructura.

### Evidencia en vivo de Vercel
- Despliegue consultado: `isabella-v6-tina-77ni7i775-isabella-mexa.vercel.app`.
- `GET /health`: HTTP 200; `status=healthy`.
- `GET /api/v1/readyz`: HTTP 503; `snapshot.readiness.ready=false`.
- La existencia de un despliegue con estado Vercel `READY` significa que Vercel finalizó el despliegue, no que todas las dependencias de aplicación estén listas.

### Validación local parcial ejecutada sobre el ZIP adjunto
- `node --check src/ui/app.js`: PASS.
- `node scripts/ui-smoke.mjs`: PASS; salidas `UI_NAVIGATION_SMOKE_OK`, `CINEMATIC_INTRO_12_SCENES_OK`, `UNIFIED_WORKSPACE_COMMAND_CENTER_OK` y `LOCAL_STUDIO_EXPORT_ATTACHMENT_OK`.
- `node scripts/repository-assurance.mjs`: PASS, 44/44 comprobaciones estructurales y 0 fallos.
- `server.js` existe en la raíz y delega en `dist/server.js`; la configuración de entrada Express no está ausente en el snapshot revisado.

### Limitaciones de la validación local
El entorno de auditoría dispone de Node.js 22.16.0, mientras el proyecto requiere Node.js 24.x; pnpm no está instalado y Corepack no pudo descargar pnpm por falta de conectividad con el registro npm. No se pudo ejecutar honestamente `pnpm install --frozen-lockfile`, `pnpm run validate`, `pnpm test`, el build de TypeScript/esbuild ni el runtime smoke sobre un artefacto recién construido. Los checks sin dependencias anteriores no sustituyen esas pruebas.

## 3. Bloqueadores confirmados

| ID | Severidad | Hallazgo | Evidencia / impacto | Acción necesaria |
|---|---|---|---|---|
| P0-01 | Crítica | La readiness profunda devuelve HTTP 503 | `/api/v1/readyz` declara `ready=false`; no debe tratarse como producción saludable | Resolver los bloqueos siguientes y repetir el probe desde el mismo despliegue |
| P0-02 | Crítica | Falta `BOOKPI_INTEGRITY_SECRET` válido | El probe informa que falta o tiene menos de 32 caracteres; la persistencia de BookPI no pasa su control de integridad | Configurar un secreto aleatorio de al menos 32 caracteres en Vercel, solo como variable de entorno cifrada; no subirlo al repositorio |
| P0-03 | Crítica | Atlas/Supabase no pasa el probe de persistencia | `atlas-persistence=unavailable`; el servicio remoto no está respondiendo correctamente a la comprobación configurada | Verificar URL, credenciales, permisos, red, esquema/migraciones y health query desde el entorno de Vercel |
| P0-04 | Alta | IKES/Supabase aparece degradado y pendiente | `ikes-memory=degraded`, probe fallido | Validar configuración de IKES, tabla/esquema, permisos de escritura/lectura y una prueba de ida y vuelta |
| P0-05 | Alta | El ledger BookPI heredado es volátil | `bookpi-ledger=degraded`, backend `VOLATILE_IN_MEMORY`; eventos pueden perderse al reiniciar el proceso | Migrar el camino operativo a almacenamiento durable y compartido, comprobar persistencia tras reinicio y documentar la fuente autoritativa |
| P1-01 | Alta | La exportación de telemetría no está verificada | La readiness indica que no hay un probe vivo de exportador | Configurar el exportador elegido y validar una señal de extremo a extremo; si se decide no usarlo, declarar explícitamente el modo sin exportación y ajustar el criterio de readiness |
| P1-02 | Alta | CI principal y Repository Assurance fallan en el último SHA consultado | Ambos workflows muestran `failure`; la respuesta de jobs no aporta pasos ejecutados ni logs concluyentes | Obtener un run con logs completos, identificar la primera causa real y repetir en el mismo SHA. No desactivar los gates para forzar un verde |
| P1-03 | Alta | No hay prueba local válida de build/test en el entorno de auditoría | Node 22 frente a Node 24 requerido; pnpm no pudo instalarse sin red | Ejecutar con Node 24.x y pnpm 10.28.0, usando el lockfile congelado, y conservar logs/artifacts del SHA |
| P1-04 | Alta | No se ha verificado inferencia generativa externa en este corte | Un fallback local no equivale a un modelo generativo remoto; la disponibilidad depende de proveedor, opt-in, credenciales y políticas | Configurar un proveedor aprobado, ejecutar smoke generativo real, comprobar `responseEngine`, latencia, límites y fallback; documentar la salida de datos a terceros |
| P1-05 | Alta | No hay evidencia suficiente para certificar aislamiento y persistencia E2E en producción | El código incluye controles y pruebas, pero no se ha observado aquí un resultado verde y reproducible de CI ni un E2E remoto | Ejecutar pruebas multiusuario/RLS, reinicio, idempotencia, concurrencia y recuperación contra el entorno objetivo |
| P1-06 | Alta si el destino es público | La protección SSO de Vercel está activada para todos los despliegues excepto dominios personalizados | La configuración del proyecto declara `ssoProtection.enabled=true` y el proyecto solo lista alias `vercel.app`; esto puede impedir el acceso de usuarios públicos | Decidir el modo de lanzamiento: conservar la protección para preview/cerrado, o configurar un dominio público y ajustar explícitamente la protección tras revisar las rutas administrativas y sus tokens |

## 4. Riesgos de diseño y verificación pendientes

1. **No confundir liveness y readiness.** `/health` confirma que el proceso atiende; `/api/v1/readyz` determina si las dependencias declaradas están disponibles. La alerta actual es real y debe permanecer visible hasta resolverla.
2. **No presentar el fallback local como inferencia generativa.** Debe mostrarse al usuario qué motor respondió, si la salida procede de un proveedor remoto y cuándo el servicio se degradó.
3. **No almacenar secretos en Git.** Las variables de producción se deben definir en el proyecto Vercel y en los sistemas de secretos autorizados; cualquier secreto expuesto en historial debe rotarse.
4. **No declarar durabilidad por usar PostgreSQL en alguna ruta.** Hay que demostrar que el flujo operativo de evidencia realmente escribe en el backend durable, que el registro es compartido y que sobrevive a un reinicio.
5. **No tratar documentación o pruebas aisladas como certificación.** El estado de cada función debe derivarse de código conectado, tests reales y evidencia del mismo SHA.
6. **No deshabilitar gates para conseguir un despliegue.** Un fallo de CI debe investigarse en el primer paso que falla; el despliegue productivo debe seguir cerrado si el gate no pasa.

## 5. Secuencia de cierre para producción

### Fase A — Secretos y dependencias
- Definir `BOOKPI_INTEGRITY_SECRET` con valor aleatorio de al menos 32 caracteres.
- Revisar las variables exactas de Atlas/Supabase e IKES usando `.env.example` y `docs/ENVIRONMENT.md`; no copiar valores de ejemplo a producción.
- Confirmar conexión desde el runtime Vercel, permisos mínimos y compatibilidad de esquema.
- Verificar que BookPI escribe en un backend durable compartido; reiniciar y comprobar lectura/verificación de eventos anteriores.

### Fase B — Calidad reproducible
Ejecutar en un runner compatible con Node 24.x y pnpm 10.28.0:
```bash
corepack enable
corepack prepare pnpm@10.28.0 --activate
pnpm install --frozen-lockfile
pnpm run validate
pnpm run smoke:production
pnpm run verify:production
```
La prueba de producción requiere que las dependencias que correspondan estén disponibles. Guardar logs y artefactos ligados al SHA exacto. Ejecutar además la suite Rust con `cargo test --workspace --locked`, `cargo clippy --workspace --all-targets --locked -- -D warnings` y `cargo audit`, y la verificación Maven del plugin si esos componentes forman parte del release.

### Fase C — Pruebas de aceptación en Vercel
- `GET /health` responde 200.
- `GET /api/v1/readyz` responde 200 y muestra evidencia consistente de dependencias listas.
- Conversación local: saludo, continuidad de historial, entrada vacía, payload excesivo y límites de sesión.
- Inferencia externa: respuesta de un proveedor real y explícitamente autorizado, identificación del motor y medición de latencia.
- Fallback: caída o timeout del proveedor, respuesta dentro del presupuesto de tiempo y sin duplicar operaciones.
- Seguridad: rutas administrativas protegidas, límites de tasa, secretos ausentes en respuestas/logs, aislamiento de datos y prueba de persistencia después de reinicio.
- Despliegue: CI verde para el SHA exacto, smoke posterior al despliegue y rollback ensayado.

## 6. Cambios realizados en este corte

Esta auditoría registra hallazgos y acciones de cierre; **no afirma que los bloqueos de infraestructura hayan sido resueltos por cambios de código**. Los secretos, credenciales, permisos de Supabase, el exportador de telemetría y los servicios externos requieren configuración y validación en las cuentas de despliegue. No es correcto inventar esos valores ni cambiar la readiness para que informe verde sin evidencia.

## 7. Criterio de salida

La liberación solo puede declararse cuando:
- la suite CI completa pasa en el commit que se va a desplegar;
- la compilación y los smoke tests de producción pasan;
- `/api/v1/readyz` devuelve 200 por razones verificadas;
- BookPI e IKES demuestran persistencia y aislamiento reales;
- al menos una ruta de inferencia generativa aprobada funciona y su fallback está probado;
- los controles de seguridad, monitoreo, recuperación y rollback tienen evidencia del mismo release.

**Estado final al corte:** despliegue accesible; preparación profunda bloqueada; no certificado para producción completa.
