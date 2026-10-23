# LSP Technical Validation

**Contexto:** validación técnica de código/documentos mediante clientes LSP asíncronos.

**Estado:** alpha.

**Dependencias:** ORION, LSP servers, IKES, BookPI.

## Contrato

`open_file`, `save_file`, `wait_for_diagnostics`, `diagnostics_for`.

## Frescura

```text
didOpen → version 0
didChange → version + 1
fresh(result, v) iff result.version >= v
```

Resultados: `FRESH_NO_DIAGNOSTICS`, `FRESH_WITH_DIAGNOSTICS`, `NO_FRESH_DATA`.

`NO_FRESH_DATA` no significa archivo limpio. Solo `FRESH_NO_DIAGNOSTICS` puede ser `TECHNICALLY_CLEAN`.

## Límites

LSP aporta evidencia técnica acotada; no valida afirmaciones científicas ni sustituye provenance, corroboración o revisión humana.
