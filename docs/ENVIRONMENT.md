# Configuración de entorno de Isabella GenesisAI

Este archivo documenta nombres de variables, no valores. Nunca se deben almacenar secretos reales en Git, documentación, registros, respuestas HTTP o bundles del cliente.

## API privilegiada

- `HSF_API_TOKEN`: obligatorio para `POST /api/v1/hsf/invoke`. El endpoint responde `503 API_TOKEN_NOT_CONFIGURED` si falta o no alcanza la longitud mínima y `401 UNAUTHORIZED` si el bearer token no coincide.
- `GENESIS_ADMIN_API_TOKEN`: obligatorio para `POST /api/v1/memory/ingest` y `POST /api/v1/knowledge/admit`. Protege la admisión que muta la memoria del runtime. Usa un valor aleatorio de al menos 32 caracteres, distinto del token HSF.

Formato esperado del encabezado:

```http
Authorization: Bearer <token>
```

Los tokens de servicio son un límite de servicio, no sustituyen una integración completa con proveedor de identidad, tokens de corta duración, RBAC/ABAC por usuario, rate limiting ni auditoría durable. Antes de exponer las rutas a usuarios finales, integra esos controles.

## Persistencia Atlas opcional

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`: solo en servidor; nunca debe llegar al cliente.
- `ATLAS_STORE_TIMEOUT_MS`: timeout de conexión, si el adaptador lo admite.

Usa proyectos separados por entorno, mínimo privilegio, migraciones revisadas y pruebas de RLS. Sin esquema y políticas verificados, el sistema no debe presentar datos de producción.

## Inventario Atlas en GitHub (opcional)

- `GITHUB_OWNER`
- `ATLAS_READ_TOKEN`: token de lectura opcional para inventario de repositorios privados autorizados.
- `INCLUDE_FORKS`: por defecto `false`.
- `MAX_REPOS`: por defecto `500`.

Usa el mínimo de permisos de repositorio necesarios. El `GITHUB_TOKEN` del workflow es para escritura en el repositorio actual; no reutilices un token personal amplio para publicar.

## Puente cuántico opcional

- `PENNYLANE_BRIDGE_ENDPOINT`
- `PENNYLANE_BRIDGE_TIMEOUT_MS`: por defecto 5000 ms en el puente TypeScript.

Una URL configurada no demuestra que el proveedor esté sano ni que exista un QPU conectado. Sin endpoint o backend válido, la ejecución debe permanecer como no configurada/no disponible.

## Modelos, firma y auditoría

Variables que usan módulos existentes según configuración:

- `GEMINI_API_KEY`
- `MODEL_API_KEY`
- `INFERENCE_API_KEY`
- `ISABELLA_APPROVAL_KEY_ID`: identificador de la clave de firma.
- `ISABELLA_APPROVAL_TRUSTED_APPROVER_ID`: principal humano autenticado exacto vinculado a la clave de firma confiable.
- `ISABELLA_APPROVAL_TRUSTED_KEY_ID`: key ID aceptado por el verificador; debe coincidir con la clave pública aprobada.
- `ISABELLA_APPROVAL_TRUSTED_PUBLIC_KEY_PEM`: clave pública Ed25519 aprovisionada por separado para verificar aprobaciones. La clave pública embebida en una aprobación no es un ancla de confianza.
- `ISABELLA_APPROVAL_PRIVATE_KEY_PEM`
- `BOOKPI_INTEGRITY_SECRET`

Verifica el uso real de cada variable en el código antes de asumir que el módulo está activo. No expongas claves en telemetría, mensajes de error, archivos de configuración versionados o respuestas HTTP.

## Criterios de habilitación

- [ ] Los secretos existen en el gestor de secretos del entorno.
- [ ] La ausencia de secretos deshabilita la integración de forma segura.
- [ ] Las credenciales son independientes entre desarrollo, staging y producción.
- [ ] Se probaron tokens incorrectos, rutas sin autenticación y roles no autorizados.
- [ ] No hay secretos en Git, logs, trazas ni bundles.
- [ ] La CI pasa para el SHA exacto que se va a desplegar.
- [ ] La integridad BookPI y la criptografía poscuántica solo se anuncian como activas después de ejecutar sus verificadores reales.
