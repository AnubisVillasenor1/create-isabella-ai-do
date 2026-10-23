# CROWN → GENESIS convergence

## Canonical ownership

GenesisAI is the single source of truth for Isabella's governed cognitive runtime.

The former `isabella-s-crown` capabilities are classified as follows:

| Capability | Canonical home |
|---|---|
| CROWN decisioning | `src/crown` |
| AEGIS / security | `src/security` |
| Identity / authority | `src/identity` + `src/authority` |
| IKES / memory | `src/memory` |
| Veritas | `src/veritas` |
| BookPI / provenance | `src/bookpi`, `src/memory/provenance` |
| Inference | `src/inference` |
| Tools / skills | `src/tools`, `src/skills` |
| Cognitive roles | `src/crown/experience.ts` and `src/cognition` |
| Terminal / presentation | Genesis web application |
| Telemetry presentation | Genesis API + web application |

## Security boundary

The browser is an untrusted presentation client.

It may submit:

- user input;
- session metadata;
- requested operation;
- non-authoritative UI preferences.

It must not submit or override:

- system prompts;
- identity roles;
- authority grants;
- capability registrations;
- policy versions;
- audit evidence;
- approval state.

Genesis derives those values server-side and fails closed when governance verification fails.

## Canonical request contract

`POST /api/v1/cognitive/request`

The endpoint performs:

1. Principal construction and authority validation.
2. CROWN intent/risk evaluation.
3. AEGIS inspection.
4. Capability-gate verification.
5. Adaptive planning and optional IKES retrieval.
6. Canonical cognitive routing.
7. Server-side system-prompt construction.
8. Optional model invocation.
9. Structured decision/snapshot response.

The endpoint is intentionally compatible with a future Crown UI without embedding a second runtime.

## Product-layer convergence

Crown's useful concepts — terminal interaction, module visualization, governance status, evidence state, human approval state and telemetry — become presentation concerns over Genesis contracts.

They must not become a second authority plane.

## Migration rule

No new Genesis core feature should be implemented by copying code from `isabella-s-crown`.

When a Crown capability is useful:

1. classify it as core, governance, infrastructure, or presentation;
2. implement the canonical behavior in Genesis;
3. expose it through a stable API/type contract;
4. make the UI consume that contract;
5. remove the duplicate implementation from the product fork.

## Telemetry rule

Runtime measurements must be produced by Genesis instrumentation. UI-derived estimates must be explicitly labelled as derived and must never be presented as cryptographic, model-provider or runtime facts.

## Evolution target

```
Crown UI / Terminal
        |
        v
Genesis Cognitive API
        |
        v
CROWN → AEGIS → Identity/Authority → IKES → Plan
        |
        +--> Tools / Skills
        +--> Inference
        +--> Veritas
        +--> BookPI / Provenance
        +--> Observability / Evolution
```

This turns Crown from a competing implementation into a first-class Genesis client.
