# Índice canónico de documentación — Isabella TERMINUS V6

**Actualizado:** 17 de octubre de 2026  
**Repositorio:** `OsoPanda1/ISABELLA-VERSION-TERMINUS-V6`

## Fuentes canónicas

- Estado público, categoría y readiness: [README](../README.md). La cifra reportada debe vincularse al SHA y a evidencia reproducible.
- Estado operativo y bloqueadores: [Estado real actual](ESTADO-REAL-ACTUAL.md).
- Arquitectura y límites de integración: [Mapa operativo](ARCHITECTURE-OPERATING-MAP.md).
- Cierre de bloqueadores productivos: [Runbook](ops/PRODUCTION-READINESS-RUNBOOK.md).
- API: [OpenAPI](api/openapi.yaml), [inventario de rutas](api/README.md), [rutas generadas](api/route-inventory.json).
- Entorno: [Configuración](ENVIRONMENT.md) y [`../.env.example`](../.env.example).
- Seguridad: [SECURITY.md](../SECURITY.md), [modelo de amenazas](security/GENESIS-V6-THREAT-MODEL.md), [implementación ISA-X](security/ISA-X-IMPLEMENTATION.md).
- Auditoría de seguridad/deuda: [Auditoría técnico-operativa consolidada](audits/TECHNICAL-OPERATIONAL-AUDIT-2026-10-13.md), [reducción de deuda técnica](audits/TECH-DEBT-REDUCTION-2026-10-13.md), [auditoría P0](audits/P0-ARCHITECTURE-HARDENING-2026-10-12.md).
- Reauditoría de 500 controles V6: [informe](audit/500-POINT-REAUDIT-V6.md) y [CSV generado](audit/500-POINT-REAUDIT-V6.csv).
- Checklists históricos de GenesisAI: [archivo consolidado](archive/GENESISAI-500-CONTROL-CHECKLISTS-2026-10.md). No son evidencia actual de TERMINUS V6.

## Política de documentación

1. README resume; estado operativo informa evidencia y SHA; runbook lista acciones; auditoría documenta causa, corrección y riesgo residual.
2. Mantener una sola fuente primaria por tema. No duplicar el mismo dictamen entre resumen, auditoría y runbook.
3. No fusionar contratos canónicos, OpenAPI, migraciones, políticas de seguridad ni inventarios generados con informes narrativos.
4. Los inventarios generados se modifican mediante su generador, no manualmente.
5. Nunca declarar `verified`, `wired`, `production` ni aumentar readiness sin evidencia reproducible del SHA evaluado.
6. Antes de borrar una fuente, comprobar referencias entrantes, preservar el contenido necesario y corregir scripts que dependan de la ruta.
7. Mantener explícita la diferencia entre `IMPLEMENTED`, `TESTED`, `INTEGRATED`, `VERIFIED` y `DEPLOYED`.

## Inventario por dominio

### Raíz de `docs/`
- [Mapa operativo](ARCHITECTURE-OPERATING-MAP.md)
- [Plano de aseguramiento](ASSURANCE-CONTROL-PLANE.md)
- [Checklist de auditoría V6](AUDIT_GENESIS_V6_2026-10-08.md) — histórico
- [Especificación operativa CROWN](CROWN-ISABELLA-VOMEGA-OPERATING-SPEC.md)
- [Convergencia CROWN](CROWN_CONVERGENCE.md)
- [Configuración de entorno](ENVIRONMENT.md)
- [Estado real actual](ESTADO-REAL-ACTUAL.md)
- [Especificación GAME OVER/UAGP-1](GAME_OVER_UAGP1_CANONICAL.md)
- [Hyper Skill Fabric](ISABELLA_HYPER_SKILL_FABRIC.md)
- [Puente PennyLane](ISABELLA_PENNYLANE_BRIDGE.md)
- [Integración LITLE](LITLE_GENESIS_INTEGRATION.md)

### API y arquitectura
- [API README](api/README.md)
- [OpenAPI](api/openapi.yaml)
- [Inventario JSON generado](api/route-inventory.json)
- [Integración Genesis-Magpie](architecture/GENESIS-MAGPIE-INTEGRATION.md)

### Auditoría, UX y deuda
- [Reauditoría 500 controles](audit/500-POINT-REAUDIT-V6.md)
- [Datos CSV de la reauditoría](audit/500-POINT-REAUDIT-V6.csv)
- [Benchmark de interfaces de IA](audits/AI-INTERFACE-BENCHMARK-20-2026-10.md)
- [Auditoría técnico-operativa](audits/TECHNICAL-OPERATIONAL-AUDIT-2026-10-13.md)
- [Reducción de deuda técnica](audits/TECH-DEBT-REDUCTION-2026-10-13.md)
- [Auditoría total histórica](audits/TOTAL-AUDIT-2026-10-13.md)
- [Auditoría de ecosistema histórica](audits/PROFILE-ECOSYSTEM-REVIEW-2026-10.md)
- [Auditoría de navegación y chat](audits/UI-NAVIGATION-AND-CHAT-AUDIT-2026-10-12.md)

### Operación, despliegue y seguridad
- [Readiness productivo](ops/PRODUCTION-READINESS-RUNBOOK.md)
- [Guía de despliegue](deployment/README.md)
- [Runbook de despliegue](runbooks/DEPLOY-TODAY.md)
- [Gate de modelo live beta](runbooks/BETA-LIVE-MODEL-GATE.md)
- [Modelo de amenazas](security/GENESIS-V6-THREAT-MODEL.md)
- [ISA-X](security/ISA-X-IMPLEMENTATION.md)
- [Aislamiento de tenants](tenancy/ISOLATION.md)
- [Guardrails conversacionales](policies/CONVERSATIONAL-BETA-GUARDRAILS.md)

### Especificaciones y contratos
- [Blueprint API v4.2](spec/BLUEPRINT-API-v4.2.0.md)
- [Arquitectura Genesis V6](spec/GENESIS-V6-ARCHITECTURE.md)
- [Runtime Genesis V6.1](spec/GENESIS-V6.1-RUNTIME.md)
- [Bibliotecas IKES](spec/IKES-LIBRARIES.md)
- [Canon Isabella v40 (fuente de texto)](spec/ISABELLA-CANON-v40-source.txt)
- [Especificación canónica IKES](spec/canonical/IKES_SPEC.md)
- [Registro de divergencias](spec/canonical/DIVERGENCE-REGISTER.md)
- [Quality gates](spec/canonical/QUALITY_GATES.md)
- [Política de sanitización](spec/canonical/SANITIZATION_POLICY.md)

### Dominios y evolución
- [Backlog de implementación](evolution/IMPLEMENTATION-BACKLOG.md)
- [Manual operativo AI-to-AI](evolution/AI-TO-AI-OPERATING-MANUAL.md)
- [Blueprint V5](evolution/BLUEPRINT-V5.md)
- [Árbol estructural](evolution/STRUCTURAL-TREE-FINAL.md)
- [Ledger durable BookPI](bookpi/DURABLE-LEDGER.md)
- [Motor de facturación](commerce/BILLING-ENGINE.md)
- [Guía comercial consolidada: cláusulas, operación, implementación, QA y métricas](commerce/BILLING-ENGINE.md)
- [Arquitectura OSIRIS](osiris/ARCHITECTURE.md)
- [Arquitectura REINA](reina/ARCHITECTURE.md)
- [Registro canónico TAMV](registry/TAMV-ONLINE-CANONICAL-REGISTRY-v2.0.0.md)

## Registro de consolidación — 17 de octubre de 2026

- Dos checklists históricos de 500 controles se preservaron íntegros en un único archivo de archivo.
- El resumen breve de auditoría del 13 de octubre se integró en la auditoría técnico-operativa ampliada.
- Se eliminaron las tres fuentes redundantes solo después de crear sus versiones consolidadas.
- Los contratos, especificaciones canónicas, artefactos generados y runbooks especializados se conservaron.


## Inventario completo de archivos

Listado reconstruido del árbol Git de `main` más los cambios documentales de esta rama. Incluye Markdown, contratos YAML/JSON, CSV generados y fuentes de texto dentro de `docs/`.

### api

- [`api/README.md`](api/README.md)
- [`api/openapi.yaml`](api/openapi.yaml)
- [`api/route-inventory.json`](api/route-inventory.json)

### architecture

- [`architecture/GENESIS-MAGPIE-INTEGRATION.md`](architecture/GENESIS-MAGPIE-INTEGRATION.md)

### archive

- [`archive/GENESISAI-500-CONTROL-CHECKLISTS-2026-10.md`](archive/GENESISAI-500-CONTROL-CHECKLISTS-2026-10.md)

### audit

- [`audit/500-POINT-REAUDIT-V6.csv`](audit/500-POINT-REAUDIT-V6.csv)
- [`audit/500-POINT-REAUDIT-V6.md`](audit/500-POINT-REAUDIT-V6.md)

### audits

- [`audits/AI-INTERFACE-BENCHMARK-20-2026-10.md`](audits/AI-INTERFACE-BENCHMARK-20-2026-10.md)
- [`audits/GLOBAL-PROFILE-TERMINUS-2026-10-12.md`](audits/GLOBAL-PROFILE-TERMINUS-2026-10-12.md)
- [`audits/P0-ARCHITECTURE-HARDENING-2026-10-12.md`](audits/P0-ARCHITECTURE-HARDENING-2026-10-12.md)
- [`audits/PROFILE-ECOSYSTEM-REVIEW-2026-10.md`](audits/PROFILE-ECOSYSTEM-REVIEW-2026-10.md)
- [`audits/TECH-DEBT-REDUCTION-2026-10-13.md`](audits/TECH-DEBT-REDUCTION-2026-10-13.md)
- [`audits/TECHNICAL-OPERATIONAL-AUDIT-2026-10-13.md`](audits/TECHNICAL-OPERATIONAL-AUDIT-2026-10-13.md)
- [`audits/TOTAL-AUDIT-2026-10-13.md`](audits/TOTAL-AUDIT-2026-10-13.md)
- [`audits/UI-NAVIGATION-AND-CHAT-AUDIT-2026-10-12.md`](audits/UI-NAVIGATION-AND-CHAT-AUDIT-2026-10-12.md)

### bookpi

- [`bookpi/DURABLE-LEDGER.md`](bookpi/DURABLE-LEDGER.md)

### commerce

- [`commerce/BILLING-ENGINE.md`](commerce/BILLING-ENGINE.md)

### deployment

- [`deployment/README.md`](deployment/README.md)

### evolution

- [`evolution/7000-CONTROL-MATRIX.md`](evolution/7000-CONTROL-MATRIX.md)
- [`evolution/AI-TO-AI-OPERATING-MANUAL.md`](evolution/AI-TO-AI-OPERATING-MANUAL.md)
- [`evolution/BLUEPRINT-V5.md`](evolution/BLUEPRINT-V5.md)
- [`evolution/IMPLEMENTATION-BACKLOG.md`](evolution/IMPLEMENTATION-BACKLOG.md)
- [`evolution/MASTER-V5-000.md`](evolution/MASTER-V5-000.md)
- [`evolution/STRUCTURAL-TREE-FINAL.md`](evolution/STRUCTURAL-TREE-FINAL.md)

### ops

- [`ops/PRODUCTION-READINESS-RUNBOOK.md`](ops/PRODUCTION-READINESS-RUNBOOK.md)

### osiris

- [`osiris/ARCHITECTURE.md`](osiris/ARCHITECTURE.md)

### platform

- [`platform/PLATFORM-GIFTS.md`](platform/PLATFORM-GIFTS.md)

### policies

- [`policies/CONVERSATIONAL-BETA-GUARDRAILS.md`](policies/CONVERSATIONAL-BETA-GUARDRAILS.md)

### Raíz de docs

- [`ARCHITECTURE-OPERATING-MAP.md`](ARCHITECTURE-OPERATING-MAP.md)
- [`ASSURANCE-CONTROL-PLANE.md`](ASSURANCE-CONTROL-PLANE.md)
- [`AUDIT_GENESIS_V6_2026-10-08.md`](AUDIT_GENESIS_V6_2026-10-08.md)
- [`CROWN-ISABELLA-VOMEGA-OPERATING-SPEC.md`](CROWN-ISABELLA-VOMEGA-OPERATING-SPEC.md)
- [`CROWN_CONVERGENCE.md`](CROWN_CONVERGENCE.md)
- [`ECOSYSTEM_EVOLUTION_AUDIT_2026-10-09.md`](ECOSYSTEM_EVOLUTION_AUDIT_2026-10-09.md)
- [`ENVIRONMENT.md`](ENVIRONMENT.md)
- [`ESTADO-REAL-ACTUAL.md`](ESTADO-REAL-ACTUAL.md)
- [`GAME_OVER_UAGP1_CANONICAL.md`](GAME_OVER_UAGP1_CANONICAL.md)
- [`ISABELLA_HYPER_SKILL_FABRIC.md`](ISABELLA_HYPER_SKILL_FABRIC.md)
- [`ISABELLA_PENNYLANE_BRIDGE.md`](ISABELLA_PENNYLANE_BRIDGE.md)
- [`LITLE_GENESIS_INTEGRATION.md`](LITLE_GENESIS_INTEGRATION.md)

### registry

- [`registry/TAMV-ONLINE-CANONICAL-REGISTRY-v2.0.0.md`](registry/TAMV-ONLINE-CANONICAL-REGISTRY-v2.0.0.md)

### reina

- [`reina/ARCHITECTURE.md`](reina/ARCHITECTURE.md)

### research

- [`research/ISABELLA-PUBLIC-KNOWLEDGE-GAP-2026.md`](research/ISABELLA-PUBLIC-KNOWLEDGE-GAP-2026.md)

### runbooks

- [`runbooks/BETA-LIVE-MODEL-GATE.md`](runbooks/BETA-LIVE-MODEL-GATE.md)
- [`runbooks/DEPLOY-TODAY.md`](runbooks/DEPLOY-TODAY.md)

### security

- [`security/GENESIS-V6-THREAT-MODEL.md`](security/GENESIS-V6-THREAT-MODEL.md)
- [`security/ISA-X-IMPLEMENTATION.md`](security/ISA-X-IMPLEMENTATION.md)

### spec

- [`spec/BLUEPRINT-API-v4.2.0.md`](spec/BLUEPRINT-API-v4.2.0.md)
- [`spec/GENESIS-V6-ARCHITECTURE.md`](spec/GENESIS-V6-ARCHITECTURE.md)
- [`spec/GENESIS-V6.1-RUNTIME.md`](spec/GENESIS-V6.1-RUNTIME.md)
- [`spec/IKES-LIBRARIES.md`](spec/IKES-LIBRARIES.md)
- [`spec/ISABELLA-CANON-v40-source.txt`](spec/ISABELLA-CANON-v40-source.txt)
- [`spec/canonical/CONTRIBUTING.md`](spec/canonical/CONTRIBUTING.md)
- [`spec/canonical/DEPLOYMENT_POLICY.md`](spec/canonical/DEPLOYMENT_POLICY.md)
- [`spec/canonical/DIVERGENCE-REGISTER.md`](spec/canonical/DIVERGENCE-REGISTER.md)
- [`spec/canonical/EVIDENCE_MANIFEST_SCHEMA.md`](spec/canonical/EVIDENCE_MANIFEST_SCHEMA.md)
- [`spec/canonical/GIT_POLICY.md`](spec/canonical/GIT_POLICY.md)
- [`spec/canonical/IKES_SPEC.md`](spec/canonical/IKES_SPEC.md)
- [`spec/canonical/LSP_VALIDATION.md`](spec/canonical/LSP_VALIDATION.md)
- [`spec/canonical/QUALITY_GATES.md`](spec/canonical/QUALITY_GATES.md)
- [`spec/canonical/SANITIZATION_POLICY.md`](spec/canonical/SANITIZATION_POLICY.md)
- [`spec/canonical/SYNC_SPEC.md`](spec/canonical/SYNC_SPEC.md)
- [`spec/canonical/TAMV_INTEGRATION.md`](spec/canonical/TAMV_INTEGRATION.md)
- [`spec/canonical/VERIFIER_SPEC.md`](spec/canonical/VERIFIER_SPEC.md)
- [`spec/canonical/isabella-diff.README.md`](spec/canonical/isabella-diff.README.md)
- [`spec/canonical/isabella-diff.manifest.json`](spec/canonical/isabella-diff.manifest.json)

### tenancy

- [`tenancy/ISOLATION.md`](tenancy/ISOLATION.md)

