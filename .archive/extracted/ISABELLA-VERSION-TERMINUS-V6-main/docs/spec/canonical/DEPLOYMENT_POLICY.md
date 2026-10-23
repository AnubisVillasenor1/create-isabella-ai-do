# Deployment Policy: Lovable, GitHub and Vercel

**Contexto:** despliegue gradual de la capa de aplicación sin confundir prototipo visual con backend soberano.

**Estado:** draft.

**Dependencias:** GitHub, CI, Vercel/Lovable, DNS, CROWN, ARGUS, secretos.

## Separación

- `tamv-spec`: especificaciones y documentación.
- `tamv-app`: aplicación ejecutable.
- IKES: bibliotecas y evidencia.

Lovable puede generar UI y flujo inicial. GitHub debe ser la fuente de revisión; Vercel/Lovable son destinos de despliegue sujetos a security scan, smoke tests, auth, permisos, secretos, privacidad y rollback.

## Gates

```text
build → tests → secret scan → dependency scan → security scan
→ auth/RLS → smoke → health/readiness → canary → rollback plan
```

DNS, dominios personalizados y registros A/TXT/CNAME deben documentarse con valores reales del proveedor; nunca usar IPs de ejemplo en producción.
