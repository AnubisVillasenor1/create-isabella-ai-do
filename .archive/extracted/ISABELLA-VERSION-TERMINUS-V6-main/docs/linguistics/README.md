# Latino Genesis Lib Ω

Implementación TypeScript operativa de la capa lingüística latinoamericana.

## Principios

- Solo ingesta declarada por el operador; no descarga Internet por defecto.
- Entradas deduplicadas por SHA-256 y trazables mediante `source`.
- Contenido marcado como adulto se conserva como metadato, pero queda fuera de búsqueda y análisis público.
- El motor describe contexto lingüístico; no afirma autoridad cultural ni reemplaza revisión humana.

## Endpoints

- `GET /api/v1/linguistics/stats`
- `GET /api/v1/linguistics/search?term=chamba`
- `POST /api/v1/linguistics/analyze` con `{ "text": "Aguas con la chamba" }`
- `POST /api/v1/linguistics/ingest` con `{ "entries": [{ "term": "...", "meaning": "..." }] }`

La ingesta API está limitada a 1,000 entradas por solicitud. Los datos semilla viven en `data/latam.json` y las fuentes autorizadas en `config/sources.yaml`.

Estado: `draft | auto_generated`; requiere aprobación humana antes de declarar `verified` o `wired`.
