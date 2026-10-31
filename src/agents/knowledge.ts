/**
 * Curated, local knowledge base for the free deterministic agent.
 * state: draft | reviewed entries describe implemented behavior or explicit limits.
 *
 * This is not a web search index, vector store or language-model memory. Entries
 * are bounded, human-curated and cite a repository path so a reader can verify the
 * claim. No secrets, credentials or personal data belong in this file.
 */

export interface KnowledgeEntry {
  readonly id: string;
  readonly title: string;
  readonly body: string;
  readonly tags: readonly string[];
  readonly source: string;
}

export const KNOWLEDGE_ENTRIES: readonly KnowledgeEntry[] = [
  {
    id: 'identity',
    title: 'Identidad de Isabella',
    body: 'Isabella Villaseñor AI es una interfaz de asistencia conversacional del ecosistema TAMV, construida sobre el runtime Isabella Genesis TINA (V6/TERMINUS Ω). Distingue capacidad, autoridad, ejecución, evidencia, aprendizaje y producción; no se presenta como certificación externa.',
    tags: ['identidad', 'isabella', 'tamv', 'genesis'],
    source: 'README.md',
  },
  {
    id: 'chat-engines',
    title: 'Motores de respuesta del chat',
    body: 'La ruta /api/v1/cognition/route intenta primero proveedores gratuitos o ya configurados mediante hedgedFirst y un presupuesto de tiempo. Auto nunca activa proveedores de pago sin ALLOW_PAID_PROVIDER_FALLBACK=true. Si no hay proveedor disponible, responde el motor soberano local determinista y lo declara.',
    tags: ['chat', 'motores', 'proveedores', 'fallback', 'latencia'],
    source: 'src/server.ts',
  },
  {
    id: 'fast-lane',
    title: 'Fast lane local de HyperCore Turbo',
    body: 'Saludos, identidad, capacidades, privacidad, presencia, hora, estado del nodo, skills y aritmética simple se resuelven localmente cuando el motor es Auto. La respuesta no espera a un proveedor externo, no usa un LLM y se etiqueta como soberana. Preguntas generales siguen la ruta gobernada normal.',
    tags: ['turbo', 'latencia', 'fast lane', 'local', 'hypercore'],
    source: 'src/inference/local-fast-lane.ts',
  },
  {
    id: 'hypercore-turbo',
    title: 'HyperCore Turbo v2',
    body: 'Acelerador en proceso con caché TTL acotada, LRU, single-flight, stale-while-revalidate, compuerta de concurrencia para proveedores, histogramas p50/p95/p99 y entrega progresiva de una respuesta ya generada. Es una optimización local, no un CDN ni un SLA distribuido.',
    tags: ['hypercore', 'caché', 'concurrencia', 'métricas', 'turbo'],
    source: 'src/performance/hypercore-turbo.ts',
  },
  {
    id: 'local-agents',
    title: 'Agentes locales gratuitos',
    body: 'El agente isabella-local ejecuta herramientas allowlisted sin shell, sin acceso arbitrario a archivos y sin red externa: hora, aritmética segura, resumen extractivo, búsqueda en esta base curada, estado del nodo y catálogo de skills. Las herramientas de escritura requieren aprobación administrativa y se auditan en BookPI.',
    tags: ['agentes', 'open source', 'gratuito', 'herramientas', 'seguridad'],
    source: 'src/agents/runtime.ts',
  },
  {
    id: 'invariant',
    title: 'Invariante de gobernanza',
    body: 'CAPABILITY ≠ AUTHORITY ≠ EXECUTION ≠ EVIDENCE ≠ LEARNING ≠ PRODUCTION. Una capacidad declarada no autoriza una acción; una ejecución no se convierte en evidencia verificada; un test local no certifica producción.',
    tags: ['gobernanza', 'autoridad', 'evidencia', 'producción'],
    source: 'docs/ESTADO-REAL-ACTUAL.md',
  },
  {
    id: 'bookpi',
    title: 'BookPI y evidencia',
    body: 'BookPI registra eventos con cadena de hashes. Puede operar en PostgreSQL compartido, JSONL local con fsync o memoria volátil; /api/v1/status declara el backend real. La cadena detecta alteraciones, pero no es WORM ni sustituye backups, roles restrictivos o anclaje externo.',
    tags: ['bookpi', 'evidencia', 'auditoría', 'ledger', 'durabilidad'],
    source: 'src/bookpi/index.ts',
  },
  {
    id: 'plans',
    title: 'Planes y facturación',
    body: 'Los precios públicos se leen de /api/v1/billing/plans y /api/v1/billing/prices. La suscripción y el cobro dependen de Stripe y de variables de entorno configuradas en el servidor; la interfaz no inventa precios ni confirma pagos. Sin configuración, los botones de cobro deben permanecer deshabilitados.',
    tags: ['planes', 'precios', 'pagos', 'stripe', 'suscripción', 'monetización'],
    source: 'src/commerce/plans.ts',
  },
  {
    id: 'marketplace',
    title: 'Marketplace de capacidades',
    body: 'El marketplace expone catálogo de customización y packs de solo lectura en /api/v1/marketplace. Catalogar o planificar no instala, autoriza ni ejecuta: esas respuestas declaran authorizationPerformed=false y los packs permanecen disabled hasta una revisión explícita.',
    tags: ['marketplace', 'skills', 'packs', 'customización'],
    source: 'src/routes/marketplace.ts',
  },
  {
    id: 'api',
    title: 'API y compatibilidad OpenAI',
    body: 'La API pública vive bajo /api/v1. Existe una superficie compatible con OpenAI en /v1/chat/completions y un puente MCP JSON-RPC en /api/v1/mcp (con token). El inventario de rutas se genera con scripts/route-inventory.mjs y se publica en docs/api/route-inventory.json.',
    tags: ['api', 'openai', 'mcp', 'desarrolladores', 'rutas'],
    source: 'docs/api/README.md',
  },
  {
    id: 'privacy',
    title: 'Privacidad de la conversación',
    body: 'El historial del chat de la interfaz vive en el navegador; la plataforma no afirma memoria personal persistente. En modo Auto, el mensaje y hasta ocho turnos previos pueden enviarse a un proveedor externo si está configurado. No se deben introducir contraseñas, claves ni datos sensibles.',
    tags: ['privacidad', 'datos', 'historial', 'memoria', 'seguridad'],
    source: 'src/ui/platform/chat.js',
  },
  {
    id: 'limits',
    title: 'Límites técnicos',
    body: 'La entrada pública del chat admite hasta 20 000 caracteres; el historial se acota a ocho turnos de 2 000 caracteres. Los archivos adjuntos de la interfaz se leen localmente con límites. Los proveedores y modelos externos dependen de cuotas, facturación y disponibilidad que este proceso no puede garantizar.',
    tags: ['límites', 'tamaño', 'cuotas', 'archivos'],
    source: 'src/server.ts',
  },
  {
    id: 'readiness',
    title: 'Salud y readiness',
    body: '/health y /api/v1/healthz reportan el proceso; /api/v1/readyz es fail-closed y devuelve 503 con evidencia cuando una dependencia crítica está degradada. Un HTTP 200 de health no certifica disponibilidad de proveedores, base de datos ni producción.',
    tags: ['salud', 'readiness', 'health', 'estado', '503'],
    source: 'src/server.ts',
  },
  {
    id: 'site-pages',
    title: 'Subpáginas de la plataforma',
    body: 'La plataforma separa el chat dedicado, skills, tools/agentes, precios, marketplace, integraciones, biblioteca, archivos, perfil, historial, documentación, API, FAQ, acerca de y ajustes. El catálogo real está disponible en /api/v1/platform/catalog y cada página declara si su contenido es leído, local o pendiente de configuración.',
    tags: ['plataforma', 'subpáginas', 'interfaz', 'navegación'],
    source: 'src/routes/platform.ts',
  },
  {
    id: 'donations',
    title: 'Donaciones',
    body: 'La sección de donaciones es informativa. No existe un procesador de donaciones habilitado por defecto y la plataforma no solicita pagos sin un enlace o proveedor configurado explícitamente. Cualquier botón de donación debe mostrar el estado real de configuración.',
    tags: ['donaciones', 'pagos', 'soporte'],
    source: 'README.md',
  },
  {
    id: 'free-models',
    title: 'Modelos gratuitos y open source',
    body: 'El enrutamiento admite proveedores gratuitos sin clave solo con opt-in del operador, AI Gateway, OpenRouter en modelos gratuitos explícitos y proveedores compatibles. Los agentes locales no dependen de ningún modelo externo. Para un modelo local (Ollama/llama.cpp) se requiere configuración e integración explícita que este repositorio no afirma tener activa.',
    tags: ['gratis', 'open source', 'modelos', 'ollama', 'openrouter'],
    source: 'src/inference/provider-policy.ts',
  },
  {
    id: 'voice-multimodal',
    title: 'Voz y multimodal',
    body: 'La interfaz puede usar síntesis y reconocimiento del navegador cuando están disponibles. La voz del servidor, visión e imagen dependen de rutas y credenciales específicas; la UI debe ocultar o deshabilitar la función cuando la readiness no está configurada.',
    tags: ['voz', 'audio', 'visión', 'multimodal', 'tts'],
    source: 'src/inference/multimodal.ts',
  },
  {
    id: 'repository',
    title: 'Repositorio y procedencia',
    body: 'El repositorio canónico de esta implementación es OsoPanda1/ISABELLA-VERSION-TERMINUS-V6. Funciones de otros repositorios del perfil se incorporan sólo después de revisar licencia, API, dependencias y pruebas; compartir marca no implica compatibilidad ni licencia.',
    tags: ['repositorio', 'licencia', 'procedencia', 'github'],
    source: 'docs/audits/GLOBAL-PROFILE-TERMINUS-2026-10-12.md',
  },
] as const;
