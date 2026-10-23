# Isabella Villaseñor AI — Genesis TINA / TERMINUS V6

## Qué es Isabella

Isabella es una **infraestructura de inteligencia artificial gobernada, federada y auditable**. No es un modelo fundacional, una AGI, una consciencia artificial ni una autoridad autónoma: coordina modelos generativos, reglas deterministas, memoria, herramientas, seguridad, procedencia y revisión humana en un único sistema operativo cognitivo.

Su principio rector es:

```text
CAPACIDAD ≠ AUTORIDAD ≠ EJECUCIÓN ≠ EVIDENCIA ≠ APRENDIZAJE ≠ PRODUCCIÓN
```

Una respuesta puede ser generada por un modelo, pero solo una política puede autorizar una acción; los efectos sensibles requieren aprobación humana; toda evidencia debe conservar procedencia; y un build o test local no equivale a certificación productiva.

## Qué hace

La aplicación unificada de este proyecto ofrece:

- **Chat cognitivo:** investigar, redactar, analizar y planificar en español.
- **Contexto de trabajo:** adjuntar nombres de archivos y mantenerlos asociados a la sesión.
- **Memoria conversacional:** conserva los últimos mensajes para cada solicitud y limita el tamaño del contexto.
- **Inferencia por Gateway:** usa Vercel AI Gateway con un modelo válido de la familia `openai/gpt-6.1-sol`.
- **Studio:** convertir sesiones en artefactos revisables y exportar Markdown.
- **Evidence Ledger:** muestra trazas de identidad, política, modelo y contexto por respuesta.
- **Governance:** expone la separación entre sugerencia, autorización, ejecución y aprobación humana.
- **Búsqueda de workspace:** modal para localizar conocimiento, evidencia y sesiones.
- **Voz y accesibilidad:** lectura de la última respuesta con Web Speech API, navegación semántica y soporte de composición CJK al enviar con Enter.
- **Exportación:** descarga una sesión completa como Markdown sin enviar secretos al navegador.

## Cómo funciona

```text
Entrada del usuario
  → validación server-side y límites
  → contexto de sesión y recursos adjuntos
  → prompt de Isabella con reglas de honestidad
  → modelo del AI Gateway
  → respuesta normalizada
  → trazas de evidencia visibles en la interfaz
  → revisión humana antes de cualquier efecto externo
```

La ruta `POST /api/chat` acepta únicamente mensajes `user` y `assistant`, conserva como máximo 20 turnos y recorta cada contenido a 6.000 caracteres. La respuesta se produce en servidor; no se exponen claves de proveedores en el cliente. Los archivos adjuntos de esta versión funcionan como contexto identificable de sesión; el contenido binario no se sube ni se persiste automáticamente.

## Arquitectura de módulos

| Módulo | Responsabilidad | Estado en este proyecto |
| --- | --- | --- |
| Cognitive Chat | Conversación, contexto y respuesta del modelo | Implementado |
| AI Gateway Adapter | Acceso server-side a modelos multi-proveedor | Implementado |
| Policy / CROWN | Separar capacidad de autoridad y bloquear efectos sensibles | Implementado como guardrail de producto |
| Evidence Ledger / BookPI | Trazas de identidad, modelo, contexto y política | Implementado en sesión |
| Memory Mesh | Contexto de conversación acotado y recursos del workspace | Implementado en sesión |
| Studio | Artefactos, exportación y carga de recursos | Implementado |
| Science Integrity | Procedencia, afirmaciones y revisión científica | Contrato documentado; requiere backend durable para certificación |
| Hypercore | Aceleración sin saltarse gates | Principio documentado; sin ejecución externa autónoma |
| Federated Learning | Aprendizaje territorial y adapters | Arquitectura de referencia; no se activa entrenamiento remoto desde la UI |
| Zero Trust | Validación, límites y no ejecución sensible | Implementado como límites de API y diseño fail-closed |
| Territorial Nodes | TAMV, RDM Digital Hub, Nodo Cero y despliegues LATAM | Integración conceptual/documental |

## Tools

En el ecosistema Isabella, una tool es una capacidad explícita con contrato, riesgo, scopes, timeout, procedencia y side effects declarados. Las categorías de referencia son:

- recuperación de conocimiento y búsqueda híbrida;
- lectura y transformación de documentos;
- análisis de claims y cobertura de citas;
- clasificación de riesgo y detección de anomalías;
- validación de procedencia, hashes y cadenas Merkle;
- conectores federados para fuentes institucionales;
- generación de planes, documentos y artefactos;
- observabilidad, auditoría y exportación;
- adaptadores de modelos con fallback gobernado.

La interfaz incluida no ejecuta herramientas externas, pagos, publicación, borrado, cambios de infraestructura ni acciones legales de forma autónoma.

## Skills

Los skills son capacidades compuestas gobernadas que combinan instrucciones, tools, políticas y formatos de salida. Las familias definidas por los repositorios de referencia incluyen:

- investigación y síntesis con evidencia;
- redacción científica, legal y técnica;
- análisis de problemas y planificación;
- integridad científica y verificación de claims;
- seguridad, privacidad, PII y prompt-injection defense;
- memoria, RAG y procedencia;
- gobernanza CROWN, revisión humana y auditoría;
- aprendizaje federado, adapters y feedback;
- operación territorial soberana para TAMV/RDM;
- creación de artefactos y exportación reproducible.

Un skill no debe concederse autoridad por sí mismo: la autorización se reevalúa antes de ejecutar cualquier efecto.

## Diferenciadores frente a otras IA

1. **Gobernanza separada del modelo:** el LLM sugiere; no se autoautoriza.
2. **Trazabilidad como funcionalidad:** contexto, política, modelo y eventos se exponen como evidencia revisable.
3. **Soberanía territorial:** el diseño permite custodias, reglas, idiomas y modelos por territorio.
4. **Proveedor agnóstico:** el Gateway permite cambiar de modelo sin convertir al proveedor en la identidad de Isabella.
5. **Honestidad epistemológica:** distingue hecho, inferencia, supuesto, evidencia insuficiente y decisión humana.
6. **Fail-closed:** una dependencia ausente no debe simular una aprobación o un estado productivo.
7. **Ciencia reproducible:** BookPI, IGDS, NCUA y claim-radar forman una base para procedencia y revisión.
8. **Arquitectura federada:** conecta nodos sin exigir que todos los datos abandonen su custodia local.

## Ejecución

Requisitos: Node.js 20+, pnpm y variables del proyecto administradas por Vercel. En Preview, AI Gateway autentica automáticamente. Para desarrollo local, configura el Gateway desde las variables del proyecto; nunca pongas claves en el código.

```bash
pnpm install
pnpm dev
```

Abre `http://localhost:3000` y prueba:

1. `Investigar un tema: soberanía digital en LATAM`.
2. Añade un archivo desde el botón de adjuntar.
3. Consulta Evidence y Governance.
4. Exporta la sesión desde Studio o el botón Exportar.

## Seguridad y límites

- La API valida forma, roles y longitud antes de llamar al modelo.
- La respuesta no concede autoridad ni ejecuta efectos externos.
- No se deben incluir secretos, credenciales o PII innecesaria en prompts.
- Para producción se requiere persistencia durable, autenticación, RBAC/ABAC, rate limiting distribuido, ledger append-only, observabilidad y auditoría externa.
- `IMPLEMENTED` no significa `TESTED`, `VERIFIED`, `DEPLOYED` ni `CERTIFIED`.

## Referencias

La implementación consolida los repositorios públicos `OsoPanda1/isabella-ai-tina`, `ISABELLA-VERSION-TERMINUS-V6`, `Isabella-V6-TINA`, `isabella-s-genesis-ai`, `isabella-s-core-intelligence`, `isabella-s-crown`, `mexican-ai-isabella`, `base-isabella` y `MI-ISABELLA`, además de la documentación pública del ecosistema TAMV/RDM. Las afirmaciones de certificación, seguridad poscuántica, consciencia o soberanía legal no se infieren de esta integración.

## Licencia

Conserva las licencias de cada repositorio y dependencia de origen. Antes de redistribuir documentación, código o datos de terceros, verifica sus licencias y atribuciones.


## Isabella Ω Genesis Supreme — implementación inicial

Esta rama añade una primera capa operativa de Ω. Los módulos se deben considerar **integración inicial**, no certificación productiva.

### Rutas incorporadas

| Ruta | Función | Límite actual |
| --- | --- | --- |
| `GET /api/omega/health` | Informa configuración disponible y dependencias faltantes | No ejecuta pruebas de carga ni certifica el despliegue |
| `POST /api/omega/policy` | Evalúa una acción y nivel de riesgo con reglas deterministas | No ejecuta la acción; no sustituye autorización por usuario |
| `GET/POST /api/omega/evidence` | Consulta o registra eventos en Supabase y calcula hashes SHA-256 | No es aún un ledger append-only encadenado: la cadena y la concurrencia requieren controles adicionales |
| `GET/POST /api/omega/memory` | Guarda y consulta memorias por tenant y propietario | Requiere autenticación de usuario y políticas de aislamiento antes de multiusuario productivo |
| `POST /api/omega/research` | Normaliza metadatos de claims/fuentes y genera hashes reproducibles | Marca los claims como no verificados; no valida la veracidad de fuentes |
| `POST /api/omega/music/plan` | Produce un blueprint de composición por género, tempo y secciones | No genera ni sintetiza audio |
| `/omega` | Panel de estado de configuración de los módulos Ω | Es una vista diagnóstica, no una consola de administración certificada |

### Variables de entorno para los endpoints Ω

```dotenv
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
ISABELLA_OMEGA_API_TOKEN=
```

Configura los valores en el gestor de secretos del entorno de servidor. **Nunca** los expongas como variables `NEXT_PUBLIC_*`, ni los incluyas en commits. Los endpoints protegidos requieren `Authorization: Bearer <ISABELLA_OMEGA_API_TOKEN>`. Este mecanismo es una barrera compartida de servicio; no equivale a identidad, SSO, RBAC/ABAC ni autorización multiusuario.

### Migración de base de datos

La migración `supabase/migrations/202610230001_isabella_omega_core.sql` crea tablas de evidencia y memoria, índices y habilita RLS sin políticas de cliente. Revisa y ejecuta la migración en un proyecto Supabase de prueba antes de producción. Las escrituras con service role omiten RLS, por lo que el servidor debe validar tenant/owner y deben agregarse controles operativos, grants y triggers para una política append-only real.

### Verificación pendiente

Antes de afirmar que el proyecto está listo para producción, ejecutar en un entorno con dependencias instaladas:

```bash
pnpm install --frozen-lockfile
pnpm lint
pnpm build
```

También faltan pruebas de integración contra Supabase, tests de aislamiento entre tenants, autenticación de usuarios, rate limiting distribuido, auditoría de seguridad, validación de despliegue y revisión de las dependencias externas. Un hash demuestra integridad del contenido comparado, no que el contenido sea verdadero.


## Open Models · Hugging Face integration

Isabella ahora incluye un navegador del catálogo público de Hugging Face, selección de proveedor en el chat y un adaptador server-side para Inference Providers.

### Funciones añadidas
- `GET /api/huggingface/discover?type=models&q=...`: explora modelos del Hub y filtra por texto; opcionalmente admite `task`, `sort` y `limit`.
- `GET /api/huggingface/discover?type=datasets&q=...`: descubre datasets públicos.
- `GET /api/huggingface/discover?type=spaces&q=...`: descubre Spaces y aplicaciones comunitarias.
- El chat puede utilizar `provider: "huggingface"` y un `modelId`, o continuar con el proveedor predeterminado `gateway`.
- El panel **Open Models** ofrece selección de modelos, enlaces a fichas originales, estadísticas del Hub y accesos a documentación, MCP y skills.
- La guía de agente está en `skills/huggingface-open-models/SKILL.md`; la referencia operativa, en `docs/HUGGINGFACE_INTEGRATION.md`.

### Variables del servidor

```dotenv
HF_TOKEN=
HF_MODEL=openai/gpt-oss-120b:fireworks-ai
AI_GATEWAY_MODEL=openai/gpt-6.1-sol-fast
AI_GATEWAY_FALLBACK_MODELS=
```

Configura `HF_TOKEN` en las variables de entorno privadas de Vercel o en el gestor de secretos local. Nunca utilices `NEXT_PUBLIC_HF_TOKEN` ni publiques credenciales. La exploración pública del catálogo no necesita token; la inferencia sí.

### Límites de gratuidad
**No existe una garantía de que todos los modelos open source puedan ejecutarse gratis en la nube.** Los pesos abiertos pueden ejecutarse localmente con hardware suficiente y licencias compatibles; la inferencia alojada depende del proveedor, los créditos, los límites, la disponibilidad y las condiciones de cada modelo. Hugging Face documenta créditos gratuitos mensuales limitados para Inference Providers, sujetos a cambios. Revisa los costes vigentes antes de automatizar llamadas: https://huggingface.co/docs/inference-providers/pricing

El catálogo muestra metadatos; no certifica calidad, seguridad, licencia comercial ni coste cero. Revisa siempre la model card y licencia antes de adoptar un modelo o dataset.

### MCP, Skills y tools
Para conectar herramientas de Hugging Face a un agente de desarrollo compatible, configura la integración oficial desde https://huggingface.co/settings/mcp. La autorización se realiza por el operador y cliente; la aplicación web no obtiene automáticamente permisos del Hub. La integración oficial permite descubrir modelos, datasets, Spaces, documentación y herramientas comunitarias compatibles con MCP.

- Agentes y skills: https://huggingface.co/docs/hub/agents-overview
- MCP: https://huggingface.co/docs/hub/en/agents-mcp
- API del Hub: https://huggingface.co/docs/hub/en/api
- Inferencia y proveedores: https://huggingface.co/docs/inference-providers/index

### Verificación
Se añadió el workflow `.github/workflows/ci.yml` para ejecutar instalación congelada, typecheck, lint y build. El estado debe verificarse en Actions; el código registrado no equivale a un build exitoso ni a un despliegue validado.
