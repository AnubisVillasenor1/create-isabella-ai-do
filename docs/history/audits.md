# Historial consolidado de auditorías — GENESIS Ω∞

> `state: draft | engine-generated` — registro append-only que unifica las auditorías y
> snapshots punto-en-tiempo del proyecto. El contenido se migró **sin edición**; cada sección
> conserva su origen y fecha. La granularidad por fichero sigue disponible en el historial de git.

## Índice

1. `docs/audits/AI-INTERFACE-BENCHMARK-20-2026-10.md`
2. `docs/audits/ANALISIS-OPERATIVO-TOTAL-2026-10-24.md`
3. `docs/audits/AUDIT-2026-10-17.md`
4. `docs/audits/AUDITORIA-NETLIFY-2026-10-24.md`
5. `docs/audits/CHECKLIST-2026-10-19.md`
6. `docs/audits/CHECKLIST-V2-2026-10-19.md`
7. `docs/audits/CHECKLIST-V3-100PCT-2026-10-19.md`
8. `docs/audits/DOWNLOADS-INTEGRATION-2026-10-24.md`
9. `docs/audits/FOCUSED-AUDIT-UI-AND-LIVE-CHAT-2026-10-17.md`
10. `docs/audits/GLOBAL-PROFILE-TERMINUS-2026-10-12.md`
11. `docs/audits/INFERENCE-CHAIN-DEADLINE-CANCELLATION-2026-10-17.md`
12. `docs/audits/P0-ARCHITECTURE-HARDENING-2026-10-12.md`
13. `docs/audits/PRODUCTION-READINESS-AUDIT-2026-10-18.md`
14. `docs/audits/PROFILE-ECOSYSTEM-REVIEW-2026-10.md`
15. `docs/audits/RESPUESTA-AUDITORIA-EXTERNA-2026-10-24.md`
16. `docs/audits/TECH-DEBT-REDUCTION-2026-10-13.md`
17. `docs/audits/TECHNICAL-OPERATIONAL-AUDIT-2026-10-13.md`
18. `docs/audits/TOTAL-AUDIT-2026-10-13.md`
19. `docs/audits/UI-NAVIGATION-AND-CHAT-AUDIT-2026-10-12.md`
20. `docs/archive/GENESISAI-500-CONTROL-CHECKLISTS-2026-10.md`
21. `docs/AUDIT_GENESIS_V6_2026-10-08.md`
22. `docs/ECOSYSTEM_EVOLUTION_AUDIT_2026-10-09.md`

---


## Origen: `docs/audits/AI-INTERFACE-BENCHMARK-20-2026-10.md`

# Benchmark de interfaces de IA: 20 productos de alto tráfico y 100 patrones UX
**Fecha de corte:** 13 de octubre de 2026  
**Repositorio objetivo:** OsoPanda1/ISABELLA-VERSION-TERMINUS-V6  
**Alcance de implementación:** interfaz web y smoke tests de Terminus V6.

## 1. Método y límites

La referencia principal es el ranking [74 Most Popular AI Tools Ranked (October 2026)](https://explodingtopics.com/blog/most-popular-ai-tools), actualizado el 9 de octubre de 2026. Ordena por visitas mensuales a sitios web estimadas por Semrush para junio de 2026: ChatGPT (5.32 mil millones), Gemini (1.14 mil millones), Claude (967.9 millones) y Canva (759.8 millones lideran la lista). Esto no equivale a usuarios únicos, usuarios activos, retención, calidad de modelo, acceso móvil ni cuota en mercados cerrados. La muestra de 20 es el top público de ese ranking, no una declaración universal de cuáles son las “mejores” IA.

Se incluye un conjunto multicategoría: chat, investigación, traducción, diseño, vídeo, música, edición visual, voz, escritura y herramientas para desarrolladores. No se comparan como si todas fueran chatbots. Los cinco patrones por producto son análisis UX de sus superficies y documentación pública; disponibilidad, planes y regiones pueden variar. No son puntuaciones oficiales de proveedores.

## 2. Auditoría del punto de partida

La revisión de HTML, CSS y JS encontró siete defectos estructurales:

1. **Duplicación de navegación:** barra superior y dos raíles laterales repetían conversación, herramientas, workspace, gobernanza y soporte.
2. **Hero demasiado dominante:** la altura del inicio alejaba la tarea central —conversar— del primer plano.
3. **Acciones semánticamente imprecisas:** algunos enlaces de tarjetas prometían “abrir herramientas” pero enviaban a secciones genéricas, no a una herramienta independiente.
4. **Sin biblioteca personal de respuestas:** copiar existía, pero guardar, recuperar, descargar y borrar no formaban un ciclo.
5. **Compositor sin orientación inicial:** el campo vacío no ofrecía ejemplos por intención.
6. **Sin índice buscable de acciones:** el usuario necesitaba recorrer la página y saber por adelantado dónde estaba cada sección.
7. **Alcance poco explícito:** la interfaz debía diferenciar funciones reales del navegador de integraciones de backend todavía ausentes.

El rediseño adopta un workspace de tarea primero: navegación única, command center buscable, conversación prioritaria, acciones sobre cada respuesta y un Studio declarado como local.

## 3. Benchmark: cinco patrones por producto

### 1. ChatGPT — asistente general
1. Un compositor principal reconocible, con controles secundarios sin saturar.
2. Herramientas y modos vinculados a una intención concreta.
3. Texto, archivos y voz como entradas coherentes dentro de una conversación.
4. Canvas como área separada para editar contenido de tamaño sustancial.
5. Acciones de continuidad —copiar, editar, revisar y reutilizar— asociadas al resultado.
**Aplicación Isabella:** composer con Enter/Shift+Enter, prompts iniciales, Copiar/Guardar/Escuchar y Studio. No se afirma paridad con Canvas ni análisis multimodal del backend. [Fuente oficial: capacidades y Canvas](https://help.openai.com/en/articles/9260256-chatgpt-capabilities-overview).

### 2. Gemini — Canvas e investigación
1. Destino de creación separado del chat.
2. Resultado editable y visible, no sólo descrito.
3. Investigación dividida en plan, búsqueda, razonamiento y reporte.
4. Transformación del contenido a formatos adecuados a la siguiente tarea.
5. Punto de entrada fácil que se expande a proyectos complejos.
**Aplicación Isabella:** Studio local y chips por intención; web research y conversión multimedia quedan pendientes. [Canvas](https://gemini.google/es/overview/canvas/?hl=es) · [Deep Research](https://gemini.google/es/overview/deep-research/?hl=es).

### 3. Claude — Artifacts
1. Entregables importantes en un espacio separado del hilo.
2. Iteración que conserva el objeto y su contexto.
3. Plantillas especializadas por formato.
4. Biblioteca recuperable de objetos creados.
5. Continuidad del sistema visual entre documentos y diseños.
**Aplicación Isabella:** Studio local con preview, copia, descarga y borrado. No existe sincronización cloud ni edición avanzada de artifacts. [Artifacts](https://support.claude.com/en/articles/17153992-what-are-artifacts-and-how-do-i-use-them) · [Claude Design](https://claude.com/resources/articles/claude-design-stays-on-brand-for-daily-work).

### 4. Canva — creación visual
1. Capacidades agrupadas en un espacio coherente.
2. Inicio a partir de una idea o un archivo existente.
3. Preview como centro de la decisión de diseño.
4. Edición por componentes y control humano, no una imagen final inaccesible.
5. Consistencia de marca, estilo y formatos entre piezas.
**Aplicación Isabella:** navegación agrupada y Studio reutilizable; no hay editor de imágenes ni generación visual en este backend. [Magic Studio](https://www.canva.com/newsroom/news/magic-studio/) · [Canva AI 2.0 (2026)](https://www.canva.com/newsroom/news/canva-create-2026-ai/).

### 5. DeepSeek — razonamiento y búsqueda
1. Modos como Search y Deep-Think deben diferenciarse claramente.
2. Chat de baja fricción visual.
3. Adjuntar archivos desde el punto donde se plantea la tarea.
4. Extraer texto de archivos con errores y límites explícitos.
5. Aclarar si el historial es local, cuenta sincronizada o multidevice.
**Aplicación Isabella:** lectura acotada de texto UTF-8 y declaración de formatos/límites; no hay selector Deep-Think ni búsqueda web propia. [App y funciones declaradas](https://www.deepseek.com/news/deepseek-app/).

### 6. Grok — modos y contexto
1. Explicitar la intención/contexto requerido por la tarea.
2. Hacer visibles las capacidades antes de que el usuario conozca toda la arquitectura.
3. Entrada conversacional directa.
4. Acciones distintas para resultados de naturaleza distinta.
5. Separar dato consultado en tiempo real de generación del modelo.
**Aplicación Isabella:** el command center y las tareas iniciales facilitan descubrimiento, sin fingir acceso a X ni generación de medios. [Grok](https://grok.com/).

### 7. Character.AI — identidad y conversación
1. Catálogo de experiencias descubrible.
2. Identidad de conversación reconocible mediante nombre y descripción.
3. Acceso a continuidad de hilos anteriores.
4. Voz que se muestra como modo de interacción y con controles claros.
5. Separación entre descubrir experiencias y continuar la conversación actual.
**Aplicación Isabella:** sintetizar voz en navegador, escuchar por respuesta y reiniciar chat. No hay catálogo de personajes ni historial en nube. [Character.AI](https://character.ai/).

### 8. DeepL — precisión de tarea
1. Origen y destino explícitos.
2. Original y resultado comparables.
3. Controles específicos de tono, registro y terminología donde aplican.
4. UI minimalista centrada en la operación principal.
5. Copiar y reutilizar la salida con pocos pasos.
**Aplicación Isabella:** copiar, guardar y exportar texto; no se anuncia un traductor especializado ni motor DeepL. [DeepL Translator](https://www.deepl.com/translator).

### 9. Perplexity — investigación con referencias
1. Fuentes próximas a la afirmación que respaldan.
2. Modos comprensibles para búsqueda simple o investigación profunda.
3. Spaces por proyecto/tema.
4. Seguimiento de preguntas dentro del mismo hilo de investigación.
5. Compartir y exportar el resultado como entregable.
**Aplicación Isabella:** exportación Markdown local. La búsqueda live con fuentes verificables sigue pendiente. [Spaces](https://www.perplexity.ai/help-center/es/articles/10352961-que-son-los-espacios).

### 10. Microsoft Copilot — Pages
1. Conversación que se convierte en una página de trabajo.
2. Edición enriquecida directamente en el entregable.
3. Revisión por fragmentos con aceptación o rechazo.
4. Reapertura de páginas con una identidad estable.
5. Diferenciar propuesta, borrador aceptado y resultado final.
**Aplicación Isabella:** respuestas guardadas explícitamente en Studio local; no se sincronizan a Microsoft 365 ni se coeditan. [Copilot Pages](https://support.microsoft.com/es-ES/microsoft-copilot/using-copilot-pages).

### 11. Suno — creación musical
1. Prompt con controles creativos pertinentes.
2. Preview/reproducción inmediata.
3. Versiones alternativas comparables.
4. Edición por segmentos para reemplazar o extender sin reconstruir todo.
5. Timeline/biblioteca en los flujos avanzados.
**Aplicación Isabella:** se reutilizan patrones de preservar y recuperar resultados, no se declara generación musical. La voz del chat depende del navegador. [Song Editor](https://help.suno.com/en/articles/6141505).

### 12. CapCut — vídeo
1. Preview dirige la edición.
2. Timeline para ordenar fragmentos de contenido.
3. Acciones específicas de IA junto al objeto que modifican.
4. Edición granular después de la primera automatización.
5. Exportación como etapa explícita con un resultado reconocible.
**Aplicación Isabella:** exportación de transcripción y biblioteca textual; no se simula un editor de vídeo. [Auto Video Editor](https://www.capcut.com/tools/auto-video-editor).

### 13. NotebookLM — fuentes y síntesis
1. Áreas de fuentes, chat y Studio separadas por función.
2. Respuestas respaldadas por los materiales proporcionados.
3. Transformación del corpus a resúmenes/formatos alternativos.
4. Organización por cuadernos o temas.
5. Distribución de paneles apta para lectura e investigación.
**Aplicación Isabella:** Studio local reutiliza respuestas; falta ingesta documental persistente y citas por fragmento. [Producto NotebookLM](https://blog.google/innovation-and-ai/models-and-research/google-labs/notebooklm-new-features-december-2024/).

### 14. Remove.bg — herramienta visual especializada
1. Entrada de archivo inmediata.
2. Comparación de antes y después.
3. Progreso y estado visibles por tarea.
4. Descarga como resultado directo.
5. Alcance muy claro de la herramienta.
**Aplicación Isabella:** adjunto con nombre y ámbito de uso explícito, tipos permitidos y errores claros. No se procesa ni elimina el fondo de imágenes. [Remove.bg](https://www.remove.bg/).

### 15. ElevenLabs — creación de voz
1. Muestra de voz para revisar antes de producir.
2. Controles contextuales de voz/clip.
3. Timeline con múltiples pistas.
4. Edición de clips sin reconstruir el proyecto entero.
5. Exportación explícita del resultado.
**Aplicación Isabella:** lectura por respuesta y voz ON/OFF con SpeechSynthesis del navegador. No incluye voces premium, clonación o timeline. [Studio Timeline](https://elevenlabs.io/docs/help-center/product/studio/studio/what-is-the-timeline-in-studio).

### 16. Google AI Studio — playground técnico
1. Galería de prompts y ejemplos.
2. Controles de modelo y parámetros identificables.
3. Pruebas multimodales en un mismo espacio de experimentación.
4. Iteración rápida de prompts y respuestas.
5. Separación entre experimento y publicación, con credenciales bajo control.
**Aplicación Isabella:** prompts de inicio y estado de health del runtime. No se expone un model picker falso ni se gestionan claves desde el navegador. [Google AI Studio](https://ai.google.dev/aistudio?hl=es).

### 17. Lovable — chat y preview de aplicaciones
1. Chat y artefacto/preview cercanos.
2. Selección visual precisa de un elemento.
3. Historial y reversión de modificaciones.
4. Borrador separado del entorno publicado.
5. Etapas distinguibles: cambiar, previsualizar, validar y publicar.
**Aplicación Isabella:** entrega aislada en rama para probar antes del merge. No hay edición visual in-product ni vista de deployment en Isabella. [Visual Edits](https://lovable.dev/blog/introducing-visual-edits) · [Drafts](https://lovable.dev/blog/introducing-drafts).

### 18. Grammarly — feedback editorial
1. Sugerencias en contexto, sobre el texto afectado.
2. Aceptar/rechazar deliberadamente.
3. Audiencia y tono como objetivos editables.
4. Explicación que hace accionable la sugerencia.
5. Editor limpio con foco en el contenido.
**Aplicación Isabella:** edición de texto en el compositor y salida que se puede copiar, guardar o exportar; no existe un grammar checker dedicado. [Strategic Suggestions](https://support.grammarly.com/hc/en-us/articles/25351804320397-introducing-strategic-suggestions).

### 19. QuillBot — control de reescritura
1. Modos de objetivo identificables.
2. Original y reescritura comparables.
3. Edición por segmentos o frases.
4. Salida lista para copiar o incorporar.
5. Controles compactos que no desplazan el área de escritura.
**Aplicación Isabella:** chips de intención reutilizables; comparación de versiones y reescritura por fragmentos se dejan para una fase con backend apropiado. [Paraphraser Modes](https://help.quillbot.com/hc/en-us/articles/35854318883351-What-are-modes-in-the-quillbot-paraphraser-and-how-do-i-use-them).

### 20. Hugging Face / HuggingChat — modelos abiertos
1. Identidad del modelo visible.
2. Selección automática o manual si el producto puede respaldarla.
3. Descubrimiento de modelos y comunidad conectado al uso.
4. Proveniencia vía model card y metadatos útiles.
5. Modo experto sin sacrificar un inicio simple.
**Aplicación Isabella:** se conserva el routing auto existente y no se muestra selector hasta tener inventario validado de proveedores/modelos, políticas, costes y disponibilidad. [HuggingChat](https://huggingface.co/chat/).

## 4. Unificación de patrones: 100 ideas, ocho componentes

Las 100 características se solapan y no deben convertirse en 100 botones ni en 20 clones de marca. Se agrupan en piezas coherentes:

| Componente | Patrones unificados | Implementación visible en esta rama |
|---|---|---|
| Navegación única | Destinos por tarea, estados de navegación, responsive, foco accesible | Una navbar para Conversar, Studio, Herramientas, Skills, Ecosistema y Gobernanza; se eliminan los dos raíles |
| Command Center | Búsqueda de acción, descubribilidad, atajos de teclado | Diálogo nativo con búsqueda, navegación y acciones; Ctrl/Cmd+K y Escape |
| Compositor guiado | Prompt gallery, entrada principal, atajos de tarea, entrada de texto/voz/archivo | Chips para investigar, redactar, analizar, código y planificar |
| Acciones por respuesta | Copiar, guardar, escuchar, reutilizar | Botones vinculados a la respuesta concreta |
| Studio local | Biblioteca de objetos, recuperar, preview y exportación | Hasta 30 respuestas guardadas en el navegador, con copiar/descargar/eliminar |
| Sesión y salida | Nuevo chat, reinicio, continuidad clara, salida portátil | Limpiar chat visible, renovar ID y descargar Markdown |
| Estado y límites honestos | Errores explícitos, estado de runtime, alcances admitidos | Indicador de salud; adjuntos acotados y límites visibles |
| Sistema visual adaptativo | Jerarquía, densidad, móvil, foco, movimiento reducido | Hero más bajo, chat prioritario, diseño responsive, paleta Obsidian/platino/azul |

## 5. Cambios funcionales realizados en la rama de trabajo

### Navegación y jerarquía
- Eliminados del HTML los dos raíles de navegación duplicados.
- Navbar única con seis destinos, acción Nuevo chat y lanzador de comandos Ctrl/Cmd+K.
- El hero es más corto; la conversación recibe prioridad de superficie.
- Reglas visuales compactas para escritorio, tablet y pantallas pequeñas; stylesheet existente, sin bibliotecas nuevas.
- Se conserva la secuencia cinemática de 12 escenas como entrada opcional/no bloqueante.

### Acciones y continuidad
- **Command Center:** abrir, buscar comandos, navegar a secciones, ejecutar exportación y reinicio, cambiar lectura por voz y cerrar.
- **Nueva sesión:** cancela síntesis pendiente, limpia el chat visible, retira adjunto y renueva el ID del cliente. No borra historial persistido en nube porque esa persistencia no existe en este flujo.
- **Exportar:** descarga la transcripción que está en el DOM como Markdown.
- **Studio:** Guardar en cada respuesta crea una tarjeta local. Permite copiar, descargar y borrar una respuesta; “Vaciar guardados” elimina el conjunto tras confirmación.
- **Voz:** añade Escuchar en cada respuesta utilizando SpeechSynthesis; la voz disponible depende del navegador.
- **Compositor:** Enter envía y Shift+Enter conserva saltos de línea; textarea autoajustable con altura máxima.
- **Prompt starters:** insertan una plantilla editable; no activan por sí solos búsqueda, automatización o herramientas externas.

### Adjuntos
Acepta archivos de texto UTF-8 con extensión TXT, Markdown, CSV, JSON o LOG. El límite actual es 25 KB y 12,000 caracteres; se leen en el navegador y el texto se agrega al prompt. No se sube el binario a un parser documental. PDF, DOCX e imágenes no son compatibles en esta versión. El backend debe seguir validando el tamaño final de la petición.

### Privacidad y exactitud
Los borradores guardados sólo viven en localStorage de ese navegador; no se sincronizan entre dispositivos ni usuarios. No se muestra un selector de modelo, buscador live con citas, generador de medios ni edición colaborativa hasta que estén conectados y probados sus servicios. La existencia de una tarjeta de producto no equivale a ejecución real.

## 6. Integraciones pendientes — no deben fingirse

- Investigación web en vivo con fuentes citables y URL verificada.
- Selector de modelos conectado a inventario real, disponibilidad, coste y políticas.
- Canvas/Artifacts editables y versionados.
- Parser de PDF/DOCX, OCR, imágenes y hojas de cálculo.
- Generación y edición de imágenes, vídeo, música y voz premium.
- Historial de conversación en nube, sincronización, colaboración y compartir.
- Conectores a Workspace/Microsoft 365, plugins, calendarios y correo.
- Persistencia PostgreSQL de Studio con aislamiento de usuario, auditoría, retención y borrado.
- Comparación de revisiones, aprobación/rechazo por fragmento y pruebas E2E cross-browser.

## 7. Validación de liberación

1. Ejecutar node --check src/ui/app.js.
2. Ejecutar node scripts/ui-smoke.mjs y comprobar los marcadores UNIFIED_WORKSPACE_COMMAND_CENTER_OK y LOCAL_STUDIO_EXPORT_ATTACHMENT_OK.
3. Ejecutar pnpm run build: assurance, TypeScript, Vitest, bundle, smoke UI, smoke runtime y suite de seguridad.
4. Inspeccionar deployment del SHA exacto de esta rama y confirmar READY más logs de cada gate. READY no demuestra por sí mismo disponibilidad de proveedores externos.
5. Validar teclado, vista a 320 px y 390 px, tablet, desktop, zoom y prefers-reduced-motion.
6. No subir el porcentaje global de readiness sólo por un rediseño. El README conserva su estimación actual hasta contar con evidencia suficiente de pruebas e integración.

## 8. Referencias

- [Ranking de herramientas IA por visitas web, actualizado el 9 de octubre de 2026](https://explodingtopics.com/blog/most-popular-ai-tools).
- [ChatGPT — capacidades](https://help.openai.com/en/articles/9260256-chatgpt-capabilities-overview).
- [Gemini — Canvas](https://gemini.google/es/overview/canvas/?hl=es) y [Deep Research](https://gemini.google/es/overview/deep-research/?hl=es).
- [Claude — Artifacts](https://support.claude.com/en/articles/17153992-what-are-artifacts-and-how-do-i-use-them) y [Claude Design](https://claude.com/resources/articles/claude-design-stays-on-brand-for-daily-work).
- [Canva — Magic Studio](https://www.canva.com/newsroom/news/magic-studio/) y [Canva AI 2.0](https://www.canva.com/newsroom/news/canva-create-2026-ai/).
- [DeepSeek](https://www.deepseek.com/news/deepseek-app/); [Grok](https://grok.com/); [Character.AI](https://character.ai/); [DeepL](https://www.deepl.com/translator).
- [Perplexity — Spaces](https://www.perplexity.ai/help-center/es/articles/10352961-que-son-los-espacios); [Copilot Pages](https://support.microsoft.com/es-ES/microsoft-copilot/using-copilot-pages).
- [Suno — Song Editor](https://help.suno.com/en/articles/6141505); [CapCut — AI Video Editor](https://www.capcut.com/tools/auto-video-editor); [NotebookLM](https://blog.google/innovation-and-ai/models-and-research/google-labs/notebooklm-new-features-december-2024); [Remove.bg](https://www.remove.bg/).
- [ElevenLabs — timeline](https://elevenlabs.io/docs/help-center/product/studio/studio/what-is-the-timeline-in-studio); [Google AI Studio](https://ai.google.dev/aistudio?hl=es).
- [Lovable — Visual Edits](https://lovable.dev/blog/introducing-visual-edits) y [Drafts](https://lovable.dev/blog/introducing-drafts).
- [Grammarly — Strategic Suggestions](https://support.grammarly.com/hc/en-us/articles/25351804320397-introducing-strategic-suggestions); [QuillBot — Modes](https://help.quillbot.com/hc/en-us/articles/35854318883351-What-are-modes-in-the-quillbot-paraphraser-and-how-do-i-use-them); [HuggingChat](https://huggingface.co/chat/).

---
**Conclusión de ingeniería:** la UI abandona la acumulación de paneles y sitúa la conversación en primer plano. Unifica navegación y comandos, incorpora acciones de salida y recuperación de respuestas, y declara los límites del navegador y del backend. Investigación live, artefactos avanzados, sincronización, modelos y medios sólo se habilitarán cuando existan integraciones probadas.


## Origen: `docs/audits/ANALISIS-OPERATIVO-TOTAL-2026-10-24.md`

---
state: draft
authorship: engine-generated
human_approval: pending
date: 2026-10-24
---

# Análisis de archivos, datos y funciones de Isabella

**Conclusión: no existe evidencia de que todos los archivos, datos y funciones estén operativos dentro de Isabella.** El runtime principal responde y su suite local pasa, pero hay código fuera de sus entradas, importaciones sin resolver en áreas inactivas, contratos declarativos y dependencias degradadas. Incorporar archivos o mencionar capacidades no demuestra ejecución, autorización, persistencia ni disponibilidad de producción.

## Alcance y método

Se inventariaron 1.776 archivos ordinarios del árbol de trabajo con tamaño y SHA-256. El análisis localizó 1.135 archivos TypeScript/JavaScript en src, 6.863 declaraciones de funciones/métodos en src y 231 registros literales de rutas, 226 en archivos alcanzables por importación. El grafo del servidor contiene 339 archivos y las entradas JavaScript del navegador aportan otros dos. Son recuentos estáticos: no acreditan ejecución de cada símbolo o registro. Se excluyeron dependencias instaladas, metadatos de Git, archivos de entorno y credenciales, artefactos compilados y carpetas internas generadas. Se analizaron por separado los siete adjuntos de esta sesión mediante metadatos y referencias explícitas a rutas; no se publicaron sus contenidos ni se ingirieron en memoria operativa.

El inventario JSON asociado contiene una fila por archivo, declaraciones de funciones y métodos TypeScript/JavaScript con ubicación, importaciones relativas sin resolver y registros de rutas HTTP literales. El grafo parte de src/server.ts, la función Netlify y los dos scripts que la interfaz HTML carga. Excluye aristas exclusivamente de tipos y considera posibles las importaciones dinámicas literales y condicionales. Un módulo alcanzable por importación puede contener funciones que nunca se llaman: el inventario no las declara ejecutadas.

Las comprobaciones HTTP invocaron localmente el adaptador Netlify con solicitudes GET sin credenciales. No se llamó a endpoints de mutación, no se configuraron proveedores ni se desplegó. Estos resultados describen el entorno local de esta revisión, no la instalación publicada. No se ejecutaron compilaciones.

## Hallazgos principales

| Hallazgo | Evidencia observada | Implicación |
| --- | --- | --- |
| Runtime principal accesible, dependencias incompletas | / y /health respondieron 200; /api/v1/healthz respondió 503 | El servidor está vivo, pero no todas sus dependencias están disponibles. |
| Código sin camino de importación desde las entradas actuales | 795 archivos de código de src; 514 en src/lib y 167 en src/components | Existen bibliotecas, interfaces alternativas y posibles duplicados que no quedan integrados automáticamente en la interfaz o servidor actuales. También hay CLI y archivos de tipos que legítimamente tienen otras entradas. |
| Importaciones relativas sin resolver | 115 en el conjunto analizado; ninguna en los archivos del grafo principal | El runtime principal no presenta ese bloqueo estático; las áreas inactivas sí necesitan revisión. El total incluye referencias a dist generado, no solamente archivos fuente faltantes. |
| Comprobación de tipos ampliada fallida | 21.932 diagnósticos en 269 archivos al retirar exclusiones | 21.624 diagnósticos corresponden a componentes React; predominan JSX no habilitado, tipado JSX y dependencias ausentes. No representan 21.932 defectos independientes. El typecheck habitual no certifica estas áreas. |
| Código duplicado literalmente | 220 grupos de código con SHA-256 idéntico, 440 archivos | Hay deuda de mantenimiento y versiones paralelas. No se borraron archivos: igualdad de bytes no garantiza equivalencia de resolución de imports. |
| Módulo alternativo de salud sin cargar | Cinco registros de rutas en src/routes/health.ts sin camino desde las entradas | /health existe mediante otra implementación; /healthz, /readyz, /status y /metrics respondieron 404. No deben confundirse con /api/v1/healthz y /api/v1/readyz. |
| Catálogo de plataforma desalineado | El endpoint declara count:30 y una referencia textual a un archivo; PLATFORM_GIFTS contiene 32 entradas | Ese endpoint no enumera ni comprueba las 32 funciones. Además, varias etiquetas “sin cablear” del catálogo están desactualizadas frente a módulos que el servidor sí instancia. |
| Los 7.000 controles son principalmente declarativos | generateControls produjo 6.996 declared, 3 wired, 1 blocked y 0 verified | Son estados generados desde un catálogo y overrides, no 7.000 comprobaciones operativas ni aprobaciones humanas. No se cambiaron estos estados. |
| Persistencia y autoridad de firma degradadas | La salud profunda informó bookpi-ledger y signing-authority degradados como dependencias requeridas | No hay evidencia local de continuidad durable del ledger ni de autoridad de firma disponible. |
| Funciones administrativas inaccesibles en este entorno | Integrations graph y platform capabilities respondieron 503 sin credenciales | Se preservó el control de acceso; no se introdujeron tokens, identidades ficticias ni bypasses para obtener una respuesta favorable. |
| Servicio financiero no disponible operativamente | /api/v1/revenue/health respondió 503/degraded | Código de cálculo o contabilidad no acredita cobros, retiros o conciliación reales. |

## Qué existe y qué no se ha demostrado

| Subsistema | Existencia y conexión observadas | Límite operativo |
| --- | --- | --- |
| Interfaz actual | HTML y scripts app.js/chat-plus.js servidos por el runtime; GET / respondió 200 | Los componentes React de src/components no forman parte automáticamente de esta interfaz. |
| GAME OVER / UAGP | Módulos TypeScript importados por el servidor, rutas y pruebas existentes | El plugin Jenkins es un proyecto Java separado; no se ejecutó Jenkins ni se certificó un circuito de aprobación empresarial. |
| MAGPIE-X | MagpieBus instanciado por Genesis; publicación y suscripción locales con pruebas | Su contrato indica memoria de proceso; no demuestra una red federada durable, transporte distribuido ni entrega exactamente una vez. |
| YUN | Ruta de lectura respondió 200 con cero eventos; validación y hashing existen | No hay eventos de negocio observados en este proceso ni evidencia de federación externa. Un hash valida contenido, no veracidad. |
| ISA-X | Archivos de firma, claves, revocación y challenge alcanzables a través de imports y cubiertos por pruebas | Esto no demuestra que cada ruta HTTP exija ISA-X. La documentación declara bloqueados proveedores poscuánticos/HSM; no se certificó ML-DSA/ML-KEM productivo. |
| BookPI / Atlas / IKES | Adaptadores y estructuras implementados | La existencia de tablas SQL, constructores o imports no demuestra migraciones aplicadas, ingesta completa ni almacenamiento remoto saludable. |
| Modelos e inferencia | Enrutadores y proveedores implementados; la salud devuelve un modo de inferencia | No se realizó una inferencia real con cada proveedor/modelo; faltan evidencias de cuotas, conectividad, calidad y costes. |
| Rust, Python y Java | Archivos y subproyectos inventariados | No se construyeron ni probaron estos runtimes en esta revisión. Su presencia no los incorpora al proceso Node ni al despliegue Netlify. |

## Datos, documentos y adjuntos

Los JSON inventariados resultaron sintácticamente válidos. No se concluye de ello que sus registros sean correctos, actuales, autorizados, persistentes o consultados por Isabella. El catálogo src/authz-runtime/authz-runtime/catalog.json no tiene un camino de importación runtime desde las entradas consideradas. Los SQL son instrucciones de migración: inventariarlos no los ejecuta.

Se analizaron metadatos y referencias explícitas de los siete adjuntos. El documento sobre el plugin GAME OVER contiene 24 rutas explícitas de código; 21 tienen un archivo correspondiente al resolver también la raíz del subproyecto Java. El documento MAGPIE-X contiene 187 rutas explícitas y 48 se resolvieron en el árbol actual. Las otras referencias pueden ser propuestas, nombres históricos o rutas no incorporadas; no se declararon defectos automáticamente. Los otros cinco documentos no aportaron rutas detectables mediante ese patrón, lo cual no significa ausencia de requisitos ni implementación completa.

La comparación de rutas es una comprobación léxica, no una validación semántica exhaustiva de los documentos. No existe en esta revisión una matriz humana aprobada que enlace cada requisito de esos documentos con una función ejecutada, un dataset admitido, una prueba y una aprobación. Los documentos de especificación no se trataron como datos ya aprendidos o memoria verificada. Las cifras de rendimiento o superioridad declaradas en referencias tampoco se convirtieron en hechos observados.

## Pruebas, evidencia y reproducción

La suite actual volvió a aprobar **1.704 pruebas en 289 archivos**. Esto demuestra los casos automatizados existentes, no el comportamiento de todos los archivos. La comprobación de tipos ampliada fue adicional y deliberadamente más amplia que el gate habitual; su fallo se conservó como hallazgo.

Se añadieron herramientas diagnósticas reproducibles que escriben solo metadatos y evidencia filtrada:

- node scripts/operational-inventory.mjs: inventario, hashes, símbolos, rutas e importaciones.
- pnpm exec tsx scripts/operational-probe.ts: sondeos GET locales y resumen del catálogo. Importa el runtime existente y finaliza después de registrar sus resultados.
- node scripts/operational-typecheck.mjs: typecheck sin exclusiones en configuración temporal, sin emitir código. Devuelve error cuando TypeScript falla y elimina la configuración temporal.

Los resultados detallados son INVENTARIO-OPERATIVO-2026-10-24.json, SONDEO-OPERATIVO-2026-10-24.json, TYPECHECK-COMPLETO-2026-10-24.json y REFERENCIAS-ADJUNTAS-2026-10-24.json. El inventario no incluye su propio JSON de salida. Las funciones se contabilizan como declaraciones, métodos y funciones asignadas a variables; no equivale a una enumeración de todas las invocaciones o callbacks anónimos.

## Acciones necesarias para afirmar integración completa

1. Definir y aprobar qué bibliotecas, componentes y requisitos pertenecen a la versión desplegable. Resolver versiones paralelas antes de conectarlas; no todo archivo auxiliar debe convertirse en una ruta pública.
2. Vincular cada requisito de los documentos con código, contrato, prueba reproducible, fuente de datos y autoridad humana. Mantener separados declared, implemented, tested y human-approved.
3. Corregir o retirar explícitamente las dependencias y rutas de importación del frontend alternativo; decidir su integración con la interfaz HTML actual antes de activar JSX o añadir dependencias indiscriminadamente.
4. Alinear el catálogo de plataforma con instancias y rutas reales; sustituir referencias textuales y cifras fijas por resultados comprobables, manteniendo separadas disponibilidad y autorización.
5. Validar migraciones, persistencia, identidades, firmas, modelos y flujos financieros en sus entornos reales. Registrar evidencia humana antes de promover capacidades a verified o wired.
6. Verificar la instalación desplegada y los subproyectos separados. Resolver también la deuda de formato global documentada en la auditoría anterior.

Esta revisión produjo evidencia y herramientas de análisis. No modificó la autorización, no conectó automáticamente código inactivo, no ingirió documentos como conocimiento verificado y no promovió capacidades. Permanece en estado draft hasta revisión humana.


## Origen: `docs/audits/AUDIT-2026-10-17.md`

# Auditoría 2026-10-17 — latencia, huérfanos, flujo de datos

state: engine-generated · método: escaneo estático + pruebas locales (shim vitest) + capturas Playwright. No sustituye `pnpm test`/CI.

| ID | Hallazgo | Estado |
|---|---|---|
| AUD-13 | Cadena de proveedores secuencial (keyless → gateway → OpenRouter → hasta 5 modelos HF → compatibles), cada intento con su timeout completo: un respuesta podía tardar >1 min antes del fallback local. | Corregido: `DeadlineBudget` (tope total) |
| AUD-13b | En modo Auto el respaldo esperaba a que el primero fallara del todo. | Corregido: `hedgedFirst` (solo proveedores gratuitos) |
| AUD-13c | Reintento tardío de keyless tras la cadena (llamada duplicada). | Eliminado |
| AUD-14 | El selector de lente existía en el servidor (4 lentes) pero la UI enviaba siempre `focusLens: "general"`: ruta sin flujo de datos. | Corregido (selector → API) |
| AUD-15 | La UI no tenía superficie de planes aunque existían `/api/v1/billing/{plans,prices}`; el ahorro anual no se mostraba. | Corregido (catálogo + sección Planes) |
| AUD-16 | README y `ESTADO-REAL-ACTUAL.md` publicaban cifras de readiness contradictorias (61.0 % vs 46.25 %). | Corregido + prueba de consistencia |
| AUD-17 | TTS del servidor usaba por defecto un modelo inglés para texto español; la UI solo usaba SpeechSynthesis del navegador. | Corregido en esta rama: UI prueba `/api/v1/cognition/speech` y cae al TTS local; el servidor ya no asume un modelo inglés. Pendiente: configurar y probar un modelo multilingüe apropiado en el entorno real. |
| AUD-18 | Módulos sin importador desde `src/` (solo pruebas): cognition/genesis-chunk, companion/*, deployment/{canary,production-smoke}, governance/incident, inference/adapters, platform/index, privacy/{crypto-shred,differential-privacy}, security/key-hierarchy. | **Abierto, por diseño**: capacidades biblioteca sin cablear; no presentar como funciones en ejecución (CAPABILITY ≠ EXECUTION) |
| AUD-19 | `src/cli/*` aparecen huérfanos pero se invocan desde `package.json` (`reconcile:pids`, `bookpi:maintenance`). | Falso positivo |

Límites: Node 22 y sin acceso a npm/GitHub desde el sandbox; 1502 pruebas pasan bajo el shim, con 15 archivos sin cargar (`pg`/`express` ausentes) y 4 fallos del shim (`mockResolvedValueOnce`), todos ajenos a estos cambios.


## Origen: `docs/audits/AUDITORIA-NETLIFY-2026-10-24.md`

---
state: draft
authoring: engine-generated
human_approval: pending
date: 2026-10-24
---

# Auditoría del runtime y compatibilidad con Netlify

La intención del cambio fue localizar y corregir fallos reproducibles del runtime principal, sus pruebas, configuración y despliegue en Netlify. Este informe registra evidencia computacional; no constituye aprobación humana, certificación de seguridad ni autorización de producción. No se cambiaron estados de capacidad a `verified` o `wired` ni se modificó el historial BookPI.

## Hallazgos corregidos

| Hallazgo observado | Corrección |
| --- | --- |
| TypeScript y Vitest no resolvían el import de sovereign-core-confidence | Se corrigió la ruta relativa de la prueba al módulo existente. |
| El entrenamiento de regresión podía producir pesos y sesgo infinitos | Se rechazó el estado numérico no finito en cada actualización, antes de generar un artefacto. |
| DEEPSEEK_MODEL se utilizaba sin documentarse | Se añadió su valor predeterminado público al ejemplo de configuración. |
| Una prueba exigía publicar un avance del 100% y un SHA histórico | Se alineó la prueba con el README y el principio canónico de no atribuir porcentajes sin denominador reproducible. |
| No existía configuración de despliegue ni adaptador para Netlify | Se añadió una función compatible con Request/Response y el empaquetado de los archivos de interfaz. El servidor abre un puerto únicamente cuando se ejecuta como entrada directa. |
| Servir vídeos grandes desde una función excedería límites de respuesta | Se añadió preparación de medios estáticos para el CDN durante el despliegue, conservando sus URLs. |
| La auditoría inicial de dependencias informó 53 avisos: 6 altos, 42 moderados y 5 bajos | Se fijaron versiones corregidas de Hono, su adaptador Node, lodash, valibot, body-parser, undici y fast-uri. La auditoría final informó cero avisos. |

El adaptador preserva métodos HTTP, parámetros repetidos, bytes de cuerpos, cabeceras múltiples, respuestas comprimidas y respuestas sin cuerpo. Limita la lectura de solicitudes a 256 KiB antes de invocar Express y utiliza la IP del contexto de Netlify para el adaptador HTTP. Los vídeos se sirven desde archivos estáticos para conservar soporte de rangos sin depender del límite de una función.

## Evidencia y alcance

La suite final aprobó 1.704 pruebas en 289 archivos. Se ejecutaron la suite completa Vitest, typecheck principal y por capas, ESLint, el smoke estático de interfaz, las comprobaciones de entorno y SOPS y la suite de invariantes de seguridad. Se añadió cobertura del adaptador para HTML, JavaScript, salud HTTP, JSON inválido, HEAD, ETag/304, compresión gzip y tamaño máximo de solicitudes. La instalación final con lockfile congelado terminó correctamente. Las versiones corregidas no eliminaron las advertencias de peers de las herramientas opcionales de Prisma.

La comprobación estructural inicial pasó 44 de 44 controles; es una comprobación estática y no prueba conectividad. La suite de seguridad estática pasó 14 invariantes y no equivale a un pentest. `pnpm audit` final devolvió cero vulnerabilidades conocidas por el registro consultado en esta fecha; no garantiza ausencia de vulnerabilidades desconocidas.

## Bloqueos y limitaciones pendientes

1. El preflight evaluado con NODE_ENV=production en este entorno devolvió FAIL por ausencia de GENESIS_ADMIN_API_TOKEN. También informó ausencia de APP_PUBLIC_URL y evidencia BookPI volátil. No se generaron credenciales ni se desactivaron controles para ocultar estos fallos. Esta observación describe el entorno de trabajo, no una inspección de valores privados del runtime publicado.
2. `pnpm format:check` falló en 1.134 archivos preexistentes. Se conservó el gate. La normalización masiva de archivos ajenos al cambio quedó pendiente: numerosas pruebas estructurales comparan texto fuente literal y necesitan una revisión conjunta al normalizar formato. Los nuevos módulos y pruebas se formatearon con la configuración vigente.
3. No se ejecutaron compilaciones ni se realizó un despliegue de producción durante esta auditoría. La validación de compilación corresponde al proceso de despliegue. El nuevo empaquetado de medios y la función requieren una comprobación HTTP sobre el deploy resultante.
4. No se ejecutaron migraciones ni pruebas de servicios externos reales: PostgreSQL, Supabase Auth, Stripe, proveedores de IA, síntesis de voz, GPU, IGE-OMEGA y otros servicios opcionales. Tener código o variables declaradas no demuestra conectividad, pago, inferencia ni persistencia durable. Las pruebas locales pueden emplear dobles de prueba.
5. El alcance ejecutado fue el runtime TypeScript y sus comprobaciones existentes. No se certificaron los subproyectos Rust, Java/Jenkins, Python, los componentes React excluidos ni todas las bibliotecas importadas históricamente en src/lib. Se conservan las exclusiones de TypeScript documentadas en docs/STATUS.md.
6. Los retiros financieros, KYC, fiscalidad y conciliación siguen pendientes según el README canónico. No se sustituyeron por simulaciones ni se presentó el devengo como transferencia bancaria.

## Supuestos, compensaciones y divergencias

Se conservó Express y los proveedores ya integrados. El adaptador utiliza serverless-http como puente de bytes HTTP y añade una dependencia de runtime. Sus respuestas son almacenadas temporalmente en memoria por el adaptador; la transmisión de respuestas largas en streaming no está certificada. La persistencia en memoria y los límites de proveedores conservan sus restricciones previas.

La exigencia obsoleta del test de publicar “100%” se registró como divergencia entre prueba y documentación. Se priorizó la documentación canónica y se eliminó la exigencia de una cifra no sustentada; el cambio permanece en borrador para revisión humana. No hay evidencia que permita declarar el proyecto 100% funcional o listo para producción financiera.


## Origen: `docs/audits/CHECKLIST-2026-10-19.md`

---
state: draft
date: 2026-10-19
---
# Checklist de correcciones — Isabella V6 (auditoría 2026-10-19)

Pensado para entregarlo a otra IA. Cada ítem: **qué**, **dónde**, **cómo verificar**. Prioridad P0 (bloquea) → P3 (pulido).
Base: `main` @ commit 70361de. Honestidad: las pruebas de este checklist se hicieron en un sandbox sin `pg`/`express`/red npm, así que **ningún `pnpm test` completo se ha corrido aquí**; el primer paso es correrlo en CI/local.

## P0 — Rompe la compuerta de build
- [ ] **`scripts/ui-smoke.mjs` falla en `main`**: `AssertionError: Intro scenes must be distributed over the actual media duration` (línea ~93). Causa: el rewrite upstream de `src/ui/app.js` eliminó la lógica del video intro (`introVideo.currentTime * 1000`, `renderIntroFrame`, `scene.inert`, `introTotalMs`…) pero el smoke sigue exigiendo esas cadenas. `pnpm build` ejecuta este script → el build falla. Decidir: restaurar la lógica del intro en app.js **o** actualizar los guards. Verificar: `node scripts/ui-smoke.mjs` imprime OK completo.
- [ ] **Correr `pnpm install && pnpm typecheck && pnpm test && pnpm build` en limpio** y arreglar lo que salga. Nunca se ha visto verde de punta a punta en esta sesión (faltan `pg`, `express` en el sandbox; ~16 archivos de test no cargaron).
- [ ] **CI nunca confirmado verde**: revisar `.github/workflows/{ci,repository-assurance,ige-omega-ci,beta-live-model-gate,deploy-production,atlas-ingest}.yml` en GitHub Actions; corregir los rojos. Activar *branch protection* en `main` (checks requeridos) — hoy bots y humanos empujan directo y se pisan.
- [ ] **Dependabot**: GitHub avisa de alertas abiertas en el push. Revisar en Security → Dependabot y actualizar `pnpm-lock.yaml`.

## P0 — Producción (readiness real 61 %, ver `docs/ESTADO-REAL-ACTUAL.md`)
- [ ] `BOOKPI_INTEGRITY_SECRET` debe estar definido en el entorno desplegado (está vacío en `.env.example`); sin él el ledger no es verificable.
- [ ] **Ledger BookPI volátil** (en memoria): persistir en Postgres/Supabase (append-only) y probar recuperación tras reinicio.
- [ ] Endpoints Atlas/IKES devuelven 404 en el despliegue: desplegar o retirar de la UI/README.
- [ ] Sin OTLP/alertas ni rollback documentado y probado (`deploy/`, `k8s/`, `docs/ops`).
- [ ] Sin smoke contra proveedores de inferencia reales: ejecutar `pnpm smoke:production` / `verify:production` con claves reales y registrar latencias medidas (hoy no hay números reales).

## P1 — Monetización
- [ ] `POST /api/v1/billing/checkout` (src/server.ts ~2939) está protegido por token admin → el botón de planes de la UI **no puede completar una compra** un usuario normal. Diseñar flujo público autenticado por usuario/workspace.
- [ ] Verificar de extremo a extremo con Stripe en modo test: checkout → webhook (`STRIPE_WEBHOOK_SECRET`) → entitlement → límites por plan. Nada de esto se ha probado contra Stripe.
- [ ] Precios en `src/commerce/catalog.ts` (premium 1900/19000, vip 7900/79000 centavos) deben coincidir con los Price IDs reales de Stripe.

## P1 — TTS / voz
- [ ] **Dos rutas de voz paralelas**: la UI usa `/api/v1/cognition/speech` (`speakMessage` en `src/ui/app.js`); el motor nuevo `src/tts/*` + `src/routes/tts.ts` (`/api/v1/tts/{status,plan,synthesize}`) **no está conectado a la UI** (mi integración se perdió en el conflicto con el rewrite upstream). Conectar: en `speakMessage` pedir `/api/v1/tts/synthesize`, caer a `/cognition/speech`, y a `speechSynthesis` como último recurso; añadir comando `/pronuncia` (MemoryVoiceCore) y ajustar `scripts/ui-smoke.mjs`.
- [ ] **No existe audio neural**: sin servicio nativo (`GENESIS_TTS_URL`, contrato `GET /v1/status`, `POST /v1/synthesize → {audio_base64, audio_mime}`) el resultado es `client-plan` (prosodia + voz del navegador). La parte neural de la spec es solo documento; hay que construir/alojar ese servicio.
- [ ] AUD-17: modelo TTS del servidor por defecto vacío/inglés → es‑MX suena mal; fijar modelo/voz y probar con audio real.
- [ ] **Duplicados sin referencia**: `src/voice/emotion.ts` y `src/voice/normalize-esmx.ts` (no rastreados por mí; duplican `src/tts/*`). Borrar o fusionar.
- [ ] La voz de referencia no es clonación (perfil sintético F0 ≈ 205 Hz); no prometerlo en README.
- [ ] La especificación TTS es propiedad de TAMV: no está en el repo; mantenerla fuera.

## P1 — UI
- [ ] Churn upstream: bot v0 y humanos reescriben `app.js`, `chat-plus.js`, `index.html`, README en paralelo → conflictos constantes. Acordar un solo dueño por archivo o ramas/PR.
- [ ] `scripts/ui-smoke.mjs` está acoplado a cadenas literales: migrar a pruebas Playwright reales (chromium ya disponible) para intro, navbar móvil, chat, voz.
- [ ] Sin pruebas E2E reales de: video intro (fluidez), móvil, consentimiento `#immersionConsent`, envío de mensaje con proveedor real.
- [ ] `src/ui/chat-plus.js` está minificado/ilegible a mano; mantener fuente legible + build.

## P2 — Código / arquitectura
- [ ] `src/server.ts` ≈ 3850 líneas: seguir extrayendo grupos `register*Routes` (patrón de `src/routes/tts.ts`). Cada bloque debe contener literal `authorizeAdmin`/`authorizeApiToken` (`test/security/route-gate-wiring.test.ts`).
- [ ] **AUD-18 módulos sin cablear** (código que existe pero ningún runtime usa): `cognition/genesis-chunk`, `companion/*`, `deployment/{canary,production-smoke}`, `governance/incident`, `inference/adapters`, `platform/index`, `privacy/{crypto-shred,differential-privacy}`, `security/key-hierarchy`. Cablear o mover a `docs/archive`. Regla AGENTS.md: un test verde ≠ facultad.
- [ ] Reglas AGENTS.md: 0 `any` en `src` (verificado: solo aparece en comentario), sin `@ts-ignore`; 7 `console.log` en `src` → pasar a logger estructurado; sin TODO sin dueño (ninguno encontrado). Mantener.
- [ ] Marcadores `stub/placeholder/mock` en `src/server.ts`, `health/preflight.ts`, `governance/quality-gates.ts`, `security/post-quantum.ts`, `security/isa-x/protocol.ts`: revisar que no se presenten como capacidad real (post-quantum e ISA‑X en particular).
- [ ] Coherencia documental: README ↔ `docs/ESTADO-REAL-ACTUAL.md` deben decir lo mismo (61.0 %; hay test `readiness-consistency`). Cada reescritura upstream de README debe conservarlo.

## P2 — Contratos y guardas (mantener en verde al agregar rutas)
- [ ] Al añadir ruta: actualizar `test/deployment/route-inventory.json`, `docs/api/route-inventory.json` (`node scripts/route-inventory.mjs`), `docs/api/openapi.yaml`, y documentar cada variable nueva en `.env.example`.

## P3 — Tests / entorno
- [ ] El shim local no soporta `mockResolvedValueOnce`/`useRealTimers`: fallos falsos en `ige-omega` gateway-probe, `ikes-supabase`, cache de inferencia. Confirmar que pasan con vitest real.
- [ ] Añadir pruebas de carga/latencia (hedging, `DeadlineBudget`, `providerTimeoutMs` 8 s) contra proveedores reales; hoy solo hay pruebas unitarias.
- [ ] Re-verificar seguridad: rutas públicas, rate limits, throttle de auth (`pnpm security:suite` daba 14/14 antes del último rebase; volver a correr).

## Orden sugerido para la otra IA
1. `pnpm install && pnpm typecheck && pnpm test` → lista real de fallos.
2. Arreglar `ui-smoke` (P0).
3. Conectar UI ↔ `/api/v1/tts/*`.
4. Checkout público + prueba Stripe test.
5. Persistencia del ledger + secretos en el despliegue.
6. Branch protection + CI verde.


## Origen: `docs/audits/CHECKLIST-V2-2026-10-19.md`

---
state: draft
date: 2026-10-19
supersedes: CHECKLIST-2026-10-19.md (se mantiene; este v2 lo amplía)
---
# Checklist v2 — Isabella V6: auditoría profunda + plan de ejecución (para otro agente)

Base: `main`. Cada ítem trae **dónde** y **cómo verificar**. Prioridad P0 → P3.
Límite honesto: el sandbox no tiene `pg`/`express`/red npm; nada de lo "verde" aquí sustituye a `pnpm install && pnpm typecheck && pnpm test && pnpm build` real.

## 0. Hechos medidos en esta pasada
- 0 archivos duplicados por hash (md5) en el repo; 0 `any`/`@ts-ignore`; 7 `console.log` en `src`.
- Módulos huérfanos (nadie los importa): `src/voice/emotion.ts`, `src/voice/normalize-esmx.ts` (duplican `src/tts/*`), `src/cli/{bookpiMaintenance,reconcilePids}.ts` (solo scripts npm; ok).
- No hay ESLint ni Prettier (`lint` = `tsc --noEmit`). `src/server.ts` = 3848 líneas.
- CSP en `src/server.ts:107` permite `script-src 'unsafe-inline'` y `style-src 'unsafe-inline'`.
- Docker: `USER 10001` correcto, sin HEALTHCHECK (documentado, distroless).
- 279 archivos de test; ~16 no cargan en sandbox (pg/express).
- Video intro committed en `src/assets/video/` (revisar peso del repo; mover a CDN/Git LFS).

## 1. P0 — Build/CI
- [ ] `scripts/ui-smoke.mjs` falla en main ("Intro scenes must be distributed…"): el rewrite upstream de `src/ui/app.js` quitó la lógica del intro (`introVideo.currentTime`, `renderIntroFrame`, `scene.inert`, `introTotalMs`). Restaurar lógica o reescribir guards (mejor: Playwright).
- [ ] Correr y arreglar `pnpm install && typecheck && test && build` limpios.
- [ ] Workflows `.github/workflows/*.yml` en verde; activar branch protection en `main` (checks requeridos, PR obligatorio para bots).
- [ ] Dependabot: resolver alertas; fijar versiones.

## 2. P0 — Producción (readiness real 61 %)
- [ ] `BOOKPI_INTEGRITY_SECRET` en el entorno desplegado; ledger BookPI persistente (Postgres append-only) + prueba de recuperación.
- [ ] Atlas/IKES 404 → desplegar o retirar de UI/README.
- [ ] OTLP + alertas + rollback documentado y ensayado (`deploy/`, `k8s/`).
- [ ] Smoke real contra proveedores de inferencia y latencias medidas (`pnpm smoke:production`, `verify:production`).

## 3. P0/P1 — Monetización 70 % usuarios / 30 % plataforma (REGLA)
Regla de negocio acordada por el dueño:
1. El pool repartible de un periodo = ingreso **neto confirmado** (cobrado, menos reembolsos/contracargos/comisión del procesador/impuestos).
2. **70 %** va a los usuarios elegibles, **30 %** a la plataforma.
3. **Elegible = usuario con plan de pago activo (premium/vip/enterprise) con Isabella.** Usuarios `free` **no** tienen derecho a monetización (cero reparto, aunque generen actividad).
4. El 70 % se prorratea entre elegibles por puntos de contribución (definir métrica auditable, sin granularidad que permita fraude).
Implementación (checklist):
- [ ] `src/commerce/revenue-share.ts`: función pura determinista `computeRevenueShare` (enteros en centavos, sin pérdida de centavos: el resto va a plataforma) + tests. (Esta sesión lo implementa si alcanza; verificar en `git log`.)
- [ ] Guardia en `src/commerce/entitlements.ts`: `canEarn(plan, subscriptionStatus)` — solo planes de pago `active`/`trialing` sin impago.
- [ ] Persistir `revenue_share_runs` y `revenue_share_lines` (migración Supabase en `supabase/`), append-only + sello BookPI por corrida.
- [ ] Retención/holdback (p. ej. 30 días) para absorber reembolsos y contracargos; clawback si hay fraude (`src/commerce/anti-fraud.ts`).
- [ ] **Pago real**: Stripe Connect (cuentas conectadas, KYC), umbral mínimo de pago, moneda MXN, comprobante CFDI/retenciones ISR-IVA según régimen del usuario. Esto requiere decisión legal/fiscal; no está implementado ni probado.
- [ ] Rutas: `GET /api/v1/commerce/earnings` (usuario autenticado, solo lo suyo) y `POST /api/v1/commerce/revenue-share/run` (admin). Agregar a inventario de rutas, OpenAPI y env doc.
- [ ] Checkout público: `POST /api/v1/billing/checkout` (src/server.ts ~2939) hoy exige token admin; un usuario normal no puede pagar. Autenticar por usuario/workspace.
- [ ] Prueba E2E Stripe modo test: checkout → webhook → entitlement → elegibilidad → corrida de reparto.
- [ ] Precios `src/commerce/catalog.ts` ↔ Price IDs reales de Stripe.
- [ ] Términos/UI: explicar claramente que solo planes de pago participan; evitar promesas de ingreso garantizado.

## 4. P1 — Sistemas "turbo" (rapidez por proceso)
Ya existen: `DeadlineBudget`, `hedgedFirst`, cooldowns, `turbo-planner`. Pendiente de medir y ampliar:
- [ ] Caché semántica/exacta de respuestas (LRU con TTL, clave = hash de prompt normalizado + lente) con invalidación por plan.
- [ ] Streaming SSE de tokens al chat (primer byte < 400 ms) + cancelación por `AbortController`.
- [ ] Precalentamiento (warm) de conexiones a proveedores y pool keep-alive HTTP/2.
- [ ] Compresión (br/gzip) y `Cache-Control` inmutable con hash para `src/ui/*`; `preload` de fuentes y poster del video.
- [ ] Video intro: servir `IntroVideoIsabella-web.mp4` con `Range`, `preload="metadata"`, poster y lazy en móvil; sacar el original de 23 MB del bundle (la versión web pesa 8.8 MB).
- [ ] Batching/deduplicación de llamadas idénticas concurrentes (single-flight).
- [ ] Presupuesto por etapa y métricas p50/p95 en `/metrics`; alerta si p95 > objetivo.
- [ ] Prueba de carga (k6/autocannon) con resultados guardados en `docs/ops`.

## 5. P1 — Endurecimiento / sanitización
- [ ] CSP: quitar `'unsafe-inline'` de scripts (nonces/hashes); añadir `object-src 'none'`, `Permissions-Policy`, `Referrer-Policy`, `Cross-Origin-Opener-Policy`.
- [ ] Revisar el único uso de `innerHTML` en `src/ui/chat-plus.js` (sanitizar o reemplazar por nodos DOM).
- [ ] Comparaciones de token con `timingSafeEqual` en TODAS las rutas admin (29 usos existen; auditar las que faltan).
- [ ] Rate limit + throttle de auth en rutas públicas nuevas (`/api/v1/tts/*`, billing, earnings).
- [ ] Añadir ESLint (`@typescript-eslint`, `no-explicit-any`, `no-floating-promises`) y Prettier; gate en CI.
- [ ] `console.log` → logger estructurado con redacción de PII (`src/privacy/pii-redactor.ts`).
- [ ] `pnpm audit`/OSV en CI; SBOM; escaneo de secretos (gitleaks).
- [ ] Revisar marcadores stub/mock en `health/preflight.ts`, `governance/quality-gates.ts`, `security/post-quantum.ts`, `security/isa-x/protocol.ts`: no presentarlos como capacidad real.

## 6. P1 — Deduplicación / limpieza
- [ ] Borrar o fusionar `src/voice/emotion.ts` y `src/voice/normalize-esmx.ts` con `src/tts/*` (hoy duplicados sin uso).
- [ ] Dos rutas de voz: UI usa `/api/v1/cognition/speech`; `src/tts/*` + `/api/v1/tts/*` no está cableado a la UI. Unificar (fallback en cadena: tts → cognition/speech → speechSynthesis).
- [ ] AUD-18 módulos sin cablear: `cognition/genesis-chunk`, `companion/*`, `deployment/{canary,production-smoke}`, `governance/incident`, `inference/adapters`, `platform/index`, `privacy/{crypto-shred,differential-privacy}`, `security/key-hierarchy` → cablear o archivar en `docs/archive`.
- [ ] Documentación solapada (`docs/AUDIT_*`, `docs/audit/`, `docs/audits/`, `docs/archive/`): consolidar en `docs/audits/` con índice.
- [ ] Partir `src/server.ts` (3848 líneas) en `register*Routes` por dominio (patrón `src/routes/tts.ts`); cada bloque con literal `authorizeAdmin`/`authorizeApiToken` (test `route-gate-wiring`).

## 7. P1 — TTS / voz
- [ ] No hay audio neural: sin `GENESIS_TTS_URL` el resultado es `client-plan`. Construir/alojar el servicio nativo (contrato `GET /v1/status`, `POST /v1/synthesize → {audio_base64, audio_mime}`).
- [ ] AUD-17: modelo TTS del servidor vacío/inglés → fijar voz es‑MX y probar con audio real.
- [ ] `/pronuncia` y memoria de pronunciación aún sin UI.
- [ ] La spec TTS de TAMV no debe entrar al repo.

## 8. P2 — Evolución visual (elegancia/innovación)
- [ ] Sistema de diseño único (tokens: color, tipografía, espacio, radios, sombras, movimiento) en `src/ui/cinematic.css`; modo claro/oscuro/alto contraste.
- [ ] Respetar `prefers-reduced-motion`; accesibilidad AA (foco visible, contraste, aria en chat y navbars).
- [ ] Chat: streaming con cursor, bloques de código con copiar, citas/fuentes, adjuntos, atajos de teclado, paleta de comandos.
- [ ] Navbar móvil/escritorio unificada; transiciones de vista; skeletons en vez de spinners.
- [ ] Panel "Mi plan y ganancias" (solo planes de pago ven ganancias; free ve CTA a mejorar plan).
- [ ] Pruebas visuales Playwright (capturas por breakpoint) en CI.
- [ ] Acordar un solo dueño por `app.js`/`chat-plus.js`/`index.html`/README para frenar conflictos con el bot v0.

## 9. P2/P3 — Pruebas
- [ ] Shim local sin `mockResolvedValueOnce`/`useRealTimers`: validar esos tests con vitest real.
- [ ] E2E Playwright: consentimiento `#immersionConsent`, chat con proveedor real, voz, móvil, intro.
- [ ] Mantener guardas al agregar rutas: `test/deployment/route-inventory.json`, `docs/api/route-inventory.json` (`node scripts/route-inventory.mjs`), `docs/api/openapi.yaml`, `.env.example`.
- [ ] README ↔ `docs/ESTADO-REAL-ACTUAL.md` coherentes (61.0 %; test `readiness-consistency`).

## Orden sugerido
1) install/typecheck/test/build reales → 2) arreglar ui-smoke → 3) checkout público + elegibilidad + reparto 70/30 + Stripe test → 4) persistencia ledger/secretos → 5) CSP/ESLint/gitleaks → 6) streaming + caché + video optimizado → 7) UI↔TTS → 8) rediseño por tokens + Playwright → 9) limpieza de duplicados y partición de server.ts.


## Origen: `docs/audits/CHECKLIST-V3-100PCT-2026-10-19.md`

---
state: draft
date: 2026-10-19
supersedes: CHECKLIST-V2-2026-10-19.md
---
# Checklist v3 — camino al 100 % (auditoría robusta, con evidencia)

Cada ítem: **ID · sev · qué · evidencia/dónde · criterio de cierre**. Sev: C=crítico, H=alto, M=medio, L=bajo.
Límite honesto: el sandbox de auditoría no tiene `pg`/`express`/red npm ni decodifica H.264; nada de lo medido aquí reemplaza `pnpm install && typecheck && test && build` en CI real.
Correcciones a v2: (a) `innerHTML` en `chat-plus.js` solo aparece en un comentario, no hay uso real; (b) el video intro pesa 23 MB (original) / 8.8 MB (web).

## A. Veracidad del estado (sesgos e inconsistencias)
- **A1·C** README afirma "Avance global 78 %" y "pnpm test 1659/1659 ✓, build verde al SHA 30f5dac" (README:11,17,27,292), mientras `docs/ESTADO-REAL-ACTUAL.md:11` dice **61.0 %** con otra rúbrica. Dos cifras públicas contradictorias. El commit 32ce336 **invirtió** el test `readiness-consistency` (antes exigía NO publicar un porcentaje no sustentado; ahora exige "78%"). Además el mensaje de commit dice 1666 tests vs 1659 en README. → Una sola cifra, derivada de la rúbrica, con comando reproducible y enlace a la corrida de CI; restaurar el test que protege contra porcentajes sin evidencia. Cierre: test verde + CI run enlazado.
- **A2·H** Sesgo de autoevaluación: los porcentajes los calcula quien implementa. → Que CI genere `evidence/readiness.json` y el README lo cite; prohibido editarlo a mano.
- **A3·M** Documentos de auditoría dispersos y solapados (`docs/AUDIT_*`, `docs/audit/`, `docs/audits/`, `docs/archive/`). → Índice único `docs/audits/INDEX.md`, archivar el resto.

## B. Build / CI / calidad
- **B1·C** Validar `pnpm install && pnpm typecheck && pnpm test && pnpm build` en limpio y registrar el run. (Este sandbox no puede.)
- **B2·C** Branch protection en `main` (PR + checks requeridos). Hoy bots (v0), humanos y agentes empujan directo y se pisan (conflictos repetidos en `app.js`, `index.html`, README).
- **B3·H** Reglas AGENTS.md violadas: 3 `any` en `src/routes/revenue-fabric.ts:20-22` (`limiter: any`). 18 `console.log/warn` en `src`. → tipar el limiter; logger estructurado; ESLint `no-explicit-any` en CI.
- **B4·H** No hay ESLint/Prettier (`lint` = `tsc --noEmit`). → añadir y bloquear en CI.
- **B5·M** Workflows: revisar `.github/workflows/*.yml` (6) en GitHub; ninguno verificado verde por esta auditoría. Dependabot: resolver alertas.
- **B6·M** Variables usadas y no documentadas en `.env.example`: `BOOKPI_LEDGER_PATH`, `HOST`, `PORT` (VERCEL*/VITEST son de plataforma).
- **B7·M** Tests de rutas solo parciales: `/api/v1/revenue/*` (16 rutas) sin test de rutas (solo test unitario del motor).

## C. Contratos de API
- **C1·H** OpenAPI cubre 57 paths de 175 rutas del inventario → **111 rutas sin documentar** (incluye billing, revenue, citemesh, civilization, cognitive-capital…). El test solo comprueba "documentado ⇒ existe", no lo inverso. → Añadir test inverso (con lista de excepciones explícita) y documentar.
- **C2·M** Inventario congelado `test/deployment/route-inventory.json` y `docs/api/route-inventory.json` duplican fuente; generar uno del otro.

## D. Monetización — evolución (CRÍTICO)
Regla del dueño: **70 % usuarios / 30 % plataforma; solo usuarios con plan de pago activo; `free` no monetiza.**
- **D1·C** Existen **al menos 5 motores de ingresos solapados** y ninguno impone la regla: `src/commerce/revenue.ts` + `revenue-share.ts` (mío, 70/30 + `canEarn`), `src/economy/sovereign-revenue-fabric.ts` (tasas de creador por tier IETS 50–90 %, sin gating por plan), `economy/revenue-fabric/normalized-settlement.ts` (`userRate`), `economy/{monetization-engine,dynamic-pricing,royalty,affiliates,cognitive-capital-market}`, `bookpi` royalties. → **Una sola fuente de verdad**: Revenue Fabric como libro mayor; `computeRevenueShare` como política de reparto invocada por `settle`; borrar o marcar `deprecated` el resto. Cierre: test que prueba que `free`/`trialing`/`past_due` reciben 0 a través de `POST /revenue/settle`.
- **D2·C** Estado volátil: ledger, liquidaciones, uso y wallets son `Map` en memoria (`sovereign-revenue-fabric.ts:233`, `immutable-ledger.ts:51`, `metering-service.ts:48`) aunque exista `migrations/001_initial_schema.sql`. Un reinicio borra dinero contabilizado. → Persistencia Postgres transaccional con idempotencia y `outbox` real; prueba de recuperación.
- **D3·C** Checkout público inexistente: `/api/v1/billing/checkout` exige token admin; usuario normal no puede pagar. Sin flujo Stripe E2E (checkout→webhook→entitlement→elegibilidad→reparto) probado.
- **D4·C** Pago real no implementado: Stripe Connect/KYC, umbral mínimo, MXN, CFDI/retenciones ISR‑IVA, holdback 30 días para contracargos, clawback por fraude. Requiere decisión legal/fiscal del dueño.
- **D5·H** `wallet/:userId/credit|debit` solo admin y sin vínculo con suscripción; riesgo de acreditar a `free`. → validar `canEarn` en crédito de ganancias.
- **D6·H** Rutas `/api/v1/revenue/usage*` y `wallet*` usan `authorizeProviderRoute` (token de proveedor) para leer datos por `:userId`: cualquier titular del token lee cualquier usuario. → autorización por sujeto (usuario solo lo suyo).
- **D7·M** Métrica de contribución (puntos) que reparte el 70 % no está definida ni es auditable (riesgo de fraude/gaming). → definir, firmar con BookPI, tope por usuario.
- **D8·M** UI: planes/CTA no completan compra; no hay panel "Mi plan y ganancias" (free ve CTA a mejorar; planes de pago ven ganancias estimadas con aviso de no garantizado).
- **D9·M** Términos y avisos: ganancias no garantizadas, solo planes de pago, retención y reembolsos.

## E. Seguridad / endurecimiento
- **E1·H** CSP permite `script-src 'unsafe-inline'` y `style-src 'unsafe-inline'` (`src/server.ts:107`). → nonces/hashes; añadir `object-src 'none'`, `Permissions-Policy`, `Referrer-Policy`, `COOP`.
- **E2·H** Rutas con `authorizeProviderRoute` vs `authorizeAdmin` mezclan niveles de privilegio; documentar matriz ruta→actor y testearla (existe `route-gate-wiring`).
- **E3·M** `any` en limiter oculta contratos de rate-limit. (ver B3)
- **E4·M** Escaneo de secretos (gitleaks) y OSV/`pnpm audit` en CI; SBOM. Los hits de patrones tipo clave están en tests/preflight (revisar que sean fixtures).
- **E5·M** `Math.random` en `src/cli/reconcilePids.ts:50` (jitter; aceptable) — documentar.
- **E6·M** `BOOKPI_INTEGRITY_SECRET` obligatorio en el entorno desplegado; ledger BookPI persistente.

## F. Producción (readiness real)
- **F1·C** Atlas/IKES 404 en despliegue; OTLP/alertas ausentes; rollback no ensayado (`deploy/`, `k8s/`).
- **F2·C** Sin smoke ni latencias medidas contra proveedores de inferencia reales (`smoke:production`, `verify:production`).
- **F3·H** Sin HEALTHCHECK de contenedor (distroless; documentado) → probe en k8s verificado.
- **F4·M** Prueba de carga (k6/autocannon) con resultados en `docs/ops`.

## G. Archivos incompletos / infuncionales / huérfanos
- **G1·H** `src/voice/emotion.ts` y `src/voice/normalize-esmx.ts`: huérfanos, duplican `src/tts/*`. Borrar o fusionar.
- **G2·H** UI no está conectada a `/api/v1/tts/*`; usa `/api/v1/cognition/speech`. No hay audio neural (solo `client-plan` sin `GENESIS_TTS_URL`). AUD‑17 (modelo TTS vacío/inglés).
- **G3·H** AUD‑18 módulos sin cablear: `cognition/genesis-chunk`, `companion/*`, `deployment/{canary,production-smoke}`, `governance/incident`, `inference/adapters`, `platform/index`, `privacy/{crypto-shred,differential-privacy}`, `security/key-hierarchy`.
- **G4·M** Marcadores stub/placeholder: `health/preflight.ts`, `governance/quality-gates.ts`, `security/post-quantum.ts`, `security/isa-x/protocol.ts` → no presentarlos como capacidad real.
- **G5·M** `src/server.ts` ≈ 3850 líneas → extraer `register*Routes` por dominio.
- **G6·M** `src/assets/video/IntroVideoIsabella.mp4` (23 MB) en el repo; el runtime sirve la web de 8.8 MB. → Git LFS/CDN y eliminar el original del bundle.
- **G7·L** `src/assets/video/uno.md` (32 bytes) sin propósito claro.

## H. UI / visual inmersivo
Hecho esta jornada: intro sin display:none, tarjeta −20 %, sale al autorizar, sin capas sobre el video (≈100→≈500 frames presentados medidos en Chromium con copia VP9), `ui-smoke` verde.
- **H1·H** Verificar el intro real con H.264 en Chrome/Safari/iOS/Android (el sandbox no decodifica H.264); medir `droppedVideoFrames` con `getVideoPlaybackQuality`. Considerar WebM/AV1 además de MP4.
- **H2·H** `command-center.css` ("chat-only home") oculta hero, rails, paneles y navegación con `display:none!important` (línea 3): el sitio pierde navegación y secciones (planes, gobernanza). Decidir producto: chat-only a propósito, o restaurar navegación; hoy es un override ciego por `!important`.
- **H3·M** `cinematic.css` pesa 141 KB sin minificar, mezcla capas antiguas y nuevas (`backdrop-filter` en muchas tarjetas) → tokens de diseño únicos, purgar CSS no usado, presupuesto de blur.
- **H4·M** Accesibilidad: `index.html` sin `<img>`/`svg` con alt (decorativos con `aria-hidden` ok); solo 25 `aria-label`; solo 16 reglas `prefers-*`; fuentes de 6–9 px en mono (169 declaraciones `font-size` en px). → AA de contraste, tamaño mínimo 12 px, foco visible, `prefers-reduced-motion` verificado en intro.
- **H5·M** Pruebas visuales Playwright por breakpoint (hoy solo cadenas literales en `ui-smoke`).
- **H6·M** Chat: streaming SSE con cursor, copiar código, citas/fuentes, adjuntos, paleta de comandos, estados vacío/error/offline.
- **H7·L** Transición intro→app (fundido del video al chat), poster y `preload` escalonado; skeletons en vez de spinners; micro‑interacciones coherentes.
- **H8·L** Un solo dueño por `app.js`/`chat-plus.js`/`index.html`/README para parar conflictos con el bot v0.

## I. Sistemas turbo (rapidez)
Existen `DeadlineBudget`, `hedgedFirst`, cooldowns, `turbo-planner`. Falta:
- **I1·H** Streaming de tokens (SSE) y primer byte < 400 ms.
- **I2·H** Caché exacta/semántica con TTL e invalidación por plan; single‑flight para peticiones idénticas.
- **I3·M** HTTP/2 keep‑alive y precalentamiento a proveedores; compresión br/gzip; `Cache-Control` inmutable con hash.
- **I4·M** Presupuestos por etapa + métricas p50/p95 en `/metrics` con alerta.
- **I5·M** Carga real y resultados versionados (ver F4).

## J. Tests y entorno
- **J1·M** Shim local sin `mockResolvedValueOnce`/`useRealTimers` (falsos fallos en ige-omega, ikes-supabase, inference cache) → confirmar con vitest real.
- **J2·M** E2E Playwright: consentimiento `#immersionConsent`, intro, chat, voz, móvil.
- **J3·L** Mantener guardas al añadir rutas: `test/deployment/route-inventory.json`, `docs/api/*`, `.env.example`.

## Ruta al 100 % (orden)
1. B1+B2+A1 (verdad y CI) → 2. D1–D3 (un motor, persistencia, checkout) → 3. E1,E2,D6 (seguridad) → 4. C1 (OpenAPI) → 5. F1–F2 (producción real) → 6. G1–G3 (limpieza/cableado) → 7. H1,H2,H4 (UI) → 8. I1–I2 (turbo) → 9. D4 (pagos reales, decisión legal).
Definición de 100 %: CI verde en `main` con branch protection; readiness generado por CI; un solo motor de ingresos persistente con regla 70/30 y gating por plan probado E2E con Stripe test; OpenAPI = inventario; 0 `any`; CSP sin inline; intro verificado en dispositivos reales; 0 huérfanos.


## Origen: `docs/audits/DOWNLOADS-INTEGRATION-2026-10-24.md`

# Integración selectiva del material local de Descargas — 2026-10-24

state: engine-generated (pendiente de revisión humana con nombre) · Alcance: análisis local de la carpeta de Descargas del operador y adaptación **selectiva** de ideas al runtime nativo de Isabella. No se copiaron datos personales, credenciales, binarios pesados ni código con licencia incompatible o no verificable.

## Criterio de admisión

Una pieza se integra solo si cumple las cuatro condiciones:

1. Aporta una capacidad que el repositorio no tenía o tenía incompleta.
2. Su licencia permite reutilización y atribución (MIT, Apache-2.0, BSD, dominio público o especificación pública).
3. Puede implementarse sin conceder autoridad, sin ejecutar efectos externos y sin inventar resultados.
4. Tiene pruebas deterministas en este repositorio.

Todo lo demás se documenta como rechazado; no se incorpora "por si acaso".

## Incorporado

| Origen | Licencia | Destino | Cambio real |
|---|---|---|---|
| Hermes Agent (`tools/tts_streaming.py`, Nous Research) | MIT | `src/tts/streaming.ts` | `SentenceChunker` reimplementado en TypeScript con límites de español, eliminación de bloques de razonamiento partidos entre deltas, topes de búfer y `BargeInRegistry` con TTL y consumo único. No se copió Python ni se añadió dependencia. |
| Hermes Agent (compresión de contexto previa al LLM) | MIT | `src/inference/context-budget.ts` | Presupuesto de tokens determinista, resumen **extractivo literal** del medio de la conversación, protección del system prompt, del ancla y de los últimos turnos; el resumen se marca explícitamente como contexto no confiable. |
| Especificación pública GGUF (ggml) | MIT | `src/inference/open-model-artifact.ts` | Inspector de cabecera GGUF v1–v3, validación de manifiesto, SHA-256, tamaño y procedencia HTTPS. No carga pesos, no descarga, no ejecuta y no aprueba producción (`authority: "NONE"`). |

### Conexión con el runtime

- `POST /api/v1/tts/stream` entrega planes de prosodia por SSE, oración por oración; `POST /api/v1/tts/interrupt` marca un barge-in por actor. Ambos declaran `authorizationPerformed: false` y `executionPerformed: false`.
- `/api/v1/cognition/route` y `/api/v1/cognition/stream` aplican `budgetConversationHistory` antes de llamar a cualquier proveedor y publican `contextBudget` con la estrategia exacta aplicada. El historial saneado original sigue siendo la clave de caché y el conteo público.
- El inspector de artefactos es una librería de análisis; no se expuso como ruta HTTP ni permite rutas arbitrarias del sistema de archivos.

## Rechazado o no adoptado

| Material | Motivo |
|---|---|
| `isabella-agent-sdk.ts` (mexa) con fallback no seguro | El fallback evadía controles de autorización; contradice `CAPABILITY ≠ AUTHORITY`. |
| `isabella-inference-engine.ts` (mexa) | Duplicaba el motor determinista ya existente; el repositorio actual está por delante en router MoE, fast lane y proveedores. Reemplazarlo habría sido una regresión. |
| `voiceUtils.ts` (continuidad de voz del navegador) | Duplicaba lógica ya presente en `src/ui/app.js`; no aportaba una capacidad nueva verificable. |
| Documentos, PDFs, audio, video, bases de datos personales y capturas | No son código reutilizable; contienen datos personales o material sin licencia explícita. |
| Zips de repositorios Isabella ya fusionados | El material útil ya está en este repositorio; volver a copiarlo introduciría duplicados y deriva. |
| Cualquier credencial, token, `.env` o volcado de configuración | Prohibido por la política de secretos. No se leyó ni se commiteó. |

## Invariantes preservadas

- `CAPABILITY ≠ AUTHORITY ≠ EXECUTION ≠ EVIDENCE ≠ LEARNING ≠ PRODUCTION`.
- `SPECIFIED ≠ IMPLEMENTED ≠ TESTED`: las nuevas capacidades están implementadas y probadas; lo que sigue siendo objetivo de diseño se declara en `docs/tts/GENESIS-TTS-RUNTIME.md` y en el estado del motor.
- Un plan de voz, un chunk SSE, un resumen de contexto o un informe de artefacto **no** son evidencia, permiso ni aprobación de producción.

## Verificación

- `tsc --noEmit` limpio.
- `eslint src/**/*.{ts,tsx,js,jsx} --max-warnings=0` limpio.
- `scripts/repository-assurance.mjs`: PASS estructural, 43/44 comprobaciones, 0 fallos, 1 advertencia.
- Suite completa: **305 archivos y 1.824 pruebas aprobadas; 0 fallos** (ejecución del 2026-10-24 con `--maxWorkers=4`).
- Bundle `esbuild` ESM generado y `node --check` válido en `dist/server.js` y `src/ui/app.js`.
- Los seis archivos nuevos pasan `prettier --check`; el árbol preexistente conserva el desajuste de formato documentado en el README.
- Pruebas nuevas: segmentación/barge-in, `planStream`, SSE e interrupción, presupuesto de contexto, GGUF/manifiesto/hash/traversal, y contratos de inventario de rutas y OpenAPI.


## Origen: `docs/audits/FOCUSED-AUDIT-UI-AND-LIVE-CHAT-2026-10-17.md`

# Auditoría focalizada: interfaz empresarial y comunicación conversacional

Fecha de intervención: 2026-10-17  
Rama de trabajo: `feat/isabella-enterprise-ui-live-chat`  
Base inspeccionada: `main` (árbol del repositorio y fuentes consultadas durante la intervención)

## Alcance

Esta intervención se concentra en dos objetivos: (1) elevar la presentación visual sin retirar controles ni módulos existentes y (2) verificar el camino conversacional de extremo a extremo, diferenciando el fallback local de la inferencia generativa externa.

## Cambios implementados en esta rama

### 1. Refinamiento visual empresarial

Archivo: `src/ui/cinematic.css`

- Paleta más sobria de obsidiana, platino, azul hielo y lavanda contenida.
- Jerarquía tipográfica, espaciado y navegación más consistentes.
- Paneles, consola, tarjetas y campos con bordes, superficies y sombras más discretas.
- Mejor presentación de mensajes de usuario y asistente, con anchura legible y saltos de línea seguros.
- Mejoras para foco visible, selección de texto, estados deshabilitados y navegación con teclado.
- Ajustes responsive para móvil y pantallas intermedias.
- Respeto de `prefers-reduced-motion`; las reglas son overrides progresivos y no eliminan componentes existentes.

No se afirma una medición de rendimiento visual ni un resultado de pruebas de navegador hasta ejecutar los checks del commit.

### 2. Comunicación conversacional: estado real observado

El cliente `src/ui/app.js` envía mensajes mediante `POST /api/v1/cognition/route`, con historial acotado y un `AbortController`. El servidor en `src/server.ts` aplica límites, evaluación de políticas, presupuesto de inferencia y selección de proveedores. Si el proveedor no entrega texto, existe un fallback conversacional local identificado como `sovereign-fallback`.

La ruta local permite responder sin proveedor remoto, pero **no es un modelo de lenguaje generativo**. No debe anunciarse como inferencia generativa.

La ruta intenta proveedores externos según su configuración y política. La variable `ISABELLA_KEYLESS_FREE_PROVIDER=pollinations` habilita explícitamente un proveedor externo sin clave; activar esta opción implica que el prompt y parte del historial pueden salir del servidor hacia un tercero. Por privacidad, no se habilita silenciosamente desde el código de interfaz.

## Bloqueadores de validación externa

El README existente declara estado de preproducción y menciona que la ruta de readiness ha devuelto HTTP 503 por dependencias/configuración incompletas, incluida la configuración de integridad BookPI y servicios Atlas/IKES. El README también documenta que un smoke generativo externo fue omitido por falta de credenciales de proveedor. Estos datos son advertencias documentadas del repositorio, no una medición en vivo de la rama nueva.

Para demostrar comunicación generativa en el despliegue elegido, se necesita:
1. Seleccionar y autorizar al menos un proveedor/modelo.
2. Configurar las variables de entorno requeridas en el entorno de despliegue (sin subir secretos al repositorio).
3. Ejecutar una prueba HTTP real con un prompt inocuo y confirmar `responseEngine` distinto de `sovereign-fallback`.
4. Probar indisponibilidad del proveedor y verificar que el fallback responde dentro del presupuesto de tiempo.
5. Confirmar que los mensajes y el historial no se envían a terceros sin una decisión explícita del operador.

## Criterio de aceptación

- UI: typecheck y smoke existentes pasan; verificación visual en escritorio y móvil; navegación por teclado y reducción de movimiento verificadas.
- Conversación local: salud HTTP, envío de saludo, respuesta, continuidad con historial y nueva sesión verificadas.
- Inferencia generativa: respuesta procedente de proveedor real, proveedor identificado en metadatos, latencia medida y fallback tras error verificados.
- Producción: readiness y dependencias requeridas saludables; no basta con un build correcto.

## Límites de esta intervención

Esta rama contiene un refinamiento visual de CSS. No declara que la inferencia externa esté conectada, que la aplicación haya sido desplegada, que los checks de CI hayan pasado ni que el sistema esté listo para producción. La configuración del proveedor y la validación real en el entorno desplegado son pasos separados y necesarios.

## Cambios adicionales de esta ampliación — 2026-10-17

### Puerta de inmersión: consentimiento real, sin CAPTCHA ficticio

- Se eliminó el desafío numérico generado y validado completamente en cliente. No constituía protección contra bots ni verificación de identidad.
- Se reemplazó por un consentimiento audiovisual explícito, con estado accesible y mensaje que aclara su alcance.
- El botón para omitir la intro ahora permanece dentro del diálogo modal; el foco entra al diálogo, queda contenido con Tab/Shift+Tab, Escape permite cerrar y al salir se devuelve el foco a la entrada del chat.
- La protección contra abuso sigue dependiendo de controles de servidor, como rate limiting; el consentimiento no se presenta como seguridad de identidad.

### Video y sincronización de la narrativa

- Se quitó `loop` del vídeo: el final de reproducción puede disparar `ended` y cerrar correctamente la intro.
- El progreso de escenas usa `requestAnimationFrame`, no un intervalo fijo de 80 ms.
- Cuando hay metadatos válidos, el avance de la narrativa deriva del tiempo reproducido del vídeo, para que el texto no avance mientras el vídeo está detenido en buffering.
- Los eventos `waiting`, `stalled` y `error` habilitan una capa de respaldo CSS más ligera en lugar de invocar repetidamente `play()` y agravar los intentos de recuperación.
- La pestaña oculta pausa vídeo y tiempo narrativo; al volver intenta reanudar el vídeo y conserva el mecanismo alternativo si falla.
- Se reduce el desenfoque de pantalla completa y se retira `will-change: transform` permanente del vídeo, reduciendo la presión potencial sobre composición/GPU. No se afirma una mejora cuantificada de FPS ni una reproducción perfecta sin medición en navegador y dispositivo.

### Pruebas de regresión añadidas

El smoke de UI verifica la existencia del consentimiento y su cableado, ausencia del antiguo código de “verificación humana”, la ausencia de `loop`, el reloj de escenas basado en el vídeo, la respuesta a buffering, el alcance del botón de omisión y el control de foco del diálogo. Estas comprobaciones son estáticas; la reproducción real y la accesibilidad deben validarse además en navegador.

### Estado de validación

Los cambios están en la rama de la PR #23, no en `main`. No se ha ejecutado un smoke de navegador ni se dispone de una ejecución de CI utilizable para certificar estas correcciones. Las Actions observadas en el repo han terminado en pocos segundos con cero pasos expuestos y registros inaccesibles; no se interpretan como un resultado verde ni como diagnóstico concluyente del código.


## Origen: `docs/audits/GLOBAL-PROFILE-TERMINUS-2026-10-12.md`

# Auditoría global del perfil GitHub y selección del plano canónico de Isabella

**Fecha:** 12 de octubre de 2026  
**Perfil consultado:** https://github.com/OsoPanda1  
**Destino autorizado:** https://github.com/OsoPanda1/ISABELLA-VERSION-TERMINUS-V6  
**Alcance:** inventario visible, búsquedas temáticas y revisión dirigida del árbol y contratos del repositorio destino. No afirma que se hayan leído todas las líneas de todos los repositorios ni constituye certificación externa.

## Dictamen ejecutivo

El perfil contiene varias generaciones y superficies con nombres relacionados con Isabella, Genesis/TINA, CROWN, TAMV/Atlas, RDM Digital y LITLE/Open Science. La amplitud puede conservar investigación, pero aumenta el riesgo de divergencia en APIs, dependencias, licencias, README, cifras de madurez, flujos de CI y límites de seguridad. La implementación de esta tarea se realiza en el destino autorizado; los demás repositorios son referencias para una comparación posterior, no superficies que se actualicen implícitamente.

### Familias observadas

- **Isabella / Genesis / TINA:** Isabella-V6-TINA, ISABELLA-VERSION-TERMINUS-V6, isabella-ai-tina, isabella-s-crown, isabella-s-core, isabella-villasenor-ai, isabella-sovereign-ai, isabella-ai-genesis-yj y repositorios relacionados.
- **TAMV / Atlas / federación:** tamv-atlas, tamv-orchestrator, tamv-core-atlas, tamv-atlas-nextgen, tamv-nexus, ecosistema-tamv, federacion-tamv y quantum-system-tamv.
- **RDM Digital / territorio:** RDM-DIGITAL, RDM-DIGITAL2026, rdm-digital-hub, rdm-digital-os, rdm-live-web y otras superficies territoriales.
- **LITLE / Open Science:** litle-trust-fabric, litle-verified-trust, litle-verified-seal, LITLE-VERSION-1.0 y litle-atlas-suite.

Los nombres y descripciones del perfil sirven para inventariar candidatos, pero no prueban que el código se compile, que comparta APIs compatibles ni que sea seguro fusionarlo. Antes de copiar código deben compararse repositorio fuente, commit, dependencias, licencia, procedencia, tests, migraciones, tratamiento de secretos y modelo de amenazas.

## Hallazgos técnicos críticos en el destino

1. **Identidad de CI/README.** El README anterior enlazaba badges a Isabella-V6-TINA-h6, no al destino autorizado. Un estado verde de un repositorio distinto puede inducir a error sobre la validación del destino. Los badges se actualizaron para apuntar al repositorio correcto.
2. **BookPI PostgreSQL.** El adaptador declara trece columnas de inserción, incluida la columna canonical, pero la sentencia tenía doce placeholders. Esto impide insertar el registro completo en el esquema que exige canonical. La sentencia se corrigió y se añade un test de contrato de trece parámetros.
3. **Checkpoint y secuencia de BookPI.** La poda del ledger deja un checkpoint del prefijo archivado. La siguiente inserción debe seguir el hash del checkpoint y conservar la secuencia global; de lo contrario, una poda puede provocar discontinuidad de secuencia o reinicio de la cadena. Se endurecen el append, la verificación de secuencias, el plan de poda y el backup/restore del checkpoint.
4. **Inmutabilidad real.** El ledger JSONL encadenado no es WORM. La cadena ayuda a detectar modificaciones, pero no impide por sí sola que un administrador cambie todas las copias pertinentes. Se necesitan roles restrictivos, backups verificados y, para evidencia fuerte, anclaje externo.
5. **Retención del payload frente al ledger.** La depuración de objetos y shards es una política distinta de la retención de eventos BookPI. Los eventos de intención, resultado y fallo se conservan; un error de escritura de intención bloquea la eliminación del payload. Retener información personal o sensible debe respetar legal hold, consentimiento, expiración y política aplicable.
6. **Redundancia 6+3.** Terminus aplica cifrado autenticado antes de Reed–Solomon. Se requieren seis shards válidos de un conjunto de nueve para reconstrucción. Esta codificación tolera hasta tres shards perdidos/dañados, pero añade almacenamiento y metadatos; no crea capacidad física gratuita.
7. **Nueve dominios independientes.** Nueve identificadores de adaptador no demuestran nueve dominios de fallo. Nueve aliases en un mismo volumen, cuenta o proveedor aún comparten riesgo. La liberación requiere adaptadores reales, identidades separadas, cuotas verificadas y prueba de pérdida de shard/provider.
8. **Cuotas de planes gratuitos.** Un límite local configurado no refleja la cuota real ni sus cambios en un proveedor externo. Los adaptadores deben comprobar y reservar capacidad atómicamente, o rechazar la operación si no conocen la cuota vigente.
9. **Borrado criptográfico.** La destrucción de clave sólo constituye borrado criptográfico efectivo si el KMS real elimina de modo duradero todas las copias recuperables. No demuestra la eliminación física de copias gestionadas por proveedores, backups, réplicas o cachés.
10. **Separación de autoridad y ejecución.** Terminus debe permanecer como gate: verificar identidad, evidencia, límites, separación de actores y presupuesto durable y registrar la decisión en BookPI antes de devolver ALLOW. La autorización por sí sola no ejecuta la acción.
11. **Rendimiento.** El código local de hashes, codificación y routing no permite inferir latencia de producción. Hace falta medir percentiles bajo carga, con red, proveedores, cold starts, almacenamiento real y concurrencia.
12. **Licencias y procedencia.** Una marca común no convierte las licencias en compatibles. El código procedente de repositorios auxiliares requiere revisión de LICENSE, dependencia, origen y atribución por componente.

13. **Durabilidad de archivos BookPI.** Las escrituras usan `fsync`, los archivos se sustituyen de forma atómica y la poda/restauración mantiene un marcador durable de mantenimiento. Si el marcador persiste tras un fallo, el runtime se bloquea hasta reconciliar el ledger, el archivo y el checkpoint; no intenta adivinar qué mitad de la operación fue confirmada.

## Diseño de Terminus incorporado al destino

- **src/terminus/erasure-code.ts:** codificador Reed–Solomon 6+3 y decodificador de cualquier combinación válida de seis shards.
- **src/terminus/sharded-store.ts:** coordinación de cifrado AES-256-GCM, escritura create-only mediante adaptadores con cuotas, lectura con validación de tenant/integridad, borrado y registro BookPI.
- **src/terminus/mandate.ts:** mandato versionado, política de capacidades/operaciones, vector de riesgo, evidencia, vencimiento, presupuestos y separación de roles. El runtime exige verificadores de identidad/evidencia y contador de ejecución externos.
- **src/terminus/retention.ts:** política de retención acotada, protecciones legal-hold/pinned/in-use, gate de capacidad y eventos BookPI de intención/resultado.
- **test/terminus/:** pruebas de codificación, autorización y retención.
- **test/bookpi/storage-postgres.test.ts:** comprobación de los trece parámetros de inserción.
- **DurableBookPiLedger:** continuidad de checkpoint y secuencia, backup/restauración conjunta del archivo y su checkpoint, y validación del plan de poda contra los eventos actuales.

Estos contratos y pruebas no equivalen a nueve proveedores reales ni a un KMS ya provisionado. Las implementaciones de proveedor siguen siendo una fase de integración y deben verificarse con pruebas E2E.

## Interfaz de producto y accesibilidad

La UI anterior presentaba una introducción cinemática obligatoria antes de permitir acceder al espacio de trabajo, dependía de una imagen alojada en un blob externo y repetía el ID HTML `protocols` en dos secciones. Estos detalles producían una primera interacción lenta, un recurso visual fuera del control del repositorio y navegación/ARIA ambigua.

La actualización visual adopta un sistema Obsidian / Platino / Azul Eléctrico con menor ruido, jerarquía tipográfica más legible, superficies de contraste controlado, estados de foco visibles, disposición responsive y respeto por `prefers-reduced-motion`. El espacio de trabajo abre de inmediato; la secuencia de marca sigue disponible de forma explícita con `?intro=1`. Se añade acción accesible de copiar respuesta, se retira el fondo externo y se elimina el ID duplicado. El smoke de UI ahora exige unicidad de IDs y ausencia del asset remoto.

## Estado operativo y ámbito real de BookPI

El endpoint de estado ahora declara si BookPI usa la cadena volátil de memoria o el archivo JSONL local con `fsync`; no eleva ese segundo caso a almacenamiento compartido, alta disponibilidad ni WORM. `/api/v1/readyz` mantiene el control fail-closed: una dependencia crítica degradada conserva HTTP 503 y devuelve evidencia explícita en vez de convertir la presencia de configuración en una afirmación de salud.

## Control de admisión concurrente

El coordinador de almacenamiento ahora exige un gate de admisión tenant-scoped. Si una escritura excede los límites de la política o existen candidatos de retención, ejecuta únicamente la pasada que registra la intención y el resultado en BookPI; después, vuelve a consultar el estado. La escritura sólo continúa si el repositorio implementa una reserva de capacidad atómica y durable. El contrato no se considera una integración concluida hasta conectar y probar un repositorio transaccional que reserve bytes/objetos concurrentes, recupere reservas huérfanas y reconcilie el manifiesto después de un fallo.

## Recomendaciones organizacionales para el perfil

1. Cada repo debe declarar su rol: canónico, librería interoperable, implementación federada, prototipo, especificación o legado.
2. Mantener un registro de APIs/esquemas versionados, commit fuente, licencia, propietario y evidencia de pruebas.
3. Los badges de CI deben referir al workflow del mismo repositorio que presentan.
4. Exigir pull requests, suites de pruebas, control de secretos y gates de release. No elevar madurez sólo por contar archivos o pruebas escritas.
5. Separar credenciales, tenants, datos personales y permisos entre Isabella, TAMV, RDM y LITLE.
6. Hacer un análisis de licencia antes de fusionar código de repositorios del perfil.
7. Acordar y probar RTO/RPO, restauración, cuotas y política de retención antes de admitir ingestión masiva.
8. Distinguir en la documentación código existente, tests escritos, tests ejecutados, integración real, despliegue y certificación.

## Referencias consultadas

- Repositorio destino: https://github.com/OsoPanda1/ISABELLA-VERSION-TERMINUS-V6
- Perfil: https://github.com/OsoPanda1
- Isabella V6 TINA: https://github.com/OsoPanda1/Isabella-V6-TINA
- CROWN: https://github.com/OsoPanda1/isabella-s-crown
- TAMV Atlas: https://github.com/OsoPanda1/tamv-atlas
- TAMV Orchestrator: https://github.com/OsoPanda1/tamv-orchestrator
- LITLE Trust Fabric: https://github.com/OsoPanda1/litle-trust-fabric
- RDM Digital Hub: https://github.com/OsoPanda1/rdm-digital-hub

Las referencias guían auditorías posteriores; no se afirman como módulos fusionados o integrados con el destino.


## Origen: `docs/audits/INFERENCE-CHAIN-DEADLINE-CANCELLATION-2026-10-17.md`

# Focused inference-chain audit — 2026-10-17

## Scope

This change addresses the public chat route's sequential model-provider chain and its request lifecycle. It is a targeted correction, not a claim that the entire inference stack or production deployment has passed validation.

## Findings corrected

### INF-01 — The configured chain deadline did not cover the entire routing path

The `DeadlineBudget` was created after the local Genesis Turbo classification. Time spent in that classification was therefore outside the advertised whole-chain budget.

**Correction:** start the budget before local classification and reuse it through provider routing. Classifier time consumes the same budget, so an expensive classification leaves less time for provider attempts. The classifier API itself does not currently accept an abort signal, so the budget cannot interrupt a classifier that hangs; that remains a separate limitation.

### INF-02 — Two fallback paths could escape the shared budget

Before this fix, the Perplexity Router call used its default 30-second timeout without the chain's remaining budget. A later keyless-provider retry also omitted the `DeadlineBudget` argument.

**Correction:** the Perplexity request now receives a remaining-budget-derived timeout and abort signal, and the second keyless attempt receives the shared budget. All provider attempts are expected to respect the shared time and cancellation contract.

### INF-03 — Client-side Stop/disconnect did not cancel upstream model work

The browser can abort its fetch, but the server did not connect premature response closure to provider cancellation. This could waste provider capacity and continue downstream attempts after the user had stopped waiting.

**Correction:** attach an abort controller to the response lifecycle; abort it only when the response closes before `writableEnded`. `DeadlineBudget` combines that caller signal with the per-attempt timeout. A cancelled request stops before additional generation or response work. The Perplexity adapter now accepts the same signal.

### INF-04 — Local fallback responses could be cached as if they were successful model responses

The cognition response cache accepted any successful admitted response, including `responseEngine: "sovereign-fallback"`. A transient provider outage could therefore keep serving a deterministic fallback after a model provider recovered, until the cache entry expired.

**Correction:** exclude `sovereign-fallback` responses from the success cache. The fallback remains available to answer promptly but no longer masks recovery through cached output.

### INF-05 — Response-cache hits happened before input guards and governance evaluation

The route checked its full-response cache before enforcing the input-size limit, rejecting unscoped `memoryQuery` requests, evaluating the current governance policy, and appending a BookPI cognitive-evaluation event. A matching cached request could therefore bypass those checks and skip per-request evidence. The old key also did not encode the method identifier.

**Correction:** cache reads now happen after request validation, a fresh policy evaluation, and a BookPI event. The key uses structural JSON encoding and includes the governance method. Cache hits refresh the current decision, principal, and provider-configuration disclosure, mark the hit explicitly, and use `Cache-Control: no-store`. The cache is process-local, bounded, TTL-expiring, and LRU-evicting. Deterministic fallback responses are excluded from writes.

### INF-06 — Potential billable provider was routed from Auto/Open Science without an explicit paid-model selection

The server previously called Perplexity Router with the hard-coded model `perplexity/kimi-k3` from the `auto` and `open-science` fallback chain. A configured API key was enough to attempt that model; it did not require `ALLOW_PAID_PROVIDER_FALLBACK=true` or an operator-selected model. This contradicted the route's own policy that paid routes require opt-in.

**Correction:** generation is now fail-closed unless all three values are present: `PERPLEXITY_API_KEY`, a nonblank `PERPLEXITY_ROUTER_MODEL`, and the exact operator opt-in `ALLOW_PAID_PROVIDER_FALLBACK=true`. The helper refuses generation if the requested model differs from the configured model. The default Perplexity model has been removed, readiness now reports the selected model only when the gate is satisfied, and the provider is invoked only in the paid fallback block. Added unit tests cover key-only, missing model, opt-in values, and successful explicit selection.

The official Kimi API pricing guidance states that API use is billed by token and model, including Kimi K3 pay-as-you-go; selection must therefore not be silently interpreted as free. See [Kimi API pricing](https://www.kimi.ai/help/kimi-api/api-pricing).

## Regression coverage added

- Added a unit test asserting that caller cancellation aborts a provider signal and marks the deadline as expired, preventing subsequent attempts.
- Added bounded-cache tests for TTL expiry, capacity, LRU, replacement, clear, and cache-key isolation across governance methods.
- Added provider policy tests proving Perplexity generation stays disabled unless the operator explicitly opts into paid fallback and chooses the model.
- Added source-level route contract tests verifying input-size and memory-query guards, current governance evaluation, and BookPI event append all precede cache reuse. These are structural regression checks, not substitutes for an HTTP integration test.
- Existing deadline tests still cover remaining-budget caps, minimum attempt windows, worst-case sequential timeout bounds, invalid values, and environment parsing.

## Limitations and verification status

- This change was committed to a feature branch; it has not been merged into `main`.
- Tests and TypeScript checks have **not** been executed in a local checkout in this workflow. Passing status must come from GitHub Actions or a reproducible local run; no green result is claimed here.
- External provider reachability, credentials, quotas, actual generative output, Vercel deployment, and browser-level Stop behavior remain unverified.
- The shared deadline bounds provider attempts, not every possible operation in the full HTTP request. Local Genesis Turbo classification consumes the budget but cannot itself be interrupted through its current API. The Gemini SDK path is limited by its request timeout but does not yet receive the caller's abort signal. Other provider adapters must accept and honor the supplied timeout/cancellation contract.
- Cancellation is best-effort at the network/SDK layer; an upstream service may already have accepted a request before the abort reaches it.

## Invariants preserved

- External keyless inference remains opt-in; this change does not enable it.
- Paid-provider fallback remains controlled by explicit configuration; Perplexity additionally requires an explicit model ID.
- The deterministic fallback is still labeled `sovereign-fallback`; it is not represented as LLM output.
- No authority or execution permissions are granted by the deadline or cancellation mechanism.


## Origen: `docs/audits/P0-ARCHITECTURE-HARDENING-2026-10-12.md`

# Auditoría P0 de arquitectura, seguridad y latencia — Isabella V6 TINA

**Fecha:** 12 de octubre de 2026  
**Repositorio:** `OsoPanda1/Isabella-V6-TINA-h6`  
**Rama:** `main`  
**Alcance:** CROWN, AEGIS, Tools, Skills, HyperCore, caché single-flight, MoE, Game Over/UAGP, CITEMESH y evidencia de operación.

## Dictamen ejecutivo

La revisión encontró rutas donde un veredicto de revisión podía no impedir la ejecución, una caché de probes podía repoblarse con un resultado anterior tras una invalidación y el motor HyperCore podía consultar caché o ejecutar expertos antes de comprobar la autorización requerida. Se implementaron correcciones y pruebas de regresión para estas fronteras.

**Este documento no certifica producción.** El SHA de runtime TypeScript validado más reciente es `03e6f68ebc3ee5bec39bd42a69c0d704b40aff76`; Vercel registró `READY`, **746 pruebas aprobadas en 135 archivos** y la suite estática de seguridad con **14 passed, 0 failed, 0 not_applicable**. El smoke de inferencia externa se omitió por falta de credenciales elegibles. El estado de GitHub Actions y los gates Rust/durabilidad siguen abiertos. `ige-omega/Cargo.lock` existe en `main`, pero aún no se ha confirmado una ejecución verde de Cargo con `--locked`.

## Hallazgos priorizados

| ID | Prioridad | Hallazgo | Corrección incorporada | Validación |
|---|---|---|---|---|
| P0-01 | P0 | Tools y Skills continuaban si AEGIS devolvía `REVIEW`; sólo `BLOCK` detenía la ejecución. | Ambos registros ahora permiten continuar sólo ante `ALLOW`; `REVIEW` y `MODIFY` son no ejecutables hasta disponer de un flujo explícito de revisión/modificación. | Tests de regresión incluidos en el build validado; 734 pruebas aprobadas. |
| P0-02 | P0 | Entradas cíclicas o no serializables podían fallar durante la serialización antes de una decisión de seguridad. | `inspectAegisValue` devuelve bloqueo ante fallo de serialización; Tools y Skills usan el guard compartido. | Tests con referencias cíclicas incluidos; build validado. |
| P0-03 | P0 | HyperCore podía consultar una respuesta cacheada antes de revalidar una autorización y la bandera explícita `requiresAuthorization: false` podía debilitar la política de una tarea de riesgo alto/crítico. | La autorización se comprueba antes de leer la caché, llamar al predictor o ejecutar expertos. Riesgo alto/crítico siempre exige autorización, incluso si el campo del request es falso. | Tests de riesgo crítico y revalidación de caché incluidos; build validado. |
| P0-04 | P0 | La fábrica de CROWN podía sobrescribir silenciosamente IDs duplicados por construcción de `Map`. | La fábrica registra cada descriptor mediante el camino que rechaza duplicados; el helper de aprobación incluye `humanApprovalRequired`. | Tests de duplicados y coherencia de aprobación incluidos en el build validado. |
| P0-05 | P0 | Un consumidor podía mutar la lista de roles de un descriptor tras registrarlo; el mapa expuesto permitía mutaciones directas. | Se congelan los descriptores/roles y se expone una vista de mapa de sólo lectura; el registro mutable se mantiene en una estructura privada. | Tests de inmutabilidad del descriptor y de la vista de sólo lectura incluidos; build validado. |
| P1-01 | P1 | Una probe iniciada antes de `invalidate()` podía sobrescribir el resultado nuevo cuando terminara. | La caché single-flight usa generaciones; la invalidación invalida el vuelo anterior y sólo la generación vigente puede almacenar resultados. | Test de carrera aprobado en el build validado. |
| P1-02 | P1 | La etiqueta MoE puede inducir a error si se basa en el router léxico. | Se conserva la frontera documentada: `HEURISTIC_LEXICAL` no equivale a MoE soberano con gate/top-k/logits ni pesos entrenados. | Código y contrato revisados; no se declara entrenamiento MoE real sin artefactos/evidencia. |
| P1-03 | P1 | El panel muestra CITEMESH como `E0 NOT FETCHED`. | Se conserva ese estado explícito; no se cambia a “activo/verificado” sin una recuperación de fuente y validación reales. | Pendiente de conectar/fetch de la fuente canónica. |
| P1-04 | P1 | HyperCore contiene un pipeline de predicción/caché/experts/verificación, pero el propio módulo se identifica como draft. | Se reforzó la frontera de autorización sin presentar el módulo como certificado o como autoridad de ejecución. | Pruebas de unidad; falta benchmark end-to-end y validación de proveedor real. |

## Mejoras de latencia y flujo de datos

- La caché single-flight coalesce probes concurrentes y no cachea errores; la invalidación ahora evita que un resultado viejo vuelva a ser vigente.
- HyperCore deniega/escalona solicitudes que requieren autorización antes de consumir presupuesto de expertos o reutilizar resultados cacheados.
- Se conserva la ejecución paralela de expertos dentro del presupuesto temporal y la política fail-closed del verificador.
- No se declara “latencia casi cero”: el benchmark unitario mide operaciones locales (routing, canonicalización, evaluación) y no incluye latencia de red, proveedor de inferencia, cold start ni persistencia remota.
- No se hizo una afirmación de reducción porcentual de latencia sin un benchmark comparable antes/después. El build validado ejecutó 734 tests y 14 controles de seguridad estática; los benchmarks de CPU local no representan latencia de inferencia de extremo a extremo.

## Estado honesto de subsistemas

- **CROWN:** código y tests presentes; la política se está endureciendo. No equivale a una certificación formal.
- **AEGIS:** guard heurístico determinista; puede producir falsos positivos/negativos y no sustituye análisis semántico completo. Ahora los consumidores críticos fail-closed en cualquier veredicto distinto de `ALLOW`.
- **YUN:** los eventos/contratos presentes no demuestran por sí solos una federación distribuida activa.
- **Tools / Skills:** registros ejecutables con fronteras de scope, riesgo y aprobación; no se debe inferir que todas las tarjetas de UI ejecutan integraciones externas reales.
- **MoE:** no confundir router heurístico con modelo MoE entrenado. La disponibilidad de expertos y pesos reales debe comprobarse por artefacto, hash, licencia, versión y evaluación.
- **Hyper Core Turbo:** el código incluye pipeline y controles, pero “Turbo” no es evidencia de aceleración productiva; medir latencia y coste por ruta.
- **Game Over / UAGP:** existen módulos TypeScript y pruebas. El plugin Jenkins debe compilarse/validarse en su propio entorno antes de declararse operativo en Jenkins.
- **CITEMESH:** permanece en estado no recuperado hasta que exista evidencia verificable de fetch.
- **Inferencia externa:** el último estado documentado no tenía credenciales elegibles para demostrar generación real de un proveedor en Preview. Configurar secretos únicamente como variables de entorno del entorno de despliegue; nunca en el chat ni en el frontend.
- **CI:** GitHub Actions había mostrado `startup_failure` sin jobs en runs anteriores. Hace falta una ejecución con jobs y conclusión verde en el SHA final.
- **Persistencia y recuperación:** los adaptadores y contratos no prueban por sí solos durabilidad, recuperación ante caída ni consistencia entre réplicas.

## Estrategia P0 en tres frentes

1. **Seguridad y autoridad:** AEGIS fail-closed; CROWN con política inmutable; autorización de HyperCore antes de caché, predicción y expertos.
2. **Fluidez y latencia:** single-flight invalidable por generación; evitar trabajo cognitivo no autorizado; medir por separado CPU local, red, inferencia y persistencia.
3. **Evidencia y regresión:** pruebas para REVIEW, serialización inválida, roles mutables, IDs duplicados, autorización revocada en cache hit y carrera de invalidación.

## Evidencia de build validado

- Commit de runtime/build: [`03e6f68`](https://github.com/OsoPanda1/Isabella-V6-TINA-h6/commit/03e6f68ebc3ee5bec39bd42a69c0d704b40aff76).
- Deployment Vercel: [READY](https://vercel.com/isabella-mexa/isabella-v6-tina/HAC1kk2Ha1T5ukJNjRXiWjW8RwVq).
- Vitest: 746/746 pruebas; 135/135 archivos.
- UI: `UI_NAVIGATION_SMOKE_OK`, `CINEMATIC_INTRO_12_SCENES_OK`.
- Runtime: `LOCAL_CONVERSATION_SMOKE_OK`, `PUBLIC_API_GUARDRAILS_OK`, `OPENROUTER_PAID_ID_BLOCK_OK`.
- Suite estática de seguridad: 14 passed, 0 failed, 0 not_applicable; `SEC-12` valida el fail-closed de AEGIS en Tools/Skills.
- Inferencia externa: `LLM_GATEWAY_SMOKE_SKIPPED`; no se afirma que el proveedor real esté operativo.

## Seguimiento GAME OVER / UAGP-1 — endurecimiento adicional

Después del SHA de referencia se añadieron controles y pruebas de regresión para el runtime UAGP-1 y el plugin Jenkins:

- Aprobación humana: un nombre escrito en la solicitud ya no basta; el gate exige un principal autenticado coincidente. En HTTP, el token administrativo no equivale a aprobación: se requiere la credencial separada `GENESIS_HUMAN_APPROVAL_TOKEN` junto con `GENESIS_HUMAN_APPROVER_ID`. Si faltan, la decisión queda en `ESCALATE`.
- Política de aprobación: `humanApprovalRequired: false` no puede reducir el requisito derivado del riesgo o de una acción de alto impacto.
- Pasaportes: validación de puntuación y vigencia, prevención de sobrescritura por ID duplicado en TypeScript y validación/registro concurrente seguro en el plugin Java.
- Vínculo de autoridad: el agente y sus capacidades deben estar cubiertos por el pasaporte; una acción no declarada entre sus capacidades se rechaza.
- Confianza: las métricas incluidas en la solicitud no pueden elevar la puntuación por encima de la asignada por el emisor del pasaporte.
- Entradas: criticidad inválida se rechaza por validación y se trata como crítica en el motor de riesgo para impedir downgrade; el gateway TypeScript devuelve rechazo ante solicitudes malformadas sin propagar una excepción.
- Jenkins: se añadieron pruebas JUnit para el gate humano, criticidad, validez del pasaporte, límite de confianza y alcance de acciones. Se añadió `jenkins-plugin-verify` al workflow CI para ejecutar `mvn test` y empaquetar el HPI.

**Estado de verificación:** el build Vercel del SHA `03e6f68` valida el runtime TypeScript y sus 746 pruebas. Vercel no compila Java; las nuevas pruebas y el empaquetado del plugin Jenkins permanecen pendientes de una ejecución verde del job GitHub Actions. No se afirma que el plugin esté instalado o certificado.

## Gates restantes antes de declarar listo para producción

1. Build completo del SHA actual con TypeScript, toda la suite Vitest, bundle, UI/runtime smoke y `security:suite`.
2. GitHub Actions con jobs ejecutados y estado verde.
3. E2E real en navegador para Tools/Skills, navegación, caché y controles de acceso.
4. Benchmark comparable p50/p95/p99, tasa de errores y coste por ruta, separando proveedor y red.
5. Prueba real de inferencia con proveedor configurado en variables de entorno.
6. Validación de persistencia durable, recuperación, retención y aislamiento multi-tenant.
7. Recuperación de CITEMESH y validación de artefactos MoE antes de promover esos estados.
8. Validación independiente del plugin Jenkins y del workspace Rust cuando corresponda.

**Conclusión:** se han corregido fronteras de seguridad concretas y se han añadido pruebas de regresión. El estado de producción debe determinarse por la evidencia del SHA final, no por el número de módulos, las etiquetas de la interfaz ni esta auditoría por sí sola.


## Origen: `docs/audits/PRODUCTION-READINESS-AUDIT-2026-10-18.md`

# Auditoría técnico-operativa de preparación para producción
**Proyecto:** ISABELLA-VERSION-TERMINUS-V6  
**Fecha de corte:** 18 de octubre de 2026  
**Rama inspeccionada:** `main`  
**Commit de referencia:** `bf99c682de8493fa9ccd28e1652bb319338f4122`  
**Despliegue Vercel observado:** `dpl_9VpW8DjZJFU4bxypnkeNVjup7CRD`  
**Dictamen:** **NO APTO PARA DECLARAR PRODUCCIÓN COMPLETA**. El servicio HTTP responde, pero la readiness profunda es HTTP 503 y la evidencia CI más reciente no es satisfactoria.

## 1. Resumen ejecutivo

La aplicación está desplegada en Vercel y el endpoint superficial `GET /health` respondió HTTP 200 con estado `healthy`. Esto demuestra que una instancia del runtime está atendiendo solicitudes, pero no certifica que todas las dependencias de negocio, persistencia, inferencia, telemetría ni controles de producción estén listas.

En la inspección en vivo de `GET /api/v1/readyz`, el servicio respondió HTTP 503. La respuesta identificó cuatro bloqueos de readiness y una degradación de observabilidad. El workflow `Isabella Genesis Ω Sovereign CI` más reciente, para el commit indicado, terminó en `failure`; el workflow `Repository Assurance` también terminó en `failure`, y el despliegue de producción de GitHub Actions fue rechazado. Los jobs consultados no expusieron pasos ejecutados en la respuesta disponible, por lo que no se atribuye el fallo a una prueba concreta sin logs concluyentes.

**No se publica un porcentaje global de preparación:** no existe evidencia suficiente y consistente para calcularlo de forma defendible. Estado comprobable: despliegue HTTP activo; readiness profunda bloqueada; CI pendiente de diagnóstico y verde reproducible.

## 2. Evidencia reproducible y alcance

### Evidencia de repositorio
- El repositorio remoto existe y la conexión GitHub informa permiso de lectura y escritura sobre `OsoPanda1/ISABELLA-VERSION-TERMINUS-V6`.
- La rama por defecto es `main`.
- El commit inspeccionado es `bf99c682de8493fa9ccd28e1652bb319338f4122`.
- `package.json` declara Node.js `24.x`, pnpm `10.28.0`, TypeScript, Vitest y scripts de validación.
- `vercel.json` declara `pnpm run build:dist` y empaquetado de recursos para la función Express.
- La estructura contiene una aplicación Express exportada desde `src/server.ts`, pruebas de smoke, scripts de seguridad, un subsistema Rust `ige-omega`, un plugin Maven y recursos de infraestructura.

### Evidencia en vivo de Vercel
- Despliegue consultado: `isabella-v6-tina-77ni7i775-isabella-mexa.vercel.app`.
- `GET /health`: HTTP 200; `status=healthy`.
- `GET /api/v1/readyz`: HTTP 503; `snapshot.readiness.ready=false`.
- La existencia de un despliegue con estado Vercel `READY` significa que Vercel finalizó el despliegue, no que todas las dependencias de aplicación estén listas.

### Validación local parcial ejecutada sobre el ZIP adjunto
- `node --check src/ui/app.js`: PASS.
- `node scripts/ui-smoke.mjs`: PASS; salidas `UI_NAVIGATION_SMOKE_OK`, `CINEMATIC_INTRO_12_SCENES_OK`, `UNIFIED_WORKSPACE_COMMAND_CENTER_OK` y `LOCAL_STUDIO_EXPORT_ATTACHMENT_OK`.
- `node scripts/repository-assurance.mjs`: PASS, 44/44 comprobaciones estructurales y 0 fallos.
- `server.js` existe en la raíz y delega en `dist/server.js`; la configuración de entrada Express no está ausente en el snapshot revisado.

### Limitaciones de la validación local
El entorno de auditoría dispone de Node.js 22.16.0, mientras el proyecto requiere Node.js 24.x; pnpm no está instalado y Corepack no pudo descargar pnpm por falta de conectividad con el registro npm. No se pudo ejecutar honestamente `pnpm install --frozen-lockfile`, `pnpm run validate`, `pnpm test`, el build de TypeScript/esbuild ni el runtime smoke sobre un artefacto recién construido. Los checks sin dependencias anteriores no sustituyen esas pruebas.

## 3. Bloqueadores confirmados

| ID | Severidad | Hallazgo | Evidencia / impacto | Acción necesaria |
|---|---|---|---|---|
| P0-01 | Crítica | La readiness profunda devuelve HTTP 503 | `/api/v1/readyz` declara `ready=false`; no debe tratarse como producción saludable | Resolver los bloqueos siguientes y repetir el probe desde el mismo despliegue |
| P0-02 | Crítica | Falta `BOOKPI_INTEGRITY_SECRET` válido | El probe informa que falta o tiene menos de 32 caracteres; la persistencia de BookPI no pasa su control de integridad | Configurar un secreto aleatorio de al menos 32 caracteres en Vercel, solo como variable de entorno cifrada; no subirlo al repositorio |
| P0-03 | Crítica | Atlas/Supabase no pasa el probe de persistencia | `atlas-persistence=unavailable`; el servicio remoto no está respondiendo correctamente a la comprobación configurada | Verificar URL, credenciales, permisos, red, esquema/migraciones y health query desde el entorno de Vercel |
| P0-04 | Alta | IKES/Supabase aparece degradado y pendiente | `ikes-memory=degraded`, probe fallido | Validar configuración de IKES, tabla/esquema, permisos de escritura/lectura y una prueba de ida y vuelta |
| P0-05 | Alta | El ledger BookPI heredado es volátil | `bookpi-ledger=degraded`, backend `VOLATILE_IN_MEMORY`; eventos pueden perderse al reiniciar el proceso | Migrar el camino operativo a almacenamiento durable y compartido, comprobar persistencia tras reinicio y documentar la fuente autoritativa |
| P1-01 | Alta | La exportación de telemetría no está verificada | La readiness indica que no hay un probe vivo de exportador | Configurar el exportador elegido y validar una señal de extremo a extremo; si se decide no usarlo, declarar explícitamente el modo sin exportación y ajustar el criterio de readiness |
| P1-02 | Alta | CI principal y Repository Assurance fallan en el último SHA consultado | Ambos workflows muestran `failure`; la respuesta de jobs no aporta pasos ejecutados ni logs concluyentes | Obtener un run con logs completos, identificar la primera causa real y repetir en el mismo SHA. No desactivar los gates para forzar un verde |
| P1-03 | Alta | No hay prueba local válida de build/test en el entorno de auditoría | Node 22 frente a Node 24 requerido; pnpm no pudo instalarse sin red | Ejecutar con Node 24.x y pnpm 10.28.0, usando el lockfile congelado, y conservar logs/artifacts del SHA |
| P1-04 | Alta | No se ha verificado inferencia generativa externa en este corte | Un fallback local no equivale a un modelo generativo remoto; la disponibilidad depende de proveedor, opt-in, credenciales y políticas | Configurar un proveedor aprobado, ejecutar smoke generativo real, comprobar `responseEngine`, latencia, límites y fallback; documentar la salida de datos a terceros |
| P1-05 | Alta | No hay evidencia suficiente para certificar aislamiento y persistencia E2E en producción | El código incluye controles y pruebas, pero no se ha observado aquí un resultado verde y reproducible de CI ni un E2E remoto | Ejecutar pruebas multiusuario/RLS, reinicio, idempotencia, concurrencia y recuperación contra el entorno objetivo |
| P1-06 | Alta si el destino es público | La protección SSO de Vercel está activada para todos los despliegues excepto dominios personalizados | La configuración del proyecto declara `ssoProtection.enabled=true` y el proyecto solo lista alias `vercel.app`; esto puede impedir el acceso de usuarios públicos | Decidir el modo de lanzamiento: conservar la protección para preview/cerrado, o configurar un dominio público y ajustar explícitamente la protección tras revisar las rutas administrativas y sus tokens |

## 4. Riesgos de diseño y verificación pendientes

1. **No confundir liveness y readiness.** `/health` confirma que el proceso atiende; `/api/v1/readyz` determina si las dependencias declaradas están disponibles. La alerta actual es real y debe permanecer visible hasta resolverla.
2. **No presentar el fallback local como inferencia generativa.** Debe mostrarse al usuario qué motor respondió, si la salida procede de un proveedor remoto y cuándo el servicio se degradó.
3. **No almacenar secretos en Git.** Las variables de producción se deben definir en el proyecto Vercel y en los sistemas de secretos autorizados; cualquier secreto expuesto en historial debe rotarse.
4. **No declarar durabilidad por usar PostgreSQL en alguna ruta.** Hay que demostrar que el flujo operativo de evidencia realmente escribe en el backend durable, que el registro es compartido y que sobrevive a un reinicio.
5. **No tratar documentación o pruebas aisladas como certificación.** El estado de cada función debe derivarse de código conectado, tests reales y evidencia del mismo SHA.
6. **No deshabilitar gates para conseguir un despliegue.** Un fallo de CI debe investigarse en el primer paso que falla; el despliegue productivo debe seguir cerrado si el gate no pasa.

## 5. Secuencia de cierre para producción

### Fase A — Secretos y dependencias
- Definir `BOOKPI_INTEGRITY_SECRET` con valor aleatorio de al menos 32 caracteres.
- Revisar las variables exactas de Atlas/Supabase e IKES usando `.env.example` y `docs/ENVIRONMENT.md`; no copiar valores de ejemplo a producción.
- Confirmar conexión desde el runtime Vercel, permisos mínimos y compatibilidad de esquema.
- Verificar que BookPI escribe en un backend durable compartido; reiniciar y comprobar lectura/verificación de eventos anteriores.

### Fase B — Calidad reproducible
Ejecutar en un runner compatible con Node 24.x y pnpm 10.28.0:
```bash
corepack enable
corepack prepare pnpm@10.28.0 --activate
pnpm install --frozen-lockfile
pnpm run validate
pnpm run smoke:production
pnpm run verify:production
```
La prueba de producción requiere que las dependencias que correspondan estén disponibles. Guardar logs y artefactos ligados al SHA exacto. Ejecutar además la suite Rust con `cargo test --workspace --locked`, `cargo clippy --workspace --all-targets --locked -- -D warnings` y `cargo audit`, y la verificación Maven del plugin si esos componentes forman parte del release.

### Fase C — Pruebas de aceptación en Vercel
- `GET /health` responde 200.
- `GET /api/v1/readyz` responde 200 y muestra evidencia consistente de dependencias listas.
- Conversación local: saludo, continuidad de historial, entrada vacía, payload excesivo y límites de sesión.
- Inferencia externa: respuesta de un proveedor real y explícitamente autorizado, identificación del motor y medición de latencia.
- Fallback: caída o timeout del proveedor, respuesta dentro del presupuesto de tiempo y sin duplicar operaciones.
- Seguridad: rutas administrativas protegidas, límites de tasa, secretos ausentes en respuestas/logs, aislamiento de datos y prueba de persistencia después de reinicio.
- Despliegue: CI verde para el SHA exacto, smoke posterior al despliegue y rollback ensayado.

## 6. Cambios realizados en este corte

Esta auditoría registra hallazgos y acciones de cierre; **no afirma que los bloqueos de infraestructura hayan sido resueltos por cambios de código**. Los secretos, credenciales, permisos de Supabase, el exportador de telemetría y los servicios externos requieren configuración y validación en las cuentas de despliegue. No es correcto inventar esos valores ni cambiar la readiness para que informe verde sin evidencia.

## 7. Criterio de salida

La liberación solo puede declararse cuando:
- la suite CI completa pasa en el commit que se va a desplegar;
- la compilación y los smoke tests de producción pasan;
- `/api/v1/readyz` devuelve 200 por razones verificadas;
- BookPI e IKES demuestran persistencia y aislamiento reales;
- al menos una ruta de inferencia generativa aprobada funciona y su fallback está probado;
- los controles de seguridad, monitoreo, recuperación y rollback tienen evidencia del mismo release.

**Estado final al corte:** despliegue accesible; preparación profunda bloqueada; no certificado para producción completa.


## Origen: `docs/audits/PROFILE-ECOSYSTEM-REVIEW-2026-10.md`

# Isabella / TAMV GitHub portfolio review

**Review date:** 2026-10-11  
**Scope:** repository inventory visible to the connected GitHub integration, targeted review of the Isabella-related repositories, and implementation work on `isabella-V6-TINA-h6`.  
**Evidence rule:** this is a repository-level engineering review, not a claim that every file in every repository has been exhaustively reviewed or that any system is production-certified.

## Executive assessment

The portfolio contains multiple generations and surfaces of Isabella: a public TINA runtime, a separate detailed `isabella-ai-tina` repository, `isabella-s-crown`, `isabella-s-genesis-ai`, `isabella-villasenor-ai`, `isabella-s-core-intelligence`, `isabella-sovereign-ai`, and TAMV-facing documentation and prototypes. This creates useful research breadth, but the canonical implementation boundary is not consistently obvious from repository documentation.

The target `isabella-V6-TINA-h6` is a private repository whose README largely mirrors the public `Isabella-V6-TINA` runtime documentation. Some badges and links still point at the public repository. The target has a distinct name but no visible evidence in its README of a documented fork/derivation policy, source-of-truth declaration, or synchronization contract.

## Cross-repository findings

| Repository | Evidence reviewed | Finding | Recommended disposition |
|---|---|---|---|
| `Isabella-V6-TINA` | README and project identity | Most complete reviewed runtime narrative: explicit maturity limits, security, readiness, latency, IGE and release gates. It also references PRs #18/#19 in that repository. | Treat as an upstream reference only if that is the intended source of truth; do not assume PRs or branch state transfer to h6. |
| `isabella-V6-TINA-h6` | README, package manifest, CI, assurance scripts, ops module and tests | Private derivative with TypeScript runtime and IGE-Ω documentation. CI requires pnpm frozen installation; the branch contains `pnpm-lock.yaml` and now pins the package manager version. | Keep isolated on a review branch, repair dependency reproducibility before release, and define whether h6 is upstream, downstream, or a release candidate. |
| `isabella-ai-tina` | README and version/status section | Detailed architecture and governance document; identifies package version 4.3.3 and describes a local TESTED status dated 2026-10-08. The document itself cautions that local tests do not imply production certification. | Reconcile its contracts, release status and capabilities with the selected canonical runtime using code-level diffs, not README similarity alone. |
| `isabella-s-crown` | README | README is primarily a research prompt and Lovable starter instructions, rather than a reproducible module contract or release record. | Extract actual CROWN implementation only after inspecting source, dependencies, tests and license; do not treat its README as proof of a production-ready subsystem. |
| `genesis-digytamv-nexus` | README | README remains generic Lovable project scaffolding and does not establish a technical integration contract with the TINA runtime. | Classify as a prototype/UI surface unless source and tests prove a deeper role. |
| `DOCUMENTACION-TAMV-DM-X4-e-ISABELLA-AI` | Profile inventory and repository identity | Large documentation repository that appears central to the TAMV/Isabella architecture narrative. Its claims must be mapped to implementation evidence. | Use it as a specification source only after mapping each claim to a code path, test and deployment artifact. |
| `isabella-s-genesis-ai`, `isabella-s-core-intelligence`, `isabella-villasenor-ai`, `isabella-sovereign-ai`, `isabella-mexa` | Repository inventory/search results | Multiple related implementation surfaces exist; names alone do not establish code overlap, maturity or compatibility. | Perform a license-aware source/API/dependency comparison before copying or merging code. |

## Target repository: confirmed engineering gaps

1. **Dependency reproducibility — toolchain pin applied.** `pnpm-lock.yaml` uses lockfile format 9; `package.json` now declares `packageManager: pnpm@10.28.0` and Node `24.x`, and CI uses pnpm `10.28.0`. Vercel confirmed the lockfile was current during install. The latest source changes still require their own completed build.
2. **Rust workspace verification — release blocker.** The `ige-omega/` workspace manifest exists and declares eight crates, but `ige-omega/Cargo.lock` was not found. Rust formatting, clippy, tests, PostgreSQL integration tests and release build must run in CI against the exact release SHA.
3. **Repository identity drift.** README badges and upstream PR references point to `OsoPanda1/Isabella-V6-TINA`, not the h6 repository. That can mislead maintainers about which repository's checks and pull requests apply.
4. **Runtime input validation.** The production-ops module accepted non-finite rate-limiter values and did not prevent time rollback from moving the refill watermark backward. Circuit-breaker half-open state did not serialize the recovery probe. Invalid maintenance-window timestamps were silently treated as inactive.
5. **Evidence semantics.** The assurance scripts are structural checks. Their PASS result does not prove runtime security, provider connectivity, PostgreSQL persistence, PQC operation, model training, production health or certification. Keep this distinction explicit.
6. **ML scope.** Genesis routing consumes externally supplied scores and ranks them deterministically. That is not evidence of learned weights, local model training, native GPU serving or a proprietary foundation model.
7. **Canonical ownership and license provenance.** Related repositories should not be merged solely because they share a brand. Compare licenses, code origins, public APIs, schemas, tests and secret-handling boundaries before reusing code.

## Implemented in this review branch

- Validated token-bucket capacity, refill rate, costs and timestamps as finite and within explicit bounds.
- Prevented clock regressions from rewinding the token-bucket refill watermark.
- Validated circuit-breaker thresholds, recovery duration and timestamps.
- Serialized the half-open circuit-breaker probe so only one request tests recovery at a time.
- Rejected invalid timeout values.
- Made malformed or inverted maintenance windows fail explicitly rather than silently appearing inactive.
- Added regression tests for each of these boundary conditions.

These changes are committed to `evolution/runtime-hardening-2026-10`. They are not considered verified until CI reports a successful run on the resulting commit.

## Required next gates

1. Keep the committed pnpm lockfile, `packageManager` pin, and frozen CI installation synchronized.
2. Generate and commit `ige-omega/Cargo.lock`; run `cargo fmt --all -- --check`, `cargo clippy --workspace --all-targets -- -D warnings`, `cargo test --workspace`, and release build.
3. Run TypeScript typecheck, full Vitest suite, build, security suite and production-evidence gate on the same SHA.
4. Test PostgreSQL integration and tenant/session isolation with a disposable database; test backup/restore and migrations.
5. Inspect actual callers of CROWN, AEGIS, IKES, VERITAS, BookPI and HSF to prove fail-closed behavior at every privileged boundary.
6. Reconcile the target README and API contracts with the chosen upstream and record the relationship in a versioned architecture decision.
7. Do not merge or deploy while required checks are missing, inconclusive or red.

## Release principle

A repository can contain substantial code and still lack a reproducible release path. Isabella's readiness must be measured from executable behavior, tests, configuration and evidence tied to the exact commit—not from architecture diagrams, repository size, naming, or aspirational documentation.


## Follow-up status refresh — 2026-10-11

- Re-read `pnpm-lock.yaml` from `evolution/runtime-hardening-2026-10`: the file is present and uses lockfile format `9.0`. The earlier statement that the lockfile was absent was incorrect and is superseded by this correction.
- This historical finding was superseded: `package.json` now pins `pnpm@10.28.0` and Node `24.x`.
- `ige-omega/Cargo.lock` is still absent; the new Rust CI job will intentionally fail at its explicit lockfile gate until a genuine lockfile is generated and committed.
- GitHub Actions run records for the previous head report `startup_failure` and expose no jobs/step logs through the connector. Vercel deployment `dpl_Cu3MQGLBPGmcVqX4w4YDSWEMMRhp` identified a concrete TypeScript build failure in `src/atlas/persistence.ts`: the inferred `Response` type did not expose `ok`, `text`, `status`, `statusText` or `json`. Updated `tsconfig.json` to include `DOM` and `DOM.Iterable` alongside `ES2022`, so the standard Fetch API response types are available. This is a targeted corrective change, not yet a verified fix: the new commit must be rebuilt and the deployment logs rechecked. Do not mark the branch green until CI confirms it.

- The active Vercel build log confirmed the lockfile is up to date and the deployed toolchain was pnpm `10.28.0`; `package.json` now pins `packageManager: pnpm@10.28.0` and Node `24.x`, and CI uses the same pnpm version. This removes the previous implicit toolchain selection. New deployments were queued for these commits; their final results were not yet available at the time of this update.


## Conversational interaction hardening — 2026-10-11

- Updated `POST /api/v1/cognition/route` for automatic model selection: Gemini is attempted when `GEMINI_API_KEY` or `MODEL_API_KEY` is configured; otherwise the Open Science gateway is attempted; a deterministic local fallback remains available and is identified separately in `responseEngine`.
- Added bounded public conversation context (maximum eight prior turns; each message capped at 2,000 characters) and only permits `user`/`assistant` roles. Client history is untrusted context and never grants identity, memory access, tool access, or authority.
- Added provider request timeouts using `INFERENCE_TIMEOUT_MS` bounded to 3–30 seconds (default 15 seconds) and rate-limited hosted model requests.
- Updated the UI default to `auto`, sends ephemeral in-page history, and clears that history on refresh. The user can explicitly choose the local sovereign fallback.
- Vercel had completed a build for the earlier conversation commit `fd223b2`; later changes for system-instruction isolation, provider timeouts, and the documentation refresh were still building/queued during this update. Do not claim the latest SHA is deployed or that a live conversation test has passed until its deployment is `READY` and a real request is tested.
- `ige-omega/Cargo.lock` remains absent; the Rust verification gate is intentionally blocked pending a genuine lockfile and full Rust CI.


## Serverless runtime gate — 2026-10-11

- Live HTTP probes against the previously `READY` preview returned `500 FUNCTION_INVOCATION_FAILED` for both `/health` and `/api/v1/isabella/status`; runtime logs were unavailable through the current retention window. A ready build therefore was not equivalent to a working HTTP application.
- Added a default export for the Express app and guarded `app.listen()` so a Vercel serverless cold start does not open a separate listening socket. The first deployment of that change failed TypeScript with `TS2742` because the inferred Express application type was not portable; corrected it with an explicit `Application` annotation.
- The deployment for the type-annotation fix was still building at the time of this audit update. The serverless handler change must be considered unverified until the newest deployment reaches `READY` and `/health` returns HTTP 200. Then test the chat route with a real POST and verify provider response metadata.
- Critical release gates remain: no verified Rust `Cargo.lock`/Rust CI, no successful live chat POST test, and no verified latest-SHA test suite. Keep the PR in draft and do not promote to production.


## ESM module-resolution finding and regression gate — 2026-10-11

- The first startup smoke-test build failed with `ERR_MODULE_NOT_FOUND`: Node ESM could not resolve the extensionless internal import `dist/genesis/runtime` emitted by plain `tsc` into `dist/server.js`. This provides a concrete explanation for the earlier serverless invocation failures; a successful TypeScript compile had not produced a directly executable Node ESM entrypoint.
- Added the already-locked `esbuild@0.28.2` as an explicit development dependency and changed the build to bundle `src/server.ts` into `dist/server.js` (`platform=node`, ESM, external package dependencies). The startup smoke script now imports that production artifact, binds it to an ephemeral local HTTP server, checks `GET /health`, and posts a simple conversation to `/api/v1/cognition/route` in explicit sovereign mode.
- The lockfile now declares the existing locked esbuild version in the root importer; the upcoming frozen install/build must confirm consistency. The deployment containing the bundle and smoke gate was queued at the time of this update; neither smoke success nor runtime recovery is yet confirmed.


## AI provider readiness — 2026-10-11

- The runtime smoke test successfully exercised the bundled Express app locally: `/health` returned 200 and the POST conversation route returned 200 with `responseEngine: sovereign`.
- The optional real-model smoke test then attempted the AI Gateway path. It did not generate an LLM response; AI Gateway returned `GatewayInternalServerError` with the explicit account-level reason that a valid credit card must be on file to service requests and unlock free credits. The route correctly fell back to `sovereign-fallback`, but this is not generative LLM conversation.
- Build policy: basic runtime/chat smoke remains blocking; the provider smoke reports failure non-blockingly for preview unless `ISABELLA_REQUIRE_LLM_SMOKE=true` is set. This allows the interface to deploy without falsely certifying external inference. Before a user-facing LLM trial, the account owner must complete AI Gateway billing setup or configure a valid provider key and run the required-model smoke test.
- The selected `inclusionai/ling-3.1-flash-free` model is currently listed as free through October 13, 2026, after which the free model ID stops serving. Long-term operation needs an approved fallback model and billing policy; do not silently switch to a billable model without authorization.


## Latest preview verification — 2026-10-11 16:36 UTC

- Vercel deployment `dpl_FzeX3saUeqiEubCJ8chv44Nuj9XY` is `READY` on commit `0e8cc5393288603fca903666d0d0f326823b423c`.
- Live `GET /health` returned HTTP 200 (`status: healthy`); live `GET /api/v1/isabella/status` returned HTTP 200; live homepage `/` returned HTTP 200 on the immediately preceding deployment that used the same explicit root `server.js` entrypoint.
- Build smoke test reported `RUNTIME_SMOKE_OK` with HTTP 200 for health and a successful POST to `/api/v1/cognition/route` in sovereign mode. The real AI Gateway smoke did not generate an LLM response because Vercel AI Gateway requires a valid credit card on file to service requests. The app therefore falls back to the local deterministic engine; the preview is reachable, but real model-powered chat is not yet verified or available under the current billing state.
- The LLM smoke is now non-blocking for preview builds, but can be made a hard release gate with `ISABELLA_REQUIRE_LLM_SMOKE=true` after AI Gateway billing or a provider key is configured. This distinction must be preserved in release notes and status claims.


## Conversational fallback and latency protection — 2026-10-11

- Implemented `generateSovereignFallback()` as an explicit local conversational fallback. It recognizes greetings, thanks, identity/capability questions, privacy/history questions and TAMV/RDM/IGE topics; for unsupported general questions it asks for context instead of inventing an answer. It explicitly discloses that it is not an LLM and does not claim access to repositories, web or persistent personal memory.
- Added a regression smoke test for greeting → identity follow-up, including two history turns. Vercel build `dpl_43ncKpvTW17ntBe6NtU662HhBkHH` completed successfully and logged `LOCAL_CONVERSATION_SMOKE_OK` with health/chat/follow-up HTTP 200.
- Added a 60-second default process-local cooldown after AI Gateway failure (configurable with `PROVIDER_FAILURE_COOLDOWN_MS`, bounded 10–300 seconds) to avoid repeatedly waiting for the provider in a warm instance. Serverless cold starts can reset this in-memory cooldown; it is latency protection, not a distributed circuit breaker.
- Latest commit `75f8891295577793ff78d5cc6b4053b8b62dd68e` is still building at the time of this note. The prior commit's smoke confirms the new conversational fallback; the latest cooldown change still requires the latest build to reach READY and its smoke output to be checked.
- External LLM remains blocked by Vercel AI Gateway billing (`GatewayInternalServerError`, card required). To activate genuine generative chat, the account owner must enable Gateway billing or configure a valid `GEMINI_API_KEY` / `MODEL_API_KEY` in the Preview environment. No key was invented, and no paid model was silently selected.


## Origen: `docs/audits/RESPUESTA-AUDITORIA-EXTERNA-2026-10-24.md`

---
state: draft
date: 2026-10-24
---
# Respuesta a la auditoría externa (E1–E25 / A1–E25) — verificada contra el repo real

El autor de la auditoría solo vio archivos de configuración, no `src/`. Cada punto se comprobó contra `main`; **no se aplicó nada por fe**.
Leyenda: ✅ corregido aquí · ❌ no aplica (ya resuelto o incorrecto) · ⛔ bloqueado (necesita red/lockfile/decisión) · 📌 pendiente.

| # | Veredicto | Evidencia / acción |
|---|---|---|
| E1 secretos en compose | ✅ | `DATABASE_URL` con `:secret@` en `docker-compose.yml` → ahora `${DATABASE_URL:?…}` desde `.env` no versionado. Solo existe el servicio `app` (no `isabella-web`). Test `hardening-guards` lo impide. |
| E2 caddy/otel/vm sin límites | ✅ | `no-new-privileges`, `cap_drop: ALL` (caddy con `NET_BIND_SERVICE`), `read_only`, límites de memoria en caddy/otel/victoriametrics/crowdsec/app. Postgres/ollama sin `cap_drop`: no verificable sin Docker. |
| E3 `version: '3.8'` | ✅ | Eliminado. |
| E4 `.env.example` duplicado | ❌ | 0 claves duplicadas (comprobado). Se añade `scripts/check-env-example.mjs` (duplicados, secretos reales, variables sin documentar) + CI + test. |
| E5 no-console/PII | 📌 | Ya existe `src/security/secret-scanner.ts` (y tenía un bug real, ver abajo); falta enlazarlo a CI. |
| E6 tsconfig excluye capas | ✅/📌 | Se crea `tsconfig.layers.json` + `pnpm typecheck:layers` (CI advisory) y test que obliga a que toda exclusión esté cubierta. Quitar las exclusiones del typecheck principal queda 📌 hasta correr `typecheck:layers` con dependencias reales (en el sandbox solo se pudo con tipos de Node). |
| E7 tsconfig.build | 📌 | Emite solo desde `src/server.ts` (esbuild empaqueta); no hay consumidores externos de tipos. Sin acción. |
| E8 coverage | ✅ parcial | Config `coverage` v8 + `pnpm test:coverage`. ⛔ Falta `@vitest/coverage-v8` en devDependencies (no se puede tocar el lockfile sin red); umbrales sin fijar hasta medir línea base. |
| E9 rewrite catch-all | ❌ | El runtime Express sirve los estáticos; el catch-all a `/api` es por diseño. |
| E10 `api/index.js` | ❌ | Existe `api/index.js`. |
| E11 ESLint deprecated | ⛔ | `eslint@9.39.5` en lockfile; requiere regenerar lock con red. |
| E12 braintrust ARM | 📌 | Verificar en CI ARM; no reproducible aquí. |
| E13 `no-explicit-any` no aplica a capas | 📌 | `eslint.config.mjs` ignora las mismas rutas. Quitar `ignores` solo tras `typecheck:layers` verde (no se puede ejecutar ESLint aquí). |
| E14 RUNBOOK numeración | ❌ | Encabezados sin secciones duplicadas (comprobado). |
| E15 scripts/config referenciados | ❌ | Existen `scripts/{deploy,backup}.sh` y `config/{Caddyfile,crowdsec,otel-collector,postgresql,victoriametrics}.*`. |
| E16 `.sops.yaml` placeholders | ✅ | Son plantilla; `scripts/check-sops-placeholders.mjs` falla si hay un `*.enc.yaml` rastreado con placeholders. |
| E17 SOPS guide numeración | ❌ | Las "4." repetidas están dentro de comentarios del ejemplo. |
| E18/E24 README vs SECURITY | ❌ hoy | El README actual ya no dice "Production-Ready" ni "Quantum-Ready"; sí dice "100 % del alcance de código de esta rama… no equivale a producción". Aun así `docs/STATUS.md` (generado) lista qué capas están fuera del typecheck. |
| E19 metadata capability | 📌 | `MAJOR_CAPABILITY_SERVER_SIDE_GEMINI_API` único; decidir lista real de capabilities. |
| E20/E22 Prisma 8 rc vs client 7 | ⛔ | `prisma@8.0.0-rc.23` / `@prisma/client@^7.10.1` desalineados; solo se usa en `src/lib/**` (excluido). Alinear requiere regenerar lockfile. |
| E21 `next` solo en overrides | 📌 | No hay workspace `web/`; quitar el override o declarar dependencia. |
| E23 workspace `web` | ❌ | No existe `pnpm-workspace.yaml` ni `web/`. |
| E25 secreto de test fijo | ❌ | Es explícitamente de test (`NODE_ENV=test`); cambiarlo rompería firmas deterministas. |

## Bugs reales encontrados al desbloquear las capas excluidas del typecheck
- ✅ `src/security/secret-scanner.ts`: `scanDirectory` usaba `this` dentro de una función anidada → `TypeError` en cuanto había una entrada. Convertida a arrow function. Además `addExcludePattern` mutaba el array global compartido entre instancias (fuga entre instancias) → copia por instancia. Tests: `test/security/secret-scanner.test.ts`.
- ✅ `src/security/pqc/hybrid-crypto.ts`: `createCipheriv("ChaCha20-Poly1305", …)` sin `authTagLength` lanza en Node; y los tipos `Cipheriv` no exponen `setAAD/getAuthTag`. Ahora `{ authTagLength: 16 }` + `CipherGCM/DecipherGCM`. Tests de ida y vuelta y de manipulación para ambos algoritmos: `test/security/hybrid-symmetric.test.ts`.

## Pendiente real (requiere red / decisión)
1. Regenerar lockfile: alinear Prisma, actualizar ESLint, añadir `@vitest/coverage-v8`.
2. Correr `pnpm typecheck:layers` con dependencias reales; corregir lo que salga y entonces quitar las exclusiones de `tsconfig.json` y de `eslint.config.mjs`.
3. Pruebas con Docker real de los endurecimientos de compose (`read_only`, `cap_drop`).
4. Decidir capabilities de `metadata.json` y retirar el override de `next`.


## Origen: `docs/audits/TECH-DEBT-REDUCTION-2026-10-13.md`

# Reducción de deuda técnica — iteración 2026-10-13

**Ámbito:** continuación de `docs/audits/TOTAL-AUDIT-2026-10-13.md` (que mide el SHA `deb26b9`
y no se reescribe). Este documento registra los cambios posteriores a esa fotografía sobre la
rama `main`.

**Invariante de evidencia:** un test verde demuestra una capacidad computacional local, **no**
autoridad, aprendizaje, integración ni producción. Este lote más cerca de mantenible, no de
*certificado*.

## Cambios aplicados

### TD-01 — Monolito `src/server.ts` (P1, apertura)

- **Contrato de rutas congelado.** `test/deployment/route-inventory.test.ts` parsea estáticamente
  todos los módulos de `src/` y compara contra `test/deployment/route-inventory.json` (71 rutas).
  Fija la superficie HTTP antes de mover código y falla si una extracción pierde o renombra un
  endpoint. También verifica que ningún literal de ruta se registre en dos módulos.
- **Primera extracción cohesiva.** Las siete rutas de HyperCore Ω (`modes`, `run`, `predict`,
  `skills`, `skills/execute`, `mcp`) se movieron a `src/routes/hypercore.ts` detrás de
  `registerHyperCoreRoutes(app, deps)` **sin cambio de comportamiento**. `src/server.ts` pasó de
  ~5037 a ~4863 líneas y cede el bloque a una dependencia explícita (registry de skills, ledger,
  `authorizeApiToken`, `enforceRateLimit`, `commerceStringField`).
- **Inventario estático reparado.** `scripts/route-inventory.mjs` parseaba sólo `src/server.ts`;
  ahora recorre todo `src/**/*.ts`, por lo que el inventario en `docs/api/` sigue siendo veraz
  tras la extracción (71 rutas, incluidas las de `src/routes/hypercore.ts`).

### TD-05 — Estado volátil (P1, parcial)

- **Persistencia del registro de pasaportes (GAME OVER).** Nuevo puerto `PassportStorePort`
  (`src/gameover/passport-store.ts`) con implementación JSON-file de escritura atómica
  (`createJsonPassportStore`, temp-file + rename) y una variante en memoria para pruebas.
  `createPassportAuthority` acepta `store`, carga al construirse y persiste en cada `issue`/`revoke`.
  Un archivo corrupto falla en voz alta (`PASSPORT_STORE_CORRUPT`) en vez de descartar registros.
  Se cablea desde el entorno con `GAMEOVER_PASSPORT_PATH`; sin la variable, sigue en memoria
  (compatibilidad).
- **Directorio del ledger BookPI.** `DurableBookPiLedger` ahora crea su directorio en el constructor,
  de modo que la readiness en el arranque refleja un volumen escribible en vez de reportar
  `unavailable` hasta el primer append.

### TD-08 — Duplicación de gates (P3, corregido)

- `validate` pasa de `typecheck && test && build && security:suite` a `typecheck && build`, dado que
  `build` ya ejecuta `vitest` y `security:suite`. Se elimina la doble corrida de la suite y de
  seguridad sin perder cobertura.

### Herramientas nuevas (no deuda pendiente, capacidad local)

- `scripts/generate-native-keys.mjs` (`pnpm run keys:generate`): emite las claves **nativas** del
  proyecto (secretos HMAC `BOOKPI_INTEGRITY_SECRET` y `HYPERCORE_SIGNING_KEY`; tokens bearer
  `GENESIS_ADMIN_API_TOKEN`, `HYPERCORE_API_TOKEN`, `HSF_API_TOKEN`,
  `GENESIS_HUMAN_APPROVAL_TOKEN`; `CONNECTOR_WEBHOOK_SECRET`, `WEBHOOK_SIGNING_SECRET`,
  `TOKEN_ENCRYPTION_KEY`; y el par Ed25519 de aprobación humana) en `.env.native` (ignorado por
  git, modo `0o600`). No genera claves de proveedores externos. Arranque: `pnpm run start:native`.
- `scripts/verify-production.ts` ya documentado; sin cambios en este lote.

## Evidencia local reproducida

- `pnpm typecheck` — exit 0.
- `pnpm test` — **886 aprobadas / 158 archivos**.
- `pnpm run build` — RA **29/29**, smokes de UI/runtime en verde, `security:suite` **14/14**.
- `pnpm run verify:production` — 4/4 PASS + `PRODUCTION_VERIFY_OK`.
- Arranque real con claves nativas (`node --env-file=.env.native dist/server.js`): `GET /health`
  **200**; `GET /api/v1/healthz` **503** con `bookpi-ledger` y `signing-authority` **healthy**
  (ambas requeridas) y las dependencias opcionales (inferencia externa, persistencia, OTLP) en
  `degraded` por falta de credenciales/entorno.

## Deuda pendiente (no resuelta aquí)

- **TD-01 (resto):** quedan ~4863 líneas en `src/server.ts` (HTML embebido y decenas de rutas por
  extraer por dominio). El contrato de rutas y el patrón `registerXxxRoutes` quedan listos para
  continuar.
- **TD-04** (PR #5), **TD-06/TD-07** (gates externos) — sin cambios; dependen de revisión humana,
  credenciales y un runner de CI operativo.
- TD-05 sigue parcial: cachés compactas de HyperCore, prefetch y cooldown de proveedor siguen en
  memoria; los pasaportes Java no se tocan en este lote.


## Origen: `docs/audits/TECHNICAL-OPERATIONAL-AUDIT-2026-10-13.md`

# Auditoría técnico-operativa consolidada de Isabella V6 — 13 de octubre de 2026

## Resumen corto consolidado (fuente anterior: `docs/audits/AUDIT-2026-10-13.md`)

state: draft | engine-generated (pendiente de revisión humana con nombre)

## Corregido (con prueba de regresión)
- AUD-01 `deriveSessionId` anónimo: CSPRNG en vez de `Math.random`+`Date.now`.
- AUD-02 `verify_event`: comparación en tiempo constante, firma no-string = inválida; `sign_event` hashea payload canónico (orden de claves irrelevante).
- AUD-03 motor local: respuestas deterministas por relevancia, sin `Math.random`.
- AUD-04 `bookpi/merkle.ts`: el esquema v1 duplica la hoja impar ([a,b,c] ≡ [a,b,c,c]). Se añade esquema v2 RFC 6962 (`merkleRootV2`, `generateChunkProofV2`, `verifyChunkProofV2`); v1 se conserva por compatibilidad y los protocolos `bookpi.register/verify` devuelven ambos.
- AUD-05 OpenAPI: documentadas las rutas REINA y el esquema `AdminBearer`; ruta pública `reina/status` con rate limit.
- AUD-06 HTTP: sin manejador de errores final (JSON inválido devolvía HTML de Express, con stack fuera de producción) → `classifyHttpError` devuelve JSON seguro (400/413/415/500).
- AUD-07 Fuerza bruta sobre tokens admin sin freno → `AuthFailureThrottle` (10 fallos/5 min → 429 antes de comparar), memoria acotada.
- AUD-08 Sin `trust proxy`: tras un balanceador todos los clientes compartían cubeta de rate limit → `TRUST_PROXY=<saltos>` (solo enteros 1..10).
- AUD-09 Cabeceras: HSTS en producción, COOP, CSP estricta + `Cache-Control: no-store` en `/api/*`.
- AUD-10 (2026-10-16) Stripe: eventos duplicados se reprocesaban y un `updated` tardío podía resucitar una suscripción cancelada → `WebhookInbox` + `EventOrderGuard`.
- AUD-11 Los grupos de rutas aceptan `authorizeAdmin` opcional (abierto en desarrollo): se añade guarda estática que exige cablear una compuerta en cada `register*Routes` de `server.ts`.
- AUD-12 Fuzz de ReDoS sobre AEGIS, VIGIA, CROWN y sanitización: sin hallazgos. Un regex de email propio (nuevo) era cuadrático y se acotó antes de integrarse.

## Pendiente (no resuelto)
- OpenAPI cubre 15 de ~77 rutas; el resto necesita contratos con esquema real (no se inventan).
- `process.env` leído fuera de `config.ts` en varios módulos; CSP solo en unified-gateway.
- BookPI en runtime es volátil por defecto; sin WORM ni anclaje RFC 3161.
- ML-KEM/ML-DSA siguen BLOCKED_ENVIRONMENT (requieren KMS/HSM).
- Gates oficiales (`pnpm typecheck/test/build`) no ejecutados aquí (npm bloqueado): se usó typecheck local con tipos de Node y un arnés de pruebas; el CI de GitHub es la verificación válida.

---

## Informe técnico ampliado

**Estado:** `draft | engine-generated`; requiere revisión humana antes de declararse verificada.  
**Repositorio:** [OsoPanda1/ISABELLA-VERSION-TERMINUS-V6](https://github.com/OsoPanda1/ISABELLA-VERSION-TERMINUS-V6)  
**Rama de trabajo:** `audit/hardening-2026-10-13`  
**Alcance:** inspección remota del código, pruebas, configuración HTTP, workflow CI, manifiesto Ingress y documentación visible.  
**Limitación importante:** esta auditoría no equivale a una revisión línea por línea de todo el repositorio, un pentest, ni una ejecución local de la suite. No se declara que los tests hayan pasado por el mero hecho de añadirlos.

## 1. Dictamen ejecutivo

Se identificó y corrigió un defecto de seguridad en el limitador de solicitudes: al alcanzar la capacidad máxima de claves, el algoritmo anterior eliminaba cubetas activas. Un cliente podía provocar presión de claves y hacer que se perdiera el historial de cuota de otros clientes, debilitando el rate limit. La implementación corregida recupera únicamente ventanas vencidas y rechaza nuevas claves mientras no haya capacidad libre.

También se corrigió una divergencia operativa entre el límite global de cuerpo JSON de Express (`256kb`) y el manifiesto NGINX Ingress (`8m`), incluido un comentario que afirmaba erróneamente que ambos límites coincidían. El Ingress ahora usa `256k`, de forma coherente con el parser global. Cualquier aumento posterior requiere revisar límites de Express y de cada endpoint en conjunto.

**Estado de liberación: NO CERTIFICADO PARA PRODUCCIÓN.** Las correcciones de código no resuelven por sí solas los gates externos de despliegue, CI, persistencia compartida, KMS/HSM, pruebas de carga y validación E2E que el propio repositorio identifica como pendientes.

## 2. Hallazgos y acciones

### AUD-SEC-001 — Evasión del rate limit mediante presión de claves

- **Severidad:** alta para el control de abuso; requiere considerar el contexto de exposición y la configuración del despliegue.
- **Archivo afectado:** `src/security/rate-limit.ts`.
- **Causa raíz:** al superar `maxKeys`, el código anterior borraba las entradas más antiguas, incluso si sus ventanas seguían activas. Las claves eran controlables indirectamente a través del tráfico que alimentaba el limitador.
- **Impacto:** el historial de consumo de una clave activa podía desaparecer bajo una inundación de claves nuevas. Esto debilitaba la garantía del límite por cliente y permitía presión de memoria/tráfico para forzar desalojos.
- **Corrección aplicada:** validación estricta de `maxKeys`; limpieza exclusiva de ventanas vencidas; rechazo fail-closed de claves nuevas si el mapa sigue lleno; conservación de las cubetas activas.
- **Pruebas añadidas:** inundación de 100 claves, preservación de cuota de una clave existente, recuperación al vencer una ventana, validación de capacidad y comportamiento ante retroceso del reloj.
- **Riesgo residual:** el limitador sigue siendo de proceso. En varias réplicas, cada instancia mantiene un contador distinto; se necesita un rate limit distribuido en gateway/WAF o un almacén compartido para garantías globales. La política fail-closed bajo saturación también puede rechazar clientes legítimos nuevos hasta que venzan ventanas; es una compensación explícita entre integridad del control y disponibilidad.

### AUD-DEP-001 — Desalineación del límite de cuerpo entre Ingress y aplicación

- **Severidad:** media; inconsistencia operativa y de protección de recursos.
- **Archivos afectados:** `k8s/ingress.yaml` y `src/server.ts` (referencia de configuración inspeccionada).
- **Causa raíz:** NGINX declaraba `proxy-body-size: 8m`, mientras el parser global de Express declaraba `express.json({ limit: "256kb" })`. El comentario del manifiesto afirmaba que el valor de aplicación era 8 MB.
- **Impacto:** solicitudes grandes podían atravesar el Ingress y luego ser rechazadas por la aplicación, haciendo que la configuración y su documentación fueran engañosas. El límite de borde mayor también permitía consumir recursos de red/proxy innecesariamente.
- **Corrección aplicada:** `proxy-body-size: 256k` y comentario actualizado para reflejar el parser global.
- **Riesgo residual:** antes de aumentar el límite global, hay que comprobar los tamaños máximos de audio/imágenes, la expansión de Base64, memoria por solicitud y los límites por endpoint. Un cambio de límite no debe hacerse sólo para acomodar un caso de uso sin pruebas de carga y de rechazo.

### AUD-DOC-001 — Evidencia histórica que puede confundirse con el estado actual

- **Severidad:** media en trazabilidad y gobierno de versiones.
- **Evidencia:** `docs/audits/TOTAL-AUDIT-2026-10-13.md` declara un repositorio/SHA histórico diferente (`isabella-V6-TINA-h6`, `deb26b9`) y 746 pruebas, mientras el README de la rama consultada presenta una evidencia más reciente de 1006 pruebas / 175 archivos.
- **Impacto:** si se presenta el informe histórico como auditoría de la rama actual, se mezclan snapshots y métricas que no corresponden al mismo SHA.
- **Acción recomendada:** conservar el informe anterior como registro histórico, pero etiquetarlo claramente con su SHA y añadir enlaces a informes posteriores. No actualizar cifras de auditoría sin reproducir los comandos en el SHA exacto.

### AUD-CI-001 — CI y gates de producción no demostrados en esta revisión

- **Severidad:** bloqueo de liberación.
- **Evidencia de configuración:** existen workflows de CI, seguridad, evidencia de producción y verificación Rust; la configuración del workflow no demuestra que los jobs hayan terminado satisfactoriamente en la revisión actual.
- **Estado:** pendiente de ejecución observable en el SHA candidato. El README describe problemas de ejecución de CI como `startup_failure`, pero ese estado no se vuelve a certificar aquí como vigente sin inspeccionar una ejecución actual.
- **Acción requerida:** ejecutar typecheck, tests, build, security suite, evidencia de producción y gates Rust en CI sobre el mismo SHA; guardar los artefactos y revisar el resultado real de cada job.

## 3. Cambios implementados en esta rama

1. `src/security/rate-limit.ts`: se elimina el desalojo de cubetas activas y se adopta una política de capacidad fail-closed.
2. `test/security/rate-limit.test.ts`: se añaden casos para inundación de claves, persistencia de cuota, vencimiento, capacidad inválida y retroceso del reloj.
3. `k8s/ingress.yaml`: el tamaño máximo del cuerpo en NGINX se alinea con el límite global del parser JSON.

Los cambios se realizaron en una rama separada; no se sobrescribió directamente `main`.

## 4. Matriz de validación

| Control | Resultado de esta auditoría |
|---|---|
| Inspección estática de los archivos modificados | Realizada |
| Pruebas de regresión nuevas | Añadidas; **pendientes de ejecución** en runner |
| TypeScript/typecheck completo | Pendiente de ejecución |
| Suite completa de pruebas | Pendiente de ejecución |
| Build y smoke UI/runtime | Pendiente de ejecución |
| Security suite | Pendiente de ejecución |
| Validación estructural de Kubernetes/Ingress | Cambio textual inspeccionado; validación de manifiestos pendiente |
| CI observable sobre un mismo SHA | Pendiente |
| Pentest externo / análisis dinámico | No realizado |
| E2E con proveedores, PostgreSQL real, KMS/HSM y clúster | No realizado en esta auditoría |

## 5. Riesgos técnicos que permanecen abiertos

- El limitador de solicitudes y otros estados en memoria no ofrecen coordinación entre réplicas.
- La seguridad de servicio mediante bearer token no sustituye autorización por usuario/tenant, límites de permisos ni aislamiento de datos.
- Las capacidades de proveedores externos dependen de credenciales, cuotas y condiciones del proveedor; una ruta implementada no demuestra una integración E2E operativa.
- Los ledgers locales y los hashes aportan trazabilidad/integridad limitada, pero no prueban la verdad del contenido ni equivalen por sí solos a almacenamiento WORM.
- Los manifiestos Kubernetes no prueban que un clúster esté desplegado, configurado y observado.
- La latencia p50/p95/p99 debe medirse con carga reproducible; no se declara latencia «casi cero» sin datos.
- El informe previo y los contadores de pruebas deben vincularse siempre a un SHA exacto para evitar mezclar evidencia de diferentes versiones.

## 6. Criterios de cierre

No marcar esta auditoría como `verified` hasta que una persona responsable revise el diff y se adjunte evidencia reproducible vinculada al SHA exacto que incluya:

1. Typecheck, suite completa, build, smoke y security suite en verde.
2. Validación del manifiesto Ingress/Kubernetes.
3. Prueba concurrente del limitador bajo carga y, si hay varias réplicas, comprobación de límites globales en el gateway/almacén distribuido.
4. CI de producción y gates Rust ejecutados satisfactoriamente.
5. Pruebas de integración de persistencia, recuperación, permisos y despliegue en el entorno objetivo.

**Conclusión:** se corrigió un defecto concreto de protección contra abuso y una divergencia de configuración de despliegue. El resultado es una mejora verificable en el código propuesto, no una certificación global de Isabella ni una autorización de producción.


## Origen: `docs/audits/TOTAL-AUDIT-2026-10-13.md`

> **AVISO DE TRAZABILIDAD — REGISTRO HISTÓRICO.** Este informe conserva el snapshot que declara en su encabezado (repositorio `isabella-V6-TINA-h6`, SHA `deb26b9` y 746 pruebas). No representa el estado actual de `ISABELLA-VERSION-TERMINUS-V6` ni debe utilizarse como evidencia de la rama actual. Para los hallazgos y correcciones de la revisión del 13 de octubre de 2026, consulte [TECHNICAL-OPERATIONAL-AUDIT-2026-10-13.md](./TECHNICAL-OPERATIONAL-AUDIT-2026-10-13.md). Las métricas posteriores solo son válidas si se reproducen y vinculan al SHA exacto evaluado.

---

# Auditoría total — Isabella V6 / TINA / Genesis

**Fecha:** 13 de octubre de 2026
**Repositorio:** `OsoPanda1/isabella-V6-TINA-h6`
**Rama:** `main`
**SHA auditado:** `deb26b9` (`docs(audit): record GAME OVER hardening and refreshed runtime evidence`)
**Método:** reproducción local de gates + inspección estructural sobre `src/`, `test/`, `docs/`, `.github/` y manifiestos. No es una certificación ni una revisión línea-a-línea de los 228 archivos fuente.

## 1. Dictamen ejecutivo

El árbol en `deb26b9` es **coherente y verde en local**: typecheck estricto sin errores, **746 pruebas en 135 archivos**, build completo (bundle + smoke UI/runtime) y **14/14** controles de seguridad estática. No hay marcadores `TODO/FIXME/HACK` en `src/`, ni `@ts-ignore`/`@ts-expect-error`/`as any`/`: any`, ni dependencias de runtime sin usar.

La deuda técnica dominante es **estructural, no de corrección**: un monolito de 4 567 líneas (`src/server.ts`, 67 rutas), módulos con lógica real sin pruebas (`protocols`, `modules`, `intelligence`), convivencia de dos "HyperCore" con el mismo nombre (V5 heurístico y V6 Ω²), estado en memoria sin durabilidad, y varios gates que dependen de recursos externos (CI, inferencia, PQC/HSM, E2E Postgres). Nada de esto se declara como producción.

## 2. Evidencia reproducida en `deb26b9`

| Gate | Comando | Resultado |
|---|---|---|
| Tipos estrictos | `pnpm typecheck` | exit 0 |
| Pruebas | `pnpm test` | **746 aprobadas / 135 archivos** |
| Build completo | `pnpm build` | exit 0 (tsc + vitest + esbuild + `node --check` + smoke UI + smoke runtime) |
| Seguridad estática | `pnpm run security:suite` | **14 passed / 0 failed / 0 not_applicable** |

Smoke observados: `UI_NAVIGATION_SMOKE_OK`, `CINEMATIC_INTRO_12_SCENES_OK`, `PUBLIC_API_GUARDRAILS_OK`, `LOCAL_CONVERSATION_SMOKE_OK`. El smoke de inferencia externa se **omite** por falta de credenciales elegibles (`LLM_GATEWAY_SMOKE_SKIPPED`); no se afirma proveedor real operativo.

## 3. Inventario medido

- **Código:** 228 archivos `.ts` en `src/` (43 módulos de primer nivel); 136 archivos de prueba en `test/`.
- **Monolito:** `src/server.ts` = 4 567 líneas, **67 rutas**; el siguiente archivo más grande es `src/genesis/runtime.ts` (678 líneas).
- **Dependencias:** 6 de runtime (`@ai-sdk/gateway`, `@google/genai`, `ai`, `express`, `tsx`, `ws`) + 5 de desarrollo. Verificación de uso: todas se importan o se usan vía CLI/config; sin dependencias muertas.
- **Vulnerabilidades:** **0 alertas Dependabot abiertas** (13 resueltas en `f1d5f03`).
- **CI:** los 6 workflows están presentes y son YAML válido, pero los runs terminan en `startup_failure` sin jobs (bloqueo de cuenta, externo; ver TD-07).
- **Rust:** `ige-omega/Cargo.lock` presente (237 paquetes) y `cargo fmt --all -- --check` limpio; compilación/clippy/test locales no ejecutables (sin `link.exe`/MSVC).
- **PRs/branches:** PR **#5** en borrador (Terminus Ω + fixes BookPI; 26 archivos, +2567/−278, `MERGEABLE`) y rama `feat/terminus-bookpi-retention-sharded-storage-2026-10` sin PR. No integrados.
- **Autores:** 3 generaciones de trabajo (`TAMV ONLINE ENTERPRISE`, `OsoPanda1`, `v0`) – procedencia mixta documentada por commit (`Provenance:`/`State:`).

## 4. Registro de deuda técnica priorizada

| ID | Prioridad | Deuda | Impacto | Estado |
|---|---|---|---|---|
| TD-01 | P1 | Monolito `src/server.ts` (4 567 líneas, 67 rutas, HTML embebido). | Mantenibilidad, riesgo de regresión, testabilidad baja. | Abierto. Extracción incremental por dominio prevista. |
| TD-02 | P1 | Módulos con lógica real sin pruebas: `src/protocols` (9 contratos), `src/modules/registry`, `src/intelligence/adaptive-router`. | Cobertura insuficiente en fronteras ejecutables. | **Corregido parcialmente en esta iteración** (ver §4). |
| TD-03 | P2 | Dos "HyperCore": `src/evolution/hypercore.ts` (V5 heurístico) y `src/hypercore/` (V6 Ω²). | Ambigüedad de nombres. | **Documentado** con comentario de cabecera; fusión no procede (contratos distintos). |
| TD-04 | P1 | PR #5 (Terminus Ω: erasure-code, mandate, retention, sharded-store, storage-postgres) en draft, sin integrar. | Funcionalidad y fixes pendientes fuera de `main`. | Abierto; requiere revisión de contrato y gates antes de merge. |
| TD-05 | P1 | Estado volátil en memoria: passports (TS y Java), cachés de HyperCore, prefetch, cooldown de proveedor. | Sin durabilidad entre reinicios/réplicas. | Abierto. |
| TD-06 | P1 | Capacidades que dependen de recursos externos: inferencia real, PQC FIPS 203/204/205 (HSM/KMS), E2E Postgres/Supabase, RLS. | Estados `specified`/`blocked`, no `verified`. | Abierto (externo). |
| TD-07 | P0 | GitHub Actions `startup_failure` sin jobs. | Sin CI reproducible. | Bloqueado por cuenta; requiere acción humana de admin/facturación. |
| TD-08 | P3 | `build` ejecuta `vitest` + `security:suite`, y `validate` los repite. | Trabajo duplicado en el gate. | Abierto (bajo impacto). |
| TD-09 | P3 | `tsx` figura en `dependencies` (herramienta de desarrollo). | Higiene del manifiesto. | Abierto; no se cambia ahora por dependencia del script `start`. |

## 4. Correcciones aplicadas en esta iteración

- **TD-02 — Pruebas de regresión** para fronteras ejecutables antes sin cobertura:
  - `test/protocols/registry.test.ts`: alta, duplicados, desconocido, inmutabilidad y propagación de contexto (`requestId`/`traceId`) en `execute`.
  - `test/protocols/catalog.test.ts`: unicidad de IDs, firma/verificación de eventos (round-trip y manipulación), Merkle (`bookpi.register`/`verify`) y rechazo de tipo de evento Atlas desconocido.
  - `test/modules/registry.test.ts`: alta, duplicados, desconocido y congelado de descriptor/capacidades.
  - `test/intelligence/adaptive-router.test.ts`: clases de complejidad, supresión de aceleración en riesgo `CRITICAL`, política de caché y fan-out.
- **TD-03 — Comentario de cabecera** en `src/evolution/hypercore.ts` que marca explícitamente el contrato V5 heurístico y lo distingue del módulo V6 Ω² (`src/hypercore/`).

## 5. Próximos lotes (prioridad sugerida)

1. **TD-01:** extraer de `src/server.ts` un primer grupo cohesivo (p. ej. rutas HyperCore o helpers de proveedores) a un módulo propio, con una prueba de inventario de rutas que fije el contrato antes de mover código.
2. **TD-04:** revisar el PR #5 término a término (contrato, tests, gates) y decidir integrar o descartar.
3. **TD-05:** cablear durabilidad (Postgres/JSONL) para passports y estado de caché/prefetch.
4. **TD-06/TD-07:** completar los gates externos con credenciales y un runner CI operativo.
5. **TD-08:** simplificar los scripts `build`/`validate` para no duplicar la suite.

## 6. Regla de evidencia

Esta auditoría mide el estado de `deb26b9` y no se copia a otros SHAs. Un test verde demuestra una capacidad computacional local, **no** autoridad, aprendizaje, certificación ni producción. Las cifras de riesgo, confianza y eficiencia del sistema son heurísticas hasta que existan calibración y benchmarks reproducibles.


## Origen: `docs/audits/UI-NAVIGATION-AND-CHAT-AUDIT-2026-10-12.md`

# Auditoría de navegación y conversación — Isabella V6 TINA

**Fecha:** 12 de octubre de 2026  
**Repositorio:** `OsoPanda1/isabella-V6-TINA-h6`  
**SHA validado en Preview:** `cccaede3c21c2516ec8ec6a61c1d69d72d106875`  
**Deployment:** [Vercel READY](https://isabella-v6-tina-4jp7lerbg-isabella-mexa.vercel.app/)  
**Alcance:** interfaz servida por Express (`src/ui/index.html`, `src/ui/app.js`, `src/ui/cinematic.css`), flujo de chat asociado y documentación de usuario.

## Resumen ejecutivo

Se encontraron defectos funcionales y de veracidad de estado en la navegación y la conversación. Se corrigieron en `main`, se añadió un smoke de UI integrado al build y se validó el SHA indicado en Preview. Esta revisión es una auditoría estática más smoke de runtime; no equivale a una prueba E2E con navegador real, lector de pantalla, múltiples dispositivos ni proveedor generativo externo.

## Hallazgos y correcciones

| Severidad | Hallazgo previo | Corrección aplicada | Estado |
|---|---|---|---|
| Alta | `.topbar` declaraba `position: sticky` y luego lo anulaba con `position: relative`. | Se eliminó la sobrescritura y se corrigió el contexto de overflow para permitir sticky. | Corregido; smoke CSS aprobado |
| Alta | La navegación móvil no tenía un control de apertura/cierre. | Botón accesible con `aria-expanded`, `aria-controls`, cierre por Escape, clic fuera y selección de enlace. | Corregido; smoke UI aprobado |
| Alta | El historial de chat se construía después de insertar el mensaje actual; podía volver a enviarse como contexto previo. | El historial se captura antes de insertar el mensaje actual y se limita a ocho mensajes previos. | Corregido en código; falta E2E de navegador |
| Alta | La respuesta HTTP no exitosa podía tratarse como respuesta conversacional normal. | Se verifica `response.ok`, se maneja JSON inválido, respuesta vacía y estados de carga; se bloquea el envío concurrente. | Corregido en código |
| Media | El modo de voz habilitaba TTS, pero no enviaba automáticamente el dictado. | En modo voz, el resultado de reconocimiento se envía; captura admite inicio/parada y manejo de errores/permisos. | Corregido en código; depende del navegador |
| Media | La interfaz afirmaba “NODO CERO · EN LÍNEA” sin comprobar el runtime. | El indicador consulta `/api/v1/health` y diferencia API disponible de estado limitado. | Verificado por HTTP; no afirma que el proveedor LLM esté activo |
| Media | La visualización afirmaba latencia fija de 12 ms sin medición. | Se reemplazó por etiquetas de contexto de sesión y runtime observable. | Corregido |
| Media | Las rutas de la interfaz repetían lecturas síncronas de archivos en cada petición y el primer handler de `/` impedía usar el fallback registrado después. | El HTML/CSS se sirven desde assets cargados en el arranque; si el HTML no está disponible, el handler continúa al fallback. El smoke verifica las rutas cacheadas. | Corregido y validado por build |
| Media | La introducción y animaciones no respetaban el ajuste de movimiento reducido. | Se añadió una ruta de salida inmediata para `prefers-reduced-motion` y CSS de movimiento reducido. | Corregido en código |

## Pruebas observadas en el SHA

- Vercel: **READY**.
- TypeScript build y bundle esbuild completados.
- Vitest: **519 pruebas aprobadas en 100 archivos**.
- Sintaxis de `src/ui/app.js`: comprobada mediante `node --check`.
- `UI_NAVIGATION_SMOKE_OK`: enlaces/anclas con destino, controles requeridos, rutas de API, CSS del menú móvil, rutas de assets cacheados y ausencia de latencia fija sin evidencia.
- `LOCAL_CONVERSATION_SMOKE_OK`: health/chat/follow-up HTTP 200 en el smoke.
- `PUBLIC_API_GUARDRAILS_OK`: entrada vacía 400, entrada excesiva 413, memoria sin scope 403 y solicitud destructiva pública 403.
- `OPENROUTER_PAID_ID_BLOCK_OK`: modelo OpenRouter no gratuito bloqueado sin opt-in.
- GET `/`, `/ui/app.js`, `/styles/cinematic.css` y `/api/v1/health`: HTTP 200.
- `LLM_GATEWAY_SMOKE_SKIPPED`: no hay credenciales elegibles para demostrar inferencia externa.

## Limitaciones que permanecen

1. GitHub Actions sigue mostrando `startup_failure` con cero jobs en el run consultado; Vercel verde no hace que GitHub CI esté verde.
2. No se ha probado una respuesta real de un proveedor generativo en el Preview actual.
3. No se ejecutó una prueba E2E de navegador real (desktop/mobile), pruebas de accesibilidad automatizadas ni una matriz de permisos de micrófono por navegador.
4. La navegación enlaza secciones de la interfaz. Las tarjetas “Tools”, “Skills” y “Monetización” no deben interpretarse como integración productiva de herramientas, cobros o campañas.
5. La readiness global se mantiene en **44.25% (≈44%)** conforme a los gates ponderados documentados; las mejoras de interfaz no cierran los bloqueadores de inferencia externa, CI, Rust, persistencia/recuperación y validación de producción.

## Próximos gates recomendados

- Recuperar un run de GitHub Actions que cree jobs y concluya correctamente.
- Ejecutar Playwright u otra herramienta E2E en escritorio y móvil: navegación, hash/deep link, menú, chat, respuestas 4xx/5xx, permiso denegado de micrófono y modo de voz.
- Configurar credenciales gratuitas elegibles solo en variables de entorno del servidor/Preview y demostrar inferencia externa.
- Mantener una revisión manual del SHA exacto antes de promoción o cambios de política de coste.


## Origen: `docs/archive/GENESISAI-500-CONTROL-CHECKLISTS-2026-10.md`

# Archivo histórico consolidado — checklists GenesisAI de 500 controles

> **Archivo de preservación histórica, no fuente de estado actual.** Ambos documentos se originaron para `OsoPanda1/Isabella-Villase-or-GenesisAI`, no para el estado operativo actual de `OsoPanda1/ISABELLA-VERSION-TERMINUS-V6`. Sus controles no deben marcarse como ejecutados en TERMINUS V6 sin una nueva validación contra su SHA actual. Se conservan íntegros para no perder trazabilidad.

## Documento A — `docs/AUDITORIA_CHECKLIST_500_2026-10.md`

---

# Auditoría total — Checklist de 500 puntos para Isabella Villaseñor GenesisAI

**Corte:** 9 de octubre de 2026. **Repositorio canónico:** `OsoPanda1/Isabella-Villase-or-GenesisAI`. **Rama del checklist:** `audit/checklist-500-2026-10`.

## Cómo interpretar este documento

Este documento contiene **500 comprobaciones de auditoría**, no 500 defectos ya demostrados. Cada punto está pendiente hasta que exista evidencia reproducible, enlace a archivo/línea, prueba o registro de ejecución. El alcance y los archivos son rutas objetivo; la existencia de una ruta debe comprobarse antes de asignarle un defecto.

- `PENDIENTE`: no hay evidencia suficiente para declarar aprobado o defectuoso.
- `CONFIRMADO`: reproducido en el SHA identificado, con archivo/línea y prueba.
- `MITIGADO`: se implementó una corrección, pero falta confirmar validación en CI/entorno.
- `RESUELTO`: corrección verificada mediante pruebas y revisión del SHA final.
- `NO APLICA`: justificación documentada, no por omisión.

**Criterio de severidad:** P0 riesgo inmediato de acceso/filtración/corrupción; P1 compromete integridad, autorización o release; P2 degradación funcional, calidad o sesgo; P3 documentación, ergonomía o mejora. La severidad se asigna después de reproducir el hallazgo.

## Observaciones basadas en archivos inspeccionados

1. **Inconsistencia de metadatos de versión — PENDIENTE DE CORRECCIÓN:** `package.json` declara versión `0.1.0`, mientras la descripción menciona `TINA v40.0.0`. No es por sí solo un fallo de ejecución, pero impide una identificación de release inequívoca.
2. **Sanitización — revisión adversarial necesaria:** `src/sanitization/index.ts` contiene patrones heurísticos de PII/secretos y detección de malware por regex. Esto no equivale a un escáner exhaustivo ni debe presentarse como garantía de ausencia de secretos. Se deben probar falsos positivos, falsos negativos y contenido codificado/multilingüe.
3. **IKES — controles positivos observados en el código actual:** `src/memory/ikes.ts` exige evidencia registrada para propuestas/corroboración y congela estructuras de claims. Aún debe comprobarse si las referencias de fuente y evidencia representan contenido recuperado, auténtico y no solo metadatos declarados.
4. **Manifest de evidencia:** `src/governance/evidence-manifest.ts` incluye comprobaciones de completitud y exige verificador inyectado para excepciones de estabilidad. Debe verificarse la integridad semántica del manifest, la autenticidad del aprobador y que todos los campos relevantes estén cubiertos por el identificador.
5. **CI:** `.github/workflows/ci.yml` ejecuta typecheck, tests, build, escaneo de secretos y suite de seguridad, además de generar evidencia de producción. La existencia del workflow no prueba que la última ejecución haya pasado; debe consultarse el estado del SHA final.
6. **Límite de esta revisión:** no se afirma que se hayan ejecutado localmente los tests ni que el despliegue esté validado. Cada estado debe actualizarse con resultados observables.

## Checklist

### 01. Runtime canónico e inicialización

**Rutas objetivo:** `src/genesis/runtime.ts; src/genesis/*; src/index.ts`  
**Alcance:** runtime, singletons, wiring, lifecycle

- [ ] **AUD-001** — contrato y tipos coinciden con la implementación real en runtime, singletons, wiring, lifecycle; aceptación: CONTRACT ≠ IMPLEMENTED. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-002** — módulo se registra una sola vez en el runtime canónico en runtime, singletons, wiring, lifecycle; aceptación: sin runtime paralelo. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-003** — todas las rutas de entrada validan tipo, tamaño y forma en runtime, singletons, wiring, lifecycle; aceptación: rechazo fail-closed. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-004** — valores ausentes, nulos y malformados producen error explícito en runtime, singletons, wiring, lifecycle; aceptación: sin coerción silenciosa. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-005** — permisos se comprueban en servidor y no en el cliente en runtime, singletons, wiring, lifecycle; aceptación: confianza cero. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-006** — roles y principal provienen de identidad autenticada en runtime, singletons, wiring, lifecycle; aceptación: sin elevación desde payload. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-007** — errores no filtran secretos, PII, tokens ni contenido privado en runtime, singletons, wiring, lifecycle; aceptación: redacción verificada. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-008** — estados de éxito requieren evidencia de operación real en runtime, singletons, wiring, lifecycle; aceptación: sin éxito simulado. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-009** — hashes se calculan sobre representación canónica documentada en runtime, singletons, wiring, lifecycle; aceptación: integridad reproducible. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-010** — verificación de hash no se presenta como autenticación de fuente en runtime, singletons, wiring, lifecycle; aceptación: sin falsa garantía. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-011** — colecciones y objetos retornados no permiten mutación indirecta en runtime, singletons, wiring, lifecycle; aceptación: inmutabilidad profunda. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-012** — reintentos e invocaciones repetidas son idempotentes cuando corresponde en runtime, singletons, wiring, lifecycle; aceptación: sin duplicados. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-013** — operaciones concurrentes conservan consistencia y orden en runtime, singletons, wiring, lifecycle; aceptación: sin carreras. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-014** — límites, timeout y cancelación evitan consumo ilimitado en runtime, singletons, wiring, lifecycle; aceptación: recursos acotados. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-015** — salidas de red restringen protocolos, destinos y redirecciones en runtime, singletons, wiring, lifecycle; aceptación: protección SSRF. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-016** — mensajes de error distinguen fallo, ausencia y estado inconcluso en runtime, singletons, wiring, lifecycle; aceptación: semántica honesta. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-017** — registros de auditoría contienen actor, acción, tiempo y resultado en runtime, singletons, wiring, lifecycle; aceptación: trazabilidad. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-018** — datos personales se minimizan, clasifican y retienen con política en runtime, singletons, wiring, lifecycle; aceptación: privacidad por diseño. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-019** — aislamiento multiusuario/tenant se valida con pruebas cruzadas en runtime, singletons, wiring, lifecycle; aceptación: sin fuga entre tenants. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-020** — dependencias, versiones y licencias están inventariadas en runtime, singletons, wiring, lifecycle; aceptación: supply chain. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-021** — pruebas positivas cubren la ruta nominal y sus invariantes en runtime, singletons, wiring, lifecycle; aceptación: caso nominal. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-022** — pruebas negativas cubren abuso, datos inválidos y permisos denegados en runtime, singletons, wiring, lifecycle; aceptación: caso adversarial. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-023** — pruebas de regresión reproducen el hallazgo con una aserción en runtime, singletons, wiring, lifecycle; aceptación: regresión bloqueante. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-024** — observabilidad permite diagnosticar sin exponer contenido sensible en runtime, singletons, wiring, lifecycle; aceptación: logs seguros. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-025** — documentación declara limitaciones, estado real y criterio de aceptación en runtime, singletons, wiring, lifecycle; aceptación: sin sobreafirmaciones. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.

### 02. CROWN: decisiones y capacidades

**Rutas objetivo:** `src/crown/*; src/authority/*`  
**Alcance:** decision engine and capability gates

- [ ] **AUD-026** — contrato y tipos coinciden con la implementación real en decision engine and capability gates; aceptación: CONTRACT ≠ IMPLEMENTED. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-027** — módulo se registra una sola vez en el runtime canónico en decision engine and capability gates; aceptación: sin runtime paralelo. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-028** — todas las rutas de entrada validan tipo, tamaño y forma en decision engine and capability gates; aceptación: rechazo fail-closed. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-029** — valores ausentes, nulos y malformados producen error explícito en decision engine and capability gates; aceptación: sin coerción silenciosa. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-030** — permisos se comprueban en servidor y no en el cliente en decision engine and capability gates; aceptación: confianza cero. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-031** — roles y principal provienen de identidad autenticada en decision engine and capability gates; aceptación: sin elevación desde payload. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-032** — errores no filtran secretos, PII, tokens ni contenido privado en decision engine and capability gates; aceptación: redacción verificada. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-033** — estados de éxito requieren evidencia de operación real en decision engine and capability gates; aceptación: sin éxito simulado. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-034** — hashes se calculan sobre representación canónica documentada en decision engine and capability gates; aceptación: integridad reproducible. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-035** — verificación de hash no se presenta como autenticación de fuente en decision engine and capability gates; aceptación: sin falsa garantía. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-036** — colecciones y objetos retornados no permiten mutación indirecta en decision engine and capability gates; aceptación: inmutabilidad profunda. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-037** — reintentos e invocaciones repetidas son idempotentes cuando corresponde en decision engine and capability gates; aceptación: sin duplicados. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-038** — operaciones concurrentes conservan consistencia y orden en decision engine and capability gates; aceptación: sin carreras. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-039** — límites, timeout y cancelación evitan consumo ilimitado en decision engine and capability gates; aceptación: recursos acotados. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-040** — salidas de red restringen protocolos, destinos y redirecciones en decision engine and capability gates; aceptación: protección SSRF. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-041** — mensajes de error distinguen fallo, ausencia y estado inconcluso en decision engine and capability gates; aceptación: semántica honesta. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-042** — registros de auditoría contienen actor, acción, tiempo y resultado en decision engine and capability gates; aceptación: trazabilidad. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-043** — datos personales se minimizan, clasifican y retienen con política en decision engine and capability gates; aceptación: privacidad por diseño. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-044** — aislamiento multiusuario/tenant se valida con pruebas cruzadas en decision engine and capability gates; aceptación: sin fuga entre tenants. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-045** — dependencias, versiones y licencias están inventariadas en decision engine and capability gates; aceptación: supply chain. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-046** — pruebas positivas cubren la ruta nominal y sus invariantes en decision engine and capability gates; aceptación: caso nominal. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-047** — pruebas negativas cubren abuso, datos inválidos y permisos denegados en decision engine and capability gates; aceptación: caso adversarial. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-048** — pruebas de regresión reproducen el hallazgo con una aserción en decision engine and capability gates; aceptación: regresión bloqueante. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-049** — observabilidad permite diagnosticar sin exponer contenido sensible en decision engine and capability gates; aceptación: logs seguros. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-050** — documentación declara limitaciones, estado real y criterio de aceptación en decision engine and capability gates; aceptación: sin sobreafirmaciones. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.

### 03. AEGIS: gobernanza y políticas

**Rutas objetivo:** `src/governance/*; src/policy/*`  
**Alcance:** policy enforcement and governance

- [ ] **AUD-051** — contrato y tipos coinciden con la implementación real en policy enforcement and governance; aceptación: CONTRACT ≠ IMPLEMENTED. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-052** — módulo se registra una sola vez en el runtime canónico en policy enforcement and governance; aceptación: sin runtime paralelo. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-053** — todas las rutas de entrada validan tipo, tamaño y forma en policy enforcement and governance; aceptación: rechazo fail-closed. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-054** — valores ausentes, nulos y malformados producen error explícito en policy enforcement and governance; aceptación: sin coerción silenciosa. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-055** — permisos se comprueban en servidor y no en el cliente en policy enforcement and governance; aceptación: confianza cero. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-056** — roles y principal provienen de identidad autenticada en policy enforcement and governance; aceptación: sin elevación desde payload. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-057** — errores no filtran secretos, PII, tokens ni contenido privado en policy enforcement and governance; aceptación: redacción verificada. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-058** — estados de éxito requieren evidencia de operación real en policy enforcement and governance; aceptación: sin éxito simulado. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-059** — hashes se calculan sobre representación canónica documentada en policy enforcement and governance; aceptación: integridad reproducible. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-060** — verificación de hash no se presenta como autenticación de fuente en policy enforcement and governance; aceptación: sin falsa garantía. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-061** — colecciones y objetos retornados no permiten mutación indirecta en policy enforcement and governance; aceptación: inmutabilidad profunda. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-062** — reintentos e invocaciones repetidas son idempotentes cuando corresponde en policy enforcement and governance; aceptación: sin duplicados. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-063** — operaciones concurrentes conservan consistencia y orden en policy enforcement and governance; aceptación: sin carreras. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-064** — límites, timeout y cancelación evitan consumo ilimitado en policy enforcement and governance; aceptación: recursos acotados. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-065** — salidas de red restringen protocolos, destinos y redirecciones en policy enforcement and governance; aceptación: protección SSRF. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-066** — mensajes de error distinguen fallo, ausencia y estado inconcluso en policy enforcement and governance; aceptación: semántica honesta. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-067** — registros de auditoría contienen actor, acción, tiempo y resultado en policy enforcement and governance; aceptación: trazabilidad. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-068** — datos personales se minimizan, clasifican y retienen con política en policy enforcement and governance; aceptación: privacidad por diseño. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-069** — aislamiento multiusuario/tenant se valida con pruebas cruzadas en policy enforcement and governance; aceptación: sin fuga entre tenants. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-070** — dependencias, versiones y licencias están inventariadas en policy enforcement and governance; aceptación: supply chain. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-071** — pruebas positivas cubren la ruta nominal y sus invariantes en policy enforcement and governance; aceptación: caso nominal. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-072** — pruebas negativas cubren abuso, datos inválidos y permisos denegados en policy enforcement and governance; aceptación: caso adversarial. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-073** — pruebas de regresión reproducen el hallazgo con una aserción en policy enforcement and governance; aceptación: regresión bloqueante. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-074** — observabilidad permite diagnosticar sin exponer contenido sensible en policy enforcement and governance; aceptación: logs seguros. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-075** — documentación declara limitaciones, estado real y criterio de aceptación en policy enforcement and governance; aceptación: sin sobreafirmaciones. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.

### 04. IKES: conocimiento y epistemología

**Rutas objetivo:** `src/memory/ikes.ts; src/memory/knowledge-entry.ts; src/memory/proposals.ts`  
**Alcance:** claims, evidence, provenance, epistemic state

- [ ] **AUD-076** — contrato y tipos coinciden con la implementación real en claims, evidence, provenance, epistemic state; aceptación: CONTRACT ≠ IMPLEMENTED. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-077** — módulo se registra una sola vez en el runtime canónico en claims, evidence, provenance, epistemic state; aceptación: sin runtime paralelo. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-078** — todas las rutas de entrada validan tipo, tamaño y forma en claims, evidence, provenance, epistemic state; aceptación: rechazo fail-closed. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-079** — valores ausentes, nulos y malformados producen error explícito en claims, evidence, provenance, epistemic state; aceptación: sin coerción silenciosa. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-080** — permisos se comprueban en servidor y no en el cliente en claims, evidence, provenance, epistemic state; aceptación: confianza cero. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-081** — roles y principal provienen de identidad autenticada en claims, evidence, provenance, epistemic state; aceptación: sin elevación desde payload. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-082** — errores no filtran secretos, PII, tokens ni contenido privado en claims, evidence, provenance, epistemic state; aceptación: redacción verificada. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-083** — estados de éxito requieren evidencia de operación real en claims, evidence, provenance, epistemic state; aceptación: sin éxito simulado. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-084** — hashes se calculan sobre representación canónica documentada en claims, evidence, provenance, epistemic state; aceptación: integridad reproducible. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-085** — verificación de hash no se presenta como autenticación de fuente en claims, evidence, provenance, epistemic state; aceptación: sin falsa garantía. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-086** — colecciones y objetos retornados no permiten mutación indirecta en claims, evidence, provenance, epistemic state; aceptación: inmutabilidad profunda. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-087** — reintentos e invocaciones repetidas son idempotentes cuando corresponde en claims, evidence, provenance, epistemic state; aceptación: sin duplicados. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-088** — operaciones concurrentes conservan consistencia y orden en claims, evidence, provenance, epistemic state; aceptación: sin carreras. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-089** — límites, timeout y cancelación evitan consumo ilimitado en claims, evidence, provenance, epistemic state; aceptación: recursos acotados. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-090** — salidas de red restringen protocolos, destinos y redirecciones en claims, evidence, provenance, epistemic state; aceptación: protección SSRF. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-091** — mensajes de error distinguen fallo, ausencia y estado inconcluso en claims, evidence, provenance, epistemic state; aceptación: semántica honesta. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-092** — registros de auditoría contienen actor, acción, tiempo y resultado en claims, evidence, provenance, epistemic state; aceptación: trazabilidad. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-093** — datos personales se minimizan, clasifican y retienen con política en claims, evidence, provenance, epistemic state; aceptación: privacidad por diseño. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-094** — aislamiento multiusuario/tenant se valida con pruebas cruzadas en claims, evidence, provenance, epistemic state; aceptación: sin fuga entre tenants. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-095** — dependencias, versiones y licencias están inventariadas en claims, evidence, provenance, epistemic state; aceptación: supply chain. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-096** — pruebas positivas cubren la ruta nominal y sus invariantes en claims, evidence, provenance, epistemic state; aceptación: caso nominal. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-097** — pruebas negativas cubren abuso, datos inválidos y permisos denegados en claims, evidence, provenance, epistemic state; aceptación: caso adversarial. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-098** — pruebas de regresión reproducen el hallazgo con una aserción en claims, evidence, provenance, epistemic state; aceptación: regresión bloqueante. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-099** — observabilidad permite diagnosticar sin exponer contenido sensible en claims, evidence, provenance, epistemic state; aceptación: logs seguros. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-100** — documentación declara limitaciones, estado real y criterio de aceptación en claims, evidence, provenance, epistemic state; aceptación: sin sobreafirmaciones. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.

### 05. Sanitización y admisión de documentos

**Rutas objetivo:** `src/sanitization/*`  
**Alcance:** input hygiene, PII, secrets, duplicate detection

- [ ] **AUD-101** — contrato y tipos coinciden con la implementación real en input hygiene, PII, secrets, duplicate detection; aceptación: CONTRACT ≠ IMPLEMENTED. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-102** — módulo se registra una sola vez en el runtime canónico en input hygiene, PII, secrets, duplicate detection; aceptación: sin runtime paralelo. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-103** — todas las rutas de entrada validan tipo, tamaño y forma en input hygiene, PII, secrets, duplicate detection; aceptación: rechazo fail-closed. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-104** — valores ausentes, nulos y malformados producen error explícito en input hygiene, PII, secrets, duplicate detection; aceptación: sin coerción silenciosa. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-105** — permisos se comprueban en servidor y no en el cliente en input hygiene, PII, secrets, duplicate detection; aceptación: confianza cero. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-106** — roles y principal provienen de identidad autenticada en input hygiene, PII, secrets, duplicate detection; aceptación: sin elevación desde payload. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-107** — errores no filtran secretos, PII, tokens ni contenido privado en input hygiene, PII, secrets, duplicate detection; aceptación: redacción verificada. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-108** — estados de éxito requieren evidencia de operación real en input hygiene, PII, secrets, duplicate detection; aceptación: sin éxito simulado. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-109** — hashes se calculan sobre representación canónica documentada en input hygiene, PII, secrets, duplicate detection; aceptación: integridad reproducible. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-110** — verificación de hash no se presenta como autenticación de fuente en input hygiene, PII, secrets, duplicate detection; aceptación: sin falsa garantía. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-111** — colecciones y objetos retornados no permiten mutación indirecta en input hygiene, PII, secrets, duplicate detection; aceptación: inmutabilidad profunda. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-112** — reintentos e invocaciones repetidas son idempotentes cuando corresponde en input hygiene, PII, secrets, duplicate detection; aceptación: sin duplicados. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-113** — operaciones concurrentes conservan consistencia y orden en input hygiene, PII, secrets, duplicate detection; aceptación: sin carreras. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-114** — límites, timeout y cancelación evitan consumo ilimitado en input hygiene, PII, secrets, duplicate detection; aceptación: recursos acotados. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-115** — salidas de red restringen protocolos, destinos y redirecciones en input hygiene, PII, secrets, duplicate detection; aceptación: protección SSRF. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-116** — mensajes de error distinguen fallo, ausencia y estado inconcluso en input hygiene, PII, secrets, duplicate detection; aceptación: semántica honesta. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-117** — registros de auditoría contienen actor, acción, tiempo y resultado en input hygiene, PII, secrets, duplicate detection; aceptación: trazabilidad. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-118** — datos personales se minimizan, clasifican y retienen con política en input hygiene, PII, secrets, duplicate detection; aceptación: privacidad por diseño. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-119** — aislamiento multiusuario/tenant se valida con pruebas cruzadas en input hygiene, PII, secrets, duplicate detection; aceptación: sin fuga entre tenants. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-120** — dependencias, versiones y licencias están inventariadas en input hygiene, PII, secrets, duplicate detection; aceptación: supply chain. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-121** — pruebas positivas cubren la ruta nominal y sus invariantes en input hygiene, PII, secrets, duplicate detection; aceptación: caso nominal. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-122** — pruebas negativas cubren abuso, datos inválidos y permisos denegados en input hygiene, PII, secrets, duplicate detection; aceptación: caso adversarial. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-123** — pruebas de regresión reproducen el hallazgo con una aserción en input hygiene, PII, secrets, duplicate detection; aceptación: regresión bloqueante. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-124** — observabilidad permite diagnosticar sin exponer contenido sensible en input hygiene, PII, secrets, duplicate detection; aceptación: logs seguros. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-125** — documentación declara limitaciones, estado real y criterio de aceptación en input hygiene, PII, secrets, duplicate detection; aceptación: sin sobreafirmaciones. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.

### 06. VERITAS y verificación de verdad

**Rutas objetivo:** `src/litle/*; src/verification/*; src/server.ts`  
**Alcance:** evidence and certificate verification

- [ ] **AUD-126** — contrato y tipos coinciden con la implementación real en evidence and certificate verification; aceptación: CONTRACT ≠ IMPLEMENTED. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-127** — módulo se registra una sola vez en el runtime canónico en evidence and certificate verification; aceptación: sin runtime paralelo. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-128** — todas las rutas de entrada validan tipo, tamaño y forma en evidence and certificate verification; aceptación: rechazo fail-closed. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-129** — valores ausentes, nulos y malformados producen error explícito en evidence and certificate verification; aceptación: sin coerción silenciosa. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-130** — permisos se comprueban en servidor y no en el cliente en evidence and certificate verification; aceptación: confianza cero. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-131** — roles y principal provienen de identidad autenticada en evidence and certificate verification; aceptación: sin elevación desde payload. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-132** — errores no filtran secretos, PII, tokens ni contenido privado en evidence and certificate verification; aceptación: redacción verificada. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-133** — estados de éxito requieren evidencia de operación real en evidence and certificate verification; aceptación: sin éxito simulado. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-134** — hashes se calculan sobre representación canónica documentada en evidence and certificate verification; aceptación: integridad reproducible. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-135** — verificación de hash no se presenta como autenticación de fuente en evidence and certificate verification; aceptación: sin falsa garantía. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-136** — colecciones y objetos retornados no permiten mutación indirecta en evidence and certificate verification; aceptación: inmutabilidad profunda. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-137** — reintentos e invocaciones repetidas son idempotentes cuando corresponde en evidence and certificate verification; aceptación: sin duplicados. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-138** — operaciones concurrentes conservan consistencia y orden en evidence and certificate verification; aceptación: sin carreras. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-139** — límites, timeout y cancelación evitan consumo ilimitado en evidence and certificate verification; aceptación: recursos acotados. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-140** — salidas de red restringen protocolos, destinos y redirecciones en evidence and certificate verification; aceptación: protección SSRF. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-141** — mensajes de error distinguen fallo, ausencia y estado inconcluso en evidence and certificate verification; aceptación: semántica honesta. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-142** — registros de auditoría contienen actor, acción, tiempo y resultado en evidence and certificate verification; aceptación: trazabilidad. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-143** — datos personales se minimizan, clasifican y retienen con política en evidence and certificate verification; aceptación: privacidad por diseño. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-144** — aislamiento multiusuario/tenant se valida con pruebas cruzadas en evidence and certificate verification; aceptación: sin fuga entre tenants. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-145** — dependencias, versiones y licencias están inventariadas en evidence and certificate verification; aceptación: supply chain. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-146** — pruebas positivas cubren la ruta nominal y sus invariantes en evidence and certificate verification; aceptación: caso nominal. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-147** — pruebas negativas cubren abuso, datos inválidos y permisos denegados en evidence and certificate verification; aceptación: caso adversarial. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-148** — pruebas de regresión reproducen el hallazgo con una aserción en evidence and certificate verification; aceptación: regresión bloqueante. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-149** — observabilidad permite diagnosticar sin exponer contenido sensible en evidence and certificate verification; aceptación: logs seguros. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-150** — documentación declara limitaciones, estado real y criterio de aceptación en evidence and certificate verification; aceptación: sin sobreafirmaciones. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.

### 07. BookPI: ledger y trazabilidad

**Rutas objetivo:** `src/bookpi/*; src/server.ts`  
**Alcance:** audit ledger, integrity, replay

- [ ] **AUD-151** — contrato y tipos coinciden con la implementación real en audit ledger, integrity, replay; aceptación: CONTRACT ≠ IMPLEMENTED. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-152** — módulo se registra una sola vez en el runtime canónico en audit ledger, integrity, replay; aceptación: sin runtime paralelo. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-153** — todas las rutas de entrada validan tipo, tamaño y forma en audit ledger, integrity, replay; aceptación: rechazo fail-closed. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-154** — valores ausentes, nulos y malformados producen error explícito en audit ledger, integrity, replay; aceptación: sin coerción silenciosa. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-155** — permisos se comprueban en servidor y no en el cliente en audit ledger, integrity, replay; aceptación: confianza cero. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-156** — roles y principal provienen de identidad autenticada en audit ledger, integrity, replay; aceptación: sin elevación desde payload. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-157** — errores no filtran secretos, PII, tokens ni contenido privado en audit ledger, integrity, replay; aceptación: redacción verificada. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-158** — estados de éxito requieren evidencia de operación real en audit ledger, integrity, replay; aceptación: sin éxito simulado. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-159** — hashes se calculan sobre representación canónica documentada en audit ledger, integrity, replay; aceptación: integridad reproducible. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-160** — verificación de hash no se presenta como autenticación de fuente en audit ledger, integrity, replay; aceptación: sin falsa garantía. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-161** — colecciones y objetos retornados no permiten mutación indirecta en audit ledger, integrity, replay; aceptación: inmutabilidad profunda. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-162** — reintentos e invocaciones repetidas son idempotentes cuando corresponde en audit ledger, integrity, replay; aceptación: sin duplicados. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-163** — operaciones concurrentes conservan consistencia y orden en audit ledger, integrity, replay; aceptación: sin carreras. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-164** — límites, timeout y cancelación evitan consumo ilimitado en audit ledger, integrity, replay; aceptación: recursos acotados. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-165** — salidas de red restringen protocolos, destinos y redirecciones en audit ledger, integrity, replay; aceptación: protección SSRF. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-166** — mensajes de error distinguen fallo, ausencia y estado inconcluso en audit ledger, integrity, replay; aceptación: semántica honesta. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-167** — registros de auditoría contienen actor, acción, tiempo y resultado en audit ledger, integrity, replay; aceptación: trazabilidad. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-168** — datos personales se minimizan, clasifican y retienen con política en audit ledger, integrity, replay; aceptación: privacidad por diseño. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-169** — aislamiento multiusuario/tenant se valida con pruebas cruzadas en audit ledger, integrity, replay; aceptación: sin fuga entre tenants. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-170** — dependencias, versiones y licencias están inventariadas en audit ledger, integrity, replay; aceptación: supply chain. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-171** — pruebas positivas cubren la ruta nominal y sus invariantes en audit ledger, integrity, replay; aceptación: caso nominal. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-172** — pruebas negativas cubren abuso, datos inválidos y permisos denegados en audit ledger, integrity, replay; aceptación: caso adversarial. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-173** — pruebas de regresión reproducen el hallazgo con una aserción en audit ledger, integrity, replay; aceptación: regresión bloqueante. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-174** — observabilidad permite diagnosticar sin exponer contenido sensible en audit ledger, integrity, replay; aceptación: logs seguros. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-175** — documentación declara limitaciones, estado real y criterio de aceptación en audit ledger, integrity, replay; aceptación: sin sobreafirmaciones. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.

### 08. LITLE: confianza y evidencia

**Rutas objetivo:** `src/litle/*; src/evidence/*`  
**Alcance:** trust fabric, certificates, canonicalization

- [ ] **AUD-176** — contrato y tipos coinciden con la implementación real en trust fabric, certificates, canonicalization; aceptación: CONTRACT ≠ IMPLEMENTED. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-177** — módulo se registra una sola vez en el runtime canónico en trust fabric, certificates, canonicalization; aceptación: sin runtime paralelo. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-178** — todas las rutas de entrada validan tipo, tamaño y forma en trust fabric, certificates, canonicalization; aceptación: rechazo fail-closed. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-179** — valores ausentes, nulos y malformados producen error explícito en trust fabric, certificates, canonicalization; aceptación: sin coerción silenciosa. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-180** — permisos se comprueban en servidor y no en el cliente en trust fabric, certificates, canonicalization; aceptación: confianza cero. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-181** — roles y principal provienen de identidad autenticada en trust fabric, certificates, canonicalization; aceptación: sin elevación desde payload. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-182** — errores no filtran secretos, PII, tokens ni contenido privado en trust fabric, certificates, canonicalization; aceptación: redacción verificada. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-183** — estados de éxito requieren evidencia de operación real en trust fabric, certificates, canonicalization; aceptación: sin éxito simulado. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-184** — hashes se calculan sobre representación canónica documentada en trust fabric, certificates, canonicalization; aceptación: integridad reproducible. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-185** — verificación de hash no se presenta como autenticación de fuente en trust fabric, certificates, canonicalization; aceptación: sin falsa garantía. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-186** — colecciones y objetos retornados no permiten mutación indirecta en trust fabric, certificates, canonicalization; aceptación: inmutabilidad profunda. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-187** — reintentos e invocaciones repetidas son idempotentes cuando corresponde en trust fabric, certificates, canonicalization; aceptación: sin duplicados. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-188** — operaciones concurrentes conservan consistencia y orden en trust fabric, certificates, canonicalization; aceptación: sin carreras. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-189** — límites, timeout y cancelación evitan consumo ilimitado en trust fabric, certificates, canonicalization; aceptación: recursos acotados. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-190** — salidas de red restringen protocolos, destinos y redirecciones en trust fabric, certificates, canonicalization; aceptación: protección SSRF. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-191** — mensajes de error distinguen fallo, ausencia y estado inconcluso en trust fabric, certificates, canonicalization; aceptación: semántica honesta. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-192** — registros de auditoría contienen actor, acción, tiempo y resultado en trust fabric, certificates, canonicalization; aceptación: trazabilidad. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-193** — datos personales se minimizan, clasifican y retienen con política en trust fabric, certificates, canonicalization; aceptación: privacidad por diseño. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-194** — aislamiento multiusuario/tenant se valida con pruebas cruzadas en trust fabric, certificates, canonicalization; aceptación: sin fuga entre tenants. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-195** — dependencias, versiones y licencias están inventariadas en trust fabric, certificates, canonicalization; aceptación: supply chain. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-196** — pruebas positivas cubren la ruta nominal y sus invariantes en trust fabric, certificates, canonicalization; aceptación: caso nominal. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-197** — pruebas negativas cubren abuso, datos inválidos y permisos denegados en trust fabric, certificates, canonicalization; aceptación: caso adversarial. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-198** — pruebas de regresión reproducen el hallazgo con una aserción en trust fabric, certificates, canonicalization; aceptación: regresión bloqueante. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-199** — observabilidad permite diagnosticar sin exponer contenido sensible en trust fabric, certificates, canonicalization; aceptación: logs seguros. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-200** — documentación declara limitaciones, estado real y criterio de aceptación en trust fabric, certificates, canonicalization; aceptación: sin sobreafirmaciones. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.

### 09. Atlas: persistencia y sincronización

**Rutas objetivo:** `src/atlas/*; scripts/atlas-ingest.ts`  
**Alcance:** storage, persistence, synchronization

- [ ] **AUD-201** — contrato y tipos coinciden con la implementación real en storage, persistence, synchronization; aceptación: CONTRACT ≠ IMPLEMENTED. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-202** — módulo se registra una sola vez en el runtime canónico en storage, persistence, synchronization; aceptación: sin runtime paralelo. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-203** — todas las rutas de entrada validan tipo, tamaño y forma en storage, persistence, synchronization; aceptación: rechazo fail-closed. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-204** — valores ausentes, nulos y malformados producen error explícito en storage, persistence, synchronization; aceptación: sin coerción silenciosa. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-205** — permisos se comprueban en servidor y no en el cliente en storage, persistence, synchronization; aceptación: confianza cero. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-206** — roles y principal provienen de identidad autenticada en storage, persistence, synchronization; aceptación: sin elevación desde payload. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-207** — errores no filtran secretos, PII, tokens ni contenido privado en storage, persistence, synchronization; aceptación: redacción verificada. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-208** — estados de éxito requieren evidencia de operación real en storage, persistence, synchronization; aceptación: sin éxito simulado. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-209** — hashes se calculan sobre representación canónica documentada en storage, persistence, synchronization; aceptación: integridad reproducible. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-210** — verificación de hash no se presenta como autenticación de fuente en storage, persistence, synchronization; aceptación: sin falsa garantía. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-211** — colecciones y objetos retornados no permiten mutación indirecta en storage, persistence, synchronization; aceptación: inmutabilidad profunda. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-212** — reintentos e invocaciones repetidas son idempotentes cuando corresponde en storage, persistence, synchronization; aceptación: sin duplicados. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-213** — operaciones concurrentes conservan consistencia y orden en storage, persistence, synchronization; aceptación: sin carreras. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-214** — límites, timeout y cancelación evitan consumo ilimitado en storage, persistence, synchronization; aceptación: recursos acotados. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-215** — salidas de red restringen protocolos, destinos y redirecciones en storage, persistence, synchronization; aceptación: protección SSRF. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-216** — mensajes de error distinguen fallo, ausencia y estado inconcluso en storage, persistence, synchronization; aceptación: semántica honesta. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-217** — registros de auditoría contienen actor, acción, tiempo y resultado en storage, persistence, synchronization; aceptación: trazabilidad. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-218** — datos personales se minimizan, clasifican y retienen con política en storage, persistence, synchronization; aceptación: privacidad por diseño. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-219** — aislamiento multiusuario/tenant se valida con pruebas cruzadas en storage, persistence, synchronization; aceptación: sin fuga entre tenants. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-220** — dependencias, versiones y licencias están inventariadas en storage, persistence, synchronization; aceptación: supply chain. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-221** — pruebas positivas cubren la ruta nominal y sus invariantes en storage, persistence, synchronization; aceptación: caso nominal. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-222** — pruebas negativas cubren abuso, datos inválidos y permisos denegados en storage, persistence, synchronization; aceptación: caso adversarial. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-223** — pruebas de regresión reproducen el hallazgo con una aserción en storage, persistence, synchronization; aceptación: regresión bloqueante. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-224** — observabilidad permite diagnosticar sin exponer contenido sensible en storage, persistence, synchronization; aceptación: logs seguros. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-225** — documentación declara limitaciones, estado real y criterio de aceptación en storage, persistence, synchronization; aceptación: sin sobreafirmaciones. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.

### 10. HSF: registro e invocación de skills

**Rutas objetivo:** `src/capabilities/hsf.ts; src/genesis/runtime.ts; src/server.ts`  
**Alcance:** skill registry and gateway

- [ ] **AUD-226** — contrato y tipos coinciden con la implementación real en skill registry and gateway; aceptación: CONTRACT ≠ IMPLEMENTED. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-227** — módulo se registra una sola vez en el runtime canónico en skill registry and gateway; aceptación: sin runtime paralelo. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-228** — todas las rutas de entrada validan tipo, tamaño y forma en skill registry and gateway; aceptación: rechazo fail-closed. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-229** — valores ausentes, nulos y malformados producen error explícito en skill registry and gateway; aceptación: sin coerción silenciosa. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-230** — permisos se comprueban en servidor y no en el cliente en skill registry and gateway; aceptación: confianza cero. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-231** — roles y principal provienen de identidad autenticada en skill registry and gateway; aceptación: sin elevación desde payload. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-232** — errores no filtran secretos, PII, tokens ni contenido privado en skill registry and gateway; aceptación: redacción verificada. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-233** — estados de éxito requieren evidencia de operación real en skill registry and gateway; aceptación: sin éxito simulado. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-234** — hashes se calculan sobre representación canónica documentada en skill registry and gateway; aceptación: integridad reproducible. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-235** — verificación de hash no se presenta como autenticación de fuente en skill registry and gateway; aceptación: sin falsa garantía. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-236** — colecciones y objetos retornados no permiten mutación indirecta en skill registry and gateway; aceptación: inmutabilidad profunda. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-237** — reintentos e invocaciones repetidas son idempotentes cuando corresponde en skill registry and gateway; aceptación: sin duplicados. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-238** — operaciones concurrentes conservan consistencia y orden en skill registry and gateway; aceptación: sin carreras. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-239** — límites, timeout y cancelación evitan consumo ilimitado en skill registry and gateway; aceptación: recursos acotados. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-240** — salidas de red restringen protocolos, destinos y redirecciones en skill registry and gateway; aceptación: protección SSRF. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-241** — mensajes de error distinguen fallo, ausencia y estado inconcluso en skill registry and gateway; aceptación: semántica honesta. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-242** — registros de auditoría contienen actor, acción, tiempo y resultado en skill registry and gateway; aceptación: trazabilidad. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-243** — datos personales se minimizan, clasifican y retienen con política en skill registry and gateway; aceptación: privacidad por diseño. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-244** — aislamiento multiusuario/tenant se valida con pruebas cruzadas en skill registry and gateway; aceptación: sin fuga entre tenants. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-245** — dependencias, versiones y licencias están inventariadas en skill registry and gateway; aceptación: supply chain. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-246** — pruebas positivas cubren la ruta nominal y sus invariantes en skill registry and gateway; aceptación: caso nominal. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-247** — pruebas negativas cubren abuso, datos inválidos y permisos denegados en skill registry and gateway; aceptación: caso adversarial. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-248** — pruebas de regresión reproducen el hallazgo con una aserción en skill registry and gateway; aceptación: regresión bloqueante. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-249** — observabilidad permite diagnosticar sin exponer contenido sensible en skill registry and gateway; aceptación: logs seguros. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-250** — documentación declara limitaciones, estado real y criterio de aceptación en skill registry and gateway; aceptación: sin sobreafirmaciones. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.

### 11. API y middleware HTTP

**Rutas objetivo:** `src/server.ts; src/security/*`  
**Alcance:** routes, middleware, request validation

- [ ] **AUD-251** — contrato y tipos coinciden con la implementación real en routes, middleware, request validation; aceptación: CONTRACT ≠ IMPLEMENTED. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-252** — módulo se registra una sola vez en el runtime canónico en routes, middleware, request validation; aceptación: sin runtime paralelo. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-253** — todas las rutas de entrada validan tipo, tamaño y forma en routes, middleware, request validation; aceptación: rechazo fail-closed. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-254** — valores ausentes, nulos y malformados producen error explícito en routes, middleware, request validation; aceptación: sin coerción silenciosa. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-255** — permisos se comprueban en servidor y no en el cliente en routes, middleware, request validation; aceptación: confianza cero. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-256** — roles y principal provienen de identidad autenticada en routes, middleware, request validation; aceptación: sin elevación desde payload. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-257** — errores no filtran secretos, PII, tokens ni contenido privado en routes, middleware, request validation; aceptación: redacción verificada. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-258** — estados de éxito requieren evidencia de operación real en routes, middleware, request validation; aceptación: sin éxito simulado. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-259** — hashes se calculan sobre representación canónica documentada en routes, middleware, request validation; aceptación: integridad reproducible. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-260** — verificación de hash no se presenta como autenticación de fuente en routes, middleware, request validation; aceptación: sin falsa garantía. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-261** — colecciones y objetos retornados no permiten mutación indirecta en routes, middleware, request validation; aceptación: inmutabilidad profunda. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-262** — reintentos e invocaciones repetidas son idempotentes cuando corresponde en routes, middleware, request validation; aceptación: sin duplicados. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-263** — operaciones concurrentes conservan consistencia y orden en routes, middleware, request validation; aceptación: sin carreras. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-264** — límites, timeout y cancelación evitan consumo ilimitado en routes, middleware, request validation; aceptación: recursos acotados. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-265** — salidas de red restringen protocolos, destinos y redirecciones en routes, middleware, request validation; aceptación: protección SSRF. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-266** — mensajes de error distinguen fallo, ausencia y estado inconcluso en routes, middleware, request validation; aceptación: semántica honesta. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-267** — registros de auditoría contienen actor, acción, tiempo y resultado en routes, middleware, request validation; aceptación: trazabilidad. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-268** — datos personales se minimizan, clasifican y retienen con política en routes, middleware, request validation; aceptación: privacidad por diseño. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-269** — aislamiento multiusuario/tenant se valida con pruebas cruzadas en routes, middleware, request validation; aceptación: sin fuga entre tenants. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-270** — dependencias, versiones y licencias están inventariadas en routes, middleware, request validation; aceptación: supply chain. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-271** — pruebas positivas cubren la ruta nominal y sus invariantes en routes, middleware, request validation; aceptación: caso nominal. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-272** — pruebas negativas cubren abuso, datos inválidos y permisos denegados en routes, middleware, request validation; aceptación: caso adversarial. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-273** — pruebas de regresión reproducen el hallazgo con una aserción en routes, middleware, request validation; aceptación: regresión bloqueante. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-274** — observabilidad permite diagnosticar sin exponer contenido sensible en routes, middleware, request validation; aceptación: logs seguros. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-275** — documentación declara limitaciones, estado real y criterio de aceptación en routes, middleware, request validation; aceptación: sin sobreafirmaciones. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.

### 12. Identidad, autenticación y autorización

**Rutas objetivo:** `src/identity/*; src/security/api-token.ts; src/server.ts`  
**Alcance:** principal, token, roles, trust boundary

- [ ] **AUD-276** — contrato y tipos coinciden con la implementación real en principal, token, roles, trust boundary; aceptación: CONTRACT ≠ IMPLEMENTED. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-277** — módulo se registra una sola vez en el runtime canónico en principal, token, roles, trust boundary; aceptación: sin runtime paralelo. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-278** — todas las rutas de entrada validan tipo, tamaño y forma en principal, token, roles, trust boundary; aceptación: rechazo fail-closed. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-279** — valores ausentes, nulos y malformados producen error explícito en principal, token, roles, trust boundary; aceptación: sin coerción silenciosa. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-280** — permisos se comprueban en servidor y no en el cliente en principal, token, roles, trust boundary; aceptación: confianza cero. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-281** — roles y principal provienen de identidad autenticada en principal, token, roles, trust boundary; aceptación: sin elevación desde payload. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-282** — errores no filtran secretos, PII, tokens ni contenido privado en principal, token, roles, trust boundary; aceptación: redacción verificada. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-283** — estados de éxito requieren evidencia de operación real en principal, token, roles, trust boundary; aceptación: sin éxito simulado. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-284** — hashes se calculan sobre representación canónica documentada en principal, token, roles, trust boundary; aceptación: integridad reproducible. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-285** — verificación de hash no se presenta como autenticación de fuente en principal, token, roles, trust boundary; aceptación: sin falsa garantía. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-286** — colecciones y objetos retornados no permiten mutación indirecta en principal, token, roles, trust boundary; aceptación: inmutabilidad profunda. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-287** — reintentos e invocaciones repetidas son idempotentes cuando corresponde en principal, token, roles, trust boundary; aceptación: sin duplicados. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-288** — operaciones concurrentes conservan consistencia y orden en principal, token, roles, trust boundary; aceptación: sin carreras. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-289** — límites, timeout y cancelación evitan consumo ilimitado en principal, token, roles, trust boundary; aceptación: recursos acotados. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-290** — salidas de red restringen protocolos, destinos y redirecciones en principal, token, roles, trust boundary; aceptación: protección SSRF. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-291** — mensajes de error distinguen fallo, ausencia y estado inconcluso en principal, token, roles, trust boundary; aceptación: semántica honesta. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-292** — registros de auditoría contienen actor, acción, tiempo y resultado en principal, token, roles, trust boundary; aceptación: trazabilidad. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-293** — datos personales se minimizan, clasifican y retienen con política en principal, token, roles, trust boundary; aceptación: privacidad por diseño. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-294** — aislamiento multiusuario/tenant se valida con pruebas cruzadas en principal, token, roles, trust boundary; aceptación: sin fuga entre tenants. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-295** — dependencias, versiones y licencias están inventariadas en principal, token, roles, trust boundary; aceptación: supply chain. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-296** — pruebas positivas cubren la ruta nominal y sus invariantes en principal, token, roles, trust boundary; aceptación: caso nominal. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-297** — pruebas negativas cubren abuso, datos inválidos y permisos denegados en principal, token, roles, trust boundary; aceptación: caso adversarial. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-298** — pruebas de regresión reproducen el hallazgo con una aserción en principal, token, roles, trust boundary; aceptación: regresión bloqueante. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-299** — observabilidad permite diagnosticar sin exponer contenido sensible en principal, token, roles, trust boundary; aceptación: logs seguros. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-300** — documentación declara limitaciones, estado real y criterio de aceptación en principal, token, roles, trust boundary; aceptación: sin sobreafirmaciones. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.

### 13. Seguridad de secretos y privacidad

**Rutas objetivo:** `src/security/*; .env.example; docs/ENVIRONMENT.md`  
**Alcance:** secrets, redaction, PII, privacy

- [ ] **AUD-301** — contrato y tipos coinciden con la implementación real en secrets, redaction, PII, privacy; aceptación: CONTRACT ≠ IMPLEMENTED. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-302** — módulo se registra una sola vez en el runtime canónico en secrets, redaction, PII, privacy; aceptación: sin runtime paralelo. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-303** — todas las rutas de entrada validan tipo, tamaño y forma en secrets, redaction, PII, privacy; aceptación: rechazo fail-closed. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-304** — valores ausentes, nulos y malformados producen error explícito en secrets, redaction, PII, privacy; aceptación: sin coerción silenciosa. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-305** — permisos se comprueban en servidor y no en el cliente en secrets, redaction, PII, privacy; aceptación: confianza cero. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-306** — roles y principal provienen de identidad autenticada en secrets, redaction, PII, privacy; aceptación: sin elevación desde payload. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-307** — errores no filtran secretos, PII, tokens ni contenido privado en secrets, redaction, PII, privacy; aceptación: redacción verificada. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-308** — estados de éxito requieren evidencia de operación real en secrets, redaction, PII, privacy; aceptación: sin éxito simulado. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-309** — hashes se calculan sobre representación canónica documentada en secrets, redaction, PII, privacy; aceptación: integridad reproducible. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-310** — verificación de hash no se presenta como autenticación de fuente en secrets, redaction, PII, privacy; aceptación: sin falsa garantía. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-311** — colecciones y objetos retornados no permiten mutación indirecta en secrets, redaction, PII, privacy; aceptación: inmutabilidad profunda. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-312** — reintentos e invocaciones repetidas son idempotentes cuando corresponde en secrets, redaction, PII, privacy; aceptación: sin duplicados. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-313** — operaciones concurrentes conservan consistencia y orden en secrets, redaction, PII, privacy; aceptación: sin carreras. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-314** — límites, timeout y cancelación evitan consumo ilimitado en secrets, redaction, PII, privacy; aceptación: recursos acotados. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-315** — salidas de red restringen protocolos, destinos y redirecciones en secrets, redaction, PII, privacy; aceptación: protección SSRF. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-316** — mensajes de error distinguen fallo, ausencia y estado inconcluso en secrets, redaction, PII, privacy; aceptación: semántica honesta. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-317** — registros de auditoría contienen actor, acción, tiempo y resultado en secrets, redaction, PII, privacy; aceptación: trazabilidad. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-318** — datos personales se minimizan, clasifican y retienen con política en secrets, redaction, PII, privacy; aceptación: privacidad por diseño. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-319** — aislamiento multiusuario/tenant se valida con pruebas cruzadas en secrets, redaction, PII, privacy; aceptación: sin fuga entre tenants. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-320** — dependencias, versiones y licencias están inventariadas en secrets, redaction, PII, privacy; aceptación: supply chain. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-321** — pruebas positivas cubren la ruta nominal y sus invariantes en secrets, redaction, PII, privacy; aceptación: caso nominal. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-322** — pruebas negativas cubren abuso, datos inválidos y permisos denegados en secrets, redaction, PII, privacy; aceptación: caso adversarial. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-323** — pruebas de regresión reproducen el hallazgo con una aserción en secrets, redaction, PII, privacy; aceptación: regresión bloqueante. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-324** — observabilidad permite diagnosticar sin exponer contenido sensible en secrets, redaction, PII, privacy; aceptación: logs seguros. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-325** — documentación declara limitaciones, estado real y criterio de aceptación en secrets, redaction, PII, privacy; aceptación: sin sobreafirmaciones. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.

### 14. Observabilidad, métricas y diagnóstico

**Rutas objetivo:** `src/telemetry/*; src/plugins/diff-observatory.ts`  
**Alcance:** logs, metrics, traces, redaction

- [ ] **AUD-326** — contrato y tipos coinciden con la implementación real en logs, metrics, traces, redaction; aceptación: CONTRACT ≠ IMPLEMENTED. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-327** — módulo se registra una sola vez en el runtime canónico en logs, metrics, traces, redaction; aceptación: sin runtime paralelo. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-328** — todas las rutas de entrada validan tipo, tamaño y forma en logs, metrics, traces, redaction; aceptación: rechazo fail-closed. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-329** — valores ausentes, nulos y malformados producen error explícito en logs, metrics, traces, redaction; aceptación: sin coerción silenciosa. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-330** — permisos se comprueban en servidor y no en el cliente en logs, metrics, traces, redaction; aceptación: confianza cero. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-331** — roles y principal provienen de identidad autenticada en logs, metrics, traces, redaction; aceptación: sin elevación desde payload. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-332** — errores no filtran secretos, PII, tokens ni contenido privado en logs, metrics, traces, redaction; aceptación: redacción verificada. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-333** — estados de éxito requieren evidencia de operación real en logs, metrics, traces, redaction; aceptación: sin éxito simulado. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-334** — hashes se calculan sobre representación canónica documentada en logs, metrics, traces, redaction; aceptación: integridad reproducible. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-335** — verificación de hash no se presenta como autenticación de fuente en logs, metrics, traces, redaction; aceptación: sin falsa garantía. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-336** — colecciones y objetos retornados no permiten mutación indirecta en logs, metrics, traces, redaction; aceptación: inmutabilidad profunda. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-337** — reintentos e invocaciones repetidas son idempotentes cuando corresponde en logs, metrics, traces, redaction; aceptación: sin duplicados. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-338** — operaciones concurrentes conservan consistencia y orden en logs, metrics, traces, redaction; aceptación: sin carreras. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-339** — límites, timeout y cancelación evitan consumo ilimitado en logs, metrics, traces, redaction; aceptación: recursos acotados. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-340** — salidas de red restringen protocolos, destinos y redirecciones en logs, metrics, traces, redaction; aceptación: protección SSRF. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-341** — mensajes de error distinguen fallo, ausencia y estado inconcluso en logs, metrics, traces, redaction; aceptación: semántica honesta. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-342** — registros de auditoría contienen actor, acción, tiempo y resultado en logs, metrics, traces, redaction; aceptación: trazabilidad. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-343** — datos personales se minimizan, clasifican y retienen con política en logs, metrics, traces, redaction; aceptación: privacidad por diseño. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-344** — aislamiento multiusuario/tenant se valida con pruebas cruzadas en logs, metrics, traces, redaction; aceptación: sin fuga entre tenants. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-345** — dependencias, versiones y licencias están inventariadas en logs, metrics, traces, redaction; aceptación: supply chain. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-346** — pruebas positivas cubren la ruta nominal y sus invariantes en logs, metrics, traces, redaction; aceptación: caso nominal. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-347** — pruebas negativas cubren abuso, datos inválidos y permisos denegados en logs, metrics, traces, redaction; aceptación: caso adversarial. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-348** — pruebas de regresión reproducen el hallazgo con una aserción en logs, metrics, traces, redaction; aceptación: regresión bloqueante. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-349** — observabilidad permite diagnosticar sin exponer contenido sensible en logs, metrics, traces, redaction; aceptación: logs seguros. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-350** — documentación declara limitaciones, estado real y criterio de aceptación en logs, metrics, traces, redaction; aceptación: sin sobreafirmaciones. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.

### 15. Proveedores de IA y modelos

**Rutas objetivo:** `src/cognition/*; src/server.ts; src/providers/*`  
**Alcance:** LLM providers, prompt construction, failure modes

- [ ] **AUD-351** — contrato y tipos coinciden con la implementación real en LLM providers, prompt construction, failure modes; aceptación: CONTRACT ≠ IMPLEMENTED. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-352** — módulo se registra una sola vez en el runtime canónico en LLM providers, prompt construction, failure modes; aceptación: sin runtime paralelo. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-353** — todas las rutas de entrada validan tipo, tamaño y forma en LLM providers, prompt construction, failure modes; aceptación: rechazo fail-closed. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-354** — valores ausentes, nulos y malformados producen error explícito en LLM providers, prompt construction, failure modes; aceptación: sin coerción silenciosa. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-355** — permisos se comprueban en servidor y no en el cliente en LLM providers, prompt construction, failure modes; aceptación: confianza cero. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-356** — roles y principal provienen de identidad autenticada en LLM providers, prompt construction, failure modes; aceptación: sin elevación desde payload. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-357** — errores no filtran secretos, PII, tokens ni contenido privado en LLM providers, prompt construction, failure modes; aceptación: redacción verificada. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-358** — estados de éxito requieren evidencia de operación real en LLM providers, prompt construction, failure modes; aceptación: sin éxito simulado. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-359** — hashes se calculan sobre representación canónica documentada en LLM providers, prompt construction, failure modes; aceptación: integridad reproducible. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-360** — verificación de hash no se presenta como autenticación de fuente en LLM providers, prompt construction, failure modes; aceptación: sin falsa garantía. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-361** — colecciones y objetos retornados no permiten mutación indirecta en LLM providers, prompt construction, failure modes; aceptación: inmutabilidad profunda. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-362** — reintentos e invocaciones repetidas son idempotentes cuando corresponde en LLM providers, prompt construction, failure modes; aceptación: sin duplicados. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-363** — operaciones concurrentes conservan consistencia y orden en LLM providers, prompt construction, failure modes; aceptación: sin carreras. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-364** — límites, timeout y cancelación evitan consumo ilimitado en LLM providers, prompt construction, failure modes; aceptación: recursos acotados. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-365** — salidas de red restringen protocolos, destinos y redirecciones en LLM providers, prompt construction, failure modes; aceptación: protección SSRF. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-366** — mensajes de error distinguen fallo, ausencia y estado inconcluso en LLM providers, prompt construction, failure modes; aceptación: semántica honesta. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-367** — registros de auditoría contienen actor, acción, tiempo y resultado en LLM providers, prompt construction, failure modes; aceptación: trazabilidad. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-368** — datos personales se minimizan, clasifican y retienen con política en LLM providers, prompt construction, failure modes; aceptación: privacidad por diseño. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-369** — aislamiento multiusuario/tenant se valida con pruebas cruzadas en LLM providers, prompt construction, failure modes; aceptación: sin fuga entre tenants. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-370** — dependencias, versiones y licencias están inventariadas en LLM providers, prompt construction, failure modes; aceptación: supply chain. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-371** — pruebas positivas cubren la ruta nominal y sus invariantes en LLM providers, prompt construction, failure modes; aceptación: caso nominal. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-372** — pruebas negativas cubren abuso, datos inválidos y permisos denegados en LLM providers, prompt construction, failure modes; aceptación: caso adversarial. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-373** — pruebas de regresión reproducen el hallazgo con una aserción en LLM providers, prompt construction, failure modes; aceptación: regresión bloqueante. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-374** — observabilidad permite diagnosticar sin exponer contenido sensible en LLM providers, prompt construction, failure modes; aceptación: logs seguros. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-375** — documentación declara limitaciones, estado real y criterio de aceptación en LLM providers, prompt construction, failure modes; aceptación: sin sobreafirmaciones. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.

### 16. Quantum/PennyLane y servicios Python

**Rutas objetivo:** `src/quantum/*; services/pennylane_bridge.py`  
**Alcance:** quantum bridge, optional dependency, truthful status

- [ ] **AUD-376** — contrato y tipos coinciden con la implementación real en quantum bridge, optional dependency, truthful status; aceptación: CONTRACT ≠ IMPLEMENTED. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-377** — módulo se registra una sola vez en el runtime canónico en quantum bridge, optional dependency, truthful status; aceptación: sin runtime paralelo. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-378** — todas las rutas de entrada validan tipo, tamaño y forma en quantum bridge, optional dependency, truthful status; aceptación: rechazo fail-closed. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-379** — valores ausentes, nulos y malformados producen error explícito en quantum bridge, optional dependency, truthful status; aceptación: sin coerción silenciosa. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-380** — permisos se comprueban en servidor y no en el cliente en quantum bridge, optional dependency, truthful status; aceptación: confianza cero. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-381** — roles y principal provienen de identidad autenticada en quantum bridge, optional dependency, truthful status; aceptación: sin elevación desde payload. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-382** — errores no filtran secretos, PII, tokens ni contenido privado en quantum bridge, optional dependency, truthful status; aceptación: redacción verificada. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-383** — estados de éxito requieren evidencia de operación real en quantum bridge, optional dependency, truthful status; aceptación: sin éxito simulado. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-384** — hashes se calculan sobre representación canónica documentada en quantum bridge, optional dependency, truthful status; aceptación: integridad reproducible. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-385** — verificación de hash no se presenta como autenticación de fuente en quantum bridge, optional dependency, truthful status; aceptación: sin falsa garantía. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-386** — colecciones y objetos retornados no permiten mutación indirecta en quantum bridge, optional dependency, truthful status; aceptación: inmutabilidad profunda. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-387** — reintentos e invocaciones repetidas son idempotentes cuando corresponde en quantum bridge, optional dependency, truthful status; aceptación: sin duplicados. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-388** — operaciones concurrentes conservan consistencia y orden en quantum bridge, optional dependency, truthful status; aceptación: sin carreras. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-389** — límites, timeout y cancelación evitan consumo ilimitado en quantum bridge, optional dependency, truthful status; aceptación: recursos acotados. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-390** — salidas de red restringen protocolos, destinos y redirecciones en quantum bridge, optional dependency, truthful status; aceptación: protección SSRF. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-391** — mensajes de error distinguen fallo, ausencia y estado inconcluso en quantum bridge, optional dependency, truthful status; aceptación: semántica honesta. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-392** — registros de auditoría contienen actor, acción, tiempo y resultado en quantum bridge, optional dependency, truthful status; aceptación: trazabilidad. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-393** — datos personales se minimizan, clasifican y retienen con política en quantum bridge, optional dependency, truthful status; aceptación: privacidad por diseño. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-394** — aislamiento multiusuario/tenant se valida con pruebas cruzadas en quantum bridge, optional dependency, truthful status; aceptación: sin fuga entre tenants. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-395** — dependencias, versiones y licencias están inventariadas en quantum bridge, optional dependency, truthful status; aceptación: supply chain. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-396** — pruebas positivas cubren la ruta nominal y sus invariantes en quantum bridge, optional dependency, truthful status; aceptación: caso nominal. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-397** — pruebas negativas cubren abuso, datos inválidos y permisos denegados en quantum bridge, optional dependency, truthful status; aceptación: caso adversarial. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-398** — pruebas de regresión reproducen el hallazgo con una aserción en quantum bridge, optional dependency, truthful status; aceptación: regresión bloqueante. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-399** — observabilidad permite diagnosticar sin exponer contenido sensible en quantum bridge, optional dependency, truthful status; aceptación: logs seguros. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-400** — documentación declara limitaciones, estado real y criterio de aceptación en quantum bridge, optional dependency, truthful status; aceptación: sin sobreafirmaciones. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.

### 17. Pruebas unitarias, integración y regresión

**Rutas objetivo:** `test/*; vitest.config.*`  
**Alcance:** coverage, fixtures, security regressions

- [ ] **AUD-401** — contrato y tipos coinciden con la implementación real en coverage, fixtures, security regressions; aceptación: CONTRACT ≠ IMPLEMENTED. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-402** — módulo se registra una sola vez en el runtime canónico en coverage, fixtures, security regressions; aceptación: sin runtime paralelo. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-403** — todas las rutas de entrada validan tipo, tamaño y forma en coverage, fixtures, security regressions; aceptación: rechazo fail-closed. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-404** — valores ausentes, nulos y malformados producen error explícito en coverage, fixtures, security regressions; aceptación: sin coerción silenciosa. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-405** — permisos se comprueban en servidor y no en el cliente en coverage, fixtures, security regressions; aceptación: confianza cero. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-406** — roles y principal provienen de identidad autenticada en coverage, fixtures, security regressions; aceptación: sin elevación desde payload. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-407** — errores no filtran secretos, PII, tokens ni contenido privado en coverage, fixtures, security regressions; aceptación: redacción verificada. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-408** — estados de éxito requieren evidencia de operación real en coverage, fixtures, security regressions; aceptación: sin éxito simulado. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-409** — hashes se calculan sobre representación canónica documentada en coverage, fixtures, security regressions; aceptación: integridad reproducible. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-410** — verificación de hash no se presenta como autenticación de fuente en coverage, fixtures, security regressions; aceptación: sin falsa garantía. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-411** — colecciones y objetos retornados no permiten mutación indirecta en coverage, fixtures, security regressions; aceptación: inmutabilidad profunda. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-412** — reintentos e invocaciones repetidas son idempotentes cuando corresponde en coverage, fixtures, security regressions; aceptación: sin duplicados. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-413** — operaciones concurrentes conservan consistencia y orden en coverage, fixtures, security regressions; aceptación: sin carreras. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-414** — límites, timeout y cancelación evitan consumo ilimitado en coverage, fixtures, security regressions; aceptación: recursos acotados. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-415** — salidas de red restringen protocolos, destinos y redirecciones en coverage, fixtures, security regressions; aceptación: protección SSRF. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-416** — mensajes de error distinguen fallo, ausencia y estado inconcluso en coverage, fixtures, security regressions; aceptación: semántica honesta. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-417** — registros de auditoría contienen actor, acción, tiempo y resultado en coverage, fixtures, security regressions; aceptación: trazabilidad. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-418** — datos personales se minimizan, clasifican y retienen con política en coverage, fixtures, security regressions; aceptación: privacidad por diseño. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-419** — aislamiento multiusuario/tenant se valida con pruebas cruzadas en coverage, fixtures, security regressions; aceptación: sin fuga entre tenants. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-420** — dependencias, versiones y licencias están inventariadas en coverage, fixtures, security regressions; aceptación: supply chain. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-421** — pruebas positivas cubren la ruta nominal y sus invariantes en coverage, fixtures, security regressions; aceptación: caso nominal. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-422** — pruebas negativas cubren abuso, datos inválidos y permisos denegados en coverage, fixtures, security regressions; aceptación: caso adversarial. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-423** — pruebas de regresión reproducen el hallazgo con una aserción en coverage, fixtures, security regressions; aceptación: regresión bloqueante. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-424** — observabilidad permite diagnosticar sin exponer contenido sensible en coverage, fixtures, security regressions; aceptación: logs seguros. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-425** — documentación declara limitaciones, estado real y criterio de aceptación en coverage, fixtures, security regressions; aceptación: sin sobreafirmaciones. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.

### 18. Build, dependencias y CI/CD

**Rutas objetivo:** `package.json; pnpm-lock.yaml; tsconfig*.json; .github/workflows/*`  
**Alcance:** reproducibility, pipeline, supply chain

- [ ] **AUD-426** — contrato y tipos coinciden con la implementación real en reproducibility, pipeline, supply chain; aceptación: CONTRACT ≠ IMPLEMENTED. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-427** — módulo se registra una sola vez en el runtime canónico en reproducibility, pipeline, supply chain; aceptación: sin runtime paralelo. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-428** — todas las rutas de entrada validan tipo, tamaño y forma en reproducibility, pipeline, supply chain; aceptación: rechazo fail-closed. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-429** — valores ausentes, nulos y malformados producen error explícito en reproducibility, pipeline, supply chain; aceptación: sin coerción silenciosa. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-430** — permisos se comprueban en servidor y no en el cliente en reproducibility, pipeline, supply chain; aceptación: confianza cero. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-431** — roles y principal provienen de identidad autenticada en reproducibility, pipeline, supply chain; aceptación: sin elevación desde payload. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-432** — errores no filtran secretos, PII, tokens ni contenido privado en reproducibility, pipeline, supply chain; aceptación: redacción verificada. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-433** — estados de éxito requieren evidencia de operación real en reproducibility, pipeline, supply chain; aceptación: sin éxito simulado. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-434** — hashes se calculan sobre representación canónica documentada en reproducibility, pipeline, supply chain; aceptación: integridad reproducible. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-435** — verificación de hash no se presenta como autenticación de fuente en reproducibility, pipeline, supply chain; aceptación: sin falsa garantía. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-436** — colecciones y objetos retornados no permiten mutación indirecta en reproducibility, pipeline, supply chain; aceptación: inmutabilidad profunda. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-437** — reintentos e invocaciones repetidas son idempotentes cuando corresponde en reproducibility, pipeline, supply chain; aceptación: sin duplicados. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-438** — operaciones concurrentes conservan consistencia y orden en reproducibility, pipeline, supply chain; aceptación: sin carreras. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-439** — límites, timeout y cancelación evitan consumo ilimitado en reproducibility, pipeline, supply chain; aceptación: recursos acotados. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-440** — salidas de red restringen protocolos, destinos y redirecciones en reproducibility, pipeline, supply chain; aceptación: protección SSRF. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-441** — mensajes de error distinguen fallo, ausencia y estado inconcluso en reproducibility, pipeline, supply chain; aceptación: semántica honesta. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-442** — registros de auditoría contienen actor, acción, tiempo y resultado en reproducibility, pipeline, supply chain; aceptación: trazabilidad. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-443** — datos personales se minimizan, clasifican y retienen con política en reproducibility, pipeline, supply chain; aceptación: privacidad por diseño. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-444** — aislamiento multiusuario/tenant se valida con pruebas cruzadas en reproducibility, pipeline, supply chain; aceptación: sin fuga entre tenants. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-445** — dependencias, versiones y licencias están inventariadas en reproducibility, pipeline, supply chain; aceptación: supply chain. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-446** — pruebas positivas cubren la ruta nominal y sus invariantes en reproducibility, pipeline, supply chain; aceptación: caso nominal. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-447** — pruebas negativas cubren abuso, datos inválidos y permisos denegados en reproducibility, pipeline, supply chain; aceptación: caso adversarial. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-448** — pruebas de regresión reproducen el hallazgo con una aserción en reproducibility, pipeline, supply chain; aceptación: regresión bloqueante. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-449** — observabilidad permite diagnosticar sin exponer contenido sensible en reproducibility, pipeline, supply chain; aceptación: logs seguros. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-450** — documentación declara limitaciones, estado real y criterio de aceptación en reproducibility, pipeline, supply chain; aceptación: sin sobreafirmaciones. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.

### 19. Despliegue, resiliencia y operación

**Rutas objetivo:** `scripts/production-evidence.mjs; docs/ENVIRONMENT.md; vercel.json; Dockerfile`  
**Alcance:** readiness, health, rollback, config

- [ ] **AUD-451** — contrato y tipos coinciden con la implementación real en readiness, health, rollback, config; aceptación: CONTRACT ≠ IMPLEMENTED. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-452** — módulo se registra una sola vez en el runtime canónico en readiness, health, rollback, config; aceptación: sin runtime paralelo. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-453** — todas las rutas de entrada validan tipo, tamaño y forma en readiness, health, rollback, config; aceptación: rechazo fail-closed. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-454** — valores ausentes, nulos y malformados producen error explícito en readiness, health, rollback, config; aceptación: sin coerción silenciosa. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-455** — permisos se comprueban en servidor y no en el cliente en readiness, health, rollback, config; aceptación: confianza cero. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-456** — roles y principal provienen de identidad autenticada en readiness, health, rollback, config; aceptación: sin elevación desde payload. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-457** — errores no filtran secretos, PII, tokens ni contenido privado en readiness, health, rollback, config; aceptación: redacción verificada. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-458** — estados de éxito requieren evidencia de operación real en readiness, health, rollback, config; aceptación: sin éxito simulado. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-459** — hashes se calculan sobre representación canónica documentada en readiness, health, rollback, config; aceptación: integridad reproducible. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-460** — verificación de hash no se presenta como autenticación de fuente en readiness, health, rollback, config; aceptación: sin falsa garantía. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-461** — colecciones y objetos retornados no permiten mutación indirecta en readiness, health, rollback, config; aceptación: inmutabilidad profunda. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-462** — reintentos e invocaciones repetidas son idempotentes cuando corresponde en readiness, health, rollback, config; aceptación: sin duplicados. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-463** — operaciones concurrentes conservan consistencia y orden en readiness, health, rollback, config; aceptación: sin carreras. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-464** — límites, timeout y cancelación evitan consumo ilimitado en readiness, health, rollback, config; aceptación: recursos acotados. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-465** — salidas de red restringen protocolos, destinos y redirecciones en readiness, health, rollback, config; aceptación: protección SSRF. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-466** — mensajes de error distinguen fallo, ausencia y estado inconcluso en readiness, health, rollback, config; aceptación: semántica honesta. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-467** — registros de auditoría contienen actor, acción, tiempo y resultado en readiness, health, rollback, config; aceptación: trazabilidad. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-468** — datos personales se minimizan, clasifican y retienen con política en readiness, health, rollback, config; aceptación: privacidad por diseño. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-469** — aislamiento multiusuario/tenant se valida con pruebas cruzadas en readiness, health, rollback, config; aceptación: sin fuga entre tenants. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-470** — dependencias, versiones y licencias están inventariadas en readiness, health, rollback, config; aceptación: supply chain. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-471** — pruebas positivas cubren la ruta nominal y sus invariantes en readiness, health, rollback, config; aceptación: caso nominal. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-472** — pruebas negativas cubren abuso, datos inválidos y permisos denegados en readiness, health, rollback, config; aceptación: caso adversarial. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-473** — pruebas de regresión reproducen el hallazgo con una aserción en readiness, health, rollback, config; aceptación: regresión bloqueante. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-474** — observabilidad permite diagnosticar sin exponer contenido sensible en readiness, health, rollback, config; aceptación: logs seguros. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-475** — documentación declara limitaciones, estado real y criterio de aceptación en readiness, health, rollback, config; aceptación: sin sobreafirmaciones. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.

### 20. Documentación, licencias y cumplimiento

**Rutas objetivo:** `README.md; LICENSE; SECURITY.md; docs/*`  
**Alcance:** claims, legal, IP, release evidence

- [ ] **AUD-476** — contrato y tipos coinciden con la implementación real en claims, legal, IP, release evidence; aceptación: CONTRACT ≠ IMPLEMENTED. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-477** — módulo se registra una sola vez en el runtime canónico en claims, legal, IP, release evidence; aceptación: sin runtime paralelo. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-478** — todas las rutas de entrada validan tipo, tamaño y forma en claims, legal, IP, release evidence; aceptación: rechazo fail-closed. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-479** — valores ausentes, nulos y malformados producen error explícito en claims, legal, IP, release evidence; aceptación: sin coerción silenciosa. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-480** — permisos se comprueban en servidor y no en el cliente en claims, legal, IP, release evidence; aceptación: confianza cero. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-481** — roles y principal provienen de identidad autenticada en claims, legal, IP, release evidence; aceptación: sin elevación desde payload. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-482** — errores no filtran secretos, PII, tokens ni contenido privado en claims, legal, IP, release evidence; aceptación: redacción verificada. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-483** — estados de éxito requieren evidencia de operación real en claims, legal, IP, release evidence; aceptación: sin éxito simulado. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-484** — hashes se calculan sobre representación canónica documentada en claims, legal, IP, release evidence; aceptación: integridad reproducible. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-485** — verificación de hash no se presenta como autenticación de fuente en claims, legal, IP, release evidence; aceptación: sin falsa garantía. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-486** — colecciones y objetos retornados no permiten mutación indirecta en claims, legal, IP, release evidence; aceptación: inmutabilidad profunda. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-487** — reintentos e invocaciones repetidas son idempotentes cuando corresponde en claims, legal, IP, release evidence; aceptación: sin duplicados. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-488** — operaciones concurrentes conservan consistencia y orden en claims, legal, IP, release evidence; aceptación: sin carreras. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-489** — límites, timeout y cancelación evitan consumo ilimitado en claims, legal, IP, release evidence; aceptación: recursos acotados. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-490** — salidas de red restringen protocolos, destinos y redirecciones en claims, legal, IP, release evidence; aceptación: protección SSRF. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-491** — mensajes de error distinguen fallo, ausencia y estado inconcluso en claims, legal, IP, release evidence; aceptación: semántica honesta. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-492** — registros de auditoría contienen actor, acción, tiempo y resultado en claims, legal, IP, release evidence; aceptación: trazabilidad. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-493** — datos personales se minimizan, clasifican y retienen con política en claims, legal, IP, release evidence; aceptación: privacidad por diseño. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-494** — aislamiento multiusuario/tenant se valida con pruebas cruzadas en claims, legal, IP, release evidence; aceptación: sin fuga entre tenants. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-495** — dependencias, versiones y licencias están inventariadas en claims, legal, IP, release evidence; aceptación: supply chain. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-496** — pruebas positivas cubren la ruta nominal y sus invariantes en claims, legal, IP, release evidence; aceptación: caso nominal. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-497** — pruebas negativas cubren abuso, datos inválidos y permisos denegados en claims, legal, IP, release evidence; aceptación: caso adversarial. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-498** — pruebas de regresión reproducen el hallazgo con una aserción en claims, legal, IP, release evidence; aceptación: regresión bloqueante. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-499** — observabilidad permite diagnosticar sin exponer contenido sensible en claims, legal, IP, release evidence; aceptación: logs seguros. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.
- [ ] **AUD-500** — documentación declara limitaciones, estado real y criterio de aceptación en claims, legal, IP, release evidence; aceptación: sin sobreafirmaciones. **Estado:** PENDIENTE. **Evidencia:** por adjuntar. **Severidad:** por clasificar.

## Plantilla obligatoria para registrar cada hallazgo

Para cambiar cualquier punto a CONFIRMADO, completar: ID; SHA auditado; ruta y rango de líneas; precondiciones; pasos de reproducción; resultado observado; resultado esperado; prueba de regresión; impacto; severidad; responsable; corrección propuesta; estado de CI; fecha de revalidación.

## Puertas de salida para declarar listo para producción

- [ ] Todos los P0/P1 cerrados o con excepción documentada, firmada y con caducidad.
- [ ] Typecheck, pruebas, build y escáneres pasan sobre el mismo SHA candidato.
- [ ] Se verifica autorización de servidor, aislamiento de datos y redacción de secretos.
- [ ] Se valida restauración de backups y rollback en entorno representativo.
- [ ] Cada proveedor externo se declara CONFIGURADO, NO_CONFIGURADO o NO_VERIFICADO con evidencia.
- [ ] El release incorpora manifest de evidencia, commit completo, resultados y limitaciones.
- [ ] El README no atribuye certificaciones, cumplimiento jurídico o porcentajes de avance sin evidencia.
- [ ] Se publica una matriz de licencias por componente, datos y zona de despliegue; la licencia del repositorio no se confunde con los derechos sobre datos/modelos.

## Referencias internas

- [README](../README.md)
- [Auditoría Genesis V6](./AUDIT_GENESIS_V6_2026-10-08.md)
- [Auditoría de evolución del ecosistema](./ECOSYSTEM_EVOLUTION_AUDIT_2026-10-09.md)
- [Configuración de entorno](./ENVIRONMENT.md)
- [Política de seguridad](../SECURITY.md)

---

**Conteo generado:** 500 puntos de control (20 dominios × 25 controles). Los puntos pendientes no deben reportarse como errores confirmados.


---

## Documento B — `docs/AUDIT_CHECKLIST_500_ISABELLA_GENESISAI.md`

---

# Isabella Villaseñor GenesisAI — Checklist de auditoría total de 500 controles

> **Importante:** son 500 controles accionables de auditoría, no 500 defectos confirmados. No marcar un control como aprobado sin evidencia. Un control sin inspección, prueba o resultado reproducible permanece pendiente.

- Repositorio: `OsoPanda1/Isabella-Villase-or-GenesisAI`
- Rama: `audit/checklist-500-oct-2026`
- Arquitectura: Isabella GenesisAI es el runtime canónico; el resto del ecosistema debe integrarse como módulos, adaptadores o servicios subordinados.
- Estados: `[ ]` pendiente · `[x]` aprobado con evidencia · `[!]` defecto reproducido · `[~]` mitigación parcial.

## Hallazgos de código identificados durante esta revisión

1. [~] La clasificación de duplicados utilizaba igualdad de fingerprints estructurales/semánticos para emitir `VERIFIED_DUPLICATE`. La igualdad de resúmenes con pérdida no demuestra identidad exacta. Se modificó la clasificación en una rama de trabajo anterior; ese ref ya no estaba disponible, por lo que debe reaplicarse y validarse en esta rama antes de considerarlo integrado.
2. [~] En IKES, congelar solo el objeto exterior no protegía todos los arrays y objetos anidados. Se preparó una corrección en una rama que no se pudo resolver al crear el documento; la corrección debe verificarse y reaplicarse en una rama activa.
3. [ ] El manifiesto de evidencia y los gates de estabilidad requieren revisión para asegurar que el identificador cubra todos los campos materiales y que una excepción no se apruebe mediante un booleano controlado por el llamador.
4. [ ] Los endpoints cognitivos requieren verificación de rate limiting y límites de entrada en cada ruta. No declarar la mitigación implementada hasta probar las respuestas 413/429 y confirmar CI.
5. [ ] La rama de checklist parte de `main`; este documento no incorpora por sí mismo los cambios de código de otras ramas.
6. [ ] No considerar el sistema listo para producción o merge hasta que typecheck, pruebas, escaneos de seguridad y CI se ejecuten sobre el SHA final y queden aprobados.

## Registro obligatorio por hallazgo

Registrar: ID, severidad, repositorio, archivo y líneas, evidencia reproducible, impacto, propietario, corrección, prueba de regresión, SHA y estado. No convertir riesgos potenciales en defectos confirmados sin evidencia.

## 1. Inventario de repositorios

- [ ] **AUD-001** inventario de repositorios, forks, ramas, visibilidad y mantenimiento: Validar contrato, esquema y compatibilidad; añadir pruebas para campos inválidos. (dimensión: contrato).
- [ ] **AUD-002** inventario de repositorios, forks, ramas, visibilidad y mantenimiento: Exigir evidencia reproducible del comportamiento; documentación sola no cuenta como prueba. (dimensión: evidencia).
- [ ] **AUD-003** inventario de repositorios, forks, ramas, visibilidad y mantenimiento: Probar configuración ausente, proveedor caído y error interno; evitar declarar éxito. (dimensión: fallo seguro).
- [ ] **AUD-004** inventario de repositorios, forks, ramas, visibilidad y mantenimiento: Comprobar que la autorización provenga del servidor y que el cliente no pueda elevar privilegios. (dimensión: autorización).
- [ ] **AUD-005** inventario de repositorios, forks, ramas, visibilidad y mantenimiento: Definir límites de tamaño, tiempo, concurrencia y consumo; probar el límite y el exceso. (dimensión: límites).
- [ ] **AUD-006** inventario de repositorios, forks, ramas, visibilidad y mantenimiento: Comprobar que tokens, claves y datos personales no aparezcan en logs o respuestas. (dimensión: secretos).
- [ ] **AUD-007** inventario de repositorios, forks, ramas, visibilidad y mantenimiento: Verificar que referencias y objetos anidados no alteren estado que se considera inmutable. (dimensión: mutabilidad).
- [ ] **AUD-008** inventario de repositorios, forks, ramas, visibilidad y mantenimiento: Probar reintentos, duplicados y concurrencia sin duplicar efectos secundarios. (dimensión: reintentos).
- [ ] **AUD-009** inventario de repositorios, forks, ramas, visibilidad y mantenimiento: Registrar estado, correlación y motivo sin filtrar datos sensibles ni confundir simulación con ejecución. (dimensión: observabilidad).
- [ ] **AUD-010** inventario de repositorios, forks, ramas, visibilidad y mantenimiento: Probar el contrato con el runtime canónico y con el adaptador real, no solo mocks permisivos. (dimensión: integración).
- [ ] **AUD-011** inventario de repositorios, forks, ramas, visibilidad y mantenimiento: Agregar prueba para entrada maliciosa, permiso denegado o evidencia incompleta. (dimensión: prueba negativa).
- [ ] **AUD-012** inventario de repositorios, forks, ramas, visibilidad y mantenimiento: Vincular cada defecto confirmado con una prueba que falle antes y pase después de corregirlo. (dimensión: regresión).
- [ ] **AUD-013** inventario de repositorios, forks, ramas, visibilidad y mantenimiento: Identificar dependencias directas/transitivas, versiones, licencias y vulnerabilidades pertinentes. (dimensión: dependencias).
- [ ] **AUD-014** inventario de repositorios, forks, ramas, visibilidad y mantenimiento: Validar variables requeridas y defaults; configuración crítica ausente debe fallar cerrada. (dimensión: configuración).
- [ ] **AUD-015** inventario de repositorios, forks, ramas, visibilidad y mantenimiento: Alinear la documentación con el código ejecutado y marcar limitaciones no implementadas. (dimensión: documentación).
- [ ] **AUD-016** inventario de repositorios, forks, ramas, visibilidad y mantenimiento: Registrar versión, commit, algoritmo o modelo que originó el resultado y permitir reproducirlo. (dimensión: versionado).
- [ ] **AUD-017** inventario de repositorios, forks, ramas, visibilidad y mantenimiento: Probar separación entre usuarios, tenants, sesiones y datos restringidos. (dimensión: aislamiento).
- [ ] **AUD-018** inventario de repositorios, forks, ramas, visibilidad y mantenimiento: Verificar que acciones críticas generen un evento de auditoría correlacionable e íntegro. (dimensión: auditoría).
- [ ] **AUD-019** inventario de repositorios, forks, ramas, visibilidad y mantenimiento: Probar recuperación tras reinicio, fallo parcial, desconexión o rollback. (dimensión: recuperación).
- [ ] **AUD-020** inventario de repositorios, forks, ramas, visibilidad y mantenimiento: Impedir promoción a producción si el control crítico está fallido, omitido o no evaluado. (dimensión: gate de release).

## 2. Runtime canónico

- [ ] **AUD-021** inicialización, ciclo de vida y unicidad del runtime Isabella GenesisAI: Validar contrato, esquema y compatibilidad; añadir pruebas para campos inválidos. (dimensión: contrato).
- [ ] **AUD-022** inicialización, ciclo de vida y unicidad del runtime Isabella GenesisAI: Exigir evidencia reproducible del comportamiento; documentación sola no cuenta como prueba. (dimensión: evidencia).
- [ ] **AUD-023** inicialización, ciclo de vida y unicidad del runtime Isabella GenesisAI: Probar configuración ausente, proveedor caído y error interno; evitar declarar éxito. (dimensión: fallo seguro).
- [ ] **AUD-024** inicialización, ciclo de vida y unicidad del runtime Isabella GenesisAI: Comprobar que la autorización provenga del servidor y que el cliente no pueda elevar privilegios. (dimensión: autorización).
- [ ] **AUD-025** inicialización, ciclo de vida y unicidad del runtime Isabella GenesisAI: Definir límites de tamaño, tiempo, concurrencia y consumo; probar el límite y el exceso. (dimensión: límites).
- [ ] **AUD-026** inicialización, ciclo de vida y unicidad del runtime Isabella GenesisAI: Comprobar que tokens, claves y datos personales no aparezcan en logs o respuestas. (dimensión: secretos).
- [ ] **AUD-027** inicialización, ciclo de vida y unicidad del runtime Isabella GenesisAI: Verificar que referencias y objetos anidados no alteren estado que se considera inmutable. (dimensión: mutabilidad).
- [ ] **AUD-028** inicialización, ciclo de vida y unicidad del runtime Isabella GenesisAI: Probar reintentos, duplicados y concurrencia sin duplicar efectos secundarios. (dimensión: reintentos).
- [ ] **AUD-029** inicialización, ciclo de vida y unicidad del runtime Isabella GenesisAI: Registrar estado, correlación y motivo sin filtrar datos sensibles ni confundir simulación con ejecución. (dimensión: observabilidad).
- [ ] **AUD-030** inicialización, ciclo de vida y unicidad del runtime Isabella GenesisAI: Probar el contrato con el runtime canónico y con el adaptador real, no solo mocks permisivos. (dimensión: integración).
- [ ] **AUD-031** inicialización, ciclo de vida y unicidad del runtime Isabella GenesisAI: Agregar prueba para entrada maliciosa, permiso denegado o evidencia incompleta. (dimensión: prueba negativa).
- [ ] **AUD-032** inicialización, ciclo de vida y unicidad del runtime Isabella GenesisAI: Vincular cada defecto confirmado con una prueba que falle antes y pase después de corregirlo. (dimensión: regresión).
- [ ] **AUD-033** inicialización, ciclo de vida y unicidad del runtime Isabella GenesisAI: Identificar dependencias directas/transitivas, versiones, licencias y vulnerabilidades pertinentes. (dimensión: dependencias).
- [ ] **AUD-034** inicialización, ciclo de vida y unicidad del runtime Isabella GenesisAI: Validar variables requeridas y defaults; configuración crítica ausente debe fallar cerrada. (dimensión: configuración).
- [ ] **AUD-035** inicialización, ciclo de vida y unicidad del runtime Isabella GenesisAI: Alinear la documentación con el código ejecutado y marcar limitaciones no implementadas. (dimensión: documentación).
- [ ] **AUD-036** inicialización, ciclo de vida y unicidad del runtime Isabella GenesisAI: Registrar versión, commit, algoritmo o modelo que originó el resultado y permitir reproducirlo. (dimensión: versionado).
- [ ] **AUD-037** inicialización, ciclo de vida y unicidad del runtime Isabella GenesisAI: Probar separación entre usuarios, tenants, sesiones y datos restringidos. (dimensión: aislamiento).
- [ ] **AUD-038** inicialización, ciclo de vida y unicidad del runtime Isabella GenesisAI: Verificar que acciones críticas generen un evento de auditoría correlacionable e íntegro. (dimensión: auditoría).
- [ ] **AUD-039** inicialización, ciclo de vida y unicidad del runtime Isabella GenesisAI: Probar recuperación tras reinicio, fallo parcial, desconexión o rollback. (dimensión: recuperación).
- [ ] **AUD-040** inicialización, ciclo de vida y unicidad del runtime Isabella GenesisAI: Impedir promoción a producción si el control crítico está fallido, omitido o no evaluado. (dimensión: gate de release).

## 3. Autenticación y autorización

- [ ] **AUD-041** identidad, roles, permisos, scopes y denegación por defecto: Validar contrato, esquema y compatibilidad; añadir pruebas para campos inválidos. (dimensión: contrato).
- [ ] **AUD-042** identidad, roles, permisos, scopes y denegación por defecto: Exigir evidencia reproducible del comportamiento; documentación sola no cuenta como prueba. (dimensión: evidencia).
- [ ] **AUD-043** identidad, roles, permisos, scopes y denegación por defecto: Probar configuración ausente, proveedor caído y error interno; evitar declarar éxito. (dimensión: fallo seguro).
- [ ] **AUD-044** identidad, roles, permisos, scopes y denegación por defecto: Comprobar que la autorización provenga del servidor y que el cliente no pueda elevar privilegios. (dimensión: autorización).
- [ ] **AUD-045** identidad, roles, permisos, scopes y denegación por defecto: Definir límites de tamaño, tiempo, concurrencia y consumo; probar el límite y el exceso. (dimensión: límites).
- [ ] **AUD-046** identidad, roles, permisos, scopes y denegación por defecto: Comprobar que tokens, claves y datos personales no aparezcan en logs o respuestas. (dimensión: secretos).
- [ ] **AUD-047** identidad, roles, permisos, scopes y denegación por defecto: Verificar que referencias y objetos anidados no alteren estado que se considera inmutable. (dimensión: mutabilidad).
- [ ] **AUD-048** identidad, roles, permisos, scopes y denegación por defecto: Probar reintentos, duplicados y concurrencia sin duplicar efectos secundarios. (dimensión: reintentos).
- [ ] **AUD-049** identidad, roles, permisos, scopes y denegación por defecto: Registrar estado, correlación y motivo sin filtrar datos sensibles ni confundir simulación con ejecución. (dimensión: observabilidad).
- [ ] **AUD-050** identidad, roles, permisos, scopes y denegación por defecto: Probar el contrato con el runtime canónico y con el adaptador real, no solo mocks permisivos. (dimensión: integración).
- [ ] **AUD-051** identidad, roles, permisos, scopes y denegación por defecto: Agregar prueba para entrada maliciosa, permiso denegado o evidencia incompleta. (dimensión: prueba negativa).
- [ ] **AUD-052** identidad, roles, permisos, scopes y denegación por defecto: Vincular cada defecto confirmado con una prueba que falle antes y pase después de corregirlo. (dimensión: regresión).
- [ ] **AUD-053** identidad, roles, permisos, scopes y denegación por defecto: Identificar dependencias directas/transitivas, versiones, licencias y vulnerabilidades pertinentes. (dimensión: dependencias).
- [ ] **AUD-054** identidad, roles, permisos, scopes y denegación por defecto: Validar variables requeridas y defaults; configuración crítica ausente debe fallar cerrada. (dimensión: configuración).
- [ ] **AUD-055** identidad, roles, permisos, scopes y denegación por defecto: Alinear la documentación con el código ejecutado y marcar limitaciones no implementadas. (dimensión: documentación).
- [ ] **AUD-056** identidad, roles, permisos, scopes y denegación por defecto: Registrar versión, commit, algoritmo o modelo que originó el resultado y permitir reproducirlo. (dimensión: versionado).
- [ ] **AUD-057** identidad, roles, permisos, scopes y denegación por defecto: Probar separación entre usuarios, tenants, sesiones y datos restringidos. (dimensión: aislamiento).
- [ ] **AUD-058** identidad, roles, permisos, scopes y denegación por defecto: Verificar que acciones críticas generen un evento de auditoría correlacionable e íntegro. (dimensión: auditoría).
- [ ] **AUD-059** identidad, roles, permisos, scopes y denegación por defecto: Probar recuperación tras reinicio, fallo parcial, desconexión o rollback. (dimensión: recuperación).
- [ ] **AUD-060** identidad, roles, permisos, scopes y denegación por defecto: Impedir promoción a producción si el control crítico está fallido, omitido o no evaluado. (dimensión: gate de release).

## 4. Validación de entrada

- [ ] **AUD-061** esquemas, límites, normalización y rechazo de payloads inválidos: Validar contrato, esquema y compatibilidad; añadir pruebas para campos inválidos. (dimensión: contrato).
- [ ] **AUD-062** esquemas, límites, normalización y rechazo de payloads inválidos: Exigir evidencia reproducible del comportamiento; documentación sola no cuenta como prueba. (dimensión: evidencia).
- [ ] **AUD-063** esquemas, límites, normalización y rechazo de payloads inválidos: Probar configuración ausente, proveedor caído y error interno; evitar declarar éxito. (dimensión: fallo seguro).
- [ ] **AUD-064** esquemas, límites, normalización y rechazo de payloads inválidos: Comprobar que la autorización provenga del servidor y que el cliente no pueda elevar privilegios. (dimensión: autorización).
- [ ] **AUD-065** esquemas, límites, normalización y rechazo de payloads inválidos: Definir límites de tamaño, tiempo, concurrencia y consumo; probar el límite y el exceso. (dimensión: límites).
- [ ] **AUD-066** esquemas, límites, normalización y rechazo de payloads inválidos: Comprobar que tokens, claves y datos personales no aparezcan en logs o respuestas. (dimensión: secretos).
- [ ] **AUD-067** esquemas, límites, normalización y rechazo de payloads inválidos: Verificar que referencias y objetos anidados no alteren estado que se considera inmutable. (dimensión: mutabilidad).
- [ ] **AUD-068** esquemas, límites, normalización y rechazo de payloads inválidos: Probar reintentos, duplicados y concurrencia sin duplicar efectos secundarios. (dimensión: reintentos).
- [ ] **AUD-069** esquemas, límites, normalización y rechazo de payloads inválidos: Registrar estado, correlación y motivo sin filtrar datos sensibles ni confundir simulación con ejecución. (dimensión: observabilidad).
- [ ] **AUD-070** esquemas, límites, normalización y rechazo de payloads inválidos: Probar el contrato con el runtime canónico y con el adaptador real, no solo mocks permisivos. (dimensión: integración).
- [ ] **AUD-071** esquemas, límites, normalización y rechazo de payloads inválidos: Agregar prueba para entrada maliciosa, permiso denegado o evidencia incompleta. (dimensión: prueba negativa).
- [ ] **AUD-072** esquemas, límites, normalización y rechazo de payloads inválidos: Vincular cada defecto confirmado con una prueba que falle antes y pase después de corregirlo. (dimensión: regresión).
- [ ] **AUD-073** esquemas, límites, normalización y rechazo de payloads inválidos: Identificar dependencias directas/transitivas, versiones, licencias y vulnerabilidades pertinentes. (dimensión: dependencias).
- [ ] **AUD-074** esquemas, límites, normalización y rechazo de payloads inválidos: Validar variables requeridas y defaults; configuración crítica ausente debe fallar cerrada. (dimensión: configuración).
- [ ] **AUD-075** esquemas, límites, normalización y rechazo de payloads inválidos: Alinear la documentación con el código ejecutado y marcar limitaciones no implementadas. (dimensión: documentación).
- [ ] **AUD-076** esquemas, límites, normalización y rechazo de payloads inválidos: Registrar versión, commit, algoritmo o modelo que originó el resultado y permitir reproducirlo. (dimensión: versionado).
- [ ] **AUD-077** esquemas, límites, normalización y rechazo de payloads inválidos: Probar separación entre usuarios, tenants, sesiones y datos restringidos. (dimensión: aislamiento).
- [ ] **AUD-078** esquemas, límites, normalización y rechazo de payloads inválidos: Verificar que acciones críticas generen un evento de auditoría correlacionable e íntegro. (dimensión: auditoría).
- [ ] **AUD-079** esquemas, límites, normalización y rechazo de payloads inválidos: Probar recuperación tras reinicio, fallo parcial, desconexión o rollback. (dimensión: recuperación).
- [ ] **AUD-080** esquemas, límites, normalización y rechazo de payloads inválidos: Impedir promoción a producción si el control crítico está fallido, omitido o no evaluado. (dimensión: gate de release).

## 5. Secretos y privacidad

- [ ] **AUD-081** redacción de datos sensibles, almacenamiento, retención y borrado: Validar contrato, esquema y compatibilidad; añadir pruebas para campos inválidos. (dimensión: contrato).
- [ ] **AUD-082** redacción de datos sensibles, almacenamiento, retención y borrado: Exigir evidencia reproducible del comportamiento; documentación sola no cuenta como prueba. (dimensión: evidencia).
- [ ] **AUD-083** redacción de datos sensibles, almacenamiento, retención y borrado: Probar configuración ausente, proveedor caído y error interno; evitar declarar éxito. (dimensión: fallo seguro).
- [ ] **AUD-084** redacción de datos sensibles, almacenamiento, retención y borrado: Comprobar que la autorización provenga del servidor y que el cliente no pueda elevar privilegios. (dimensión: autorización).
- [ ] **AUD-085** redacción de datos sensibles, almacenamiento, retención y borrado: Definir límites de tamaño, tiempo, concurrencia y consumo; probar el límite y el exceso. (dimensión: límites).
- [ ] **AUD-086** redacción de datos sensibles, almacenamiento, retención y borrado: Comprobar que tokens, claves y datos personales no aparezcan en logs o respuestas. (dimensión: secretos).
- [ ] **AUD-087** redacción de datos sensibles, almacenamiento, retención y borrado: Verificar que referencias y objetos anidados no alteren estado que se considera inmutable. (dimensión: mutabilidad).
- [ ] **AUD-088** redacción de datos sensibles, almacenamiento, retención y borrado: Probar reintentos, duplicados y concurrencia sin duplicar efectos secundarios. (dimensión: reintentos).
- [ ] **AUD-089** redacción de datos sensibles, almacenamiento, retención y borrado: Registrar estado, correlación y motivo sin filtrar datos sensibles ni confundir simulación con ejecución. (dimensión: observabilidad).
- [ ] **AUD-090** redacción de datos sensibles, almacenamiento, retención y borrado: Probar el contrato con el runtime canónico y con el adaptador real, no solo mocks permisivos. (dimensión: integración).
- [ ] **AUD-091** redacción de datos sensibles, almacenamiento, retención y borrado: Agregar prueba para entrada maliciosa, permiso denegado o evidencia incompleta. (dimensión: prueba negativa).
- [ ] **AUD-092** redacción de datos sensibles, almacenamiento, retención y borrado: Vincular cada defecto confirmado con una prueba que falle antes y pase después de corregirlo. (dimensión: regresión).
- [ ] **AUD-093** redacción de datos sensibles, almacenamiento, retención y borrado: Identificar dependencias directas/transitivas, versiones, licencias y vulnerabilidades pertinentes. (dimensión: dependencias).
- [ ] **AUD-094** redacción de datos sensibles, almacenamiento, retención y borrado: Validar variables requeridas y defaults; configuración crítica ausente debe fallar cerrada. (dimensión: configuración).
- [ ] **AUD-095** redacción de datos sensibles, almacenamiento, retención y borrado: Alinear la documentación con el código ejecutado y marcar limitaciones no implementadas. (dimensión: documentación).
- [ ] **AUD-096** redacción de datos sensibles, almacenamiento, retención y borrado: Registrar versión, commit, algoritmo o modelo que originó el resultado y permitir reproducirlo. (dimensión: versionado).
- [ ] **AUD-097** redacción de datos sensibles, almacenamiento, retención y borrado: Probar separación entre usuarios, tenants, sesiones y datos restringidos. (dimensión: aislamiento).
- [ ] **AUD-098** redacción de datos sensibles, almacenamiento, retención y borrado: Verificar que acciones críticas generen un evento de auditoría correlacionable e íntegro. (dimensión: auditoría).
- [ ] **AUD-099** redacción de datos sensibles, almacenamiento, retención y borrado: Probar recuperación tras reinicio, fallo parcial, desconexión o rollback. (dimensión: recuperación).
- [ ] **AUD-100** redacción de datos sensibles, almacenamiento, retención y borrado: Impedir promoción a producción si el control crítico está fallido, omitido o no evaluado. (dimensión: gate de release).

## 6. Prompt injection

- [ ] **AUD-101** fronteras de confianza entre instrucciones, documentos recuperados y herramientas: Validar contrato, esquema y compatibilidad; añadir pruebas para campos inválidos. (dimensión: contrato).
- [ ] **AUD-102** fronteras de confianza entre instrucciones, documentos recuperados y herramientas: Exigir evidencia reproducible del comportamiento; documentación sola no cuenta como prueba. (dimensión: evidencia).
- [ ] **AUD-103** fronteras de confianza entre instrucciones, documentos recuperados y herramientas: Probar configuración ausente, proveedor caído y error interno; evitar declarar éxito. (dimensión: fallo seguro).
- [ ] **AUD-104** fronteras de confianza entre instrucciones, documentos recuperados y herramientas: Comprobar que la autorización provenga del servidor y que el cliente no pueda elevar privilegios. (dimensión: autorización).
- [ ] **AUD-105** fronteras de confianza entre instrucciones, documentos recuperados y herramientas: Definir límites de tamaño, tiempo, concurrencia y consumo; probar el límite y el exceso. (dimensión: límites).
- [ ] **AUD-106** fronteras de confianza entre instrucciones, documentos recuperados y herramientas: Comprobar que tokens, claves y datos personales no aparezcan en logs o respuestas. (dimensión: secretos).
- [ ] **AUD-107** fronteras de confianza entre instrucciones, documentos recuperados y herramientas: Verificar que referencias y objetos anidados no alteren estado que se considera inmutable. (dimensión: mutabilidad).
- [ ] **AUD-108** fronteras de confianza entre instrucciones, documentos recuperados y herramientas: Probar reintentos, duplicados y concurrencia sin duplicar efectos secundarios. (dimensión: reintentos).
- [ ] **AUD-109** fronteras de confianza entre instrucciones, documentos recuperados y herramientas: Registrar estado, correlación y motivo sin filtrar datos sensibles ni confundir simulación con ejecución. (dimensión: observabilidad).
- [ ] **AUD-110** fronteras de confianza entre instrucciones, documentos recuperados y herramientas: Probar el contrato con el runtime canónico y con el adaptador real, no solo mocks permisivos. (dimensión: integración).
- [ ] **AUD-111** fronteras de confianza entre instrucciones, documentos recuperados y herramientas: Agregar prueba para entrada maliciosa, permiso denegado o evidencia incompleta. (dimensión: prueba negativa).
- [ ] **AUD-112** fronteras de confianza entre instrucciones, documentos recuperados y herramientas: Vincular cada defecto confirmado con una prueba que falle antes y pase después de corregirlo. (dimensión: regresión).
- [ ] **AUD-113** fronteras de confianza entre instrucciones, documentos recuperados y herramientas: Identificar dependencias directas/transitivas, versiones, licencias y vulnerabilidades pertinentes. (dimensión: dependencias).
- [ ] **AUD-114** fronteras de confianza entre instrucciones, documentos recuperados y herramientas: Validar variables requeridas y defaults; configuración crítica ausente debe fallar cerrada. (dimensión: configuración).
- [ ] **AUD-115** fronteras de confianza entre instrucciones, documentos recuperados y herramientas: Alinear la documentación con el código ejecutado y marcar limitaciones no implementadas. (dimensión: documentación).
- [ ] **AUD-116** fronteras de confianza entre instrucciones, documentos recuperados y herramientas: Registrar versión, commit, algoritmo o modelo que originó el resultado y permitir reproducirlo. (dimensión: versionado).
- [ ] **AUD-117** fronteras de confianza entre instrucciones, documentos recuperados y herramientas: Probar separación entre usuarios, tenants, sesiones y datos restringidos. (dimensión: aislamiento).
- [ ] **AUD-118** fronteras de confianza entre instrucciones, documentos recuperados y herramientas: Verificar que acciones críticas generen un evento de auditoría correlacionable e íntegro. (dimensión: auditoría).
- [ ] **AUD-119** fronteras de confianza entre instrucciones, documentos recuperados y herramientas: Probar recuperación tras reinicio, fallo parcial, desconexión o rollback. (dimensión: recuperación).
- [ ] **AUD-120** fronteras de confianza entre instrucciones, documentos recuperados y herramientas: Impedir promoción a producción si el control crítico está fallido, omitido o no evaluado. (dimensión: gate de release).

## 7. Sanitización documental

- [ ] **AUD-121** transformaciones, cuarentena, metadatos, archivos adjuntos y redacción: Validar contrato, esquema y compatibilidad; añadir pruebas para campos inválidos. (dimensión: contrato).
- [ ] **AUD-122** transformaciones, cuarentena, metadatos, archivos adjuntos y redacción: Exigir evidencia reproducible del comportamiento; documentación sola no cuenta como prueba. (dimensión: evidencia).
- [ ] **AUD-123** transformaciones, cuarentena, metadatos, archivos adjuntos y redacción: Probar configuración ausente, proveedor caído y error interno; evitar declarar éxito. (dimensión: fallo seguro).
- [ ] **AUD-124** transformaciones, cuarentena, metadatos, archivos adjuntos y redacción: Comprobar que la autorización provenga del servidor y que el cliente no pueda elevar privilegios. (dimensión: autorización).
- [ ] **AUD-125** transformaciones, cuarentena, metadatos, archivos adjuntos y redacción: Definir límites de tamaño, tiempo, concurrencia y consumo; probar el límite y el exceso. (dimensión: límites).
- [ ] **AUD-126** transformaciones, cuarentena, metadatos, archivos adjuntos y redacción: Comprobar que tokens, claves y datos personales no aparezcan en logs o respuestas. (dimensión: secretos).
- [ ] **AUD-127** transformaciones, cuarentena, metadatos, archivos adjuntos y redacción: Verificar que referencias y objetos anidados no alteren estado que se considera inmutable. (dimensión: mutabilidad).
- [ ] **AUD-128** transformaciones, cuarentena, metadatos, archivos adjuntos y redacción: Probar reintentos, duplicados y concurrencia sin duplicar efectos secundarios. (dimensión: reintentos).
- [ ] **AUD-129** transformaciones, cuarentena, metadatos, archivos adjuntos y redacción: Registrar estado, correlación y motivo sin filtrar datos sensibles ni confundir simulación con ejecución. (dimensión: observabilidad).
- [ ] **AUD-130** transformaciones, cuarentena, metadatos, archivos adjuntos y redacción: Probar el contrato con el runtime canónico y con el adaptador real, no solo mocks permisivos. (dimensión: integración).
- [ ] **AUD-131** transformaciones, cuarentena, metadatos, archivos adjuntos y redacción: Agregar prueba para entrada maliciosa, permiso denegado o evidencia incompleta. (dimensión: prueba negativa).
- [ ] **AUD-132** transformaciones, cuarentena, metadatos, archivos adjuntos y redacción: Vincular cada defecto confirmado con una prueba que falle antes y pase después de corregirlo. (dimensión: regresión).
- [ ] **AUD-133** transformaciones, cuarentena, metadatos, archivos adjuntos y redacción: Identificar dependencias directas/transitivas, versiones, licencias y vulnerabilidades pertinentes. (dimensión: dependencias).
- [ ] **AUD-134** transformaciones, cuarentena, metadatos, archivos adjuntos y redacción: Validar variables requeridas y defaults; configuración crítica ausente debe fallar cerrada. (dimensión: configuración).
- [ ] **AUD-135** transformaciones, cuarentena, metadatos, archivos adjuntos y redacción: Alinear la documentación con el código ejecutado y marcar limitaciones no implementadas. (dimensión: documentación).
- [ ] **AUD-136** transformaciones, cuarentena, metadatos, archivos adjuntos y redacción: Registrar versión, commit, algoritmo o modelo que originó el resultado y permitir reproducirlo. (dimensión: versionado).
- [ ] **AUD-137** transformaciones, cuarentena, metadatos, archivos adjuntos y redacción: Probar separación entre usuarios, tenants, sesiones y datos restringidos. (dimensión: aislamiento).
- [ ] **AUD-138** transformaciones, cuarentena, metadatos, archivos adjuntos y redacción: Verificar que acciones críticas generen un evento de auditoría correlacionable e íntegro. (dimensión: auditoría).
- [ ] **AUD-139** transformaciones, cuarentena, metadatos, archivos adjuntos y redacción: Probar recuperación tras reinicio, fallo parcial, desconexión o rollback. (dimensión: recuperación).
- [ ] **AUD-140** transformaciones, cuarentena, metadatos, archivos adjuntos y redacción: Impedir promoción a producción si el control crítico está fallido, omitido o no evaluado. (dimensión: gate de release).

## 8. IKES y evidencia

- [ ] **AUD-141** claims, fuentes, evidencia, estados epistemológicos y procedencia: Validar contrato, esquema y compatibilidad; añadir pruebas para campos inválidos. (dimensión: contrato).
- [ ] **AUD-142** claims, fuentes, evidencia, estados epistemológicos y procedencia: Exigir evidencia reproducible del comportamiento; documentación sola no cuenta como prueba. (dimensión: evidencia).
- [ ] **AUD-143** claims, fuentes, evidencia, estados epistemológicos y procedencia: Probar configuración ausente, proveedor caído y error interno; evitar declarar éxito. (dimensión: fallo seguro).
- [ ] **AUD-144** claims, fuentes, evidencia, estados epistemológicos y procedencia: Comprobar que la autorización provenga del servidor y que el cliente no pueda elevar privilegios. (dimensión: autorización).
- [ ] **AUD-145** claims, fuentes, evidencia, estados epistemológicos y procedencia: Definir límites de tamaño, tiempo, concurrencia y consumo; probar el límite y el exceso. (dimensión: límites).
- [ ] **AUD-146** claims, fuentes, evidencia, estados epistemológicos y procedencia: Comprobar que tokens, claves y datos personales no aparezcan en logs o respuestas. (dimensión: secretos).
- [ ] **AUD-147** claims, fuentes, evidencia, estados epistemológicos y procedencia: Verificar que referencias y objetos anidados no alteren estado que se considera inmutable. (dimensión: mutabilidad).
- [ ] **AUD-148** claims, fuentes, evidencia, estados epistemológicos y procedencia: Probar reintentos, duplicados y concurrencia sin duplicar efectos secundarios. (dimensión: reintentos).
- [ ] **AUD-149** claims, fuentes, evidencia, estados epistemológicos y procedencia: Registrar estado, correlación y motivo sin filtrar datos sensibles ni confundir simulación con ejecución. (dimensión: observabilidad).
- [ ] **AUD-150** claims, fuentes, evidencia, estados epistemológicos y procedencia: Probar el contrato con el runtime canónico y con el adaptador real, no solo mocks permisivos. (dimensión: integración).
- [ ] **AUD-151** claims, fuentes, evidencia, estados epistemológicos y procedencia: Agregar prueba para entrada maliciosa, permiso denegado o evidencia incompleta. (dimensión: prueba negativa).
- [ ] **AUD-152** claims, fuentes, evidencia, estados epistemológicos y procedencia: Vincular cada defecto confirmado con una prueba que falle antes y pase después de corregirlo. (dimensión: regresión).
- [ ] **AUD-153** claims, fuentes, evidencia, estados epistemológicos y procedencia: Identificar dependencias directas/transitivas, versiones, licencias y vulnerabilidades pertinentes. (dimensión: dependencias).
- [ ] **AUD-154** claims, fuentes, evidencia, estados epistemológicos y procedencia: Validar variables requeridas y defaults; configuración crítica ausente debe fallar cerrada. (dimensión: configuración).
- [ ] **AUD-155** claims, fuentes, evidencia, estados epistemológicos y procedencia: Alinear la documentación con el código ejecutado y marcar limitaciones no implementadas. (dimensión: documentación).
- [ ] **AUD-156** claims, fuentes, evidencia, estados epistemológicos y procedencia: Registrar versión, commit, algoritmo o modelo que originó el resultado y permitir reproducirlo. (dimensión: versionado).
- [ ] **AUD-157** claims, fuentes, evidencia, estados epistemológicos y procedencia: Probar separación entre usuarios, tenants, sesiones y datos restringidos. (dimensión: aislamiento).
- [ ] **AUD-158** claims, fuentes, evidencia, estados epistemológicos y procedencia: Verificar que acciones críticas generen un evento de auditoría correlacionable e íntegro. (dimensión: auditoría).
- [ ] **AUD-159** claims, fuentes, evidencia, estados epistemológicos y procedencia: Probar recuperación tras reinicio, fallo parcial, desconexión o rollback. (dimensión: recuperación).
- [ ] **AUD-160** claims, fuentes, evidencia, estados epistemológicos y procedencia: Impedir promoción a producción si el control crítico está fallido, omitido o no evaluado. (dimensión: gate de release).

## 9. Criptografía e integridad

- [ ] **AUD-161** hashes, firmas, claves, certificados, Merkle y estados de verificación: Validar contrato, esquema y compatibilidad; añadir pruebas para campos inválidos. (dimensión: contrato).
- [ ] **AUD-162** hashes, firmas, claves, certificados, Merkle y estados de verificación: Exigir evidencia reproducible del comportamiento; documentación sola no cuenta como prueba. (dimensión: evidencia).
- [ ] **AUD-163** hashes, firmas, claves, certificados, Merkle y estados de verificación: Probar configuración ausente, proveedor caído y error interno; evitar declarar éxito. (dimensión: fallo seguro).
- [ ] **AUD-164** hashes, firmas, claves, certificados, Merkle y estados de verificación: Comprobar que la autorización provenga del servidor y que el cliente no pueda elevar privilegios. (dimensión: autorización).
- [ ] **AUD-165** hashes, firmas, claves, certificados, Merkle y estados de verificación: Definir límites de tamaño, tiempo, concurrencia y consumo; probar el límite y el exceso. (dimensión: límites).
- [ ] **AUD-166** hashes, firmas, claves, certificados, Merkle y estados de verificación: Comprobar que tokens, claves y datos personales no aparezcan en logs o respuestas. (dimensión: secretos).
- [ ] **AUD-167** hashes, firmas, claves, certificados, Merkle y estados de verificación: Verificar que referencias y objetos anidados no alteren estado que se considera inmutable. (dimensión: mutabilidad).
- [ ] **AUD-168** hashes, firmas, claves, certificados, Merkle y estados de verificación: Probar reintentos, duplicados y concurrencia sin duplicar efectos secundarios. (dimensión: reintentos).
- [ ] **AUD-169** hashes, firmas, claves, certificados, Merkle y estados de verificación: Registrar estado, correlación y motivo sin filtrar datos sensibles ni confundir simulación con ejecución. (dimensión: observabilidad).
- [ ] **AUD-170** hashes, firmas, claves, certificados, Merkle y estados de verificación: Probar el contrato con el runtime canónico y con el adaptador real, no solo mocks permisivos. (dimensión: integración).
- [ ] **AUD-171** hashes, firmas, claves, certificados, Merkle y estados de verificación: Agregar prueba para entrada maliciosa, permiso denegado o evidencia incompleta. (dimensión: prueba negativa).
- [ ] **AUD-172** hashes, firmas, claves, certificados, Merkle y estados de verificación: Vincular cada defecto confirmado con una prueba que falle antes y pase después de corregirlo. (dimensión: regresión).
- [ ] **AUD-173** hashes, firmas, claves, certificados, Merkle y estados de verificación: Identificar dependencias directas/transitivas, versiones, licencias y vulnerabilidades pertinentes. (dimensión: dependencias).
- [ ] **AUD-174** hashes, firmas, claves, certificados, Merkle y estados de verificación: Validar variables requeridas y defaults; configuración crítica ausente debe fallar cerrada. (dimensión: configuración).
- [ ] **AUD-175** hashes, firmas, claves, certificados, Merkle y estados de verificación: Alinear la documentación con el código ejecutado y marcar limitaciones no implementadas. (dimensión: documentación).
- [ ] **AUD-176** hashes, firmas, claves, certificados, Merkle y estados de verificación: Registrar versión, commit, algoritmo o modelo que originó el resultado y permitir reproducirlo. (dimensión: versionado).
- [ ] **AUD-177** hashes, firmas, claves, certificados, Merkle y estados de verificación: Probar separación entre usuarios, tenants, sesiones y datos restringidos. (dimensión: aislamiento).
- [ ] **AUD-178** hashes, firmas, claves, certificados, Merkle y estados de verificación: Verificar que acciones críticas generen un evento de auditoría correlacionable e íntegro. (dimensión: auditoría).
- [ ] **AUD-179** hashes, firmas, claves, certificados, Merkle y estados de verificación: Probar recuperación tras reinicio, fallo parcial, desconexión o rollback. (dimensión: recuperación).
- [ ] **AUD-180** hashes, firmas, claves, certificados, Merkle y estados de verificación: Impedir promoción a producción si el control crítico está fallido, omitido o no evaluado. (dimensión: gate de release).

## 10. Persistencia y BookPI

- [ ] **AUD-181** transacciones, ledger, consistencia, retención y recuperación: Validar contrato, esquema y compatibilidad; añadir pruebas para campos inválidos. (dimensión: contrato).
- [ ] **AUD-182** transacciones, ledger, consistencia, retención y recuperación: Exigir evidencia reproducible del comportamiento; documentación sola no cuenta como prueba. (dimensión: evidencia).
- [ ] **AUD-183** transacciones, ledger, consistencia, retención y recuperación: Probar configuración ausente, proveedor caído y error interno; evitar declarar éxito. (dimensión: fallo seguro).
- [ ] **AUD-184** transacciones, ledger, consistencia, retención y recuperación: Comprobar que la autorización provenga del servidor y que el cliente no pueda elevar privilegios. (dimensión: autorización).
- [ ] **AUD-185** transacciones, ledger, consistencia, retención y recuperación: Definir límites de tamaño, tiempo, concurrencia y consumo; probar el límite y el exceso. (dimensión: límites).
- [ ] **AUD-186** transacciones, ledger, consistencia, retención y recuperación: Comprobar que tokens, claves y datos personales no aparezcan en logs o respuestas. (dimensión: secretos).
- [ ] **AUD-187** transacciones, ledger, consistencia, retención y recuperación: Verificar que referencias y objetos anidados no alteren estado que se considera inmutable. (dimensión: mutabilidad).
- [ ] **AUD-188** transacciones, ledger, consistencia, retención y recuperación: Probar reintentos, duplicados y concurrencia sin duplicar efectos secundarios. (dimensión: reintentos).
- [ ] **AUD-189** transacciones, ledger, consistencia, retención y recuperación: Registrar estado, correlación y motivo sin filtrar datos sensibles ni confundir simulación con ejecución. (dimensión: observabilidad).
- [ ] **AUD-190** transacciones, ledger, consistencia, retención y recuperación: Probar el contrato con el runtime canónico y con el adaptador real, no solo mocks permisivos. (dimensión: integración).
- [ ] **AUD-191** transacciones, ledger, consistencia, retención y recuperación: Agregar prueba para entrada maliciosa, permiso denegado o evidencia incompleta. (dimensión: prueba negativa).
- [ ] **AUD-192** transacciones, ledger, consistencia, retención y recuperación: Vincular cada defecto confirmado con una prueba que falle antes y pase después de corregirlo. (dimensión: regresión).
- [ ] **AUD-193** transacciones, ledger, consistencia, retención y recuperación: Identificar dependencias directas/transitivas, versiones, licencias y vulnerabilidades pertinentes. (dimensión: dependencias).
- [ ] **AUD-194** transacciones, ledger, consistencia, retención y recuperación: Validar variables requeridas y defaults; configuración crítica ausente debe fallar cerrada. (dimensión: configuración).
- [ ] **AUD-195** transacciones, ledger, consistencia, retención y recuperación: Alinear la documentación con el código ejecutado y marcar limitaciones no implementadas. (dimensión: documentación).
- [ ] **AUD-196** transacciones, ledger, consistencia, retención y recuperación: Registrar versión, commit, algoritmo o modelo que originó el resultado y permitir reproducirlo. (dimensión: versionado).
- [ ] **AUD-197** transacciones, ledger, consistencia, retención y recuperación: Probar separación entre usuarios, tenants, sesiones y datos restringidos. (dimensión: aislamiento).
- [ ] **AUD-198** transacciones, ledger, consistencia, retención y recuperación: Verificar que acciones críticas generen un evento de auditoría correlacionable e íntegro. (dimensión: auditoría).
- [ ] **AUD-199** transacciones, ledger, consistencia, retención y recuperación: Probar recuperación tras reinicio, fallo parcial, desconexión o rollback. (dimensión: recuperación).
- [ ] **AUD-200** transacciones, ledger, consistencia, retención y recuperación: Impedir promoción a producción si el control crítico está fallido, omitido o no evaluado. (dimensión: gate de release).

## 11. Concurrencia e idempotencia

- [ ] **AUD-201** reintentos, eventos duplicados, carreras, locks y cancelación: Validar contrato, esquema y compatibilidad; añadir pruebas para campos inválidos. (dimensión: contrato).
- [ ] **AUD-202** reintentos, eventos duplicados, carreras, locks y cancelación: Exigir evidencia reproducible del comportamiento; documentación sola no cuenta como prueba. (dimensión: evidencia).
- [ ] **AUD-203** reintentos, eventos duplicados, carreras, locks y cancelación: Probar configuración ausente, proveedor caído y error interno; evitar declarar éxito. (dimensión: fallo seguro).
- [ ] **AUD-204** reintentos, eventos duplicados, carreras, locks y cancelación: Comprobar que la autorización provenga del servidor y que el cliente no pueda elevar privilegios. (dimensión: autorización).
- [ ] **AUD-205** reintentos, eventos duplicados, carreras, locks y cancelación: Definir límites de tamaño, tiempo, concurrencia y consumo; probar el límite y el exceso. (dimensión: límites).
- [ ] **AUD-206** reintentos, eventos duplicados, carreras, locks y cancelación: Comprobar que tokens, claves y datos personales no aparezcan en logs o respuestas. (dimensión: secretos).
- [ ] **AUD-207** reintentos, eventos duplicados, carreras, locks y cancelación: Verificar que referencias y objetos anidados no alteren estado que se considera inmutable. (dimensión: mutabilidad).
- [ ] **AUD-208** reintentos, eventos duplicados, carreras, locks y cancelación: Probar reintentos, duplicados y concurrencia sin duplicar efectos secundarios. (dimensión: reintentos).
- [ ] **AUD-209** reintentos, eventos duplicados, carreras, locks y cancelación: Registrar estado, correlación y motivo sin filtrar datos sensibles ni confundir simulación con ejecución. (dimensión: observabilidad).
- [ ] **AUD-210** reintentos, eventos duplicados, carreras, locks y cancelación: Probar el contrato con el runtime canónico y con el adaptador real, no solo mocks permisivos. (dimensión: integración).
- [ ] **AUD-211** reintentos, eventos duplicados, carreras, locks y cancelación: Agregar prueba para entrada maliciosa, permiso denegado o evidencia incompleta. (dimensión: prueba negativa).
- [ ] **AUD-212** reintentos, eventos duplicados, carreras, locks y cancelación: Vincular cada defecto confirmado con una prueba que falle antes y pase después de corregirlo. (dimensión: regresión).
- [ ] **AUD-213** reintentos, eventos duplicados, carreras, locks y cancelación: Identificar dependencias directas/transitivas, versiones, licencias y vulnerabilidades pertinentes. (dimensión: dependencias).
- [ ] **AUD-214** reintentos, eventos duplicados, carreras, locks y cancelación: Validar variables requeridas y defaults; configuración crítica ausente debe fallar cerrada. (dimensión: configuración).
- [ ] **AUD-215** reintentos, eventos duplicados, carreras, locks y cancelación: Alinear la documentación con el código ejecutado y marcar limitaciones no implementadas. (dimensión: documentación).
- [ ] **AUD-216** reintentos, eventos duplicados, carreras, locks y cancelación: Registrar versión, commit, algoritmo o modelo que originó el resultado y permitir reproducirlo. (dimensión: versionado).
- [ ] **AUD-217** reintentos, eventos duplicados, carreras, locks y cancelación: Probar separación entre usuarios, tenants, sesiones y datos restringidos. (dimensión: aislamiento).
- [ ] **AUD-218** reintentos, eventos duplicados, carreras, locks y cancelación: Verificar que acciones críticas generen un evento de auditoría correlacionable e íntegro. (dimensión: auditoría).
- [ ] **AUD-219** reintentos, eventos duplicados, carreras, locks y cancelación: Probar recuperación tras reinicio, fallo parcial, desconexión o rollback. (dimensión: recuperación).
- [ ] **AUD-220** reintentos, eventos duplicados, carreras, locks y cancelación: Impedir promoción a producción si el control crítico está fallido, omitido o no evaluado. (dimensión: gate de release).

## 12. Modelos y machine learning

- [ ] **AUD-221** proveedores, inferencia, evaluación, sesgos, límites y afirmaciones sobre ML: Validar contrato, esquema y compatibilidad; añadir pruebas para campos inválidos. (dimensión: contrato).
- [ ] **AUD-222** proveedores, inferencia, evaluación, sesgos, límites y afirmaciones sobre ML: Exigir evidencia reproducible del comportamiento; documentación sola no cuenta como prueba. (dimensión: evidencia).
- [ ] **AUD-223** proveedores, inferencia, evaluación, sesgos, límites y afirmaciones sobre ML: Probar configuración ausente, proveedor caído y error interno; evitar declarar éxito. (dimensión: fallo seguro).
- [ ] **AUD-224** proveedores, inferencia, evaluación, sesgos, límites y afirmaciones sobre ML: Comprobar que la autorización provenga del servidor y que el cliente no pueda elevar privilegios. (dimensión: autorización).
- [ ] **AUD-225** proveedores, inferencia, evaluación, sesgos, límites y afirmaciones sobre ML: Definir límites de tamaño, tiempo, concurrencia y consumo; probar el límite y el exceso. (dimensión: límites).
- [ ] **AUD-226** proveedores, inferencia, evaluación, sesgos, límites y afirmaciones sobre ML: Comprobar que tokens, claves y datos personales no aparezcan en logs o respuestas. (dimensión: secretos).
- [ ] **AUD-227** proveedores, inferencia, evaluación, sesgos, límites y afirmaciones sobre ML: Verificar que referencias y objetos anidados no alteren estado que se considera inmutable. (dimensión: mutabilidad).
- [ ] **AUD-228** proveedores, inferencia, evaluación, sesgos, límites y afirmaciones sobre ML: Probar reintentos, duplicados y concurrencia sin duplicar efectos secundarios. (dimensión: reintentos).
- [ ] **AUD-229** proveedores, inferencia, evaluación, sesgos, límites y afirmaciones sobre ML: Registrar estado, correlación y motivo sin filtrar datos sensibles ni confundir simulación con ejecución. (dimensión: observabilidad).
- [ ] **AUD-230** proveedores, inferencia, evaluación, sesgos, límites y afirmaciones sobre ML: Probar el contrato con el runtime canónico y con el adaptador real, no solo mocks permisivos. (dimensión: integración).
- [ ] **AUD-231** proveedores, inferencia, evaluación, sesgos, límites y afirmaciones sobre ML: Agregar prueba para entrada maliciosa, permiso denegado o evidencia incompleta. (dimensión: prueba negativa).
- [ ] **AUD-232** proveedores, inferencia, evaluación, sesgos, límites y afirmaciones sobre ML: Vincular cada defecto confirmado con una prueba que falle antes y pase después de corregirlo. (dimensión: regresión).
- [ ] **AUD-233** proveedores, inferencia, evaluación, sesgos, límites y afirmaciones sobre ML: Identificar dependencias directas/transitivas, versiones, licencias y vulnerabilidades pertinentes. (dimensión: dependencias).
- [ ] **AUD-234** proveedores, inferencia, evaluación, sesgos, límites y afirmaciones sobre ML: Validar variables requeridas y defaults; configuración crítica ausente debe fallar cerrada. (dimensión: configuración).
- [ ] **AUD-235** proveedores, inferencia, evaluación, sesgos, límites y afirmaciones sobre ML: Alinear la documentación con el código ejecutado y marcar limitaciones no implementadas. (dimensión: documentación).
- [ ] **AUD-236** proveedores, inferencia, evaluación, sesgos, límites y afirmaciones sobre ML: Registrar versión, commit, algoritmo o modelo que originó el resultado y permitir reproducirlo. (dimensión: versionado).
- [ ] **AUD-237** proveedores, inferencia, evaluación, sesgos, límites y afirmaciones sobre ML: Probar separación entre usuarios, tenants, sesiones y datos restringidos. (dimensión: aislamiento).
- [ ] **AUD-238** proveedores, inferencia, evaluación, sesgos, límites y afirmaciones sobre ML: Verificar que acciones críticas generen un evento de auditoría correlacionable e íntegro. (dimensión: auditoría).
- [ ] **AUD-239** proveedores, inferencia, evaluación, sesgos, límites y afirmaciones sobre ML: Probar recuperación tras reinicio, fallo parcial, desconexión o rollback. (dimensión: recuperación).
- [ ] **AUD-240** proveedores, inferencia, evaluación, sesgos, límites y afirmaciones sobre ML: Impedir promoción a producción si el control crítico está fallido, omitido o no evaluado. (dimensión: gate de release).

## 13. Skills y herramientas

- [ ] **AUD-241** registro, permisos, esquemas, ejecución y efectos secundarios: Validar contrato, esquema y compatibilidad; añadir pruebas para campos inválidos. (dimensión: contrato).
- [ ] **AUD-242** registro, permisos, esquemas, ejecución y efectos secundarios: Exigir evidencia reproducible del comportamiento; documentación sola no cuenta como prueba. (dimensión: evidencia).
- [ ] **AUD-243** registro, permisos, esquemas, ejecución y efectos secundarios: Probar configuración ausente, proveedor caído y error interno; evitar declarar éxito. (dimensión: fallo seguro).
- [ ] **AUD-244** registro, permisos, esquemas, ejecución y efectos secundarios: Comprobar que la autorización provenga del servidor y que el cliente no pueda elevar privilegios. (dimensión: autorización).
- [ ] **AUD-245** registro, permisos, esquemas, ejecución y efectos secundarios: Definir límites de tamaño, tiempo, concurrencia y consumo; probar el límite y el exceso. (dimensión: límites).
- [ ] **AUD-246** registro, permisos, esquemas, ejecución y efectos secundarios: Comprobar que tokens, claves y datos personales no aparezcan en logs o respuestas. (dimensión: secretos).
- [ ] **AUD-247** registro, permisos, esquemas, ejecución y efectos secundarios: Verificar que referencias y objetos anidados no alteren estado que se considera inmutable. (dimensión: mutabilidad).
- [ ] **AUD-248** registro, permisos, esquemas, ejecución y efectos secundarios: Probar reintentos, duplicados y concurrencia sin duplicar efectos secundarios. (dimensión: reintentos).
- [ ] **AUD-249** registro, permisos, esquemas, ejecución y efectos secundarios: Registrar estado, correlación y motivo sin filtrar datos sensibles ni confundir simulación con ejecución. (dimensión: observabilidad).
- [ ] **AUD-250** registro, permisos, esquemas, ejecución y efectos secundarios: Probar el contrato con el runtime canónico y con el adaptador real, no solo mocks permisivos. (dimensión: integración).
- [ ] **AUD-251** registro, permisos, esquemas, ejecución y efectos secundarios: Agregar prueba para entrada maliciosa, permiso denegado o evidencia incompleta. (dimensión: prueba negativa).
- [ ] **AUD-252** registro, permisos, esquemas, ejecución y efectos secundarios: Vincular cada defecto confirmado con una prueba que falle antes y pase después de corregirlo. (dimensión: regresión).
- [ ] **AUD-253** registro, permisos, esquemas, ejecución y efectos secundarios: Identificar dependencias directas/transitivas, versiones, licencias y vulnerabilidades pertinentes. (dimensión: dependencias).
- [ ] **AUD-254** registro, permisos, esquemas, ejecución y efectos secundarios: Validar variables requeridas y defaults; configuración crítica ausente debe fallar cerrada. (dimensión: configuración).
- [ ] **AUD-255** registro, permisos, esquemas, ejecución y efectos secundarios: Alinear la documentación con el código ejecutado y marcar limitaciones no implementadas. (dimensión: documentación).
- [ ] **AUD-256** registro, permisos, esquemas, ejecución y efectos secundarios: Registrar versión, commit, algoritmo o modelo que originó el resultado y permitir reproducirlo. (dimensión: versionado).
- [ ] **AUD-257** registro, permisos, esquemas, ejecución y efectos secundarios: Probar separación entre usuarios, tenants, sesiones y datos restringidos. (dimensión: aislamiento).
- [ ] **AUD-258** registro, permisos, esquemas, ejecución y efectos secundarios: Verificar que acciones críticas generen un evento de auditoría correlacionable e íntegro. (dimensión: auditoría).
- [ ] **AUD-259** registro, permisos, esquemas, ejecución y efectos secundarios: Probar recuperación tras reinicio, fallo parcial, desconexión o rollback. (dimensión: recuperación).
- [ ] **AUD-260** registro, permisos, esquemas, ejecución y efectos secundarios: Impedir promoción a producción si el control crítico está fallido, omitido o no evaluado. (dimensión: gate de release).

## 14. CROWN, AEGIS y gobernanza

- [ ] **AUD-261** políticas, decisiones, excepciones, aprobación humana y gates: Validar contrato, esquema y compatibilidad; añadir pruebas para campos inválidos. (dimensión: contrato).
- [ ] **AUD-262** políticas, decisiones, excepciones, aprobación humana y gates: Exigir evidencia reproducible del comportamiento; documentación sola no cuenta como prueba. (dimensión: evidencia).
- [ ] **AUD-263** políticas, decisiones, excepciones, aprobación humana y gates: Probar configuración ausente, proveedor caído y error interno; evitar declarar éxito. (dimensión: fallo seguro).
- [ ] **AUD-264** políticas, decisiones, excepciones, aprobación humana y gates: Comprobar que la autorización provenga del servidor y que el cliente no pueda elevar privilegios. (dimensión: autorización).
- [ ] **AUD-265** políticas, decisiones, excepciones, aprobación humana y gates: Definir límites de tamaño, tiempo, concurrencia y consumo; probar el límite y el exceso. (dimensión: límites).
- [ ] **AUD-266** políticas, decisiones, excepciones, aprobación humana y gates: Comprobar que tokens, claves y datos personales no aparezcan en logs o respuestas. (dimensión: secretos).
- [ ] **AUD-267** políticas, decisiones, excepciones, aprobación humana y gates: Verificar que referencias y objetos anidados no alteren estado que se considera inmutable. (dimensión: mutabilidad).
- [ ] **AUD-268** políticas, decisiones, excepciones, aprobación humana y gates: Probar reintentos, duplicados y concurrencia sin duplicar efectos secundarios. (dimensión: reintentos).
- [ ] **AUD-269** políticas, decisiones, excepciones, aprobación humana y gates: Registrar estado, correlación y motivo sin filtrar datos sensibles ni confundir simulación con ejecución. (dimensión: observabilidad).
- [ ] **AUD-270** políticas, decisiones, excepciones, aprobación humana y gates: Probar el contrato con el runtime canónico y con el adaptador real, no solo mocks permisivos. (dimensión: integración).
- [ ] **AUD-271** políticas, decisiones, excepciones, aprobación humana y gates: Agregar prueba para entrada maliciosa, permiso denegado o evidencia incompleta. (dimensión: prueba negativa).
- [ ] **AUD-272** políticas, decisiones, excepciones, aprobación humana y gates: Vincular cada defecto confirmado con una prueba que falle antes y pase después de corregirlo. (dimensión: regresión).
- [ ] **AUD-273** políticas, decisiones, excepciones, aprobación humana y gates: Identificar dependencias directas/transitivas, versiones, licencias y vulnerabilidades pertinentes. (dimensión: dependencias).
- [ ] **AUD-274** políticas, decisiones, excepciones, aprobación humana y gates: Validar variables requeridas y defaults; configuración crítica ausente debe fallar cerrada. (dimensión: configuración).
- [ ] **AUD-275** políticas, decisiones, excepciones, aprobación humana y gates: Alinear la documentación con el código ejecutado y marcar limitaciones no implementadas. (dimensión: documentación).
- [ ] **AUD-276** políticas, decisiones, excepciones, aprobación humana y gates: Registrar versión, commit, algoritmo o modelo que originó el resultado y permitir reproducirlo. (dimensión: versionado).
- [ ] **AUD-277** políticas, decisiones, excepciones, aprobación humana y gates: Probar separación entre usuarios, tenants, sesiones y datos restringidos. (dimensión: aislamiento).
- [ ] **AUD-278** políticas, decisiones, excepciones, aprobación humana y gates: Verificar que acciones críticas generen un evento de auditoría correlacionable e íntegro. (dimensión: auditoría).
- [ ] **AUD-279** políticas, decisiones, excepciones, aprobación humana y gates: Probar recuperación tras reinicio, fallo parcial, desconexión o rollback. (dimensión: recuperación).
- [ ] **AUD-280** políticas, decisiones, excepciones, aprobación humana y gates: Impedir promoción a producción si el control crítico está fallido, omitido o no evaluado. (dimensión: gate de release).

## 15. Pruebas y CI

- [ ] **AUD-281** typecheck, tests, lint, cobertura, jobs, artefactos y estado del SHA: Validar contrato, esquema y compatibilidad; añadir pruebas para campos inválidos. (dimensión: contrato).
- [ ] **AUD-282** typecheck, tests, lint, cobertura, jobs, artefactos y estado del SHA: Exigir evidencia reproducible del comportamiento; documentación sola no cuenta como prueba. (dimensión: evidencia).
- [ ] **AUD-283** typecheck, tests, lint, cobertura, jobs, artefactos y estado del SHA: Probar configuración ausente, proveedor caído y error interno; evitar declarar éxito. (dimensión: fallo seguro).
- [ ] **AUD-284** typecheck, tests, lint, cobertura, jobs, artefactos y estado del SHA: Comprobar que la autorización provenga del servidor y que el cliente no pueda elevar privilegios. (dimensión: autorización).
- [ ] **AUD-285** typecheck, tests, lint, cobertura, jobs, artefactos y estado del SHA: Definir límites de tamaño, tiempo, concurrencia y consumo; probar el límite y el exceso. (dimensión: límites).
- [ ] **AUD-286** typecheck, tests, lint, cobertura, jobs, artefactos y estado del SHA: Comprobar que tokens, claves y datos personales no aparezcan en logs o respuestas. (dimensión: secretos).
- [ ] **AUD-287** typecheck, tests, lint, cobertura, jobs, artefactos y estado del SHA: Verificar que referencias y objetos anidados no alteren estado que se considera inmutable. (dimensión: mutabilidad).
- [ ] **AUD-288** typecheck, tests, lint, cobertura, jobs, artefactos y estado del SHA: Probar reintentos, duplicados y concurrencia sin duplicar efectos secundarios. (dimensión: reintentos).
- [ ] **AUD-289** typecheck, tests, lint, cobertura, jobs, artefactos y estado del SHA: Registrar estado, correlación y motivo sin filtrar datos sensibles ni confundir simulación con ejecución. (dimensión: observabilidad).
- [ ] **AUD-290** typecheck, tests, lint, cobertura, jobs, artefactos y estado del SHA: Probar el contrato con el runtime canónico y con el adaptador real, no solo mocks permisivos. (dimensión: integración).
- [ ] **AUD-291** typecheck, tests, lint, cobertura, jobs, artefactos y estado del SHA: Agregar prueba para entrada maliciosa, permiso denegado o evidencia incompleta. (dimensión: prueba negativa).
- [ ] **AUD-292** typecheck, tests, lint, cobertura, jobs, artefactos y estado del SHA: Vincular cada defecto confirmado con una prueba que falle antes y pase después de corregirlo. (dimensión: regresión).
- [ ] **AUD-293** typecheck, tests, lint, cobertura, jobs, artefactos y estado del SHA: Identificar dependencias directas/transitivas, versiones, licencias y vulnerabilidades pertinentes. (dimensión: dependencias).
- [ ] **AUD-294** typecheck, tests, lint, cobertura, jobs, artefactos y estado del SHA: Validar variables requeridas y defaults; configuración crítica ausente debe fallar cerrada. (dimensión: configuración).
- [ ] **AUD-295** typecheck, tests, lint, cobertura, jobs, artefactos y estado del SHA: Alinear la documentación con el código ejecutado y marcar limitaciones no implementadas. (dimensión: documentación).
- [ ] **AUD-296** typecheck, tests, lint, cobertura, jobs, artefactos y estado del SHA: Registrar versión, commit, algoritmo o modelo que originó el resultado y permitir reproducirlo. (dimensión: versionado).
- [ ] **AUD-297** typecheck, tests, lint, cobertura, jobs, artefactos y estado del SHA: Probar separación entre usuarios, tenants, sesiones y datos restringidos. (dimensión: aislamiento).
- [ ] **AUD-298** typecheck, tests, lint, cobertura, jobs, artefactos y estado del SHA: Verificar que acciones críticas generen un evento de auditoría correlacionable e íntegro. (dimensión: auditoría).
- [ ] **AUD-299** typecheck, tests, lint, cobertura, jobs, artefactos y estado del SHA: Probar recuperación tras reinicio, fallo parcial, desconexión o rollback. (dimensión: recuperación).
- [ ] **AUD-300** typecheck, tests, lint, cobertura, jobs, artefactos y estado del SHA: Impedir promoción a producción si el control crítico está fallido, omitido o no evaluado. (dimensión: gate de release).

## 16. Dependencias y supply chain

- [ ] **AUD-301** lockfiles, CVEs, licencias, SBOM, acciones CI y procedencia: Validar contrato, esquema y compatibilidad; añadir pruebas para campos inválidos. (dimensión: contrato).
- [ ] **AUD-302** lockfiles, CVEs, licencias, SBOM, acciones CI y procedencia: Exigir evidencia reproducible del comportamiento; documentación sola no cuenta como prueba. (dimensión: evidencia).
- [ ] **AUD-303** lockfiles, CVEs, licencias, SBOM, acciones CI y procedencia: Probar configuración ausente, proveedor caído y error interno; evitar declarar éxito. (dimensión: fallo seguro).
- [ ] **AUD-304** lockfiles, CVEs, licencias, SBOM, acciones CI y procedencia: Comprobar que la autorización provenga del servidor y que el cliente no pueda elevar privilegios. (dimensión: autorización).
- [ ] **AUD-305** lockfiles, CVEs, licencias, SBOM, acciones CI y procedencia: Definir límites de tamaño, tiempo, concurrencia y consumo; probar el límite y el exceso. (dimensión: límites).
- [ ] **AUD-306** lockfiles, CVEs, licencias, SBOM, acciones CI y procedencia: Comprobar que tokens, claves y datos personales no aparezcan en logs o respuestas. (dimensión: secretos).
- [ ] **AUD-307** lockfiles, CVEs, licencias, SBOM, acciones CI y procedencia: Verificar que referencias y objetos anidados no alteren estado que se considera inmutable. (dimensión: mutabilidad).
- [ ] **AUD-308** lockfiles, CVEs, licencias, SBOM, acciones CI y procedencia: Probar reintentos, duplicados y concurrencia sin duplicar efectos secundarios. (dimensión: reintentos).
- [ ] **AUD-309** lockfiles, CVEs, licencias, SBOM, acciones CI y procedencia: Registrar estado, correlación y motivo sin filtrar datos sensibles ni confundir simulación con ejecución. (dimensión: observabilidad).
- [ ] **AUD-310** lockfiles, CVEs, licencias, SBOM, acciones CI y procedencia: Probar el contrato con el runtime canónico y con el adaptador real, no solo mocks permisivos. (dimensión: integración).
- [ ] **AUD-311** lockfiles, CVEs, licencias, SBOM, acciones CI y procedencia: Agregar prueba para entrada maliciosa, permiso denegado o evidencia incompleta. (dimensión: prueba negativa).
- [ ] **AUD-312** lockfiles, CVEs, licencias, SBOM, acciones CI y procedencia: Vincular cada defecto confirmado con una prueba que falle antes y pase después de corregirlo. (dimensión: regresión).
- [ ] **AUD-313** lockfiles, CVEs, licencias, SBOM, acciones CI y procedencia: Identificar dependencias directas/transitivas, versiones, licencias y vulnerabilidades pertinentes. (dimensión: dependencias).
- [ ] **AUD-314** lockfiles, CVEs, licencias, SBOM, acciones CI y procedencia: Validar variables requeridas y defaults; configuración crítica ausente debe fallar cerrada. (dimensión: configuración).
- [ ] **AUD-315** lockfiles, CVEs, licencias, SBOM, acciones CI y procedencia: Alinear la documentación con el código ejecutado y marcar limitaciones no implementadas. (dimensión: documentación).
- [ ] **AUD-316** lockfiles, CVEs, licencias, SBOM, acciones CI y procedencia: Registrar versión, commit, algoritmo o modelo que originó el resultado y permitir reproducirlo. (dimensión: versionado).
- [ ] **AUD-317** lockfiles, CVEs, licencias, SBOM, acciones CI y procedencia: Probar separación entre usuarios, tenants, sesiones y datos restringidos. (dimensión: aislamiento).
- [ ] **AUD-318** lockfiles, CVEs, licencias, SBOM, acciones CI y procedencia: Verificar que acciones críticas generen un evento de auditoría correlacionable e íntegro. (dimensión: auditoría).
- [ ] **AUD-319** lockfiles, CVEs, licencias, SBOM, acciones CI y procedencia: Probar recuperación tras reinicio, fallo parcial, desconexión o rollback. (dimensión: recuperación).
- [ ] **AUD-320** lockfiles, CVEs, licencias, SBOM, acciones CI y procedencia: Impedir promoción a producción si el control crítico está fallido, omitido o no evaluado. (dimensión: gate de release).

## 17. Despliegue y configuración

- [ ] **AUD-321** variables de entorno, contenedores, readiness, rollback y secretos: Validar contrato, esquema y compatibilidad; añadir pruebas para campos inválidos. (dimensión: contrato).
- [ ] **AUD-322** variables de entorno, contenedores, readiness, rollback y secretos: Exigir evidencia reproducible del comportamiento; documentación sola no cuenta como prueba. (dimensión: evidencia).
- [ ] **AUD-323** variables de entorno, contenedores, readiness, rollback y secretos: Probar configuración ausente, proveedor caído y error interno; evitar declarar éxito. (dimensión: fallo seguro).
- [ ] **AUD-324** variables de entorno, contenedores, readiness, rollback y secretos: Comprobar que la autorización provenga del servidor y que el cliente no pueda elevar privilegios. (dimensión: autorización).
- [ ] **AUD-325** variables de entorno, contenedores, readiness, rollback y secretos: Definir límites de tamaño, tiempo, concurrencia y consumo; probar el límite y el exceso. (dimensión: límites).
- [ ] **AUD-326** variables de entorno, contenedores, readiness, rollback y secretos: Comprobar que tokens, claves y datos personales no aparezcan en logs o respuestas. (dimensión: secretos).
- [ ] **AUD-327** variables de entorno, contenedores, readiness, rollback y secretos: Verificar que referencias y objetos anidados no alteren estado que se considera inmutable. (dimensión: mutabilidad).
- [ ] **AUD-328** variables de entorno, contenedores, readiness, rollback y secretos: Probar reintentos, duplicados y concurrencia sin duplicar efectos secundarios. (dimensión: reintentos).
- [ ] **AUD-329** variables de entorno, contenedores, readiness, rollback y secretos: Registrar estado, correlación y motivo sin filtrar datos sensibles ni confundir simulación con ejecución. (dimensión: observabilidad).
- [ ] **AUD-330** variables de entorno, contenedores, readiness, rollback y secretos: Probar el contrato con el runtime canónico y con el adaptador real, no solo mocks permisivos. (dimensión: integración).
- [ ] **AUD-331** variables de entorno, contenedores, readiness, rollback y secretos: Agregar prueba para entrada maliciosa, permiso denegado o evidencia incompleta. (dimensión: prueba negativa).
- [ ] **AUD-332** variables de entorno, contenedores, readiness, rollback y secretos: Vincular cada defecto confirmado con una prueba que falle antes y pase después de corregirlo. (dimensión: regresión).
- [ ] **AUD-333** variables de entorno, contenedores, readiness, rollback y secretos: Identificar dependencias directas/transitivas, versiones, licencias y vulnerabilidades pertinentes. (dimensión: dependencias).
- [ ] **AUD-334** variables de entorno, contenedores, readiness, rollback y secretos: Validar variables requeridas y defaults; configuración crítica ausente debe fallar cerrada. (dimensión: configuración).
- [ ] **AUD-335** variables de entorno, contenedores, readiness, rollback y secretos: Alinear la documentación con el código ejecutado y marcar limitaciones no implementadas. (dimensión: documentación).
- [ ] **AUD-336** variables de entorno, contenedores, readiness, rollback y secretos: Registrar versión, commit, algoritmo o modelo que originó el resultado y permitir reproducirlo. (dimensión: versionado).
- [ ] **AUD-337** variables de entorno, contenedores, readiness, rollback y secretos: Probar separación entre usuarios, tenants, sesiones y datos restringidos. (dimensión: aislamiento).
- [ ] **AUD-338** variables de entorno, contenedores, readiness, rollback y secretos: Verificar que acciones críticas generen un evento de auditoría correlacionable e íntegro. (dimensión: auditoría).
- [ ] **AUD-339** variables de entorno, contenedores, readiness, rollback y secretos: Probar recuperación tras reinicio, fallo parcial, desconexión o rollback. (dimensión: recuperación).
- [ ] **AUD-340** variables de entorno, contenedores, readiness, rollback y secretos: Impedir promoción a producción si el control crítico está fallido, omitido o no evaluado. (dimensión: gate de release).

## 18. Observabilidad e incidentes

- [ ] **AUD-341** logs, métricas, trazas, alertas, correlación y respuesta: Validar contrato, esquema y compatibilidad; añadir pruebas para campos inválidos. (dimensión: contrato).
- [ ] **AUD-342** logs, métricas, trazas, alertas, correlación y respuesta: Exigir evidencia reproducible del comportamiento; documentación sola no cuenta como prueba. (dimensión: evidencia).
- [ ] **AUD-343** logs, métricas, trazas, alertas, correlación y respuesta: Probar configuración ausente, proveedor caído y error interno; evitar declarar éxito. (dimensión: fallo seguro).
- [ ] **AUD-344** logs, métricas, trazas, alertas, correlación y respuesta: Comprobar que la autorización provenga del servidor y que el cliente no pueda elevar privilegios. (dimensión: autorización).
- [ ] **AUD-345** logs, métricas, trazas, alertas, correlación y respuesta: Definir límites de tamaño, tiempo, concurrencia y consumo; probar el límite y el exceso. (dimensión: límites).
- [ ] **AUD-346** logs, métricas, trazas, alertas, correlación y respuesta: Comprobar que tokens, claves y datos personales no aparezcan en logs o respuestas. (dimensión: secretos).
- [ ] **AUD-347** logs, métricas, trazas, alertas, correlación y respuesta: Verificar que referencias y objetos anidados no alteren estado que se considera inmutable. (dimensión: mutabilidad).
- [ ] **AUD-348** logs, métricas, trazas, alertas, correlación y respuesta: Probar reintentos, duplicados y concurrencia sin duplicar efectos secundarios. (dimensión: reintentos).
- [ ] **AUD-349** logs, métricas, trazas, alertas, correlación y respuesta: Registrar estado, correlación y motivo sin filtrar datos sensibles ni confundir simulación con ejecución. (dimensión: observabilidad).
- [ ] **AUD-350** logs, métricas, trazas, alertas, correlación y respuesta: Probar el contrato con el runtime canónico y con el adaptador real, no solo mocks permisivos. (dimensión: integración).
- [ ] **AUD-351** logs, métricas, trazas, alertas, correlación y respuesta: Agregar prueba para entrada maliciosa, permiso denegado o evidencia incompleta. (dimensión: prueba negativa).
- [ ] **AUD-352** logs, métricas, trazas, alertas, correlación y respuesta: Vincular cada defecto confirmado con una prueba que falle antes y pase después de corregirlo. (dimensión: regresión).
- [ ] **AUD-353** logs, métricas, trazas, alertas, correlación y respuesta: Identificar dependencias directas/transitivas, versiones, licencias y vulnerabilidades pertinentes. (dimensión: dependencias).
- [ ] **AUD-354** logs, métricas, trazas, alertas, correlación y respuesta: Validar variables requeridas y defaults; configuración crítica ausente debe fallar cerrada. (dimensión: configuración).
- [ ] **AUD-355** logs, métricas, trazas, alertas, correlación y respuesta: Alinear la documentación con el código ejecutado y marcar limitaciones no implementadas. (dimensión: documentación).
- [ ] **AUD-356** logs, métricas, trazas, alertas, correlación y respuesta: Registrar versión, commit, algoritmo o modelo que originó el resultado y permitir reproducirlo. (dimensión: versionado).
- [ ] **AUD-357** logs, métricas, trazas, alertas, correlación y respuesta: Probar separación entre usuarios, tenants, sesiones y datos restringidos. (dimensión: aislamiento).
- [ ] **AUD-358** logs, métricas, trazas, alertas, correlación y respuesta: Verificar que acciones críticas generen un evento de auditoría correlacionable e íntegro. (dimensión: auditoría).
- [ ] **AUD-359** logs, métricas, trazas, alertas, correlación y respuesta: Probar recuperación tras reinicio, fallo parcial, desconexión o rollback. (dimensión: recuperación).
- [ ] **AUD-360** logs, métricas, trazas, alertas, correlación y respuesta: Impedir promoción a producción si el control crítico está fallido, omitido o no evaluado. (dimensión: gate de release).

## 19. Licencias y regulación

- [ ] **AUD-361** MIT, componentes terceros, privacidad, jurisdicciones y afirmaciones de cumplimiento: Validar contrato, esquema y compatibilidad; añadir pruebas para campos inválidos. (dimensión: contrato).
- [ ] **AUD-362** MIT, componentes terceros, privacidad, jurisdicciones y afirmaciones de cumplimiento: Exigir evidencia reproducible del comportamiento; documentación sola no cuenta como prueba. (dimensión: evidencia).
- [ ] **AUD-363** MIT, componentes terceros, privacidad, jurisdicciones y afirmaciones de cumplimiento: Probar configuración ausente, proveedor caído y error interno; evitar declarar éxito. (dimensión: fallo seguro).
- [ ] **AUD-364** MIT, componentes terceros, privacidad, jurisdicciones y afirmaciones de cumplimiento: Comprobar que la autorización provenga del servidor y que el cliente no pueda elevar privilegios. (dimensión: autorización).
- [ ] **AUD-365** MIT, componentes terceros, privacidad, jurisdicciones y afirmaciones de cumplimiento: Definir límites de tamaño, tiempo, concurrencia y consumo; probar el límite y el exceso. (dimensión: límites).
- [ ] **AUD-366** MIT, componentes terceros, privacidad, jurisdicciones y afirmaciones de cumplimiento: Comprobar que tokens, claves y datos personales no aparezcan en logs o respuestas. (dimensión: secretos).
- [ ] **AUD-367** MIT, componentes terceros, privacidad, jurisdicciones y afirmaciones de cumplimiento: Verificar que referencias y objetos anidados no alteren estado que se considera inmutable. (dimensión: mutabilidad).
- [ ] **AUD-368** MIT, componentes terceros, privacidad, jurisdicciones y afirmaciones de cumplimiento: Probar reintentos, duplicados y concurrencia sin duplicar efectos secundarios. (dimensión: reintentos).
- [ ] **AUD-369** MIT, componentes terceros, privacidad, jurisdicciones y afirmaciones de cumplimiento: Registrar estado, correlación y motivo sin filtrar datos sensibles ni confundir simulación con ejecución. (dimensión: observabilidad).
- [ ] **AUD-370** MIT, componentes terceros, privacidad, jurisdicciones y afirmaciones de cumplimiento: Probar el contrato con el runtime canónico y con el adaptador real, no solo mocks permisivos. (dimensión: integración).
- [ ] **AUD-371** MIT, componentes terceros, privacidad, jurisdicciones y afirmaciones de cumplimiento: Agregar prueba para entrada maliciosa, permiso denegado o evidencia incompleta. (dimensión: prueba negativa).
- [ ] **AUD-372** MIT, componentes terceros, privacidad, jurisdicciones y afirmaciones de cumplimiento: Vincular cada defecto confirmado con una prueba que falle antes y pase después de corregirlo. (dimensión: regresión).
- [ ] **AUD-373** MIT, componentes terceros, privacidad, jurisdicciones y afirmaciones de cumplimiento: Identificar dependencias directas/transitivas, versiones, licencias y vulnerabilidades pertinentes. (dimensión: dependencias).
- [ ] **AUD-374** MIT, componentes terceros, privacidad, jurisdicciones y afirmaciones de cumplimiento: Validar variables requeridas y defaults; configuración crítica ausente debe fallar cerrada. (dimensión: configuración).
- [ ] **AUD-375** MIT, componentes terceros, privacidad, jurisdicciones y afirmaciones de cumplimiento: Alinear la documentación con el código ejecutado y marcar limitaciones no implementadas. (dimensión: documentación).
- [ ] **AUD-376** MIT, componentes terceros, privacidad, jurisdicciones y afirmaciones de cumplimiento: Registrar versión, commit, algoritmo o modelo que originó el resultado y permitir reproducirlo. (dimensión: versionado).
- [ ] **AUD-377** MIT, componentes terceros, privacidad, jurisdicciones y afirmaciones de cumplimiento: Probar separación entre usuarios, tenants, sesiones y datos restringidos. (dimensión: aislamiento).
- [ ] **AUD-378** MIT, componentes terceros, privacidad, jurisdicciones y afirmaciones de cumplimiento: Verificar que acciones críticas generen un evento de auditoría correlacionable e íntegro. (dimensión: auditoría).
- [ ] **AUD-379** MIT, componentes terceros, privacidad, jurisdicciones y afirmaciones de cumplimiento: Probar recuperación tras reinicio, fallo parcial, desconexión o rollback. (dimensión: recuperación).
- [ ] **AUD-380** MIT, componentes terceros, privacidad, jurisdicciones y afirmaciones de cumplimiento: Impedir promoción a producción si el control crítico está fallido, omitido o no evaluado. (dimensión: gate de release).

## 20. Sesgos y evaluación de respuestas

- [ ] **AUD-381** factualidad, calibración, representatividad, abstención y citas: Validar contrato, esquema y compatibilidad; añadir pruebas para campos inválidos. (dimensión: contrato).
- [ ] **AUD-382** factualidad, calibración, representatividad, abstención y citas: Exigir evidencia reproducible del comportamiento; documentación sola no cuenta como prueba. (dimensión: evidencia).
- [ ] **AUD-383** factualidad, calibración, representatividad, abstención y citas: Probar configuración ausente, proveedor caído y error interno; evitar declarar éxito. (dimensión: fallo seguro).
- [ ] **AUD-384** factualidad, calibración, representatividad, abstención y citas: Comprobar que la autorización provenga del servidor y que el cliente no pueda elevar privilegios. (dimensión: autorización).
- [ ] **AUD-385** factualidad, calibración, representatividad, abstención y citas: Definir límites de tamaño, tiempo, concurrencia y consumo; probar el límite y el exceso. (dimensión: límites).
- [ ] **AUD-386** factualidad, calibración, representatividad, abstención y citas: Comprobar que tokens, claves y datos personales no aparezcan en logs o respuestas. (dimensión: secretos).
- [ ] **AUD-387** factualidad, calibración, representatividad, abstención y citas: Verificar que referencias y objetos anidados no alteren estado que se considera inmutable. (dimensión: mutabilidad).
- [ ] **AUD-388** factualidad, calibración, representatividad, abstención y citas: Probar reintentos, duplicados y concurrencia sin duplicar efectos secundarios. (dimensión: reintentos).
- [ ] **AUD-389** factualidad, calibración, representatividad, abstención y citas: Registrar estado, correlación y motivo sin filtrar datos sensibles ni confundir simulación con ejecución. (dimensión: observabilidad).
- [ ] **AUD-390** factualidad, calibración, representatividad, abstención y citas: Probar el contrato con el runtime canónico y con el adaptador real, no solo mocks permisivos. (dimensión: integración).
- [ ] **AUD-391** factualidad, calibración, representatividad, abstención y citas: Agregar prueba para entrada maliciosa, permiso denegado o evidencia incompleta. (dimensión: prueba negativa).
- [ ] **AUD-392** factualidad, calibración, representatividad, abstención y citas: Vincular cada defecto confirmado con una prueba que falle antes y pase después de corregirlo. (dimensión: regresión).
- [ ] **AUD-393** factualidad, calibración, representatividad, abstención y citas: Identificar dependencias directas/transitivas, versiones, licencias y vulnerabilidades pertinentes. (dimensión: dependencias).
- [ ] **AUD-394** factualidad, calibración, representatividad, abstención y citas: Validar variables requeridas y defaults; configuración crítica ausente debe fallar cerrada. (dimensión: configuración).
- [ ] **AUD-395** factualidad, calibración, representatividad, abstención y citas: Alinear la documentación con el código ejecutado y marcar limitaciones no implementadas. (dimensión: documentación).
- [ ] **AUD-396** factualidad, calibración, representatividad, abstención y citas: Registrar versión, commit, algoritmo o modelo que originó el resultado y permitir reproducirlo. (dimensión: versionado).
- [ ] **AUD-397** factualidad, calibración, representatividad, abstención y citas: Probar separación entre usuarios, tenants, sesiones y datos restringidos. (dimensión: aislamiento).
- [ ] **AUD-398** factualidad, calibración, representatividad, abstención y citas: Verificar que acciones críticas generen un evento de auditoría correlacionable e íntegro. (dimensión: auditoría).
- [ ] **AUD-399** factualidad, calibración, representatividad, abstención y citas: Probar recuperación tras reinicio, fallo parcial, desconexión o rollback. (dimensión: recuperación).
- [ ] **AUD-400** factualidad, calibración, representatividad, abstención y citas: Impedir promoción a producción si el control crítico está fallido, omitido o no evaluado. (dimensión: gate de release).

## 21. README y documentación

- [ ] **AUD-401** afirmaciones públicas, comandos, versiones, diagramas y limitaciones: Validar contrato, esquema y compatibilidad; añadir pruebas para campos inválidos. (dimensión: contrato).
- [ ] **AUD-402** afirmaciones públicas, comandos, versiones, diagramas y limitaciones: Exigir evidencia reproducible del comportamiento; documentación sola no cuenta como prueba. (dimensión: evidencia).
- [ ] **AUD-403** afirmaciones públicas, comandos, versiones, diagramas y limitaciones: Probar configuración ausente, proveedor caído y error interno; evitar declarar éxito. (dimensión: fallo seguro).
- [ ] **AUD-404** afirmaciones públicas, comandos, versiones, diagramas y limitaciones: Comprobar que la autorización provenga del servidor y que el cliente no pueda elevar privilegios. (dimensión: autorización).
- [ ] **AUD-405** afirmaciones públicas, comandos, versiones, diagramas y limitaciones: Definir límites de tamaño, tiempo, concurrencia y consumo; probar el límite y el exceso. (dimensión: límites).
- [ ] **AUD-406** afirmaciones públicas, comandos, versiones, diagramas y limitaciones: Comprobar que tokens, claves y datos personales no aparezcan en logs o respuestas. (dimensión: secretos).
- [ ] **AUD-407** afirmaciones públicas, comandos, versiones, diagramas y limitaciones: Verificar que referencias y objetos anidados no alteren estado que se considera inmutable. (dimensión: mutabilidad).
- [ ] **AUD-408** afirmaciones públicas, comandos, versiones, diagramas y limitaciones: Probar reintentos, duplicados y concurrencia sin duplicar efectos secundarios. (dimensión: reintentos).
- [ ] **AUD-409** afirmaciones públicas, comandos, versiones, diagramas y limitaciones: Registrar estado, correlación y motivo sin filtrar datos sensibles ni confundir simulación con ejecución. (dimensión: observabilidad).
- [ ] **AUD-410** afirmaciones públicas, comandos, versiones, diagramas y limitaciones: Probar el contrato con el runtime canónico y con el adaptador real, no solo mocks permisivos. (dimensión: integración).
- [ ] **AUD-411** afirmaciones públicas, comandos, versiones, diagramas y limitaciones: Agregar prueba para entrada maliciosa, permiso denegado o evidencia incompleta. (dimensión: prueba negativa).
- [ ] **AUD-412** afirmaciones públicas, comandos, versiones, diagramas y limitaciones: Vincular cada defecto confirmado con una prueba que falle antes y pase después de corregirlo. (dimensión: regresión).
- [ ] **AUD-413** afirmaciones públicas, comandos, versiones, diagramas y limitaciones: Identificar dependencias directas/transitivas, versiones, licencias y vulnerabilidades pertinentes. (dimensión: dependencias).
- [ ] **AUD-414** afirmaciones públicas, comandos, versiones, diagramas y limitaciones: Validar variables requeridas y defaults; configuración crítica ausente debe fallar cerrada. (dimensión: configuración).
- [ ] **AUD-415** afirmaciones públicas, comandos, versiones, diagramas y limitaciones: Alinear la documentación con el código ejecutado y marcar limitaciones no implementadas. (dimensión: documentación).
- [ ] **AUD-416** afirmaciones públicas, comandos, versiones, diagramas y limitaciones: Registrar versión, commit, algoritmo o modelo que originó el resultado y permitir reproducirlo. (dimensión: versionado).
- [ ] **AUD-417** afirmaciones públicas, comandos, versiones, diagramas y limitaciones: Probar separación entre usuarios, tenants, sesiones y datos restringidos. (dimensión: aislamiento).
- [ ] **AUD-418** afirmaciones públicas, comandos, versiones, diagramas y limitaciones: Verificar que acciones críticas generen un evento de auditoría correlacionable e íntegro. (dimensión: auditoría).
- [ ] **AUD-419** afirmaciones públicas, comandos, versiones, diagramas y limitaciones: Probar recuperación tras reinicio, fallo parcial, desconexión o rollback. (dimensión: recuperación).
- [ ] **AUD-420** afirmaciones públicas, comandos, versiones, diagramas y limitaciones: Impedir promoción a producción si el control crítico está fallido, omitido o no evaluado. (dimensión: gate de release).

## 22. Integración de repositorios

- [ ] **AUD-421** adaptadores, contratos, versiones, aislamiento y ausencia de runtime paralelo: Validar contrato, esquema y compatibilidad; añadir pruebas para campos inválidos. (dimensión: contrato).
- [ ] **AUD-422** adaptadores, contratos, versiones, aislamiento y ausencia de runtime paralelo: Exigir evidencia reproducible del comportamiento; documentación sola no cuenta como prueba. (dimensión: evidencia).
- [ ] **AUD-423** adaptadores, contratos, versiones, aislamiento y ausencia de runtime paralelo: Probar configuración ausente, proveedor caído y error interno; evitar declarar éxito. (dimensión: fallo seguro).
- [ ] **AUD-424** adaptadores, contratos, versiones, aislamiento y ausencia de runtime paralelo: Comprobar que la autorización provenga del servidor y que el cliente no pueda elevar privilegios. (dimensión: autorización).
- [ ] **AUD-425** adaptadores, contratos, versiones, aislamiento y ausencia de runtime paralelo: Definir límites de tamaño, tiempo, concurrencia y consumo; probar el límite y el exceso. (dimensión: límites).
- [ ] **AUD-426** adaptadores, contratos, versiones, aislamiento y ausencia de runtime paralelo: Comprobar que tokens, claves y datos personales no aparezcan en logs o respuestas. (dimensión: secretos).
- [ ] **AUD-427** adaptadores, contratos, versiones, aislamiento y ausencia de runtime paralelo: Verificar que referencias y objetos anidados no alteren estado que se considera inmutable. (dimensión: mutabilidad).
- [ ] **AUD-428** adaptadores, contratos, versiones, aislamiento y ausencia de runtime paralelo: Probar reintentos, duplicados y concurrencia sin duplicar efectos secundarios. (dimensión: reintentos).
- [ ] **AUD-429** adaptadores, contratos, versiones, aislamiento y ausencia de runtime paralelo: Registrar estado, correlación y motivo sin filtrar datos sensibles ni confundir simulación con ejecución. (dimensión: observabilidad).
- [ ] **AUD-430** adaptadores, contratos, versiones, aislamiento y ausencia de runtime paralelo: Probar el contrato con el runtime canónico y con el adaptador real, no solo mocks permisivos. (dimensión: integración).
- [ ] **AUD-431** adaptadores, contratos, versiones, aislamiento y ausencia de runtime paralelo: Agregar prueba para entrada maliciosa, permiso denegado o evidencia incompleta. (dimensión: prueba negativa).
- [ ] **AUD-432** adaptadores, contratos, versiones, aislamiento y ausencia de runtime paralelo: Vincular cada defecto confirmado con una prueba que falle antes y pase después de corregirlo. (dimensión: regresión).
- [ ] **AUD-433** adaptadores, contratos, versiones, aislamiento y ausencia de runtime paralelo: Identificar dependencias directas/transitivas, versiones, licencias y vulnerabilidades pertinentes. (dimensión: dependencias).
- [ ] **AUD-434** adaptadores, contratos, versiones, aislamiento y ausencia de runtime paralelo: Validar variables requeridas y defaults; configuración crítica ausente debe fallar cerrada. (dimensión: configuración).
- [ ] **AUD-435** adaptadores, contratos, versiones, aislamiento y ausencia de runtime paralelo: Alinear la documentación con el código ejecutado y marcar limitaciones no implementadas. (dimensión: documentación).
- [ ] **AUD-436** adaptadores, contratos, versiones, aislamiento y ausencia de runtime paralelo: Registrar versión, commit, algoritmo o modelo que originó el resultado y permitir reproducirlo. (dimensión: versionado).
- [ ] **AUD-437** adaptadores, contratos, versiones, aislamiento y ausencia de runtime paralelo: Probar separación entre usuarios, tenants, sesiones y datos restringidos. (dimensión: aislamiento).
- [ ] **AUD-438** adaptadores, contratos, versiones, aislamiento y ausencia de runtime paralelo: Verificar que acciones críticas generen un evento de auditoría correlacionable e íntegro. (dimensión: auditoría).
- [ ] **AUD-439** adaptadores, contratos, versiones, aislamiento y ausencia de runtime paralelo: Probar recuperación tras reinicio, fallo parcial, desconexión o rollback. (dimensión: recuperación).
- [ ] **AUD-440** adaptadores, contratos, versiones, aislamiento y ausencia de runtime paralelo: Impedir promoción a producción si el control crítico está fallido, omitido o no evaluado. (dimensión: gate de release).

## 23. UX y accesibilidad

- [ ] **AUD-441** estados, mensajes, accesibilidad, privacidad en interfaz y confirmaciones: Validar contrato, esquema y compatibilidad; añadir pruebas para campos inválidos. (dimensión: contrato).
- [ ] **AUD-442** estados, mensajes, accesibilidad, privacidad en interfaz y confirmaciones: Exigir evidencia reproducible del comportamiento; documentación sola no cuenta como prueba. (dimensión: evidencia).
- [ ] **AUD-443** estados, mensajes, accesibilidad, privacidad en interfaz y confirmaciones: Probar configuración ausente, proveedor caído y error interno; evitar declarar éxito. (dimensión: fallo seguro).
- [ ] **AUD-444** estados, mensajes, accesibilidad, privacidad en interfaz y confirmaciones: Comprobar que la autorización provenga del servidor y que el cliente no pueda elevar privilegios. (dimensión: autorización).
- [ ] **AUD-445** estados, mensajes, accesibilidad, privacidad en interfaz y confirmaciones: Definir límites de tamaño, tiempo, concurrencia y consumo; probar el límite y el exceso. (dimensión: límites).
- [ ] **AUD-446** estados, mensajes, accesibilidad, privacidad en interfaz y confirmaciones: Comprobar que tokens, claves y datos personales no aparezcan en logs o respuestas. (dimensión: secretos).
- [ ] **AUD-447** estados, mensajes, accesibilidad, privacidad en interfaz y confirmaciones: Verificar que referencias y objetos anidados no alteren estado que se considera inmutable. (dimensión: mutabilidad).
- [ ] **AUD-448** estados, mensajes, accesibilidad, privacidad en interfaz y confirmaciones: Probar reintentos, duplicados y concurrencia sin duplicar efectos secundarios. (dimensión: reintentos).
- [ ] **AUD-449** estados, mensajes, accesibilidad, privacidad en interfaz y confirmaciones: Registrar estado, correlación y motivo sin filtrar datos sensibles ni confundir simulación con ejecución. (dimensión: observabilidad).
- [ ] **AUD-450** estados, mensajes, accesibilidad, privacidad en interfaz y confirmaciones: Probar el contrato con el runtime canónico y con el adaptador real, no solo mocks permisivos. (dimensión: integración).
- [ ] **AUD-451** estados, mensajes, accesibilidad, privacidad en interfaz y confirmaciones: Agregar prueba para entrada maliciosa, permiso denegado o evidencia incompleta. (dimensión: prueba negativa).
- [ ] **AUD-452** estados, mensajes, accesibilidad, privacidad en interfaz y confirmaciones: Vincular cada defecto confirmado con una prueba que falle antes y pase después de corregirlo. (dimensión: regresión).
- [ ] **AUD-453** estados, mensajes, accesibilidad, privacidad en interfaz y confirmaciones: Identificar dependencias directas/transitivas, versiones, licencias y vulnerabilidades pertinentes. (dimensión: dependencias).
- [ ] **AUD-454** estados, mensajes, accesibilidad, privacidad en interfaz y confirmaciones: Validar variables requeridas y defaults; configuración crítica ausente debe fallar cerrada. (dimensión: configuración).
- [ ] **AUD-455** estados, mensajes, accesibilidad, privacidad en interfaz y confirmaciones: Alinear la documentación con el código ejecutado y marcar limitaciones no implementadas. (dimensión: documentación).
- [ ] **AUD-456** estados, mensajes, accesibilidad, privacidad en interfaz y confirmaciones: Registrar versión, commit, algoritmo o modelo que originó el resultado y permitir reproducirlo. (dimensión: versionado).
- [ ] **AUD-457** estados, mensajes, accesibilidad, privacidad en interfaz y confirmaciones: Probar separación entre usuarios, tenants, sesiones y datos restringidos. (dimensión: aislamiento).
- [ ] **AUD-458** estados, mensajes, accesibilidad, privacidad en interfaz y confirmaciones: Verificar que acciones críticas generen un evento de auditoría correlacionable e íntegro. (dimensión: auditoría).
- [ ] **AUD-459** estados, mensajes, accesibilidad, privacidad en interfaz y confirmaciones: Probar recuperación tras reinicio, fallo parcial, desconexión o rollback. (dimensión: recuperación).
- [ ] **AUD-460** estados, mensajes, accesibilidad, privacidad en interfaz y confirmaciones: Impedir promoción a producción si el control crítico está fallido, omitido o no evaluado. (dimensión: gate de release).

## 24. Rendimiento y resiliencia

- [ ] **AUD-461** latencia, memoria, backpressure, cuotas, circuit breakers y carga: Validar contrato, esquema y compatibilidad; añadir pruebas para campos inválidos. (dimensión: contrato).
- [ ] **AUD-462** latencia, memoria, backpressure, cuotas, circuit breakers y carga: Exigir evidencia reproducible del comportamiento; documentación sola no cuenta como prueba. (dimensión: evidencia).
- [ ] **AUD-463** latencia, memoria, backpressure, cuotas, circuit breakers y carga: Probar configuración ausente, proveedor caído y error interno; evitar declarar éxito. (dimensión: fallo seguro).
- [ ] **AUD-464** latencia, memoria, backpressure, cuotas, circuit breakers y carga: Comprobar que la autorización provenga del servidor y que el cliente no pueda elevar privilegios. (dimensión: autorización).
- [ ] **AUD-465** latencia, memoria, backpressure, cuotas, circuit breakers y carga: Definir límites de tamaño, tiempo, concurrencia y consumo; probar el límite y el exceso. (dimensión: límites).
- [ ] **AUD-466** latencia, memoria, backpressure, cuotas, circuit breakers y carga: Comprobar que tokens, claves y datos personales no aparezcan en logs o respuestas. (dimensión: secretos).
- [ ] **AUD-467** latencia, memoria, backpressure, cuotas, circuit breakers y carga: Verificar que referencias y objetos anidados no alteren estado que se considera inmutable. (dimensión: mutabilidad).
- [ ] **AUD-468** latencia, memoria, backpressure, cuotas, circuit breakers y carga: Probar reintentos, duplicados y concurrencia sin duplicar efectos secundarios. (dimensión: reintentos).
- [ ] **AUD-469** latencia, memoria, backpressure, cuotas, circuit breakers y carga: Registrar estado, correlación y motivo sin filtrar datos sensibles ni confundir simulación con ejecución. (dimensión: observabilidad).
- [ ] **AUD-470** latencia, memoria, backpressure, cuotas, circuit breakers y carga: Probar el contrato con el runtime canónico y con el adaptador real, no solo mocks permisivos. (dimensión: integración).
- [ ] **AUD-471** latencia, memoria, backpressure, cuotas, circuit breakers y carga: Agregar prueba para entrada maliciosa, permiso denegado o evidencia incompleta. (dimensión: prueba negativa).
- [ ] **AUD-472** latencia, memoria, backpressure, cuotas, circuit breakers y carga: Vincular cada defecto confirmado con una prueba que falle antes y pase después de corregirlo. (dimensión: regresión).
- [ ] **AUD-473** latencia, memoria, backpressure, cuotas, circuit breakers y carga: Identificar dependencias directas/transitivas, versiones, licencias y vulnerabilidades pertinentes. (dimensión: dependencias).
- [ ] **AUD-474** latencia, memoria, backpressure, cuotas, circuit breakers y carga: Validar variables requeridas y defaults; configuración crítica ausente debe fallar cerrada. (dimensión: configuración).
- [ ] **AUD-475** latencia, memoria, backpressure, cuotas, circuit breakers y carga: Alinear la documentación con el código ejecutado y marcar limitaciones no implementadas. (dimensión: documentación).
- [ ] **AUD-476** latencia, memoria, backpressure, cuotas, circuit breakers y carga: Registrar versión, commit, algoritmo o modelo que originó el resultado y permitir reproducirlo. (dimensión: versionado).
- [ ] **AUD-477** latencia, memoria, backpressure, cuotas, circuit breakers y carga: Probar separación entre usuarios, tenants, sesiones y datos restringidos. (dimensión: aislamiento).
- [ ] **AUD-478** latencia, memoria, backpressure, cuotas, circuit breakers y carga: Verificar que acciones críticas generen un evento de auditoría correlacionable e íntegro. (dimensión: auditoría).
- [ ] **AUD-479** latencia, memoria, backpressure, cuotas, circuit breakers y carga: Probar recuperación tras reinicio, fallo parcial, desconexión o rollback. (dimensión: recuperación).
- [ ] **AUD-480** latencia, memoria, backpressure, cuotas, circuit breakers y carga: Impedir promoción a producción si el control crítico está fallido, omitido o no evaluado. (dimensión: gate de release).

## 25. CI/CD y releases

- [ ] **AUD-481** protección de ramas, aprobaciones, artefactos, versionado y promoción: Validar contrato, esquema y compatibilidad; añadir pruebas para campos inválidos. (dimensión: contrato).
- [ ] **AUD-482** protección de ramas, aprobaciones, artefactos, versionado y promoción: Exigir evidencia reproducible del comportamiento; documentación sola no cuenta como prueba. (dimensión: evidencia).
- [ ] **AUD-483** protección de ramas, aprobaciones, artefactos, versionado y promoción: Probar configuración ausente, proveedor caído y error interno; evitar declarar éxito. (dimensión: fallo seguro).
- [ ] **AUD-484** protección de ramas, aprobaciones, artefactos, versionado y promoción: Comprobar que la autorización provenga del servidor y que el cliente no pueda elevar privilegios. (dimensión: autorización).
- [ ] **AUD-485** protección de ramas, aprobaciones, artefactos, versionado y promoción: Definir límites de tamaño, tiempo, concurrencia y consumo; probar el límite y el exceso. (dimensión: límites).
- [ ] **AUD-486** protección de ramas, aprobaciones, artefactos, versionado y promoción: Comprobar que tokens, claves y datos personales no aparezcan en logs o respuestas. (dimensión: secretos).
- [ ] **AUD-487** protección de ramas, aprobaciones, artefactos, versionado y promoción: Verificar que referencias y objetos anidados no alteren estado que se considera inmutable. (dimensión: mutabilidad).
- [ ] **AUD-488** protección de ramas, aprobaciones, artefactos, versionado y promoción: Probar reintentos, duplicados y concurrencia sin duplicar efectos secundarios. (dimensión: reintentos).
- [ ] **AUD-489** protección de ramas, aprobaciones, artefactos, versionado y promoción: Registrar estado, correlación y motivo sin filtrar datos sensibles ni confundir simulación con ejecución. (dimensión: observabilidad).
- [ ] **AUD-490** protección de ramas, aprobaciones, artefactos, versionado y promoción: Probar el contrato con el runtime canónico y con el adaptador real, no solo mocks permisivos. (dimensión: integración).
- [ ] **AUD-491** protección de ramas, aprobaciones, artefactos, versionado y promoción: Agregar prueba para entrada maliciosa, permiso denegado o evidencia incompleta. (dimensión: prueba negativa).
- [ ] **AUD-492** protección de ramas, aprobaciones, artefactos, versionado y promoción: Vincular cada defecto confirmado con una prueba que falle antes y pase después de corregirlo. (dimensión: regresión).
- [ ] **AUD-493** protección de ramas, aprobaciones, artefactos, versionado y promoción: Identificar dependencias directas/transitivas, versiones, licencias y vulnerabilidades pertinentes. (dimensión: dependencias).
- [ ] **AUD-494** protección de ramas, aprobaciones, artefactos, versionado y promoción: Validar variables requeridas y defaults; configuración crítica ausente debe fallar cerrada. (dimensión: configuración).
- [ ] **AUD-495** protección de ramas, aprobaciones, artefactos, versionado y promoción: Alinear la documentación con el código ejecutado y marcar limitaciones no implementadas. (dimensión: documentación).
- [ ] **AUD-496** protección de ramas, aprobaciones, artefactos, versionado y promoción: Registrar versión, commit, algoritmo o modelo que originó el resultado y permitir reproducirlo. (dimensión: versionado).
- [ ] **AUD-497** protección de ramas, aprobaciones, artefactos, versionado y promoción: Probar separación entre usuarios, tenants, sesiones y datos restringidos. (dimensión: aislamiento).
- [ ] **AUD-498** protección de ramas, aprobaciones, artefactos, versionado y promoción: Verificar que acciones críticas generen un evento de auditoría correlacionable e íntegro. (dimensión: auditoría).
- [ ] **AUD-499** protección de ramas, aprobaciones, artefactos, versionado y promoción: Probar recuperación tras reinicio, fallo parcial, desconexión o rollback. (dimensión: recuperación).
- [ ] **AUD-500** protección de ramas, aprobaciones, artefactos, versionado y promoción: Impedir promoción a producción si el control crítico está fallido, omitido o no evaluado. (dimensión: gate de release).

## Criterio de cierre

No cerrar una categoría por haber leído su README. Exigir prueba automatizada, resultado CI, configuración revisada, ejecución reproducible o revisión experta registrada. Mantener diferenciados `NOT_CONFIGURED`, `NOT_VERIFIED`, `FAILED` y `VERIFIED`. No afirmar cumplimiento legal, seguridad cuántica, producción ni porcentajes de avance sin evidencia específica.


## Origen: `docs/AUDIT_GENESIS_V6_2026-10-08.md`

# Auditoría técnica y de preparación de Isabella GenesisAI

**Fecha de corte:** 8 de octubre de 2026  
**Base examinada:** rama `main` tras la integración de la PR #11 y código/documentación accesibles en GitHub.  
**Tipo:** revisión estática orientada a arquitectura, seguridad, afirmaciones verificables, operabilidad y preparación productiva.  
**No es:** pentest externo, certificación, dictamen jurídico ni prueba de despliegue.

## 1. Dictamen ejecutivo

Isabella GenesisAI debe clasificarse como **runtime cognitivo gobernado modular en fase preproductiva**. No es un modelo fundacional propio, no es AGI, no es una plataforma distribuida plenamente operativa y no debe declararse conforme a una ley o norma sin evaluación documentada.

La base de código es más amplia que en la revisión anterior: ahora documenta TINA V6, CROWN, AEGIS, IKES, VERITAS, BookPI, Atlas, IsabellaEngine, HSF, PID reconciliation y PennyLane. Esa amplitud aumenta el valor de la arquitectura, pero también aumenta el riesgo de confundir contratos, stubs, fixtures, adaptadores locales y proveedores productivos.

## 2. Comparativa con la revisión anterior de hoy

| Área | Última revisión de hoy | Estado observado ahora | Conclusión |
|---|---|---|---|
| Runtime canónico | GenesisAI declarado único runtime | Se mantiene como directiva del README | Correcto; no crear un runtime alternativo |
| PennyLane | Puente gobernado en PR #11 | PR #11 aparece integrada en main | Avance de integración; ejecución real depende del servicio/backend configurado |
| HSF | Contratos, registry, gateway y primitivas locales | Código HSF presente en main | Se encontró que Genesis declaraba el registro, pero no llamaba a `registerHyperSkillFabric()` en el constructor |
| Seguridad HSF | Gateway descrito como gobernado | La política por defecto validaba presencia de campos, no autoridad | Riesgo de autorización; corregido en rama de auditoría para denegar por defecto |
| Identidad HTTP | Roles leídos del body en el endpoint HSF | El cliente podía intentar declararse principal/rol | Riesgo de suplantación de principal; corregido en rama para usar token de servidor y principal fijo |
| Evidencia criptográfica | Herramientas anunciaban verificación | Algunos handlers devolvían raíces, contadores y anclajes constantes | Evidencia fabricada por fixture; corregido para informar NOT_VERIFIED/NOT_CONFIGURED |
| Cumplimiento | Skill devolvía COMPLIANT sin evaluación | No había expediente jurisdiccional ni evidencia de controles | Falso positivo de cumplimiento; corregido a NOT_ASSESSED |
| Gemelo digital | Handler decía sincronización exitosa | No se invocaba proveedor real de archivo/ledger | Afirmación no sustentada; corregida a NOT_CONFIGURED |
| README | Documento extenso con porcentajes por dominio | Persisten estimaciones no calibradas y afirmaciones que deben interpretarse con cautela | Se agregan metodología, limitaciones, competencia, licencia y mapa normativo |
| CI | Se observó un fallo en el ciclo anterior | El workflow del repositorio ejecuta typecheck, tests y build; el resultado de esta rama requiere el run correspondiente | No afirmar CI verde hasta ver el run de este commit |

## 3. Hallazgos y acciones

### HSF-01 — Registro de capacidades no inicializado

**Severidad:** alta para funcionalidad.  
**Evidencia:** existe `registerHyperSkillFabric()`, pero el constructor de `IsabellaGenesisRuntime` no lo invocaba. `/api/v1/hsf/status` podía mostrar un catálogo vacío.  
**Acción en rama:** invocar el registro durante el arranque del runtime.

### HSF-02 — Validación de contexto confundida con autorización

**Severidad:** crítica para el límite de seguridad.  
**Evidencia:** la política inicial consideraba suficientes los IDs y rol presentes. Esos campos no prueban autorización.  
**Acción en rama:** política por defecto fail-closed, exige marcadores de autenticación y admisión de Genesis. El endpoint HSF requiere `HSF_API_TOKEN`, usa principal de servicio y deja de aceptar roles declarados por el cliente.

**Limitación pendiente:** un token compartido de servicio no sustituye un sistema completo de identidad de usuario, rotación, revocación, scopes por capacidad y auditoría de credenciales. En producción debe integrarse con el proveedor de identidad elegido y con las decisiones de CROWN/AEGIS.

### TRUST-01 — Salidas criptográficas simuladas

**Severidad:** crítica para integridad y confianza.  
**Evidencia:** handlers de ejemplo devolvían estado VERIFIED, raíz Merkle, número de bloques y anclaje poscuántico constantes sin invocar verificador ni proveedor criptográfico.  
**Acción en rama:** devolver `NOT_VERIFIED` o `NOT_CONFIGURED`, con razón explícita. No se declara soporte real de ML-KEM/ML-DSA, WORM ni BookPI hasta ejecutar implementación verificable.

### REG-01 — Veredicto global de cumplimiento no sustentado

**Severidad:** alta.  
**Evidencia:** `dynamic_compliance_shield` devolvía `COMPLIANT` y `highRiskControlsMet: true` sin identificar uso, jurisdicción, proveedor/desplegador, evaluación de impacto, evidencia o revisión jurídica.  
**Acción en rama:** `NOT_ASSESSED`; el handler declara que enumera marcos, pero no certifica conformidad.

### TWIN-01 — Sincronización ficticia

**Severidad:** media-alta.  
**Evidencia:** el skill territorial devolvía archivo sincronizado y anclaje BookPI constante sin conectar un proveedor real.  
**Acción en rama:** estado `NOT_CONFIGURED` y anclaje nulo.

### DATA-01 — Fuentes semilla con hashes no verificados

**Severidad:** alta para procedencia.  
**Evidencia:** algunas fuentes semilla contienen hashes con patrones de relleno o hashes que no se calcularon a partir del contenido remoto. Un hash con formato válido no prueba que el contenido haya sido recuperado ni que el URI sea autoritativo.  
**Acción recomendada:** retirar esas huellas de cualquier afirmación probatoria, usar estado `UNVERIFIED` hasta descargar el contenido y calcular SHA-256 sobre bytes exactos, registrar fecha, HTTP status, redirect final y política de retención. No se debe inventar un hash para llenar el campo.

### DOC-01 — Porcentajes sin calibración

**Severidad:** media.  
**Evidencia:** porcentajes como 86% de gobierno o 60% global no incluyen rúbrica, denominador, ponderación, test de aceptación ni evidencia de operación.  
**Acción recomendada:** presentarlos como estimaciones internas no auditadas o sustituirlos por una matriz de puertas de salida por etapa.

## 4. Estado por capas (evaluación cualitativa)

| Capa | Estado | Bloqueador para producción |
|---|---|---|
| Runtime TypeScript | Implementación presente | CI verde, API contract tests, despliegue repetible |
| CROWN / AEGIS | Implementación presente, parte heurística | pruebas adversariales, calibración y cobertura |
| Identidad / aprobación | Contratos y controles presentes | proveedor de identidad, scopes, revocación y pruebas de abuso |
| IKES / memoria | Núcleo local | persistencia real, retención, borrado, recuperación y backups |
| Inference adapters | Contratos/adaptadores | claves, timeouts, límites, evaluación de proveedor y fallback probado |
| Tools / Skills | Registries y handlers | catálogo real, permisos por tool, sandbox y receipts persistentes |
| VERITAS | Verificación determinista local | evaluación externa y verificación factual conectada a fuentes |
| BookPI / LITLE | componentes y contratos parciales | verifier real, llaves gestionadas, rotación, ledger durable y auditoría |
| Atlas | port/adaptador de persistencia | esquema SQL, RLS, integración real y restore drills |
| HSF | contratos y primitivas locales | gateway seguro, política por capacidad, persistencia/colas reales |
| PennyLane | puente HTTP opcional | servicio configurado, pruebas backend y gestión de fallos |
| Observabilidad | telemetría local/parcial | collector, alertas, SLO y retención |
| CI/CD | workflow presente | resultados verdes y deployment con rollback |
| Privacidad/legal | documentación en evolución | inventario de datos, DPIA/impact assessment y revisión jurídica |

## 5. Porcentajes: criterio honesto

No existe un porcentaje científico universal de “avance a producción”. Se recomienda sustituir una cifra global por dos índices de ingeniería separados:

- **Implementación de software:** porcentaje de requisitos definidos que tienen código + pruebas asociadas.
- **Preparación productiva:** porcentaje de puertas operativas demostradas (seguridad, CI, persistencia, observabilidad, backup/restore, despliegue, rollback, carga, incidentes y privacidad).

Mientras no haya un inventario versionado de requisitos y evidencias, cualquier porcentaje global —incluido 60% o 43%— debe etiquetarse **estimación orientativa, no medición auditada**. La revisión estática no justifica elevarlo.

## 6. Competencia y posicionamiento

Isabella compite principalmente en la categoría de **runtime/orquestación de agentes con gobernanza, políticas, evidencia y adaptadores**, no como LLM fundacional.

Familias comparables:

- LangGraph / LangChain: orquestación de aplicaciones y agentes.
- Microsoft Semantic Kernel / AutoGen: SDKs de agentes, herramientas y coordinación.
- OpenAI Agents SDK: orquestación de agentes y herramientas.
- CrewAI: coordinación de equipos de agentes.
- Haystack: pipelines de recuperación y aplicaciones RAG.
- NVIDIA NeMo Guardrails: controles y guardrails de interacción.
- Plataformas de workflow como Temporal: durabilidad de procesos, no sustituyen el runtime cognitivo.

No se establece un ranking global ni una superioridad técnica: eso exigiría benchmarks reproducibles, coste, latencia, robustez adversarial, adopción, despliegues independientes y comparativas con igual carga.

## 7. Marco regulatorio: orientación, no certificación

El sistema debe mantener un registro vivo de jurisdicción, caso de uso, roles legales, datos tratados, riesgos, controles, evidencia y responsable.

Marcos relevantes a evaluar según despliegue:

- Unión Europea: Reglamento (UE) 2024/1689 (AI Act), RGPD, NIS2 y normas sectoriales según aplique. El calendario del AI Act es escalonado y ha recibido cambios; verificar la fecha y texto consolidado antes de cada release.
- Estados Unidos: NIST AI RMF y Generative AI Profile como marcos voluntarios; obligaciones federales/estatales, privacidad, consumo, derechos civiles, seguridad y contratación según uso. No asumir una única ley federal integral de IA.
- México: LFPDPPP, LGPDPPSO cuando aplique a sujetos obligados, derechos de autor, consumidor, laboral, sectorial y obligaciones contractuales; seguir iniciativas legislativas de IA por separado y no tratarlas como leyes vigentes hasta su promulgación.
- Latinoamérica: revisión país por país (Brasil LGPD y marco de IA en evolución, Chile, Colombia, Perú, Argentina y otros); no extrapolar la ley de un país a toda la región.
- UNESCO: Recomendación sobre la Ética de la IA (2021), referencia ética internacional no equivalente a una certificación.
- ONU: Pacto Digital Global y procesos científicos/gobernanza internacional; orientan cooperación y derechos humanos, no sustituyen la ley local.
- WEF: informes, principios e iniciativas multi-actor; son orientación y no ley.
- ISO/IEC 42001 y 23894: sistemas de gestión y gestión de riesgos; certificación sólo mediante proceso formal de organismo competente.
- OECD: principios y marcos de políticas de IA; su fuerza jurídica depende del instrumento concreto.
- Convenio Marco del Consejo de Europa sobre IA y derechos humanos, democracia y Estado de derecho: evaluar aplicabilidad según ratificación, territorio y entrada en vigor.

## 8. Licencia y zonificación

El archivo `LICENSE` actual contiene licencia MIT. Eso permite a terceros usar, modificar y redistribuir el software bajo sus condiciones. Un README que diga “privado” no anula esa licencia sobre los archivos ya publicados bajo MIT.

Para una licencia híbrida real, separar claramente:

1. **Zona pública:** código expresamente publicado bajo MIT u otra licencia seleccionada, con avisos y SBOM.
2. **Zona interna propietaria:** código no publicado, con ACL de repositorio, acuerdos de confidencialidad y licencia propietaria redactada expresamente.
3. **Zona de datos críticos:** nunca tratar los datos como “protegidos por la licencia del código”; aplicar clasificación, cifrado, mínimo privilegio, retención, DLP, backups y contratos de tratamiento.
4. **Zona de proveedores externos:** respetar licencias, términos y límites de cada modelo, SDK, dataset y backend; el proyecto no puede relicenciar componentes ajenos.

La estrategia de dual licensing requiere inventario de titularidad y contribuciones, revisión de dependencias y asesoría jurídica. No se debe afirmar “propiedad exclusiva” sobre archivos que ya estén sujetos a MIT o a licencias de terceros.

## 9. Prioridades de remediación

P0:
- mantener la política HSF fail-closed;
- proteger el endpoint con autenticación real;
- eliminar salidas de verificación fabricadas;
- no declarar compliance automáticamente;
- CI verde en el commit exacto.

P1:
- hashes de fuentes calculados sobre bytes reales;
- schema validation para cada API;
- rate limiting, límites de payload y timeouts;
- gestión de secretos y rotación;
- tests de autorización negativa y fuzzing;
- persistencia, backups y restore drills.

P2:
- adaptadores reales de vector/grafo y workers durables;
- SLO p50/p95/p99 y alertas;
- benchmark reproducible contra frameworks comparables;
- evaluación de impacto, registro de datos y procedimientos de derechos.

## 10. Conclusión

GenesisAI tiene una base arquitectónica amplia y diferenciada en gobernanza y procedencia, pero su preparación productiva depende de cerrar los límites entre fixtures y verificaciones reales, conectar persistencia e identidad, y demostrar operación mediante CI y despliegue reproducible. La mejora más importante no es añadir más nombres o porcentajes: es que cada estado publicado sea verificable y que el sistema falle de forma segura cuando falte evidencia.


## Origen: `docs/ECOSYSTEM_EVOLUTION_AUDIT_2026-10-09.md`

# Auditoría de evolución del ecosistema Isabella — 9 de octubre de 2026

## Alcance

Se revisaron el repositorio canónico `Isabella-Villase-or-GenesisAI` y repositorios relacionados disponibles en la cuenta OsoPanda1, incluyendo `isabella-ai-tina`, `isabella-s-genesis-ai`, `isabella-ai-genesis-91037f85`, `isabella-s-crown`, `DOCUMENTACION-TAMV-DM-X4-e-ISABELLA-AI`, y resultados de búsqueda de `litle-trust-fabric`, `rdm-digital-hub` y `tamv-digital-nexus`.

El inventario identifica patrones y contratos documentados; no significa que todos los repositorios, despliegues, proveedores o datos externos estén conectados ni que cada afirmación de sus README haya sido validada en producción.

## Decisión arquitectónica

**Isabella Villaseñor GenesisAI permanece como el único runtime canónico.** Los repositorios relacionados se clasifican como fuentes de patrones, documentación, datos, módulos o adaptadores. No se introduce un runtime cognitivo paralelo.

## Activos reutilizables identificados

- **Seguridad y autoridad:** autorización server-side, separación de capacidad y permiso, fail-closed, revisión humana, protección de secretos y reducción de datos sensibles en logs.
- **IKES y procedencia:** estados epistemológicos explícitos, procedencia, temporalidad, hashes reproducibles y separación entre afirmación, fuente, corroboración y verificación.
- **Gobernanza de ingeniería:** manifests de evidencia, gates de calidad, validación de despliegue, reconciliación antes de release, observación de diffs en modo lectura y ciclo de vida que propone cambios sin ejecutarlos destructivamente.
- **Integridad científica:** cadenas de evidencia y certificados HMAC existentes; HMAC no es firma pública ni equivale a ML-DSA/Dilithium.
- **Infraestructura territorial:** contexto RDM/TAMV, Atlas como adaptador de persistencia y PennyLane como puente especializado opcional.

## Hallazgos críticos corregidos en esta rama

1. La sanitización podía devolver texto que contenía secretos después de marcar el documento como cuarentena. Ahora los hallazgos no exponen el fragmento secreto y el contenido de documentos en cuarentena se sustituye por un marcador.
2. Un documento sin licencia declarada o sin procedencia no se admite en el pipeline de conocimiento.
3. IKES rechazaba hashes con formato inválido, fechas no válidas, URI no permitidas y reutilización conflictiva del mismo ID de fuente. La ingesta calcula SHA-256 sobre el contenido aportado, no usa cadenas ficticias basadas en fecha.
4. Las rutas de mutación de memoria y admisión requieren token de servicio server-side. Los roles/principales del cliente no controlan el principal usado para HSF.
5. HSF ahora deniega por defecto sin metadatos internos de autenticación y admisión de gobernanza; la ruta API solo añade esos metadatos después de validar token y pasar el gate Genesis.
6. El pipeline IKES no libera una entrada sin claim, evidencia, auditoría, commit Git válido e índice confirmado. El runtime actual no tiene índice durable conectado, por lo que la admisión permanece bloqueada en lugar de fingir que el documento ya fue indexado.
7. Se retiraron respuestas ficticias de integridad BookPI, ML-DSA/HSM, RLS, firma, sincronización del gemelo digital, arbitraje epistemológico, evaluación de cumplimiento, pruebas formales, telemetría y readiness canary. Sin adaptador o evaluación real, la respuesta es `NOT_CONFIGURED`, `NOT_VERIFIED`, `NOT_ASSESSED` o `SIMULATED`.

## Interoperabilidad y licencias

| Repositorio consultado | Evidencia observada | Decisión para GenesisAI |
|---|---|---|
| [isabella-ai-tina](https://github.com/OsoPanda1/isabella-ai-tina) | Su `LICENSE` describe código bajo Apache-2.0 e ISC sujeto a un pacto soberano, activos propietarios/marca bajo CC BY-NC-ND 4.0 y documentación bajo CC BY 4.0. | Reutilizar patrones y especificaciones con atribución; no copiar algoritmos, marca, prompts o activos propietarios sin análisis de derechos y autorización. |
| [litle-trust-fabric](https://github.com/OsoPanda1/litle-trust-fabric) | El README lo marca preproducción. `src/lib/litle/pqc.ts` declara explícitamente que `SimulatedPqcProvider` es una simulación basada en SHAKE256/HMAC y **no** ML-DSA-87 real. No se encontró un archivo raíz `LICENSE` en la ruta comprobada. | No importar el proveedor como criptografía real; reutilizar el contrato de estado/no-simulaciones como patrón. No copiar código hasta aclarar licencia. |
| [litle-atlas-suite](https://github.com/OsoPanda1/litle-atlas-suite) | README describe un estándar propuesto; no se encontró un archivo raíz `LICENSE` en la ruta comprobada. | Usar conceptos documentados; código no copiado por licencia no aclarada. |
| [rdm-digital-hub](https://github.com/OsoPanda1/rdm-digital-hub) | README muestra una insignia “CROWN Sovereign”, pero su sección de licencia dice que la licencia aplicable debe estar definida en `LICENSE`; no se encontró ese archivo raíz en la ruta comprobada. | No tratar la insignia como licencia efectiva ni importar código hasta que la licencia sea publicada y revisada. |
| [tamv-documentacion](https://github.com/OsoPanda1/tamv-documentacion) | El archivo `LICENSE` recuperado es GPL-3.0. | No copiar código a la distribución MIT de GenesisAI sin una decisión explícita de compatibilidad/dual-licencia. La documentación factual puede inspirar interfaces sin reutilizar expresión protegida. |
| [isabella-s-genesis-ai](https://github.com/OsoPanda1/isabella-s-genesis-ai) | README afirma que la instancia Supabase consultada expone cero tablas y prohíbe presentar datos simulados como reales. No se encontró un archivo raíz `LICENSE` en la ruta comprobada. | Reutilizar el principio “sin mockdata operativo”; no copiar código sin licencia clara. |
| [isabella-villasenor-ai](https://github.com/OsoPanda1/isabella-villasenor-ai) y [isabella-s-crown](https://github.com/OsoPanda1/isabella-s-crown) | README identifica scaffolds de Next.js/v0 y Lovable; no se encontró archivo raíz `LICENSE` en las rutas comprobadas. | Tratar como prototipos/UI de referencia, no como runtime cognitivo canónico ni código portable automáticamente. |
| [isabella-villasenor-agent](https://github.com/OsoPanda1/isabella-villasenor-agent) | Scaffold de agente Vercel Eve; no se encontró archivo raíz `LICENSE` en la ruta comprobada. | Puede orientar un adaptador futuro; no se crea un runtime paralelo y no se copia código sin licencia. |

El repositorio canónico declara MIT en `LICENSE`. El repositorio `isabella-ai-tina` declara un marco híbrido con condiciones diferenciadas para código, documentación, marca y componentes propietarios. Por esa razón, esta evolución reutiliza patrones de arquitectura y especificaciones, pero no copia automáticamente código o activos de aquel repositorio dentro de la distribución MIT. Antes de portar archivos, hay que verificar licencia del archivo, dependencias, derechos sobre marca/datos y procedencia.

Una arquitectura híbrida futura debe separar al menos:
- código fuente con licencia explícita;
- documentación y esquemas;
- marca, personalidad y assets;
- secretos, datos personales y datos territoriales restringidos;
- componentes propietarios/privados y adaptadores publicados.

La licencia de software no otorga por sí sola autorización para procesar datos personales ni certifica cumplimiento jurídico.

## Controles adicionales de exposición pública

- Las propuestas de conocimiento públicas se almacenan en una cola volátil limitada y no ingresan a IKES. La admisión canónica requiere token administrativo, contenido aportado, licencia y procedencia.
- Los endpoints públicos tienen límites de frecuencia locales por proceso. En producción debe añadirse rate limiting de borde y una estrategia distribuida.
- La generación de guías usa plantillas locales; el endpoint de audio devuelve un guion, no un archivo de audio ni una integración con NotebookLM.

## Límites de esta auditoría

- No se ha acreditado despliegue productivo ni cumplimiento normativo.
- Los URLs de fuentes suministrados a las rutas de ingesta son metadatos: el servidor no descarga ni verifica el contenido remoto. La respuesta lo etiqueta como `USER_SUPPLIED_CONTENT_HASHED_NOT_REMOTE_VERIFIED`.
- El hash prueba integridad de los bytes que se hashean, no autenticidad del autor, verdad de la afirmación ni propiedad de la identidad.
- No se afirma que exista un QPU, HSM, motor OPA, RLS productivo, índice durable o ledger WORM operativo sin adaptador y evidencia.
- No se afirma CI verde hasta revisar los checks del SHA exacto después de estos cambios.

## Validación requerida

Ejecutar en la rama y registrar el resultado del commit final:

```bash
npm run typecheck
npm test
npm run build
```

La aceptación requiere además revisar la autenticación negativa de HSF y las rutas de escritura, verificar que los secretos no aparecen en salidas de sanitización, y confirmar que los estados no configurados no se muestran como verificaciones exitosas.


## Segunda pasada de auditoría e implementación — 9 de octubre de 2026

### Hallazgos adicionales corregidos en la rama

1. **Gates de despliegue:** cualquier gate requerido distinto de `passed`, incluido `skipped` en build, tests, smoke, auth/RLS, health o canary, ahora bloquea `assessDeployment`. Antes, un gate no crítico omitido podía no convertirse en blocker.
2. **Lock y sincronización:** `Lock.acquire(timeout)` ahora tiene timeout real y elimina los waiters expirados; el handoff conserva el propietario del lock, y liberar con un propietario incorrecto falla. Se corrigieron también la transferencia de permisos del semáforo, la recuperación de barrera tras timeout y la limpieza de waiters de Condition/Event.
3. **Scopes y reconciliación:** los scopes de tenant/workspace/servicio usan componentes prefijados por longitud para evitar colisiones por separadores. La reconciliación Git/índice/BookPI ya rechaza marcas vacías. La revocación de ManagerToken invalida copias previas dentro del proceso; sigue siendo volátil y no sustituye un servicio de tokens persistente.
4. **LSP:** abrir o guardar un archivo ya no produce por sí solo `FRESH_NO_DIAGNOSTICS`. Hasta recibir diagnósticos del servidor LSP para la versión correspondiente, el resultado es `NO_FRESH_DATA / INCONCLUSIVE`.
5. **Ciclo de vida:** el planificador transporta título/cuerpo o una señal explícita de sensibilidad. Los issues sensibles no se incluyen en planes de cierre automático y se elevan al gate humano.
6. **IKES:** la liberación exige un ID de auditoría BookPI no vacío además de sanitización, identidad, claims, evidencia, política, commit e índice. Se agregó una prueba para la ausencia de audit IDs.
7. **HSF y conocimiento:** los descriptors registrados quedan congelados; memoria e ingesta devuelven copias separadas del estado interno. `KnowledgeFabric` crea entradas `PENDING_REVIEW`, no `accepted`, porque esta clase no ejecuta por sí misma validación de licencia, procedencia ni admisión canónica. El consenso incorpora ratio de acuerdo y etiqueta su puntuación como heurística; la puntuación de evidencia ya no usa niveles `VERY_HIGH/HIGH` que pudieran confundirse con probabilidad o verdad.
8. **Memoria y privacidad HTTP:** `/api/v1/memory` y el detalle administrativo de BookPI requieren `GENESIS_ADMIN_API_TOKEN`; la cola de propuestas está conectada a `MemoryProposalQueue` y permite únicamente rechazar o pedir evidencia. La ruta pública BookPI conserva la telemetría necesaria para el panel, pero redacta la identidad del principal. `/api/v1/hsf/status` publica metadatos de tareas, no sus payloads.
9. **Veracidad de los gates HTTP:** las rutas de quality/deployment ya no presentan las afirmaciones booleanas enviadas por un cliente como pruebas ejecutadas. La ruta del verificador de aplicaciones responde `NOT_INDEPENDENTLY_VERIFIED` porque no descarga ni ejecuta el repositorio. La ruta de diff declara que procesa un snapshot aportado por el cliente y no lee el filesystem del servidor.
10. **Licencias:** la admisión automática queda limitada a MIT, Apache-2.0, BSD-2-Clause, BSD-3-Clause, ISC, Unlicense y CC0-1.0. CC-BY-4.0 requiere revisión porque el esquema no conserva todavía un manifiesto completo de atribución; MPL, GPL/AGPL, share-alike, NC y ND también requieren revisión explícita.
11. **XSS en el panel:** los valores dinámicos de BookPI y de los bloques de gobernanza se escapan antes de insertarse en `innerHTML`. Los follow-ups ya no interpolan el texto dentro del código JavaScript del atributo `onclick`; se transportan como atributo de datos escapado.

### Inventario técnico priorizado de repositorios relacionados

Este inventario es una auditoría priorizada de los repositorios directamente relacionados con Isabella, GenesisAI, IKES/LITLE, Atlas y TAMV. No equivale a una inspección línea por línea de cada uno de los repositorios existentes en la cuenta.

| Repositorio | Evidencia comprobada | Decisión de integración |
|---|---|---|
| [isabella-ai-tina](https://github.com/OsoPanda1/isabella-ai-tina) | `package.json` válido; Node 24, Vite, TypeScript, Vitest, Prisma, scripts de auditoría y gates. Su `LICENSE` aplica condiciones diferentes a código, núcleo propietario/marca y documentación. | Reutilizar contratos y patrones tras revisar la licencia del archivo concreto. No copiar automáticamente algoritmos, marca, prompts o assets propietarios a la distribución MIT. |
| [isabella-s-genesis-ai](https://github.com/OsoPanda1/isabella-s-genesis-ai) | README declara Supabase con 0 tablas y un 72% de avance, pero ese porcentaje es una declaración documental no validada. El `package.json` consultado no expone scripts `test` ni `typecheck`. No se encontró `LICENSE` en la raíz consultada. | Referencia de UI/flujo; no es runtime canónico ni fuente de un porcentaje de producción verificado. No copiar código hasta aclarar licencia. |
| [isabella-ai-genesis-91037f85](https://github.com/OsoPanda1/isabella-ai-genesis-91037f85) | Contiene scripts de typecheck, tests, build y seguridad. Su `LICENSE` también establece licencias híbridas por clase de activo. | Extraer requisitos y patrones con revisión de licencia por archivo; no importar otra instancia de runtime. |
| [isabella-villasenor-ai](https://github.com/OsoPanda1/isabella-villasenor-ai) | README lo identifica como scaffold Next.js/v0. No se encontró `LICENSE` en la raíz. El script `core:check` solo verifica que dos rutas existan, no que el núcleo funcione. | Prototipo de interfaz; el check de existencia no se considera prueba funcional. |
| [isabella-s-crown](https://github.com/OsoPanda1/isabella-s-crown) | Repositorio público de referencia de CROWN; no se encontró `LICENSE` en la raíz consultada. | Referencia de arquitectura; no importar código sin licencia. |
| [litle-trust-fabric](https://github.com/OsoPanda1/litle-trust-fabric) | El README describe un tejido de confianza. El código revisado documenta un proveedor PQC simulado basado en SHAKE256/HMAC; no demuestra implementación de ML-DSA real. No se encontró `LICENSE` raíz. | Reutilizar el contrato de simulación/estado, no presentarlo como criptografía poscuántica estandarizada ni copiar código sin licencia. |
| [litle-atlas-suite](https://github.com/OsoPanda1/litle-atlas-suite) | README especifica un estándar de preservación/certificación, pero las afirmaciones de DAC, quorum y dimensiones no son por sí solas evidencia de una implementación desplegada. No se encontró `LICENSE` raíz. | Usar especificaciones como requisitos candidatos; mantener certificados, autoría y verificación como estados separados. |
| [tamv-atlas](https://github.com/OsoPanda1/tamv-atlas) | `package.json` válido con scripts de test/typecheck/build y backend. No se encontró `LICENSE` raíz. El README describe endpoints e importación federada que aún requieren comprobación de ejecución. | Candidato a adaptador de infraestructura, no runtime paralelo. No copiar código sin licencia y pruebas reproducibles. |
| [tamv-digital-nexus](https://github.com/OsoPanda1/tamv-digital-nexus) | **`package.json` no parsea como JSON**: error en línea 35, columna 5; falta una coma tras `linear:sync:apply` y existe una clave duplicada `linear:sync:payload`. Los scripts `check:docs-sync` y `audit:economy` son comandos `echo` de marcador de posición. El README también documenta bloqueos de instalación/build por dependencias. No se encontró `LICENSE` raíz. | Bloqueador de integración hasta reparar el manifiesto, validar dependencias y ejecutar CI. No importar ni depender de sus scripts declarados como si fueran controles funcionales. |
| [tamv-documentacion](https://github.com/OsoPanda1/tamv-documentacion) | `LICENSE` raíz GPL-3.0. | No incorporar código a la distribución MIT sin una decisión explícita de compatibilidad/dual-licencia. |
| [isabella-villasenor-agent](https://github.com/OsoPanda1/isabella-villasenor-agent) | Scaffold de agente; no se encontró `LICENSE` raíz. | Posible referencia para un adaptador, no una nueva instancia de Isabella. |
| [quantum-system-tamv](https://github.com/OsoPanda1/quantum-system-tamv) | No se encontró `README.md` ni `package.json` en la raíz consultada. | Sin evidencia suficiente para integrarlo; queda fuera de la ruta de producción. |

### Contrato de integración entre repositorios

Ningún repositorio externo se considera integrado hasta que exista, en GenesisAI, un adaptador con contrato tipado, tests, política de autorización, procedencia de código/datos, tratamiento de errores, límites de timeout, telemetría sin secretos y un gate de release. Un README, badge, porcentaje de avance o API descrita no demuestra que el servicio esté disponible.

Los repositorios sin licencia raíz identificable quedan en estado **referencia documental únicamente** hasta aclarar derechos. Los repositorios con licencia híbrida requieren evaluación por archivo, no solo por nombre de repositorio. La arquitectura mantiene un único runtime canónico y prohíbe la duplicación de los motores de decisión, autoridad, memoria y ejecución.

### Validación de esta actualización

Los cambios y pruebas unitarias adicionales se han escrito en la rama `feature/canonical-libraries-governance` del PR #14. No se declara que typecheck, tests o build hayan pasado: el conector no devolvió runs ni status checks asociados a los últimos commits consultados. La aceptación final exige ejecutar sobre el SHA más reciente:

```bash
npm run typecheck
npm test
npm run build
```

No fusionar hasta revisar los resultados reales del SHA final y resolver cualquier fallo.

## Tercera pasada: integridad, autoridad y admisión — 9 de octubre de 2026

### Correcciones adicionales registradas en la rama

1. **Identidad de artefactos y derechos:** la huella usada para preservar documentos incorpora contenido, formato/codificación declarados, licencia y procedencia estable. Coincidencias de huellas estructurales/semánticas no se consideran prueba de duplicado verificado. El borrado automático se restringe a artefactos idénticos según esa identidad ampliada.
2. **IKES monotónico:** el identificador de claim ya no depende del paquete de evidencia; una nueva fuente revisa la misma afirmación. Se impide la corroboración con evidencia repetida, se bloquea corroborar estados disputados/rechazados/deprecados, y la re-propuesta no rebaja el estado epistemológico. El hash de contenido usa un contrato único y puede recalcularse.
3. **Separación preparación/commit:** prepareProposal construye una propuesta sin insertarla en la memoria canónica. /api/v1/knowledge/admit usa preparación y no confirma el claim si el pipeline no libera. La ruta mantiene policyGateGranted=false mientras no exista un motor de política independiente conectado; por tanto, la admisión canónica sigue bloqueada y debe declararse como tal.
4. **Aprobación humana con ancla de confianza:** el verificador ya no confía en la clave pública que viene dentro del objeto de aprobación. Exige ISABELLA_APPROVAL_TRUSTED_KEY_ID, ISABELLA_APPROVAL_TRUSTED_PUBLIC_KEY_PEM e ISABELLA_APPROVAL_TRUSTED_APPROVER_ID, y la emisión exige rol admin o approver. La configuración de producción debe aprovisionarse fuera del repositorio; claves efímeras solo se generan en pruebas.
5. **Evidencia de evolución:** el digest de un registro puede recalcularse, pero ese digest por sí solo no autentica su origen. La promoción a verified exige un verificador externo inyectado; sin él, una evidencia autoemitida con passed=true no eleva el estado.
6. **Transparencia de archivos:** la cadena literal human_approved no prueba una aprobación real. Un archivo declarado stable permanece en draft hasta que una autoridad verificadora valide la declaración de aprobación.
7. **Manifests:** el ID usa SHA-256 completo (64 hex), cubre los campos materiales de evidencia y la completitud exige claims, fuentes y IDs de auditoría BookPI. La excepción de estabilidad requiere verificación externa; no se admite un booleano de autorización.
8. **Concurrencia/LSP:** Lock.release() exige el identificador del propietario. El adaptador LSP rechaza diagnósticos de una versión futura, evitando elevar un archivo a limpio con diagnósticos que no corresponden al contenido abierto.

### Estado de verificación y bloqueadores que permanecen

- Los cambios de código y pruebas están escritos en feature/canonical-libraries-governance; no se ha ejecutado localmente npm run typecheck, npm test ni npm run build desde esta sesión.
- El conector de GitHub no devolvió status checks ni workflow runs para los SHA consultados. No se afirma CI verde.
- PR #14 sigue divergente de main (18 commits detrás en la última comparación consultada) y GitHub informó mergeable=false. No fusionar ni forzar una actualización de la rama sin resolver los conflictos y revisar los archivos que cambiaron en ambos lados.
- El verificador externo de evidencias, el motor de política de admisión, el índice durable, el almacenamiento persistente BookPI y la verificación remota de fuentes siguen sin estar conectados. Los controles deben permanecer en estado no verificado/bloqueado hasta que se integren.
- La configuración de confianza de aprobaciones debe provisionarse en el entorno de despliegue y validarse con pruebas negativas. La configuración test-only no es una configuración productiva.
