# Git Governance Policy

**Contexto:** operaciones Git seguras para las bibliotecas canónicas.

**Estado:** stable.

**Dependencias:** Git, CROWN, ARGUS, BookPI, CI.

## Operaciones

La limpieza de `[gone]`, `git branch -D`, `git worktree remove --force`, push, merge y PR son operaciones con efectos externos o destructivos.

Flujo obligatorio:

```text
inspect → propose → policy gate → user approval when required → execute → audit
```

No borrar la rama actual, worktrees con trabajo no guardado ni ramas con commits no fusionados sin revisión.

Commits deben tener alcance limitado, secret scan, pruebas y manifest de evidencia. No usar `git add .` sin revisar el diff.
