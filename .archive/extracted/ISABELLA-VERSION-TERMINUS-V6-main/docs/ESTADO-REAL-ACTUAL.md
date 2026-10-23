# Estado real de Isabella Genesis — actualizado 17 de octubre de 2026

**Corte documental:** 17 de octubre de 2026  
**Repositorio:** `OsoPanda1/ISABELLA-VERSION-TERMINUS-V6`  
**Rama principal consultada:** `main`  
**HEAD de main al iniciar esta consolidación:** `94955427dc49cd4548100f7bca1d7d91dc457619`  
**Clasificación:** preproducción; no certificado para producción.

## Readiness reportada y límites

**61.0% ponderado de preparación para producción** (misma cifra y misma rúbrica que `README.md`, sección «Medición del avance real»; una prueba de consistencia, `test/deployment/readiness-consistency.test.ts`, falla si ambos documentos divergen). Es una evaluación de gates, no una métrica científica ni un porcentaje de funcionalidades. No sube por el mero aumento del número de pruebas ni por cambios posteriores al SHA validado: siguen abiertos CI de GitHub con ejecución válida, persistencia remota sana (Atlas/IKES), `BOOKPI_INTEGRITY_SECRET` en el entorno desplegado, inferencia externa verificada, telemetría exportada y despliegue/rollback reales.

> Histórico: la versión de 12 de octubre de 2026 estimaba 46.25% con otra rúbrica (runtime 20, pruebas 20, seguridad 15, inferencia 15, persistencia 10, CI/Rust 10, operación 10). Se reemplazó para no mantener dos cifras contradictorias.

| Dominio | Obtenidos / disponibles |
|---|---:|
| Runtime, compilación y pruebas | 25 / 25 |
| Seguridad y CI | 16 / 20 |
| Persistencia e integridad de datos | 5 / 20 |
| Inferencia y conversación | 7 / 15 |
| Despliegue y recuperación | 5 / 10 |
| Observabilidad y operación | 3 / 10 |
| **Total** | **61 / 100** |

## Evidencia disponible y estado no demostrado

- La documentación reporta un build aislado aprobado en un SHA anterior; esta consolidación documental no ejecutó el código ni los tests.
- El README registra que `/api/v1/readyz` devolvió HTTP 503 en un preview evaluado previamente.
- La inferencia generativa externa no se considera verificada en producción; requiere proveedor configurado, prueba E2E y tratamiento comprobado de timeout, errores y fallback.
- Persisten gates documentados relacionados con `BOOKPI_INTEGRITY_SECRET`, migraciones y probes de Atlas/IKES, durabilidad global de BookPI, CI observable, telemetría y despliegue/rollback reales.
- La PR de UI/chat #23 y los cambios de documentación deben evaluarse en su propio SHA; no equivalen a una fusión ni a una liberación.

## Bloqueadores prioritarios

1. Ejecutar y conservar CI con pasos/logs válidos sobre el SHA candidato: typecheck, pruebas, build, seguridad y smokes.
2. Resolver y probar configuración de persistencia: secretos del servidor, migraciones aplicadas, readiness de Atlas/IKES y durabilidad/recuperación de BookPI.
3. Demostrar una conversación generativa E2E con proveedor autorizado; comprobar fallback sin presentar la respuesta determinista local como inferencia de modelo.
4. Ejecutar E2E de navegador en desktop/móvil para navegación, conversación, accesibilidad y errores.
5. Medir latencia p50/p95/p99 y consumo bajo carga reproducible; no afirmar “latencia casi cero” sin datos.
6. Probar despliegue, monitorización, backup/restore y rollback en el entorno objetivo.

## Jerarquía de documentación

- [README](../README.md): resumen público, categoría, limitaciones y estimación global.
- [Índice canónico](README.md): mapa de fuentes y política de consolidación.
- [Mapa operativo](ARCHITECTURE-OPERATING-MAP.md): arquitectura y fronteras de integración.
- [Runbook de readiness](ops/PRODUCTION-READINESS-RUNBOOK.md): acciones para cerrar bloqueadores.
- [Auditoría técnico-operativa](audits/TECHNICAL-OPERATIONAL-AUDIT-2026-10-13.md) y [reducción de deuda técnica](audits/TECH-DEBT-REDUCTION-2026-10-13.md): hallazgos y cambios con alcance histórico.

## Regla de actualización

Actualizar este estado solo después de comprobar el SHA actual, los resultados reales de CI, el deployment y las dependencias externas. Separar siempre `IMPLEMENTED`, `TESTED`, `INTEGRATED`, `VERIFIED` y `DEPLOYED`. La existencia de código o documentación no satisface por sí sola ninguno de los gates externos.
