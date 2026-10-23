# Registro de divergencias código ↔ especificación

**Estado:** `draft` · **Autoría:** ingeniería de IA · **Requiere arbitraje humano** (AGENTS.md §2 y §6).

> En conflicto entre código y spec, gana la spec; el conflicto **se archiva aquí como
> divergencia pendiente de arbitraje humano** (AGENTS.md §6). Este registro **no**
> renombra ni reescribe código: documenta y espera decisión humana.

## DIV-0001 — Gramática de la "identidad de método" (TINA / YUN)

- **Estado:** abierto · **Severidad:** media · **Detectado:** 2026-10-15
- **Especificación:**
  - AGENTS.md §5: `[TINA].[YUN].[MODULO].[FUNCION].[VERSION].[RISK_TIER].[GOVERNANCE_TIER]`.
  - `docs/spec/ISABELLA-CANON-v40-source.txt`: TINA = *Trusted Intelligence, Native & Adaptive*.
- **Código (parser estricto, `src/authority/method-id.ts:107` `parseMethodId`):**
  - 1er segmento ∈ `TINA_TYPES = ["T","I","N","A"]`.
  - 2º segmento ∈ `YUN_FEDERATIONS = [IDENTITY, PATRIMONY, TOURISM, ECONOMY, TWINS, COLLECTIVE_INTELLIGENCE, RESILIENCE]`.
  - Último ∈ `GOVERNANCE_TIERS = [CONSTITUTIONAL, TERRITORIAL, INSTITUTIONAL, OPERATIONAL, AUTONOMOUS]`.

### Literales de method-id que `parseMethodId` rechazaría

| # | Literal | Ubicación | Motivo del rechazo |
|---|---|---|---|
| 1 | `Q.QUANTUM.E20_EXECUTION.execute_pennylane.v1.0.0.MEDIUM.INSTITUTIONAL` | `src/server.ts:537`, `src/server.ts:554`, `src/server.ts:1587` | `Q` ∉ TINA_TYPES; `QUANTUM` ∉ YUN_FEDERATIONS |
| 2 | `TINA.YUN.FABRIC.append_event.v1.0.0.MEDIUM.HUMAN_IN_THE_LOOP` | `src/server.ts:823` | `TINA` ∉ TINA_TYPES; `YUN` ∉ YUN_FEDERATIONS; `HUMAN_IN_THE_LOOP` ∉ GOVERNANCE_TIERS |
| 3 | `TINA.YUN.<MODULO>.*` | `src/gameover/types.ts:19-23`, `src/hypercore/types.ts:26-31`, `src/hypercore/index.ts:39`, `src/osiris/types.ts:18-20` | 1er y 2º segmento literales |
| 4 | `TINA.YUN.TEST.append.v0.1.0.LOW.AUTONOMOUS` | `test/bookpi/durable-ledger.test.ts:18`, `test/bookpi/retention.test.ts:12` | idem; usado como metadata del ledger BookPI |
| 5 | `T.TOOL.<toolId>.execute.v1.0.0.LOW.TERRITORIAL` | `src/server.ts:878` | `TOOL` ∉ YUN_FEDERATIONS |

### Naturaleza de la divergencia

Los literales de (1), (2), (3), (4) y (5) se usan como **etiquetas de namespace /
metadata** (manifiestos de skill, eventos BookPI); **no** se pasan por `parseMethodId`.
El parser estricto solo se invoca en `src/crown/index.ts:47` y `src/pipeline/conductor.ts:14`.
Por tanto, hoy conviven dos convenciones: un *namespace* textual (`TINA.YUN.*`, `Q.*`)
y una gramática estricta de 7 segmentos.

### Opciones para arbitraje humano (ninguna aplicada)

- **A.** Ampliar la spec/parser para admitir los tokens `TINA`/`YUN` literales y un tier
  `HUMAN_IN_THE_LOOP` explícito.
- **B.** Migrar todos los literales no conformes a la gramática estricta (implica cambiar
  firmas y tests existentes de BookPI).
- **C.** Formalizar el *namespace* textual como convención separada y declararlo en la spec.

### Acción tomada por ahora

- Documentar esta divergencia en este registro (cumple §6: **archivar, no adivinar**).
- Retirar el único uso muerto relacionado: el `import { parseMethodId }` en
  `src/server.ts` (no se invocaba; su retiro no cambia comportamiento).
- **Sin renombres** de literales hasta que un humano arbitre entre A / B / C.

## DIV-0002 — "Cognitive Civilization Runtime (CCR-1)": 12 vs 13 capas Ω

- **Estado:** abierto · **Severidad:** baja · **Detectado:** 2026-10-15
- **Especificación:** `ISABELLA Ω · COGNITIVE CIVILIZATION RUNTIME (CCR-1)` v2.0.0,
  §"Capas": titula **"12 capas Ω"** pero su tabla enumera **Ω-0 … Ω-12**
  (Sovereign Kernel, Cognitive Memory Mesh, Reality Digital Twin, Planetary
  Knowledge Graph, Meta-Reasoning Engine, Autonomous Science Engine, Civilization
  Policy Compiler, Trust Fabric, Multi-Agent Federated Intelligence, Economic
  Consciousness Engine, Neural Governance Layer, Self-Evolution Engine,
  Antifragility Core) — **13 filas**.
- **Código (`src/civilization/layers.ts`):** se registran las **13** capas
  (`CIVILIZATION_LAYER_COUNT = 13`) y se declara la discrepancia con la constante
  `CCR_DECLARED_LAYERS = 12`, en lugar de silenciarla o renumerar la spec.
- **Naturaleza de la divergencia:** desajuste interno de la propia especificación
  (título vs. tabla), no un conflicto código↔spec. Puede resolverse renumerando
  Ω-1..Ω-12 (sin Ω-0) o corrigiendo el título a "13 capas".
- **Opción tomada por ahora (cumple §6):** registrar ambas cifras de forma explícita
  y honesta; **sin** modificar la estructura. Pendiente de arbitraje humano para
  fijar la numeración canónica.

## DIV-0003 — "IHEC v3.1 (Edición Perplexity)": lenguaje, criptografía y conteo de capas

- **Estado:** abierto · **Severidad:** media · **Detectado:** 2026-10-15
- **Especificación:** `Isabella Ω · Cognitive Civilization Runtime v3.1`
  (`isabella-core-ccr-ihec-perplexity`, §7) aporta un módulo de referencia en
  **Python** (`isabella_omega_ihec.py`), 12 subsistemas IHEC, un supuesto "14 capas Ω"
  y 10 "Regalos de Perplexity". El sello de snapshots se describe como
  **BLAKE3 + ZSTD + XChaCha20**.
- **Código (`src/ihec/`):** portado a **TypeScript** estricto y determinista; el sello
  usa la criptografía **REAL** del repo (**SHA3-512** vía `bookpi/crypto`). Se
  registran las capas **Ω-13** (IHEC) y **Ω-14** (Evolutionary Crisis Memory) como
  extensión de las 13 ya registradas por CCR-1. Las divergencias se declaran en
  `src/ihec/contract.ts` (`IHEC_DIVERGENCES`, `IHEC_SPEC_DECLARED_LAYERS = 14`).
- **Naturaleza de la divergencia:**
  1. **Lenguaje:** la spec es Python; el repo es TypeScript sin `any`. Se porta el
     comportamiento (y se amplía) sin romper la invariante de tipos.
  2. **Criptografía:** BLAKE3 / ZSTD / XChaCha20 **no existen** en el repo; no se
     simulan. Se usa SHA3-512 real y se declara la parte no soportada.
  3. **Conteo de capas:** la spec titula "14 capas Ω" pero su diagrama enumera 10
     (Ω-1..Ω-10) + Ω-13 + Ω-14; CCR-1 ya usa Ω-0..Ω-12. Choque de numeraciones.
  4. **Ventaja cuántica:** el "Q-ECTS" no se reclama aquí; el sustrato es clásico.
- **Opción tomada por ahora (cumple §6):** implementar los 12 subsistemas y los 10
  regalos de forma honesta en proceso, declarar las cuatro divergencias arriba y en
  el código, y **no** renombrar las capas existentes. Pendiente de arbitraje humano
  para fijar numeración canónica, lenguaje y criptografía objetivo. La quinta
  entrega (BLAKE3/ZSTD/XChaCha20) queda **SPECIFIED**, nunca simulada.

