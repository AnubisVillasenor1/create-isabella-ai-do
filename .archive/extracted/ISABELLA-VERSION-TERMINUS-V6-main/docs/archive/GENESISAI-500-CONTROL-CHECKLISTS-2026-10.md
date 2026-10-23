# Archivo histórico consolidado — checklists GenesisAI de 500 controles

> **Archivo de preservación histórica, no fuente de estado actual.** Ambos documentos se originaron para `OsoPanda1/Isabella-Villase-or-GenesisAI`, no para el estado operativo actual de `OsoPanda1/ISABELLA-VERSION-TERMINUS-V6`. Sus controles no deben marcarse como ejecutados en TERMINUS V6 sin una nueva validación contra su SHA actual. Se conservan íntegros para no perder trazabilidad.

## Documento A — `docs/AUDITORIA_CHECKLIST_500_2026-10.md`

---

# Auditoría total — Checklist de 500 puntos para Isabella Villaseñor GenesisAI

**Corte:** 9 de octubre de 2026. **Repositorio canónico:** `OsoPanda1/Isabella-Villase-or-GenesisAI`. **Rama del checklist:** `audit/checklist-500-2026-10`.

## Cómo interpretar este documento

Este documento contiene **500 comprobaciones de auditoría**, no 500 defectos ya demostrados. Cada punto está pendiente hasta que exista evidencia reproducible, enlace a archivo/línea, prueba o registro de ejecución. El alcance y los archivos son rutas objetivo; la existencia de una ruta debe comprobarse antes de asignarle un defecto.

- `PENDIENTE`: no hay evidencia suficiente para declarar aprobado o defectuoso.
- `CONFIRMADO`: reproducido en el SHA identificado, con archivo/línea y prueba.
- `MITIGADO`: se implementó una corrección, pero falta confirmar validación en CI/entorno.
- `RESUELTO`: corrección verificada mediante pruebas y revisión del SHA final.
- `NO APLICA`: justificación documentada, no por omisión.

**Criterio de severidad:** P0 riesgo inmediato de acceso/filtración/corrupción; P1 compromete integridad, autorización o release; P2 degradación funcional, calidad o sesgo; P3 documentación, ergonomía o mejora. La severidad se asigna después de reproducir el hallazgo.

## Observaciones basadas en archivos inspeccionados

1. **Inconsistencia de metadatos de versión — PENDIENTE DE CORRECCIÓN:** `package.json` declara versión `0.1.0`, mientras la descripción menciona `TINA v40.0.0`. No es por sí solo un fallo de ejecución, pero impide una identificación de release inequívoca.
2. **Sanitización — revisión adversarial necesaria:** `src/sanitization/index.ts` contiene patrones heurísticos de PII/secretos y detección de malware por regex. Esto no equivale a un escáner exhaustivo ni debe presentarse como garantía de ausencia de secretos. Se deben probar falsos positivos, falsos negativos y contenido codificado/multilingüe.
3. **IKES — controles positivos observados en el código actual:** `src/memory/ikes.ts` exige evidencia registrada para propuestas/corroboración y congela estructuras de claims. Aún debe comprobarse si las referencias de fuente y evidencia representan contenido recuperado, auténtico y no solo metadatos declarados.
4. **Manifest de evidencia:** `src/governance/evidence-manifest.ts` incluye comprobaciones de completitud y exige verificador inyectado para excepciones de estabilidad. Debe verificarse la integridad semántica del manifest, la autenticidad del aprobador y que todos los campos relevantes estén cubiertos por el identificador.
5. **CI:** `.github/workflows/ci.yml` ejecuta typecheck, tests, build, escaneo de secretos y suite de seguridad, además de generar evidencia de producción. La existencia del workflow no prueba que la última ejecución haya pasado; debe consultarse el estado del SHA final.
6. **Límite de esta revisión:** no se afirma que se hayan ejecutado localmente los tests ni que el despliegue esté validado. Cada estado debe actualizarse con resultados observables.

## Checklist

### 01. Runtime canónico e inicialización

**Rutas objetivo:** `src/genesis/runtime.ts; src/genesis/*; src/index.ts`  
**Alcance:** runtime, singletons, wiring, lifecycle

- [ ] **AUD-001** — contrato y tipos coinciden con la implementación real en runtime, singletons, wiring, lifecycle; aceptación: CONTRACT ≠ IMPLEMENTED. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-002** — módulo se registra una sola vez en el runtime canónico en runtime, singletons, wiring, lifecycle; aceptación: sin runtime paralelo. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-003** — todas las rutas de entrada validan tipo, tamaño y forma en runtime, singletons, wiring, lifecycle; aceptación: rechazo fail-closed. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-004** — valores ausentes, nulos y malformados producen error explícito en runtime, singletons, wiring, lifecycle; aceptación: sin coerción silenciosa. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-005** — permisos se comprueban en servidor y no en el cliente en runtime, singletons, wiring, lifecycle; aceptación: confianza cero. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-006** — roles y principal provienen de identidad autenticada en runtime, singletons, wiring, lifecycle; aceptación: sin elevación desde payload. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-007** — errores no filtran secretos, PII, tokens ni contenido privado en runtime, singletons, wiring, lifecycle; aceptación: redacción verificada. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-008** — estados de éxito requieren evidencia de operación real en runtime, singletons, wiring, lifecycle; aceptación: sin éxito simulado. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-009** — hashes se calculan sobre representación canónica documentada en runtime, singletons, wiring, lifecycle; aceptación: integridad reproducible. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-010** — verificación de hash no se presenta como autenticación de fuente en runtime, singletons, wiring, lifecycle; aceptación: sin falsa garantía. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-011** — colecciones y objetos retornados no permiten mutación indirecta en runtime, singletons, wiring, lifecycle; aceptación: inmutabilidad profunda. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-012** — reintentos e invocaciones repetidas son idempotentes cuando corresponde en runtime, singletons, wiring, lifecycle; aceptación: sin duplicados. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-013** — operaciones concurrentes conservan consistencia y orden en runtime, singletons, wiring, lifecycle; aceptación: sin carreras. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-014** — límites, timeout y cancelación evitan consumo ilimitado en runtime, singletons, wiring, lifecycle; aceptación: recursos acotados. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-015** — salidas de red restringen protocolos, destinos y redirecciones en runtime, singletons, wiring, lifecycle; aceptación: protección SSRF. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-016** — mensajes de error distinguen fallo, ausencia y estado inconcluso en runtime, singletons, wiring, lifecycle; aceptación: semántica honesta. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-017** — registros de auditoría contienen actor, acción, tiempo y resultado en runtime, singletons, wiring, lifecycle; aceptación: trazabilidad. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-018** — datos personales se minimizan, clasifican y retienen con política en runtime, singletons, wiring, lifecycle; aceptación: privacidad por diseño. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-019** — aislamiento multiusuario/tenant se valida con pruebas cruzadas en runtime, singletons, wiring, lifecycle; aceptación: sin fuga entre tenants. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-020** — dependencias, versiones y licencias están inventariadas en runtime, singletons, wiring, lifecycle; aceptación: supply chain. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-021** — pruebas positivas cubren la ruta nominal y sus invariantes en runtime, singletons, wiring, lifecycle; aceptación: caso nominal. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-022** — pruebas negativas cubren abuso, datos inválidos y permisos denegados en runtime, singletons, wiring, lifecycle; aceptación: caso adversarial. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-023** — pruebas de regresión reproducen el hallazgo con una aserción en runtime, singletons, wiring, lifecycle; aceptación: regresión bloqueante. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-024** — observabilidad permite diagnosticar sin exponer contenido sensible en runtime, singletons, wiring, lifecycle; aceptación: logs seguros. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-025** — documentación declara limitaciones, estado real y criterio de aceptación en runtime, singletons, wiring, lifecycle; aceptación: sin sobreafirmaciones. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.

### 02. CROWN: decisiones y capacidades

**Rutas objetivo:** `src/crown/*; src/authority/*`  
**Alcance:** decision engine and capability gates

- [ ] **AUD-026** — contrato y tipos coinciden con la implementación real en decision engine and capability gates; aceptación: CONTRACT ≠ IMPLEMENTED. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-027** — módulo se registra una sola vez en el runtime canónico en decision engine and capability gates; aceptación: sin runtime paralelo. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-028** — todas las rutas de entrada validan tipo, tamaño y forma en decision engine and capability gates; aceptación: rechazo fail-closed. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-029** — valores ausentes, nulos y malformados producen error explícito en decision engine and capability gates; aceptación: sin coerción silenciosa. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-030** — permisos se comprueban en servidor y no en el cliente en decision engine and capability gates; aceptación: confianza cero. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-031** — roles y principal provienen de identidad autenticada en decision engine and capability gates; aceptación: sin elevación desde payload. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-032** — errores no filtran secretos, PII, tokens ni contenido privado en decision engine and capability gates; aceptación: redacción verificada. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-033** — estados de éxito requieren evidencia de operación real en decision engine and capability gates; aceptación: sin éxito simulado. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-034** — hashes se calculan sobre representación canónica documentada en decision engine and capability gates; aceptación: integridad reproducible. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-035** — verificación de hash no se presenta como autenticación de fuente en decision engine and capability gates; aceptación: sin falsa garantía. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-036** — colecciones y objetos retornados no permiten mutación indirecta en decision engine and capability gates; aceptación: inmutabilidad profunda. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-037** — reintentos e invocaciones repetidas son idempotentes cuando corresponde en decision engine and capability gates; aceptación: sin duplicados. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-038** — operaciones concurrentes conservan consistencia y orden en decision engine and capability gates; aceptación: sin carreras. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-039** — límites, timeout y cancelación evitan consumo ilimitado en decision engine and capability gates; aceptación: recursos acotados. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-040** — salidas de red restringen protocolos, destinos y redirecciones en decision engine and capability gates; aceptación: protección SSRF. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-041** — mensajes de error distinguen fallo, ausencia y estado inconcluso en decision engine and capability gates; aceptación: semántica honesta. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-042** — registros de auditoría contienen actor, acción, tiempo y resultado en decision engine and capability gates; aceptación: trazabilidad. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-043** — datos personales se minimizan, clasifican y retienen con política en decision engine and capability gates; aceptación: privacidad por diseño. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-044** — aislamiento multiusuario/tenant se valida con pruebas cruzadas en decision engine and capability gates; aceptación: sin fuga entre tenants. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-045** — dependencias, versiones y licencias están inventariadas en decision engine and capability gates; aceptación: supply chain. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-046** — pruebas positivas cubren la ruta nominal y sus invariantes en decision engine and capability gates; aceptación: caso nominal. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-047** — pruebas negativas cubren abuso, datos inválidos y permisos denegados en decision engine and capability gates; aceptación: caso adversarial. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-048** — pruebas de regresión reproducen el hallazgo con una aserción en decision engine and capability gates; aceptación: regresión bloqueante. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-049** — observabilidad permite diagnosticar sin exponer contenido sensible en decision engine and capability gates; aceptación: logs seguros. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-050** — documentación declara limitaciones, estado real y criterio de aceptación en decision engine and capability gates; aceptación: sin sobreafirmaciones. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.

### 03. AEGIS: gobernanza y políticas

**Rutas objetivo:** `src/governance/*; src/policy/*`  
**Alcance:** policy enforcement and governance

- [ ] **AUD-051** — contrato y tipos coinciden con la implementación real en policy enforcement and governance; aceptación: CONTRACT ≠ IMPLEMENTED. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-052** — módulo se registra una sola vez en el runtime canónico en policy enforcement and governance; aceptación: sin runtime paralelo. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-053** — todas las rutas de entrada validan tipo, tamaño y forma en policy enforcement and governance; aceptación: rechazo fail-closed. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-054** — valores ausentes, nulos y malformados producen error explícito en policy enforcement and governance; aceptación: sin coerción silenciosa. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-055** — permisos se comprueban en servidor y no en el cliente en policy enforcement and governance; aceptación: confianza cero. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-056** — roles y principal provienen de identidad autenticada en policy enforcement and governance; aceptación: sin elevación desde payload. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-057** — errores no filtran secretos, PII, tokens ni contenido privado en policy enforcement and governance; aceptación: redacción verificada. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-058** — estados de éxito requieren evidencia de operación real en policy enforcement and governance; aceptación: sin éxito simulado. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-059** — hashes se calculan sobre representación canónica documentada en policy enforcement and governance; aceptación: integridad reproducible. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-060** — verificación de hash no se presenta como autenticación de fuente en policy enforcement and governance; aceptación: sin falsa garantía. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-061** — colecciones y objetos retornados no permiten mutación indirecta en policy enforcement and governance; aceptación: inmutabilidad profunda. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-062** — reintentos e invocaciones repetidas son idempotentes cuando corresponde en policy enforcement and governance; aceptación: sin duplicados. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-063** — operaciones concurrentes conservan consistencia y orden en policy enforcement and governance; aceptación: sin carreras. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-064** — límites, timeout y cancelación evitan consumo ilimitado en policy enforcement and governance; aceptación: recursos acotados. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-065** — salidas de red restringen protocolos, destinos y redirecciones en policy enforcement and governance; aceptación: protección SSRF. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-066** — mensajes de error distinguen fallo, ausencia y estado inconcluso en policy enforcement and governance; aceptación: semántica honesta. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-067** — registros de auditoría contienen actor, acción, tiempo y resultado en policy enforcement and governance; aceptación: trazabilidad. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-068** — datos personales se minimizan, clasifican y retienen con política en policy enforcement and governance; aceptación: privacidad por diseño. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-069** — aislamiento multiusuario/tenant se valida con pruebas cruzadas en policy enforcement and governance; aceptación: sin fuga entre tenants. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-070** — dependencias, versiones y licencias están inventariadas en policy enforcement and governance; aceptación: supply chain. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-071** — pruebas positivas cubren la ruta nominal y sus invariantes en policy enforcement and governance; aceptación: caso nominal. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-072** — pruebas negativas cubren abuso, datos inválidos y permisos denegados en policy enforcement and governance; aceptación: caso adversarial. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-073** — pruebas de regresión reproducen el hallazgo con una aserción en policy enforcement and governance; aceptación: regresión bloqueante. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-074** — observabilidad permite diagnosticar sin exponer contenido sensible en policy enforcement and governance; aceptación: logs seguros. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-075** — documentación declara limitaciones, estado real y criterio de aceptación en policy enforcement and governance; aceptación: sin sobreafirmaciones. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.

### 04. IKES: conocimiento y epistemología

**Rutas objetivo:** `src/memory/ikes.ts; src/memory/knowledge-entry.ts; src/memory/proposals.ts`  
**Alcance:** claims, evidence, provenance, epistemic state

- [ ] **AUD-076** — contrato y tipos coinciden con la implementación real en claims, evidence, provenance, epistemic state; aceptación: CONTRACT ≠ IMPLEMENTED. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-077** — módulo se registra una sola vez en el runtime canónico en claims, evidence, provenance, epistemic state; aceptación: sin runtime paralelo. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-078** — todas las rutas de entrada validan tipo, tamaño y forma en claims, evidence, provenance, epistemic state; aceptación: rechazo fail-closed. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-079** — valores ausentes, nulos y malformados producen error explícito en claims, evidence, provenance, epistemic state; aceptación: sin coerción silenciosa. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-080** — permisos se comprueban en servidor y no en el cliente en claims, evidence, provenance, epistemic state; aceptación: confianza cero. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-081** — roles y principal provienen de identidad autenticada en claims, evidence, provenance, epistemic state; aceptación: sin elevación desde payload. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-082** — errores no filtran secretos, PII, tokens ni contenido privado en claims, evidence, provenance, epistemic state; aceptación: redacción verificada. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-083** — estados de éxito requieren evidencia de operación real en claims, evidence, provenance, epistemic state; aceptación: sin éxito simulado. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-084** — hashes se calculan sobre representación canónica documentada en claims, evidence, provenance, epistemic state; aceptación: integridad reproducible. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-085** — verificación de hash no se presenta como autenticación de fuente en claims, evidence, provenance, epistemic state; aceptación: sin falsa garantía. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-086** — colecciones y objetos retornados no permiten mutación indirecta en claims, evidence, provenance, epistemic state; aceptación: inmutabilidad profunda. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-087** — reintentos e invocaciones repetidas son idempotentes cuando corresponde en claims, evidence, provenance, epistemic state; aceptación: sin duplicados. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-088** — operaciones concurrentes conservan consistencia y orden en claims, evidence, provenance, epistemic state; aceptación: sin carreras. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-089** — límites, timeout y cancelación evitan consumo ilimitado en claims, evidence, provenance, epistemic state; aceptación: recursos acotados. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-090** — salidas de red restringen protocolos, destinos y redirecciones en claims, evidence, provenance, epistemic state; aceptación: protección SSRF. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-091** — mensajes de error distinguen fallo, ausencia y estado inconcluso en claims, evidence, provenance, epistemic state; aceptación: semántica honesta. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-092** — registros de auditoría contienen actor, acción, tiempo y resultado en claims, evidence, provenance, epistemic state; aceptación: trazabilidad. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-093** — datos personales se minimizan, clasifican y retienen con política en claims, evidence, provenance, epistemic state; aceptación: privacidad por diseño. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-094** — aislamiento multiusuario/tenant se valida con pruebas cruzadas en claims, evidence, provenance, epistemic state; aceptación: sin fuga entre tenants. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-095** — dependencias, versiones y licencias están inventariadas en claims, evidence, provenance, epistemic state; aceptación: supply chain. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-096** — pruebas positivas cubren la ruta nominal y sus invariantes en claims, evidence, provenance, epistemic state; aceptación: caso nominal. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-097** — pruebas negativas cubren abuso, datos inválidos y permisos denegados en claims, evidence, provenance, epistemic state; aceptación: caso adversarial. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-098** — pruebas de regresión reproducen el hallazgo con una aserción en claims, evidence, provenance, epistemic state; aceptación: regresión bloqueante. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-099** — observabilidad permite diagnosticar sin exponer contenido sensible en claims, evidence, provenance, epistemic state; aceptación: logs seguros. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-100** — documentación declara limitaciones, estado real y criterio de aceptación en claims, evidence, provenance, epistemic state; aceptación: sin sobreafirmaciones. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.

### 05. Sanitización y admisión de documentos

**Rutas objetivo:** `src/sanitization/*`  
**Alcance:** input hygiene, PII, secrets, duplicate detection

- [ ] **AUD-101** — contrato y tipos coinciden con la implementación real en input hygiene, PII, secrets, duplicate detection; aceptación: CONTRACT ≠ IMPLEMENTED. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-102** — módulo se registra una sola vez en el runtime canónico en input hygiene, PII, secrets, duplicate detection; aceptación: sin runtime paralelo. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-103** — todas las rutas de entrada validan tipo, tamaño y forma en input hygiene, PII, secrets, duplicate detection; aceptación: rechazo fail-closed. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-104** — valores ausentes, nulos y malformados producen error explícito en input hygiene, PII, secrets, duplicate detection; aceptación: sin coerción silenciosa. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-105** — permisos se comprueban en servidor y no en el cliente en input hygiene, PII, secrets, duplicate detection; aceptación: confianza cero. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-106** — roles y principal provienen de identidad autenticada en input hygiene, PII, secrets, duplicate detection; aceptación: sin elevación desde payload. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-107** — errores no filtran secretos, PII, tokens ni contenido privado en input hygiene, PII, secrets, duplicate detection; aceptación: redacción verificada. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-108** — estados de éxito requieren evidencia de operación real en input hygiene, PII, secrets, duplicate detection; aceptación: sin éxito simulado. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-109** — hashes se calculan sobre representación canónica documentada en input hygiene, PII, secrets, duplicate detection; aceptación: integridad reproducible. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-110** — verificación de hash no se presenta como autenticación de fuente en input hygiene, PII, secrets, duplicate detection; aceptación: sin falsa garantía. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-111** — colecciones y objetos retornados no permiten mutación indirecta en input hygiene, PII, secrets, duplicate detection; aceptación: inmutabilidad profunda. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-112** — reintentos e invocaciones repetidas son idempotentes cuando corresponde en input hygiene, PII, secrets, duplicate detection; aceptación: sin duplicados. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-113** — operaciones concurrentes conservan consistencia y orden en input hygiene, PII, secrets, duplicate detection; aceptación: sin carreras. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-114** — límites, timeout y cancelación evitan consumo ilimitado en input hygiene, PII, secrets, duplicate detection; aceptación: recursos acotados. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-115** — salidas de red restringen protocolos, destinos y redirecciones en input hygiene, PII, secrets, duplicate detection; aceptación: protección SSRF. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-116** — mensajes de error distinguen fallo, ausencia y estado inconcluso en input hygiene, PII, secrets, duplicate detection; aceptación: semántica honesta. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-117** — registros de auditoría contienen actor, acción, tiempo y resultado en input hygiene, PII, secrets, duplicate detection; aceptación: trazabilidad. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-118** — datos personales se minimizan, clasifican y retienen con política en input hygiene, PII, secrets, duplicate detection; aceptación: privacidad por diseño. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-119** — aislamiento multiusuario/tenant se valida con pruebas cruzadas en input hygiene, PII, secrets, duplicate detection; aceptación: sin fuga entre tenants. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-120** — dependencias, versiones y licencias están inventariadas en input hygiene, PII, secrets, duplicate detection; aceptación: supply chain. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-121** — pruebas positivas cubren la ruta nominal y sus invariantes en input hygiene, PII, secrets, duplicate detection; aceptación: caso nominal. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-122** — pruebas negativas cubren abuso, datos inválidos y permisos denegados en input hygiene, PII, secrets, duplicate detection; aceptación: caso adversarial. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-123** — pruebas de regresión reproducen el hallazgo con una aserción en input hygiene, PII, secrets, duplicate detection; aceptación: regresión bloqueante. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-124** — observabilidad permite diagnosticar sin exponer contenido sensible en input hygiene, PII, secrets, duplicate detection; aceptación: logs seguros. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-125** — documentación declara limitaciones, estado real y criterio de aceptación en input hygiene, PII, secrets, duplicate detection; aceptación: sin sobreafirmaciones. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.

### 06. VERITAS y verificación de verdad

**Rutas objetivo:** `src/litle/*; src/verification/*; src/server.ts`  
**Alcance:** evidence and certificate verification

- [ ] **AUD-126** — contrato y tipos coinciden con la implementación real en evidence and certificate verification; aceptación: CONTRACT ≠ IMPLEMENTED. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-127** — módulo se registra una sola vez en el runtime canónico en evidence and certificate verification; aceptación: sin runtime paralelo. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-128** — todas las rutas de entrada validan tipo, tamaño y forma en evidence and certificate verification; aceptación: rechazo fail-closed. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-129** — valores ausentes, nulos y malformados producen error explícito en evidence and certificate verification; aceptación: sin coerción silenciosa. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-130** — permisos se comprueban en servidor y no en el cliente en evidence and certificate verification; aceptación: confianza cero. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-131** — roles y principal provienen de identidad autenticada en evidence and certificate verification; aceptación: sin elevación desde payload. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-132** — errores no filtran secretos, PII, tokens ni contenido privado en evidence and certificate verification; aceptación: redacción verificada. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-133** — estados de éxito requieren evidencia de operación real en evidence and certificate verification; aceptación: sin éxito simulado. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-134** — hashes se calculan sobre representación canónica documentada en evidence and certificate verification; aceptación: integridad reproducible. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-135** — verificación de hash no se presenta como autenticación de fuente en evidence and certificate verification; aceptación: sin falsa garantía. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-136** — colecciones y objetos retornados no permiten mutación indirecta en evidence and certificate verification; aceptación: inmutabilidad profunda. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-137** — reintentos e invocaciones repetidas son idempotentes cuando corresponde en evidence and certificate verification; aceptación: sin duplicados. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-138** — operaciones concurrentes conservan consistencia y orden en evidence and certificate verification; aceptación: sin carreras. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-139** — límites, timeout y cancelación evitan consumo ilimitado en evidence and certificate verification; aceptación: recursos acotados. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-140** — salidas de red restringen protocolos, destinos y redirecciones en evidence and certificate verification; aceptación: protección SSRF. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-141** — mensajes de error distinguen fallo, ausencia y estado inconcluso en evidence and certificate verification; aceptación: semántica honesta. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-142** — registros de auditoría contienen actor, acción, tiempo y resultado en evidence and certificate verification; aceptación: trazabilidad. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-143** — datos personales se minimizan, clasifican y retienen con política en evidence and certificate verification; aceptación: privacidad por diseño. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-144** — aislamiento multiusuario/tenant se valida con pruebas cruzadas en evidence and certificate verification; aceptación: sin fuga entre tenants. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-145** — dependencias, versiones y licencias están inventariadas en evidence and certificate verification; aceptación: supply chain. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-146** — pruebas positivas cubren la ruta nominal y sus invariantes en evidence and certificate verification; aceptación: caso nominal. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-147** — pruebas negativas cubren abuso, datos inválidos y permisos denegados en evidence and certificate verification; aceptación: caso adversarial. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-148** — pruebas de regresión reproducen el hallazgo con una aserción en evidence and certificate verification; aceptación: regresión bloqueante. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-149** — observabilidad permite diagnosticar sin exponer contenido sensible en evidence and certificate verification; aceptación: logs seguros. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-150** — documentación declara limitaciones, estado real y criterio de aceptación en evidence and certificate verification; aceptación: sin sobreafirmaciones. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.

### 07. BookPI: ledger y trazabilidad

**Rutas objetivo:** `src/bookpi/*; src/server.ts`  
**Alcance:** audit ledger, integrity, replay

- [ ] **AUD-151** — contrato y tipos coinciden con la implementación real en audit ledger, integrity, replay; aceptación: CONTRACT ≠ IMPLEMENTED. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-152** — módulo se registra una sola vez en el runtime canónico en audit ledger, integrity, replay; aceptación: sin runtime paralelo. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-153** — todas las rutas de entrada validan tipo, tamaño y forma en audit ledger, integrity, replay; aceptación: rechazo fail-closed. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-154** — valores ausentes, nulos y malformados producen error explícito en audit ledger, integrity, replay; aceptación: sin coerción silenciosa. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-155** — permisos se comprueban en servidor y no en el cliente en audit ledger, integrity, replay; aceptación: confianza cero. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-156** — roles y principal provienen de identidad autenticada en audit ledger, integrity, replay; aceptación: sin elevación desde payload. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-157** — errores no filtran secretos, PII, tokens ni contenido privado en audit ledger, integrity, replay; aceptación: redacción verificada. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-158** — estados de éxito requieren evidencia de operación real en audit ledger, integrity, replay; aceptación: sin éxito simulado. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-159** — hashes se calculan sobre representación canónica documentada en audit ledger, integrity, replay; aceptación: integridad reproducible. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-160** — verificación de hash no se presenta como autenticación de fuente en audit ledger, integrity, replay; aceptación: sin falsa garantía. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-161** — colecciones y objetos retornados no permiten mutación indirecta en audit ledger, integrity, replay; aceptación: inmutabilidad profunda. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-162** — reintentos e invocaciones repetidas son idempotentes cuando corresponde en audit ledger, integrity, replay; aceptación: sin duplicados. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-163** — operaciones concurrentes conservan consistencia y orden en audit ledger, integrity, replay; aceptación: sin carreras. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-164** — límites, timeout y cancelación evitan consumo ilimitado en audit ledger, integrity, replay; aceptación: recursos acotados. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-165** — salidas de red restringen protocolos, destinos y redirecciones en audit ledger, integrity, replay; aceptación: protección SSRF. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-166** — mensajes de error distinguen fallo, ausencia y estado inconcluso en audit ledger, integrity, replay; aceptación: semántica honesta. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-167** — registros de auditoría contienen actor, acción, tiempo y resultado en audit ledger, integrity, replay; aceptación: trazabilidad. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-168** — datos personales se minimizan, clasifican y retienen con política en audit ledger, integrity, replay; aceptación: privacidad por diseño. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-169** — aislamiento multiusuario/tenant se valida con pruebas cruzadas en audit ledger, integrity, replay; aceptación: sin fuga entre tenants. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-170** — dependencias, versiones y licencias están inventariadas en audit ledger, integrity, replay; aceptación: supply chain. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-171** — pruebas positivas cubren la ruta nominal y sus invariantes en audit ledger, integrity, replay; aceptación: caso nominal. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-172** — pruebas negativas cubren abuso, datos inválidos y permisos denegados en audit ledger, integrity, replay; aceptación: caso adversarial. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-173** — pruebas de regresión reproducen el hallazgo con una aserción en audit ledger, integrity, replay; aceptación: regresión bloqueante. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-174** — observabilidad permite diagnosticar sin exponer contenido sensible en audit ledger, integrity, replay; aceptación: logs seguros. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-175** — documentación declara limitaciones, estado real y criterio de aceptación en audit ledger, integrity, replay; aceptación: sin sobreafirmaciones. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.

### 08. LITLE: confianza y evidencia

**Rutas objetivo:** `src/litle/*; src/evidence/*`  
**Alcance:** trust fabric, certificates, canonicalization

- [ ] **AUD-176** — contrato y tipos coinciden con la implementación real en trust fabric, certificates, canonicalization; aceptación: CONTRACT ≠ IMPLEMENTED. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-177** — módulo se registra una sola vez en el runtime canónico en trust fabric, certificates, canonicalization; aceptación: sin runtime paralelo. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-178** — todas las rutas de entrada validan tipo, tamaño y forma en trust fabric, certificates, canonicalization; aceptación: rechazo fail-closed. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-179** — valores ausentes, nulos y malformados producen error explícito en trust fabric, certificates, canonicalization; aceptación: sin coerción silenciosa. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-180** — permisos se comprueban en servidor y no en el cliente en trust fabric, certificates, canonicalization; aceptación: confianza cero. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-181** — roles y principal provienen de identidad autenticada en trust fabric, certificates, canonicalization; aceptación: sin elevación desde payload. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-182** — errores no filtran secretos, PII, tokens ni contenido privado en trust fabric, certificates, canonicalization; aceptación: redacción verificada. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-183** — estados de éxito requieren evidencia de operación real en trust fabric, certificates, canonicalization; aceptación: sin éxito simulado. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-184** — hashes se calculan sobre representación canónica documentada en trust fabric, certificates, canonicalization; aceptación: integridad reproducible. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-185** — verificación de hash no se presenta como autenticación de fuente en trust fabric, certificates, canonicalization; aceptación: sin falsa garantía. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-186** — colecciones y objetos retornados no permiten mutación indirecta en trust fabric, certificates, canonicalization; aceptación: inmutabilidad profunda. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-187** — reintentos e invocaciones repetidas son idempotentes cuando corresponde en trust fabric, certificates, canonicalization; aceptación: sin duplicados. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-188** — operaciones concurrentes conservan consistencia y orden en trust fabric, certificates, canonicalization; aceptación: sin carreras. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-189** — límites, timeout y cancelación evitan consumo ilimitado en trust fabric, certificates, canonicalization; aceptación: recursos acotados. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-190** — salidas de red restringen protocolos, destinos y redirecciones en trust fabric, certificates, canonicalization; aceptación: protección SSRF. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-191** — mensajes de error distinguen fallo, ausencia y estado inconcluso en trust fabric, certificates, canonicalization; aceptación: semántica honesta. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-192** — registros de auditoría contienen actor, acción, tiempo y resultado en trust fabric, certificates, canonicalization; aceptación: trazabilidad. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-193** — datos personales se minimizan, clasifican y retienen con política en trust fabric, certificates, canonicalization; aceptación: privacidad por diseño. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-194** — aislamiento multiusuario/tenant se valida con pruebas cruzadas en trust fabric, certificates, canonicalization; aceptación: sin fuga entre tenants. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-195** — dependencias, versiones y licencias están inventariadas en trust fabric, certificates, canonicalization; aceptación: supply chain. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-196** — pruebas positivas cubren la ruta nominal y sus invariantes en trust fabric, certificates, canonicalization; aceptación: caso nominal. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-197** — pruebas negativas cubren abuso, datos inválidos y permisos denegados en trust fabric, certificates, canonicalization; aceptación: caso adversarial. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-198** — pruebas de regresión reproducen el hallazgo con una aserción en trust fabric, certificates, canonicalization; aceptación: regresión bloqueante. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-199** — observabilidad permite diagnosticar sin exponer contenido sensible en trust fabric, certificates, canonicalization; aceptación: logs seguros. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-200** — documentación declara limitaciones, estado real y criterio de aceptación en trust fabric, certificates, canonicalization; aceptación: sin sobreafirmaciones. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.

### 09. Atlas: persistencia y sincronización

**Rutas objetivo:** `src/atlas/*; scripts/atlas-ingest.ts`  
**Alcance:** storage, persistence, synchronization

- [ ] **AUD-201** — contrato y tipos coinciden con la implementación real en storage, persistence, synchronization; aceptación: CONTRACT ≠ IMPLEMENTED. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-202** — módulo se registra una sola vez en el runtime canónico en storage, persistence, synchronization; aceptación: sin runtime paralelo. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-203** — todas las rutas de entrada validan tipo, tamaño y forma en storage, persistence, synchronization; aceptación: rechazo fail-closed. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-204** — valores ausentes, nulos y malformados producen error explícito en storage, persistence, synchronization; aceptación: sin coerción silenciosa. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-205** — permisos se comprueban en servidor y no en el cliente en storage, persistence, synchronization; aceptación: confianza cero. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-206** — roles y principal provienen de identidad autenticada en storage, persistence, synchronization; aceptación: sin elevación desde payload. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-207** — errores no filtran secretos, PII, tokens ni contenido privado en storage, persistence, synchronization; aceptación: redacción verificada. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-208** — estados de éxito requieren evidencia de operación real en storage, persistence, synchronization; aceptación: sin éxito simulado. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-209** — hashes se calculan sobre representación canónica documentada en storage, persistence, synchronization; aceptación: integridad reproducible. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-210** — verificación de hash no se presenta como autenticación de fuente en storage, persistence, synchronization; aceptación: sin falsa garantía. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-211** — colecciones y objetos retornados no permiten mutación indirecta en storage, persistence, synchronization; aceptación: inmutabilidad profunda. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-212** — reintentos e invocaciones repetidas son idempotentes cuando corresponde en storage, persistence, synchronization; aceptación: sin duplicados. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-213** — operaciones concurrentes conservan consistencia y orden en storage, persistence, synchronization; aceptación: sin carreras. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-214** — límites, timeout y cancelación evitan consumo ilimitado en storage, persistence, synchronization; aceptación: recursos acotados. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-215** — salidas de red restringen protocolos, destinos y redirecciones en storage, persistence, synchronization; aceptación: protección SSRF. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-216** — mensajes de error distinguen fallo, ausencia y estado inconcluso en storage, persistence, synchronization; aceptación: semántica honesta. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-217** — registros de auditoría contienen actor, acción, tiempo y resultado en storage, persistence, synchronization; aceptación: trazabilidad. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-218** — datos personales se minimizan, clasifican y retienen con política en storage, persistence, synchronization; aceptación: privacidad por diseño. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-219** — aislamiento multiusuario/tenant se valida con pruebas cruzadas en storage, persistence, synchronization; aceptación: sin fuga entre tenants. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-220** — dependencias, versiones y licencias están inventariadas en storage, persistence, synchronization; aceptación: supply chain. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-221** — pruebas positivas cubren la ruta nominal y sus invariantes en storage, persistence, synchronization; aceptación: caso nominal. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-222** — pruebas negativas cubren abuso, datos inválidos y permisos denegados en storage, persistence, synchronization; aceptación: caso adversarial. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-223** — pruebas de regresión reproducen el hallazgo con una aserción en storage, persistence, synchronization; aceptación: regresión bloqueante. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-224** — observabilidad permite diagnosticar sin exponer contenido sensible en storage, persistence, synchronization; aceptación: logs seguros. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-225** — documentación declara limitaciones, estado real y criterio de aceptación en storage, persistence, synchronization; aceptación: sin sobreafirmaciones. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.

### 10. HSF: registro e invocación de skills

**Rutas objetivo:** `src/capabilities/hsf.ts; src/genesis/runtime.ts; src/server.ts`  
**Alcance:** skill registry and gateway

- [ ] **AUD-226** — contrato y tipos coinciden con la implementación real en skill registry and gateway; aceptación: CONTRACT ≠ IMPLEMENTED. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-227** — módulo se registra una sola vez en el runtime canónico en skill registry and gateway; aceptación: sin runtime paralelo. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-228** — todas las rutas de entrada validan tipo, tamaño y forma en skill registry and gateway; aceptación: rechazo fail-closed. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-229** — valores ausentes, nulos y malformados producen error explícito en skill registry and gateway; aceptación: sin coerción silenciosa. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-230** — permisos se comprueban en servidor y no en el cliente en skill registry and gateway; aceptación: confianza cero. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-231** — roles y principal provienen de identidad autenticada en skill registry and gateway; aceptación: sin elevación desde payload. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-232** — errores no filtran secretos, PII, tokens ni contenido privado en skill registry and gateway; aceptación: redacción verificada. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-233** — estados de éxito requieren evidencia de operación real en skill registry and gateway; aceptación: sin éxito simulado. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-234** — hashes se calculan sobre representación canónica documentada en skill registry and gateway; aceptación: integridad reproducible. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-235** — verificación de hash no se presenta como autenticación de fuente en skill registry and gateway; aceptación: sin falsa garantía. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-236** — colecciones y objetos retornados no permiten mutación indirecta en skill registry and gateway; aceptación: inmutabilidad profunda. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-237** — reintentos e invocaciones repetidas son idempotentes cuando corresponde en skill registry and gateway; aceptación: sin duplicados. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-238** — operaciones concurrentes conservan consistencia y orden en skill registry and gateway; aceptación: sin carreras. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-239** — límites, timeout y cancelación evitan consumo ilimitado en skill registry and gateway; aceptación: recursos acotados. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-240** — salidas de red restringen protocolos, destinos y redirecciones en skill registry and gateway; aceptación: protección SSRF. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-241** — mensajes de error distinguen fallo, ausencia y estado inconcluso en skill registry and gateway; aceptación: semántica honesta. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-242** — registros de auditoría contienen actor, acción, tiempo y resultado en skill registry and gateway; aceptación: trazabilidad. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-243** — datos personales se minimizan, clasifican y retienen con política en skill registry and gateway; aceptación: privacidad por diseño. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-244** — aislamiento multiusuario/tenant se valida con pruebas cruzadas en skill registry and gateway; aceptación: sin fuga entre tenants. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-245** — dependencias, versiones y licencias están inventariadas en skill registry and gateway; aceptación: supply chain. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-246** — pruebas positivas cubren la ruta nominal y sus invariantes en skill registry and gateway; aceptación: caso nominal. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-247** — pruebas negativas cubren abuso, datos inválidos y permisos denegados en skill registry and gateway; aceptación: caso adversarial. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-248** — pruebas de regresión reproducen el hallazgo con una aserción en skill registry and gateway; aceptación: regresión bloqueante. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-249** — observabilidad permite diagnosticar sin exponer contenido sensible en skill registry and gateway; aceptación: logs seguros. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-250** — documentación declara limitaciones, estado real y criterio de aceptación en skill registry and gateway; aceptación: sin sobreafirmaciones. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.

### 11. API y middleware HTTP

**Rutas objetivo:** `src/server.ts; src/security/*`  
**Alcance:** routes, middleware, request validation

- [ ] **AUD-251** — contrato y tipos coinciden con la implementación real en routes, middleware, request validation; aceptación: CONTRACT ≠ IMPLEMENTED. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-252** — módulo se registra una sola vez en el runtime canónico en routes, middleware, request validation; aceptación: sin runtime paralelo. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-253** — todas las rutas de entrada validan tipo, tamaño y forma en routes, middleware, request validation; aceptación: rechazo fail-closed. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-254** — valores ausentes, nulos y malformados producen error explícito en routes, middleware, request validation; aceptación: sin coerción silenciosa. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-255** — permisos se comprueban en servidor y no en el cliente en routes, middleware, request validation; aceptación: confianza cero. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-256** — roles y principal provienen de identidad autenticada en routes, middleware, request validation; aceptación: sin elevación desde payload. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-257** — errores no filtran secretos, PII, tokens ni contenido privado en routes, middleware, request validation; aceptación: redacción verificada. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-258** — estados de éxito requieren evidencia de operación real en routes, middleware, request validation; aceptación: sin éxito simulado. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-259** — hashes se calculan sobre representación canónica documentada en routes, middleware, request validation; aceptación: integridad reproducible. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-260** — verificación de hash no se presenta como autenticación de fuente en routes, middleware, request validation; aceptación: sin falsa garantía. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-261** — colecciones y objetos retornados no permiten mutación indirecta en routes, middleware, request validation; aceptación: inmutabilidad profunda. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-262** — reintentos e invocaciones repetidas son idempotentes cuando corresponde en routes, middleware, request validation; aceptación: sin duplicados. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-263** — operaciones concurrentes conservan consistencia y orden en routes, middleware, request validation; aceptación: sin carreras. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-264** — límites, timeout y cancelación evitan consumo ilimitado en routes, middleware, request validation; aceptación: recursos acotados. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-265** — salidas de red restringen protocolos, destinos y redirecciones en routes, middleware, request validation; aceptación: protección SSRF. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-266** — mensajes de error distinguen fallo, ausencia y estado inconcluso en routes, middleware, request validation; aceptación: semántica honesta. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-267** — registros de auditoría contienen actor, acción, tiempo y resultado en routes, middleware, request validation; aceptación: trazabilidad. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-268** — datos personales se minimizan, clasifican y retienen con política en routes, middleware, request validation; aceptación: privacidad por diseño. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-269** — aislamiento multiusuario/tenant se valida con pruebas cruzadas en routes, middleware, request validation; aceptación: sin fuga entre tenants. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-270** — dependencias, versiones y licencias están inventariadas en routes, middleware, request validation; aceptación: supply chain. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-271** — pruebas positivas cubren la ruta nominal y sus invariantes en routes, middleware, request validation; aceptación: caso nominal. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-272** — pruebas negativas cubren abuso, datos inválidos y permisos denegados en routes, middleware, request validation; aceptación: caso adversarial. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-273** — pruebas de regresión reproducen el hallazgo con una aserción en routes, middleware, request validation; aceptación: regresión bloqueante. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-274** — observabilidad permite diagnosticar sin exponer contenido sensible en routes, middleware, request validation; aceptación: logs seguros. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-275** — documentación declara limitaciones, estado real y criterio de aceptación en routes, middleware, request validation; aceptación: sin sobreafirmaciones. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.

### 12. Identidad, autenticación y autorización

**Rutas objetivo:** `src/identity/*; src/security/api-token.ts; src/server.ts`  
**Alcance:** principal, token, roles, trust boundary

- [ ] **AUD-276** — contrato y tipos coinciden con la implementación real en principal, token, roles, trust boundary; aceptación: CONTRACT ≠ IMPLEMENTED. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-277** — módulo se registra una sola vez en el runtime canónico en principal, token, roles, trust boundary; aceptación: sin runtime paralelo. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-278** — todas las rutas de entrada validan tipo, tamaño y forma en principal, token, roles, trust boundary; aceptación: rechazo fail-closed. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-279** — valores ausentes, nulos y malformados producen error explícito en principal, token, roles, trust boundary; aceptación: sin coerción silenciosa. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-280** — permisos se comprueban en servidor y no en el cliente en principal, token, roles, trust boundary; aceptación: confianza cero. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-281** — roles y principal provienen de identidad autenticada en principal, token, roles, trust boundary; aceptación: sin elevación desde payload. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-282** — errores no filtran secretos, PII, tokens ni contenido privado en principal, token, roles, trust boundary; aceptación: redacción verificada. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-283** — estados de éxito requieren evidencia de operación real en principal, token, roles, trust boundary; aceptación: sin éxito simulado. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-284** — hashes se calculan sobre representación canónica documentada en principal, token, roles, trust boundary; aceptación: integridad reproducible. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-285** — verificación de hash no se presenta como autenticación de fuente en principal, token, roles, trust boundary; aceptación: sin falsa garantía. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-286** — colecciones y objetos retornados no permiten mutación indirecta en principal, token, roles, trust boundary; aceptación: inmutabilidad profunda. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-287** — reintentos e invocaciones repetidas son idempotentes cuando corresponde en principal, token, roles, trust boundary; aceptación: sin duplicados. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-288** — operaciones concurrentes conservan consistencia y orden en principal, token, roles, trust boundary; aceptación: sin carreras. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-289** — límites, timeout y cancelación evitan consumo ilimitado en principal, token, roles, trust boundary; aceptación: recursos acotados. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-290** — salidas de red restringen protocolos, destinos y redirecciones en principal, token, roles, trust boundary; aceptación: protección SSRF. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-291** — mensajes de error distinguen fallo, ausencia y estado inconcluso en principal, token, roles, trust boundary; aceptación: semántica honesta. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-292** — registros de auditoría contienen actor, acción, tiempo y resultado en principal, token, roles, trust boundary; aceptación: trazabilidad. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-293** — datos personales se minimizan, clasifican y retienen con política en principal, token, roles, trust boundary; aceptación: privacidad por diseño. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-294** — aislamiento multiusuario/tenant se valida con pruebas cruzadas en principal, token, roles, trust boundary; aceptación: sin fuga entre tenants. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-295** — dependencias, versiones y licencias están inventariadas en principal, token, roles, trust boundary; aceptación: supply chain. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-296** — pruebas positivas cubren la ruta nominal y sus invariantes en principal, token, roles, trust boundary; aceptación: caso nominal. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-297** — pruebas negativas cubren abuso, datos inválidos y permisos denegados en principal, token, roles, trust boundary; aceptación: caso adversarial. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-298** — pruebas de regresión reproducen el hallazgo con una aserción en principal, token, roles, trust boundary; aceptación: regresión bloqueante. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-299** — observabilidad permite diagnosticar sin exponer contenido sensible en principal, token, roles, trust boundary; aceptación: logs seguros. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-300** — documentación declara limitaciones, estado real y criterio de aceptación en principal, token, roles, trust boundary; aceptación: sin sobreafirmaciones. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.

### 13. Seguridad de secretos y privacidad

**Rutas objetivo:** `src/security/*; .env.example; docs/ENVIRONMENT.md`  
**Alcance:** secrets, redaction, PII, privacy

- [ ] **AUD-301** — contrato y tipos coinciden con la implementación real en secrets, redaction, PII, privacy; aceptación: CONTRACT ≠ IMPLEMENTED. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-302** — módulo se registra una sola vez en el runtime canónico en secrets, redaction, PII, privacy; aceptación: sin runtime paralelo. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-303** — todas las rutas de entrada validan tipo, tamaño y forma en secrets, redaction, PII, privacy; aceptación: rechazo fail-closed. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-304** — valores ausentes, nulos y malformados producen error explícito en secrets, redaction, PII, privacy; aceptación: sin coerción silenciosa. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-305** — permisos se comprueban en servidor y no en el cliente en secrets, redaction, PII, privacy; aceptación: confianza cero. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-306** — roles y principal provienen de identidad autenticada en secrets, redaction, PII, privacy; aceptación: sin elevación desde payload. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-307** — errores no filtran secretos, PII, tokens ni contenido privado en secrets, redaction, PII, privacy; aceptación: redacción verificada. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-308** — estados de éxito requieren evidencia de operación real en secrets, redaction, PII, privacy; aceptación: sin éxito simulado. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-309** — hashes se calculan sobre representación canónica documentada en secrets, redaction, PII, privacy; aceptación: integridad reproducible. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-310** — verificación de hash no se presenta como autenticación de fuente en secrets, redaction, PII, privacy; aceptación: sin falsa garantía. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-311** — colecciones y objetos retornados no permiten mutación indirecta en secrets, redaction, PII, privacy; aceptación: inmutabilidad profunda. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-312** — reintentos e invocaciones repetidas son idempotentes cuando corresponde en secrets, redaction, PII, privacy; aceptación: sin duplicados. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-313** — operaciones concurrentes conservan consistencia y orden en secrets, redaction, PII, privacy; aceptación: sin carreras. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-314** — límites, timeout y cancelación evitan consumo ilimitado en secrets, redaction, PII, privacy; aceptación: recursos acotados. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-315** — salidas de red restringen protocolos, destinos y redirecciones en secrets, redaction, PII, privacy; aceptación: protección SSRF. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-316** — mensajes de error distinguen fallo, ausencia y estado inconcluso en secrets, redaction, PII, privacy; aceptación: semántica honesta. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-317** — registros de auditoría contienen actor, acción, tiempo y resultado en secrets, redaction, PII, privacy; aceptación: trazabilidad. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-318** — datos personales se minimizan, clasifican y retienen con política en secrets, redaction, PII, privacy; aceptación: privacidad por diseño. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-319** — aislamiento multiusuario/tenant se valida con pruebas cruzadas en secrets, redaction, PII, privacy; aceptación: sin fuga entre tenants. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-320** — dependencias, versiones y licencias están inventariadas en secrets, redaction, PII, privacy; aceptación: supply chain. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-321** — pruebas positivas cubren la ruta nominal y sus invariantes en secrets, redaction, PII, privacy; aceptación: caso nominal. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-322** — pruebas negativas cubren abuso, datos inválidos y permisos denegados en secrets, redaction, PII, privacy; aceptación: caso adversarial. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-323** — pruebas de regresión reproducen el hallazgo con una aserción en secrets, redaction, PII, privacy; aceptación: regresión bloqueante. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-324** — observabilidad permite diagnosticar sin exponer contenido sensible en secrets, redaction, PII, privacy; aceptación: logs seguros. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-325** — documentación declara limitaciones, estado real y criterio de aceptación en secrets, redaction, PII, privacy; aceptación: sin sobreafirmaciones. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.

### 14. Observabilidad, métricas y diagnóstico

**Rutas objetivo:** `src/telemetry/*; src/plugins/diff-observatory.ts`  
**Alcance:** logs, metrics, traces, redaction

- [ ] **AUD-326** — contrato y tipos coinciden con la implementación real en logs, metrics, traces, redaction; aceptación: CONTRACT ≠ IMPLEMENTED. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-327** — módulo se registra una sola vez en el runtime canónico en logs, metrics, traces, redaction; aceptación: sin runtime paralelo. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-328** — todas las rutas de entrada validan tipo, tamaño y forma en logs, metrics, traces, redaction; aceptación: rechazo fail-closed. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-329** — valores ausentes, nulos y malformados producen error explícito en logs, metrics, traces, redaction; aceptación: sin coerción silenciosa. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-330** — permisos se comprueban en servidor y no en el cliente en logs, metrics, traces, redaction; aceptación: confianza cero. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-331** — roles y principal provienen de identidad autenticada en logs, metrics, traces, redaction; aceptación: sin elevación desde payload. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-332** — errores no filtran secretos, PII, tokens ni contenido privado en logs, metrics, traces, redaction; aceptación: redacción verificada. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-333** — estados de éxito requieren evidencia de operación real en logs, metrics, traces, redaction; aceptación: sin éxito simulado. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-334** — hashes se calculan sobre representación canónica documentada en logs, metrics, traces, redaction; aceptación: integridad reproducible. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-335** — verificación de hash no se presenta como autenticación de fuente en logs, metrics, traces, redaction; aceptación: sin falsa garantía. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-336** — colecciones y objetos retornados no permiten mutación indirecta en logs, metrics, traces, redaction; aceptación: inmutabilidad profunda. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-337** — reintentos e invocaciones repetidas son idempotentes cuando corresponde en logs, metrics, traces, redaction; aceptación: sin duplicados. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-338** — operaciones concurrentes conservan consistencia y orden en logs, metrics, traces, redaction; aceptación: sin carreras. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-339** — límites, timeout y cancelación evitan consumo ilimitado en logs, metrics, traces, redaction; aceptación: recursos acotados. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-340** — salidas de red restringen protocolos, destinos y redirecciones en logs, metrics, traces, redaction; aceptación: protección SSRF. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-341** — mensajes de error distinguen fallo, ausencia y estado inconcluso en logs, metrics, traces, redaction; aceptación: semántica honesta. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-342** — registros de auditoría contienen actor, acción, tiempo y resultado en logs, metrics, traces, redaction; aceptación: trazabilidad. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-343** — datos personales se minimizan, clasifican y retienen con política en logs, metrics, traces, redaction; aceptación: privacidad por diseño. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-344** — aislamiento multiusuario/tenant se valida con pruebas cruzadas en logs, metrics, traces, redaction; aceptación: sin fuga entre tenants. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-345** — dependencias, versiones y licencias están inventariadas en logs, metrics, traces, redaction; aceptación: supply chain. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-346** — pruebas positivas cubren la ruta nominal y sus invariantes en logs, metrics, traces, redaction; aceptación: caso nominal. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-347** — pruebas negativas cubren abuso, datos inválidos y permisos denegados en logs, metrics, traces, redaction; aceptación: caso adversarial. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-348** — pruebas de regresión reproducen el hallazgo con una aserción en logs, metrics, traces, redaction; aceptación: regresión bloqueante. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-349** — observabilidad permite diagnosticar sin exponer contenido sensible en logs, metrics, traces, redaction; aceptación: logs seguros. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-350** — documentación declara limitaciones, estado real y criterio de aceptación en logs, metrics, traces, redaction; aceptación: sin sobreafirmaciones. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.

### 15. Proveedores de IA y modelos

**Rutas objetivo:** `src/cognition/*; src/server.ts; src/providers/*`  
**Alcance:** LLM providers, prompt construction, failure modes

- [ ] **AUD-351** — contrato y tipos coinciden con la implementación real en LLM providers, prompt construction, failure modes; aceptación: CONTRACT ≠ IMPLEMENTED. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-352** — módulo se registra una sola vez en el runtime canónico en LLM providers, prompt construction, failure modes; aceptación: sin runtime paralelo. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-353** — todas las rutas de entrada validan tipo, tamaño y forma en LLM providers, prompt construction, failure modes; aceptación: rechazo fail-closed. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-354** — valores ausentes, nulos y malformados producen error explícito en LLM providers, prompt construction, failure modes; aceptación: sin coerción silenciosa. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-355** — permisos se comprueban en servidor y no en el cliente en LLM providers, prompt construction, failure modes; aceptación: confianza cero. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-356** — roles y principal provienen de identidad autenticada en LLM providers, prompt construction, failure modes; aceptación: sin elevación desde payload. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-357** — errores no filtran secretos, PII, tokens ni contenido privado en LLM providers, prompt construction, failure modes; aceptación: redacción verificada. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-358** — estados de éxito requieren evidencia de operación real en LLM providers, prompt construction, failure modes; aceptación: sin éxito simulado. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-359** — hashes se calculan sobre representación canónica documentada en LLM providers, prompt construction, failure modes; aceptación: integridad reproducible. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-360** — verificación de hash no se presenta como autenticación de fuente en LLM providers, prompt construction, failure modes; aceptación: sin falsa garantía. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-361** — colecciones y objetos retornados no permiten mutación indirecta en LLM providers, prompt construction, failure modes; aceptación: inmutabilidad profunda. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-362** — reintentos e invocaciones repetidas son idempotentes cuando corresponde en LLM providers, prompt construction, failure modes; aceptación: sin duplicados. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-363** — operaciones concurrentes conservan consistencia y orden en LLM providers, prompt construction, failure modes; aceptación: sin carreras. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-364** — límites, timeout y cancelación evitan consumo ilimitado en LLM providers, prompt construction, failure modes; aceptación: recursos acotados. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-365** — salidas de red restringen protocolos, destinos y redirecciones en LLM providers, prompt construction, failure modes; aceptación: protección SSRF. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-366** — mensajes de error distinguen fallo, ausencia y estado inconcluso en LLM providers, prompt construction, failure modes; aceptación: semántica honesta. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-367** — registros de auditoría contienen actor, acción, tiempo y resultado en LLM providers, prompt construction, failure modes; aceptación: trazabilidad. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-368** — datos personales se minimizan, clasifican y retienen con política en LLM providers, prompt construction, failure modes; aceptación: privacidad por diseño. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-369** — aislamiento multiusuario/tenant se valida con pruebas cruzadas en LLM providers, prompt construction, failure modes; aceptación: sin fuga entre tenants. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-370** — dependencias, versiones y licencias están inventariadas en LLM providers, prompt construction, failure modes; aceptación: supply chain. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-371** — pruebas positivas cubren la ruta nominal y sus invariantes en LLM providers, prompt construction, failure modes; aceptación: caso nominal. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-372** — pruebas negativas cubren abuso, datos inválidos y permisos denegados en LLM providers, prompt construction, failure modes; aceptación: caso adversarial. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-373** — pruebas de regresión reproducen el hallazgo con una aserción en LLM providers, prompt construction, failure modes; aceptación: regresión bloqueante. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-374** — observabilidad permite diagnosticar sin exponer contenido sensible en LLM providers, prompt construction, failure modes; aceptación: logs seguros. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-375** — documentación declara limitaciones, estado real y criterio de aceptación en LLM providers, prompt construction, failure modes; aceptación: sin sobreafirmaciones. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.

### 16. Quantum/PennyLane y servicios Python

**Rutas objetivo:** `src/quantum/*; services/pennylane_bridge.py`  
**Alcance:** quantum bridge, optional dependency, truthful status

- [ ] **AUD-376** — contrato y tipos coinciden con la implementación real en quantum bridge, optional dependency, truthful status; aceptación: CONTRACT ≠ IMPLEMENTED. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-377** — módulo se registra una sola vez en el runtime canónico en quantum bridge, optional dependency, truthful status; aceptación: sin runtime paralelo. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-378** — todas las rutas de entrada validan tipo, tamaño y forma en quantum bridge, optional dependency, truthful status; aceptación: rechazo fail-closed. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-379** — valores ausentes, nulos y malformados producen error explícito en quantum bridge, optional dependency, truthful status; aceptación: sin coerción silenciosa. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-380** — permisos se comprueban en servidor y no en el cliente en quantum bridge, optional dependency, truthful status; aceptación: confianza cero. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-381** — roles y principal provienen de identidad autenticada en quantum bridge, optional dependency, truthful status; aceptación: sin elevación desde payload. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-382** — errores no filtran secretos, PII, tokens ni contenido privado en quantum bridge, optional dependency, truthful status; aceptación: redacción verificada. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-383** — estados de éxito requieren evidencia de operación real en quantum bridge, optional dependency, truthful status; aceptación: sin éxito simulado. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-384** — hashes se calculan sobre representación canónica documentada en quantum bridge, optional dependency, truthful status; aceptación: integridad reproducible. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-385** — verificación de hash no se presenta como autenticación de fuente en quantum bridge, optional dependency, truthful status; aceptación: sin falsa garantía. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-386** — colecciones y objetos retornados no permiten mutación indirecta en quantum bridge, optional dependency, truthful status; aceptación: inmutabilidad profunda. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-387** — reintentos e invocaciones repetidas son idempotentes cuando corresponde en quantum bridge, optional dependency, truthful status; aceptación: sin duplicados. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-388** — operaciones concurrentes conservan consistencia y orden en quantum bridge, optional dependency, truthful status; aceptación: sin carreras. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-389** — límites, timeout y cancelación evitan consumo ilimitado en quantum bridge, optional dependency, truthful status; aceptación: recursos acotados. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-390** — salidas de red restringen protocolos, destinos y redirecciones en quantum bridge, optional dependency, truthful status; aceptación: protección SSRF. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-391** — mensajes de error distinguen fallo, ausencia y estado inconcluso en quantum bridge, optional dependency, truthful status; aceptación: semántica honesta. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-392** — registros de auditoría contienen actor, acción, tiempo y resultado en quantum bridge, optional dependency, truthful status; aceptación: trazabilidad. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-393** — datos personales se minimizan, clasifican y retienen con política en quantum bridge, optional dependency, truthful status; aceptación: privacidad por diseño. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-394** — aislamiento multiusuario/tenant se valida con pruebas cruzadas en quantum bridge, optional dependency, truthful status; aceptación: sin fuga entre tenants. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-395** — dependencias, versiones y licencias están inventariadas en quantum bridge, optional dependency, truthful status; aceptación: supply chain. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-396** — pruebas positivas cubren la ruta nominal y sus invariantes en quantum bridge, optional dependency, truthful status; aceptación: caso nominal. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-397** — pruebas negativas cubren abuso, datos inválidos y permisos denegados en quantum bridge, optional dependency, truthful status; aceptación: caso adversarial. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-398** — pruebas de regresión reproducen el hallazgo con una aserción en quantum bridge, optional dependency, truthful status; aceptación: regresión bloqueante. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-399** — observabilidad permite diagnosticar sin exponer contenido sensible en quantum bridge, optional dependency, truthful status; aceptación: logs seguros. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-400** — documentación declara limitaciones, estado real y criterio de aceptación en quantum bridge, optional dependency, truthful status; aceptación: sin sobreafirmaciones. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.

### 17. Pruebas unitarias, integración y regresión

**Rutas objetivo:** `test/*; vitest.config.*`  
**Alcance:** coverage, fixtures, security regressions

- [ ] **AUD-401** — contrato y tipos coinciden con la implementación real en coverage, fixtures, security regressions; aceptación: CONTRACT ≠ IMPLEMENTED. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-402** — módulo se registra una sola vez en el runtime canónico en coverage, fixtures, security regressions; aceptación: sin runtime paralelo. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-403** — todas las rutas de entrada validan tipo, tamaño y forma en coverage, fixtures, security regressions; aceptación: rechazo fail-closed. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-404** — valores ausentes, nulos y malformados producen error explícito en coverage, fixtures, security regressions; aceptación: sin coerción silenciosa. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-405** — permisos se comprueban en servidor y no en el cliente en coverage, fixtures, security regressions; aceptación: confianza cero. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-406** — roles y principal provienen de identidad autenticada en coverage, fixtures, security regressions; aceptación: sin elevación desde payload. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-407** — errores no filtran secretos, PII, tokens ni contenido privado en coverage, fixtures, security regressions; aceptación: redacción verificada. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-408** — estados de éxito requieren evidencia de operación real en coverage, fixtures, security regressions; aceptación: sin éxito simulado. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-409** — hashes se calculan sobre representación canónica documentada en coverage, fixtures, security regressions; aceptación: integridad reproducible. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-410** — verificación de hash no se presenta como autenticación de fuente en coverage, fixtures, security regressions; aceptación: sin falsa garantía. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-411** — colecciones y objetos retornados no permiten mutación indirecta en coverage, fixtures, security regressions; aceptación: inmutabilidad profunda. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-412** — reintentos e invocaciones repetidas son idempotentes cuando corresponde en coverage, fixtures, security regressions; aceptación: sin duplicados. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-413** — operaciones concurrentes conservan consistencia y orden en coverage, fixtures, security regressions; aceptación: sin carreras. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-414** — límites, timeout y cancelación evitan consumo ilimitado en coverage, fixtures, security regressions; aceptación: recursos acotados. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-415** — salidas de red restringen protocolos, destinos y redirecciones en coverage, fixtures, security regressions; aceptación: protección SSRF. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-416** — mensajes de error distinguen fallo, ausencia y estado inconcluso en coverage, fixtures, security regressions; aceptación: semántica honesta. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-417** — registros de auditoría contienen actor, acción, tiempo y resultado en coverage, fixtures, security regressions; aceptación: trazabilidad. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-418** — datos personales se minimizan, clasifican y retienen con política en coverage, fixtures, security regressions; aceptación: privacidad por diseño. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-419** — aislamiento multiusuario/tenant se valida con pruebas cruzadas en coverage, fixtures, security regressions; aceptación: sin fuga entre tenants. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-420** — dependencias, versiones y licencias están inventariadas en coverage, fixtures, security regressions; aceptación: supply chain. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-421** — pruebas positivas cubren la ruta nominal y sus invariantes en coverage, fixtures, security regressions; aceptación: caso nominal. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-422** — pruebas negativas cubren abuso, datos inválidos y permisos denegados en coverage, fixtures, security regressions; aceptación: caso adversarial. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-423** — pruebas de regresión reproducen el hallazgo con una aserción en coverage, fixtures, security regressions; aceptación: regresión bloqueante. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-424** — observabilidad permite diagnosticar sin exponer contenido sensible en coverage, fixtures, security regressions; aceptación: logs seguros. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-425** — documentación declara limitaciones, estado real y criterio de aceptación en coverage, fixtures, security regressions; aceptación: sin sobreafirmaciones. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.

### 18. Build, dependencias y CI/CD

**Rutas objetivo:** `package.json; pnpm-lock.yaml; tsconfig*.json; .github/workflows/*`  
**Alcance:** reproducibility, pipeline, supply chain

- [ ] **AUD-426** — contrato y tipos coinciden con la implementación real en reproducibility, pipeline, supply chain; aceptación: CONTRACT ≠ IMPLEMENTED. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-427** — módulo se registra una sola vez en el runtime canónico en reproducibility, pipeline, supply chain; aceptación: sin runtime paralelo. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-428** — todas las rutas de entrada validan tipo, tamaño y forma en reproducibility, pipeline, supply chain; aceptación: rechazo fail-closed. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-429** — valores ausentes, nulos y malformados producen error explícito en reproducibility, pipeline, supply chain; aceptación: sin coerción silenciosa. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-430** — permisos se comprueban en servidor y no en el cliente en reproducibility, pipeline, supply chain; aceptación: confianza cero. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-431** — roles y principal provienen de identidad autenticada en reproducibility, pipeline, supply chain; aceptación: sin elevación desde payload. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-432** — errores no filtran secretos, PII, tokens ni contenido privado en reproducibility, pipeline, supply chain; aceptación: redacción verificada. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-433** — estados de éxito requieren evidencia de operación real en reproducibility, pipeline, supply chain; aceptación: sin éxito simulado. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-434** — hashes se calculan sobre representación canónica documentada en reproducibility, pipeline, supply chain; aceptación: integridad reproducible. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-435** — verificación de hash no se presenta como autenticación de fuente en reproducibility, pipeline, supply chain; aceptación: sin falsa garantía. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-436** — colecciones y objetos retornados no permiten mutación indirecta en reproducibility, pipeline, supply chain; aceptación: inmutabilidad profunda. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-437** — reintentos e invocaciones repetidas son idempotentes cuando corresponde en reproducibility, pipeline, supply chain; aceptación: sin duplicados. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-438** — operaciones concurrentes conservan consistencia y orden en reproducibility, pipeline, supply chain; aceptación: sin carreras. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-439** — límites, timeout y cancelación evitan consumo ilimitado en reproducibility, pipeline, supply chain; aceptación: recursos acotados. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-440** — salidas de red restringen protocolos, destinos y redirecciones en reproducibility, pipeline, supply chain; aceptación: protección SSRF. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-441** — mensajes de error distinguen fallo, ausencia y estado inconcluso en reproducibility, pipeline, supply chain; aceptación: semántica honesta. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-442** — registros de auditoría contienen actor, acción, tiempo y resultado en reproducibility, pipeline, supply chain; aceptación: trazabilidad. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-443** — datos personales se minimizan, clasifican y retienen con política en reproducibility, pipeline, supply chain; aceptación: privacidad por diseño. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-444** — aislamiento multiusuario/tenant se valida con pruebas cruzadas en reproducibility, pipeline, supply chain; aceptación: sin fuga entre tenants. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-445** — dependencias, versiones y licencias están inventariadas en reproducibility, pipeline, supply chain; aceptación: supply chain. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-446** — pruebas positivas cubren la ruta nominal y sus invariantes en reproducibility, pipeline, supply chain; aceptación: caso nominal. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-447** — pruebas negativas cubren abuso, datos inválidos y permisos denegados en reproducibility, pipeline, supply chain; aceptación: caso adversarial. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-448** — pruebas de regresión reproducen el hallazgo con una aserción en reproducibility, pipeline, supply chain; aceptación: regresión bloqueante. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-449** — observabilidad permite diagnosticar sin exponer contenido sensible en reproducibility, pipeline, supply chain; aceptación: logs seguros. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-450** — documentación declara limitaciones, estado real y criterio de aceptación en reproducibility, pipeline, supply chain; aceptación: sin sobreafirmaciones. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.

### 19. Despliegue, resiliencia y operación

**Rutas objetivo:** `scripts/production-evidence.mjs; docs/ENVIRONMENT.md; vercel.json; Dockerfile`  
**Alcance:** readiness, health, rollback, config

- [ ] **AUD-451** — contrato y tipos coinciden con la implementación real en readiness, health, rollback, config; aceptación: CONTRACT ≠ IMPLEMENTED. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-452** — módulo se registra una sola vez en el runtime canónico en readiness, health, rollback, config; aceptación: sin runtime paralelo. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-453** — todas las rutas de entrada validan tipo, tamaño y forma en readiness, health, rollback, config; aceptación: rechazo fail-closed. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-454** — valores ausentes, nulos y malformados producen error explícito en readiness, health, rollback, config; aceptación: sin coerción silenciosa. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-455** — permisos se comprueban en servidor y no en el cliente en readiness, health, rollback, config; aceptación: confianza cero. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-456** — roles y principal provienen de identidad autenticada en readiness, health, rollback, config; aceptación: sin elevación desde payload. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-457** — errores no filtran secretos, PII, tokens ni contenido privado en readiness, health, rollback, config; aceptación: redacción verificada. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-458** — estados de éxito requieren evidencia de operación real en readiness, health, rollback, config; aceptación: sin éxito simulado. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-459** — hashes se calculan sobre representación canónica documentada en readiness, health, rollback, config; aceptación: integridad reproducible. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-460** — verificación de hash no se presenta como autenticación de fuente en readiness, health, rollback, config; aceptación: sin falsa garantía. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-461** — colecciones y objetos retornados no permiten mutación indirecta en readiness, health, rollback, config; aceptación: inmutabilidad profunda. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-462** — reintentos e invocaciones repetidas son idempotentes cuando corresponde en readiness, health, rollback, config; aceptación: sin duplicados. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-463** — operaciones concurrentes conservan consistencia y orden en readiness, health, rollback, config; aceptación: sin carreras. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-464** — límites, timeout y cancelación evitan consumo ilimitado en readiness, health, rollback, config; aceptación: recursos acotados. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-465** — salidas de red restringen protocolos, destinos y redirecciones en readiness, health, rollback, config; aceptación: protección SSRF. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-466** — mensajes de error distinguen fallo, ausencia y estado inconcluso en readiness, health, rollback, config; aceptación: semántica honesta. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-467** — registros de auditoría contienen actor, acción, tiempo y resultado en readiness, health, rollback, config; aceptación: trazabilidad. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-468** — datos personales se minimizan, clasifican y retienen con política en readiness, health, rollback, config; aceptación: privacidad por diseño. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-469** — aislamiento multiusuario/tenant se valida con pruebas cruzadas en readiness, health, rollback, config; aceptación: sin fuga entre tenants. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-470** — dependencias, versiones y licencias están inventariadas en readiness, health, rollback, config; aceptación: supply chain. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-471** — pruebas positivas cubren la ruta nominal y sus invariantes en readiness, health, rollback, config; aceptación: caso nominal. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-472** — pruebas negativas cubren abuso, datos inválidos y permisos denegados en readiness, health, rollback, config; aceptación: caso adversarial. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-473** — pruebas de regresión reproducen el hallazgo con una aserción en readiness, health, rollback, config; aceptación: regresión bloqueante. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-474** — observabilidad permite diagnosticar sin exponer contenido sensible en readiness, health, rollback, config; aceptación: logs seguros. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-475** — documentación declara limitaciones, estado real y criterio de aceptación en readiness, health, rollback, config; aceptación: sin sobreafirmaciones. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.

### 20. Documentación, licencias y cumplimiento

**Rutas objetivo:** `README.md; LICENSE; SECURITY.md; docs/*`  
**Alcance:** claims, legal, IP, release evidence

- [ ] **AUD-476** — contrato y tipos coinciden con la implementación real en claims, legal, IP, release evidence; aceptación: CONTRACT ≠ IMPLEMENTED. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-477** — módulo se registra una sola vez en el runtime canónico en claims, legal, IP, release evidence; aceptación: sin runtime paralelo. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-478** — todas las rutas de entrada validan tipo, tamaño y forma en claims, legal, IP, release evidence; aceptación: rechazo fail-closed. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-479** — valores ausentes, nulos y malformados producen error explícito en claims, legal, IP, release evidence; aceptación: sin coerción silenciosa. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-480** — permisos se comprueban en servidor y no en el cliente en claims, legal, IP, release evidence; aceptación: confianza cero. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-481** — roles y principal provienen de identidad autenticada en claims, legal, IP, release evidence; aceptación: sin elevación desde payload. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-482** — errores no filtran secretos, PII, tokens ni contenido privado en claims, legal, IP, release evidence; aceptación: redacción verificada. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-483** — estados de éxito requieren evidencia de operación real en claims, legal, IP, release evidence; aceptación: sin éxito simulado. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-484** — hashes se calculan sobre representación canónica documentada en claims, legal, IP, release evidence; aceptación: integridad reproducible. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-485** — verificación de hash no se presenta como autenticación de fuente en claims, legal, IP, release evidence; aceptación: sin falsa garantía. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-486** — colecciones y objetos retornados no permiten mutación indirecta en claims, legal, IP, release evidence; aceptación: inmutabilidad profunda. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-487** — reintentos e invocaciones repetidas son idempotentes cuando corresponde en claims, legal, IP, release evidence; aceptación: sin duplicados. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-488** — operaciones concurrentes conservan consistencia y orden en claims, legal, IP, release evidence; aceptación: sin carreras. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-489** — límites, timeout y cancelación evitan consumo ilimitado en claims, legal, IP, release evidence; aceptación: recursos acotados. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-490** — salidas de red restringen protocolos, destinos y redirecciones en claims, legal, IP, release evidence; aceptación: protección SSRF. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-491** — mensajes de error distinguen fallo, ausencia y estado inconcluso en claims, legal, IP, release evidence; aceptación: semántica honesta. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-492** — registros de auditoría contienen actor, acción, tiempo y resultado en claims, legal, IP, release evidence; aceptación: trazabilidad. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-493** — datos personales se minimizan, clasifican y retienen con política en claims, legal, IP, release evidence; aceptación: privacidad por diseño. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-494** — aislamiento multiusuario/tenant se valida con pruebas cruzadas en claims, legal, IP, release evidence; aceptación: sin fuga entre tenants. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-495** — dependencias, versiones y licencias están inventariadas en claims, legal, IP, release evidence; aceptación: supply chain. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-496** — pruebas positivas cubren la ruta nominal y sus invariantes en claims, legal, IP, release evidence; aceptación: caso nominal. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-497** — pruebas negativas cubren abuso, datos inválidos y permisos denegados en claims, legal, IP, release evidence; aceptación: caso adversarial. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-498** — pruebas de regresión reproducen el hallazgo con una aserción en claims, legal, IP, release evidence; aceptación: regresión bloqueante. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-499** — observabilidad permite diagnosticar sin exponer contenido sensible en claims, legal, IP, release evidence; aceptación: logs seguros. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-500** — documentación declara limitaciones, estado real y criterio de aceptación en claims, legal, IP, release evidence; aceptación: sin sobreafirmaciones. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.

## Plantilla obligatoria para registrar cada hallazgo

Para cambiar cualquier punto a CONFIRMADO, completar: ID; SHA auditado; ruta y rango de líneas; precondiciones; pasos de reproducción; resultado observado; resultado esperado; prueba de regresión; impacto; severidad; responsable; corrección propuesta; estado de CI; fecha de revalidación.

## Puertas de salida para declarar listo para producción

- [ ] Todos los P0/P1 cerrados o con excepción documentada, firmada y con caducidad.
- [ ] Typecheck, pruebas, build y escáneres pasan sobre el mismo SHA candidato.
- [ ] Se verifica autorización de servidor, aislamiento de datos y redacción de secretos.
- [ ] Se valida restauración de backups y rollback en entorno representativo.
- [ ] Cada proveedor externo se declara CONFIGURADO, NO_CONFIGURADO o NO_VERIFICADO con evidencia.
- [ ] El release incorpora manifest de evidencia, commit completo, resultados y limitaciones.
- [ ] El README no atribuye certificaciones, cumplimiento jurídico o porcentajes de avance sin evidencia.
- [ ] Se publica una matriz de licencias por componente, datos y zona de despliegue; la licencia del repositorio no se confunde con los derechos sobre datos/modelos.

## Referencias internas

- [README](../README.md)
- [Auditoría Genesis V6](./AUDIT_GENESIS_V6_2026-10-08.md)
- [Auditoría de evolución del ecosistema](./ECOSYSTEM_EVOLUTION_AUDIT_2026-10-09.md)
- [Configuración de entorno](./ENVIRONMENT.md)
- [Política de seguridad](../SECURITY.md)

---

**Conteo generado:** 500 puntos de control (20 dominios × 25 controles). Los puntos pendientes no deben reportarse como errores confirmados.


---

## Documento B — `docs/AUDIT_CHECKLIST_500_ISABELLA_GENESISAI.md`

---

# Isabella Villaseñor GenesisAI — Checklist de auditoría total de 500 controles

> **Importante:** son 500 controles accionables de auditoría, no 500 defectos confirmados. No marcar un control como aprobado sin evidencia. Un control sin inspección, prueba o resultado reproducible permanece pendiente.

- Repositorio: `OsoPanda1/Isabella-Villase-or-GenesisAI`
- Rama: `audit/checklist-500-oct-2026`
- Arquitectura: Isabella GenesisAI es el runtime canónico; el resto del ecosistema debe integrarse como módulos, adaptadores o servicios subordinados.
- Estados: `[ ]` pendiente · `[x]` aprobado con evidencia · `[!]` defecto reproducido · `[~]` mitigación parcial.

## Hallazgos de código identificados durante esta revisión

1. [~] La clasificación de duplicados utilizaba igualdad de fingerprints estructurales/semánticos para emitir `VERIFIED_DUPLICATE`. La igualdad de resúmenes con pérdida no demuestra identidad exacta. Se modificó la clasificación en una rama de trabajo anterior; ese ref ya no estaba disponible, por lo que debe reaplicarse y validarse en esta rama antes de considerarlo integrado.
2. [~] En IKES, congelar solo el objeto exterior no protegía todos los arrays y objetos anidados. Se preparó una corrección en una rama que no se pudo resolver al crear el documento; la corrección debe verificarse y reaplicarse en una rama activa.
3. [ ] El manifiesto de evidencia y los gates de estabilidad requieren revisión para asegurar que el identificador cubra todos los campos materiales y que una excepción no se apruebe mediante un booleano controlado por el llamador.
4. [ ] Los endpoints cognitivos requieren verificación de rate limiting y límites de entrada en cada ruta. No declarar la mitigación implementada hasta probar las respuestas 413/429 y confirmar CI.
5. [ ] La rama de checklist parte de `main`; este documento no incorpora por sí mismo los cambios de código de otras ramas.
6. [ ] No considerar el sistema listo para producción o merge hasta que typecheck, pruebas, escaneos de seguridad y CI se ejecuten sobre el SHA final y queden aprobados.

## Registro obligatorio por hallazgo

Registrar: ID, severidad, repositorio, archivo y líneas, evidencia reproducible, impacto, propietario, corrección, prueba de regresión, SHA y estado. No convertir riesgos potenciales en defectos confirmados sin evidencia.

## 1. Inventario de repositorios

- [ ] **AUD-001** inventario de repositorios, forks, ramas, visibilidad y mantenimiento: Validar contrato, esquema y compatibilidad; añadir pruebas para campos inválidos. (dimensión: contrato).
- [ ] **AUD-002** inventario de repositorios, forks, ramas, visibilidad y mantenimiento: Exigir evidencia reproducible del comportamiento; documentación sola no cuenta como prueba. (dimensión: evidencia).
- [ ] **AUD-003** inventario de repositorios, forks, ramas, visibilidad y mantenimiento: Probar configuración ausente, proveedor caído y error interno; evitar declarar éxito. (dimensión: fallo seguro).
- [ ] **AUD-004** inventario de repositorios, forks, ramas, visibilidad y mantenimiento: Comprobar que la autorización provenga del servidor y que el cliente no pueda elevar privilegios. (dimensión: autorización).
- [ ] **AUD-005** inventario de repositorios, forks, ramas, visibilidad y mantenimiento: Definir límites de tamaño, tiempo, concurrencia y consumo; probar el límite y el exceso. (dimensión: límites).
- [ ] **AUD-006** inventario de repositorios, forks, ramas, visibilidad y mantenimiento: Comprobar que tokens, claves y datos personales no aparezcan en logs o respuestas. (dimensión: secretos).
- [ ] **AUD-007** inventario de repositorios, forks, ramas, visibilidad y mantenimiento: Verificar que referencias y objetos anidados no alteren estado que se considera inmutable. (dimensión: mutabilidad).
- [ ] **AUD-008** inventario de repositorios, forks, ramas, visibilidad y mantenimiento: Probar reintentos, duplicados y concurrencia sin duplicar efectos secundarios. (dimensión: reintentos).
- [ ] **AUD-009** inventario de repositorios, forks, ramas, visibilidad y mantenimiento: Registrar estado, correlación y motivo sin filtrar datos sensibles ni confundir simulación con ejecución. (dimensión: observabilidad).
- [ ] **AUD-010** inventario de repositorios, forks, ramas, visibilidad y mantenimiento: Probar el contrato con el runtime canónico y con el adaptador real, no solo mocks permisivos. (dimensión: integración).
- [ ] **AUD-011** inventario de repositorios, forks, ramas, visibilidad y mantenimiento: Agregar prueba para entrada maliciosa, permiso denegado o evidencia incompleta. (dimensión: prueba negativa).
- [ ] **AUD-012** inventario de repositorios, forks, ramas, visibilidad y mantenimiento: Vincular cada defecto confirmado con una prueba que falle antes y pase después de corregirlo. (dimensión: regresión).
- [ ] **AUD-013** inventario de repositorios, forks, ramas, visibilidad y mantenimiento: Identificar dependencias directas/transitivas, versiones, licencias y vulnerabilidades pertinentes. (dimensión: dependencias).
- [ ] **AUD-014** inventario de repositorios, forks, ramas, visibilidad y mantenimiento: Validar variables requeridas y defaults; configuración crítica ausente debe fallar cerrada. (dimensión: configuración).
- [ ] **AUD-015** inventario de repositorios, forks, ramas, visibilidad y mantenimiento: Alinear la documentación con el código ejecutado y marcar limitaciones no implementadas. (dimensión: documentación).
- [ ] **AUD-016** inventario de repositorios, forks, ramas, visibilidad y mantenimiento: Registrar versión, commit, algoritmo o modelo que originó el resultado y permitir reproducirlo. (dimensión: versionado).
- [ ] **AUD-017** inventario de repositorios, forks, ramas, visibilidad y mantenimiento: Probar separación entre usuarios, tenants, sesiones y datos restringidos. (dimensión: aislamiento).
- [ ] **AUD-018** inventario de repositorios, forks, ramas, visibilidad y mantenimiento: Verificar que acciones críticas generen un evento de auditoría correlacionable e íntegro. (dimensión: auditoría).
- [ ] **AUD-019** inventario de repositorios, forks, ramas, visibilidad y mantenimiento: Probar recuperación tras reinicio, fallo parcial, desconexión o rollback. (dimensión: recuperación).
- [ ] **AUD-020** inventario de repositorios, forks, ramas, visibilidad y mantenimiento: Impedir promoción a producción si el control crítico está fallido, omitido o no evaluado. (dimensión: gate de release).

## 2. Runtime canónico

- [ ] **AUD-021** inicialización, ciclo de vida y unicidad del runtime Isabella GenesisAI: Validar contrato, esquema y compatibilidad; añadir pruebas para campos inválidos. (dimensión: contrato).
- [ ] **AUD-022** inicialización, ciclo de vida y unicidad del runtime Isabella GenesisAI: Exigir evidencia reproducible del comportamiento; documentación sola no cuenta como prueba. (dimensión: evidencia).
- [ ] **AUD-023** inicialización, ciclo de vida y unicidad del runtime Isabella GenesisAI: Probar configuración ausente, proveedor caído y error interno; evitar declarar éxito. (dimensión: fallo seguro).
- [ ] **AUD-024** inicialización, ciclo de vida y unicidad del runtime Isabella GenesisAI: Comprobar que la autorización provenga del servidor y que el cliente no pueda elevar privilegios. (dimensión: autorización).
- [ ] **AUD-025** inicialización, ciclo de vida y unicidad del runtime Isabella GenesisAI: Definir límites de tamaño, tiempo, concurrencia y consumo; probar el límite y el exceso. (dimensión: límites).
- [ ] **AUD-026** inicialización, ciclo de vida y unicidad del runtime Isabella GenesisAI: Comprobar que tokens, claves y datos personales no aparezcan en logs o respuestas. (dimensión: secretos).
- [ ] **AUD-027** inicialización, ciclo de vida y unicidad del runtime Isabella GenesisAI: Verificar que referencias y objetos anidados no alteren estado que se considera inmutable. (dimensión: mutabilidad).
- [ ] **AUD-028** inicialización, ciclo de vida y unicidad del runtime Isabella GenesisAI: Probar reintentos, duplicados y concurrencia sin duplicar efectos secundarios. (dimensión: reintentos).
- [ ] **AUD-029** inicialización, ciclo de vida y unicidad del runtime Isabella GenesisAI: Registrar estado, correlación y motivo sin filtrar datos sensibles ni confundir simulación con ejecución. (dimensión: observabilidad).
- [ ] **AUD-030** inicialización, ciclo de vida y unicidad del runtime Isabella GenesisAI: Probar el contrato con el runtime canónico y con el adaptador real, no solo mocks permisivos. (dimensión: integración).
- [ ] **AUD-031** inicialización, ciclo de vida y unicidad del runtime Isabella GenesisAI: Agregar prueba para entrada maliciosa, permiso denegado o evidencia incompleta. (dimensión: prueba negativa).
- [ ] **AUD-032** inicialización, ciclo de vida y unicidad del runtime Isabella GenesisAI: Vincular cada defecto confirmado con una prueba que falle antes y pase después de corregirlo. (dimensión: regresión).
- [ ] **AUD-033** inicialización, ciclo de vida y unicidad del runtime Isabella GenesisAI: Identificar dependencias directas/transitivas, versiones, licencias y vulnerabilidades pertinentes. (dimensión: dependencias).
- [ ] **AUD-034** inicialización, ciclo de vida y unicidad del runtime Isabella GenesisAI: Validar variables requeridas y defaults; configuración crítica ausente debe fallar cerrada. (dimensión: configuración).
- [ ] **AUD-035** inicialización, ciclo de vida y unicidad del runtime Isabella GenesisAI: Alinear la documentación con el código ejecutado y marcar limitaciones no implementadas. (dimensión: documentación).
- [ ] **AUD-036** inicialización, ciclo de vida y unicidad del runtime Isabella GenesisAI: Registrar versión, commit, algoritmo o modelo que originó el resultado y permitir reproducirlo. (dimensión: versionado).
- [ ] **AUD-037** inicialización, ciclo de vida y unicidad del runtime Isabella GenesisAI: Probar separación entre usuarios, tenants, sesiones y datos restringidos. (dimensión: aislamiento).
- [ ] **AUD-038** inicialización, ciclo de vida y unicidad del runtime Isabella GenesisAI: Verificar que acciones críticas generen un evento de auditoría correlacionable e íntegro. (dimensión: auditoría).
- [ ] **AUD-039** inicialización, ciclo de vida y unicidad del runtime Isabella GenesisAI: Probar recuperación tras reinicio, fallo parcial, desconexión o rollback. (dimensión: recuperación).
- [ ] **AUD-040** inicialización, ciclo de vida y unicidad del runtime Isabella GenesisAI: Impedir promoción a producción si el control crítico está fallido, omitido o no evaluado. (dimensión: gate de release).

## 3. Autenticación y autorización

- [ ] **AUD-041** identidad, roles, permisos, scopes y denegación por defecto: Validar contrato, esquema y compatibilidad; añadir pruebas para campos inválidos. (dimensión: contrato).
- [ ] **AUD-042** identidad, roles, permisos, scopes y denegación por defecto: Exigir evidencia reproducible del comportamiento; documentación sola no cuenta como prueba. (dimensión: evidencia).
- [ ] **AUD-043** identidad, roles, permisos, scopes y denegación por defecto: Probar configuración ausente, proveedor caído y error interno; evitar declarar éxito. (dimensión: fallo seguro).
- [ ] **AUD-044** identidad, roles, permisos, scopes y denegación por defecto: Comprobar que la autorización provenga del servidor y que el cliente no pueda elevar privilegios. (dimensión: autorización).
- [ ] **AUD-045** identidad, roles, permisos, scopes y denegación por defecto: Definir límites de tamaño, tiempo, concurrencia y consumo; probar el límite y el exceso. (dimensión: límites).
- [ ] **AUD-046** identidad, roles, permisos, scopes y denegación por defecto: Comprobar que tokens, claves y datos personales no aparezcan en logs o respuestas. (dimensión: secretos).
- [ ] **AUD-047** identidad, roles, permisos, scopes y denegación por defecto: Verificar que referencias y objetos anidados no alteren estado que se considera inmutable. (dimensión: mutabilidad).
- [ ] **AUD-048** identidad, roles, permisos, scopes y denegación por defecto: Probar reintentos, duplicados y concurrencia sin duplicar efectos secundarios. (dimensión: reintentos).
- [ ] **AUD-049** identidad, roles, permisos, scopes y denegación por defecto: Registrar estado, correlación y motivo sin filtrar datos sensibles ni confundir simulación con ejecución. (dimensión: observabilidad).
- [ ] **AUD-050** identidad, roles, permisos, scopes y denegación por defecto: Probar el contrato con el runtime canónico y con el adaptador real, no solo mocks permisivos. (dimensión: integración).
- [ ] **AUD-051** identidad, roles, permisos, scopes y denegación por defecto: Agregar prueba para entrada maliciosa, permiso denegado o evidencia incompleta. (dimensión: prueba negativa).
- [ ] **AUD-052** identidad, roles, permisos, scopes y denegación por defecto: Vincular cada defecto confirmado con una prueba que falle antes y pase después de corregirlo. (dimensión: regresión).
- [ ] **AUD-053** identidad, roles, permisos, scopes y denegación por defecto: Identificar dependencias directas/transitivas, versiones, licencias y vulnerabilidades pertinentes. (dimensión: dependencias).
- [ ] **AUD-054** identidad, roles, permisos, scopes y denegación por defecto: Validar variables requeridas y defaults; configuración crítica ausente debe fallar cerrada. (dimensión: configuración).
- [ ] **AUD-055** identidad, roles, permisos, scopes y denegación por defecto: Alinear la documentación con el código ejecutado y marcar limitaciones no implementadas. (dimensión: documentación).
- [ ] **AUD-056** identidad, roles, permisos, scopes y denegación por defecto: Registrar versión, commit, algoritmo o modelo que originó el resultado y permitir reproducirlo. (dimensión: versionado).
- [ ] **AUD-057** identidad, roles, permisos, scopes y denegación por defecto: Probar separación entre usuarios, tenants, sesiones y datos restringidos. (dimensión: aislamiento).
- [ ] **AUD-058** identidad, roles, permisos, scopes y denegación por defecto: Verificar que acciones críticas generen un evento de auditoría correlacionable e íntegro. (dimensión: auditoría).
- [ ] **AUD-059** identidad, roles, permisos, scopes y denegación por defecto: Probar recuperación tras reinicio, fallo parcial, desconexión o rollback. (dimensión: recuperación).
- [ ] **AUD-060** identidad, roles, permisos, scopes y denegación por defecto: Impedir promoción a producción si el control crítico está fallido, omitido o no evaluado. (dimensión: gate de release).

## 4. Validación de entrada

- [ ] **AUD-061** esquemas, límites, normalización y rechazo de payloads inválidos: Validar contrato, esquema y compatibilidad; añadir pruebas para campos inválidos. (dimensión: contrato).
- [ ] **AUD-062** esquemas, límites, normalización y rechazo de payloads inválidos: Exigir evidencia reproducible del comportamiento; documentación sola no cuenta como prueba. (dimensión: evidencia).
- [ ] **AUD-063** esquemas, límites, normalización y rechazo de payloads inválidos: Probar configuración ausente, proveedor caído y error interno; evitar declarar éxito. (dimensión: fallo seguro).
- [ ] **AUD-064** esquemas, límites, normalización y rechazo de payloads inválidos: Comprobar que la autorización provenga del servidor y que el cliente no pueda elevar privilegios. (dimensión: autorización).
- [ ] **AUD-065** esquemas, límites, normalización y rechazo de payloads inválidos: Definir límites de tamaño, tiempo, concurrencia y consumo; probar el límite y el exceso. (dimensión: límites).
- [ ] **AUD-066** esquemas, límites, normalización y rechazo de payloads inválidos: Comprobar que tokens, claves y datos personales no aparezcan en logs o respuestas. (dimensión: secretos).
- [ ] **AUD-067** esquemas, límites, normalización y rechazo de payloads inválidos: Verificar que referencias y objetos anidados no alteren estado que se considera inmutable. (dimensión: mutabilidad).
- [ ] **AUD-068** esquemas, límites, normalización y rechazo de payloads inválidos: Probar reintentos, duplicados y concurrencia sin duplicar efectos secundarios. (dimensión: reintentos).
- [ ] **AUD-069** esquemas, límites, normalización y rechazo de payloads inválidos: Registrar estado, correlación y motivo sin filtrar datos sensibles ni confundir simulación con ejecución. (dimensión: observabilidad).
- [ ] **AUD-070** esquemas, límites, normalización y rechazo de payloads inválidos: Probar el contrato con el runtime canónico y con el adaptador real, no solo mocks permisivos. (dimensión: integración).
- [ ] **AUD-071** esquemas, límites, normalización y rechazo de payloads inválidos: Agregar prueba para entrada maliciosa, permiso denegado o evidencia incompleta. (dimensión: prueba negativa).
- [ ] **AUD-072** esquemas, límites, normalización y rechazo de payloads inválidos: Vincular cada defecto confirmado con una prueba que falle antes y pase después de corregirlo. (dimensión: regresión).
- [ ] **AUD-073** esquemas, límites, normalización y rechazo de payloads inválidos: Identificar dependencias directas/transitivas, versiones, licencias y vulnerabilidades pertinentes. (dimensión: dependencias).
- [ ] **AUD-074** esquemas, límites, normalización y rechazo de payloads inválidos: Validar variables requeridas y defaults; configuración crítica ausente debe fallar cerrada. (dimensión: configuración).
- [ ] **AUD-075** esquemas, límites, normalización y rechazo de payloads inválidos: Alinear la documentación con el código ejecutado y marcar limitaciones no implementadas. (dimensión: documentación).
- [ ] **AUD-076** esquemas, límites, normalización y rechazo de payloads inválidos: Registrar versión, commit, algoritmo o modelo que originó el resultado y permitir reproducirlo. (dimensión: versionado).
- [ ] **AUD-077** esquemas, límites, normalización y rechazo de payloads inválidos: Probar separación entre usuarios, tenants, sesiones y datos restringidos. (dimensión: aislamiento).
- [ ] **AUD-078** esquemas, límites, normalización y rechazo de payloads inválidos: Verificar que acciones críticas generen un evento de auditoría correlacionable e íntegro. (dimensión: auditoría).
- [ ] **AUD-079** esquemas, límites, normalización y rechazo de payloads inválidos: Probar recuperación tras reinicio, fallo parcial, desconexión o rollback. (dimensión: recuperación).
- [ ] **AUD-080** esquemas, límites, normalización y rechazo de payloads inválidos: Impedir promoción a producción si el control crítico está fallido, omitido o no evaluado. (dimensión: gate de release).

## 5. Secretos y privacidad

- [ ] **AUD-081** redacción de datos sensibles, almacenamiento, retención y borrado: Validar contrato, esquema y compatibilidad; añadir pruebas para campos inválidos. (dimensión: contrato).
- [ ] **AUD-082** redacción de datos sensibles, almacenamiento, retención y borrado: Exigir evidencia reproducible del comportamiento; documentación sola no cuenta como prueba. (dimensión: evidencia).
- [ ] **AUD-083** redacción de datos sensibles, almacenamiento, retención y borrado: Probar configuración ausente, proveedor caído y error interno; evitar declarar éxito. (dimensión: fallo seguro).
- [ ] **AUD-084** redacción de datos sensibles, almacenamiento, retención y borrado: Comprobar que la autorización provenga del servidor y que el cliente no pueda elevar privilegios. (dimensión: autorización).
- [ ] **AUD-085** redacción de datos sensibles, almacenamiento, retención y borrado: Definir límites de tamaño, tiempo, concurrencia y consumo; probar el límite y el exceso. (dimensión: límites).
- [ ] **AUD-086** redacción de datos sensibles, almacenamiento, retención y borrado: Comprobar que tokens, claves y datos personales no aparezcan en logs o respuestas. (dimensión: secretos).
- [ ] **AUD-087** redacción de datos sensibles, almacenamiento, retención y borrado: Verificar que referencias y objetos anidados no alteren estado que se considera inmutable. (dimensión: mutabilidad).
- [ ] **AUD-088** redacción de datos sensibles, almacenamiento, retención y borrado: Probar reintentos, duplicados y concurrencia sin duplicar efectos secundarios. (dimensión: reintentos).
- [ ] **AUD-089** redacción de datos sensibles, almacenamiento, retención y borrado: Registrar estado, correlación y motivo sin filtrar datos sensibles ni confundir simulación con ejecución. (dimensión: observabilidad).
- [ ] **AUD-090** redacción de datos sensibles, almacenamiento, retención y borrado: Probar el contrato con el runtime canónico y con el adaptador real, no solo mocks permisivos. (dimensión: integración).
- [ ] **AUD-091** redacción de datos sensibles, almacenamiento, retención y borrado: Agregar prueba para entrada maliciosa, permiso denegado o evidencia incompleta. (dimensión: prueba negativa).
- [ ] **AUD-092** redacción de datos sensibles, almacenamiento, retención y borrado: Vincular cada defecto confirmado con una prueba que falle antes y pase después de corregirlo. (dimensión: regresión).
- [ ] **AUD-093** redacción de datos sensibles, almacenamiento, retención y borrado: Identificar dependencias directas/transitivas, versiones, licencias y vulnerabilidades pertinentes. (dimensión: dependencias).
- [ ] **AUD-094** redacción de datos sensibles, almacenamiento, retención y borrado: Validar variables requeridas y defaults; configuración crítica ausente debe fallar cerrada. (dimensión: configuración).
- [ ] **AUD-095** redacción de datos sensibles, almacenamiento, retención y borrado: Alinear la documentación con el código ejecutado y marcar limitaciones no implementadas. (dimensión: documentación).
- [ ] **AUD-096** redacción de datos sensibles, almacenamiento, retención y borrado: Registrar versión, commit, algoritmo o modelo que originó el resultado y permitir reproducirlo. (dimensión: versionado).
- [ ] **AUD-097** redacción de datos sensibles, almacenamiento, retención y borrado: Probar separación entre usuarios, tenants, sesiones y datos restringidos. (dimensión: aislamiento).
- [ ] **AUD-098** redacción de datos sensibles, almacenamiento, retención y borrado: Verificar que acciones críticas generen un evento de auditoría correlacionable e íntegro. (dimensión: auditoría).
- [ ] **AUD-099** redacción de datos sensibles, almacenamiento, retención y borrado: Probar recuperación tras reinicio, fallo parcial, desconexión o rollback. (dimensión: recuperación).
- [ ] **AUD-100** redacción de datos sensibles, almacenamiento, retención y borrado: Impedir promoción a producción si el control crítico está fallido, omitido o no evaluado. (dimensión: gate de release).

## 6. Prompt injection

- [ ] **AUD-101** fronteras de confianza entre instrucciones, documentos recuperados y herramientas: Validar contrato, esquema y compatibilidad; añadir pruebas para campos inválidos. (dimensión: contrato).
- [ ] **AUD-102** fronteras de confianza entre instrucciones, documentos recuperados y herramientas: Exigir evidencia reproducible del comportamiento; documentación sola no cuenta como prueba. (dimensión: evidencia).
- [ ] **AUD-103** fronteras de confianza entre instrucciones, documentos recuperados y herramientas: Probar configuración ausente, proveedor caído y error interno; evitar declarar éxito. (dimensión: fallo seguro).
- [ ] **AUD-104** fronteras de confianza entre instrucciones, documentos recuperados y herramientas: Comprobar que la autorización provenga del servidor y que el cliente no pueda elevar privilegios. (dimensión: autorización).
- [ ] **AUD-105** fronteras de confianza entre instrucciones, documentos recuperados y herramientas: Definir límites de tamaño, tiempo, concurrencia y consumo; probar el límite y el exceso. (dimensión: límites).
- [ ] **AUD-106** fronteras de confianza entre instrucciones, documentos recuperados y herramientas: Comprobar que tokens, claves y datos personales no aparezcan en logs o respuestas. (dimensión: secretos).
- [ ] **AUD-107** fronteras de confianza entre instrucciones, documentos recuperados y herramientas: Verificar que referencias y objetos anidados no alteren estado que se considera inmutable. (dimensión: mutabilidad).
- [ ] **AUD-108** fronteras de confianza entre instrucciones, documentos recuperados y herramientas: Probar reintentos, duplicados y concurrencia sin duplicar efectos secundarios. (dimensión: reintentos).
- [ ] **AUD-109** fronteras de confianza entre instrucciones, documentos recuperados y herramientas: Registrar estado, correlación y motivo sin filtrar datos sensibles ni confundir simulación con ejecución. (dimensión: observabilidad).
- [ ] **AUD-110** fronteras de confianza entre instrucciones, documentos recuperados y herramientas: Probar el contrato con el runtime canónico y con el adaptador real, no solo mocks permisivos. (dimensión: integración).
- [ ] **AUD-111** fronteras de confianza entre instrucciones, documentos recuperados y herramientas: Agregar prueba para entrada maliciosa, permiso denegado o evidencia incompleta. (dimensión: prueba negativa).
- [ ] **AUD-112** fronteras de confianza entre instrucciones, documentos recuperados y herramientas: Vincular cada defecto confirmado con una prueba que falle antes y pase después de corregirlo. (dimensión: regresión).
- [ ] **AUD-113** fronteras de confianza entre instrucciones, documentos recuperados y herramientas: Identificar dependencias directas/transitivas, versiones, licencias y vulnerabilidades pertinentes. (dimensión: dependencias).
- [ ] **AUD-114** fronteras de confianza entre instrucciones, documentos recuperados y herramientas: Validar variables requeridas y defaults; configuración crítica ausente debe fallar cerrada. (dimensión: configuración).
- [ ] **AUD-115** fronteras de confianza entre instrucciones, documentos recuperados y herramientas: Alinear la documentación con el código ejecutado y marcar limitaciones no implementadas. (dimensión: documentación).
- [ ] **AUD-116** fronteras de confianza entre instrucciones, documentos recuperados y herramientas: Registrar versión, commit, algoritmo o modelo que originó el resultado y permitir reproducirlo. (dimensión: versionado).
- [ ] **AUD-117** fronteras de confianza entre instrucciones, documentos recuperados y herramientas: Probar separación entre usuarios, tenants, sesiones y datos restringidos. (dimensión: aislamiento).
- [ ] **AUD-118** fronteras de confianza entre instrucciones, documentos recuperados y herramientas: Verificar que acciones críticas generen un evento de auditoría correlacionable e íntegro. (dimensión: auditoría).
- [ ] **AUD-119** fronteras de confianza entre instrucciones, documentos recuperados y herramientas: Probar recuperación tras reinicio, fallo parcial, desconexión o rollback. (dimensión: recuperación).
- [ ] **AUD-120** fronteras de confianza entre instrucciones, documentos recuperados y herramientas: Impedir promoción a producción si el control crítico está fallido, omitido o no evaluado. (dimensión: gate de release).

## 7. Sanitización documental

- [ ] **AUD-121** transformaciones, cuarentena, metadatos, archivos adjuntos y redacción: Validar contrato, esquema y compatibilidad; añadir pruebas para campos inválidos. (dimensión: contrato).
- [ ] **AUD-122** transformaciones, cuarentena, metadatos, archivos adjuntos y redacción: Exigir evidencia reproducible del comportamiento; documentación sola no cuenta como prueba. (dimensión: evidencia).
- [ ] **AUD-123** transformaciones, cuarentena, metadatos, archivos adjuntos y redacción: Probar configuración ausente, proveedor caído y error interno; evitar declarar éxito. (dimensión: fallo seguro).
- [ ] **AUD-124** transformaciones, cuarentena, metadatos, archivos adjuntos y redacción: Comprobar que la autorización provenga del servidor y que el cliente no pueda elevar privilegios. (dimensión: autorización).
- [ ] **AUD-125** transformaciones, cuarentena, metadatos, archivos adjuntos y redacción: Definir límites de tamaño, tiempo, concurrencia y consumo; probar el límite y el exceso. (dimensión: límites).
- [ ] **AUD-126** transformaciones, cuarentena, metadatos, archivos adjuntos y redacción: Comprobar que tokens, claves y datos personales no aparezcan en logs o respuestas. (dimensión: secretos).
- [ ] **AUD-127** transformaciones, cuarentena, metadatos, archivos adjuntos y redacción: Verificar que referencias y objetos anidados no alteren estado que se considera inmutable. (dimensión: mutabilidad).
- [ ] **AUD-128** transformaciones, cuarentena, metadatos, archivos adjuntos y redacción: Probar reintentos, duplicados y concurrencia sin duplicar efectos secundarios. (dimensión: reintentos).
- [ ] **AUD-129** transformaciones, cuarentena, metadatos, archivos adjuntos y redacción: Registrar estado, correlación y motivo sin filtrar datos sensibles ni confundir simulación con ejecución. (dimensión: observabilidad).
- [ ] **AUD-130** transformaciones, cuarentena, metadatos, archivos adjuntos y redacción: Probar el contrato con el runtime canónico y con el adaptador real, no solo mocks permisivos. (dimensión: integración).
- [ ] **AUD-131** transformaciones, cuarentena, metadatos, archivos adjuntos y redacción: Agregar prueba para entrada maliciosa, permiso denegado o evidencia incompleta. (dimensión: prueba negativa).
- [ ] **AUD-132** transformaciones, cuarentena, metadatos, archivos adjuntos y redacción: Vincular cada defecto confirmado con una prueba que falle antes y pase después de corregirlo. (dimensión: regresión).
- [ ] **AUD-133** transformaciones, cuarentena, metadatos, archivos adjuntos y redacción: Identificar dependencias directas/transitivas, versiones, licencias y vulnerabilidades pertinentes. (dimensión: dependencias).
- [ ] **AUD-134** transformaciones, cuarentena, metadatos, archivos adjuntos y redacción: Validar variables requeridas y defaults; configuración crítica ausente debe fallar cerrada. (dimensión: configuración).
- [ ] **AUD-135** transformaciones, cuarentena, metadatos, archivos adjuntos y redacción: Alinear la documentación con el código ejecutado y marcar limitaciones no implementadas. (dimensión: documentación).
- [ ] **AUD-136** transformaciones, cuarentena, metadatos, archivos adjuntos y redacción: Registrar versión, commit, algoritmo o modelo que originó el resultado y permitir reproducirlo. (dimensión: versionado).
- [ ] **AUD-137** transformaciones, cuarentena, metadatos, archivos adjuntos y redacción: Probar separación entre usuarios, tenants, sesiones y datos restringidos. (dimensión: aislamiento).
- [ ] **AUD-138** transformaciones, cuarentena, metadatos, archivos adjuntos y redacción: Verificar que acciones críticas generen un evento de auditoría correlacionable e íntegro. (dimensión: auditoría).
- [ ] **AUD-139** transformaciones, cuarentena, metadatos, archivos adjuntos y redacción: Probar recuperación tras reinicio, fallo parcial, desconexión o rollback. (dimensión: recuperación).
- [ ] **AUD-140** transformaciones, cuarentena, metadatos, archivos adjuntos y redacción: Impedir promoción a producción si el control crítico está fallido, omitido o no evaluado. (dimensión: gate de release).

## 8. IKES y evidencia

- [ ] **AUD-141** claims, fuentes, evidencia, estados epistemológicos y procedencia: Validar contrato, esquema y compatibilidad; añadir pruebas para campos inválidos. (dimensión: contrato).
- [ ] **AUD-142** claims, fuentes, evidencia, estados epistemológicos y procedencia: Exigir evidencia reproducible del comportamiento; documentación sola no cuenta como prueba. (dimensión: evidencia).
- [ ] **AUD-143** claims, fuentes, evidencia, estados epistemológicos y procedencia: Probar configuración ausente, proveedor caído y error interno; evitar declarar éxito. (dimensión: fallo seguro).
- [ ] **AUD-144** claims, fuentes, evidencia, estados epistemológicos y procedencia: Comprobar que la autorización provenga del servidor y que el cliente no pueda elevar privilegios. (dimensión: autorización).
- [ ] **AUD-145** claims, fuentes, evidencia, estados epistemológicos y procedencia: Definir límites de tamaño, tiempo, concurrencia y consumo; probar el límite y el exceso. (dimensión: límites).
- [ ] **AUD-146** claims, fuentes, evidencia, estados epistemológicos y procedencia: Comprobar que tokens, claves y datos personales no aparezcan en logs o respuestas. (dimensión: secretos).
- [ ] **AUD-147** claims, fuentes, evidencia, estados epistemológicos y procedencia: Verificar que referencias y objetos anidados no alteren estado que se considera inmutable. (dimensión: mutabilidad).
- [ ] **AUD-148** claims, fuentes, evidencia, estados epistemológicos y procedencia: Probar reintentos, duplicados y concurrencia sin duplicar efectos secundarios. (dimensión: reintentos).
- [ ] **AUD-149** claims, fuentes, evidencia, estados epistemológicos y procedencia: Registrar estado, correlación y motivo sin filtrar datos sensibles ni confundir simulación con ejecución. (dimensión: observabilidad).
- [ ] **AUD-150** claims, fuentes, evidencia, estados epistemológicos y procedencia: Probar el contrato con el runtime canónico y con el adaptador real, no solo mocks permisivos. (dimensión: integración).
- [ ] **AUD-151** claims, fuentes, evidencia, estados epistemológicos y procedencia: Agregar prueba para entrada maliciosa, permiso denegado o evidencia incompleta. (dimensión: prueba negativa).
- [ ] **AUD-152** claims, fuentes, evidencia, estados epistemológicos y procedencia: Vincular cada defecto confirmado con una prueba que falle antes y pase después de corregirlo. (dimensión: regresión).
- [ ] **AUD-153** claims, fuentes, evidencia, estados epistemológicos y procedencia: Identificar dependencias directas/transitivas, versiones, licencias y vulnerabilidades pertinentes. (dimensión: dependencias).
- [ ] **AUD-154** claims, fuentes, evidencia, estados epistemológicos y procedencia: Validar variables requeridas y defaults; configuración crítica ausente debe fallar cerrada. (dimensión: configuración).
- [ ] **AUD-155** claims, fuentes, evidencia, estados epistemológicos y procedencia: Alinear la documentación con el código ejecutado y marcar limitaciones no implementadas. (dimensión: documentación).
- [ ] **AUD-156** claims, fuentes, evidencia, estados epistemológicos y procedencia: Registrar versión, commit, algoritmo o modelo que originó el resultado y permitir reproducirlo. (dimensión: versionado).
- [ ] **AUD-157** claims, fuentes, evidencia, estados epistemológicos y procedencia: Probar separación entre usuarios, tenants, sesiones y datos restringidos. (dimensión: aislamiento).
- [ ] **AUD-158** claims, fuentes, evidencia, estados epistemológicos y procedencia: Verificar que acciones críticas generen un evento de auditoría correlacionable e íntegro. (dimensión: auditoría).
- [ ] **AUD-159** claims, fuentes, evidencia, estados epistemológicos y procedencia: Probar recuperación tras reinicio, fallo parcial, desconexión o rollback. (dimensión: recuperación).
- [ ] **AUD-160** claims, fuentes, evidencia, estados epistemológicos y procedencia: Impedir promoción a producción si el control crítico está fallido, omitido o no evaluado. (dimensión: gate de release).

## 9. Criptografía e integridad

- [ ] **AUD-161** hashes, firmas, claves, certificados, Merkle y estados de verificación: Validar contrato, esquema y compatibilidad; añadir pruebas para campos inválidos. (dimensión: contrato).
- [ ] **AUD-162** hashes, firmas, claves, certificados, Merkle y estados de verificación: Exigir evidencia reproducible del comportamiento; documentación sola no cuenta como prueba. (dimensión: evidencia).
- [ ] **AUD-163** hashes, firmas, claves, certificados, Merkle y estados de verificación: Probar configuración ausente, proveedor caído y error interno; evitar declarar éxito. (dimensión: fallo seguro).
- [ ] **AUD-164** hashes, firmas, claves, certificados, Merkle y estados de verificación: Comprobar que la autorización provenga del servidor y que el cliente no pueda elevar privilegios. (dimensión: autorización).
- [ ] **AUD-165** hashes, firmas, claves, certificados, Merkle y estados de verificación: Definir límites de tamaño, tiempo, concurrencia y consumo; probar el límite y el exceso. (dimensión: límites).
- [ ] **AUD-166** hashes, firmas, claves, certificados, Merkle y estados de verificación: Comprobar que tokens, claves y datos personales no aparezcan en logs o respuestas. (dimensión: secretos).
- [ ] **AUD-167** hashes, firmas, claves, certificados, Merkle y estados de verificación: Verificar que referencias y objetos anidados no alteren estado que se considera inmutable. (dimensión: mutabilidad).
- [ ] **AUD-168** hashes, firmas, claves, certificados, Merkle y estados de verificación: Probar reintentos, duplicados y concurrencia sin duplicar efectos secundarios. (dimensión: reintentos).
- [ ] **AUD-169** hashes, firmas, claves, certificados, Merkle y estados de verificación: Registrar estado, correlación y motivo sin filtrar datos sensibles ni confundir simulación con ejecución. (dimensión: observabilidad).
- [ ] **AUD-170** hashes, firmas, claves, certificados, Merkle y estados de verificación: Probar el contrato con el runtime canónico y con el adaptador real, no solo mocks permisivos. (dimensión: integración).
- [ ] **AUD-171** hashes, firmas, claves, certificados, Merkle y estados de verificación: Agregar prueba para entrada maliciosa, permiso denegado o evidencia incompleta. (dimensión: prueba negativa).
- [ ] **AUD-172** hashes, firmas, claves, certificados, Merkle y estados de verificación: Vincular cada defecto confirmado con una prueba que falle antes y pase después de corregirlo. (dimensión: regresión).
- [ ] **AUD-173** hashes, firmas, claves, certificados, Merkle y estados de verificación: Identificar dependencias directas/transitivas, versiones, licencias y vulnerabilidades pertinentes. (dimensión: dependencias).
- [ ] **AUD-174** hashes, firmas, claves, certificados, Merkle y estados de verificación: Validar variables requeridas y defaults; configuración crítica ausente debe fallar cerrada. (dimensión: configuración).
- [ ] **AUD-175** hashes, firmas, claves, certificados, Merkle y estados de verificación: Alinear la documentación con el código ejecutado y marcar limitaciones no implementadas. (dimensión: documentación).
- [ ] **AUD-176** hashes, firmas, claves, certificados, Merkle y estados de verificación: Registrar versión, commit, algoritmo o modelo que originó el resultado y permitir reproducirlo. (dimensión: versionado).
- [ ] **AUD-177** hashes, firmas, claves, certificados, Merkle y estados de verificación: Probar separación entre usuarios, tenants, sesiones y datos restringidos. (dimensión: aislamiento).
- [ ] **AUD-178** hashes, firmas, claves, certificados, Merkle y estados de verificación: Verificar que acciones críticas generen un evento de auditoría correlacionable e íntegro. (dimensión: auditoría).
- [ ] **AUD-179** hashes, firmas, claves, certificados, Merkle y estados de verificación: Probar recuperación tras reinicio, fallo parcial, desconexión o rollback. (dimensión: recuperación).
- [ ] **AUD-180** hashes, firmas, claves, certificados, Merkle y estados de verificación: Impedir promoción a producción si el control crítico está fallido, omitido o no evaluado. (dimensión: gate de release).

## 10. Persistencia y BookPI

- [ ] **AUD-181** transacciones, ledger, consistencia, retención y recuperación: Validar contrato, esquema y compatibilidad; añadir pruebas para campos inválidos. (dimensión: contrato).
- [ ] **AUD-182** transacciones, ledger, consistencia, retención y recuperación: Exigir evidencia reproducible del comportamiento; documentación sola no cuenta como prueba. (dimensión: evidencia).
- [ ] **AUD-183** transacciones, ledger, consistencia, retención y recuperación: Probar configuración ausente, proveedor caído y error interno; evitar declarar éxito. (dimensión: fallo seguro).
- [ ] **AUD-184** transacciones, ledger, consistencia, retención y recuperación: Comprobar que la autorización provenga del servidor y que el cliente no pueda elevar privilegios. (dimensión: autorización).
- [ ] **AUD-185** transacciones, ledger, consistencia, retención y recuperación: Definir límites de tamaño, tiempo, concurrencia y consumo; probar el límite y el exceso. (dimensión: límites).
- [ ] **AUD-186** transacciones, ledger, consistencia, retención y recuperación: Comprobar que tokens, claves y datos personales no aparezcan en logs o respuestas. (dimensión: secretos).
- [ ] **AUD-187** transacciones, ledger, consistencia, retención y recuperación: Verificar que referencias y objetos anidados no alteren estado que se considera inmutable. (dimensión: mutabilidad).
- [ ] **AUD-188** transacciones, ledger, consistencia, retención y recuperación: Probar reintentos, duplicados y concurrencia sin duplicar efectos secundarios. (dimensión: reintentos).
- [ ] **AUD-189** transacciones, ledger, consistencia, retención y recuperación: Registrar estado, correlación y motivo sin filtrar datos sensibles ni confundir simulación con ejecución. (dimensión: observabilidad).
- [ ] **AUD-190** transacciones, ledger, consistencia, retención y recuperación: Probar el contrato con el runtime canónico y con el adaptador real, no solo mocks permisivos. (dimensión: integración).
- [ ] **AUD-191** transacciones, ledger, consistencia, retención y recuperación: Agregar prueba para entrada maliciosa, permiso denegado o evidencia incompleta. (dimensión: prueba negativa).
- [ ] **AUD-192** transacciones, ledger, consistencia, retención y recuperación: Vincular cada defecto confirmado con una prueba que falle antes y pase después de corregirlo. (dimensión: regresión).
- [ ] **AUD-193** transacciones, ledger, consistencia, retención y recuperación: Identificar dependencias directas/transitivas, versiones, licencias y vulnerabilidades pertinentes. (dimensión: dependencias).
- [ ] **AUD-194** transacciones, ledger, consistencia, retención y recuperación: Validar variables requeridas y defaults; configuración crítica ausente debe fallar cerrada. (dimensión: configuración).
- [ ] **AUD-195** transacciones, ledger, consistencia, retención y recuperación: Alinear la documentación con el código ejecutado y marcar limitaciones no implementadas. (dimensión: documentación).
- [ ] **AUD-196** transacciones, ledger, consistencia, retención y recuperación: Registrar versión, commit, algoritmo o modelo que originó el resultado y permitir reproducirlo. (dimensión: versionado).
- [ ] **AUD-197** transacciones, ledger, consistencia, retención y recuperación: Probar separación entre usuarios, tenants, sesiones y datos restringidos. (dimensión: aislamiento).
- [ ] **AUD-198** transacciones, ledger, consistencia, retención y recuperación: Verificar que acciones críticas generen un evento de auditoría correlacionable e íntegro. (dimensión: auditoría).
- [ ] **AUD-199** transacciones, ledger, consistencia, retención y recuperación: Probar recuperación tras reinicio, fallo parcial, desconexión o rollback. (dimensión: recuperación).
- [ ] **AUD-200** transacciones, ledger, consistencia, retención y recuperación: Impedir promoción a producción si el control crítico está fallido, omitido o no evaluado. (dimensión: gate de release).

## 11. Concurrencia e idempotencia

- [ ] **AUD-201** reintentos, eventos duplicados, carreras, locks y cancelación: Validar contrato, esquema y compatibilidad; añadir pruebas para campos inválidos. (dimensión: contrato).
- [ ] **AUD-202** reintentos, eventos duplicados, carreras, locks y cancelación: Exigir evidencia reproducible del comportamiento; documentación sola no cuenta como prueba. (dimensión: evidencia).
- [ ] **AUD-203** reintentos, eventos duplicados, carreras, locks y cancelación: Probar configuración ausente, proveedor caído y error interno; evitar declarar éxito. (dimensión: fallo seguro).
- [ ] **AUD-204** reintentos, eventos duplicados, carreras, locks y cancelación: Comprobar que la autorización provenga del servidor y que el cliente no pueda elevar privilegios. (dimensión: autorización).
- [ ] **AUD-205** reintentos, eventos duplicados, carreras, locks y cancelación: Definir límites de tamaño, tiempo, concurrencia y consumo; probar el límite y el exceso. (dimensión: límites).
- [ ] **AUD-206** reintentos, eventos duplicados, carreras, locks y cancelación: Comprobar que tokens, claves y datos personales no aparezcan en logs o respuestas. (dimensión: secretos).
- [ ] **AUD-207** reintentos, eventos duplicados, carreras, locks y cancelación: Verificar que referencias y objetos anidados no alteren estado que se considera inmutable. (dimensión: mutabilidad).
- [ ] **AUD-208** reintentos, eventos duplicados, carreras, locks y cancelación: Probar reintentos, duplicados y concurrencia sin duplicar efectos secundarios. (dimensión: reintentos).
- [ ] **AUD-209** reintentos, eventos duplicados, carreras, locks y cancelación: Registrar estado, correlación y motivo sin filtrar datos sensibles ni confundir simulación con ejecución. (dimensión: observabilidad).
- [ ] **AUD-210** reintentos, eventos duplicados, carreras, locks y cancelación: Probar el contrato con el runtime canónico y con el adaptador real, no solo mocks permisivos. (dimensión: integración).
- [ ] **AUD-211** reintentos, eventos duplicados, carreras, locks y cancelación: Agregar prueba para entrada maliciosa, permiso denegado o evidencia incompleta. (dimensión: prueba negativa).
- [ ] **AUD-212** reintentos, eventos duplicados, carreras, locks y cancelación: Vincular cada defecto confirmado con una prueba que falle antes y pase después de corregirlo. (dimensión: regresión).
- [ ] **AUD-213** reintentos, eventos duplicados, carreras, locks y cancelación: Identificar dependencias directas/transitivas, versiones, licencias y vulnerabilidades pertinentes. (dimensión: dependencias).
- [ ] **AUD-214** reintentos, eventos duplicados, carreras, locks y cancelación: Validar variables requeridas y defaults; configuración crítica ausente debe fallar cerrada. (dimensión: configuración).
- [ ] **AUD-215** reintentos, eventos duplicados, carreras, locks y cancelación: Alinear la documentación con el código ejecutado y marcar limitaciones no implementadas. (dimensión: documentación).
- [ ] **AUD-216** reintentos, eventos duplicados, carreras, locks y cancelación: Registrar versión, commit, algoritmo o modelo que originó el resultado y permitir reproducirlo. (dimensión: versionado).
- [ ] **AUD-217** reintentos, eventos duplicados, carreras, locks y cancelación: Probar separación entre usuarios, tenants, sesiones y datos restringidos. (dimensión: aislamiento).
- [ ] **AUD-218** reintentos, eventos duplicados, carreras, locks y cancelación: Verificar que acciones críticas generen un evento de auditoría correlacionable e íntegro. (dimensión: auditoría).
- [ ] **AUD-219** reintentos, eventos duplicados, carreras, locks y cancelación: Probar recuperación tras reinicio, fallo parcial, desconexión o rollback. (dimensión: recuperación).
- [ ] **AUD-220** reintentos, eventos duplicados, carreras, locks y cancelación: Impedir promoción a producción si el control crítico está fallido, omitido o no evaluado. (dimensión: gate de release).

## 12. Modelos y machine learning

- [ ] **AUD-221** proveedores, inferencia, evaluación, sesgos, límites y afirmaciones sobre ML: Validar contrato, esquema y compatibilidad; añadir pruebas para campos inválidos. (dimensión: contrato).
- [ ] **AUD-222** proveedores, inferencia, evaluación, sesgos, límites y afirmaciones sobre ML: Exigir evidencia reproducible del comportamiento; documentación sola no cuenta como prueba. (dimensión: evidencia).
- [ ] **AUD-223** proveedores, inferencia, evaluación, sesgos, límites y afirmaciones sobre ML: Probar configuración ausente, proveedor caído y error interno; evitar declarar éxito. (dimensión: fallo seguro).
- [ ] **AUD-224** proveedores, inferencia, evaluación, sesgos, límites y afirmaciones sobre ML: Comprobar que la autorización provenga del servidor y que el cliente no pueda elevar privilegios. (dimensión: autorización).
- [ ] **AUD-225** proveedores, inferencia, evaluación, sesgos, límites y afirmaciones sobre ML: Definir límites de tamaño, tiempo, concurrencia y consumo; probar el límite y el exceso. (dimensión: límites).
- [ ] **AUD-226** proveedores, inferencia, evaluación, sesgos, límites y afirmaciones sobre ML: Comprobar que tokens, claves y datos personales no aparezcan en logs o respuestas. (dimensión: secretos).
- [ ] **AUD-227** proveedores, inferencia, evaluación, sesgos, límites y afirmaciones sobre ML: Verificar que referencias y objetos anidados no alteren estado que se considera inmutable. (dimensión: mutabilidad).
- [ ] **AUD-228** proveedores, inferencia, evaluación, sesgos, límites y afirmaciones sobre ML: Probar reintentos, duplicados y concurrencia sin duplicar efectos secundarios. (dimensión: reintentos).
- [ ] **AUD-229** proveedores, inferencia, evaluación, sesgos, límites y afirmaciones sobre ML: Registrar estado, correlación y motivo sin filtrar datos sensibles ni confundir simulación con ejecución. (dimensión: observabilidad).
- [ ] **AUD-230** proveedores, inferencia, evaluación, sesgos, límites y afirmaciones sobre ML: Probar el contrato con el runtime canónico y con el adaptador real, no solo mocks permisivos. (dimensión: integración).
- [ ] **AUD-231** proveedores, inferencia, evaluación, sesgos, límites y afirmaciones sobre ML: Agregar prueba para entrada maliciosa, permiso denegado o evidencia incompleta. (dimensión: prueba negativa).
- [ ] **AUD-232** proveedores, inferencia, evaluación, sesgos, límites y afirmaciones sobre ML: Vincular cada defecto confirmado con una prueba que falle antes y pase después de corregirlo. (dimensión: regresión).
- [ ] **AUD-233** proveedores, inferencia, evaluación, sesgos, límites y afirmaciones sobre ML: Identificar dependencias directas/transitivas, versiones, licencias y vulnerabilidades pertinentes. (dimensión: dependencias).
- [ ] **AUD-234** proveedores, inferencia, evaluación, sesgos, límites y afirmaciones sobre ML: Validar variables requeridas y defaults; configuración crítica ausente debe fallar cerrada. (dimensión: configuración).
- [ ] **AUD-235** proveedores, inferencia, evaluación, sesgos, límites y afirmaciones sobre ML: Alinear la documentación con el código ejecutado y marcar limitaciones no implementadas. (dimensión: documentación).
- [ ] **AUD-236** proveedores, inferencia, evaluación, sesgos, límites y afirmaciones sobre ML: Registrar versión, commit, algoritmo o modelo que originó el resultado y permitir reproducirlo. (dimensión: versionado).
- [ ] **AUD-237** proveedores, inferencia, evaluación, sesgos, límites y afirmaciones sobre ML: Probar separación entre usuarios, tenants, sesiones y datos restringidos. (dimensión: aislamiento).
- [ ] **AUD-238** proveedores, inferencia, evaluación, sesgos, límites y afirmaciones sobre ML: Verificar que acciones críticas generen un evento de auditoría correlacionable e íntegro. (dimensión: auditoría).
- [ ] **AUD-239** proveedores, inferencia, evaluación, sesgos, límites y afirmaciones sobre ML: Probar recuperación tras reinicio, fallo parcial, desconexión o rollback. (dimensión: recuperación).
- [ ] **AUD-240** proveedores, inferencia, evaluación, sesgos, límites y afirmaciones sobre ML: Impedir promoción a producción si el control crítico está fallido, omitido o no evaluado. (dimensión: gate de release).

## 13. Skills y herramientas

- [ ] **AUD-241** registro, permisos, esquemas, ejecución y efectos secundarios: Validar contrato, esquema y compatibilidad; añadir pruebas para campos inválidos. (dimensión: contrato).
- [ ] **AUD-242** registro, permisos, esquemas, ejecución y efectos secundarios: Exigir evidencia reproducible del comportamiento; documentación sola no cuenta como prueba. (dimensión: evidencia).
- [ ] **AUD-243** registro, permisos, esquemas, ejecución y efectos secundarios: Probar configuración ausente, proveedor caído y error interno; evitar declarar éxito. (dimensión: fallo seguro).
- [ ] **AUD-244** registro, permisos, esquemas, ejecución y efectos secundarios: Comprobar que la autorización provenga del servidor y que el cliente no pueda elevar privilegios. (dimensión: autorización).
- [ ] **AUD-245** registro, permisos, esquemas, ejecución y efectos secundarios: Definir límites de tamaño, tiempo, concurrencia y consumo; probar el límite y el exceso. (dimensión: límites).
- [ ] **AUD-246** registro, permisos, esquemas, ejecución y efectos secundarios: Comprobar que tokens, claves y datos personales no aparezcan en logs o respuestas. (dimensión: secretos).
- [ ] **AUD-247** registro, permisos, esquemas, ejecución y efectos secundarios: Verificar que referencias y objetos anidados no alteren estado que se considera inmutable. (dimensión: mutabilidad).
- [ ] **AUD-248** registro, permisos, esquemas, ejecución y efectos secundarios: Probar reintentos, duplicados y concurrencia sin duplicar efectos secundarios. (dimensión: reintentos).
- [ ] **AUD-249** registro, permisos, esquemas, ejecución y efectos secundarios: Registrar estado, correlación y motivo sin filtrar datos sensibles ni confundir simulación con ejecución. (dimensión: observabilidad).
- [ ] **AUD-250** registro, permisos, esquemas, ejecución y efectos secundarios: Probar el contrato con el runtime canónico y con el adaptador real, no solo mocks permisivos. (dimensión: integración).
- [ ] **AUD-251** registro, permisos, esquemas, ejecución y efectos secundarios: Agregar prueba para entrada maliciosa, permiso denegado o evidencia incompleta. (dimensión: prueba negativa).
- [ ] **AUD-252** registro, permisos, esquemas, ejecución y efectos secundarios: Vincular cada defecto confirmado con una prueba que falle antes y pase después de corregirlo. (dimensión: regresión).
- [ ] **AUD-253** registro, permisos, esquemas, ejecución y efectos secundarios: Identificar dependencias directas/transitivas, versiones, licencias y vulnerabilidades pertinentes. (dimensión: dependencias).
- [ ] **AUD-254** registro, permisos, esquemas, ejecución y efectos secundarios: Validar variables requeridas y defaults; configuración crítica ausente debe fallar cerrada. (dimensión: configuración).
- [ ] **AUD-255** registro, permisos, esquemas, ejecución y efectos secundarios: Alinear la documentación con el código ejecutado y marcar limitaciones no implementadas. (dimensión: documentación).
- [ ] **AUD-256** registro, permisos, esquemas, ejecución y efectos secundarios: Registrar versión, commit, algoritmo o modelo que originó el resultado y permitir reproducirlo. (dimensión: versionado).
- [ ] **AUD-257** registro, permisos, esquemas, ejecución y efectos secundarios: Probar separación entre usuarios, tenants, sesiones y datos restringidos. (dimensión: aislamiento).
- [ ] **AUD-258** registro, permisos, esquemas, ejecución y efectos secundarios: Verificar que acciones críticas generen un evento de auditoría correlacionable e íntegro. (dimensión: auditoría).
- [ ] **AUD-259** registro, permisos, esquemas, ejecución y efectos secundarios: Probar recuperación tras reinicio, fallo parcial, desconexión o rollback. (dimensión: recuperación).
- [ ] **AUD-260** registro, permisos, esquemas, ejecución y efectos secundarios: Impedir promoción a producción si el control crítico está fallido, omitido o no evaluado. (dimensión: gate de release).

## 14. CROWN, AEGIS y gobernanza

- [ ] **AUD-261** políticas, decisiones, excepciones, aprobación humana y gates: Validar contrato, esquema y compatibilidad; añadir pruebas para campos inválidos. (dimensión: contrato).
- [ ] **AUD-262** políticas, decisiones, excepciones, aprobación humana y gates: Exigir evidencia reproducible del comportamiento; documentación sola no cuenta como prueba. (dimensión: evidencia).
- [ ] **AUD-263** políticas, decisiones, excepciones, aprobación humana y gates: Probar configuración ausente, proveedor caído y error interno; evitar declarar éxito. (dimensión: fallo seguro).
- [ ] **AUD-264** políticas, decisiones, excepciones, aprobación humana y gates: Comprobar que la autorización provenga del servidor y que el cliente no pueda elevar privilegios. (dimensión: autorización).
- [ ] **AUD-265** políticas, decisiones, excepciones, aprobación humana y gates: Definir límites de tamaño, tiempo, concurrencia y consumo; probar el límite y el exceso. (dimensión: límites).
- [ ] **AUD-266** políticas, decisiones, excepciones, aprobación humana y gates: Comprobar que tokens, claves y datos personales no aparezcan en logs o respuestas. (dimensión: secretos).
- [ ] **AUD-267** políticas, decisiones, excepciones, aprobación humana y gates: Verificar que referencias y objetos anidados no alteren estado que se considera inmutable. (dimensión: mutabilidad).
- [ ] **AUD-268** políticas, decisiones, excepciones, aprobación humana y gates: Probar reintentos, duplicados y concurrencia sin duplicar efectos secundarios. (dimensión: reintentos).
- [ ] **AUD-269** políticas, decisiones, excepciones, aprobación humana y gates: Registrar estado, correlación y motivo sin filtrar datos sensibles ni confundir simulación con ejecución. (dimensión: observabilidad).
- [ ] **AUD-270** políticas, decisiones, excepciones, aprobación humana y gates: Probar el contrato con el runtime canónico y con el adaptador real, no solo mocks permisivos. (dimensión: integración).
- [ ] **AUD-271** políticas, decisiones, excepciones, aprobación humana y gates: Agregar prueba para entrada maliciosa, permiso denegado o evidencia incompleta. (dimensión: prueba negativa).
- [ ] **AUD-272** políticas, decisiones, excepciones, aprobación humana y gates: Vincular cada defecto confirmado con una prueba que falle antes y pase después de corregirlo. (dimensión: regresión).
- [ ] **AUD-273** políticas, decisiones, excepciones, aprobación humana y gates: Identificar dependencias directas/transitivas, versiones, licencias y vulnerabilidades pertinentes. (dimensión: dependencias).
- [ ] **AUD-274** políticas, decisiones, excepciones, aprobación humana y gates: Validar variables requeridas y defaults; configuración crítica ausente debe fallar cerrada. (dimensión: configuración).
- [ ] **AUD-275** políticas, decisiones, excepciones, aprobación humana y gates: Alinear la documentación con el código ejecutado y marcar limitaciones no implementadas. (dimensión: documentación).
- [ ] **AUD-276** políticas, decisiones, excepciones, aprobación humana y gates: Registrar versión, commit, algoritmo o modelo que originó el resultado y permitir reproducirlo. (dimensión: versionado).
- [ ] **AUD-277** políticas, decisiones, excepciones, aprobación humana y gates: Probar separación entre usuarios, tenants, sesiones y datos restringidos. (dimensión: aislamiento).
- [ ] **AUD-278** políticas, decisiones, excepciones, aprobación humana y gates: Verificar que acciones críticas generen un evento de auditoría correlacionable e íntegro. (dimensión: auditoría).
- [ ] **AUD-279** políticas, decisiones, excepciones, aprobación humana y gates: Probar recuperación tras reinicio, fallo parcial, desconexión o rollback. (dimensión: recuperación).
- [ ] **AUD-280** políticas, decisiones, excepciones, aprobación humana y gates: Impedir promoción a producción si el control crítico está fallido, omitido o no evaluado. (dimensión: gate de release).

## 15. Pruebas y CI

- [ ] **AUD-281** typecheck, tests, lint, cobertura, jobs, artefactos y estado del SHA: Validar contrato, esquema y compatibilidad; añadir pruebas para campos inválidos. (dimensión: contrato).
- [ ] **AUD-282** typecheck, tests, lint, cobertura, jobs, artefactos y estado del SHA: Exigir evidencia reproducible del comportamiento; documentación sola no cuenta como prueba. (dimensión: evidencia).
- [ ] **AUD-283** typecheck, tests, lint, cobertura, jobs, artefactos y estado del SHA: Probar configuración ausente, proveedor caído y error interno; evitar declarar éxito. (dimensión: fallo seguro).
- [ ] **AUD-284** typecheck, tests, lint, cobertura, jobs, artefactos y estado del SHA: Comprobar que la autorización provenga del servidor y que el cliente no pueda elevar privilegios. (dimensión: autorización).
- [ ] **AUD-285** typecheck, tests, lint, cobertura, jobs, artefactos y estado del SHA: Definir límites de tamaño, tiempo, concurrencia y consumo; probar el límite y el exceso. (dimensión: límites).
- [ ] **AUD-286** typecheck, tests, lint, cobertura, jobs, artefactos y estado del SHA: Comprobar que tokens, claves y datos personales no aparezcan en logs o respuestas. (dimensión: secretos).
- [ ] **AUD-287** typecheck, tests, lint, cobertura, jobs, artefactos y estado del SHA: Verificar que referencias y objetos anidados no alteren estado que se considera inmutable. (dimensión: mutabilidad).
- [ ] **AUD-288** typecheck, tests, lint, cobertura, jobs, artefactos y estado del SHA: Probar reintentos, duplicados y concurrencia sin duplicar efectos secundarios. (dimensión: reintentos).
- [ ] **AUD-289** typecheck, tests, lint, cobertura, jobs, artefactos y estado del SHA: Registrar estado, correlación y motivo sin filtrar datos sensibles ni confundir simulación con ejecución. (dimensión: observabilidad).
- [ ] **AUD-290** typecheck, tests, lint, cobertura, jobs, artefactos y estado del SHA: Probar el contrato con el runtime canónico y con el adaptador real, no solo mocks permisivos. (dimensión: integración).
- [ ] **AUD-291** typecheck, tests, lint, cobertura, jobs, artefactos y estado del SHA: Agregar prueba para entrada maliciosa, permiso denegado o evidencia incompleta. (dimensión: prueba negativa).
- [ ] **AUD-292** typecheck, tests, lint, cobertura, jobs, artefactos y estado del SHA: Vincular cada defecto confirmado con una prueba que falle antes y pase después de corregirlo. (dimensión: regresión).
- [ ] **AUD-293** typecheck, tests, lint, cobertura, jobs, artefactos y estado del SHA: Identificar dependencias directas/transitivas, versiones, licencias y vulnerabilidades pertinentes. (dimensión: dependencias).
- [ ] **AUD-294** typecheck, tests, lint, cobertura, jobs, artefactos y estado del SHA: Validar variables requeridas y defaults; configuración crítica ausente debe fallar cerrada. (dimensión: configuración).
- [ ] **AUD-295** typecheck, tests, lint, cobertura, jobs, artefactos y estado del SHA: Alinear la documentación con el código ejecutado y marcar limitaciones no implementadas. (dimensión: documentación).
- [ ] **AUD-296** typecheck, tests, lint, cobertura, jobs, artefactos y estado del SHA: Registrar versión, commit, algoritmo o modelo que originó el resultado y permitir reproducirlo. (dimensión: versionado).
- [ ] **AUD-297** typecheck, tests, lint, cobertura, jobs, artefactos y estado del SHA: Probar separación entre usuarios, tenants, sesiones y datos restringidos. (dimensión: aislamiento).
- [ ] **AUD-298** typecheck, tests, lint, cobertura, jobs, artefactos y estado del SHA: Verificar que acciones críticas generen un evento de auditoría correlacionable e íntegro. (dimensión: auditoría).
- [ ] **AUD-299** typecheck, tests, lint, cobertura, jobs, artefactos y estado del SHA: Probar recuperación tras reinicio, fallo parcial, desconexión o rollback. (dimensión: recuperación).
- [ ] **AUD-300** typecheck, tests, lint, cobertura, jobs, artefactos y estado del SHA: Impedir promoción a producción si el control crítico está fallido, omitido o no evaluado. (dimensión: gate de release).

## 16. Dependencias y supply chain

- [ ] **AUD-301** lockfiles, CVEs, licencias, SBOM, acciones CI y procedencia: Validar contrato, esquema y compatibilidad; añadir pruebas para campos inválidos. (dimensión: contrato).
- [ ] **AUD-302** lockfiles, CVEs, licencias, SBOM, acciones CI y procedencia: Exigir evidencia reproducible del comportamiento; documentación sola no cuenta como prueba. (dimensión: evidencia).
- [ ] **AUD-303** lockfiles, CVEs, licencias, SBOM, acciones CI y procedencia: Probar configuración ausente, proveedor caído y error interno; evitar declarar éxito. (dimensión: fallo seguro).
- [ ] **AUD-304** lockfiles, CVEs, licencias, SBOM, acciones CI y procedencia: Comprobar que la autorización provenga del servidor y que el cliente no pueda elevar privilegios. (dimensión: autorización).
- [ ] **AUD-305** lockfiles, CVEs, licencias, SBOM, acciones CI y procedencia: Definir límites de tamaño, tiempo, concurrencia y consumo; probar el límite y el exceso. (dimensión: límites).
- [ ] **AUD-306** lockfiles, CVEs, licencias, SBOM, acciones CI y procedencia: Comprobar que tokens, claves y datos personales no aparezcan en logs o respuestas. (dimensión: secretos).
- [ ] **AUD-307** lockfiles, CVEs, licencias, SBOM, acciones CI y procedencia: Verificar que referencias y objetos anidados no alteren estado que se considera inmutable. (dimensión: mutabilidad).
- [ ] **AUD-308** lockfiles, CVEs, licencias, SBOM, acciones CI y procedencia: Probar reintentos, duplicados y concurrencia sin duplicar efectos secundarios. (dimensión: reintentos).
- [ ] **AUD-309** lockfiles, CVEs, licencias, SBOM, acciones CI y procedencia: Registrar estado, correlación y motivo sin filtrar datos sensibles ni confundir simulación con ejecución. (dimensión: observabilidad).
- [ ] **AUD-310** lockfiles, CVEs, licencias, SBOM, acciones CI y procedencia: Probar el contrato con el runtime canónico y con el adaptador real, no solo mocks permisivos. (dimensión: integración).
- [ ] **AUD-311** lockfiles, CVEs, licencias, SBOM, acciones CI y procedencia: Agregar prueba para entrada maliciosa, permiso denegado o evidencia incompleta. (dimensión: prueba negativa).
- [ ] **AUD-312** lockfiles, CVEs, licencias, SBOM, acciones CI y procedencia: Vincular cada defecto confirmado con una prueba que falle antes y pase después de corregirlo. (dimensión: regresión).
- [ ] **AUD-313** lockfiles, CVEs, licencias, SBOM, acciones CI y procedencia: Identificar dependencias directas/transitivas, versiones, licencias y vulnerabilidades pertinentes. (dimensión: dependencias).
- [ ] **AUD-314** lockfiles, CVEs, licencias, SBOM, acciones CI y procedencia: Validar variables requeridas y defaults; configuración crítica ausente debe fallar cerrada. (dimensión: configuración).
- [ ] **AUD-315** lockfiles, CVEs, licencias, SBOM, acciones CI y procedencia: Alinear la documentación con el código ejecutado y marcar limitaciones no implementadas. (dimensión: documentación).
- [ ] **AUD-316** lockfiles, CVEs, licencias, SBOM, acciones CI y procedencia: Registrar versión, commit, algoritmo o modelo que originó el resultado y permitir reproducirlo. (dimensión: versionado).
- [ ] **AUD-317** lockfiles, CVEs, licencias, SBOM, acciones CI y procedencia: Probar separación entre usuarios, tenants, sesiones y datos restringidos. (dimensión: aislamiento).
- [ ] **AUD-318** lockfiles, CVEs, licencias, SBOM, acciones CI y procedencia: Verificar que acciones críticas generen un evento de auditoría correlacionable e íntegro. (dimensión: auditoría).
- [ ] **AUD-319** lockfiles, CVEs, licencias, SBOM, acciones CI y procedencia: Probar recuperación tras reinicio, fallo parcial, desconexión o rollback. (dimensión: recuperación).
- [ ] **AUD-320** lockfiles, CVEs, licencias, SBOM, acciones CI y procedencia: Impedir promoción a producción si el control crítico está fallido, omitido o no evaluado. (dimensión: gate de release).

## 17. Despliegue y configuración

- [ ] **AUD-321** variables de entorno, contenedores, readiness, rollback y secretos: Validar contrato, esquema y compatibilidad; añadir pruebas para campos inválidos. (dimensión: contrato).
- [ ] **AUD-322** variables de entorno, contenedores, readiness, rollback y secretos: Exigir evidencia reproducible del comportamiento; documentación sola no cuenta como prueba. (dimensión: evidencia).
- [ ] **AUD-323** variables de entorno, contenedores, readiness, rollback y secretos: Probar configuración ausente, proveedor caído y error interno; evitar declarar éxito. (dimensión: fallo seguro).
- [ ] **AUD-324** variables de entorno, contenedores, readiness, rollback y secretos: Comprobar que la autorización provenga del servidor y que el cliente no pueda elevar privilegios. (dimensión: autorización).
- [ ] **AUD-325** variables de entorno, contenedores, readiness, rollback y secretos: Definir límites de tamaño, tiempo, concurrencia y consumo; probar el límite y el exceso. (dimensión: límites).
- [ ] **AUD-326** variables de entorno, contenedores, readiness, rollback y secretos: Comprobar que tokens, claves y datos personales no aparezcan en logs o respuestas. (dimensión: secretos).
- [ ] **AUD-327** variables de entorno, contenedores, readiness, rollback y secretos: Verificar que referencias y objetos anidados no alteren estado que se considera inmutable. (dimensión: mutabilidad).
- [ ] **AUD-328** variables de entorno, contenedores, readiness, rollback y secretos: Probar reintentos, duplicados y concurrencia sin duplicar efectos secundarios. (dimensión: reintentos).
- [ ] **AUD-329** variables de entorno, contenedores, readiness, rollback y secretos: Registrar estado, correlación y motivo sin filtrar datos sensibles ni confundir simulación con ejecución. (dimensión: observabilidad).
- [ ] **AUD-330** variables de entorno, contenedores, readiness, rollback y secretos: Probar el contrato con el runtime canónico y con el adaptador real, no solo mocks permisivos. (dimensión: integración).
- [ ] **AUD-331** variables de entorno, contenedores, readiness, rollback y secretos: Agregar prueba para entrada maliciosa, permiso denegado o evidencia incompleta. (dimensión: prueba negativa).
- [ ] **AUD-332** variables de entorno, contenedores, readiness, rollback y secretos: Vincular cada defecto confirmado con una prueba que falle antes y pase después de corregirlo. (dimensión: regresión).
- [ ] **AUD-333** variables de entorno, contenedores, readiness, rollback y secretos: Identificar dependencias directas/transitivas, versiones, licencias y vulnerabilidades pertinentes. (dimensión: dependencias).
- [ ] **AUD-334** variables de entorno, contenedores, readiness, rollback y secretos: Validar variables requeridas y defaults; configuración crítica ausente debe fallar cerrada. (dimensión: configuración).
- [ ] **AUD-335** variables de entorno, contenedores, readiness, rollback y secretos: Alinear la documentación con el código ejecutado y marcar limitaciones no implementadas. (dimensión: documentación).
- [ ] **AUD-336** variables de entorno, contenedores, readiness, rollback y secretos: Registrar versión, commit, algoritmo o modelo que originó el resultado y permitir reproducirlo. (dimensión: versionado).
- [ ] **AUD-337** variables de entorno, contenedores, readiness, rollback y secretos: Probar separación entre usuarios, tenants, sesiones y datos restringidos. (dimensión: aislamiento).
- [ ] **AUD-338** variables de entorno, contenedores, readiness, rollback y secretos: Verificar que acciones críticas generen un evento de auditoría correlacionable e íntegro. (dimensión: auditoría).
- [ ] **AUD-339** variables de entorno, contenedores, readiness, rollback y secretos: Probar recuperación tras reinicio, fallo parcial, desconexión o rollback. (dimensión: recuperación).
- [ ] **AUD-340** variables de entorno, contenedores, readiness, rollback y secretos: Impedir promoción a producción si el control crítico está fallido, omitido o no evaluado. (dimensión: gate de release).

## 18. Observabilidad e incidentes

- [ ] **AUD-341** logs, métricas, trazas, alertas, correlación y respuesta: Validar contrato, esquema y compatibilidad; añadir pruebas para campos inválidos. (dimensión: contrato).
- [ ] **AUD-342** logs, métricas, trazas, alertas, correlación y respuesta: Exigir evidencia reproducible del comportamiento; documentación sola no cuenta como prueba. (dimensión: evidencia).
- [ ] **AUD-343** logs, métricas, trazas, alertas, correlación y respuesta: Probar configuración ausente, proveedor caído y error interno; evitar declarar éxito. (dimensión: fallo seguro).
- [ ] **AUD-344** logs, métricas, trazas, alertas, correlación y respuesta: Comprobar que la autorización provenga del servidor y que el cliente no pueda elevar privilegios. (dimensión: autorización).
- [ ] **AUD-345** logs, métricas, trazas, alertas, correlación y respuesta: Definir límites de tamaño, tiempo, concurrencia y consumo; probar el límite y el exceso. (dimensión: límites).
- [ ] **AUD-346** logs, métricas, trazas, alertas, correlación y respuesta: Comprobar que tokens, claves y datos personales no aparezcan en logs o respuestas. (dimensión: secretos).
- [ ] **AUD-347** logs, métricas, trazas, alertas, correlación y respuesta: Verificar que referencias y objetos anidados no alteren estado que se considera inmutable. (dimensión: mutabilidad).
- [ ] **AUD-348** logs, métricas, trazas, alertas, correlación y respuesta: Probar reintentos, duplicados y concurrencia sin duplicar efectos secundarios. (dimensión: reintentos).
- [ ] **AUD-349** logs, métricas, trazas, alertas, correlación y respuesta: Registrar estado, correlación y motivo sin filtrar datos sensibles ni confundir simulación con ejecución. (dimensión: observabilidad).
- [ ] **AUD-350** logs, métricas, trazas, alertas, correlación y respuesta: Probar el contrato con el runtime canónico y con el adaptador real, no solo mocks permisivos. (dimensión: integración).
- [ ] **AUD-351** logs, métricas, trazas, alertas, correlación y respuesta: Agregar prueba para entrada maliciosa, permiso denegado o evidencia incompleta. (dimensión: prueba negativa).
- [ ] **AUD-352** logs, métricas, trazas, alertas, correlación y respuesta: Vincular cada defecto confirmado con una prueba que falle antes y pase después de corregirlo. (dimensión: regresión).
- [ ] **AUD-353** logs, métricas, trazas, alertas, correlación y respuesta: Identificar dependencias directas/transitivas, versiones, licencias y vulnerabilidades pertinentes. (dimensión: dependencias).
- [ ] **AUD-354** logs, métricas, trazas, alertas, correlación y respuesta: Validar variables requeridas y defaults; configuración crítica ausente debe fallar cerrada. (dimensión: configuración).
- [ ] **AUD-355** logs, métricas, trazas, alertas, correlación y respuesta: Alinear la documentación con el código ejecutado y marcar limitaciones no implementadas. (dimensión: documentación).
- [ ] **AUD-356** logs, métricas, trazas, alertas, correlación y respuesta: Registrar versión, commit, algoritmo o modelo que originó el resultado y permitir reproducirlo. (dimensión: versionado).
- [ ] **AUD-357** logs, métricas, trazas, alertas, correlación y respuesta: Probar separación entre usuarios, tenants, sesiones y datos restringidos. (dimensión: aislamiento).
- [ ] **AUD-358** logs, métricas, trazas, alertas, correlación y respuesta: Verificar que acciones críticas generen un evento de auditoría correlacionable e íntegro. (dimensión: auditoría).
- [ ] **AUD-359** logs, métricas, trazas, alertas, correlación y respuesta: Probar recuperación tras reinicio, fallo parcial, desconexión o rollback. (dimensión: recuperación).
- [ ] **AUD-360** logs, métricas, trazas, alertas, correlación y respuesta: Impedir promoción a producción si el control crítico está fallido, omitido o no evaluado. (dimensión: gate de release).

## 19. Licencias y regulación

- [ ] **AUD-361** MIT, componentes terceros, privacidad, jurisdicciones y afirmaciones de cumplimiento: Validar contrato, esquema y compatibilidad; añadir pruebas para campos inválidos. (dimensión: contrato).
- [ ] **AUD-362** MIT, componentes terceros, privacidad, jurisdicciones y afirmaciones de cumplimiento: Exigir evidencia reproducible del comportamiento; documentación sola no cuenta como prueba. (dimensión: evidencia).
- [ ] **AUD-363** MIT, componentes terceros, privacidad, jurisdicciones y afirmaciones de cumplimiento: Probar configuración ausente, proveedor caído y error interno; evitar declarar éxito. (dimensión: fallo seguro).
- [ ] **AUD-364** MIT, componentes terceros, privacidad, jurisdicciones y afirmaciones de cumplimiento: Comprobar que la autorización provenga del servidor y que el cliente no pueda elevar privilegios. (dimensión: autorización).
- [ ] **AUD-365** MIT, componentes terceros, privacidad, jurisdicciones y afirmaciones de cumplimiento: Definir límites de tamaño, tiempo, concurrencia y consumo; probar el límite y el exceso. (dimensión: límites).
- [ ] **AUD-366** MIT, componentes terceros, privacidad, jurisdicciones y afirmaciones de cumplimiento: Comprobar que tokens, claves y datos personales no aparezcan en logs o respuestas. (dimensión: secretos).
- [ ] **AUD-367** MIT, componentes terceros, privacidad, jurisdicciones y afirmaciones de cumplimiento: Verificar que referencias y objetos anidados no alteren estado que se considera inmutable. (dimensión: mutabilidad).
- [ ] **AUD-368** MIT, componentes terceros, privacidad, jurisdicciones y afirmaciones de cumplimiento: Probar reintentos, duplicados y concurrencia sin duplicar efectos secundarios. (dimensión: reintentos).
- [ ] **AUD-369** MIT, componentes terceros, privacidad, jurisdicciones y afirmaciones de cumplimiento: Registrar estado, correlación y motivo sin filtrar datos sensibles ni confundir simulación con ejecución. (dimensión: observabilidad).
- [ ] **AUD-370** MIT, componentes terceros, privacidad, jurisdicciones y afirmaciones de cumplimiento: Probar el contrato con el runtime canónico y con el adaptador real, no solo mocks permisivos. (dimensión: integración).
- [ ] **AUD-371** MIT, componentes terceros, privacidad, jurisdicciones y afirmaciones de cumplimiento: Agregar prueba para entrada maliciosa, permiso denegado o evidencia incompleta. (dimensión: prueba negativa).
- [ ] **AUD-372** MIT, componentes terceros, privacidad, jurisdicciones y afirmaciones de cumplimiento: Vincular cada defecto confirmado con una prueba que falle antes y pase después de corregirlo. (dimensión: regresión).
- [ ] **AUD-373** MIT, componentes terceros, privacidad, jurisdicciones y afirmaciones de cumplimiento: Identificar dependencias directas/transitivas, versiones, licencias y vulnerabilidades pertinentes. (dimensión: dependencias).
- [ ] **AUD-374** MIT, componentes terceros, privacidad, jurisdicciones y afirmaciones de cumplimiento: Validar variables requeridas y defaults; configuración crítica ausente debe fallar cerrada. (dimensión: configuración).
- [ ] **AUD-375** MIT, componentes terceros, privacidad, jurisdicciones y afirmaciones de cumplimiento: Alinear la documentación con el código ejecutado y marcar limitaciones no implementadas. (dimensión: documentación).
- [ ] **AUD-376** MIT, componentes terceros, privacidad, jurisdicciones y afirmaciones de cumplimiento: Registrar versión, commit, algoritmo o modelo que originó el resultado y permitir reproducirlo. (dimensión: versionado).
- [ ] **AUD-377** MIT, componentes terceros, privacidad, jurisdicciones y afirmaciones de cumplimiento: Probar separación entre usuarios, tenants, sesiones y datos restringidos. (dimensión: aislamiento).
- [ ] **AUD-378** MIT, componentes terceros, privacidad, jurisdicciones y afirmaciones de cumplimiento: Verificar que acciones críticas generen un evento de auditoría correlacionable e íntegro. (dimensión: auditoría).
- [ ] **AUD-379** MIT, componentes terceros, privacidad, jurisdicciones y afirmaciones de cumplimiento: Probar recuperación tras reinicio, fallo parcial, desconexión o rollback. (dimensión: recuperación).
- [ ] **AUD-380** MIT, componentes terceros, privacidad, jurisdicciones y afirmaciones de cumplimiento: Impedir promoción a producción si el control crítico está fallido, omitido o no evaluado. (dimensión: gate de release).

## 20. Sesgos y evaluación de respuestas

- [ ] **AUD-381** factualidad, calibración, representatividad, abstención y citas: Validar contrato, esquema y compatibilidad; añadir pruebas para campos inválidos. (dimensión: contrato).
- [ ] **AUD-382** factualidad, calibración, representatividad, abstención y citas: Exigir evidencia reproducible del comportamiento; documentación sola no cuenta como prueba. (dimensión: evidencia).
- [ ] **AUD-383** factualidad, calibración, representatividad, abstención y citas: Probar configuración ausente, proveedor caído y error interno; evitar declarar éxito. (dimensión: fallo seguro).
- [ ] **AUD-384** factualidad, calibración, representatividad, abstención y citas: Comprobar que la autorización provenga del servidor y que el cliente no pueda elevar privilegios. (dimensión: autorización).
- [ ] **AUD-385** factualidad, calibración, representatividad, abstención y citas: Definir límites de tamaño, tiempo, concurrencia y consumo; probar el límite y el exceso. (dimensión: límites).
- [ ] **AUD-386** factualidad, calibración, representatividad, abstención y citas: Comprobar que tokens, claves y datos personales no aparezcan en logs o respuestas. (dimensión: secretos).
- [ ] **AUD-387** factualidad, calibración, representatividad, abstención y citas: Verificar que referencias y objetos anidados no alteren estado que se considera inmutable. (dimensión: mutabilidad).
- [ ] **AUD-388** factualidad, calibración, representatividad, abstención y citas: Probar reintentos, duplicados y concurrencia sin duplicar efectos secundarios. (dimensión: reintentos).
- [ ] **AUD-389** factualidad, calibración, representatividad, abstención y citas: Registrar estado, correlación y motivo sin filtrar datos sensibles ni confundir simulación con ejecución. (dimensión: observabilidad).
- [ ] **AUD-390** factualidad, calibración, representatividad, abstención y citas: Probar el contrato con el runtime canónico y con el adaptador real, no solo mocks permisivos. (dimensión: integración).
- [ ] **AUD-391** factualidad, calibración, representatividad, abstención y citas: Agregar prueba para entrada maliciosa, permiso denegado o evidencia incompleta. (dimensión: prueba negativa).
- [ ] **AUD-392** factualidad, calibración, representatividad, abstención y citas: Vincular cada defecto confirmado con una prueba que falle antes y pase después de corregirlo. (dimensión: regresión).
- [ ] **AUD-393** factualidad, calibración, representatividad, abstención y citas: Identificar dependencias directas/transitivas, versiones, licencias y vulnerabilidades pertinentes. (dimensión: dependencias).
- [ ] **AUD-394** factualidad, calibración, representatividad, abstención y citas: Validar variables requeridas y defaults; configuración crítica ausente debe fallar cerrada. (dimensión: configuración).
- [ ] **AUD-395** factualidad, calibración, representatividad, abstención y citas: Alinear la documentación con el código ejecutado y marcar limitaciones no implementadas. (dimensión: documentación).
- [ ] **AUD-396** factualidad, calibración, representatividad, abstención y citas: Registrar versión, commit, algoritmo o modelo que originó el resultado y permitir reproducirlo. (dimensión: versionado).
- [ ] **AUD-397** factualidad, calibración, representatividad, abstención y citas: Probar separación entre usuarios, tenants, sesiones y datos restringidos. (dimensión: aislamiento).
- [ ] **AUD-398** factualidad, calibración, representatividad, abstención y citas: Verificar que acciones críticas generen un evento de auditoría correlacionable e íntegro. (dimensión: auditoría).
- [ ] **AUD-399** factualidad, calibración, representatividad, abstención y citas: Probar recuperación tras reinicio, fallo parcial, desconexión o rollback. (dimensión: recuperación).
- [ ] **AUD-400** factualidad, calibración, representatividad, abstención y citas: Impedir promoción a producción si el control crítico está fallido, omitido o no evaluado. (dimensión: gate de release).

## 21. README y documentación

- [ ] **AUD-401** afirmaciones públicas, comandos, versiones, diagramas y limitaciones: Validar contrato, esquema y compatibilidad; añadir pruebas para campos inválidos. (dimensión: contrato).
- [ ] **AUD-402** afirmaciones públicas, comandos, versiones, diagramas y limitaciones: Exigir evidencia reproducible del comportamiento; documentación sola no cuenta como prueba. (dimensión: evidencia).
- [ ] **AUD-403** afirmaciones públicas, comandos, versiones, diagramas y limitaciones: Probar configuración ausente, proveedor caído y error interno; evitar declarar éxito. (dimensión: fallo seguro).
- [ ] **AUD-404** afirmaciones públicas, comandos, versiones, diagramas y limitaciones: Comprobar que la autorización provenga del servidor y que el cliente no pueda elevar privilegios. (dimensión: autorización).
- [ ] **AUD-405** afirmaciones públicas, comandos, versiones, diagramas y limitaciones: Definir límites de tamaño, tiempo, concurrencia y consumo; probar el límite y el exceso. (dimensión: límites).
- [ ] **AUD-406** afirmaciones públicas, comandos, versiones, diagramas y limitaciones: Comprobar que tokens, claves y datos personales no aparezcan en logs o respuestas. (dimensión: secretos).
- [ ] **AUD-407** afirmaciones públicas, comandos, versiones, diagramas y limitaciones: Verificar que referencias y objetos anidados no alteren estado que se considera inmutable. (dimensión: mutabilidad).
- [ ] **AUD-408** afirmaciones públicas, comandos, versiones, diagramas y limitaciones: Probar reintentos, duplicados y concurrencia sin duplicar efectos secundarios. (dimensión: reintentos).
- [ ] **AUD-409** afirmaciones públicas, comandos, versiones, diagramas y limitaciones: Registrar estado, correlación y motivo sin filtrar datos sensibles ni confundir simulación con ejecución. (dimensión: observabilidad).
- [ ] **AUD-410** afirmaciones públicas, comandos, versiones, diagramas y limitaciones: Probar el contrato con el runtime canónico y con el adaptador real, no solo mocks permisivos. (dimensión: integración).
- [ ] **AUD-411** afirmaciones públicas, comandos, versiones, diagramas y limitaciones: Agregar prueba para entrada maliciosa, permiso denegado o evidencia incompleta. (dimensión: prueba negativa).
- [ ] **AUD-412** afirmaciones públicas, comandos, versiones, diagramas y limitaciones: Vincular cada defecto confirmado con una prueba que falle antes y pase después de corregirlo. (dimensión: regresión).
- [ ] **AUD-413** afirmaciones públicas, comandos, versiones, diagramas y limitaciones: Identificar dependencias directas/transitivas, versiones, licencias y vulnerabilidades pertinentes. (dimensión: dependencias).
- [ ] **AUD-414** afirmaciones públicas, comandos, versiones, diagramas y limitaciones: Validar variables requeridas y defaults; configuración crítica ausente debe fallar cerrada. (dimensión: configuración).
- [ ] **AUD-415** afirmaciones públicas, comandos, versiones, diagramas y limitaciones: Alinear la documentación con el código ejecutado y marcar limitaciones no implementadas. (dimensión: documentación).
- [ ] **AUD-416** afirmaciones públicas, comandos, versiones, diagramas y limitaciones: Registrar versión, commit, algoritmo o modelo que originó el resultado y permitir reproducirlo. (dimensión: versionado).
- [ ] **AUD-417** afirmaciones públicas, comandos, versiones, diagramas y limitaciones: Probar separación entre usuarios, tenants, sesiones y datos restringidos. (dimensión: aislamiento).
- [ ] **AUD-418** afirmaciones públicas, comandos, versiones, diagramas y limitaciones: Verificar que acciones críticas generen un evento de auditoría correlacionable e íntegro. (dimensión: auditoría).
- [ ] **AUD-419** afirmaciones públicas, comandos, versiones, diagramas y limitaciones: Probar recuperación tras reinicio, fallo parcial, desconexión o rollback. (dimensión: recuperación).
- [ ] **AUD-420** afirmaciones públicas, comandos, versiones, diagramas y limitaciones: Impedir promoción a producción si el control crítico está fallido, omitido o no evaluado. (dimensión: gate de release).

## 22. Integración de repositorios

- [ ] **AUD-421** adaptadores, contratos, versiones, aislamiento y ausencia de runtime paralelo: Validar contrato, esquema y compatibilidad; añadir pruebas para campos inválidos. (dimensión: contrato).
- [ ] **AUD-422** adaptadores, contratos, versiones, aislamiento y ausencia de runtime paralelo: Exigir evidencia reproducible del comportamiento; documentación sola no cuenta como prueba. (dimensión: evidencia).
- [ ] **AUD-423** adaptadores, contratos, versiones, aislamiento y ausencia de runtime paralelo: Probar configuración ausente, proveedor caído y error interno; evitar declarar éxito. (dimensión: fallo seguro).
- [ ] **AUD-424** adaptadores, contratos, versiones, aislamiento y ausencia de runtime paralelo: Comprobar que la autorización provenga del servidor y que el cliente no pueda elevar privilegios. (dimensión: autorización).
- [ ] **AUD-425** adaptadores, contratos, versiones, aislamiento y ausencia de runtime paralelo: Definir límites de tamaño, tiempo, concurrencia y consumo; probar el límite y el exceso. (dimensión: límites).
- [ ] **AUD-426** adaptadores, contratos, versiones, aislamiento y ausencia de runtime paralelo: Comprobar que tokens, claves y datos personales no aparezcan en logs o respuestas. (dimensión: secretos).
- [ ] **AUD-427** adaptadores, contratos, versiones, aislamiento y ausencia de runtime paralelo: Verificar que referencias y objetos anidados no alteren estado que se considera inmutable. (dimensión: mutabilidad).
- [ ] **AUD-428** adaptadores, contratos, versiones, aislamiento y ausencia de runtime paralelo: Probar reintentos, duplicados y concurrencia sin duplicar efectos secundarios. (dimensión: reintentos).
- [ ] **AUD-429** adaptadores, contratos, versiones, aislamiento y ausencia de runtime paralelo: Registrar estado, correlación y motivo sin filtrar datos sensibles ni confundir simulación con ejecución. (dimensión: observabilidad).
- [ ] **AUD-430** adaptadores, contratos, versiones, aislamiento y ausencia de runtime paralelo: Probar el contrato con el runtime canónico y con el adaptador real, no solo mocks permisivos. (dimensión: integración).
- [ ] **AUD-431** adaptadores, contratos, versiones, aislamiento y ausencia de runtime paralelo: Agregar prueba para entrada maliciosa, permiso denegado o evidencia incompleta. (dimensión: prueba negativa).
- [ ] **AUD-432** adaptadores, contratos, versiones, aislamiento y ausencia de runtime paralelo: Vincular cada defecto confirmado con una prueba que falle antes y pase después de corregirlo. (dimensión: regresión).
- [ ] **AUD-433** adaptadores, contratos, versiones, aislamiento y ausencia de runtime paralelo: Identificar dependencias directas/transitivas, versiones, licencias y vulnerabilidades pertinentes. (dimensión: dependencias).
- [ ] **AUD-434** adaptadores, contratos, versiones, aislamiento y ausencia de runtime paralelo: Validar variables requeridas y defaults; configuración crítica ausente debe fallar cerrada. (dimensión: configuración).
- [ ] **AUD-435** adaptadores, contratos, versiones, aislamiento y ausencia de runtime paralelo: Alinear la documentación con el código ejecutado y marcar limitaciones no implementadas. (dimensión: documentación).
- [ ] **AUD-436** adaptadores, contratos, versiones, aislamiento y ausencia de runtime paralelo: Registrar versión, commit, algoritmo o modelo que originó el resultado y permitir reproducirlo. (dimensión: versionado).
- [ ] **AUD-437** adaptadores, contratos, versiones, aislamiento y ausencia de runtime paralelo: Probar separación entre usuarios, tenants, sesiones y datos restringidos. (dimensión: aislamiento).
- [ ] **AUD-438** adaptadores, contratos, versiones, aislamiento y ausencia de runtime paralelo: Verificar que acciones críticas generen un evento de auditoría correlacionable e íntegro. (dimensión: auditoría).
- [ ] **AUD-439** adaptadores, contratos, versiones, aislamiento y ausencia de runtime paralelo: Probar recuperación tras reinicio, fallo parcial, desconexión o rollback. (dimensión: recuperación).
- [ ] **AUD-440** adaptadores, contratos, versiones, aislamiento y ausencia de runtime paralelo: Impedir promoción a producción si el control crítico está fallido, omitido o no evaluado. (dimensión: gate de release).

## 23. UX y accesibilidad

- [ ] **AUD-441** estados, mensajes, accesibilidad, privacidad en interfaz y confirmaciones: Validar contrato, esquema y compatibilidad; añadir pruebas para campos inválidos. (dimensión: contrato).
- [ ] **AUD-442** estados, mensajes, accesibilidad, privacidad en interfaz y confirmaciones: Exigir evidencia reproducible del comportamiento; documentación sola no cuenta como prueba. (dimensión: evidencia).
- [ ] **AUD-443** estados, mensajes, accesibilidad, privacidad en interfaz y confirmaciones: Probar configuración ausente, proveedor caído y error interno; evitar declarar éxito. (dimensión: fallo seguro).
- [ ] **AUD-444** estados, mensajes, accesibilidad, privacidad en interfaz y confirmaciones: Comprobar que la autorización provenga del servidor y que el cliente no pueda elevar privilegios. (dimensión: autorización).
- [ ] **AUD-445** estados, mensajes, accesibilidad, privacidad en interfaz y confirmaciones: Definir límites de tamaño, tiempo, concurrencia y consumo; probar el límite y el exceso. (dimensión: límites).
- [ ] **AUD-446** estados, mensajes, accesibilidad, privacidad en interfaz y confirmaciones: Comprobar que tokens, claves y datos personales no aparezcan en logs o respuestas. (dimensión: secretos).
- [ ] **AUD-447** estados, mensajes, accesibilidad, privacidad en interfaz y confirmaciones: Verificar que referencias y objetos anidados no alteren estado que se considera inmutable. (dimensión: mutabilidad).
- [ ] **AUD-448** estados, mensajes, accesibilidad, privacidad en interfaz y confirmaciones: Probar reintentos, duplicados y concurrencia sin duplicar efectos secundarios. (dimensión: reintentos).
- [ ] **AUD-449** estados, mensajes, accesibilidad, privacidad en interfaz y confirmaciones: Registrar estado, correlación y motivo sin filtrar datos sensibles ni confundir simulación con ejecución. (dimensión: observabilidad).
- [ ] **AUD-450** estados, mensajes, accesibilidad, privacidad en interfaz y confirmaciones: Probar el contrato con el runtime canónico y con el adaptador real, no solo mocks permisivos. (dimensión: integración).
- [ ] **AUD-451** estados, mensajes, accesibilidad, privacidad en interfaz y confirmaciones: Agregar prueba para entrada maliciosa, permiso denegado o evidencia incompleta. (dimensión: prueba negativa).
- [ ] **AUD-452** estados, mensajes, accesibilidad, privacidad en interfaz y confirmaciones: Vincular cada defecto confirmado con una prueba que falle antes y pase después de corregirlo. (dimensión: regresión).
- [ ] **AUD-453** estados, mensajes, accesibilidad, privacidad en interfaz y confirmaciones: Identificar dependencias directas/transitivas, versiones, licencias y vulnerabilidades pertinentes. (dimensión: dependencias).
- [ ] **AUD-454** estados, mensajes, accesibilidad, privacidad en interfaz y confirmaciones: Validar variables requeridas y defaults; configuración crítica ausente debe fallar cerrada. (dimensión: configuración).
- [ ] **AUD-455** estados, mensajes, accesibilidad, privacidad en interfaz y confirmaciones: Alinear la documentación con el código ejecutado y marcar limitaciones no implementadas. (dimensión: documentación).
- [ ] **AUD-456** estados, mensajes, accesibilidad, privacidad en interfaz y confirmaciones: Registrar versión, commit, algoritmo o modelo que originó el resultado y permitir reproducirlo. (dimensión: versionado).
- [ ] **AUD-457** estados, mensajes, accesibilidad, privacidad en interfaz y confirmaciones: Probar separación entre usuarios, tenants, sesiones y datos restringidos. (dimensión: aislamiento).
- [ ] **AUD-458** estados, mensajes, accesibilidad, privacidad en interfaz y confirmaciones: Verificar que acciones críticas generen un evento de auditoría correlacionable e íntegro. (dimensión: auditoría).
- [ ] **AUD-459** estados, mensajes, accesibilidad, privacidad en interfaz y confirmaciones: Probar recuperación tras reinicio, fallo parcial, desconexión o rollback. (dimensión: recuperación).
- [ ] **AUD-460** estados, mensajes, accesibilidad, privacidad en interfaz y confirmaciones: Impedir promoción a producción si el control crítico está fallido, omitido o no evaluado. (dimensión: gate de release).

## 24. Rendimiento y resiliencia

- [ ] **AUD-461** latencia, memoria, backpressure, cuotas, circuit breakers y carga: Validar contrato, esquema y compatibilidad; añadir pruebas para campos inválidos. (dimensión: contrato).
- [ ] **AUD-462** latencia, memoria, backpressure, cuotas, circuit breakers y carga: Exigir evidencia reproducible del comportamiento; documentación sola no cuenta como prueba. (dimensión: evidencia).
- [ ] **AUD-463** latencia, memoria, backpressure, cuotas, circuit breakers y carga: Probar configuración ausente, proveedor caído y error interno; evitar declarar éxito. (dimensión: fallo seguro).
- [ ] **AUD-464** latencia, memoria, backpressure, cuotas, circuit breakers y carga: Comprobar que la autorización provenga del servidor y que el cliente no pueda elevar privilegios. (dimensión: autorización).
- [ ] **AUD-465** latencia, memoria, backpressure, cuotas, circuit breakers y carga: Definir límites de tamaño, tiempo, concurrencia y consumo; probar el límite y el exceso. (dimensión: límites).
- [ ] **AUD-466** latencia, memoria, backpressure, cuotas, circuit breakers y carga: Comprobar que tokens, claves y datos personales no aparezcan en logs o respuestas. (dimensión: secretos).
- [ ] **AUD-467** latencia, memoria, backpressure, cuotas, circuit breakers y carga: Verificar que referencias y objetos anidados no alteren estado que se considera inmutable. (dimensión: mutabilidad).
- [ ] **AUD-468** latencia, memoria, backpressure, cuotas, circuit breakers y carga: Probar reintentos, duplicados y concurrencia sin duplicar efectos secundarios. (dimensión: reintentos).
- [ ] **AUD-469** latencia, memoria, backpressure, cuotas, circuit breakers y carga: Registrar estado, correlación y motivo sin filtrar datos sensibles ni confundir simulación con ejecución. (dimensión: observabilidad).
- [ ] **AUD-470** latencia, memoria, backpressure, cuotas, circuit breakers y carga: Probar el contrato con el runtime canónico y con el adaptador real, no solo mocks permisivos. (dimensión: integración).
- [ ] **AUD-471** latencia, memoria, backpressure, cuotas, circuit breakers y carga: Agregar prueba para entrada maliciosa, permiso denegado o evidencia incompleta. (dimensión: prueba negativa).
- [ ] **AUD-472** latencia, memoria, backpressure, cuotas, circuit breakers y carga: Vincular cada defecto confirmado con una prueba que falle antes y pase después de corregirlo. (dimensión: regresión).
- [ ] **AUD-473** latencia, memoria, backpressure, cuotas, circuit breakers y carga: Identificar dependencias directas/transitivas, versiones, licencias y vulnerabilidades pertinentes. (dimensión: dependencias).
- [ ] **AUD-474** latencia, memoria, backpressure, cuotas, circuit breakers y carga: Validar variables requeridas y defaults; configuración crítica ausente debe fallar cerrada. (dimensión: configuración).
- [ ] **AUD-475** latencia, memoria, backpressure, cuotas, circuit breakers y carga: Alinear la documentación con el código ejecutado y marcar limitaciones no implementadas. (dimensión: documentación).
- [ ] **AUD-476** latencia, memoria, backpressure, cuotas, circuit breakers y carga: Registrar versión, commit, algoritmo o modelo que originó el resultado y permitir reproducirlo. (dimensión: versionado).
- [ ] **AUD-477** latencia, memoria, backpressure, cuotas, circuit breakers y carga: Probar separación entre usuarios, tenants, sesiones y datos restringidos. (dimensión: aislamiento).
- [ ] **AUD-478** latencia, memoria, backpressure, cuotas, circuit breakers y carga: Verificar que acciones críticas generen un evento de auditoría correlacionable e íntegro. (dimensión: auditoría).
- [ ] **AUD-479** latencia, memoria, backpressure, cuotas, circuit breakers y carga: Probar recuperación tras reinicio, fallo parcial, desconexión o rollback. (dimensión: recuperación).
- [ ] **AUD-480** latencia, memoria, backpressure, cuotas, circuit breakers y carga: Impedir promoción a producción si el control crítico está fallido, omitido o no evaluado. (dimensión: gate de release).

## 25. CI/CD y releases

- [ ] **AUD-481** protección de ramas, aprobaciones, artefactos, versionado y promoción: Validar contrato, esquema y compatibilidad; añadir pruebas para campos inválidos. (dimensión: contrato).
- [ ] **AUD-482** protección de ramas, aprobaciones, artefactos, versionado y promoción: Exigir evidencia reproducible del comportamiento; documentación sola no cuenta como prueba. (dimensión: evidencia).
- [ ] **AUD-483** protección de ramas, aprobaciones, artefactos, versionado y promoción: Probar configuración ausente, proveedor caído y error interno; evitar declarar éxito. (dimensión: fallo seguro).
- [ ] **AUD-484** protección de ramas, aprobaciones, artefactos, versionado y promoción: Comprobar que la autorización provenga del servidor y que el cliente no pueda elevar privilegios. (dimensión: autorización).
- [ ] **AUD-485** protección de ramas, aprobaciones, artefactos, versionado y promoción: Definir límites de tamaño, tiempo, concurrencia y consumo; probar el límite y el exceso. (dimensión: límites).
- [ ] **AUD-486** protección de ramas, aprobaciones, artefactos, versionado y promoción: Comprobar que tokens, claves y datos personales no aparezcan en logs o respuestas. (dimensión: secretos).
- [ ] **AUD-487** protección de ramas, aprobaciones, artefactos, versionado y promoción: Verificar que referencias y objetos anidados no alteren estado que se considera inmutable. (dimensión: mutabilidad).
- [ ] **AUD-488** protección de ramas, aprobaciones, artefactos, versionado y promoción: Probar reintentos, duplicados y concurrencia sin duplicar efectos secundarios. (dimensión: reintentos).
- [ ] **AUD-489** protección de ramas, aprobaciones, artefactos, versionado y promoción: Registrar estado, correlación y motivo sin filtrar datos sensibles ni confundir simulación con ejecución. (dimensión: observabilidad).
- [ ] **AUD-490** protección de ramas, aprobaciones, artefactos, versionado y promoción: Probar el contrato con el runtime canónico y con el adaptador real, no solo mocks permisivos. (dimensión: integración).
- [ ] **AUD-491** protección de ramas, aprobaciones, artefactos, versionado y promoción: Agregar prueba para entrada maliciosa, permiso denegado o evidencia incompleta. (dimensión: prueba negativa).
- [ ] **AUD-492** protección de ramas, aprobaciones, artefactos, versionado y promoción: Vincular cada defecto confirmado con una prueba que falle antes y pase después de corregirlo. (dimensión: regresión).
- [ ] **AUD-493** protección de ramas, aprobaciones, artefactos, versionado y promoción: Identificar dependencias directas/transitivas, versiones, licencias y vulnerabilidades pertinentes. (dimensión: dependencias).
- [ ] **AUD-494** protección de ramas, aprobaciones, artefactos, versionado y promoción: Validar variables requeridas y defaults; configuración crítica ausente debe fallar cerrada. (dimensión: configuración).
- [ ] **AUD-495** protección de ramas, aprobaciones, artefactos, versionado y promoción: Alinear la documentación con el código ejecutado y marcar limitaciones no implementadas. (dimensión: documentación).
- [ ] **AUD-496** protección de ramas, aprobaciones, artefactos, versionado y promoción: Registrar versión, commit, algoritmo o modelo que originó el resultado y permitir reproducirlo. (dimensión: versionado).
- [ ] **AUD-497** protección de ramas, aprobaciones, artefactos, versionado y promoción: Probar separación entre usuarios, tenants, sesiones y datos restringidos. (dimensión: aislamiento).
- [ ] **AUD-498** protección de ramas, aprobaciones, artefactos, versionado y promoción: Verificar que acciones críticas generen un evento de auditoría correlacionable e íntegro. (dimensión: auditoría).
- [ ] **AUD-499** protección de ramas, aprobaciones, artefactos, versionado y promoción: Probar recuperación tras reinicio, fallo parcial, desconexión o rollback. (dimensión: recuperación).
- [ ] **AUD-500** protección de ramas, aprobaciones, artefactos, versionado y promoción: Impedir promoción a producción si el control crítico está fallido, omitido o no evaluado. (dimensión: gate de release).

## Criterio de cierre

No cerrar una categoría por haber leído su README. Exigir prueba automatizada, resultado CI, configuración revisada, ejecución reproducible o revisión experta registrada. Mantener diferenciados `NOT_CONFIGURED`, `NOT_VERIFIED`, `FAILED` y `VERIFIED`. No afirmar cumplimiento legal, seguridad cuántica, producción ni porcentajes de avance sin evidencia específica.