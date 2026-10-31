# BookPI-X — auditoría criptográfica

## Garantía del MVP
Cada evento conserva IDs de evento/traza, hashes de mundo/expertos/razonamiento/resultado, hash anterior y SHA-256 propio. El escritor abre transacción PostgreSQL, toma un advisory lock global, lee la cabeza por secuencia, enlaza el evento, inserta y confirma. La verificación recalcula todos los hashes y comprueba la continuidad.

La cadena detecta alteraciones si existe una cabeza confiable independiente. No es una firma digital, no repudio, almacenamiento WORM ni defensa contra un administrador capaz de reescribir toda la tabla y recalcular la cadena. No debe describirse como inmutable por sí sola.

## Canonización
El MVP calcula SHA-256 sobre JSON serializado de una estructura Rust de campos ordenados, vaciando `event_hash`. Esto sirve dentro de esta implementación, pero aún no es un estándar interoperable multi-lenguaje. Antes de usarlo como contrato externo debe versionarse el esquema y adoptar RFC 8785/JCS o CBOR determinista, con reglas para floats, Unicode y fechas.

## Fallos y escalado
Si falla el ledger, la inferencia no se devuelve como éxito. La verificación completa es O(n), por lo que no debe ejecutarse por cada solicitud. Próximas fases: checkpoints firmados Ed25519/KMS, anclaje independiente, almacenamiento Object Lock/WORM, retención y privacidad, pruebas concurrentes/de manipulación y separación de roles. No registrar prompts ni secretos completos si un identificador/hash es suficiente.


## Atomicidad de eventos de dominio

Las decisiones ABX, las altas/bajas de memoria y las mutaciones del World Model ejecutadas por el gateway insertan su fila de dominio y el evento BookPI-X dentro de la misma transacción PostgreSQL. El append adquiere un advisory transaction lock antes de leer la cabeza, calcula `previous_hash` y `event_hash`, y sólo se confirma junto con el cambio de dominio. La verificación recorre el ledger en streaming para mantener memoria de proceso acotada, aunque su tiempo total sigue siendo O(n).

El trigger de la migración `0005` bloquea UPDATE/DELETE ordinarios sobre el ledger. No protege contra un propietario/superusuario capaz de alterar permisos o deshabilitar triggers. La cadena necesita anclaje externo de su cabeza para detectar reescrituras coordinadas de la base completa; no se afirma WORM, firma digital ni no repudio.
