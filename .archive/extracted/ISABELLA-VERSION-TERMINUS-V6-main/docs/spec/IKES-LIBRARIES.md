# Librerías de Isabella — Descripción conceptual, académica y técnica

**Contexto:** documento general para explicar qué son las librerías canónicas de Isabella, qué hacen, qué no hacen, para qué sirven, por qué fueron creadas y cómo se diferencian de bibliotecas, APIs y plataformas comerciales de IA.

**Estado:** stable como documento explicativo; no constituye certificación de capacidades de producción.

**Dependencias:** README maestro, IKES, sanitización, sincronización, validación LSP, Git Governance, BookPI, CROWN, SOPHIA, ARGUS, ORION, MNEMOS y documentación histórica TAMV.

**Versión:** 1.0.0

---

## 1. Resumen ejecutivo

Las librerías canónicas de Isabella no son simplemente una colección de archivos, ni un modelo de lenguaje, ni una copia de ChatGPT, Gemini o Claude. Son una **infraestructura externa y gobernada para organizar, preservar, evaluar, versionar y recuperar conocimiento**, junto con los módulos técnicos necesarios para controlar cómo ese conocimiento entra, cambia, se valida, se audita y se utiliza.

Su centro arquitectónico es IKES — **Isabella Knowledge Evolution System** — que convierte documentos, fuentes, claims, evidencias y versiones temporales en un corpus trazable.

La idea central puede expresarse así:

> **Isabella puede proponer conocimiento; la biblioteca, las reglas, la evidencia y la aprobación determinan qué puede convertirse en conocimiento canónico.**

Las librerías no reemplazan al modelo de IA. Lo complementan proporcionando contexto, memoria externa, proveniencia, historial, controles de seguridad y un proceso de evolución verificable.

---

## 2. ¿Qué son las librerías de Isabella?

En sentido técnico, son un conjunto organizado de repositorios, esquemas, índices, manifests, políticas, validadores y servicios que permiten gestionar conocimiento externo a los pesos del modelo.

Incluyen varias capas:

```text
Fuentes y documentos
        ↓
Sanitización y seguridad
        ↓
Identidad documental
        ↓
Entidades y claims
        ↓
Evidencia y provenance
        ↓
Estado epistemológico
        ↓
Temporalidad y versionado
        ↓
Git y auditoría BookPI
        ↓
Índices de recuperación
        ↓
Isabella responde con contexto
```

Una entrada no es solamente un PDF o un fragmento de texto. Puede incluir:

- identidad de la entidad;
- documento fuente;
- afirmaciones extraídas;
- autores y publicaciones;
- DOI, ORCID o URL cuando corresponda;
- nivel de evidencia;
- fuentes que corroboran;
- fuentes que contradicen;
- método de verificación;
- vigencia temporal;
- estado epistemológico;
- licencia;
- provenance;
- auditoría;
- commit Git;
- versión de la entrada.

---

## 3. Dimensión conceptual y filosófica

### 3.1 Memoria no es verdad

Una memoria puede conservar información, pero conservarla no la convierte automáticamente en verdadera. Por eso las librerías separan:

```text
lo encontrado
lo documentado
lo corroborado
lo reproducible
lo validado
lo establecido
```

Esta separación busca que Isabella no diga simplemente "esto es verdad", sino que pueda comunicar cómo se conoce algo, qué evidencia existe, qué incertidumbres permanecen y cuándo una afirmación dejó de ser vigente.

### 3.2 La información tiene historia

Una afirmación antigua no necesariamente es falsa. Puede haber sido correcta en un periodo y luego quedar superada por una actualización.

Ejemplo:

```text
2024: Programa X soporta 12 idiomas.
2026: Programa X soporta 47 idiomas.
```

La biblioteca conserva ambos estados:

```text
12 idiomas → historical / superseded
47 idiomas → current
```

Esto permite responder correctamente:

- "¿Cuántos idiomas soporta actualmente?"
- "¿Cuántos soportaba en 2024?"

### 3.3 La IA no debe convertirse en su propia fuente de verdad

Una arquitectura insegura permitiría que Isabella generara una afirmación, la guardara como verdad y posteriormente la recuperara como evidencia de sí misma.

Las librerías evitan ese ciclo mediante:

- separación entre propuesta y admisión;
- fuentes externas identificables;
- evidencia independiente;
- estados epistemológicos;
- revisión humana o de política;
- Git y BookPI;
- prohibición de auto-validación.

### 3.4 Preservar antes que borrar

La regla de conservación es:

> **Ante la duda, conservar, clasificar, vincular y versionar.**

El sistema no debe eliminar un documento porque tenga el mismo título o alta similitud con otro. Primero debe decidir si se trata de:

- duplicado exacto;
- duplicado verificado;
- actualización;
- enriquecimiento;
- corrección;
- nueva evidencia;
- conocimiento nuevo;
- contradicción.

---

## 4. Dimensión académica

Las librerías se inspiran en varias áreas académicas y técnicas:

### 4.1 Gestión del conocimiento

Organizan conceptos, definiciones, relaciones, procedimientos, reglas y especificaciones en lugar de almacenar solamente texto no estructurado.

### 4.2 Sistemas de recuperación de información

Utilizan recuperación semántica, metadatos, filtros temporales, búsqueda híbrida y, cuando corresponda, grafos de evidencia.

### 4.3 Epistemología aplicada

Representan el grado y tipo de respaldo de una afirmación:

```text
E0 UNVERIFIED
E1 SOURCE_FOUND
E2 CORROBORATED
E3 ACADEMICALLY_SUPPORTED
E4 EMPIRICALLY_REPRODUCIBLE
E5 VALIDATED
E6 ESTABLISHED
ED DISPUTED
EX REJECTED
DP DEPRECATED
```

Estos niveles no pretenden convertir una puntuación automática en verdad absoluta. Sirven para expresar incertidumbre, calidad y límites.

### 4.4 Ciencia abierta y reproducibilidad

Las librerías pueden dar preferencia a publicaciones abiertas, datasets abiertos, código inspeccionable, metodologías documentadas y experimentos reproducibles. Sin embargo:

```text
Open Science ≠ verdad automática
Open Source ≠ corrección automática
DOI/ORCID ≠ validación automática
```

### 4.5 Ingeniería de software y sistemas distribuidos

La arquitectura incorpora versionado Git, control de concurrencia, validación LSP, managers, proxies, locks, semáforos, auditoría, CI/CD y manifests de evidencia.

---

## 5. Dimensión técnica

### 5.1 Componentes principales

| Componente | Función |
|---|---|
| Ingestion | Adquirir documentos, fuentes y cambios |
| Sanitization | Hacer el material seguro y procesable |
| Identity Layer | Identificar documentos, entidades y artefactos |
| Claim Engine | Extraer y comparar afirmaciones |
| Evidence Graph | Relacionar claims, fuentes, experimentos y contradicciones |
| Epistemic Engine | Evaluar evidencia y estado |
| Temporal Layer | Gestionar vigencia histórica y actual |
| Synchronization | Coordinar trabajos simultáneos |
| LSP Adapter | Validar técnicamente código/documentos |
| Git Governance | Versionar, revisar y controlar cambios |
| BookPI | Auditar operaciones y provenance |
| Retrieval Index | Recuperar conocimiento relevante |
| Policy Gate | Aplicar reglas de admisión |

### 5.2 Sanitización

El flujo es:

```text
raw document
→ file safety
→ format validation
→ encoding normalization
→ metadata/content extraction
→ PII/secret detection
→ license check
→ language detection
→ classification
→ fingerprints
```

La sanitización debe hacer el archivo seguro, legible y clasificable sin alterar su significado.

### 5.3 Identidad y deduplicación

Se utilizan tres niveles:

- **Hash físico:** ¿es exactamente el mismo archivo?
- **Fingerprint estructural:** ¿es esencialmente el mismo documento?
- **Fingerprint semántico y claims:** ¿habla de la misma entidad y qué cambió?

La similitud textual no puede ser la única decisión.

### 5.4 Temporalidad

El retrieval debe interpretar la intención de la pregunta:

```text
actualmente → current
históricamente → historical
anteriormente → superseded / historical
```

El índice no debe recuperar información antigua como actual solo porque fue indexada primero.

### 5.5 Validación técnica LSP

Para documentos técnicos y código, Isabella puede utilizar clientes LSP asíncronos que devuelven diagnósticos frescos ligados a versiones concretas.

```text
didOpen → version 0
didChange → version + 1
```

Un timeout no significa que el archivo esté limpio. Los estados son:

```text
FRESH_NO_DIAGNOSTICS
FRESH_WITH_DIAGNOSTICS
NO_FRESH_DATA
```

### 5.6 Sincronización y managers

La infraestructura usa primitivas de coordinación para evitar carreras:

- `Lock` y `RLock`;
- `Semaphore` y `BoundedSemaphore`;
- `Condition`;
- `Event`;
- `Barrier`;
- managers y proxies con scopes y tokens.

La regla es:

> **Analizar en paralelo; decidir por entidad; publicar solo después de reconciliación.**

---

## 6. ¿Qué hacen?

Las librerías de Isabella pueden:

1. Recibir documentos, fuentes, datasets y especificaciones.
2. Detectar archivos inseguros, secretos y PII según política.
3. Normalizar formatos sin alterar el significado.
4. Calcular hashes y fingerprints.
5. Detectar duplicados exactos y distinguirlos de actualizaciones.
6. Identificar entidades persistentes a través de varios documentos.
7. Extraer claims.
8. Vincular claims con fuentes y evidencias.
9. Registrar corroboraciones y contradicciones.
10. Mantener estados históricos y actuales.
11. Conservar documentos antiguos sin confundirlos con información vigente.
12. Versionar cambios mediante Git.
13. Registrar provenance y auditoría en BookPI.
14. Validar técnicamente código mediante LSP.
15. Aplicar políticas de admisión.
16. Generar propuestas de conocimiento.
17. Indexar conocimiento aceptado para retrieval.
18. Recuperar evidencia según dominio, vigencia y nivel de confianza.
19. Crear manifests reproducibles.
20. Permitir revisión humana y rollback.

---

## 7. ¿Qué no hacen?

Las librerías no:

- convierten automáticamente una afirmación en verdad;
- reemplazan a un modelo de lenguaje;
- sustituyen una revisión científica o legal;
- garantizan que toda fuente sea correcta;
- hacen que DOI u ORCID prueben una afirmación;
- convierten Open Source en software correcto;
- convierten Open Science en ciencia verdadera;
- eliminan automáticamente documentos similares;
- deben sobrescribir el historial sin dejar versión;
- son una conciencia artificial;
- son AGI por sí mismas;
- constituyen entrenamiento automático del modelo;
- garantizan ausencia de alucinaciones;
- garantizan inmunidad contra prompt injection;
- sustituyen controles de seguridad;
- son por sí solas una base financiera o bancaria;
- certifican cumplimiento jurídico universal;
- convierten un diagnóstico LSP limpio en verdad epistemológica;
- garantizan producción solo porque exista código;
- deben ejecutar acciones destructivas sin autorización.

---

## 8. ¿Para qué sirven?

### 8.1 Para Isabella

Le proporcionan memoria externa persistente, recuperable y versionada sin tener que reentrenar el modelo ante cada cambio documental.

### 8.2 Para investigadores

Permiten revisar de dónde salió una afirmación, qué fuentes la respaldan, qué contradicciones existen y qué versión del corpus se utilizó.

### 8.3 Para desarrolladores

Ofrecen contratos, validadores, manifests, pruebas, LSP, Git Governance y controles de integración.

### 8.4 Para organizaciones

Permiten controlar conocimiento interno, vigencia, permisos, auditoría, licencias y trazabilidad sin depender únicamente de una conversación con un modelo.

### 8.5 Para comunidades y territorio

Permiten preservar conocimiento local y contextual sin que desaparezca en sistemas centralizados o se mezcle sin procedencia con información externa.

---

## 9. ¿Por qué fueron creadas?

Las librerías nacen para resolver problemas que aparecen cuando una IA trabaja con conocimiento que cambia:

1. La información se actualiza y no puede depender únicamente de los pesos del modelo.
2. Los documentos similares no siempre son duplicados.
3. La información histórica puede seguir siendo válida.
4. Las respuestas necesitan provenance.
5. Las fuentes pueden contradecirse.
6. Los índices RAG pueden recuperar información vieja.
7. Una IA puede auto-reforzar una alucinación si escribe directamente en su memoria.
8. Los cambios concurrentes pueden provocar pérdida o corrupción.
9. Los sistemas generados rápidamente pueden mezclar prototipo y producción.
10. La infraestructura necesita distinguir capacidad implementada de promesa.
11. Las comunidades necesitan preservar conocimiento propio con trazabilidad.
12. Las aplicaciones deben poder auditar qué ocurrió, cuándo y bajo qué política.

En una frase:

> **Fueron creadas para que Isabella tenga memoria externa sin perder contexto, historial, incertidumbre, gobernanza ni responsabilidad humana.**

---

## 10. Diferencia frente a plataformas comerciales de IA

Es importante establecer una distinción: las librerías de Isabella no compiten directamente con ChatGPT, Gemini o Claude como modelos fundacionales generales. Compararlas como si fueran productos del mismo tipo sería una categoría incorrecta.

### 10.1 Diferencia de categoría

| Dimensión | Librerías de Isabella | Plataformas comerciales de IA |
|---|---|---|
| Objeto principal | Infraestructura de conocimiento gobernado | Servicio de IA, modelo, asistente o plataforma |
| Modelo fundacional | Puede usar modelos externos o locales | Proporcionan o integran modelos propios/externos |
| Memoria | Repositorios versionados, claims y evidencia | Memoria contextual, proyectos, archivos o bases propietarias según producto |
| Fuente canónica | Git, manifests, provenance y políticas propias | Infraestructura y políticas del proveedor |
| Evolución | Versionado semántico y temporal explícito | Actualizaciones del producto, índice o modelo según proveedor |
| Verificación | Claims, evidence graph, estado epistemológico y revisión | Citas, controles internos y políticas específicas del servicio |
| Portabilidad | Diseñada para repositorios y componentes interoperables | Depende de exportación, API y términos del proveedor |
| Gobernanza | Configurable por proyecto, organización y comunidad | Gobernanza principal del proveedor y del plan contratado |
| Operación | Puede diseñarse local, híbrida o federada | Normalmente servicio administrado, aunque algunas ofrecen opciones locales/API |
| Autoridad sobre datos | El proyecto define la fuente canónica | El proveedor controla gran parte del servicio y plataforma |
| Estado histórico | Parte explícita del modelo | Puede existir, pero no es necesariamente el núcleo epistemológico |
| Deduplicación | No elimina por similitud semántica solamente | Depende de implementación del producto |
| Auditoría | BookPI, Git, commits y manifests | Logs y mecanismos de auditoría del proveedor |

### 10.2 ChatGPT

ChatGPT es una plataforma de interacción y asistencia basada en modelos de OpenAI y herramientas asociadas. Puede trabajar con archivos, instrucciones, proyectos, herramientas y recuperación según el producto y configuración.

La diferencia de Isabella no consiste en afirmar que ChatGPT no tenga memoria, retrieval o herramientas. La diferencia es que las librerías de Isabella se diseñan alrededor de un corpus canónico externo, versionado, epistemológico y temporal, cuya evolución se quiere gobernar explícitamente.

### 10.3 Gemini

Gemini es una familia y plataforma de IA de Google con integración multimodal y ecosistema de servicios. Puede conectarse a información y herramientas según su producto y permisos.

Isabella se diferencia en que su biblioteca intenta hacer explícitas las relaciones entre claim, fuente, evidencia, contradicción, vigencia y commit, en lugar de tratar la recuperación únicamente como contexto para generar una respuesta.

### 10.4 Claude

Claude es una familia y plataforma de Anthropic orientada a conversación, razonamiento, análisis y uso de herramientas según el producto. Puede trabajar con proyectos, archivos y capacidades de desarrollo.

La diferencia de IKES no es que Claude carezca de organización contextual. Es que IKES pretende ser una capa independiente y portable de evolución del conocimiento, capaz de funcionar con distintos modelos y mantener la autoridad canónica fuera de los pesos de cualquiera de ellos.

### 10.5 Conclusión de la comparación

Las plataformas comerciales suelen responder a:

```text
usuario → plataforma → modelo → respuesta
```

IKES intenta organizar:

```text
fuente → claim → evidencia → política → versión → retrieval → respuesta auditada
```

Puede conectarse a un modelo comercial, local o híbrido. El modelo es un componente intercambiable; el repositorio canónico y sus reglas conservan la identidad del conocimiento.

---

## 11. Diferencia frente a una carpeta de documentos

Una carpeta convencional sería:

```text
filosofia.pdf
manual.pdf
historia.docx
datos.json
```

Una biblioteca IKES añade:

```text
entidad
  ├── documentos
  ├── claims
  ├── fuentes
  ├── evidencias
  ├── contradicciones
  ├── vigencia temporal
  ├── versión
  ├── provenance
  ├── auditoría
  └── estado epistemológico
```

La diferencia no es únicamente almacenar más archivos. Es representar relaciones, evolución, incertidumbre y trazabilidad.

---

## 12. Arquitectura de autoridad

```text
Modelo
  → propone o genera

SOPHIA
  → evalúa evidencia

CROWN
  → aplica política

ARGUS
  → detecta riesgo y veto

BookPI
  → registra

Git
  → versiona

Índice
  → recupera

Humano/política
  → aprueba cuando corresponde
```

Ningún componente aislado debe convertirse en fuente absoluta de verdad.

---

## 13. Ejemplo completo

### Documento inicial

```text
Programa X — 2024
"Permite comunicación multilingüe y soporta 12 idiomas."
```

### Documento actualizado

```text
Programa X — 2026
"Permite traducción simultánea y soporta 47 idiomas."
```

### Procesamiento

1. Se sanitizan ambos archivos.
2. SHA-256 demuestra que no son el mismo artefacto.
3. El sistema identifica la misma entidad.
4. Se comparan claims.
5. Se conserva el claim de 12 idiomas como histórico.
6. Se incorpora el claim de 47 idiomas como actual si la evidencia lo permite.
7. Se registra traducción simultánea como enriquecimiento.
8. Se genera commit.
9. BookPI registra provenance.
10. El índice permite responder según la fecha solicitada.

---

## 14. Integración con TAMV

Las bibliotecas canónicas pueden servir como base documental y técnica para módulos TAMV como:

- MSR y provenance.
- MDD, sujeto a especificación y marco jurídico aplicable.
- DreamSpaces y DreamWorld, por fases y con separación entre concepto y implementación.
- Hollow Wall y Vesta como diseños de seguridad, sin afirmar invulnerabilidad.
- Arquitectura territorial y conocimiento comunitario.
- Integración gradual con Lovable, GitHub y Vercel para la capa de aplicación.

La regla de integración es mantener separados:

```text
visión conceptual
especificación
implementación
evidencia
roadmap
```

---

## 15. Estado real y límites

Las librerías pueden estar en distintos estados:

- `draft`: propuesta.
- `alpha`: prototipo funcional.
- `stable`: contrato o módulo estable dentro de un alcance definido.

`stable` no significa:

- producción universal;
- seguridad absoluta;
- certificación legal;
- verdad automática;
- ausencia de bugs;
- independencia completa de proveedores.

Toda descripción pública debe declarar implementación, pruebas, evidencia y limitaciones.

---

## 16. Definición final

Las librerías de Isabella son una infraestructura de conocimiento externo gobernado que permite a Isabella consultar, preservar, comparar, evaluar, versionar y recuperar información con contexto temporal, evidencia y provenance.

No son una copia de ChatGPT, Gemini o Claude, ni un modelo fundacional autónomo. Son una capa de conocimiento, memoria externa y gobernanza que puede conectarse a modelos distintos y conservar la autoridad canónica fuera de ellos.

Su propósito esencial es que Isabella no solo pueda responder:

> "¿Qué dice esta información?"

sino también:

> "¿De dónde proviene, qué afirmación contiene, qué evidencia la respalda, qué contradicciones existen, para qué periodo es válida, qué versión se utilizó, quién la aprobó y qué límites tiene?"

Esa es la diferencia entre una colección de documentos y una biblioteca evolutiva, auditable y epistemológicamente gobernada.
