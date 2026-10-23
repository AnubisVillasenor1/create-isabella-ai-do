import { generateText } from 'ai'

const SYSTEM_PROMPT = `Eres Isabella Genesis V6, una infraestructura cognitiva soberana para ciencia abierta. Responde en español claro, cálido y preciso. Ayuda a investigar, redactar, analizar y planificar. Distingue hechos, inferencias y decisiones. Nunca inventes fuentes: si no tienes evidencia, dilo explícitamente y propone cómo verificarla. Incluye contexto, supuestos, límites, evidencia necesaria y próximos pasos cuando sea útil. No ejecutes acciones sensibles ni atribuyas autoridad científica sin aprobación humana. Respeta FAIR, procedencia W3C PROV, trazabilidad, soberanía institucional y supervisión humana.`

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
  } catch (error) {
    const message = error instanceof Error ? error.message : ''
    if (message.toLowerCase().includes('credit card') || message.toLowerCase().includes('free credits')) {
      return Response.json({ error: 'El Gateway de IA está conectado, pero necesita una tarjeta válida en Vercel para desbloquear los créditos gratuitos.' }, { status: 402 })
    }
    return Response.json({ error: 'Isabella no pudo responder. Revisa la configuración del Gateway e inténtalo de nuevo.' }, { status: 500 })
  }
}
