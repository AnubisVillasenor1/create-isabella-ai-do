/**
 * Native API catalog and model-runtime descriptor.
 *
 * Inspired by the CONCEPTS of Apicurio (machine-readable API catalog) and
 * OpenLLM (runtime model catalog). This module only *describes* capabilities
 * and readiness from environment configuration. It never returns secrets,
 * never contacts a provider and never authorizes anything by itself.
 */
import {
  isOpenRouterModelAllowed,
  resolveKeylessFreeProvider,
  resolveLocalOllamaProvider,
} from '../inference/provider-policy';
import { describeSpeechReadiness } from '../inference/speech';

export const FEDERATION_CATALOG_VERSION = '1.0.0';

export type ModelReadiness = 'ready' | 'configured' | 'unavailable';

export interface ModelRuntimeDescriptor {
  readonly id: string;
  readonly provider: string;
  readonly family: string;
  readonly transport: 'keyed' | 'keyless' | 'local';
  readonly capabilities: readonly string[];
  readonly readiness: ModelReadiness;
  readonly disclosure: string;
}

export interface FederationCatalog {
  readonly catalogVersion: string;
  readonly generatedAt: string;
  readonly models: readonly ModelRuntimeDescriptor[];
  readonly speech: {
    readonly textToSpeech: boolean;
    readonly speechToText: boolean;
    readonly providers: readonly string[];
  };
  readonly counts: {
    readonly ready: number;
    readonly configured: number;
    readonly unavailable: number;
  };
}

function present(value: string | undefined): boolean {
  return typeof value === 'string' && value.trim().length > 0;
}

/**
 * Readiness reflects the same gates the server actually enforces. A model is
 * "ready" only when every local precondition is satisfied; "configured" means a
 * credential exists but a policy or model gate still applies.
 */
export function describeModelRuntime(
  env: Readonly<Record<string, string | undefined>>
): FederationCatalog {
  const models: ModelRuntimeDescriptor[] = [];
  const keyless = resolveKeylessFreeProvider(env);
  const ollama = resolveLocalOllamaProvider(env);

  if (present(env.GEMINI_API_KEY) || present(env.GOOGLE_API_KEY) || present(env.MODEL_API_KEY)) {
    models.push({
      id: 'google-gemini',
      provider: 'google',
      family: 'gemini',
      transport: 'keyed',
      capabilities: ['text', 'vision', 'image', 'reasoning'],
      readiness: 'ready',
      disclosure: 'Requests leave the node through the operator-configured Google endpoint.',
    });
  }
  if (present(env.GROQ_API_KEY)) {
    models.push({
      id: 'groq-llama',
      provider: 'groq',
      family: 'llama',
      transport: 'keyed',
      capabilities: ['text', 'reasoning', 'speech-to-text', 'text-to-speech'],
      readiness: 'ready',
      disclosure: 'Requests leave the node through the operator-configured Groq endpoint.',
    });
  }
  if (present(env.OPENROUTER_API_KEY)) {
    const model = (env.OPENROUTER_MODEL ?? env.OPENROUTER_FREE_MODEL ?? 'openrouter/free').trim();
    const freeOnly = isOpenRouterModelAllowed(model, false);
    models.push({
      id: 'openrouter',
      provider: 'openrouter',
      family: model || 'openrouter/free',
      transport: 'keyed',
      capabilities: ['text', 'reasoning', 'vision'],
      readiness: freeOnly ? 'ready' : 'configured',
      disclosure: freeOnly
        ? 'Requests leave the node through OpenRouter using a free-tier model.'
        : 'Model is not free-tier; the server rejects it unless paid routes are explicitly enabled.',
    });
  }
  if (ollama) {
    models.push({
      id: 'ollama-local',
      provider: 'ollama',
      family: ollama.model,
      transport: 'local',
      capabilities: ['text', 'reasoning'],
      readiness: 'ready',
      disclosure: 'Inference stays on the operator-configured local Ollama endpoint.',
    });
  }
  if (keyless) {
    models.push({
      id: `keyless-${keyless.name}`,
      provider: keyless.name,
      family: keyless.model,
      transport: 'keyless',
      capabilities: ['text'],
      readiness: 'ready',
      disclosure:
        'External free inference is operator-enabled; prompts may leave the node and the free tier applies its own per-IP limits.',
    });
  }

  const speech = describeSpeechReadiness(env as Record<string, string | undefined>);
  const counts = { ready: 0, configured: 0, unavailable: 0 } as {
    ready: number;
    configured: number;
    unavailable: number;
  };
  for (const model of models) counts[model.readiness] += 1;

  return {
    catalogVersion: FEDERATION_CATALOG_VERSION,
    generatedAt: new Date().toISOString(),
    models,
    speech,
    counts,
  };
}

function jsonContent(schema: Record<string, unknown>): Record<string, unknown> {
  return { 'application/json': { schema } };
}

function objectSchema(
  properties: Record<string, unknown>,
  required: readonly string[] = []
): Record<string, unknown> {
  return { type: 'object', properties, ...(required.length ? { required } : {}) };
}

const ERROR_RESPONSE = { description: 'Error gobernado', content: jsonContent({ type: 'object' }) };

/**
 * Builds an OpenAPI 3.1 document for the public federation surface. The origin is
 * supplied by the caller (already validated) so the catalog never trusts a raw
 * Host header on its own.
 */
export function buildFederationOpenApi(
  origin: string,
  env: Readonly<Record<string, string | undefined>>
): Record<string, unknown> {
  const catalog = describeModelRuntime(env);
  return {
    openapi: '3.1.0',
    info: {
      title: 'Isabella Federation API',
      version: FEDERATION_CATALOG_VERSION,
      description:
        'Catálogo nativo de superficies de federación: voz, cognición, claves de programa, conectores firmados y runtime de modelos. Describir una capacidad no la autoriza ni la ejecuta.',
    },
    servers: [{ url: origin }],
    tags: [
      { name: 'federation', description: 'Estado, conectores e inbox firmado' },
      { name: 'cognition', description: 'Inferencia gobernada' },
      { name: 'speech', description: 'Voz nativa (capacidad, no autoridad)' },
      { name: 'programs', description: 'Registro de programas y API keys' },
    ],
    paths: {
      '/api/v1/federation/node': {
        get: {
          tags: ['federation'],
          operationId: 'federationStatus',
          summary: 'Estado de federación y runtime',
          responses: { '200': { description: 'Estado del nodo' } },
        },
      },
      '/api/v1/federation/catalog': {
        get: {
          tags: ['federation'],
          operationId: 'federationCatalog',
          summary: 'Este documento OpenAPI',
          responses: { '200': { description: 'Catálogo OpenAPI 3.1' } },
        },
      },
      '/api/v1/federation/models': {
        get: {
          tags: ['federation'],
          operationId: 'federationModels',
          summary: 'Runtime de modelos y readiness',
          responses: {
            '200': {
              description: 'Catálogo de modelos',
              content: jsonContent(
                objectSchema({ models: { type: 'array', items: { type: 'object' } } })
              ),
            },
          },
        },
      },
      '/api/v1/federation/connectors': {
        get: {
          tags: ['federation'],
          operationId: 'listConnectors',
          summary: 'Lista conectores (operador)',
          security: [{ bearerAuth: [] }],
          responses: {
            '200': { description: 'Conectores registrados' },
            '401': ERROR_RESPONSE,
          },
        },
        post: {
          tags: ['federation'],
          operationId: 'createConnector',
          summary: 'Registra un conector (operador)',
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: jsonContent(
              objectSchema(
                {
                  name: { type: 'string', maxLength: 80 },
                  kind: { type: 'string', enum: ['whatsapp', 'openwa', 'evolution', 'webhook'] },
                  targetUrl: { type: 'string', format: 'uri', nullable: true },
                },
                ['name', 'kind']
              )
            ),
          },
          responses: {
            '201': { description: 'Conector registrado' },
            '400': ERROR_RESPONSE,
            '401': ERROR_RESPONSE,
          },
        },
      },
      '/api/v1/federation/connectors/{id}': {
        delete: {
          tags: ['federation'],
          operationId: 'deleteConnector',
          summary: 'Elimina un conector (operador)',
          security: [{ bearerAuth: [] }],
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          responses: {
            '200': { description: 'Conector eliminado' },
            '401': ERROR_RESPONSE,
            '404': ERROR_RESPONSE,
          },
        },
      },
      '/api/v1/federation/inbox': {
        get: {
          tags: ['federation'],
          operationId: 'federationInbox',
          summary: 'Inbox normalizado (operador)',
          security: [{ bearerAuth: [] }],
          parameters: [
            { name: 'limit', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 200 } },
          ],
          responses: {
            '200': { description: 'Mensajes normalizados' },
            '401': ERROR_RESPONSE,
          },
        },
      },
      '/api/v1/federation/webhooks/{connectorId}': {
        get: {
          tags: ['federation'],
          operationId: 'verifyWebhook',
          summary: 'Verificación hub.challenge',
          parameters: [
            { name: 'connectorId', in: 'path', required: true, schema: { type: 'string' } },
            { name: 'hub.mode', in: 'query', schema: { type: 'string' } },
            { name: 'hub.verify_token', in: 'query', schema: { type: 'string' } },
            { name: 'hub.challenge', in: 'query', schema: { type: 'string' } },
          ],
          responses: {
            '200': { description: 'Desafío devuelto como texto' },
            '401': ERROR_RESPONSE,
            '404': ERROR_RESPONSE,
          },
        },
        post: {
          tags: ['federation'],
          operationId: 'ingestWebhook',
          summary: 'Ingreso firmado (HMAC-SHA256)',
          parameters: [
            { name: 'connectorId', in: 'path', required: true, schema: { type: 'string' } },
            {
              name: 'x-isabella-timestamp',
              in: 'header',
              required: true,
              schema: { type: 'string' },
            },
            {
              name: 'x-isabella-signature',
              in: 'header',
              required: true,
              schema: { type: 'string' },
            },
          ],
          requestBody: {
            required: true,
            content: jsonContent({ type: 'object', additionalProperties: true }),
          },
          responses: {
            '202': { description: 'Mensaje aceptado en el inbox' },
            '400': ERROR_RESPONSE,
            '401': ERROR_RESPONSE,
            '404': ERROR_RESPONSE,
            '409': ERROR_RESPONSE,
          },
        },
      },
      '/api/v1/voice/speak': {
        post: {
          tags: ['speech'],
          operationId: 'publicSpeak',
          summary: 'Voz pública sin clave (keyless, limitada)',
          requestBody: {
            required: true,
            content: jsonContent(
              objectSchema({ text: { type: 'string', maxLength: 1200 } }, ['text'])
            ),
          },
          responses: {
            '200': { description: 'Audio sintetizado' },
            '400': ERROR_RESPONSE,
            '413': ERROR_RESPONSE,
            '429': ERROR_RESPONSE,
            '503': ERROR_RESPONSE,
          },
        },
      },
      '/api/v1/cognition/generate': {
        post: {
          tags: ['cognition'],
          operationId: 'cognitionGenerate',
          summary: 'Inferencia gobernada (API key opcional)',
          security: [{ apiKey: [] }],
          requestBody: {
            required: true,
            content: jsonContent(objectSchema({ input: { type: 'string' } }, ['input'])),
          },
          responses: {
            '200': { description: 'Respuesta gobernada' },
            '401': ERROR_RESPONSE,
            '429': ERROR_RESPONSE,
          },
        },
      },
      '/api/v1/admin/programs': {
        post: {
          tags: ['programs'],
          operationId: 'registerProgram',
          summary: 'Registra un programa y emite una API key (operador)',
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: jsonContent(
              objectSchema(
                {
                  name: { type: 'string', maxLength: 80 },
                  programId: { type: 'string', pattern: '^[a-zA-Z0-9][a-zA-Z0-9._-]{1,63}$' },
                  scopes: {
                    type: 'array',
                    items: {
                      type: 'string',
                      enum: ['cognition:read', 'cognition:write', 'memory:write', 'admin:keys'],
                    },
                  },
                  expiresAt: { type: 'string', format: 'date-time' },
                },
                ['name']
              )
            ),
          },
          responses: {
            '201': { description: 'Programa registrado; el secreto se muestra una sola vez' },
            '400': ERROR_RESPONSE,
            '401': ERROR_RESPONSE,
          },
        },
      },
      '/api/v1/developer/me': {
        get: {
          tags: ['programs'],
          operationId: 'developerMe',
          summary: 'Identidad y scopes de la API key',
          security: [{ apiKey: [] }],
          responses: {
            '200': { description: 'Identidad del programa' },
            '401': ERROR_RESPONSE,
          },
        },
      },
    },
    components: {
      securitySchemes: {
        bearerAuth: { type: 'http', scheme: 'bearer' },
        apiKey: { type: 'apiKey', in: 'header', name: 'x-isabella-api-key' },
      },
      schemas: {
        InboxEntry: objectSchema({
          id: { type: 'string' },
          connectorId: { type: 'string' },
          receivedAt: { type: 'string', format: 'date-time' },
          kind: { type: 'string' },
          from: { type: 'string' },
          text: { type: 'string', maxLength: 4000 },
          remoteMessageId: { type: 'string', nullable: true },
        }),
      },
    },
    'x-isabella-runtime': {
      catalogVersion: catalog.catalogVersion,
      models: catalog.models.map((model) => model.id),
      counts: catalog.counts,
    },
  };
}
