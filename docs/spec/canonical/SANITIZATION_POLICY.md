# Sanitization Policy

**Contexto:** sanitización segura de documentos antes de deduplicación y admisión.

**Estado:** alpha.

**Dependencias:** ARGUS, ORION, IKES identity layer, licencia y política de privacidad.

## Flujo

```text
raw → malware/file safety → format → encoding → metadata/content
→ PII/secrets → license → language → classification → fingerprints
```

La sanitización no debe alterar el significado. El original se conserva inmutable cuando la licencia lo permite; la versión normalizada se usa para análisis.

## Controles

- Normalización Unicode NFKC.
- Detección de caracteres de control.
- Detección y cuarentena de secretos.
- PII minimizada y enmascarada según política.
- Validación de tamaño, formato y encoding.
- Comprobación de licencia y provenance.
- Fingerprint físico, estructural y semántico.

Los archivos sospechosos no se indexan ni ejecutan. Se registran como `QUARANTINED`.


## Automatic-admission license gate

Automatic admission is deliberately conservative. The current code allowlist is limited to MIT, Apache-2.0, BSD-2-Clause, BSD-3-Clause, ISC, Unlicense, CC0-1.0 and CC-BY-4.0. MPL-2.0, GPL/AGPL, CC-BY-SA and CC-BY-NC/ND variants require an explicit compatibility review and are rejected from automatic admission. This is a technical gate, not a legal determination, proof of ownership, or a substitute for preserving required notices and attribution.

The sanitizer receives JavaScript strings rather than raw encoded byte streams. It therefore accepts only UTF-8 declarations; it does not claim to decode arbitrary encodings. A rejected or quarantined item must not be treated as admitted knowledge.


The automatic allowlist currently contains MIT, Apache-2.0, BSD-2-Clause, BSD-3-Clause, ISC, Unlicense and CC0-1.0. CC-BY-4.0 is not automatically admitted because this schema does not yet preserve a complete attribution manifest; it and share-alike, non-commercial, no-derivatives, MPL, GPL and AGPL variants require explicit compatibility review. This is a conservative software gate, not a legal opinion.
