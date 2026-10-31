# Almacenes durables en Vercel: claves de API y federación

> `state: draft | engine-generated` — revisión humana pendiente (invariante operativo de AGENTS.md).

## 1. Qué resuelve

En serverless el sistema de archivos es efímero y la memoria del proceso muere en cada
*cold start*. Sin un backend durable, `IsabellaApiKeyStore` y `FederationRegistry` perdían
claves, conectores y bandeja de entrada entre instancias. La solución deja el camino
caliente **con la misma semántica**:

- **Lectura síncrona.** `verify()`, `listConnectors()`, `getConnector()` y
  `hasRemoteMessage()` siguen siendo síncronos: nunca hacen `await` ni tocan la red.
- **Hidratación una sola vez.** `hydrate()` lee las filas al construir el almacén
  (una vez por instancia, memoizada y sin propagar rechazos).
- **Escritura por fila.** `issue`, `rotate`, `revoke`, `createConnector`,
  `removeConnector` e `ingest` ahora devuelven `Promise` y escriben **solo la fila
  afectada** (INSERT/UPDATE/DELETE parametrizado); ya no se reescribe toda la colección.
  Si la escritura falla, el estado en memoria se revierte y la operación falla: nunca se
  entrega un secreto cuya fila no quedó persistida.
- **Fallo cerrado al comportamiento anterior.** Si no hay una URL utilizable o la base no
  responde, el adaptador se abandona con `console.warn` y el almacén queda
  *process-local* (`degradationReason` lo documenta). Ningún módulo lanza en el arranque.

## 2. Invariantes de seguridad que no cambian

- Solo se persiste el **digest** (HMAC-SHA256 con `ISABELLA_API_KEY_PEPPER`, o SHA-256 sin
  pepper). El secreto `isa_live_...` se muestra una sola vez y jamás llega a la base.
- `timingSafeEqual` sigue comparando los digests; `MAX_KEYS` y `MAX_INBOX` se conservan.
- La validación de scopes es doble: el adaptador descarta filas con scope desconocido o
  digest de longitud inválida, y la migración lo refuerza con `CHECK`.
- `lastUsedAt` es telemetría: no autentica nada. Se acumula en memoria y se escribe en
  lotes (`UPDATE ... UNNEST`), nunca por verificación.
- El índice único `(connector_id, remote_message_id)` extiende la detección de
  repetición entre instancias; la ruta responde `409 FEDERATION_REPLAY_DETECTED`.
- Las rutas traducen el fallo del backend a un código fijo con `503`: nunca devuelven
  el texto del controlador (host, puerto, SQL) al cliente.

## 3. Variables de entorno (Vercel)

**Nunca** se escriben valores en el repositorio ni en `vercel.json`. Se agregan con la CLI,
que pide el valor de forma interactiva:

```bash
vercel env add ISABELLA_API_KEY_STORE production
vercel env add ISABELLA_FEDERATION_STORE production
vercel env add DATABASE_URL production      # secreto: el valor se pega en el prompt
vercel env add ISABELLA_API_KEY_PEPPER production
vercel env add BOOKPI_INTEGRITY_SECRET production
```

| Variable | Valores | Nota |
|---|---|---|
| `ISABELLA_API_KEY_STORE` | `postgres`, `postgresql`, `neon` | Sin URL utilizable el almacén degrada a memoria, con aviso. |
| `ISABELLA_FEDERATION_STORE` | `postgres`, `postgresql`, `neon` | Mismo criterio de degradación. |
| `DATABASE_URL` / `POSTGRES_URL` | `postgres://` o `postgresql://` | Precedencia: `DATABASE_URL`, `POSTGRES_URL`, `POSTGRES_PRISMA_URL`, `POSTGRES_URL_NON_POOLING`. |
| `ISABELLA_API_KEY_PEPPER` | cadena estable | Debe coincidir en todas las instancias; cambiarlo invalida los digests existentes. |
| `ISABELLA_API_KEY_LAST_USED_FLUSH_ROWS` | entero ≥ 0 | Umbral del lote de telemetría; por omisión 32; `0` deshabilita toda escritura desde `verify()`. |

Al retirar el bloque `env` inerte de `vercel.json`, los valores que declaraba
(`APP_PUBLIC_URL`, `PUBLIC_URL`, `ISABELLA_PUBLIC_URL`, `ALLOWED_ORIGINS`,
`WEBAUTHN_RP_ID`, `WEBAUTHN_ORIGIN`, `ISABELLA_KEYLESS_FREE_PROVIDER`,
`KEYLESS_FREE_PROVIDER_TIMEOUT_MS`, `CHAT_CHAIN_BUDGET_MS`, `ISABELLA_KEYLESS_TTS`,
`ISABELLA_KEYLESS_TTS_MAX_CHARS`, `ISABELLA_API_KEY_STORE`, `ISABELLA_FEDERATION_STORE`)
pasaran a definirse en el proyecto con `vercel env add`. `maxDuration` sube a 300 para
dar margen a la hidratación y a las escrituras por fila.

## 4. Pasos del operador

1. Aprovisionar Postgres (Neon, Supabase o autoalojado) con TLS explícito
   (`?sslmode=require`).
2. Aplicar las dos migraciones nuevas, en este orden:
   `supabase/migrations/20261030000000_isabella_api_keys.sql` y
   `supabase/migrations/20261030000001_isabella_federation.sql`. Habilitan RLS y revocan
   el acceso directo: solo el rol del servidor lee o escribe.
3. Definir las variables de la sección 3 con `vercel env add`.
4. Ejecutar `pnpm deploy:readiness` contra el archivo de ambiente del entorno: una
   selección `postgres` sin URL utilizable bloquea
   (`DR-SERVERLESS-API_KEYS_DB_MISSING`, `DR-SERVERLESS-FEDERATION_DB_MISSING`) y un modo
   no reconocido también bloquea.
5. Desplegar y confirmar `/api/v1/readyz` y el humo de la interfaz.
6. Verificar la durabilidad con una prueba real: emitir una clave, forzar un *cold start*,
   volver a verificarla; luego revocarla y comprobar que la instancia siguiente la rechaza.

## 5. Límites conocidos

- **Revalidación entre instancias.** Una revocación se ve en las demás instancias en su
  próxima hidratación; mientras una instancia siga viva, su copia en memoria puede aceptar
  la clave hasta que sea reemplazada. Para un corte inmediato hace falta un canal de
  invalidación explícito (fuera de alcance aquí).
- **Telemetría eventual.** `lastUsedAt` puede quedar sin escribir si la instancia se
  congela antes de alcanzar el umbral del lote; no afecta la autentificación.
- **Emisión concurrente.** Dos instancias pueden emitir la misma clave en la misma
  milésima; el índice único sobre `digest` hace que la segunda escritura falle y la
  emisión se revierta en memoria.
- **`BOOKPI_INTEGRITY_SECRET` y una `DATABASE_URL` alcanzable siguen siendo requisitos**
  independientes de este cambio: el libro mayor y la durabilidad comparten la base.
- Este documento describe el diseño en este repositorio; no demuestra comportamiento en
  producción. La verificación la hacen CI y la prueba del paso 6.
