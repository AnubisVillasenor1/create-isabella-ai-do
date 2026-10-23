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

    const primaryModel = process.env.AI_GATEWAY_MODEL?.trim() || 'openai/gpt-6.1-sol-fast'
    const fallbackModels = (process.env.AI_GATEWAY_FALLBACK_MODELS ?? '')
      .split(',')
      .map((model) => model.trim())
      .filter((model) => model.length > 0 && model !== primaryModel)
      .slice(0, 3)

    const result = await generateText({
      model: primaryModel,
      system: SYSTEM_PROMPT,
      messages: safeMessages,
      temperature: 0.7,
      ...(fallbackModels.length > 0 ? { providerOptions: { gateway: { models: fallbackModels } } } : {}),
    })

    return Response.json({
      text: result.text,
      model: result.response.modelId || primaryModel,
      usage: result.usage,
    }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    const message = error instanceof Error ? error.message : ''
    const normalized = message.toLowerCase()
    if (normalized.includes('credit card') || normalized.includes('free credits') || normalized.includes('customer_verification_required')) {
      return Response.json({ error: 'El Gateway de IA está conectado, pero necesita una tarjeta válida en Vercel para desbloquear los créditos gratuitos.' }, { status: 402 })
    }
    if (normalized.includes('insufficient_funds') || normalized.includes('quota_for_entity_exceeded')) {
      return Response.json({ error: 'El presupuesto o saldo de AI Gateway no es suficiente para esta solicitud.' }, { status: 402 })
    }
    if (normalized.includes('429') || normalized.includes('rate limit')) {
      return Response.json({ error: 'AI Gateway alcanzó un límite de solicitudes. Espera unos segundos y vuelve a intentarlo.' }, { status: 429, headers: { 'Retry-After': '5' } })
    }
    if (normalized.includes('401') || normalized.includes('unauthorized') || normalized.includes('authentication')) {
      return Response.json({ error: 'La autenticación de AI Gateway no está configurada correctamente.' }, { status: 503 })
    }
    return Response.json({ error: 'Isabella no pudo responder. Revisa la configuración del Gateway e inténtalo de nuevo.' }, { status: 502 })
  }
}
