# Canonical Quality Gates

**Contexto:** gates mínimos para eliminar errores, sesgos e inconsistencias antes de promoción.

**Estado:** stable.

**Dependencias:** todos los módulos canónicos, CI, BookPI.

1. **Schema:** todos los archivos tienen contexto, estado y dependencias.
2. **Truthfulness:** no se presentan mocks, simulaciones o planes como producción.
3. **Identity:** duplicados se deciden con hash, estructura, semántica, claims y tiempo.
4. **Preservation:** ante duda se conserva.
5. **Temporal:** current e historical se recuperan según la consulta.
6. **Security:** secretos, PII y malware se detectan antes de indexar.
7. **Tenant:** ningún manager, proxy, índice o LSP cruza tenants.
8. **Concurrency:** no hay carreras de entidad, commit o release.
9. **Evidence:** cada afirmación importante tiene provenance y estado epistemológico.
10. **Reproducibility:** commit completo, configuración, entorno, pruebas y limitaciones.
11. **External actions:** push, PR, borrado y deploy requieren policy gate y aprobación.
12. **Licensing:** conservar avisos y licencias de terceros.
13. **Rollback:** todo release tiene reversión verificable.
14. **No overclaim:** un resultado técnico no se eleva a verdad científica.
15. **Human gate:** operaciones críticas y claims controvertidos requieren revisión humana.
