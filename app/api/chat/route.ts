import { generateText } from 'ai'

const SYSTEM_PROMPT = `Eres Isabella Genesis V6, una infraestructura cognitiva soberana para ciencia abierta. Responde en español claro, cálido y preciso. Ayuda a investigar, redactar, analizar y planificar. Distingue hechos, inferencias y decisiones. Nunca inventes fuentes: si no tienes evidencia, dilo explícitamente y propone cómo verificarla. Incluye contexto, supuestos, límites, evidencia necesaria y próximos pasos cuando sea útil. No ejecutes acciones sensibles ni atribuyas autoridad científica sin aprobación humana. Respeta FAIR, procedencia W3C PROV, trazabilidad, soberanía institucional y supervisión humana.`

const MAX_BODY_BYTES = 128_000
const MAX_MESSAGES = 20
const MAX_MESSAGE_CHARS = 6_000

export async function POST(request: Request) {
  try {
    const contentLength = Number(request.headers.get('content-length') ?? 0)
    if (contentLength > MAX_BODY_BYTES) {
      return Response.json({ error: 'La solicitud supera el límite permitido.' }, { status: 413 })
    }

    const rawBody = await request.text()
    if (new TextEncoder().encode(rawBody).byteLength > MAX_BODY_BYTES) {
      return Response.json({ error: 'La solicitud supera el límite permitido.' }, { status: 413 })
    }

    let body: unknown
    try {
      body = JSON.parse(rawBody)
    } catch {
      return Response.json({ error: 'El cuerpo de la solicitud no contiene JSON válido.' }, { status: 400 })
    }

    const payload = typeof body === 'object' && body !== null && !Array.isArray(body) ? body as Record<string, unknown> : {}
    const messages = typeof body === 'object' && body !== null && Array.isArray((body as { messages?: unknown }).messages)
      ? (body as { messages: unknown[] }).messages
      : []
    const safeMessages = messages
      .filter((message: unknown): message is { role: 'user' | 'assistant'; content: string } => {
        if (!message || typeof message !== 'object') return false
        const candidate = message as Record<string, unknown>
        return (candidate.role === 'user' || candidate.role === 'assistant') && typeof candidate.content === 'string'
      })
      .slice(-MAX_MESSAGES)
      .map((message: { role: 'user' | 'assistant'; content: string }) => ({
        role: message.role,
        content: message.content.trim().slice(0, MAX_MESSAGE_CHARS),
      }))
      .filter((message: { role: 'user' | 'assistant'; content: string }) => message.content.length > 0)

    if (!safeMessages.length || safeMessages[safeMessages.length - 1].role !== 'user') {
      return Response.json({ error: 'Escribe un mensaje para Isabella.' }, { status: 400 })
    }

    const provider = typeof payload.provider === 'string'
      ? payload.provider
      : 'gateway'
    const requestedModel = typeof payload.modelId === 'string'
      ? payload.modelId.trim().slice(0, 180)
      : ''

    if (provider === 'ollama') {
      const configuredBase = process.env.OLLAMA_BASE_URL?.trim()
      const baseUrl = configuredBase || (process.env.NODE_ENV !== 'production' ? 'http://127.0.0.1:11434' : '')
      if (!baseUrl) {
        return Response.json({
          error: 'Configura OLLAMA_BASE_URL en el servidor para usar Ollama. En despliegues serverless, localhost apunta al servidor y no a tu equipo.',
          code: 'OLLAMA_BASE_URL_REQUIRED',
        }, { status: 503 })
      }

      let endpoint: URL
      try {
        endpoint = new URL(baseUrl)
        if (endpoint.protocol !== 'http:' && endpoint.protocol !== 'https:') throw new Error('invalid_protocol')
        endpoint.pathname = '/api/chat'
        endpoint.search = ''
      } catch {
        return Response.json({ error: 'OLLAMA_BASE_URL debe ser una URL HTTP/HTTPS válida.' }, { status: 500 })
      }

      const model = requestedModel || process.env.OLLAMA_MODEL || 'qwen3:8b'
      if (!/^[a-zA-Z0-9._/-]+(?::[a-zA-Z0-9._-]+)?$/.test(model) || model.includes('..')) {
        return Response.json({ error: 'Identificador de modelo Ollama no válido.' }, { status: 400 })
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          model,
          messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...safeMessages],
          stream: false,
          options: { temperature: 0.7, num_predict: 1800 },
        }),
        cache: 'no-store',
        signal: AbortSignal.timeout(90_000),
      })
      if (!response.ok) {
        return Response.json({
          error: response.status === 404
            ? 'Ollama no encontró el modelo. Descárgalo con ollama pull o elige un modelo instalado.'
            : 'Ollama no pudo completar la solicitud. Comprueba que el servicio esté activo y accesible desde el servidor.',
          code: 'OLLAMA_INFERENCE_ERROR',
          retryable: response.status >= 500,
        }, { status: response.status === 404 ? 400 : 502 })
      }
      const data = await response.json() as { message?: { content?: string }; model?: string; prompt_eval_count?: number; eval_count?: number }
      const text = data.message?.content || ''
      if (!text.trim()) return Response.json({ error: 'Ollama devolvió una respuesta vacía.', code: 'EMPTY_MODEL_RESPONSE' }, { status: 502 })
      return Response.json({
        text,
        provider: 'ollama',
        model: data.model || model,
        usage: { prompt_tokens: data.prompt_eval_count ?? null, completion_tokens: data.eval_count ?? null },
      }, { headers: { 'Cache-Control': 'no-store' } })
    }

    if (provider === 'huggingface') {
      const token = process.env.HF_TOKEN
      if (!token) {
        return Response.json({
          error: 'Hugging Face Inference no está configurado. Añade HF_TOKEN como secreto de servidor; nunca lo expongas al navegador.',
          code: 'HF_TOKEN_REQUIRED',
        }, { status: 503 })
      }
      const model = requestedModel || process.env.HF_MODEL || 'openai/gpt-oss-120b:fireworks-ai'
      if (!/^[a-zA-Z0-9._/-]+(?::[a-zA-Z0-9._-]+)?$/.test(model) || model.includes('..')) {
        return Response.json({ error: 'Identificador de modelo no válido.' }, { status: 400 })
      }

      const response = await fetch('https://router.huggingface.co/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            ...safeMessages,
          ],
          temperature: 0.7,
          max_tokens: 1800,
          stream: false,
        }),
        cache: 'no-store',
        signal: AbortSignal.timeout(45_000),
      })

      if (!response.ok) {
        const status = response.status === 401 || response.status === 403 ? 503
          : response.status === 429 ? 429
          : response.status === 402 ? 402 : 502
        return Response.json({
          error: response.status === 401 || response.status === 403
            ? 'Hugging Face rechazó la credencial o el acceso al modelo. Verifica HF_TOKEN, el proveedor y los permisos.'
            : response.status === 429
              ? 'Hugging Face alcanzó un límite de solicitudes. Intenta más tarde.'
              : response.status === 402
                ? 'El saldo o los créditos de inferencia de Hugging Face no son suficientes.'
                : 'El proveedor de Hugging Face no pudo completar la solicitud.',
          code: 'HF_INFERENCE_ERROR',
          retryable: response.status === 429 || response.status >= 500,
        }, { status, headers: response.status === 429 ? { 'Retry-After': '5' } : undefined })
      }

      const data = await response.json() as {
        choices?: Array<{ message?: { content?: string | Array<{ type?: string; text?: string }> } }>;
        model?: string;
        usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
      }
      const content = data.choices?.[0]?.message?.content
      const text = typeof content === 'string'
        ? content
        : Array.isArray(content) ? content.map((part) => part.text || '').join('') : ''
      if (!text.trim()) return Response.json({ error: 'El proveedor devolvió una respuesta vacía.', code: 'EMPTY_MODEL_RESPONSE' }, { status: 502 })
      return Response.json({
        text,
        provider: 'huggingface',
        model: data.model || model,
        usage: data.usage ?? null,
      }, { headers: { 'Cache-Control': 'no-store' } })
    }

    if (provider !== 'gateway') {
      return Response.json({ error: 'Proveedor no admitido. Usa gateway, huggingface u ollama.' }, { status: 400 })
    }

    const result = await generateText({
      model: process.env.AI_GATEWAY_MODEL?.trim() || 'openai/gpt-6.1-sol-fast',
      system: SYSTEM_PROMPT,
      messages: safeMessages,
      temperature: 0.7,
    })

    return Response.json({
      text: result.text,
      provider: 'gateway',
      model: result.response.modelId || process.env.AI_GATEWAY_MODEL || 'openai/gpt-6.1-sol-fast',
      usage: result.usage,
    }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    const message = error instanceof Error ? error.message : ''
    if (error instanceof Error && error.name === 'TimeoutError') {
      return Response.json({ error: 'El proveedor tardó demasiado en responder. Puedes cambiar de modelo o reintentar.', code: 'MODEL_TIMEOUT' }, { status: 504 })
    }
    if (message.toLowerCase().includes('credit card') || message.toLowerCase().includes('free credits')) {
      return Response.json({ error: 'El Gateway de IA está conectado, pero necesita una tarjeta válida en Vercel para desbloquear los créditos gratuitos.' }, { status: 402 })
    }
    return Response.json({ error: 'Isabella no pudo responder. Revisa la configuración del Gateway e inténtalo de nuevo.' }, { status: 500 })
  }
}
