# Billing & commerce engine — endpoints y contrato de fidelidad

> state: draft | engine-generated.
> Isabella **registra** el estado de suscripción verificado por un proveedor
> externo y **aplica** planes/cuotas. **No procesa pagos, no almacena datos de
> tarjeta y no infiere un estado pagado sin referencia de proveedor.**

El movimiento de dinero permanece en el proveedor externo. El servidor solo
compara un token/estado que el proveedor ya confirmó.

## Módulos

| Módulo | Responsabilidad |
| --- | --- |
| `src/commerce/subscriptions.ts` | `SubscriptionStore`: máquina de estados + auditoría. |
| `src/commerce/entitlements.ts` | Decisiones de función y cuota (puras). |
| `src/commerce/metering.ts` | `UsageMeter`: contadores por workspace/cuota/día. |
| `src/commerce/provider-events.ts` | Puente evento-de-proveedor → `SubscriptionStore`. |
| `src/commerce/plans.ts` | Configuración de planes FREE/PREMIUM/VIP/ENTERPRISE. |
| `src/commerce/guards.ts` | Guards de servicio, roles y errores tipados. |

## Endpoints

| Método | Ruta | Auth | Descripción |
| --- | --- | --- | --- |
| GET | `/api/v1/billing/plans` | pública | Lista de planes, funciones y cuotas. |
| GET | `/api/v1/billing/entitlements?plan=` | pública | Funciones y cuotas del plan. |
| GET | `/api/v1/billing/subscription?workspaceId=` | admin | Suscripción registrada + entitlements efectivos. |
| POST | `/api/v1/billing/subscribe` | admin | Registra estado verificado del proveedor. |
| POST | `/api/v1/billing/cancel` | admin | Cancela la suscripción registrada. |
| GET | `/api/v1/billing/usage?workspaceId=` | admin | Uso del día vs cuota por clave. |
| POST | `/api/v1/commerce/offers` | admin | Puerta real: exige `offer` + cuota `active_offers`. |
| POST | `/api/v1/connectors/ingest` | firma | Webhook firmado del proveedor; aplica la suscripción. |

Auth `admin` = bearer `GENESIS_ADMIN_API_TOKEN` (auth de servicio). No hay login de
usuario final todavía; esa es la brecha pendiente.

## Máquina de estados de suscripción

```
none ──subscribe──▶ active | trialing
active ──cancel──▶ canceled        canceled ──subscribe──▶ active
active ──markPastDue──▶ past_due   past_due ──(reactivar)──▶ active
*      ──suspend──▶ suspended      suspended ──(reinstaurar)──▶ active
```

Reglas duras:

- Se exige `provider` y `externalRef` no vacíos (prueba de estado del proveedor).
- Plan ENTERPRISE exige `contract: true` explícito.
- Cada transición queda en el rastro de auditoría y se registra en BookPI.

## Semántica de entitlements

- `checkFeature(plan, status, feature)`: `OK`, `ACCOUNT_SUSPENDED`,
  `SUBSCRIPTION_INACTIVE` o `FEATURE_NOT_IN_PLAN`.
- `checkQuota(plan, status, key, used)`: `OK` (incluye ilimitado `-1`) o
  `QUOTA_EXCEEDED`.
- El estado de la suscripción manda: un plan PREMIUM `canceled` no habilita nada.

## Webhooks del proveedor → suscripción

`POST /api/v1/connectors/ingest` verifica la firma HMAC del proveedor y resuelve el
tenant (ver `src/commerce/connector.ts`). Si el evento se **ACEPTA**, se aplica al
`SubscriptionStore` vía `applyProviderSubscriptionEvent`:

- `defaultResolveIntent(eventType)` clasifica por palabras clave en orden de
  prioridad (terminales antes que activadores): `suspend`, `cancel`, `past_due`,
  `trial`, `activate`; desconocido → `ignore` (no se inventa transición).
- El **evento no es autoridad**: solo aplica después de firma válida + tenant
  resuelto. El plan se toma del cuerpo (`planCode`/`plan_code`/`plan`) o del
  registro existente. ENTERPRISE exige `contract: true`.
- Resultados de negocio no lanzan; se devuelven como `outcome`: `APPLIED`,
  `IGNORED_UNMAPPED_EVENT`, `REJECTED_NO_SUBSCRIPTION`,
  `REJECTED_PLAN_UNRESOLVED`, `REJECTED_CONTRACT_REQUIRED`, `REJECTED_TRANSITION`.
- Cada suscripción aplicada se registra en BookPI
  (`commerce.subscription.webhook_applied`).

Se requiere `CONNECTOR_WEBHOOK_SECRET` (y opcional `CONNECTOR_TENANT_MAP`) para que
el endpoint atienda; sin esa configuración responde `CONNECTOR_NOT_CONFIGURED`.

## Persistencia

`SubscriptionStore` usa por defecto persistencia en memoria
(`InMemorySubscriptionPersistence`). El contrato `SubscriptionPersistence` permite
conectar un backend durable (Postgres/JSONL/Supabase). `UsageMeter` es efímero por
día por diseño; su persistencia durable es trabajo pendiente.

## Pendiente (no presentar como terminado)

1. Auth de usuario final + sesiones.
2. Persistencia durable de suscripciones y metering.
3. UI de billing.
4. Tarifas/precios y facturación (invoices).
5. Mapeo de planes específico por proveedor (hoy heurístico por cuerpo/registro).

> Nota: el puente webhooks → `SubscriptionStore` ya está implementado y probado
> (ver arriba); no se declara verificado hasta revisión humana.



---

## Política comercial y cláusulas operativas

## No garantía de resultados

Isabella proporciona herramientas de planificación, publicación, conversión y medición. No garantiza ingresos, ventas, clientes, viralidad, afiliaciones, aprobación de plataformas ni rentabilidad.

## Datos y consentimiento

El usuario declara contar con base legítima para cargar, compartir y procesar los datos. Isabella puede bloquear datos o campañas que incumplan requisitos de privacidad, consentimiento o seguridad.

## Plataformas externas

Las capacidades dependen de APIs, permisos, auditorías, límites, costes y políticas de terceros. Isabella no garantiza disponibilidad permanente de ninguna plataforma externa.

## Pagos

Los pagos son procesados por proveedores externos. Isabella registra estados recibidos mediante mecanismos verificables y no sustituye al proveedor financiero.

## Contenido

El usuario es responsable de derechos, marcas, claims, licencias, testimonios y exactitud comercial. Isabella puede marcar, bloquear o solicitar revisión.

## Suspensión

Puede suspenderse una operación por fraude, spam, abuso, incumplimiento, riesgo crítico, disputa, ausencia de consentimiento o requerimiento legal.

## Revisión

El usuario puede solicitar revisión de una decisión automatizada, salvo restricciones legales o de seguridad. La revisión no garantiza desbloqueo.

## Exportación

Los usuarios pueden exportar datos comerciales disponibles, sujetos a obligaciones legales, privacidad de terceros y formato del proveedor.


---

## Guía de implementación por fases

## Fase 0 — Preparación

1. Crear proyecto Supabase.
2. Activar Auth.
3. Configurar variables secretas en Secret Manager.
4. Ejecutar migraciones SQL.
5. Activar RLS.
6. Crear proveedor de pagos en modo sandbox.
7. Configurar webhook firmado.
8. Crear workspace de prueba.

## Fase 1 — Primer ingreso

1. Registrar usuario.
2. Crear workspace.
3. Activar Premium en sandbox.
4. Crear meta.
5. Crear oferta con precio y entrega.
6. Crear landing.
7. Generar contenido.
8. Revisar disclosure y CTA.
9. Aprobar publicación.
10. Crear checkout.
11. Completar pago de prueba.
12. Verificar webhook.
13. Confirmar venta idempotente.
14. Mostrar ingreso neto.

## Fase 2 — Publicación

1. Conectar una cuenta profesional compatible.
2. Solicitar permisos mínimos.
3. Validar token.
4. Previsualizar contenido.
5. Aprobar contenido.
6. Publicar o guiar el paso manual.
7. Registrar resultado.

## Fase 3 — Leads

1. Activar formulario.
2. Mostrar aviso de privacidad.
3. Registrar consentimiento.
4. Crear lead.
5. Deduplicar.
6. Calificar.
7. Registrar contacto.
8. Registrar resultado comercial.

## Fase 4 — Producción

1. Activar rate limiting.
2. Probar backups.
3. Probar rollback.
4. Ejecutar pruebas de RLS.
5. Ejecutar pruebas de webhook duplicado.
6. Revisar logs sin secretos.
7. Invitar piloto controlado.

## Criterio de salida

Un usuario puede pasar de oferta a pago confirmado, sin duplicación, con consentimiento, atribución y auditoría.


---

## Reglas de operación, planes y controles

## 1. Reglas absolutas

1. Isabella no garantiza ingresos, viralidad, ventas, aprobación de APIs ni retorno de inversión.
2. Impresiones, vistas, likes, clics y leads no son ingresos.
3. Solo un pago confirmado por webhook válido puede registrarse como ingreso confirmado.
4. No se publica sin autorización del usuario y permisos válidos del canal.
5. No se envían mensajes comerciales sin consentimiento válido.
6. No se almacenan tokens en texto plano.
7. No se permite scraping cuando exista una API oficial o cuando viole términos de plataforma.
8. Toda predicción debe mostrar supuestos, rango, fecha, evidencia y confianza.
9. Toda relación de afiliación o patrocinio debe divulgarse.
10. Toda acción irreversible requiere confirmación explícita.

## 2. Planes

### FREE

Puede: crear cuenta, explorar oportunidades, usar demo, simular campañas y aprender.

No puede: publicar, cobrar, activar afiliados, usar Revenue Dashboard operativo, crear funnels activos, procesar leads comerciales, acceder a marketplace o usar automatización monetizable.

### PREMIUM

Puede: crear ofertas, campañas, landing pages, checkout, leads, publicación autorizada, atribución, analítica y recomendaciones.

Límites iniciales recomendados: 3 ofertas activas, 5 campañas activas, 2 conexiones por plataforma, 1,000 eventos de atribución diarios, 500 leads mensuales.

### VIP

Incluye Premium más: límites ampliados, revisión humana prioritaria, automatización programada, múltiples workspaces, soporte prioritario y controles de riesgo reforzados.

### ENTERPRISE

Requiere contrato: SSO, SCIM, roles personalizados, aislamiento por tenant, logs exportables, retención negociada, DPA, SLA, revisión de seguridad y facturación empresarial.

## 3. Candados

Una operación se bloquea si: no existe suscripción válida; la cuenta está suspendida; el canal no tiene permiso; el contenido cambió después de la aprobación; falta consentimiento; el webhook no tiene firma válida; el pago es duplicado; el riesgo es crítico; la oferta está archivada; el presupuesto excede el límite; o el proveedor no confirma el estado.

## 4. Aclaraciones financieras

Ingreso bruto = total cobrado.
Ingreso neto = total cobrado - comisiones - reembolsos - costes variables registrados.
Ingreso estimado nunca se presenta como ingreso confirmado.

## 5. Revisión y apelación

Un bloqueo automático debe mostrar código, motivo general, acción requerida y mecanismo de revisión. Las decisiones no deben basarse exclusivamente en datos sensibles o fingerprinting invasivo.


---

## Checklist de aceptación QA

- [ ] Usuario FREE no puede activar campañas.
- [ ] Usuario FREE no puede crear checkout productivo.
- [ ] Premium puede crear oferta.
- [ ] VIP tiene límites ampliados.
- [ ] Enterprise requiere configuración contractual.
- [ ] RLS impide acceso cruzado.
- [ ] Webhook inválido se rechaza.
- [ ] Webhook duplicado no duplica venta.
- [ ] Refund actualiza neto.
- [ ] Token expirado bloquea publicación.
- [ ] Cambio de contenido invalida aprobación.
- [ ] Lead sin consentimiento no se exporta.
- [ ] Cuenta revocada no publica.
- [ ] Error externo no muestra secretos.
- [ ] Dashboard diferencia estimado y confirmado.
- [ ] Datos pueden exportarse.
- [ ] Suspensión pausa operaciones.
- [ ] Apelación registra revisión.


---

## Estadísticas, fórmulas y niveles de confianza

## Métrica principal

Ingreso neto confirmado por workspace activo en 30 días.

## Métricas secundarias

- Tiempo hasta primera oferta.
- Tiempo hasta primer lead.
- Tiempo hasta primer pago.
- Tasa de conversión.
- CAC.
- AOV.
- Margen de contribución.
- Retención a 7 y 30 días.
- MRR para membresías.
- Tasa de reembolso.
- Tasa de disputa.
- Error de atribución.

## Fórmulas

```text
conversion_rate = confirmed_sales / qualified_leads
net_revenue = gross_amount - payment_fee - platform_fee - refunds - variable_cost
CAC = acquisition_cost / new_customers
AOV = gross_sales / paid_orders
refund_rate = refunded_orders / paid_orders
```

## Reglas estadísticas

1. No mostrar predicciones como hechos.
2. Toda estimación incluye intervalo o rango.
3. Se muestra tamaño de muestra.
4. No hacer A/B testing con muestras insuficientes como conclusión definitiva.
5. Separar correlación de causalidad.
6. Mostrar fecha de actualización.
7. Marcar datos incompletos.
8. No mezclar monedas sin conversión registrada.
9. No contar reembolsos como éxito.
10. No usar likes como proxy directo de ingresos.

## Confianza

- Baja: menos de 20 observaciones relevantes.
- Media: 20–99 observaciones o atribución parcial.
- Alta: 100+ observaciones y fuente consistente.

Estos umbrales son operativos, no una prueba científica universal.

## Gobierno de documentación

Este archivo concentra la guía comercial, los controles, las cláusulas, la implementación, la QA y las métricas. La presencia de un checklist no significa que los controles hayan pasado; registrar resultados reproducibles por SHA/entorno antes de declarar un flujo verificado.
