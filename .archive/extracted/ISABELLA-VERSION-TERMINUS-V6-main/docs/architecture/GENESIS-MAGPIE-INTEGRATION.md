# Integración evolutiva: Isabella Genesis + MAGPIE-X

## Estado y alcance

Este documento convierte los archivos de arquitectura entregados en una hoja de ruta de implementación para el repositorio. La arquitectura descrita en las fuentes es una meta de diseño, no evidencia de que vLLM, PyTorch, Triton, cuantización INT4/FP8, firmas PQC, persistencia WORM o siete federaciones estén activas en producción.

Invariante: CAPABILITY ≠ AUTHORITY ≠ EXECUTION ≠ EVIDENCE ≠ LEARNING ≠ PRODUCTION.

## Componentes y responsabilidades

- ISA-X / frontera de identidad: autenticación, identidad de servicio, scopes, nonce/TTL, firma de solicitudes y canonicalización. Los secretos deben proceder de un gestor de secretos; no deben incrustarse en código, documentación ejecutable ni frontend.
- CROWN: punto de decisión y punto de aplicación de políticas (PDP/PEP), separación de autorización y ejecución, quórum cuando la política lo requiera, delegaciones con vencimiento y revocación auditable.
- BookPI: evidencia append-only, verificación de cadena, hashes y eventos de auditoría. El hash no equivale a una firma y una cadena local en memoria no equivale a almacenamiento WORM duradero.
- IKES / memoria: distinguir caché o memoria de proceso de persistencia durable; los estados de salud deben venir de probes reales de lectura/escritura.
- MAGPIE-X: tejido federado con identidad, contexto, evaluación de riesgo, límites, auditoría y anclaje. Los fallos de anclaje deben generar cola durable, reintentos, alertas y estado explícito; la política determina cuándo se aplica fail-closed.
- IGE / motor cognitivo: router de 12 cabezas, 24 expertos por familias, traza por chunk, guardianes/NCUA, verificación y métricas.
- Trinidad vLLM: Draft, Verify y gestión de KV cache son adaptadores de inferencia separados. No declarar que comparten VRAM o cache hasta demostrarlo en hardware real.

## Implementación incorporada en esta rama

### 1. Readiness operativo fail-closed

src/deployment/production-ops.ts ya no considera un conjunto vacío de dependencias como saludable. Las dependencias obligatorias en estado degraded generan bloqueadores, y nombres duplicados o inválidos no pueden producir un estado listo.

GET /api/v1/readyz y GET /api/v1/ops/snapshot dejan de declarar bookpi-ledger, ikes-memory y observabilidad como saludables sin prueba. La respuesta expone evidencia y devuelve HTTP 503 mientras no existan probes reales. Se añadió un probe de solo lectura y con timeout máximo de 2 segundos para Atlas/Supabase, que comprueba la consulta de la tabla atlas_users; el probe no escribe datos. BookPI e IKES siguen degradados porque no tienen probes de persistencia durable conectados. GET /health es únicamente liveness del proceso y no demuestra que el sistema esté listo.

Limitación deliberada: esta iteración no finge conectividad. Los adapters de probe para base de datos, BookPI durable, modelo, telemetría y memoria deben conectarse y probarse antes de poder marcar dependencias como healthy.

### 2. Contrato de routing IGE

src/cognition/genesis-moe.ts implementa un postprocesador determinista para puntuaciones producidas por un futuro adaptador de inferencia:
- valida exactamente 12 puntuaciones de cabezas y 24 de expertos;
- selecciona cabezas y Top-K expertos (K entre 2 y 4);
- normaliza los pesos seleccionados con softmax estable;
- asigna familias: expertos 0–5 temáticos, 6–11 funcionales, 12–17 éticos y 18–23 metacognitivos;
- rechaza valores no finitos, vectores incorrectos y parámetros fuera de rango;
- resuelve empates por índice para reproducibilidad.

Esto es un contrato de routing ejecutable, no un modelo neuronal, entrenamiento, embedding ni integración vLLM. El módulo de chunks agrega integridad local verificable, pero todavía no conecta esa evidencia a un BookPI durable ni a una firma CROWN. Las puntuaciones deben proceder de un modelo o adapter real; el módulo no inventa una inferencia.

### 3. Integridad de chunks y Unicode

src/cognition/genesis-chunk.ts añade un contrato de chunk versionado con trazas de routing y arbitraje ético, canonicalización de JSON específica de la aplicación y digest SHA-256 que incluye el enlace al chunk anterior. La verificación detecta mutaciones del chunk; no verifica una firma, no demuestra autoría y no persiste el ledger. La canonicalización incluida no se declara conforme a RFC 8785.

El módulo rechaza sustitutos Unicode aislados, valores no serializables/no finitos, propiedades accesoras y propiedades propias no enumerables; los getters no se ejecutan durante la canonicalización. Esto reduce ambigüedad y evita efectos laterales al producir el digest. No normaliza silenciosamente el texto a NFC, porque esa transformación debe definirse en el contrato de entrada y aplicarse antes de firmar o calcular evidencia. Se añadieron pruebas para caracteres españoles, emoji, marcas combinantes, manipulación posterior al digest y enlace entre chunks.

### 4. Unicode y texto de entrada

ISABELLAUNICODE.txt se conserva como material de referencia separado. Su contenido visible incluye pares de puntos/códigos de caracteres y material de configuración empaquetada, pero no aporta por sí solo un contrato de normalización de texto ni una licencia/procedencia verificable. No debe importarse como tabla de codificación de producción sin identificar formato, origen, versión y pruebas de ida/vuelta.

La política de texto propuesta para fronteras API es UTF-8 explícito, rechazo o sustitución documentada de secuencias inválidas, normalización Unicode definida por contrato (por ejemplo NFC cuando sea semánticamente adecuada) y pruebas para acentos, ñ, símbolos, caracteres combinados y entradas malformadas. No normalizar identificadores, firmas o bytes canónicos de forma implícita: la canonicalización criptográfica debe ser una operación versionada separada.

## Plano de ejecución y evidencia

1. Fast path: validar esquema, identidad, scopes, límites y política; enrutar y producir salida preliminar cuando la política lo permita.
2. Verificación: ejecutar guardianes, redacción, validación epistemológica y verificaciones de seguridad en paralelo cuando sea seguro.
3. Consenso: convocar expertos/quórum solo para operaciones o respuestas cuyo riesgo lo exija; registrar desacuerdos en lugar de ocultarlos.
4. Persistencia y gobernanza: escribir eventos de routing, arbitraje y commit en BookPI; marcar estado de persistencia y anclaje. No confundir envío en cola con persistencia confirmada.

Cada chunk gobernado debería incluir request/session ID, secuencia, ruta de expertos, guardianes invocados, flags, hash del chunk, hash anterior, latencia y estado de commit. El hash sirve para detectar alteraciones; la autoría exige firma verificada.

## Plan de evolución por fases

- Fase 0 — contratos y pruebas: esquemas versionados, límites de confianza, fixtures, canonicalización y pruebas negativas. Parte del routing determinista se implementa en esta rama.
- Fase 1 — prototipo CPU: adapter de embeddings/modelo, 4–6 expertos de prueba, métricas de routing, validación de carga y evaluación de calidad. Sin alegar 24 expertos reales si no existen pesos/adapters.
- Fase 2 — inferencia GPU: evaluar PyTorch/vLLM, KV cache y speculative decoding sobre hardware definido; medir latencia p50/p95, tokens/s, memoria, tasa de aceptación y calidad. La meta de primer chunk <80 ms solo se publica si un benchmark reproducible la confirma.
- Fase 3 — optimización: INT4/FP8, pruning y destilación con datasets/versiones, evaluación de regresiones y rollback. No aplicar aprendizaje online a producción sin revisión y controles.
- Fase 4 — federación y persistencia: probes reales, identidad de servicio, scopes, revocación, quorum CROWN, BookPI durable/WORM, cola de anclaje y recuperación probada.
- Fase 5 — producción: gates de CI, SBOM, escaneo de dependencias, pruebas de seguridad, SLOs, runbooks y evidencia de despliegue.

## Gates de aceptación

- Ninguna dependencia requerida se considera sana por configuración solamente.
- Un error de esquema, autorización, firma, integridad o estado de persistencia se rechaza o se marca explícitamente.
- Los tests de routing prueban límites, empates, puntuaciones no finitas y normalización.
- Las métricas publicadas proceden de ejecuciones reproducibles; las metas de diseño no se presentan como resultados.
- La evolución del modelo y la actualización de políticas requieren versiones, evidencia, evaluación y rollback.
- Antes de fusionar, deben pasar typecheck, tests y build en CI; un PR con workflows fallidos permanece sin fusionar.

## Próximos bloqueadores técnicos

1. Generar y versionar el lockfile correcto con la versión aprobada de pnpm y fijar packageManager en package.json; mantener --frozen-lockfile.
2. Completar probes con timeout para memoria IKES, modelo y telemetría; el probe Atlas/Supabase existe, pero su ejecución en el entorno de despliegue aún debe verificarse en CI/producción.
3. Reconciliar BookPI de proceso con un adaptador durable y verificación de cadena; añadir pruebas de recuperación.
4. Conectar puntuaciones reales del router a un adapter de inferencia; el postprocesador actual no reemplaza el modelo.
5. Revisar procedencia y licencia de componentes antes de portar código desde otros repositorios del perfil.
