# Evidence Manifest Schema

**Contexto:** formato mínimo para hacer reproducible cada validación o release.

**Estado:** stable.

**Dependencias:** BookPI, Git, CI, IKES, LSP.

```yaml
manifest_id: EVM-{SHA-256-HEX-64}
repository: isabella-knowledge
commit: full-sha
created_at: 2026-10-05T00:00:00Z
claim_ids: []
source_ids: []
validation:
  status: passed
  tests: []
  lsp: []
security:
  secret_scan: passed
  dependency_scan: passed
policy_decision: DEC-000001
bookpi_audit_ids: []
rollback_plan: revert_commit
limitations: []
```

Un manifest incompleto no puede respaldar un estado stable. Una excepción requiere un registro con aprobador, fecha, rationale y evidencia, y debe ser verificada por un adaptador de confianza; un booleano o un marcador textual no es autorización.

El ID EVM usa los 64 caracteres hexadecimales de SHA-256 sobre los campos materiales de evidencia. created_at se excluye deliberadamente para conservar identidad reproducible. El hash demuestra integridad del contenido del manifest, no autenticidad del autor ni veracidad de la evidencia.
