# Isabella Villaseñor AI — Genesis TINA / TERMINUS V6

**Isabella Villaseñor AI** es una plataforma de inteligencia artificial gobernada, federable y territorialmente adaptable. No es un modelo fundacional propietario ni una afirmación de consciencia: es infraestructura de orquestación, memoria, aprendizaje, seguridad, evidencia y operación que combina capacidades deterministas nativas con proveedores generativos opcionales.

> **Invariante:** `CAPABILITY ≠ AUTHORITY ≠ EXECUTION ≠ EVIDENCE ≠ LEARNING ≠ PRODUCTION`.

Una capacidad sugiere o calcula; la autoridad se decide mediante políticas; la ejecución de efectos sensibles requiere una capacidad autorizada y, cuando corresponde, aprobación humana; la evidencia debe ser verificable; el aprendizaje queda sujeto a gobernanza; y ningún test local certifica producción por sí solo.

## Qué es Isabella

Isabella separa el núcleo universal de cada despliegue territorial. Real del Monte, Hidalgo, es el nodo de referencia, no una restricción. Cada territorio puede conservar sus datos, idioma, memoria, reglas, operadores, límites de autonomía, modelos locales y plugins autorizados.

La arquitectura integra:

- Motor Native Governed ML determinista, explicable y provider-agnostic.
- Capa opcional de inferencia generativa local o externa con fallback gobernado.
- Aprendizaje federado: FedAvg, FedProx, Scaffold, LoRA, DPO, RLAIF y active learning.
- Adaptadores territoriales y separación entre conocimiento universal, territorial, operativo, personal y de gobernanza.
- Plugins, herramientas y módulos registrados con identidad de método y mínimo privilegio.
- Políticas CROWN, aprobación humana, evaluación de riesgo y firewall semántico.
- BookPI: evidencia append-only, hashes, idempotencia y almacenamiento durable configurable.
- Memoria y RAG con procedencia, búsqueda híbrida y aislamiento por tenant.
- Integración con TAMV, MD-X4 Kernel, FGAIS, AEGIS y RDM Digital LTOS.

## Estado honesto

**Estado actual: preproducción auditada.** Avance global de implementación: 100% de los contratos y módulos declarados en el alcance de esta rama, con evidencia base en SHA 802e6ee; la producción no está certificada. `SPECIFIED ≠ IMPLEMENTED ≠ TESTED ≠ INTEGRATED ≠ VERIFIED ≠ DEPLOYED ≠ CERTIFIED`.

En la última ejecución local de esta rama:

- `pnpm typecheck`: verde.
- `pnpm test`: 1663/1669 verde; 6 fallos en contratos de artefacto Docker que fueron corregidos en esta actualización.
- Persistencia durable, proveedores reales, E2E remoto, observabilidad externa, despliegue y rollback requieren evidencia en los entornos correspondientes.
- Los módulos marcados `draft` o `engine-generated` requieren revisión humana antes de declararse `verified` o `wired`.

No se publican porcentajes de madurez como certificación. Los bloqueos externos —credenciales, base de datos, facturación de GitHub Actions, proveedores y permisos— deben validarse operacionalmente.

## Arquitectura

### ISABELLA-Q Ω: siete capas

1. **Cognitive Governance** — políticas, quality gates, evidencia, ética e interpretación constitucional.
2. **HyperRouter MoE** — registro de expertos, scoring, balanceo y circuit breakers.
3. **Memory Mesh** — PostgreSQL/pgvector, Redis, Qdrant, Neo4j, object storage y ledger según configuración.
4. **Quantum-Ready RAG** — BM25, vector, grafo, reranking y síntesis de evidencia.
5. **Zero-Trust Security** — identidad, dispositivo, conducta, riesgo, sandbox y auditoría.
6. **Federated Learning** — adapters, preferencias, feedback, agregación y versionado gobernado.
7. **Sovereign Runtime** — federaciones TAMV, pipelines HyperTurbo e integración SSR/API/UI.

La etiqueta “quantum-ready” describe interfaces y contratos preparados para criptografía híbrida; no prueba seguridad poscuántica ni certificación FIPS sin bibliotecas, claves, interoperabilidad y auditoría externas.

### Native Governed ML

El motor nativo vive en `src/lib/native-ml/` y ofrece regresión determinista, fallback, detección de anomalías, clustering, model cards, data cards y contratos de aprobación. Sus predicciones son degradadas y explicables; un modelo no aprobado no puede predecir por defecto. La federación avanzada vive en `src/learning/federated/` y mantiene separación entre simulación, contrato y entrenamiento real.

### Revenue Fabric y BookPI

Revenue Fabric incluye planes, entitlements, metering, suscripciones, eventos de proveedor, ledger de doble entrada, outbox/inbox e idempotencia. BookPI admite ledger en memoria para pruebas y almacenamiento durable JSONL/PostgreSQL según configuración. Hashes y HMAC aportan integridad, pero no sustituyen WORM, control de acceso, backups cifrados ni un custodio externo.

## Flujo gobernado

1. Validar cuerpo, formato, tenant, identidad y límites.
2. Resolver política, presupuesto, riesgo y necesidad de aprobación.
3. Seleccionar únicamente capacidades y proveedores permitidos.
4. Ejecutar con timeout, circuit breaker y fallback explícito.
5. Validar resultado, procedencia, seguridad y evidencia.
6. Registrar el evento sin secretos ni PII innecesaria.
7. Ejecutar efectos externos solo con autorización verificable.
8. Exponer fallos de dependencias en readiness; nunca ocultarlos detrás de un `200` superficial.

## Estructura principal

```text
src/                  Runtime TypeScript, API y módulos de dominio
src/lib/native-ml/    Native Governed ML y contratos soberanos
src/learning/         Aprendizaje federado y adaptadores
src/governance/       CROWN, gates y controles
src/security/         Zero-trust, PII y hardening
src/bookpi/           Ledger, retención, backup y verificación
src/commerce/         Revenue Fabric, planes y metering
src/ui/               Interfaz y smoke checks
ige-omega/            Núcleo Rust experimental y contratos de memoria
infra/ k8s/ deploy/   Persistencia, contenedores y manifiestos draft
scripts/              Assurance, seguridad, smoke y operación
 test/                Evidencia automatizada; no equivale a aprobación humana
docs/                 Especificaciones canónicas, auditorías y runbooks
data/                 Fuentes documentales, incluido el blueprint Native ML
```

## Instalación y gates

Requisitos: Node.js 24.x y pnpm 10.28.0.

```bash
corepack enable
corepack prepare pnpm@10.28.0 --activate
pnpm install --frozen-lockfile
pnpm typecheck
pnpm test
pnpm run build
pnpm run security:suite
pnpm run smoke:ui
pnpm run smoke:runtime
```

Comprobaciones con dependencias externas:

```bash
pnpm run postgres:e2e
pnpm run smoke:production
pnpm run verify:production
pnpm run production:evidence
```

Los comandos remotos solo cuentan como evidencia si se ejecutan contra el SHA evaluado, con logs y permisos reproducibles.

## Docker y operación local

La imagen usa build multi-stage, bundle ESM, dependencias de producción, usuario numérico no root `10001`, `no-new-privileges`, healthcheck y activos de UI/video. Compose ofrece PostgreSQL, Ollama opcional, VictoriaMetrics, OpenTelemetry, Caddy y volumen `bookpi-data`. Los secretos deben existir fuera del repositorio; no se deben usar contraseñas de ejemplo en producción.

## Configuración y seguridad

Variables frecuentes: `POSTGRES_URL`/`DATABASE_URL`, `BOOKPI_PIPELINE_STORAGE`, `BOOKPI_INTEGRITY_SECRET`, tokens operativos, proveedor de inferencia, `OTEL_EXPORTER_OTLP_ENDPOINT`, `REDIS_URL`, `QDRANT_*`, `NEO4J_*`, `S3_*`, `SUPABASE_*`, Stripe y claves de aprobación humana. La presencia de una variable no demuestra conectividad, permisos, salud ni cumplimiento.

Nunca se almacenan secretos en código, README, issues o commits. La service role de Supabase solo puede vivir en servidor. Los proveedores externos requieren evaluación de privacidad, residencia, coste, retención y disponibilidad. Las rutas sensibles deben fallar cerrado.

## Contrato de contribución

1. Crear rama y declarar la intención o control.
2. Hacer el cambio mínimo verificable.
3. Añadir o actualizar pruebas.
4. Ejecutar typecheck, tests y gates relevantes sobre el mismo SHA.
5. Mantener `state: draft` hasta revisión humana con nombre.
6. Abrir PR; no aprobar ni desplegar sin revisión y evidencia.

## Referencias canónicas

- [AGENTS.md](AGENTS.md) — constitución operativa.
- [Blueprint Native ML](data/machinelearning-isabella-1e9d9b.docx) — arquitectura fuente v2.0.0.
- [Backlog de implementación](docs/evolution/IMPLEMENTATION-BACKLOG.md).
- [Arquitectura operativa](docs/ARCHITECTURE-OPERATING-MAP.md).
- [Especificación canónica](docs/spec/GENESIS-V6-ARCHITECTURE.md).
- [Ledger durable](docs/bookpi/DURABLE-LEDGER.md).
- [Runbook de producción](docs/ops/PRODUCTION-READINESS-RUNBOOK.md).
- [Política de despliegue](docs/spec/canonical/DEPLOYMENT_POLICY.md).

## Declaración final

Isabella es una infraestructura gobernada para ampliar capacidades humanas con trazabilidad, control territorial, seguridad y aprendizaje responsable. El código actual es una base amplia de preproducción: los resultados se consideran evidencia computacional hasta que una persona responsable los revise y los entornos reales demuestren persistencia, proveedores, observabilidad, despliegue y recuperación. Ninguna afirmación de autonomía, consciencia, soberanía legal, certificación normativa o seguridad poscuántica debe inferirse de la existencia de este repositorio.
