# Isabella Genesis — Open Intelligence & Revenue Fabric

Isabella es un workspace de IA gobernada que reúne chat multi-proveedor, descubrimiento de modelos abiertos, herramientas, datasets y un primer flujo comercial para creadores. La integración de comercio toma como referencia los contratos de **Revenue Fabric** de [ISABELLA-VERSION-TERMINUS-V6](https://github.com/OsoPanda1/ISABELLA-VERSION-TERMINUS-V6) y adapta capacidades seleccionadas del agente abierto [Hermes](https://github.com/NousResearch/hermes-agent), distribuido bajo MIT, sin copiar su runtime completo ni atribuirle capacidades no integradas.

> `CAPABILITY ≠ AUTHORITY ≠ EXECUTION ≠ EVIDENCE ≠ LEARNING ≠ PRODUCTION`

Un catálogo, una simulación o una migración no certifican un despliegue. Los pagos reales, los devengos contables, los retiros y la verificación fiscal son capas diferentes.

## Capacidades incluidas

### Inteligencia y herramientas
- Chat con Vercel AI Gateway, Hugging Face Inference Providers y Ollama local/autohospedado.
- Catálogo público de modelos, datasets y Spaces de Hugging Face; vista previa acotada de datasets.
- Selector de modelos y catálogo de Ollama accesible desde el servidor.
- Workspace de artefactos, exportación Markdown, trazas de sesión y guardrails de revisión humana.
- Skill operativo de referencia en `skills/huggingface-open-models/SKILL.md`.

### Revenue Fabric
- Catálogo de planes y precio mensual calculado con enteros en centavos.
- Registro e inicio de sesión de Supabase Auth en el panel Economía.
- Checkout de suscripción mensual Isabella Plus con Stripe, sujeto a configuración.
- Webhook Stripe con verificación de firma, tolerancia temporal y deduplicación de eventos de suscripción.
- Activación de creador después de confirmar una suscripción de pago activa.
- Publicación de ofertas del marketplace y checkout de compras digitales con Stripe.
- Reparto determinista de ingresos y devengo de doble entrada con idempotencia por evento.
- Panel de simulación 50/50, 75/25 y 80/20, con desglose de Fondo Fénix, Infraestructura y DAO.
- Migración Supabase con tablas protegidas por RLS y funciones RPC reservadas al rol de servicio.

## Precio y reparto

### Suscripción
El valor predeterminado del catálogo es **US$25/mes**, calculado a partir de una referencia configurable de US$20 más un margen del 25%. Es un **ancla de configuración de ejemplo**, no un promedio de mercado verificado ni una afirmación sobre precios actuales de competidores. Cambia `ISABELLA_REFERENCE_AI_PRICE_CENTS` y `ISABELLA_PRICE_MARKUP_BPS` antes de publicar precios comerciales. El precio se calcula en el servidor y se utiliza al crear la sesión Stripe.

### Reparto de transacciones de creadores
| Nivel | Creador | Plataforma |
| --- | ---: | ---: |
| Standard | 50% | 50% |
| Sovereign | 75% | 25% |
| Elite | 80% | 20% |

El nivel inicial de creador es Standard. La UI permite comparar niveles en una simulación, pero el usuario **no puede asignarse un nivel superior** enviando datos desde el navegador: el devengo consulta el nivel guardado en la base de datos. El reparto se calcula con enteros en centavos; el remanente de redondeo permanece en la parte de plataforma.

La parte de plataforma se distribuye internamente así: **20% Fondo Fénix, 30% Infraestructura y 50% DAO**. Estos porcentajes se aplican a la parte de plataforma, no al bruto de la transacción.

Una cuenta debe registrarse, mantener una suscripción de pago activa y activar su perfil de creador para publicar ofertas. Las cuentas gratuitas, con pago vencido, canceladas o sin perfil elegible no generan devengos de creador. Los ingresos registrados no equivalen a fondos transferidos.

## Rutas principales

| Método | Ruta | Función | Límite / seguridad |
| --- | --- | --- | --- |
| GET | `/api/commerce/catalog` | Planes, precio y reglas de reparto | Catálogo público; informa capacidades configuradas |
| POST | `/api/commerce/revenue-preview` | Simulación de reparto | **No autoriza ni registra pagos**; el estado enviado es solo de prueba |
| POST | `/api/commerce/checkout` | Checkout de suscripción Isabella Plus | Requiere identidad Supabase válida y Stripe configurado |
| POST | `/api/commerce/creator/activate` | Activa perfil Standard | Requiere identidad y suscripción pagada activa verificada en DB |
| GET/POST | `/api/commerce/marketplace/offers` | Lista ofertas públicas / publica una oferta | Publicar requiere creador activado y suscripción vigente |
| POST | `/api/commerce/marketplace/checkout` | Compra una oferta | Requiere comprador autenticado, oferta publicada y creador elegible |
| POST | `/api/commerce/webhook` | Procesa eventos Stripe | Firma obligatoria; suscripciones y compras del marketplace |
| POST | `/api/commerce/accrual` | Registra un devengo interno | Requiere `ISABELLA_OMEGA_API_TOKEN`; no mueve fondos |
| GET | `/api/huggingface/discover` | Descubre modelos, datasets y Spaces | Catálogo público; límites y rate limits del proveedor |
| GET | `/api/huggingface/dataset-preview` | Muestra filas de un dataset público | Vista previa limitada; no descarga datasets completos |
| GET | `/api/ollama/models` | Lista modelos de Ollama | El runtime debe ser accesible desde el servidor |
| POST | `/api/chat` | Conversación con el proveedor seleccionado | Validación de entrada y secretos solo en servidor |

## Configuración

Instala dependencias con la versión de pnpm fijada por `package.json`, y configura variables privadas en el gestor de secretos de tu entorno.

### Variables necesarias

```dotenv
# Supabase server-side
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_ANON_KEY=
ISABELLA_OMEGA_API_TOKEN=

# Supabase Auth client — la anon key es pública; nunca publiques la service role
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=

# Precio: US$20 de referencia + 25% = US$25/mes por defecto
ISABELLA_REFERENCE_AI_PRICE_CENTS=2000
ISABELLA_PRICE_MARKUP_BPS=2500
ISABELLA_PUBLIC_URL=https://tu-dominio.example

# Stripe server-side
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=

# AI Gateway / Hugging Face / Ollama, opcionales
AI_GATEWAY_API_KEY=
AI_GATEWAY_MODEL=openai/gpt-6.1-sol-fast
AI_GATEWAY_FALLBACK_MODELS=
HF_TOKEN=
HF_MODEL=openai/gpt-oss-120b:fireworks-ai
OLLAMA_BASE_URL=http://127.0.0.1:11434
OLLAMA_MODEL=qwen3:8b
```

Nunca configures `SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `HF_TOKEN` ni `ISABELLA_OMEGA_API_TOKEN` como variables `NEXT_PUBLIC_*`.

### Migración y Stripe

1. Revisa y ejecuta `supabase/migrations/202610230002_isabella_revenue_fabric.sql` en una base Supabase de prueba.
2. Configura `ISABELLA_PUBLIC_URL`, las claves Stripe y las variables de Supabase.
3. Registra `/api/commerce/webhook` como endpoint Stripe y suscribe los eventos `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted` y `checkout.session.completed`.
4. Prueba registro, confirmación de correo si está habilitada, login, checkout en modo test, webhook firmado, activación de creador, publicación, compra y deduplicación.
5. Comprueba los asientos de `isabella_revenue_share_runs`, `isabella_revenue_share_lines` y `isabella_marketplace_orders` antes de activar producción.

El checkout de suscripción usa Stripe Checkout en modo `subscription`. Las compras del marketplace usan Checkout en modo `payment`. Los eventos verificados actualizan el estado de la suscripción o registran la compra. El devengo se bloquea si la base no encuentra una suscripción de pago activa y un perfil de creador aprobado.

## Integridad y límites económicos

- La función SQL `record_isabella_revenue_accrual` registra un devengo de doble entrada e impone una clave de evento única. No transfiere dinero.
- La función SQL `apply_isabella_stripe_subscription_event` deduplica eventos y evita aplicar estados de suscripción con marcas temporales anteriores.
- RLS está activado y se revoca el acceso directo de roles `anon` y `authenticated` a las tablas financieras. Las operaciones se realizan en servidor o RPC con `service_role`.
- El endpoint interno `/api/commerce/accrual` solo debe invocarse después de verificar el evento de pago de un proveedor confiable.
- No se ha implementado Stripe Connect, onboarding KYC de beneficiarios, retiros, retenciones/CFDI, conciliación bancaria, reembolsos automáticos, contracargos ni clawback automatizado. Los fondos no se transfieren a creadores desde esta versión.
- La cuenta de creador puede quedar habilitada para devengos, pero los payouts permanecen desactivados hasta implementar verificación de beneficiario, requisitos fiscales y una ruta de pago segura.
- La migración debe aplicarse en el proyecto Supabase; que exista en GitHub no significa que esté desplegada.
- La UI de registro mantiene el access token en memoria de la página y no lo persiste entre recargas. La renovación de sesión y la gestión completa de perfil aún requieren integración.
- Los estados de elegibilidad mostrados en el simulador proceden de datos introducidos por el usuario y no deben utilizarse para autorizar pagos.

## Ejecutar en local

```bash
pnpm install --frozen-lockfile
pnpm dev
```

Para verificar el cambio antes de fusionar:

```bash
pnpm lint
pnpm build
```

La ejecución de CI, el build, la integración real de Stripe, la migración en Supabase y el despliegue remoto deben verificarse contra el commit evaluado. Este README no declara esas comprobaciones como exitosas.

## Referencias y licencias

- [ISABELLA-VERSION-TERMINUS-V6](https://github.com/OsoPanda1/ISABELLA-VERSION-TERMINUS-V6) — arquitectura canónica y contratos Revenue Fabric.
- [Hermes Agent](https://github.com/NousResearch/hermes-agent) — referencia de agente, tools, skills y MCP; licencia MIT en el archivo fuente adjunto.
- [Supabase Auth](https://supabase.com/docs/guides/auth)
- [Stripe Checkout subscriptions](https://docs.stripe.com/payments/checkout/build-subscriptions)
- [Stripe webhooks](https://docs.stripe.com/webhooks)
- [Hugging Face Hub API](https://huggingface.co/docs/hub/en/api)

Revisa las licencias de cada modelo, dataset, herramienta y dependencia antes de uso comercial. Una licencia de código MIT del agente fuente no concede derechos sobre los modelos, datasets o proveedores conectados.
