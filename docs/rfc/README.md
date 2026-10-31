# RFC Index — Isabella TERMINUS V6 (Sanitización documental)

**Estado:** engine-generated  
**Fuente canónica de navegación:** este directorio.  
**Política:** un RFC por dominio. Los documentos narrativos históricos se archivan en `docs/history/archive/`.  
**No se eliminan contratos generados, OpenAPI, migraciones, specs canónicas ni inventarios.**

## RFCs

| RFC | Título | Dominio |
|---|---|---|
| RFC-0001 | Runtime y operatividad | Arranque, health/readyz, smoke, build |
| RFC-0002 | Variables de entorno manuales | Lista exhaustiva de env a ingresar |
| RFC-0003 | Arquitectura y SSOT | Fronteras, módulos, capas excluidas |
| RFC-0004 | Gobernanza y seguridad | Tokens, kill switch, WebAuthn, aprobación humana |
| RFC-0005 | Persistencia e integridad | Postgres, Supabase/Atlas, IKES, BookPI |
| RFC-0006 | Proveedores de inferencia | IA, voz, fallback, multimodal |
| RFC-0007 | Despliegue y operaciones | CI, Docker, Vercel, rollback, observabilidad |
| RFC-0008 | Voz y TTS | Genesis TTS, IVCC, consentimiento |
| RFC-0009 | Sanitización documental | Archivo, unificación, reglas de borrado |

## Fuentes que permanecen intactas (load-bearing)

- `docs/STATUS.md` (generado)
- `docs/ESTADO-REAL-ACTUAL.md`
- `docs/api/*`
- `docs/spec/*` y `docs/spec/canonical/*`
- `docs/security/*`
- `docs/runbooks/*`
- `docs/architecture/SSOT.md`
- `docs/reference/*`
- `docs/01-ISABELLA-CANONICA-UNIFICADA.md`
