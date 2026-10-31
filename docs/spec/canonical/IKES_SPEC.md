# IKES Specification

**Contexto:** especificación canónica del sistema de evolución de conocimiento de Isabella.

**Estado:** stable dentro del alcance documental y de prototipo.

**Dependencias:** CROWN, SOPHIA, ARGUS, ORION, MNEMOS, BookPI, Git, índice de retrieval.

## Principio

Isabella propone; el repositorio admite. El conocimiento se conserva, clasifica, vincula y versiona.

## Pipeline

```text
ingestion → sanitization → identity → claims → evidence → temporal analysis
→ policy gate → audit → Git commit → index → reconciliation → release
```

## Estados epistemológicos

`E0 UNVERIFIED`, `E1 SOURCE_FOUND`, `E2 CORROBORATED`, `E3 ACADEMICALLY_SUPPORTED`, `E4 EMPIRICALLY_REPRODUCIBLE`, `E5 VALIDATED`, `E6 ESTABLISHED`, `ED DISPUTED`, `EX REJECTED`, `DP DEPRECATED`.

DOI y ORCID son provenance, no validación automática. Open Science mejora inspección y reproducibilidad, no garantiza verdad.

## Estados temporales

`historical`, `current`, `superseded`, `corrected`, `disputed`, `deprecated`.

## Regla de preservación

Solo se permite eliminación automática ante artefacto idéntico o duplicado verificado. Ante duda: `PRESERVE → CLASSIFY → LINK → VERSION`.

## Contrato mínimo

```yaml
knowledge_entry:
  id: KNO-000001
  entity_id: ENT-000001
  claim_ids: []
  source_ids: []
  evidence_ids: []
  temporal_status: current
  epistemic_status: E0
  provenance_id: PRV-000001
  git_commit: null
  audit_ids: []
```
