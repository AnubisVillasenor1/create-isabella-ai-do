# RFC-0004 — Gobernanza y seguridad

## Controles
- Tokens administrativos separados, no reutilizados (preflight PF-TOKEN-REUSED).
- Secretos >=32 chars, entropía >=96 bits.
- Kill switch `ISA_KILL_SWITCH` apaga scopes gobernados.
- Blackout Terminus requiere claves `ISA_KILL_PUBKEY_*`.
- WebAuthn fail-closed sin trust anchors.
- Aprobación humana separada de ejecución automática.
- Acciones de alto impacto terminan en `HUMAN_REVIEW`.
- No confiar en `x-user-id`.
- No usar service_role en navegador.
- CSP/HSTS/X-Content-Type-Options aún no declarados (observación de seguridad).
