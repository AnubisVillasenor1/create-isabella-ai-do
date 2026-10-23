# Auditoría global del perfil GitHub y selección del plano canónico de Isabella

**Fecha:** 12 de octubre de 2026  
**Perfil consultado:** https://github.com/OsoPanda1  
**Destino autorizado:** https://github.com/OsoPanda1/ISABELLA-VERSION-TERMINUS-V6  
**Alcance:** inventario visible, búsquedas temáticas y revisión dirigida del árbol y contratos del repositorio destino. No afirma que se hayan leído todas las líneas de todos los repositorios ni constituye certificación externa.

## Dictamen ejecutivo

El perfil contiene varias generaciones y superficies con nombres relacionados con Isabella, Genesis/TINA, CROWN, TAMV/Atlas, RDM Digital y LITLE/Open Science. La amplitud puede conservar investigación, pero aumenta el riesgo de divergencia en APIs, dependencias, licencias, README, cifras de madurez, flujos de CI y límites de seguridad. La implementación de esta tarea se realiza en el destino autorizado; los demás repositorios son referencias para una comparación posterior, no superficies que se actualicen implícitamente.

### Familias observadas

- **Isabella / Genesis / TINA:** Isabella-V6-TINA, ISABELLA-VERSION-TERMINUS-V6, isabella-ai-tina, isabella-s-crown, isabella-s-core, isabella-villasenor-ai, isabella-sovereign-ai, isabella-ai-genesis-yj y repositorios relacionados.
- **TAMV / Atlas / federación:** tamv-atlas, tamv-orchestrator, tamv-core-atlas, tamv-atlas-nextgen, tamv-nexus, ecosistema-tamv, federacion-tamv y quantum-system-tamv.
- **RDM Digital / territorio:** RDM-DIGITAL, RDM-DIGITAL2026, rdm-digital-hub, rdm-digital-os, rdm-live-web y otras superficies territoriales.
- **LITLE / Open Science:** litle-trust-fabric, litle-verified-trust, litle-verified-seal, LITLE-VERSION-1.0 y litle-atlas-suite.

Los nombres y descripciones del perfil sirven para inventariar candidatos, pero no prueban que el código se compile, que comparta APIs compatibles ni que sea seguro fusionarlo. Antes de copiar código deben compararse repositorio fuente, commit, dependencias, licencia, procedencia, tests, migraciones, tratamiento de secretos y modelo de amenazas.

## Hallazgos técnicos críticos en el destino

1. **Identidad de CI/README.** El README anterior enlazaba badges a Isabella-V6-TINA-h6, no al destino autorizado. Un estado verde de un repositorio distinto puede inducir a error sobre la validación del destino. Los badges se actualizaron para apuntar al repositorio correcto.
2. **BookPI PostgreSQL.** El adaptador declara trece columnas de inserción, incluida la columna canonical, pero la sentencia tenía doce placeholders. Esto impide insertar el registro completo en el esquema que exige canonical. La sentencia se corrigió y se añade un test de contrato de trece parámetros.
3. **Checkpoint y secuencia de BookPI.** La poda del ledger deja un checkpoint del prefijo archivado. La siguiente inserción debe seguir el hash del checkpoint y conservar la secuencia global; de lo contrario, una poda puede provocar discontinuidad de secuencia o reinicio de la cadena. Se endurecen el append, la verificación de secuencias, el plan de poda y el backup/restore del checkpoint.
4. **Inmutabilidad real.** El ledger JSONL encadenado no es WORM. La cadena ayuda a detectar modificaciones, pero no impide por sí sola que un administrador cambie todas las copias pertinentes. Se necesitan roles restrictivos, backups verificados y, para evidencia fuerte, anclaje externo.
5. **Retención del payload frente al ledger.** La depuración de objetos y shards es una política distinta de la retención de eventos BookPI. Los eventos de intención, resultado y fallo se conservan; un error de escritura de intención bloquea la eliminación del payload. Retener información personal o sensible debe respetar legal hold, consentimiento, expiración y política aplicable.
6. **Redundancia 6+3.** Terminus aplica cifrado autenticado antes de Reed–Solomon. Se requieren seis shards válidos de un conjunto de nueve para reconstrucción. Esta codificación tolera hasta tres shards perdidos/dañados, pero añade almacenamiento y metadatos; no crea capacidad física gratuita.
7. **Nueve dominios independientes.** Nueve identificadores de adaptador no demuestran nueve dominios de fallo. Nueve aliases en un mismo volumen, cuenta o proveedor aún comparten riesgo. La liberación requiere adaptadores reales, identidades separadas, cuotas verificadas y prueba de pérdida de shard/provider.
8. **Cuotas de planes gratuitos.** Un límite local configurado no refleja la cuota real ni sus cambios en un proveedor externo. Los adaptadores deben comprobar y reservar capacidad atómicamente, o rechazar la operación si no conocen la cuota vigente.
9. **Borrado criptográfico.** La destrucción de clave sólo constituye borrado criptográfico efectivo si el KMS real elimina de modo duradero todas las copias recuperables. No demuestra la eliminación física de copias gestionadas por proveedores, backups, réplicas o cachés.
10. **Separación de autoridad y ejecución.** Terminus debe permanecer como gate: verificar identidad, evidencia, límites, separación de actores y presupuesto durable y registrar la decisión en BookPI antes de devolver ALLOW. La autorización por sí sola no ejecuta la acción.
11. **Rendimiento.** El código local de hashes, codificación y routing no permite inferir latencia de producción. Hace falta medir percentiles bajo carga, con red, proveedores, cold starts, almacenamiento real y concurrencia.
12. **Licencias y procedencia.** Una marca común no convierte las licencias en compatibles. El código procedente de repositorios auxiliares requiere revisión de LICENSE, dependencia, origen y atribución por componente.

13. **Durabilidad de archivos BookPI.** Las escrituras usan `fsync`, los archivos se sustituyen de forma atómica y la poda/restauración mantiene un marcador durable de mantenimiento. Si el marcador persiste tras un fallo, el runtime se bloquea hasta reconciliar el ledger, el archivo y el checkpoint; no intenta adivinar qué mitad de la operación fue confirmada.

## Diseño de Terminus incorporado al destino

- **src/terminus/erasure-code.ts:** codificador Reed–Solomon 6+3 y decodificador de cualquier combinación válida de seis shards.
- **src/terminus/sharded-store.ts:** coordinación de cifrado AES-256-GCM, escritura create-only mediante adaptadores con cuotas, lectura con validación de tenant/integridad, borrado y registro BookPI.
- **src/terminus/mandate.ts:** mandato versionado, política de capacidades/operaciones, vector de riesgo, evidencia, vencimiento, presupuestos y separación de roles. El runtime exige verificadores de identidad/evidencia y contador de ejecución externos.
- **src/terminus/retention.ts:** política de retención acotada, protecciones legal-hold/pinned/in-use, gate de capacidad y eventos BookPI de intención/resultado.
- **test/terminus/:** pruebas de codificación, autorización y retención.
- **test/bookpi/storage-postgres.test.ts:** comprobación de los trece parámetros de inserción.
- **DurableBookPiLedger:** continuidad de checkpoint y secuencia, backup/restauración conjunta del archivo y su checkpoint, y validación del plan de poda contra los eventos actuales.

Estos contratos y pruebas no equivalen a nueve proveedores reales ni a un KMS ya provisionado. Las implementaciones de proveedor siguen siendo una fase de integración y deben verificarse con pruebas E2E.

## Interfaz de producto y accesibilidad

La UI anterior presentaba una introducción cinemática obligatoria antes de permitir acceder al espacio de trabajo, dependía de una imagen alojada en un blob externo y repetía el ID HTML `protocols` en dos secciones. Estos detalles producían una primera interacción lenta, un recurso visual fuera del control del repositorio y navegación/ARIA ambigua.

La actualización visual adopta un sistema Obsidian / Platino / Azul Eléctrico con menor ruido, jerarquía tipográfica más legible, superficies de contraste controlado, estados de foco visibles, disposición responsive y respeto por `prefers-reduced-motion`. El espacio de trabajo abre de inmediato; la secuencia de marca sigue disponible de forma explícita con `?intro=1`. Se añade acción accesible de copiar respuesta, se retira el fondo externo y se elimina el ID duplicado. El smoke de UI ahora exige unicidad de IDs y ausencia del asset remoto.

## Estado operativo y ámbito real de BookPI

El endpoint de estado ahora declara si BookPI usa la cadena volátil de memoria o el archivo JSONL local con `fsync`; no eleva ese segundo caso a almacenamiento compartido, alta disponibilidad ni WORM. `/api/v1/readyz` mantiene el control fail-closed: una dependencia crítica degradada conserva HTTP 503 y devuelve evidencia explícita en vez de convertir la presencia de configuración en una afirmación de salud.

## Control de admisión concurrente

El coordinador de almacenamiento ahora exige un gate de admisión tenant-scoped. Si una escritura excede los límites de la política o existen candidatos de retención, ejecuta únicamente la pasada que registra la intención y el resultado en BookPI; después, vuelve a consultar el estado. La escritura sólo continúa si el repositorio implementa una reserva de capacidad atómica y durable. El contrato no se considera una integración concluida hasta conectar y probar un repositorio transaccional que reserve bytes/objetos concurrentes, recupere reservas huérfanas y reconcilie el manifiesto después de un fallo.

## Recomendaciones organizacionales para el perfil

1. Cada repo debe declarar su rol: canónico, librería interoperable, implementación federada, prototipo, especificación o legado.
2. Mantener un registro de APIs/esquemas versionados, commit fuente, licencia, propietario y evidencia de pruebas.
3. Los badges de CI deben referir al workflow del mismo repositorio que presentan.
4. Exigir pull requests, suites de pruebas, control de secretos y gates de release. No elevar madurez sólo por contar archivos o pruebas escritas.
5. Separar credenciales, tenants, datos personales y permisos entre Isabella, TAMV, RDM y LITLE.
6. Hacer un análisis de licencia antes de fusionar código de repositorios del perfil.
7. Acordar y probar RTO/RPO, restauración, cuotas y política de retención antes de admitir ingestión masiva.
8. Distinguir en la documentación código existente, tests escritos, tests ejecutados, integración real, despliegue y certificación.

## Referencias consultadas

- Repositorio destino: https://github.com/OsoPanda1/ISABELLA-VERSION-TERMINUS-V6
- Perfil: https://github.com/OsoPanda1
- Isabella V6 TINA: https://github.com/OsoPanda1/Isabella-V6-TINA
- CROWN: https://github.com/OsoPanda1/isabella-s-crown
- TAMV Atlas: https://github.com/OsoPanda1/tamv-atlas
- TAMV Orchestrator: https://github.com/OsoPanda1/tamv-orchestrator
- LITLE Trust Fabric: https://github.com/OsoPanda1/litle-trust-fabric
- RDM Digital Hub: https://github.com/OsoPanda1/rdm-digital-hub

Las referencias guían auditorías posteriores; no se afirman como módulos fusionados o integrados con el destino.
