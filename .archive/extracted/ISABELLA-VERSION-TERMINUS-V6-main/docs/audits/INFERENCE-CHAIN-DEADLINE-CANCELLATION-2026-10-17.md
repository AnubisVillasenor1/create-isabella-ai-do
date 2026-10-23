# Focused inference-chain audit — 2026-10-17

## Scope

This change addresses the public chat route's sequential model-provider chain and its request lifecycle. It is a targeted correction, not a claim that the entire inference stack or production deployment has passed validation.

## Findings corrected

### INF-01 — The configured chain deadline did not cover the entire routing path

The `DeadlineBudget` was created after the local Genesis Turbo classification. Time spent in that classification was therefore outside the advertised whole-chain budget.

**Correction:** start the budget before local classification and reuse it through provider routing. Classifier time consumes the same budget, so an expensive classification leaves less time for provider attempts. The classifier API itself does not currently accept an abort signal, so the budget cannot interrupt a classifier that hangs; that remains a separate limitation.

### INF-02 — Two fallback paths could escape the shared budget

Before this fix, the Perplexity Router call used its default 30-second timeout without the chain's remaining budget. A later keyless-provider retry also omitted the `DeadlineBudget` argument.

**Correction:** the Perplexity request now receives a remaining-budget-derived timeout and abort signal, and the second keyless attempt receives the shared budget. All provider attempts are expected to respect the shared time and cancellation contract.

### INF-03 — Client-side Stop/disconnect did not cancel upstream model work

The browser can abort its fetch, but the server did not connect premature response closure to provider cancellation. This could waste provider capacity and continue downstream attempts after the user had stopped waiting.

**Correction:** attach an abort controller to the response lifecycle; abort it only when the response closes before `writableEnded`. `DeadlineBudget` combines that caller signal with the per-attempt timeout. A cancelled request stops before additional generation or response work. The Perplexity adapter now accepts the same signal.

### INF-04 — Local fallback responses could be cached as if they were successful model responses

The cognition response cache accepted any successful admitted response, including `responseEngine: "sovereign-fallback"`. A transient provider outage could therefore keep serving a deterministic fallback after a model provider recovered, until the cache entry expired.

**Correction:** exclude `sovereign-fallback` responses from the success cache. The fallback remains available to answer promptly but no longer masks recovery through cached output.

### INF-05 — Response-cache hits happened before input guards and governance evaluation

The route checked its full-response cache before enforcing the input-size limit, rejecting unscoped `memoryQuery` requests, evaluating the current governance policy, and appending a BookPI cognitive-evaluation event. A matching cached request could therefore bypass those checks and skip per-request evidence. The old key also did not encode the method identifier.

**Correction:** cache reads now happen after request validation, a fresh policy evaluation, and a BookPI event. The key uses structural JSON encoding and includes the governance method. Cache hits refresh the current decision, principal, and provider-configuration disclosure, mark the hit explicitly, and use `Cache-Control: no-store`. The cache is process-local, bounded, TTL-expiring, and LRU-evicting. Deterministic fallback responses are excluded from writes.

### INF-06 — Potential billable provider was routed from Auto/Open Science without an explicit paid-model selection

The server previously called Perplexity Router with the hard-coded model `perplexity/kimi-k3` from the `auto` and `open-science` fallback chain. A configured API key was enough to attempt that model; it did not require `ALLOW_PAID_PROVIDER_FALLBACK=true` or an operator-selected model. This contradicted the route's own policy that paid routes require opt-in.

**Correction:** generation is now fail-closed unless all three values are present: `PERPLEXITY_API_KEY`, a nonblank `PERPLEXITY_ROUTER_MODEL`, and the exact operator opt-in `ALLOW_PAID_PROVIDER_FALLBACK=true`. The helper refuses generation if the requested model differs from the configured model. The default Perplexity model has been removed, readiness now reports the selected model only when the gate is satisfied, and the provider is invoked only in the paid fallback block. Added unit tests cover key-only, missing model, opt-in values, and successful explicit selection.

The official Kimi API pricing guidance states that API use is billed by token and model, including Kimi K3 pay-as-you-go; selection must therefore not be silently interpreted as free. See [Kimi API pricing](https://www.kimi.ai/help/kimi-api/api-pricing).

## Regression coverage added

- Added a unit test asserting that caller cancellation aborts a provider signal and marks the deadline as expired, preventing subsequent attempts.
- Added bounded-cache tests for TTL expiry, capacity, LRU, replacement, clear, and cache-key isolation across governance methods.
- Added provider policy tests proving Perplexity generation stays disabled unless the operator explicitly opts into paid fallback and chooses the model.
- Added source-level route contract tests verifying input-size and memory-query guards, current governance evaluation, and BookPI event append all precede cache reuse. These are structural regression checks, not substitutes for an HTTP integration test.
- Existing deadline tests still cover remaining-budget caps, minimum attempt windows, worst-case sequential timeout bounds, invalid values, and environment parsing.

## Limitations and verification status

- This change was committed to a feature branch; it has not been merged into `main`.
- Tests and TypeScript checks have **not** been executed in a local checkout in this workflow. Passing status must come from GitHub Actions or a reproducible local run; no green result is claimed here.
- External provider reachability, credentials, quotas, actual generative output, Vercel deployment, and browser-level Stop behavior remain unverified.
- The shared deadline bounds provider attempts, not every possible operation in the full HTTP request. Local Genesis Turbo classification consumes the budget but cannot itself be interrupted through its current API. The Gemini SDK path is limited by its request timeout but does not yet receive the caller's abort signal. Other provider adapters must accept and honor the supplied timeout/cancellation contract.
- Cancellation is best-effort at the network/SDK layer; an upstream service may already have accepted a request before the abort reaches it.

## Invariants preserved

- External keyless inference remains opt-in; this change does not enable it.
- Paid-provider fallback remains controlled by explicit configuration; Perplexity additionally requires an explicit model ID.
- The deterministic fallback is still labeled `sovereign-fallback`; it is not represented as LLM output.
- No authority or execution permissions are granted by the deadline or cancellation mechanism.
