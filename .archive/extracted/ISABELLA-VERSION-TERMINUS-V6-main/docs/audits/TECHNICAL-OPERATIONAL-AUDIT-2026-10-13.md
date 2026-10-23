# Auditoría técnico-operativa consolidada de Isabella V6 — 13 de octubre de 2026

## Resumen corto consolidado (fuente anterior: `docs/audits/AUDIT-2026-10-13.md`)

state: draft | engine-generated (pendiente de revisión humana con nombre)

## Corregido (con prueba de regresión)
- AUD-01 `deriveSessionId` anónimo: CSPRNG en vez de `Math.random`+`Date.now`.
- AUD-02 `verify_event`: comparación en tiempo constante, firma no-string = inválida; `sign_event` hashea payload canónico (orden de claves irrelevante).
- AUD-03 motor local: respuestas deterministas por relevancia, sin `Math.random`.
- AUD-04 `bookpi/merkle.ts`: el esquema v1 duplica la hoja impar ([a,b,c] ≡ [a,b,c,c]). Se añade esquema v2 RFC 6962 (`merkleRootV2`, `generateChunkProofV2`, `verifyChunkProofV2`); v1 se conserva por compatibilidad y los protocolos `bookpi.register/verify` devuelven ambos.
- AUD-05 OpenAPI: documentadas las rutas REINA y el esquema `AdminBearer`; ruta pública `reina/status` con rate limit.
- AUD-06 HTTP: sin manejador de errores final (JSON inválido devolvía HTML de Express, con stack fuera de producción) → `classifyHttpError` devuelve JSON seguro (400/413/415/500).
- AUD-07 Fuerza bruta sobre tokens admin sin freno → `AuthFailureThrottle` (10 fallos/5 min → 429 antes de comparar), memoria acotada.
- AUD-08 Sin `trust proxy`: tras un balanceador todos los clientes compartían cubeta de rate limit → `TRUST_PROXY=<saltos>` (solo enteros 1..10).
- AUD-09 Cabeceras: HSTS en producción, COOP, CSP estricta + `Cache-Control: no-store` en `/api/*`.
- AUD-10 (2026-10-16) Stripe: eventos duplicados se reprocesaban y un `updated` tardío podía resucitar una suscripción cancelada → `WebhookInbox` + `EventOrderGuard`.
- AUD-11 Los grupos de rutas aceptan `authorizeAdmin` opcional (abierto en desarrollo): se añade guarda estática que exige cablear una compuerta en cada `register*Routes` de `server.ts`.
- AUD-12 Fuzz de ReDoS sobre AEGIS, VIGIA, CROWN y sanitización: sin hallazgos. Un regex de email propio (nuevo) era cuadrático y se acotó antes de integrarse.

## Pendiente (no resuelto)
- OpenAPI cubre 15 de ~77 rutas; el resto necesita contratos con esquema real (no se inventan).
- `process.env` leído fuera de `config.ts` en varios módulos; CSP solo en unified-gateway.
- BookPI en runtime es volátil por defecto; sin WORM ni anclaje RFC 3161.
- ML-KEM/ML-DSA siguen BLOCKED_ENVIRONMENT (requieren KMS/HSM).
- Gates oficiales (`pnpm typecheck/test/build`) no ejecutados aquí (npm bloqueado): se usó typecheck local con tipos de Node y un arnés de pruebas; el CI de GitHub es la verificación válida.

---

## Informe técnico ampliado

**Estado:** `draft | engine-generated`; requiere revisión humana antes de declararse verificada.  
**Repositorio:** [OsoPanda1/ISABELLA-VERSION-TERMINUS-V6](https://github.com/OsoPanda1/ISABELLA-VERSION-TERMINUS-V6)  
**Rama de trabajo:** `audit/hardening-2026-10-13`  
**Alcance:** inspección remota del código, pruebas, configuración HTTP, workflow CI, manifiesto Ingress y documentación visible.  
**Limitación importante:** esta auditoría no equivale a una revisión línea por línea de todo el repositorio, un pentest, ni una ejecución local de la suite. No se declara que los tests hayan pasado por el mero hecho de añadirlos.

## 1. Dictamen ejecutivo

Se identificó y corrigió un defecto de seguridad en el limitador de solicitudes: al alcanzar la capacidad máxima de claves, el algoritmo anterior eliminaba cubetas activas. Un cliente podía provocar presión de claves y hacer que se perdiera el historial de cuota de otros clientes, debilitando el rate limit. La implementación corregida recupera únicamente ventanas vencidas y rechaza nuevas claves mientras no haya capacidad libre.

También se corrigió una divergencia operativa entre el límite global de cuerpo JSON de Express (`256kb`) y el manifiesto NGINX Ingress (`8m`), incluido un comentario que afirmaba erróneamente que ambos límites coincidían. El Ingress ahora usa `256k`, de forma coherente con el parser global. Cualquier aumento posterior requiere revisar límites de Express y de cada endpoint en conjunto.

**Estado de liberación: NO CERTIFICADO PARA PRODUCCIÓN.** Las correcciones de código no resuelven por sí solas los gates externos de despliegue, CI, persistencia compartida, KMS/HSM, pruebas de carga y validación E2E que el propio repositorio identifica como pendientes.

## 2. Hallazgos y acciones

### AUD-SEC-001 — Evasión del rate limit mediante presión de claves

- **Severidad:** alta para el control de abuso; requiere considerar el contexto de exposición y la configuración del despliegue.
- **Archivo afectado:** `src/security/rate-limit.ts`.
- **Causa raíz:** al superar `maxKeys`, el código anterior borraba las entradas más antiguas, incluso si sus ventanas seguían activas. Las claves eran controlables indirectamente a través del tráfico que alimentaba el limitador.
- **Impacto:** el historial de consumo de una clave activa podía desaparecer bajo una inundación de claves nuevas. Esto debilitaba la garantía del límite por cliente y permitía presión de memoria/tráfico para forzar desalojos.
- **Corrección aplicada:** validación estricta de `maxKeys`; limpieza exclusiva de ventanas vencidas; rechazo fail-closed de claves nuevas si el mapa sigue lleno; conservación de las cubetas activas.
- **Pruebas añadidas:** inundación de 100 claves, preservación de cuota de una clave existente, recuperación al vencer una ventana, validación de capacidad y comportamiento ante retroceso del reloj.
- **Riesgo residual:** el limitador sigue siendo de proceso. En varias réplicas, cada instancia mantiene un contador distinto; se necesita un rate limit distribuido en gateway/WAF o un almacén compartido para garantías globales. La política fail-closed bajo saturación también puede rechazar clientes legítimos nuevos hasta que venzan ventanas; es una compensación explícita entre integridad del control y disponibilidad.

### AUD-DEP-001 — Desalineación del límite de cuerpo entre Ingress y aplicación

- **Severidad:** media; inconsistencia operativa y de protección de recursos.
- **Archivos afectados:** `k8s/ingress.yaml` y `src/server.ts` (referencia de configuración inspeccionada).
- **Causa raíz:** NGINX declaraba `proxy-body-size: 8m`, mientras el parser global de Express declaraba `express.json({ limit: "256kb" })`. El comentario del manifiesto afirmaba que el valor de aplicación era 8 MB.
- **Impacto:** solicitudes grandes podían atravesar el Ingress y luego ser rechazadas por la aplicación, haciendo que la configuración y su documentación fueran engañosas. El límite de borde mayor también permitía consumir recursos de red/proxy innecesariamente.
- **Corrección aplicada:** `proxy-body-size: 256k` y comentario actualizado para reflejar el parser global.
- **Riesgo residual:** antes de aumentar el límite global, hay que comprobar los tamaños máximos de audio/imágenes, la expansión de Base64, memoria por solicitud y los límites por endpoint. Un cambio de límite no debe hacerse sólo para acomodar un caso de uso sin pruebas de carga y de rechazo.

### AUD-DOC-001 — Evidencia histórica que puede confundirse con el estado actual

- **Severidad:** media en trazabilidad y gobierno de versiones.
- **Evidencia:** `docs/audits/TOTAL-AUDIT-2026-10-13.md` declara un repositorio/SHA histórico diferente (`isabella-V6-TINA-h6`, `deb26b9`) y 746 pruebas, mientras el README de la rama consultada presenta una evidencia más reciente de 1006 pruebas / 175 archivos.
- **Impacto:** si se presenta el informe histórico como auditoría de la rama actual, se mezclan snapshots y métricas que no corresponden al mismo SHA.
- **Acción recomendada:** conservar el informe anterior como registro histórico, pero etiquetarlo claramente con su SHA y añadir enlaces a informes posteriores. No actualizar cifras de auditoría sin reproducir los comandos en el SHA exacto.

### AUD-CI-001 — CI y gates de producción no demostrados en esta revisión

- **Severidad:** bloqueo de liberación.
- **Evidencia de configuración:** existen workflows de CI, seguridad, evidencia de producción y verificación Rust; la configuración del workflow no demuestra que los jobs hayan terminado satisfactoriamente en la revisión actual.
- **Estado:** pendiente de ejecución observable en el SHA candidato. El README describe problemas de ejecución de CI como `startup_failure`, pero ese estado no se vuelve a certificar aquí como vigente sin inspeccionar una ejecución actual.
- **Acción requerida:** ejecutar typecheck, tests, build, security suite, evidencia de producción y gates Rust en CI sobre el mismo SHA; guardar los artefactos y revisar el resultado real de cada job.

## 3. Cambios implementados en esta rama

1. `src/security/rate-limit.ts`: se elimina el desalojo de cubetas activas y se adopta una política de capacidad fail-closed.
2. `test/security/rate-limit.test.ts`: se añaden casos para inundación de claves, persistencia de cuota, vencimiento, capacidad inválida y retroceso del reloj.
3. `k8s/ingress.yaml`: el tamaño máximo del cuerpo en NGINX se alinea con el límite global del parser JSON.

Los cambios se realizaron en una rama separada; no se sobrescribió directamente `main`.

## 4. Matriz de validación

| Control | Resultado de esta auditoría |
|---|---|
| Inspección estática de los archivos modificados | Realizada |
| Pruebas de regresión nuevas | Añadidas; **pendientes de ejecución** en runner |
| TypeScript/typecheck completo | Pendiente de ejecución |
| Suite completa de pruebas | Pendiente de ejecución |
| Build y smoke UI/runtime | Pendiente de ejecución |
| Security suite | Pendiente de ejecución |
| Validación estructural de Kubernetes/Ingress | Cambio textual inspeccionado; validación de manifiestos pendiente |
| CI observable sobre un mismo SHA | Pendiente |
| Pentest externo / análisis dinámico | No realizado |
| E2E con proveedores, PostgreSQL real, KMS/HSM y clúster | No realizado en esta auditoría |

## 5. Riesgos técnicos que permanecen abiertos

- El limitador de solicitudes y otros estados en memoria no ofrecen coordinación entre réplicas.
- La seguridad de servicio mediante bearer token no sustituye autorización por usuario/tenant, límites de permisos ni aislamiento de datos.
- Las capacidades de proveedores externos dependen de credenciales, cuotas y condiciones del proveedor; una ruta implementada no demuestra una integración E2E operativa.
- Los ledgers locales y los hashes aportan trazabilidad/integridad limitada, pero no prueban la verdad del contenido ni equivalen por sí solos a almacenamiento WORM.
- Los manifiestos Kubernetes no prueban que un clúster esté desplegado, configurado y observado.
- La latencia p50/p95/p99 debe medirse con carga reproducible; no se declara latencia «casi cero» sin datos.
- El informe previo y los contadores de pruebas deben vincularse siempre a un SHA exacto para evitar mezclar evidencia de diferentes versiones.

## 6. Criterios de cierre

No marcar esta auditoría como `verified` hasta que una persona responsable revise el diff y se adjunte evidencia reproducible vinculada al SHA exacto que incluya:

1. Typecheck, suite completa, build, smoke y security suite en verde.
2. Validación del manifiesto Ingress/Kubernetes.
3. Prueba concurrente del limitador bajo carga y, si hay varias réplicas, comprobación de límites globales en el gateway/almacén distribuido.
4. CI de producción y gates Rust ejecutados satisfactoriamente.
5. Pruebas de integración de persistencia, recuperación, permisos y despliegue en el entorno objetivo.

**Conclusión:** se corrigió un defecto concreto de protección contra abuso y una divergencia de configuración de despliegue. El resultado es una mejora verificable en el código propuesto, no una certificación global de Isabella ni una autorización de producción.
