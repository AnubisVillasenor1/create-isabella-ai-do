# Isabella Scope Authorization Runtime v4

Policy Decision Point (PDP) para el **Trust Plane** de Isabella Mexa. Verifica
JWT firmados (JWKS/RS256 en producción o Ed25519 local en modo soberano) y
evalúa scopes jerárquicos, roles con mínimo privilegio, assurance levels,
condiciones ABAC, replay protection, auditoría hash-linked y cache de
decisiones. Fail-closed por diseño.

## Principio innegociable

Los claims solo son confiables **después** de verificar la firma. Las señales de
alta garantía (`aal`, `step_up`, `dual_control`, `environment`) se leen del
**token verificado**, nunca del request del cliente. Esto corrige el bypass de
ABAC presente en versiones previas donde esos campos venían del cliente.

## Puesta en marcha

```bash
python3 -m venv .venv && . .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # configura JWKS O Ed25519
python isabella_runtime.py --http --host 127.0.0.1 --port 8080
```

Stdio (JSONL) para integración por pipe:

```bash
python isabella_runtime.py --catalog catalog.json --stdio < requests.jsonl
```

## Endpoints

- `GET /health`, `GET /ready` (confirma que hay verificador configurado)
- `GET /v1/diagnostics` (solo versión de policy, sin secretos)
- `POST /v1/authorize` → decisión canónica `ALLOW`/`DENY`

## Pruebas

```bash
python -m py_compile isabella_runtime.py
python tests/test_runtime.py
```

## Evolución productiva (ver sección 10 del spec)

`FastReplayStore` → Redis `SET NX EX`; SQLite audit → PostgreSQL append-only;
`PyJWKClient` → JWKS con refresh controlado; `ThreadingHTTPServer` → ASGI/Uvicorn
detrás de reverse proxy. La validación JWT y la autorización permanecen separadas.
