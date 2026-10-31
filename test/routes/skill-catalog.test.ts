import { describe, expect, it } from 'vitest';
import type { Application, Request, Response } from 'express';
import type { FixedWindowRateLimiter } from '../../src/security/rate-limit';
import { ISABELLA_SKILLS, type IsabellaSkill } from '../../src/lib/lib/skill-registry';
import { capabilityRegistry } from '../../src/lib/lib/capability-registry';
import {
  registerSkillCatalogRoutes,
  SKILL_CATALOG_DISCLOSURE,
  SKILL_CATALOG_PUBLIC_SURFACE,
  SKILL_CATALOG_ROUTES_VERSION,
} from '../../src/routes/skill-catalog';

type Handler = (req: Request, res: Response) => void;

interface Recorded {
  status?: number;
  body?: Record<string, unknown>;
}

function harness(allow = true) {
  const handlers = new Map<string, Handler>();
  const wrap =
    (method: string) =>
    (path: string, handler: Handler): void => {
      handlers.set(`${method} ${path}`, handler);
    };
  const app = { get: wrap('GET'), post: wrap('POST') } as unknown as Application;
  registerSkillCatalogRoutes({
    app,
    enforceRateLimit: () => allow,
    rateLimiter: {} as FixedWindowRateLimiter,
    publicSurface: SKILL_CATALOG_PUBLIC_SURFACE,
  });
  return { handlers };
}

function response(record: Recorded) {
  const res = {
    status(code: number) {
      record.status = code;
      return this;
    },
    json(body: Record<string, unknown>) {
      record.body = body;
      return this;
    },
  } as unknown as Response;
  return res;
}

function call(handlers: Map<string, Handler>, key: string, params: Record<string, string> = {}) {
  const handler = handlers.get(key);
  if (!handler) throw new Error(`handler not registered: ${key}`);
  const record: Recorded = {};
  handler({ params } as unknown as Request, response(record));
  return record;
}

function gateOf(skill: IsabellaSkill): boolean {
  return capabilityRegistry.isOperational(skill.capability) || skill.status === 'experimental';
}

describe('registro de rutas', () => {
  it('monta el catálogo en /api/skills/catalog por defecto', () => {
    const { handlers } = harness();
    expect([...handlers.keys()]).toEqual([
      'GET /api/skills/catalog',
      'GET /api/skills/catalog/:id',
    ]);
  });

  it('acata el límite de tasa antes de responder', () => {
    const { handlers } = harness(false);
    expect(call(handlers, 'GET /api/skills/catalog').body).toBeUndefined();
  });
});

describe('catálogo completo', () => {
  it('recorre todas las skills registradas sin duplicados', () => {
    const { handlers } = harness();
    const body = call(handlers, 'GET /api/skills/catalog').body as {
      version: string;
      disclosure: string;
      summary: { skills: number; passingRegistryGate: number; blockedByRegistryGate: number };
      groups: Array<{ folder: string; items: Array<{ id: string }> }>;
    };
    expect(body.version).toBe(SKILL_CATALOG_ROUTES_VERSION);
    expect(body.disclosure).toBe(SKILL_CATALOG_DISCLOSURE);
    const ids = body.groups.flatMap((group) => group.items.map((item) => item.id));
    expect(ids).toHaveLength(ISABELLA_SKILLS.length);
    expect(new Set(ids).size).toBe(ISABELLA_SKILLS.length);
    expect(body.summary.skills).toBe(ISABELLA_SKILLS.length);
    expect(body.summary.passingRegistryGate + body.summary.blockedByRegistryGate).toBe(
      ISABELLA_SKILLS.length
    );
  });

  it('refleja el mismo portón que resolveSkillInvocation', () => {
    const { handlers } = harness();
    const body = call(handlers, 'GET /api/skills/catalog').body as {
      groups: Array<{
        items: Array<{ id: string; capability: string; passesRegistryGate: boolean }>;
      }>;
    };
    for (const group of body.groups) {
      for (const item of group.items) {
        const skill = ISABELLA_SKILLS.find((entry) => entry.id === item.id);
        expect(skill, `skill ${item.id} del catálogo no está en ISABELLA_SKILLS`).toBeDefined();
        expect(item.passesRegistryGate).toBe(gateOf(skill as IsabellaSkill));
        expect(item.capability).toBe((skill as IsabellaSkill).capability);
      }
    }
  });

  it('reporta unavailable para capacidades ausentes del registro', () => {
    const { handlers } = harness();
    const body = call(handlers, 'GET /api/skills/catalog').body as {
      summary: { capabilityStates: Record<string, string> };
    };
    const distinct = new Set(ISABELLA_SKILLS.map((skill) => skill.capability));
    expect(Object.keys(body.summary.capabilityStates).sort()).toEqual([...distinct].sort());
    for (const [capability, state] of Object.entries(body.summary.capabilityStates)) {
      expect(state).toBe(capabilityRegistry.stateOf(capability));
    }
    // 'catalog' es la capacidad del adaptador AAS: nunca se registra en el default,
    // así que el portón del registro debe cerrarla.
    expect(body.summary.capabilityStates.catalog).toBeUndefined();
    expect(capabilityRegistry.stateOf('catalog')).toBe('unavailable');
    expect(capabilityRegistry.isOperational('catalog')).toBe(false);
  });
});

describe('consulta por id', () => {
  it('devuelve la vista de una skill conocida', () => {
    const { handlers } = harness();
    const skill = ISABELLA_SKILLS[0];
    const record = call(handlers, 'GET /api/skills/catalog/:id', { id: skill.id });
    expect(record.status).toBeUndefined();
    expect(record.body?.disclosure).toBe(SKILL_CATALOG_DISCLOSURE);
    expect(record.body?.id).toBe(skill.id);
    expect(record.body?.capabilityState).toBe(capabilityRegistry.stateOf(skill.capability));
  });

  it('responde 404 sin eco de la entrada para un id inexistente', () => {
    const { handlers } = harness();
    const record = call(handlers, 'GET /api/skills/catalog/:id', { id: 'no-existe-xyz' });
    expect(record.status).toBe(404);
    expect(record.body).toEqual({ error: 'SKILL_NOT_FOUND' });
  });

  it('responde 400 para un id que viola SkillId', () => {
    const { handlers } = harness();
    for (const id of ['', '-leading', 'con_underscore', 'a:b:c-', '../traversal']) {
      const record = call(handlers, 'GET /api/skills/catalog/:id', { id });
      expect(record.status, `id ${JSON.stringify(id)}`).toBe(400);
      expect(record.body).toEqual({ error: 'SKILL_ID_INVALID' });
    }
  });
});
