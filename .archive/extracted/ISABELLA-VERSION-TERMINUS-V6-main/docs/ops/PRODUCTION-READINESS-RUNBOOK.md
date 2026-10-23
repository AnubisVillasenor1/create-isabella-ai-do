# Runbook de cierre de bloqueos de producción — Isabella TERMINUS V6

**Estado:** plan operativo basado en evidencia del preview; no constituye certificación de producción.
**Objetivo:** convertir bloqueadores observados en comprobaciones reproducibles sin marcar como saludable una dependencia que no ha sido probada.

## Evidencia observada

En el preview consultado, `GET /api/v1/readyz` devolvió HTTP 503. El informe indicó:
- BookPI utiliza una cadena hash en memoria, por lo que los eventos no sobreviven a un reinicio.
- La consulta de solo lectura a Atlas/Supabase no quedó verificada.
- IKES no tiene un probe conectado a memoria durable.
- No existe una comprobación de exportación de telemetría en readiness.

El smoke test local sí verificó `health=200`, `chat=200` y `followUp=200` mediante el motor soberano local. El smoke test del gateway LLM externo se omitió porque no encontró credenciales gratuitas/de código abierto configuradas. Esto demuestra interacción local, no una ruta generativa externa disponible.

## Acciones necesarias

### 1. Aplicar el esquema de Atlas en Supabase

Migración versionada: `supabase/migrations/20261017000000_atlas-store-core.sql`.
Migración de memoria: `supabase/migrations/20261017000001_ikes-memory.sql`.
Migraciones del ledger PostgreSQL: `infra/db/migrations/001_create_bookpi_events.sql` y `infra/db/migrations/002_bookpi_canonical_immutability.sql`.

1. Revisar el SQL con el responsable de la base de datos.
2. Aplicarlo mediante el flujo de migraciones aprobado del proyecto Supabase (no pegar secretos en issues, PRs o logs).
3. Confirmar que existen las cinco tablas `atlas_users`, `atlas_protocols`, `atlas_ledger`, `atlas_xr_events` y `atlas_webrtc_signals`.
4. Verificar RLS habilitado y ausencia de permisos directos para `anon` y `authenticated`; el adaptador de servidor usa `SUPABASE_SERVICE_ROLE_KEY`.
5. Validar `GET /api/v1/readyz` y confirmar que la evidencia informa éxito real del probe de solo lectura.

**No resuelto por la migración:** que el valor de las variables de entorno sea válido, que el esquema existente sea compatible o que las operaciones funcionales cumplan aislamiento multi-tenant. La migración no se ha aplicado a la base remota desde este cambio.

### 2. Activar el BookPI compartido del pipeline

El código de esta rama conecta `POST /api/v1/pipeline/execute` al puerto `createRuntimeBookPiStorage`. Selecciona PostgreSQL automáticamente con `DATABASE_URL`, `POSTGRES_URL` o `POSTGRES_URL_NON_POOLING`; también se puede indicar `BOOKPI_PIPELINE_STORAGE=postgres`.

1. Aplicar las dos migraciones de BookPI a la base PostgreSQL de la aplicación.
2. Configurar `DATABASE_URL`, `POSTGRES_URL` o `POSTGRES_URL_NON_POOLING` con TLS y privilegios mínimos; nunca incluir el valor en logs, issues ni README.
3. Configurar `BOOKPI_INTEGRITY_SECRET` como secreto de al menos 32 caracteres, generado de forma segura y gestionado en el entorno servidor. No reutilizar una clave sin verificar la procedencia/integridad de los eventos existentes.
4. Confirmar que la tabla `bookpi_events` existe y que el actor de pipeline `human:pipeline-session` puede leer/escribir bajo RLS.
5. Ejecutar `pnpm run postgres:e2e` contra una base de pruebas desechable y comprobar cadena, inserción concurrente y reinicio.
6. Confirmar que el probe de `pipeline-bookpi-storage` indica `POSTGRES`, cadena válida y recuento observado.

**Límite actual:** esto vuelve durable el ledger del conductor del pipeline, no sustituye todavía el singleton síncrono `bookPiLedger` utilizado por las rutas heredadas (YUN, HyperCore y otras). Ese singleton permanece degradado hasta una migración coordinada de su API síncrona o hasta que esas rutas se trasladen explícitamente al puerto asíncrono. No declarar que todo BookPI es compartido sólo porque el pipeline use PostgreSQL.

### 3. Hidratar y persistir IKES

El código de esta rama incorpora `SupabaseIkesPersistence` y conecta el motor al arranque del runtime. Las fuentes y claims se escriben en tablas separadas; la hidratación valida hashes y referencias y no eleva estados epistémicos automáticamente.

1. Aplicar `supabase/migrations/20261017000001_ikes-memory.sql`.
2. Confirmar acceso server-only mediante `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY`; nunca exponer la clave al cliente.
3. Esperar a que el runtime complete hidratación antes de consultar o mutar IKES.
4. Probar alta de fuente, persistencia de claim admitido, reinicio del proceso y recuperación de los mismos hashes/estados.
5. Confirmar que un error de escritura devuelve fallo y mantiene degradado el probe; no tratar una mutación en memoria como éxito durable.

**Límite actual:** la cola serializa las escrituras, pero no reemplaza una transacción única entre fuentes y claims. El estado epistemológico sigue sujeto al flujo gobernado; almacenar un claim no es evidencia independiente de su veracidad.

### 4. Sustituir BookPI volátil en producción

- No configurar un archivo local o `/tmp` como si fuera almacenamiento durable de Vercel/serverless.
- `createPostgresStorage` ya existe como adaptador asíncrono, pero el singleton `bookPiLedger` usado por rutas sigue siendo síncrono y selecciona memoria/JSONL local.
- Implementar y probar un adaptador durable integrado a los consumidores reales, con migración, concurrencia transaccional, verificación de cadena, backup/restore y control de acceso.
- No declarar WORM: el adaptador Postgres por sí solo no proporciona almacenamiento WORM ni inmutabilidad física.

### 5. Validar inferencia real sin violar privacidad

- La inferencia externa keyless queda desactivada por defecto.
- Para habilitar un proveedor externo, el operador debe configurar expresamente `ISABELLA_KEYLESS_FREE_PROVIDER=pollinations` o un proveedor con credenciales, tras revisar tratamiento de datos, límites, disponibilidad y condiciones.
- No enviar información confidencial a proveedores gratuitos sin aprobación explícita.
- Ejecutar el smoke test del gateway y registrar proveedor/modelo efectivo, latencia, fallback y errores sin registrar prompts o secretos.

### 6. Instrumentar observabilidad

- Configurar `OTEL_EXPORTER_OTLP_ENDPOINT` y credenciales de exportación cuando corresponda.
- Añadir una comprobación de exportación real y acotada, no sólo de presencia de variable.
- Verificar correlación trace/request, retención, acceso, alertas y ausencia de PII en logs.

### 7. Verificar el gateway Rust IGE-Ω

- El runtime Node dispone de un probe acotado mediante `IGE_OMEGA_GATEWAY_URL`; comprueba `GET /health` y `GET /ready` con timeout limitado, valida el contrato JSON y no envía tokens ni contenido del usuario.
- En producción, configurar una URL HTTPS del gateway ya desplegado. No incluir usuario/contraseña, query strings ni fragmentos en la URL.
- `GET /api/v1/integrations/graph` reportará `HEALTHY`, `DEGRADED` o `NOT_CONFIGURED` según la prueba observada. El probe sólo confirma salud/readiness y conectividad a base de datos; **no** demuestra que la inferencia autenticada desde Node esté conectada.
- La integración de inferencia autenticada requiere un diseño separado de identidad/tenant, gestión del token de servicio, autorización y pruebas de aislamiento; no reutilizar un token de un usuario para todos los clientes.

### 7. Cerrar CI/CD y producción

- Esperar CI verde en el SHA candidato, incluidos typecheck, tests, build, auditoría Rust, Trivy, SBOM y artefactos de seguridad.
- Confirmar que el workflow de liberación descarga evidencia del mismo SHA y rechaza runs que no sean un push exitoso a `main`.
- El workflow actual valida evidencia y llega a un handoff; no prueba por sí mismo una promoción real a producción. Confirmar el mecanismo real de despliegue, health check post-deploy, rollback y aprobación del entorno.
- Habilitar reglas de protección de `main`: PR obligatorio, checks requeridos, resolución de conversaciones y restricción de force-push/deleción.
- No elevar el porcentaje de preparación hasta comprobar despliegue, persistencia y recuperación reales.

## Criterios mínimos de cierre

- [ ] CI verde en el SHA candidato y checks obligatorios configurados en `main`.
- [ ] Preview más reciente en estado READY y smoke HTTP exitoso.
- [ ] `/api/v1/readyz` devuelve 200 sólo con todas las dependencias requeridas verificadas.
- [ ] El pipeline usa PostgreSQL compartido y pasa E2E; backup/restore y verificación de cadena aprobados.
- [ ] Las rutas heredadas de BookPI dejan de usar el singleton volátil o están explícitamente bloqueadas en producción.
- [ ] IKES recupera fuentes/claims tras reinicio y conserva hashes/versiones; migración aplicada y probe saludable.
- [ ] Proveedor de inferencia configurado por decisión explícita y smoke generativo aprobado.
- [ ] Telemetría exportada y alertas probadas.
- [ ] Despliegue de producción y rollback demostrados sobre un SHA trazable.

**Regla de evidencia:** una migración en Git no equivale a una migración aplicada; un endpoint local 200 no demuestra salud de dependencias; un preview READY no equivale a producción desplegada.
