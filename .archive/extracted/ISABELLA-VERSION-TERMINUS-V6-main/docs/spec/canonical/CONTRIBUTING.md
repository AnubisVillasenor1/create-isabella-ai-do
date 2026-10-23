# Convenciones de contribución

**Contexto:** reglas para añadir o modificar archivos en las bibliotecas canónicas.

**Estado:** stable.

**Dependencias:** README.md, CROWN, BookPI, Git.

## Encabezado obligatorio

Cada archivo nuevo debe comenzar con:

```yaml
context: "Descripción breve del propósito"
status: draft | alpha | stable
dependencies:
  - "módulo o servicio"
ownership: "mantenedor o equipo"
version: "x.y.z"
limitations:
  - "limitación conocida"
```

## Reglas

1. No mezclar visión con capacidad implementada.
2. No presentar simulaciones como producción.
3. No eliminar información histórica; deprecarla o supersederla.
4. No añadir secretos, tokens, PII innecesaria ni credenciales.
5. Toda afirmación técnica importante debe vincularse a evidencia.
6. Toda mutación externa requiere autorización adecuada.
7. Actualizar el README maestro cuando se cree un módulo clave.
8. Añadir pruebas antes de cambiar un contrato estable.
9. Declarar cambios incompatibles y plan de migración.
10. Mantener licencias y provenance de terceros.
