# Protocolo ABX

Entrada: propuesta validada, riesgo estimado, resultado de política y requisito de aprobación humana. CROWN escala si la aprobación es requerida o el riesgo es HIGH/CRITICAL. MEDIUM produce REPAIR/DEGRADE; LOW produce ALLOW/REJECT. ALLOW nunca activa ejecución externa en este MVP. Ver [simulación y arbitraje](SIMULATION-ARBITRATION.md).


## Persistencia y consulta de decisiones

El gateway persiste la decisión de inferencia en `abx_decisions`, incluyendo `actor_user_id` derivado del token, riesgo, decisión, plan serializado y requisito de aprobación humana. El registro ABX y su evento BookPI-X se insertan en la misma transacción PostgreSQL. `GET /api/v1/ops/abx/decisions?limit=20` devuelve únicamente las decisiones del usuario autenticado dentro de su tenant, con límite de 1 a 100 registros. La clasificación por palabras sigue siendo una heurística preliminar; no sustituye una política formal versionada ni evaluación de contexto.
