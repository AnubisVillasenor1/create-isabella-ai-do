# Simulación acotada y arbitraje ABX/CROWN

## Simulador implementado
Entrada: escenarios explícitos `(name, probability, impact)`. Se validan números finitos, probabilidades finitas dentro de [0,1], nombres de escenario acotados, impactos no negativos y suma de probabilidades igual a 1 con tolerancia 1e-6. Los escenarios con probabilidad cero no inflan el peor caso. Se aplica muestreo ponderado determinista con máximo de 100.000 iteraciones y presupuesto del llamador. Salida: impacto esperado analítico respecto a los pesos declarados, peor impacto, p95 de la muestra y señal de presupuesto agotado.

El generador de números es determinista y no criptográfico. Los escenarios son hipótesis del llamador, no observaciones del mundo. La simulación no es causal, no está calibrada ni constituye una predicción factual. Para producción faltan presupuesto global por tenant, cancelación, timeout, telemetría, calibración empírica y pruebas estadísticas.

## Arbitraje
- LOW: ALLOW si pasa validación; REJECT si no.
- MEDIUM: REPAIR si pasa; DEGRADE si no.
- HIGH y CRITICAL: ESCALATE.
- Aprobación humana requerida: ESCALATE en cualquier nivel.
- Ausencia de evidencia o error de política: fail-closed.

ALLOW autoriza una propuesta dentro de esta regla, no ejecuta una acción. El gateway marca siempre `execution_performed=false`. La clasificación de riesgo basada en palabras es sólo una heurística preliminar y requiere revisión; no se le debe dar autoridad de seguridad autónoma.

## Reversibilidad futura
Cada adaptador de ejecución debe declarar precondiciones, idempotency key, dry-run, compensación/rollback, límite temporal, evidencias posteriores y aprobación humana explícita para operaciones críticas, financieras, destructivas o de producción.
