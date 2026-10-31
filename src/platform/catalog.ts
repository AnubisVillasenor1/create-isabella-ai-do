/**
 * Catálogo declarativo de la plataforma multipágina (state: engine-generated).
 *
 * Una sola fuente de verdad para navegación, HTML server-side y el catálogo público.
 * Enumerar una página, skill o plan NO autoriza ni ejecuta nada.
 * SPECIFIED ≠ IMPLEMENTED ≠ TESTED.
 */

import { OMEGA_INVARIANT, buildOmegaCanonPayload, type OmegaCanonPayload } from './omega-canon';

export const PLATFORM_CONTRACT_VERSION = '1.1.0' as const;

export const PLATFORM_INVARIANT =
  'CAPABILITY ≠ AUTHORITY ≠ EXECUTION ≠ EVIDENCE ≠ LEARNING ≠ PRODUCTION' as const;

export type PlatformGroupId = 'workspace' | 'capabilities' | 'business' | 'trust' | 'account';

export type PlatformDynamicModule =
  | 'overview'
  | 'status'
  | 'skills'
  | 'agents'
  | 'marketplace'
  | 'pricing'
  | 'integrations'
  | 'governance'
  | 'canon'
  | 'library'
  | 'profile'
  | 'settings'
  | 'donations';

export interface PlatformLink {
  readonly label: string;
  readonly href: string;
  readonly external?: boolean;
}

export interface PlatformSection {
  readonly id: string;
  readonly eyebrow: string;
  readonly title: string;
  readonly body: string;
  readonly bullets?: readonly string[];
  readonly note?: string;
  readonly code?: string;
  readonly links?: readonly PlatformLink[];
}

export interface PlatformPage {
  readonly id: string;
  readonly kind: 'page' | 'chat';
  readonly path: string;
  readonly navLabel: string;
  readonly group: PlatformGroupId;
  readonly eyebrow: string;
  readonly title: string;
  readonly accent: string;
  readonly summary: string;
  readonly meta: readonly string[];
  readonly sections: readonly PlatformSection[];
  readonly dynamic?: PlatformDynamicModule;
  readonly related: readonly string[];
  readonly cta?: PlatformLink;
}

export interface PlatformNavGroup {
  readonly id: PlatformGroupId;
  readonly label: string;
  readonly index: string;
  readonly description: string;
  readonly pages: readonly string[];
}

export const PLATFORM_NAV_GROUPS: readonly PlatformNavGroup[] = Object.freeze([
  {
    id: 'workspace',
    label: 'ESPACIO',
    index: '01',
    description: 'Conversación, panorama y salud del nodo.',
    pages: ['chat', 'overview', 'status'],
  },
  {
    id: 'capabilities',
    label: 'CAPACIDADES',
    index: '02',
    description: 'Skills, herramientas, marketplace e integraciones.',
    pages: ['skills', 'tools', 'marketplace', 'integrations'],
  },
  {
    id: 'business',
    label: 'COMERCIAL',
    index: '03',
    description: 'Planes, suscripciones y apoyo al proyecto.',
    pages: ['pricing', 'donations'],
  },
  {
    id: 'trust',
    label: 'CONFIANZA',
    index: '04',
    description: 'Gobernanza, canon, documentación, API y preguntas frecuentes.',
    pages: ['governance', 'canon', 'docs', 'developers', 'faq', 'about'],
  },
  {
    id: 'account',
    label: 'CUENTA LOCAL',
    index: '05',
    description: 'Biblioteca, perfil e historial guardados en este navegador.',
    pages: ['library', 'profile', 'settings'],
  },
]);

export const PLATFORM_PAGES: readonly PlatformPage[] = Object.freeze([
  {
    id: 'chat',
    kind: 'chat',
    path: '/chat',
    navLabel: 'Chat',
    group: 'workspace',
    eyebrow: 'CONVERSATION SURFACE',
    title: 'Conversación',
    accent: 'sin ruido.',
    summary:
      'Una superficie dedicada para pensar, redactar, analizar y ejecutar herramientas locales. La sesión se guarda en este navegador; el servidor no la usa como memoria personal.',
    meta: ['SESIÓN LOCAL', 'STREAMING PROGRESIVO', 'AGENTE LOCAL'],
    sections: [],
    related: ['overview', 'skills', 'governance'],
    cta: { label: 'Abrir chat', href: '/chat' },
  },
  {
    id: 'overview',
    kind: 'page',
    path: '/platform',
    navLabel: 'Panorama',
    group: 'workspace',
    eyebrow: 'PLATFORM OVERVIEW',
    title: 'Inteligencia con memoria',
    accent: 'y límites verificables.',
    summary:
      'Isabella reúne conversación, agentes gratuitos, catálogos, estado operativo y gobernanza en una superficie empresarial y académica. Cada componente declara qué calcula, qué no autoriza y qué evidencia produce.',
    meta: ['TINA · V6', 'NODO CERO', 'REVISIÓN 2026-10-24'],
    dynamic: 'overview',
    sections: [
      {
        id: 'superficie',
        eyebrow: '01 / SUPERFICIE',
        title: 'Una plataforma, no una sola página.',
        body: 'El chat vive en una ruta exclusiva y las capacidades se desglosan en páginas independientes. La navegación conserva el contexto y evita mezclar conversación, administración y comercio en el mismo lienzo.',
        bullets: [
          'Chat dedicado con historial local, adjuntos de texto, voz del navegador y entrega progresiva.',
          'Skills, tools, marketplace, integraciones, planes, biblioteca, perfil y documentación con URL propia.',
          'Redirecciones desde la interfaz principal y desde la paleta de comandos.',
        ],
      },
      {
        id: 'aceleracion',
        eyebrow: '02 / HYPERCORE TURBO',
        title: 'Rutas rápidas para lo pequeño; rutas gobernadas para lo importante.',
        body: 'HyperCore Turbo no promete una velocidad imposible: elimina trabajo evitable. Las intenciones cortas y no ambiguas se resuelven localmente; las demás pasan por la cadena de proveedores con presupuesto, single-flight y un límite de concurrencia.',
        bullets: [
          'Fast lane determinista para saludos, identidad, hora, aritmética, skills y estado del nodo.',
          'Caché TTL + LRU con coalescing y stale-while-revalidate para respuestas repetidas.',
          'Compuerta de concurrencia para evitar que un pico de proveedores sature el proceso.',
          'Entrega progresiva por SSE; no se presenta como streaming nativo del proveedor.',
        ],
        links: [{ label: 'Ver estado del nodo', href: '/platform/status' }],
      },
      {
        id: 'agentes',
        eyebrow: '03 / AGENTES',
        title: 'Autonomía acotada, aprobación humana para escribir.',
        body: 'El agente local funciona sin modelo generativo, sin clave y sin red. Solo puede invocar herramientas registradas en el proceso; las escrituras requieren un token administrativo verificado en el servidor, nunca un campo del cuerpo HTTP.',
        bullets: [
          'Herramientas de lectura: reloj, aritmética segura, resumen extractivo, conocimiento curado, estado y skills.',
          'Propuestas de memoria sin mutar la memoria canónica.',
          'Auditoría best-effort en BookPI y límites de entrada, tiempo y número de llamadas.',
        ],
        links: [{ label: 'Explorar tools y agentes', href: '/platform/tools' }],
      },
      {
        id: 'gobernanza',
        eyebrow: '04 / GOBERNANZA',
        title: 'La capacidad no concede autoridad.',
        body: 'Cada conversación pasa por una evaluación de política antes de generar o responder. La caché no es un permiso, un fragmento no es evidencia y una respuesta no es una certificación de producción.',
        note: PLATFORM_INVARIANT,
        links: [{ label: 'Leer gobernanza', href: '/platform/governance' }],
      },
    ],
    related: ['chat', 'status', 'governance', 'docs'],
    cta: { label: 'Abrir chat dedicado', href: '/chat' },
  },
  {
    id: 'status',
    kind: 'page',
    path: '/platform/status',
    navLabel: 'Estado',
    group: 'workspace',
    eyebrow: 'NODE OBSERVABILITY',
    title: 'Estado del nodo',
    accent: 'sin marketing.',
    summary:
      'Lecturas públicas y honestas del proceso actual: salud, readiness por configuración, proveedores declarados, métricas locales de HyperCore Turbo y catálogo de agentes.',
    meta: ['PROCESS-LOCAL', 'NO ES UN SLA', 'LECTURA PÚBLICA'],
    dynamic: 'status',
    sections: [
      {
        id: 'que-mide',
        eyebrow: '01 / ALCANCE',
        title: 'Lo que esta página puede y no puede demostrar.',
        body: 'Los números describen este proceso de Node y su configuración observable. No prueban alcanzabilidad externa, cuota disponible, latencia de un proveedor ni capacidad de producción distribuida.',
        bullets: [
          'Salud superficial y readiness por presencia de configuración e IO local.',
          'Histogramas p50/p90/p95/p99 de la ruta cognitiva y de la compuerta de proveedores.',
          'Estado declarado de proveedores gratuitos y de pago; las claves nunca se exponen.',
        ],
        note: 'Un semáforo verde aquí significa «este proceso responde y su configuración mínima está presente», no «listo para producción sin más pruebas».',
      },
      {
        id: 'lectura',
        eyebrow: '02 / LECTURA',
        title: 'Cómo interpretar los indicadores.',
        body: 'Latencia y tasas de acierto son locales y se reinician con el proceso. El readiness profundo puede fallar de forma cerrada si falta una dependencia requerida. Los proveedores de pago permanecen detrás de un doble candado de operador y autorización.',
        links: [
          { label: 'Health JSON', href: '/api/v1/health' },
          { label: 'Readiness JSON', href: '/api/v1/healthz' },
          { label: 'Turbo JSON', href: '/api/v1/hypercore/turbo/status' },
        ],
      },
    ],
    related: ['overview', 'integrations', 'governance'],
    cta: { label: 'Inspeccionar APIs', href: '/platform/integrations' },
  },
  {
    id: 'skills',
    kind: 'page',
    path: '/platform/skills',
    navLabel: 'Skills',
    group: 'capabilities',
    eyebrow: 'SKILL REGISTRY',
    title: 'Skills',
    accent: 'que se pueden auditar.',
    summary:
      'Cada skill declara identificador, versión, método, nivel de riesgo y scopes requeridos. Listar el catálogo no ejecuta la skill ni concede autoridad.',
    meta: ['CATÁLOGO V2', 'CONTRATOS', 'SOLO LECTURA'],
    dynamic: 'skills',
    sections: [
      {
        id: 'contratos',
        eyebrow: '01 / CONTRATOS',
        title: 'Una skill es un contrato, no un botón mágico.',
        body: 'El registro describe la capacidad y sus scopes. La ejecución pasa por el motor HyperCore, la gobernanza y el sello de evidencia; una ejecución de alto riesgo puede escalar a revisión humana.',
        bullets: [
          'Identificador estable y versión explícita.',
          'Método canónico y nivel de riesgo declarado.',
          'Scopes de autoridad separados de la mera existencia de la skill.',
        ],
      },
      {
        id: 'ejecucion',
        eyebrow: '02 / EJECUCIÓN',
        title: 'La ejecución exige más que un GET.',
        body: 'El endpoint de ejecución es administrativo y requiere un token verificado. La interfaz pública solo muestra el catálogo; no simula permisos ni ofrece un botón de ejecución sin autorización.',
        note: 'Ver una skill no la habilita. El catálogo es información, no una autorización.',
      },
    ],
    related: ['tools', 'marketplace', 'governance'],
    cta: { label: 'Ver agentes y tools', href: '/platform/tools' },
  },
  {
    id: 'tools',
    kind: 'page',
    path: '/platform/tools',
    navLabel: 'Tools',
    group: 'capabilities',
    eyebrow: 'AGENTS & TOOLS',
    title: 'Herramientas',
    accent: 'con límites explícitos.',
    summary:
      'El agente local es gratuito, determinista y sin red. Sus herramientas están allowlisted y sus escrituras requieren aprobación administrativa verificada por el servidor.',
    meta: ['SIN MODELO', 'SIN RED', 'APROBACIÓN HUMANA'],
    dynamic: 'agents',
    sections: [
      {
        id: 'politica',
        eyebrow: '01 / POLÍTICA',
        title: 'Lo que el agente puede hacer sin permiso.',
        body: 'Lecturas acotadas: hora, aritmética segura sin eval, resumen extractivo, búsqueda en conocimiento curado, estado del nodo y catálogo de skills. No hay shell, filesystem, navegador ni llamadas de red.',
        bullets: [
          'Máximo 3 llamadas por ejecución y 1.500 ms por herramienta.',
          'Entrada máxima de 4.000 caracteres.',
          'Propuestas de memoria que no mutan la memoria canónica.',
          'Errores sin filtrar detalles internos.',
        ],
      },
      {
        id: 'aprobacion',
        eyebrow: '02 / APROBACIÓN',
        title: 'El cuerpo HTTP no puede conceder permiso.',
        body: 'La capa HTTP decide la aprobación comparando un bearer administrativo contra el secreto del proceso. Enviar `approvalGranted: true` en el cuerpo no sirve. La ejecución pública se registra como sesión humana y las escrituras quedan bloqueadas.',
        note: 'Los contadores y el catálogo se leen del proceso. Un fallo de auditoría no se oculta: se contabiliza como evidencia fallida.',
      },
    ],
    related: ['skills', 'marketplace', 'developers'],
    cta: { label: 'Probar el chat', href: '/chat' },
  },
  {
    id: 'marketplace',
    kind: 'page',
    path: '/platform/marketplace',
    navLabel: 'Marketplace',
    group: 'capabilities',
    eyebrow: 'READ-ONLY MARKETPLACE',
    title: 'Marketplace',
    accent: 'de solo lectura.',
    summary:
      'Enumera reglas, skills, plugins, hooks y servidores MCP; resuelve dependencias y planifica packs. No instala, no habilita y no ejecuta.',
    meta: ['CATÁLOGO', 'RESOLUCIÓN', 'CERO INSTALACIÓN'],
    dynamic: 'marketplace',
    sections: [
      {
        id: 'limites',
        eyebrow: '01 / LÍMITES',
        title: 'Planificar no es instalar.',
        body: 'Un pack puede estar completo o tener dependencias ausentes. El marketplace lo declara con `present`, `missing`, `enabled: false` y `authorizationPerformed: false`. No existe botón de instalación pública.',
        bullets: [
          'Inventario por tipo de customización.',
          'Resolución de dependencias contra el registro vivo.',
          'Huellas SHA-256 del catálogo y de cada pack.',
          'Aprobación humana obligatoria antes de cualquier habilitación futura.',
        ],
      },
      {
        id: 'customizacion',
        eyebrow: '02 / CUSTOMIZACIÓN',
        title: 'El catálogo nativo y el marketplace son cosas distintas.',
        body: 'El catálogo nativo describe lo que este proceso conoce; el marketplace agrupa packs. Ambos son superficies de información y planificación, no canales de ejecución.',
        note: 'CAPABILITY ≠ AUTHORITY: resolver un pack no lo autoriza.',
      },
    ],
    related: ['skills', 'tools', 'integrations'],
    cta: { label: 'Leer la API', href: '/platform/developers' },
  },
  {
    id: 'pricing',
    kind: 'page',
    path: '/platform/pricing',
    navLabel: 'Planes',
    group: 'business',
    eyebrow: 'PLANS & BILLING',
    title: 'Planes',
    accent: 'con expectativas claras.',
    summary:
      'FREE para explorar; PREMIUM, VIP y ENTERPRISE para operar. Los límites y características se leen del catálogo del servidor. La disponibilidad de pago depende de la configuración del operador.',
    meta: ['PLANES', 'CUOTAS', 'SIN CLAVES EXPUESTAS'],
    dynamic: 'pricing',
    sections: [
      {
        id: 'pago',
        eyebrow: '01 / PAGOS',
        title: 'El navegador nunca ve una clave secreta.',
        body: 'La compra se inicia solo cuando el servidor tiene configurado un procesador de pagos. Las claves de Stripe, Supabase y los tokens administrativos viven en el entorno del servidor y no se devuelven por la API pública.',
        bullets: [
          'Precios, planes y cuotas se leen del servidor.',
          'Los webhooks se verifican y deduplican en el servidor.',
          'Un plan no concede autoridad para operaciones destructivas.',
          'Las suscripciones requieren identidad autenticada cuando el operador la habilita.',
        ],
        note: 'Si el procesador de pagos no está configurado, esta página lo declara y no simula un checkout exitoso.',
      },
      {
        id: 'monetizacion',
        eyebrow: '02 / MONETIZACIÓN',
        title: 'Comercio separado de la conversación.',
        body: 'Los planes comerciales y la monetización de terceros se gestionan en superficies propias. La conversación pública no crea ofertas, campañas, pagos ni contratos por sí sola.',
        links: [{ label: 'Ver precios del servidor', href: '/api/v1/billing/plans' }],
      },
    ],
    related: ['donations', 'marketplace', 'developers'],
    cta: { label: 'Apoyar el proyecto', href: '/platform/donations' },
  },
  {
    id: 'integrations',
    kind: 'page',
    path: '/platform/integrations',
    navLabel: 'Integraciones',
    group: 'capabilities',
    eyebrow: 'INTEGRATION SURFACES',
    title: 'Integraciones',
    accent: 'por contrato.',
    summary:
      'REST público, superficie compatible con OpenAI, SSE, voz, visión y webhooks firmados. Cada integración declara autenticación, límites y qué NO garantiza.',
    meta: ['REST', 'OPENAI-COMPATIBLE', 'SSE'],
    dynamic: 'integrations',
    sections: [
      {
        id: 'superficies',
        eyebrow: '01 / SUPERFICIES',
        title: 'Una integración no es un permiso.',
        body: 'La API pública permite conversar y leer catálogos. Las rutas administrativas requieren tokens separados. Las rutas de proveedores de pago tienen doble candado: autorización y opt-in del operador.',
        bullets: [
          '`POST /api/v1/cognition/route`: respuesta JSON gobernada.',
          '`POST /api/v1/cognition/stream`: entrega progresiva por SSE.',
          '`POST /v1/chat/completions`: compatibilidad OpenAI cuando está habilitada.',
          'Webhooks con firma, deduplicación y orden cuando el operador configura el secreto.',
        ],
      },
      {
        id: 'proveedores',
        eyebrow: '02 / PROVEEDORES',
        title: 'Primero lo gratuito; lo de pago, explícito.',
        body: 'La cadena Auto intenta proveedores gratuitos sin clave cuando el operador los habilita y luego rutas configuradas. Los proveedores de pago no se activan por accidente: exigen autorización y una bandera explícita.',
        note: 'La interfaz declara el motor real de cada respuesta. Un fallback local no se presenta como un LLM.',
      },
    ],
    related: ['developers', 'status', 'governance'],
    cta: { label: 'Documentación para desarrolladores', href: '/platform/developers' },
  },
  {
    id: 'library',
    kind: 'page',
    path: '/platform/library',
    navLabel: 'Biblioteca',
    group: 'account',
    eyebrow: 'LOCAL LIBRARY',
    title: 'Biblioteca',
    accent: 'que vive en tu navegador.',
    summary:
      'Archivos de texto, notas y artefactos guardados localmente. No se suben al servidor, no se sincronizan entre dispositivos y puedes borrarlos en cualquier momento.',
    meta: ['LOCAL-FIRST', 'TEXTO', 'SIN SYNC'],
    dynamic: 'library',
    sections: [
      {
        id: 'archivos',
        eyebrow: '01 / ARCHIVOS',
        title: 'Lectura local, sin carga remota.',
        body: 'Puedes importar archivos de texto pequeños (TXT, MD, CSV, JSON, LOG, código) para revisarlos y copiar fragmentos. El contenido se conserva en `localStorage` y está sujeto a la cuota del navegador.',
        bullets: [
          'Límite recomendado: 120 KB por archivo y 1 MB de biblioteca local.',
          'Sin carga a Supabase, sin embeddings y sin indexación remota.',
          'Exportación JSON para respaldar y eliminación individual o total.',
        ],
      },
      {
        id: 'artefactos',
        eyebrow: '02 / ARTEFACTOS',
        title: 'Separar borrador, artefacto y evidencia.',
        body: 'Un artefacto es un objeto de trabajo local. No es evidencia, no es una publicación y no concede autoridad. Los entregables que necesiten sello deben pasar por un flujo gobernado explícito.',
        note: 'La biblioteca no reemplaza BookPI ni el almacenamiento canónico del servidor.',
      },
    ],
    related: ['profile', 'settings', 'docs'],
    cta: { label: 'Abrir chat', href: '/chat' },
  },
  {
    id: 'profile',
    kind: 'page',
    path: '/platform/profile',
    navLabel: 'Perfil',
    group: 'account',
    eyebrow: 'LOCAL PROFILE',
    title: 'Perfil',
    accent: 'sin vigilancia.',
    summary:
      'Un perfil local para tu sesión: nombre visible, insignias de uso, historial y galería de artefactos. No hay cuenta remota ni perfil público por defecto.',
    meta: ['LOCAL', 'INSIGNIAS', 'HISTORIAL'],
    dynamic: 'profile',
    sections: [
      {
        id: 'insignias',
        eyebrow: '01 / INSIGNIAS',
        title: 'Reconocimiento de uso, no certificación.',
        body: 'Las insignias se calculan en tu navegador a partir de actividad local (conversaciones, cálculos, resúmenes, biblioteca). No son credenciales académicas, profesionales ni una verificación de identidad.',
        bullets: [
          'Primer chat, explorador de skills, bibliotecario, calculista y lector de gobernanza.',
          'Se reinician si borras los datos del sitio.',
          'No se envían al servidor ni se comparten con terceros.',
        ],
      },
      {
        id: 'historial',
        eyebrow: '02 / HISTORIAL',
        title: 'Tus conversaciones, bajo tu control.',
        body: 'El historial se guarda en `localStorage`. Puedes exportarlo en Markdown o JSON, borrar una sesión y borrar todo. La memoria canónica del servidor no se modifica desde aquí.',
        note: 'Borrar el almacenamiento del sitio elimina el historial local de forma irreversible.',
      },
    ],
    related: ['library', 'settings', 'chat'],
    cta: { label: 'Ir al chat', href: '/chat' },
  },
  {
    id: 'settings',
    kind: 'page',
    path: '/platform/settings',
    navLabel: 'Ajustes',
    group: 'account',
    eyebrow: 'WORKSPACE SETTINGS',
    title: 'Ajustes',
    accent: 'con control local.',
    summary:
      'Motor por defecto, lente de análisis, entrega progresiva, voz y movimiento. Todo se guarda en este navegador y se aplica al chat dedicado.',
    meta: ['PREFERENCIAS', 'ACCESIBILIDAD', 'DATOS LOCALES'],
    dynamic: 'settings',
    sections: [
      {
        id: 'conversacion',
        eyebrow: '01 / CONVERSACIÓN',
        title: 'Elige el motor y la lente, con consecuencias visibles.',
        body: 'Auto intenta la cadena gratuita/configurada y declara el motor real. Soberano evita proveedores externos y usa el motor local determinista. La lente ajusta el encuadre de la respuesta, no concede permisos.',
        bullets: [
          'Auto: fast lane local y, si hace falta, cadena de proveedores.',
          'Soberano: sin proveedor externo; respuestas locales y declaradas.',
          'Lentes: general, territorial, epistémica, seguridad y gobernanza.',
          'Entrega progresiva activable; si se desactiva, se usa JSON.',
        ],
      },
      {
        id: 'privacidad',
        eyebrow: '02 / PRIVACIDAD',
        title: 'El botón de borrar debe borrar de verdad.',
        body: 'Puedes eliminar historial, biblioteca y preferencias desde esta página. La aplicación no sincroniza esos datos ni los envía a un servicio de analítica propio.',
        note: 'Los proveedores externos, si se usan, reciben el prompt y parte del historial según su propia política. El modo Soberano evita esa llamada.',
        links: [{ label: 'Revisar gobernanza', href: '/platform/governance' }],
      },
    ],
    related: ['profile', 'library', 'chat'],
    cta: { label: 'Abrir chat', href: '/chat' },
  },
  {
    id: 'governance',
    kind: 'page',
    path: '/platform/governance',
    navLabel: 'Gobernanza',
    group: 'trust',
    eyebrow: 'GOVERNANCE & EVIDENCE',
    title: 'Gobernanza',
    accent: 'antes de ejecutar.',
    summary:
      'Capacidad, autoridad, ejecución, evidencia, aprendizaje y producción son estados distintos. La interfaz los muestra por separado y no convierte una respuesta en un permiso.',
    meta: ['CROWN', 'BOOKPI', 'FAIL-CLOSED'],
    dynamic: 'governance',
    sections: [
      {
        id: 'invariante',
        eyebrow: '01 / INVARIANTE',
        title: 'La separación es el producto.',
        body: 'Una skill puede existir sin estar autorizada. Una autorización puede existir sin ejecución. Una ejecución puede producir evidencia sin demostrar veracidad. Y una evidencia no convierte el sistema en producción.',
        note: PLATFORM_INVARIANT,
      },
      {
        id: 'evidencia',
        eyebrow: '02 / EVIDENCIA',
        title: 'BookPI registra; no certifica por sí solo.',
        body: 'Las decisiones de política, las evaluaciones cognitivas y las ejecuciones gobernadas pueden sellarse en BookPI. El backend puede ser en memoria, JSONL local o PostgreSQL; la interfaz declara cuál está activo y su durabilidad.',
        bullets: [
          'La memoria de proceso no es durable.',
          'JSONL local no es compartido ni WORM.',
          'PostgreSQL es durable y compartido, pero no WORM.',
          'Ningún backend sustituye una revisión humana.',
        ],
        links: [{ label: 'Estado operativo', href: '/platform/status' }],
      },
      {
        id: 'autoridad',
        eyebrow: '03 / AUTORIDAD',
        title: 'Lo público no puede autoconcederse permisos.',
        body: 'Los cuerpos HTTP no aportan roles, scopes, aprobación ni identidad verificada. La capa de confianza decide. Las acciones destructivas o privilegiadas se bloquean o escalan; no se ejecutan por cortesía.',
        bullets: [
          'Aprobación administrativa decidida en el servidor.',
          'Tokens comparados en tiempo constante.',
          'Aislamiento de herramientas sin shell, filesystem ni red.',
          'Límites de tasa por ruta y por actor.',
        ],
      },
    ],
    related: ['status', 'docs', 'faq'],
    cta: { label: 'Leer la documentación', href: '/platform/docs' },
  },
  {
    id: 'canon',
    kind: 'page',
    path: '/platform/canon',
    navLabel: 'Canon Ω∞',
    group: 'trust',
    eyebrow: 'CANON & TRACEABILITY',
    title: 'Canon Génesis',
    accent: 'Ω∞, con evidencia.',
    summary:
      'El marco fundacional canónico se publica como registro de doctrina y trazabilidad. Cada capa y cada implementación declara su madurez real en este repositorio; la doctrina no se presenta como producción.',
    meta: ['CANON Ω∞', '25 IMPLEMENTACIONES', 'MADUREZ DECLARADA'],
    dynamic: 'canon',
    sections: [
      {
        id: 'registro',
        eyebrow: '01 / REGISTRO',
        title: 'La doctrina también se audita.',
        body: 'El canon Génesis Ω∞ describe siete pilares, catorce capas de arquitectura y veinticinco implementaciones ΩX. Este registro los publica con su madurez declarada y la ruta de código que respalda cada entrada.',
        bullets: [
          'verified: código y prueba automatizada localizados en este repositorio.',
          'implemented: código localizado; sin prueba específica ni cableado garantizado.',
          'partial: sólo una parte del contrato canónico está representada.',
          'specified: doctrina sin implementación localizada; no se simula.',
        ],
        note: OMEGA_INVARIANT,
      },
      {
        id: 'memoria',
        eyebrow: '02 / MEMORIA',
        title: 'STM, LTM, ETM e institucional: alcances distintos.',
        body: 'La memoria ejecutiva táctica (ETM) registra metas, planes, decisiones y prioridades con TTL, capacidad acotada y cadena SHA-256. Verifica integridad; no muta la memoria canónica ni concede autoridad.',
        bullets: [
          'STM: estado de sesión y conversación.',
          'LTM: documentos, conocimiento verificado y evidencia.',
          'ETM: registro táctico acotado y encadenado.',
          'Institucional: constitución declarativa.',
        ],
        links: [{ label: 'Revisar gobernanza', href: '/platform/governance' }],
      },
      {
        id: 'limites',
        eyebrow: '03 / LÍMITES',
        title: 'Un canon no es un despliegue.',
        body: 'Las generaciones del Foundation Model (20B–500B+), el roster de doce agentes y las nueve federaciones son objetivos arquitectónicos. Este repositorio no contiene esos pesos, no ejecuta procesos autónomos desplegados y no opera una federación entre nodos.',
        note: 'El canon no concede autoridad, no ejecuta y no certifica producción.',
        links: [{ label: 'Ver estado real', href: '/platform/status' }],
      },
    ],
    related: ['governance', 'docs', 'status'],
    cta: { label: 'Leer la documentación', href: '/platform/docs' },
  },
  {
    id: 'docs',
    kind: 'page',
    path: '/platform/docs',
    navLabel: 'Docs',
    group: 'trust',
    eyebrow: 'DOCUMENTATION',
    title: 'Documentación',
    accent: 'para operar y verificar.',
    summary:
      'Arquitectura, API, operación y límites. La documentación distingue lo especificado de lo implementado y lo probado; no presenta borradores como producción.',
    meta: ['ARQUITECTURA', 'API', 'OPERACIÓN'],
    sections: [
      {
        id: 'mapa',
        eyebrow: '01 / MAPA',
        title: 'Empezar por la superficie correcta.',
        body: 'El repositorio contiene el runtime canónico, la interfaz, las rutas, las pruebas y los scripts de aseguramiento. La documentación de la plataforma resume el contrato visible; el código y las pruebas son la referencia operativa.',
        bullets: [
          'README: instalación, validación y límites conocidos.',
          'Inventario de rutas generado desde el código.',
          'Pruebas de contrato para rutas, entorno y caché.',
          'Informe de benchmark de interfaces y decisiones adoptadas.',
        ],
      },
      {
        id: 'madurez',
        eyebrow: '02 / MADUREZ',
        title: 'Tres estados que no deben confundirse.',
        body: 'Una función puede estar especificada sin estar implementada; implementada sin estar probada; o probada en unidad sin haber sido verificada en producción. La documentación debe decir cuál es el caso.',
        note: 'SPECIFIED ≠ IMPLEMENTED ≠ TESTED ≠ PRODUCTION.',
        links: [
          { label: 'API de catálogo', href: '/api/v1/platform/catalog' },
          { label: 'Inventario de rutas', href: '/platform/developers' },
        ],
      },
      {
        id: 'operacion',
        eyebrow: '03 / OPERACIÓN',
        title: 'Validar antes de publicar.',
        body: 'El flujo de referencia instala con lockfile congelado, ejecuta typecheck, lint, pruebas y build. Los bloqueos de aseguramiento del repositorio no se omiten: se corrigen o se declaran.',
        bullets: [
          '`pnpm install --frozen-lockfile`.',
          '`pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build`.',
          'Revisión de secretos y de variables de entorno documentadas.',
          'Verificación en navegador de escritorio y móvil.',
        ],
      },
    ],
    related: ['developers', 'governance', 'faq'],
    cta: { label: 'Guía para desarrolladores', href: '/platform/developers' },
  },
  {
    id: 'developers',
    kind: 'page',
    path: '/platform/developers',
    navLabel: 'Desarrolladores',
    group: 'trust',
    eyebrow: 'DEVELOPER SURFACE',
    title: 'Desarrolladores',
    accent: 'con contratos primero.',
    summary:
      'Endpoints públicos, ejemplos de integración, límites de tasa y reglas de autoridad. La API es pequeña a propósito; lo administrativo queda fuera del alcance público.',
    meta: ['REST', 'EJEMPLOS', 'LÍMITES'],
    sections: [
      {
        id: 'inicio',
        eyebrow: '01 / INICIO RÁPIDO',
        title: 'Una conversación gobernada en una llamada.',
        body: 'Envía una entrada a la ruta cognitiva. El servidor evalúa la política, elige el motor, mide la latencia y declara el resultado. Para entrega progresiva, consume el endpoint SSE.',
        bullets: [
          '`POST /api/v1/cognition/route` con `{ input, modelEngine, focusLens, history }`.',
          '`POST /api/v1/cognition/stream` con el mismo cuerpo; eventos `meta`, `chunk`, `done`.',
          '`GET /api/v1/agents` y `GET /api/v1/hypercore/skills` para catálogos.',
          '`GET /api/v1/marketplace` y `GET /api/v1/billing/plans` para información comercial.',
        ],
        code: `const response = await fetch("/api/v1/cognition/route", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    input: "Explica el invariante de gobernanza.",
    modelEngine: "auto",
    focusLens: "governance",
    history: []
  })
});
const data = await response.json();
console.log(data.output, data.responseEngine, data.latencyMs);`,
        note: 'No envíes secretos en prompts. La API pública no acepta autoridad, roles ni aprobación desde el cuerpo.',
      },
      {
        id: 'limites',
        eyebrow: '02 / LÍMITES',
        title: 'Diseñar para el fallo declarado.',
        body: 'La cadena puede degradar a un fallback local. Un 200 con `responseEngine: sovereign-fallback` es una respuesta honesta, no un LLM. Las rutas públicas tienen límites de tasa y los proveedores de pago requieren configuración del operador.',
        bullets: [
          'Entrada cognitiva máxima: 20.000 caracteres.',
          'Agente local: 4.000 caracteres y 3 herramientas por ejecución.',
          'Límites de tasa por IP y por bucket; respeta `Retry-After`.',
          'Respuestas con `Cache-Control: no-store` en conversación.',
        ],
      },
      {
        id: 'compatibilidad',
        eyebrow: '03 / COMPATIBILIDAD',
        title: 'OpenAI-compatible, no OpenAI.',
        body: 'La superficie compatible traduce el cable, no la identidad. Isabella no es un producto de OpenAI y no reclama sus modelos. La ruta se media por el runtime canónico y puede requerir token según el despliegue.',
        note: 'Compatible a nivel de protocolo no significa afiliación ni equivalencia de modelo.',
      },
    ],
    related: ['docs', 'integrations', 'faq'],
    cta: { label: 'Ver integraciones', href: '/platform/integrations' },
  },
  {
    id: 'faq',
    kind: 'page',
    path: '/platform/faq',
    navLabel: 'FAQ',
    group: 'trust',
    eyebrow: 'FREQUENT QUESTIONS',
    title: 'Preguntas',
    accent: 'frecuentes.',
    summary:
      'Respuestas breves sobre capacidades, privacidad, costos, agentes, evidencia y límites. Si una respuesta depende de la configuración del operador, se dice.',
    meta: ['RESPUESTAS DIRECTAS', 'SIN PROMESAS', 'ACTUALIZABLE'],
    sections: [
      {
        id: 'producto',
        eyebrow: '01 / PRODUCTO',
        title: 'Qué es y qué no es Isabella.',
        body: 'Es una plataforma de conversación y orquestación con gobernanza explícita. No es una certificación académica, no es un sustituto de revisión profesional y no garantiza veracidad por sí sola.',
        bullets: [
          'El chat puede usar un proveedor externo si está configurado; el modo Soberano no.',
          'El agente local no usa un modelo generativo ni red.',
          'La memoria persistente depende del backend configurado.',
          'Las insignias son locales y no son credenciales.',
        ],
      },
      {
        id: 'privacidad',
        eyebrow: '02 / PRIVACIDAD',
        title: 'Dónde viven tus datos.',
        body: 'El historial y la biblioteca viven en `localStorage` de este navegador. Los prompts enviados a proveedores externos salen del proceso según la política de ese proveedor. El modo Soberano evita la llamada externa.',
        bullets: [
          'No hay sincronización de cuenta en esta interfaz.',
          'Borrar los datos del sitio elimina historial y biblioteca locales.',
          'La memoria canónica del servidor no se modifica desde el chat público.',
          'Las claves secretas nunca se envían al navegador.',
        ],
      },
      {
        id: 'costos',
        eyebrow: '03 / COSTOS',
        title: 'Qué es gratis y qué depende del operador.',
        body: 'El agente local y las rutas deterministas son gratuitos. Los proveedores gratuitos externos dependen de su disponibilidad y de la habilitación del operador. Los planes de pago y los proveedores pagos requieren configuración explícita.',
        bullets: [
          'Sin clave: fallback local declarado.',
          'Con proveedor gratuito habilitado: cadena gratuita con presupuesto.',
          'Con proveedor de pago: doble candado y autorización.',
          'Las cuotas de planes se leen del servidor.',
        ],
      },
      {
        id: 'confianza',
        eyebrow: '04 / CONFIANZA',
        title: 'Por qué la respuesta no es una garantía.',
        body: 'La gobernanza decide si una operación se admite; no demuestra que un texto sea verdadero. BookPI prueba integridad de un registro, no veracidad de un hecho. La revisión humana sigue siendo necesaria para decisiones de alto impacto.',
        note: PLATFORM_INVARIANT,
      },
    ],
    related: ['about', 'governance', 'docs'],
    cta: { label: 'Abrir chat', href: '/chat' },
  },
  {
    id: 'about',
    kind: 'page',
    path: '/platform/about',
    navLabel: 'Acerca de',
    group: 'trust',
    eyebrow: 'ABOUT ISABELLA',
    title: 'Acerca de',
    accent: 'una tecnología con raíz.',
    summary:
      'Isabella Villaseñor AI es un proyecto de inteligencia soberana latinoamericana construido desde Real del Monte, Hidalgo. La ambición es servir con evidencia, no con espectáculo.',
    meta: ['TAMV', 'NODO CERO', 'LATINOAMÉRICA'],
    sections: [
      {
        id: 'origen',
        eyebrow: '01 / ORIGEN',
        title: 'Nacida en el mundo real.',
        body: 'El proyecto se desarrolla entre neblina y montaña, con la convicción de que la tecnología debe escuchar a su gente antes de intentar representarla. La identidad pública declara su origen y sus límites.',
        bullets: [
          'Nodo Cero: Real del Monte (Mineral del Monte), Hidalgo, México.',
          'Red: TAMV Online Network.',
          'Principios: humildad, resiliencia y propósito.',
          'Dedicado a Reyna Trejo Serrano.',
        ],
      },
      {
        id: 'academia',
        eyebrow: '02 / REGISTRO',
        title: 'Trazabilidad académica declarada.',
        body: 'El nodo publica su registro académico y su DOI como referencias del proyecto. Un identificador no convierte el software en producción ni sustituye una evaluación independiente.',
        bullets: [
          'ORCID: 0009-0008-5050-1539.',
          'DOI: 10.5281/zenodo.20606361.',
          'Fundador: Edwin Oswaldo Castillo Trejo (Anubis Villaseñor).',
          'La documentación distingue especificación, implementación y prueba.',
        ],
        links: [{ label: 'Estado y registro', href: '/api/v1/status' }],
      },
      {
        id: 'compromiso',
        eyebrow: '03 / COMPROMISO',
        title: 'No venimos a reemplazar personas.',
        body: 'La propuesta es ampliar posibilidades, respetar decisiones y trabajar con las personas. La innovación también es humana cuando sirve, escucha y rinde cuentas.',
        note: 'La confianza se demuestra con código, pruebas y evidencia; no con una declaración de marketing.',
      },
    ],
    related: ['governance', 'docs', 'faq'],
    cta: { label: 'Abrir chat', href: '/chat' },
  },
  {
    id: 'donations',
    kind: 'page',
    path: '/platform/donations',
    navLabel: 'Donaciones',
    group: 'business',
    eyebrow: 'SUPPORT THE PROJECT',
    title: 'Donaciones',
    accent: 'con transparencia.',
    summary:
      'Apoya el mantenimiento del nodo y la investigación aplicada. Esta página no procesa pagos por sí sola: el canal se habilita únicamente cuando el operador configura un procesador y lo declara.',
    meta: ['APOYO', 'SIN PAGOS SIMULADOS', 'TRANSPARENCIA'],
    dynamic: 'donations',
    sections: [
      {
        id: 'destino',
        eyebrow: '01 / DESTINO',
        title: 'Qué financia el apoyo.',
        body: 'Infraestructura del nodo, pruebas de integración, documentación, accesibilidad y mantenimiento de la interfaz. No se promete un retorno financiero ni se venden participaciones.',
        bullets: [
          'Infraestructura y almacenamiento verificable.',
          'Pruebas de seguridad y de regresión.',
          'Documentación bilingüe y material académico.',
          'Accesibilidad y rendimiento en dispositivos modestos.',
        ],
      },
      {
        id: 'canales',
        eyebrow: '02 / CANALES',
        title: 'Ningún botón de pago ficticio.',
        body: 'Si no hay un procesador configurado, esta página lo dice y no recolecta datos de tarjeta. Cuando exista un canal habilitado, se publicará aquí con el nombre del procesador y las condiciones aplicables.',
        note: 'No envíes datos de tarjeta por chat ni por correo. La plataforma no los solicita en esta superficie.',
        links: [
          { label: 'Ver planes', href: '/platform/pricing' },
          { label: 'Contacto institucional', href: '/platform/about' },
        ],
      },
    ],
    related: ['pricing', 'about', 'governance'],
    cta: { label: 'Conocer los planes', href: '/platform/pricing' },
  },
]);

export const PLATFORM_PAGE_IDS: readonly string[] = Object.freeze(
  PLATFORM_PAGES.map((page) => page.id)
);

export function findPlatformPage(id: string): PlatformPage | undefined {
  return PLATFORM_PAGES.find((page) => page.id === id);
}

export interface PlatformCatalogEntry {
  readonly id: string;
  readonly kind: 'page' | 'chat';
  readonly path: string;
  readonly navLabel: string;
  readonly group: PlatformGroupId;
  readonly title: string;
  readonly summary: string;
  readonly meta: readonly string[];
  readonly dynamic: PlatformDynamicModule | null;
}

export interface PlatformCatalogPayload {
  readonly contract: string;
  readonly generatedAt: string;
  readonly invariant: string;
  readonly product: {
    readonly name: string;
    readonly version: string;
    readonly node: string;
    readonly founder: string;
    readonly orcid: string;
    readonly doi: string;
  };
  readonly counts: {
    readonly pages: number;
    readonly groups: number;
    readonly chatSurfaces: number;
  };
  readonly nav: readonly PlatformNavGroup[];
  readonly pages: readonly PlatformCatalogEntry[];
  readonly canon: OmegaCanonPayload;
  readonly disclaimers: readonly string[];
}

export function buildPlatformCatalogPayload(now = new Date()): PlatformCatalogPayload {
  return {
    contract: PLATFORM_CONTRACT_VERSION,
    generatedAt: now.toISOString(),
    invariant: PLATFORM_INVARIANT,
    product: {
      name: 'Isabella Villaseñor AI · Genesis TINA V6',
      version: '6.0.0-platform',
      node: 'Nodo Cero · Real del Monte, Hidalgo, México',
      founder: 'Edwin Oswaldo Castillo Trejo (Anubis Villaseñor)',
      orcid: '0009-0008-5050-1539',
      doi: '10.5281/zenodo.20606361',
    },
    counts: {
      pages: PLATFORM_PAGES.filter((page) => page.kind === 'page').length,
      groups: PLATFORM_NAV_GROUPS.length,
      chatSurfaces: PLATFORM_PAGES.filter((page) => page.kind === 'chat').length,
    },
    nav: PLATFORM_NAV_GROUPS,
    pages: PLATFORM_PAGES.map((page) => ({
      id: page.id,
      kind: page.kind,
      path: page.path,
      navLabel: page.navLabel,
      group: page.group,
      title: page.title,
      summary: page.summary,
      meta: page.meta,
      dynamic: page.dynamic ?? null,
    })),
    canon: buildOmegaCanonPayload(),
    disclaimers: [
      'Enumerar páginas, skills, packs o planes no autoriza, no instala y no ejecuta.',
      'Los datos de sesión, biblioteca y perfil local pertenecen al navegador, no a una cuenta remota.',
      'SPECIFIED ≠ IMPLEMENTED ≠ TESTED ≠ PRODUCTION.',
      'El canon Génesis Ω∞ es doctrina y trazabilidad; no acredita producción ni sustituye una evaluación independiente.',
    ],
  };
}
