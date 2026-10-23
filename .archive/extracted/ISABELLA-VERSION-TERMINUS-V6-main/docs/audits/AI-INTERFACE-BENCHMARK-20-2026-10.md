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
