# RFC-0006 — Proveedores de inferencia

## Regla
Sin proveedor configurado, las respuestas provienen del motor determinista local; debe declararse como fallback, no como inferencia de modelo.

## Proveedores soportados
OpenRouter, Gemini, Groq, Hugging Face, AI Gateway, Vercel OIDC, Ollama, local compatible, DeepSeek, keyless (LLM7/Pollinations), OpenAI-compatible, Cerebras, DeepInfra, Fireworks, Together, Perplexity, Gratis.

## Requisitos
- Configurar al menos uno o habilitar keyless explícitamente.
- Probar E2E generativo con timeout, error y fallback.
- No presentar respuesta determinista como modelo externo.
- TTS: Groq PlayAI voices femeninas canónicas; servicio neuronal del operador; fallback navegador.
