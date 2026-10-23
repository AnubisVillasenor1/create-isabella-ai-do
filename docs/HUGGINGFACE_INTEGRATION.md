# Hugging Face integration in Isabella

## Scope
This integration connects the application to the public Hugging Face Hub catalog and optionally to Hugging Face Inference Providers. It does not download all Hub model weights into the application, train models, or guarantee a free hosted inference endpoint.

## Available capabilities
- Live public catalog discovery for models, datasets and Spaces.
- Model selection from the interface and chat routing through Hugging Face Inference Providers.
- Server-side token handling and normalized error responses.
- An agent skill contract under `skills/huggingface-open-models/SKILL.md`.
- Documented setup for Hugging Face MCP, CLI, skills and official API docs.

## Configure inference
Set `HF_TOKEN` in local server secrets or Vercel Project Settings. Optionally set `HF_MODEL`. Do not commit secrets and never use a `NEXT_PUBLIC_` prefix for credentials.

The Open Models panel can discover models without a token. Actual hosted inference requires a valid token and a model/provider available to the account. A selected model ID may need a provider suffix supported by the current Hugging Face router catalog.

## Cost policy
Hugging Face documents a monthly credit allowance for Inference Providers; the free allowance is small and may change. Requests may fail due to quota, provider access, gated models, rate limits or insufficient credits. Open weights are not the same as free hosted compute. No paid endpoint is provisioned by this integration.

Official pricing: https://huggingface.co/docs/inference-providers/pricing

## MCP, skills and tools
To authorize Hub tools for a compatible development agent, sign in and configure the MCP endpoint using the generated instructions at https://huggingface.co/settings/mcp. The documented server lets compatible clients search models, datasets, Spaces, papers and documentation, and use community tools exposed through MCP-compatible Gradio Spaces. Authorization is user-specific and must be performed by the developer/operator; this repository does not silently grant account permissions.

Agent overview: https://huggingface.co/docs/hub/agents-overview
MCP docs: https://huggingface.co/docs/hub/en/agents-mcp
Hub API: https://huggingface.co/docs/hub/en/api

## Data and licensing
The catalog returns public metadata only. Before using any model or dataset, inspect the repository card, license, intended use, gated status, privacy, provenance, evaluation quality and any attribution obligations. Do not interpret downloads, likes or tags as scientific validation.

## Production checklist
- Configure `HF_TOKEN` only in server-side secret storage.
- Verify provider/model availability using a real low-risk test request.
- Confirm current account credits, rate limits, license and retention terms.
- Add authentication, per-user quotas, abuse controls and observability before public multi-user use.
- Do not send confidential user documents to external inference providers without explicit consent.
- Run typecheck, lint, build and integration tests before merge.
