# ISABELLA GENESIS Ω (IGE-Ω) — v2.0.0

**Código canónico:** CANON-EOC-IGE-OMEGA-2026-v8  
**Fecha de especificación:** 10 de octubre de 2026  
**Nodo Cero declarado:** Real del Monte / Mineral del Monte, Hidalgo, México  
**DOI declarado:** 10.5281/zenodo.20606361  
**OSF declarado:** 10.17605/OSF.IO/T3WMY  
**Autoría legal y territorial declarada:** Edwin Oswaldo Castillo Trejo  
**Firma técnica y operativa declarada:** Anubis Villaseñor  
**ORCID declarado:** 0009-0008-5050-1539  
**Ecosistema declarado:** TAMV Online Network · Isabella Villaseñor AI Genesis · RDM Digital Hub · UTAMV · CROWN Framework  
**Clasificación:** COGNITIVE_OPERATING_SYSTEM_BLUEPRINT + RUST_MVP_IMPLEMENTABLE + POSTGRES_PERSISTENT + PRE_PRODUCTION

> CONTRACT ≠ IMPLEMENTED ≠ TESTED ≠ INTEGRATED ≠ VERIFIED ≠ DEPLOYED ≠ CERTIFIED

## 1. Definición
IGE-Ω es un sistema operativo cognitivo modular y gobernado; no es un LLM, chatbot, IA consciente ni autoridad autónoma. El modelo de lenguaje, cuando se incorpore, será un componente intercambiable. El sistema separa percepción, modelado, razonamiento, simulación, arbitraje, ejecución, evidencia, aprendizaje y reversión. El MVP implementa contratos de memoria, un planificador heurístico, un simulador de escenarios sintéticos, arbitraje CROWN, un ledger hash-chain y un gateway HTTP; no implementa todos los subsistemas objetivo.

## 2. Axiomas
**CAPABILITY ≠ AUTHORITY ≠ EXECUTION ≠ EVIDENCE ≠ LEARNING ≠ PRODUCTION.** La identidad precede a la capacidad; la capacidad no implica autoridad; la autoridad exige responsabilidad; la responsabilidad requiere evidencia y procedencia; la ejecución exige gobernanza, auditoría y reversibilidad. Las decisiones constitucionales, críticas o irreversibles permanecen bajo control humano. Aprendizaje y memoria son evidencia contextual, no verdad automática.

## 3. Arquitectura lógica
- **World Model:** entidades, relaciones y aristas causales declaradas. Grafo en memoria; migraciones SQL preparadas, pero no hay repositorio persistente del grafo todavía.
- **Cognition:** hipótesis alternativas, validación de entradas y planificación. No hay inferencia neuronal nativa ni probabilidad de éxito calibrada.
- **NeuroKernel:** bus de eventos en memoria, cola acotada y máquina de estados. No se declara Raft, CRDT ni mensajería distribuida.
- **Memory / IKES-X:** PostgreSQL con tenant, usuario, alcance, procedencia, caducidad y estado epistémico. Embedding se guarda como JSONB opcional; no es búsqueda vectorial ni pgvector.
- **ABX/CROWN:** arbitraje determinista conservador. AEGIS completo, identidad federada y consentimiento granular siguen en roadmap.
- **BookPI-X:** eventos enlazados por SHA-256 y verificación lineal. No es WORM ni firma digital.
- **Gateway:** Axum, bearer token para rutas protegidas, health/readiness y migraciones SQLx.
- **Execution Engine:** deshabilitado. Toda respuesta declara `execution_performed=false`.

## 4. Flujo de decisión
1. Validar tamaño y estructura de entrada.
2. Autenticar rutas protegidas.
3. Estimar riesgo preliminar con heurística explícita.
4. Generar hipótesis y plan.
5. Simular sólo escenarios explícitos y bajo presupuesto acotado.
6. Arbitrar CROWN; alto/crítico o aprobación requerida llevan a ESCALATE.
7. Registrar evento en BookPI-X.
8. Responder como propuesta con estado UNVERIFIED, sin ejecución.
9. Revisión humana y verificación independiente antes de promover una decisión.

## 5. Workspace Rust
El workspace vive en `ige-omega/` para coexistir con el monorepo TypeScript. Crates: `shared`, `neurokernel`, `cognition`, `memory`, `worldmodel`, `abx`, `bookpix`; binario: `services/gateway`. Dependencias principales: Rust stable, Axum 0.8, SQLx 0.8 y PostgreSQL 16.

## 6. API MVP
- `GET /health`: liveness.
- `GET /ready`: consulta PostgreSQL y verifica disponibilidad de DB.
- `POST /api/v1/infer`: propuesta, arbitraje y evento BookPI; requiere bearer token.
- `POST /api/v1/memory`: guarda memoria como UNVERIFIED; requiere bearer token.
- `GET /api/v1/memory?tenant_id=...&user_id=...`: lista memoria del tenant/usuario; requiere bearer token.
- `GET /api/v1/ops/audit/verify`: verifica toda la cadena BookPI; requiere bearer token.

Los IDs tenant/usuario del body son aislamiento lógico, no identidad autenticada. Antes de producción, deben derivarse de claims validados y autorización por tenant. El token estático es autenticación de servicio MVP, no identidad multiusuario.

## 7. Evidencia y memoria
No se promueve contenido automáticamente a CORROBORATED, VALIDATED o ESTABLISHED. Para registrar fuentes externas, guardar hash de los bytes realmente recuperados, URL/ID, hora, método de extracción y licencia. Un hash con forma válida sin bytes ni procedencia no prueba evidencia. Minimizar datos personales y no almacenar secretos en el ledger.

## 8. Simulación
El simulador recibe escenarios hipotéticos con probabilidades e impactos declarados, valida límites y restringe iteraciones. Reporta impacto esperado, peor caso y p95 de muestra. Es reproducible, no causal, no calibrado y no predice hechos reales sin evaluación independiente.

## 9. Seguridad
Bearer token de al menos 32 caracteres, comparación en tiempo constante para valores de igual longitud, límites de entrada, SQL parametrizado, migraciones versionadas y contenedor no root. No incluir secretos en Git. Antes de producción: TLS/Ingress, rate limits, OIDC, rotación de tokens, autorización por tenant, gestor de secretos, backups probados, alertas, SBOM y escaneo de imágenes. Revisar NetworkPolicy en cada clúster.

## 10. Auditoría criptográfica
Ver [CRYPTOGRAPHIC-AUDIT.md](CRYPTOGRAPHIC-AUDIT.md). SHA-256 encadenado detecta alteraciones con cabeza de confianza externa; no implementa firma, WORM ni no repudio.

## 11. Kubernetes
Manifiestos en `deployment/k8s/`: Namespace, ConfigMap, Deployment, Service, HPA y NetworkPolicy. PostgreSQL se provisiona aparte y los Secrets se crean fuera del repositorio. El manifiesto no demuestra que se haya desplegado ni que esté disponible.

## 12. Pruebas y criterio de verificación
```bash
cd ige-omega
cargo fmt --check
cargo clippy --workspace --all-targets -- -D warnings
cargo test --workspace
cargo build --release -p gateway
```
Sólo se declara TESTED si los comandos pasan en CI sobre el mismo SHA, con Cargo.lock generado/versionado y resultados conservados. Este commit no incluye resultados de compilación verificados.

## 13. Roadmap
- Fase 0: compilar, API, PostgreSQL, políticas, auditoría, pruebas de integración.
- Fase 1: grafo persistente, temporalidad, búsqueda semántica real y permisos por tenant.
- Fase 2: simulación calibrada, cuotas, cancelación y validación empírica.
- Fase 3: workflows/sagas con dry-run, idempotencia, compensación y aprobación humana.
- Fase 4: registro de expertos, sandbox, evaluación, promoción y trazabilidad de datasets.
- Fase 5: checkpoints firmados, KMS/HSM, WORM y testigo independiente.
- Fase 6: extraer servicios sólo cuando métricas y límites de dominio lo justifiquen.

## 14. Axioma final
IGE-Ω no reemplaza el juicio humano: lo hace trazable, cuestionable y, cuando se habilite ejecución, reversible. No confunde correlación con causalidad, memoria con verdad, inferencia con autoridad, simulación con certeza ni ejecución con legitimidad.


## Endurecimiento de la API (implementación de seguimiento)

El gateway admite tokens Bearer ligados a un par tenant/usuario mediante `IGE_API_TOKENS=token|tenant_uuid|user_uuid;...`; los DTOs no aceptan IDs de identidad del cliente. Los cuerpos HTTP están limitados a 64 KiB. `POST /api/v1/simulate` ejecuta simulación acotada y registra el resultado como evento `SIMULATION_COMPLETED`; no autoriza ni ejecuta acciones externas. La migración `0005_audit_immutability_and_memory_indexes.sql` impide UPDATE/DELETE ordinarios sobre `bookpi_events` mediante trigger, pero no ofrece garantías WORM contra el propietario de la base de datos.

### Memoria: borrado explícito

`DELETE /api/v1/memory/{memory_id}` elimina físicamente el registro si pertenece al tenant y usuario autenticados. La eliminación y el evento `MEMORY_RECORD_ERASED` se confirman en una transacción; el evento registra metadatos de borrado, nunca el contenido eliminado. Esta operación no es reversible por diseño y no debe describirse como rollback.


### Memoria por sesión

La migración `0008_session_scoped_memory.sql` añade `session_id` y exige consistencia entre alcance y sesión. Las memorias `SESSION` requieren un ID de sesión tanto al guardarse como al consultarse; las memorias `TENANT` y `USER` no aceptan `session_id`. El aislamiento principal sigue derivándose del token autenticado.
