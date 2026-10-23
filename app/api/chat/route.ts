import { generateText } from 'ai'

const SYSTEM_PROMPT = `Eres Isabella, una asistente de inteligencia soberana latinoamericana. Responde en español claro, cálido y preciso. Ayuda a investigar, redactar, analizar y planificar. Estructura tus respuestas con contexto, supuestos, evidencia necesaria y próximos pasos cuando sea útil. No inventes fuentes ni ejecutes acciones sensibles sin aprobación humana.`

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const messages = Array.isArray(body?.messages) ? body.messages : []
    const safeMessages = messages
      .filter((message: unknown): message is { role: 'user' | 'assistant'; content: string } => {
        if (!message || typeof message !== 'object') return false
        const candidate = message as Record<string, unknown>
        return (candidate.role === 'user' || candidate.role === 'assistant') && typeof candidate.content === 'string'
      })
      .slice(-20)
      .map((message: { role: 'user' | 'assistant'; content: string }) => ({
        role: message.role,
        content: message.content.slice(0, 6000),
      }))

    if (!safeMessages.length || safeMessages[safeMessages.length - 1].role !== 'user') {
      return Response.json({ error: 'Escribe un mensaje para Isabella.' }, { status: 400 })
    }

    const result = await generateText({
      model: 'openai/gpt-6.1-sol',
      system: SYSTEM_PROMPT,
      messages: safeMessages,
      temperature: 0.7,
    })

    return Response.json({ text: result.text })
  } catch {
    return Response.json({ error: 'Isabella no pudo responder. Inténtalo de nuevo.' }, { status: 500 })
  }
}
