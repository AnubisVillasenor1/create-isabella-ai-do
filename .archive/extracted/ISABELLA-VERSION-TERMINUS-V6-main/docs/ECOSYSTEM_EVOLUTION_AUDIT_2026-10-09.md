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

