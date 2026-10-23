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
