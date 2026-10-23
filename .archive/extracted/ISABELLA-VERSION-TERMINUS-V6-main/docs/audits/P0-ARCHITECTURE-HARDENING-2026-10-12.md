# Auditoría P0 de arquitectura, seguridad y latencia — Isabella V6 TINA

**Fecha:** 12 de octubre de 2026  
**Repositorio:** `OsoPanda1/Isabella-V6-TINA-h6`  
**Rama:** `main`  
**Alcance:** CROWN, AEGIS, Tools, Skills, HyperCore, caché single-flight, MoE, Game Over/UAGP, CITEMESH y evidencia de operación.

## Dictamen ejecutivo

La revisión encontró rutas donde un veredicto de revisión podía no impedir la ejecución, una caché de probes podía repoblarse con un resultado anterior tras una invalidación y el motor HyperCore podía consultar caché o ejecutar expertos antes de comprobar la autorización requerida. Se implementaron correcciones y pruebas de regresión para estas fronteras.

**Este documento no certifica producción.** El SHA de runtime TypeScript validado más reciente es `03e6f68ebc3ee5bec39bd42a69c0d704b40aff76`; Vercel registró `READY`, **746 pruebas aprobadas en 135 archivos** y la suite estática de seguridad con **14 passed, 0 failed, 0 not_applicable**. El smoke de inferencia externa se omitió por falta de credenciales elegibles. El estado de GitHub Actions y los gates Rust/durabilidad siguen abiertos. `ige-omega/Cargo.lock` existe en `main`, pero aún no se ha confirmado una ejecución verde de Cargo con `--locked`.

## Hallazgos priorizados

| ID | Prioridad | Hallazgo | Corrección incorporada | Validación |
|---|---|---|---|---|
| P0-01 | P0 | Tools y Skills continuaban si AEGIS devolvía `REVIEW`; sólo `BLOCK` detenía la ejecución. | Ambos registros ahora permiten continuar sólo ante `ALLOW`; `REVIEW` y `MODIFY` son no ejecutables hasta disponer de un flujo explícito de revisión/modificación. | Tests de regresión incluidos en el build validado; 734 pruebas aprobadas. |
| P0-02 | P0 | Entradas cíclicas o no serializables podían fallar durante la serialización antes de una decisión de seguridad. | `inspectAegisValue` devuelve bloqueo ante fallo de serialización; Tools y Skills usan el guard compartido. | Tests con referencias cíclicas incluidos; build validado. |
| P0-03 | P0 | HyperCore podía consultar una respuesta cacheada antes de revalidar una autorización y la bandera explícita `requiresAuthorization: false` podía debilitar la política de una tarea de riesgo alto/crítico. | La autorización se comprueba antes de leer la caché, llamar al predictor o ejecutar expertos. Riesgo alto/crítico siempre exige autorización, incluso si el campo del request es falso. | Tests de riesgo crítico y revalidación de caché incluidos; build validado. |
| P0-04 | P0 | La fábrica de CROWN podía sobrescribir silenciosamente IDs duplicados por construcción de `Map`. | La fábrica registra cada descriptor mediante el camino que rechaza duplicados; el helper de aprobación incluye `humanApprovalRequired`. | Tests de duplicados y coherencia de aprobación incluidos en el build validado. |
| P0-05 | P0 | Un consumidor podía mutar la lista de roles de un descriptor tras registrarlo; el mapa expuesto permitía mutaciones directas. | Se congelan los descriptores/roles y se expone una vista de mapa de sólo lectura; el registro mutable se mantiene en una estructura privada. | Tests de inmutabilidad del descriptor y de la vista de sólo lectura incluidos; build validado. |
| P1-01 | P1 | Una probe iniciada antes de `invalidate()` podía sobrescribir el resultado nuevo cuando terminara. | La caché single-flight usa generaciones; la invalidación invalida el vuelo anterior y sólo la generación vigente puede almacenar resultados. | Test de carrera aprobado en el build validado. |
| P1-02 | P1 | La etiqueta MoE puede inducir a error si se basa en el router léxico. | Se conserva la frontera documentada: `HEURISTIC_LEXICAL` no equivale a MoE soberano con gate/top-k/logits ni pesos entrenados. | Código y contrato revisados; no se declara entrenamiento MoE real sin artefactos/evidencia. |
| P1-03 | P1 | El panel muestra CITEMESH como `E0 NOT FETCHED`. | Se conserva ese estado explícito; no se cambia a “activo/verificado” sin una recuperación de fuente y validación reales. | Pendiente de conectar/fetch de la fuente canónica. |
| P1-04 | P1 | HyperCore contiene un pipeline de predicción/caché/experts/verificación, pero el propio módulo se identifica como draft. | Se reforzó la frontera de autorización sin presentar el módulo como certificado o como autoridad de ejecución. | Pruebas de unidad; falta benchmark end-to-end y validación de proveedor real. |

## Mejoras de latencia y flujo de datos

- La caché single-flight coalesce probes concurrentes y no cachea errores; la invalidación ahora evita que un resultado viejo vuelva a ser vigente.
- HyperCore deniega/escalona solicitudes que requieren autorización antes de consumir presupuesto de expertos o reutilizar resultados cacheados.
- Se conserva la ejecución paralela de expertos dentro del presupuesto temporal y la política fail-closed del verificador.
- No se declara “latencia casi cero”: el benchmark unitario mide operaciones locales (routing, canonicalización, evaluación) y no incluye latencia de red, proveedor de inferencia, cold start ni persistencia remota.
- No se hizo una afirmación de reducción porcentual de latencia sin un benchmark comparable antes/después. El build validado ejecutó 734 tests y 14 controles de seguridad estática; los benchmarks de CPU local no representan latencia de inferencia de extremo a extremo.

## Estado honesto de subsistemas

- **CROWN:** código y tests presentes; la política se está endureciendo. No equivale a una certificación formal.
- **AEGIS:** guard heurístico determinista; puede producir falsos positivos/negativos y no sustituye análisis semántico completo. Ahora los consumidores críticos fail-closed en cualquier veredicto distinto de `ALLOW`.
- **YUN:** los eventos/contratos presentes no demuestran por sí solos una federación distribuida activa.
- **Tools / Skills:** registros ejecutables con fronteras de scope, riesgo y aprobación; no se debe inferir que todas las tarjetas de UI ejecutan integraciones externas reales.
- **MoE:** no confundir router heurístico con modelo MoE entrenado. La disponibilidad de expertos y pesos reales debe comprobarse por artefacto, hash, licencia, versión y evaluación.
- **Hyper Core Turbo:** el código incluye pipeline y controles, pero “Turbo” no es evidencia de aceleración productiva; medir latencia y coste por ruta.
- **Game Over / UAGP:** existen módulos TypeScript y pruebas. El plugin Jenkins debe compilarse/validarse en su propio entorno antes de declararse operativo en Jenkins.
- **CITEMESH:** permanece en estado no recuperado hasta que exista evidencia verificable de fetch.
- **Inferencia externa:** el último estado documentado no tenía credenciales elegibles para demostrar generación real de un proveedor en Preview. Configurar secretos únicamente como variables de entorno del entorno de despliegue; nunca en el chat ni en el frontend.
- **CI:** GitHub Actions había mostrado `startup_failure` sin jobs en runs anteriores. Hace falta una ejecución con jobs y conclusión verde en el SHA final.
- **Persistencia y recuperación:** los adaptadores y contratos no prueban por sí solos durabilidad, recuperación ante caída ni consistencia entre réplicas.

## Estrategia P0 en tres frentes

1. **Seguridad y autoridad:** AEGIS fail-closed; CROWN con política inmutable; autorización de HyperCore antes de caché, predicción y expertos.
2. **Fluidez y latencia:** single-flight invalidable por generación; evitar trabajo cognitivo no autorizado; medir por separado CPU local, red, inferencia y persistencia.
3. **Evidencia y regresión:** pruebas para REVIEW, serialización inválida, roles mutables, IDs duplicados, autorización revocada en cache hit y carrera de invalidación.

## Evidencia de build validado

- Commit de runtime/build: [`03e6f68`](https://github.com/OsoPanda1/Isabella-V6-TINA-h6/commit/03e6f68ebc3ee5bec39bd42a69c0d704b40aff76).
- Deployment Vercel: [READY](https://vercel.com/isabella-mexa/isabella-v6-tina/HAC1kk2Ha1T5ukJNjRXiWjW8RwVq).
- Vitest: 746/746 pruebas; 135/135 archivos.
- UI: `UI_NAVIGATION_SMOKE_OK`, `CINEMATIC_INTRO_12_SCENES_OK`.
- Runtime: `LOCAL_CONVERSATION_SMOKE_OK`, `PUBLIC_API_GUARDRAILS_OK`, `OPENROUTER_PAID_ID_BLOCK_OK`.
- Suite estática de seguridad: 14 passed, 0 failed, 0 not_applicable; `SEC-12` valida el fail-closed de AEGIS en Tools/Skills.
- Inferencia externa: `LLM_GATEWAY_SMOKE_SKIPPED`; no se afirma que el proveedor real esté operativo.

## Seguimiento GAME OVER / UAGP-1 — endurecimiento adicional

Después del SHA de referencia se añadieron controles y pruebas de regresión para el runtime UAGP-1 y el plugin Jenkins:

- Aprobación humana: un nombre escrito en la solicitud ya no basta; el gate exige un principal autenticado coincidente. En HTTP, el token administrativo no equivale a aprobación: se requiere la credencial separada `GENESIS_HUMAN_APPROVAL_TOKEN` junto con `GENESIS_HUMAN_APPROVER_ID`. Si faltan, la decisión queda en `ESCALATE`.
- Política de aprobación: `humanApprovalRequired: false` no puede reducir el requisito derivado del riesgo o de una acción de alto impacto.
- Pasaportes: validación de puntuación y vigencia, prevención de sobrescritura por ID duplicado en TypeScript y validación/registro concurrente seguro en el plugin Java.
- Vínculo de autoridad: el agente y sus capacidades deben estar cubiertos por el pasaporte; una acción no declarada entre sus capacidades se rechaza.
- Confianza: las métricas incluidas en la solicitud no pueden elevar la puntuación por encima de la asignada por el emisor del pasaporte.
- Entradas: criticidad inválida se rechaza por validación y se trata como crítica en el motor de riesgo para impedir downgrade; el gateway TypeScript devuelve rechazo ante solicitudes malformadas sin propagar una excepción.
- Jenkins: se añadieron pruebas JUnit para el gate humano, criticidad, validez del pasaporte, límite de confianza y alcance de acciones. Se añadió `jenkins-plugin-verify` al workflow CI para ejecutar `mvn test` y empaquetar el HPI.

**Estado de verificación:** el build Vercel del SHA `03e6f68` valida el runtime TypeScript y sus 746 pruebas. Vercel no compila Java; las nuevas pruebas y el empaquetado del plugin Jenkins permanecen pendientes de una ejecución verde del job GitHub Actions. No se afirma que el plugin esté instalado o certificado.

## Gates restantes antes de declarar listo para producción

1. Build completo del SHA actual con TypeScript, toda la suite Vitest, bundle, UI/runtime smoke y `security:suite`.
2. GitHub Actions con jobs ejecutados y estado verde.
3. E2E real en navegador para Tools/Skills, navegación, caché y controles de acceso.
4. Benchmark comparable p50/p95/p99, tasa de errores y coste por ruta, separando proveedor y red.
5. Prueba real de inferencia con proveedor configurado en variables de entorno.
6. Validación de persistencia durable, recuperación, retención y aislamiento multi-tenant.
7. Recuperación de CITEMESH y validación de artefactos MoE antes de promover esos estados.
8. Validación independiente del plugin Jenkins y del workspace Rust cuando corresponda.

**Conclusión:** se han corregido fronteras de seguridad concretas y se han añadido pruebas de regresión. El estado de producción debe determinarse por la evidencia del SHA final, no por el número de módulos, las etiquetas de la interfaz ni esta auditoría por sí sola.
