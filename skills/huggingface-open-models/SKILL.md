---
name: huggingface-open-models
description: Discover, evaluate and integrate Hugging Face models, datasets, Spaces, Inference Providers, documentation and MCP tools for Isabella with license, cost, provenance and safety checks.
---

# Hugging Face Open Models Skill

## Purpose
Help Isabella discover and use open-weight models and public Hub resources without falsely describing a resource as free, safe, commercially usable, or production-ready.

## Workflow
1. Search the public Hub catalog through `GET /api/huggingface/discover?type=models&q=<query>`.
2. Explore `type=datasets` or `type=spaces` for public datasets and hosted applications.
3. Open the canonical Hugging Face model/dataset/Space card and inspect:
   - license and any non-commercial/research-only clauses;
   - model card, intended use, limitations and evaluation evidence;
   - supported inference provider, modality and context length;
   - safety, privacy, retention, attribution and data provenance;
   - provider pricing, free quota, rate limits and regional availability.
4. For a chat model, select it in the Open Models interface. Inference uses the server-side `HF_TOKEN` and `POST https://router.huggingface.co/v1/chat/completions`.
5. Keep the default provider as Vercel AI Gateway unless the operator explicitly selects Hugging Face. Never silently change providers or incur paid usage.
6. Report the exact provider/model ID, configuration state, errors, and whether the request actually succeeded.
7. Treat outputs as generated suggestions, not verified evidence. Do not invent citations or infer truth from downloads/likes.

## Cost and availability rules
- Open weights do not imply free hosted inference.
- Hugging Face Inference Providers can have a small monthly free credit allowance, provider-specific quotas and paid usage after credits are exhausted. Check current official pricing.
- Never claim every model is available through serverless inference. Some require local hardware, a paid endpoint, approval, gated access, or a provider-specific token.
- Do not fall back to paid inference unless the operator has explicitly enabled it.
- Do not upload private or sensitive user data to a public Space or external provider without explicit authorization.

## API contracts
- `GET /api/huggingface/discover?type=models|datasets|spaces&q=&limit=`: public catalog discovery, capped to 30 resources per call.
- `POST /api/chat` with `provider: "huggingface"` and a `modelId`: routes to Hugging Face Inference Providers.
- `HF_TOKEN` and `HF_MODEL` are server-side secrets/configuration; never expose them as `NEXT_PUBLIC_*`.

## Official references
- https://huggingface.co/docs/inference-providers/index
- https://huggingface.co/docs/inference-providers/pricing
- https://huggingface.co/docs/hub/en/api
- https://huggingface.co/docs/hub/agents-overview
- https://huggingface.co/settings/mcp
