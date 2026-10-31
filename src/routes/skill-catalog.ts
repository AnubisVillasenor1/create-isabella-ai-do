/**
 * Introspección de sólo lectura del registro canónico de skills.
 *
 * Expone estado de capacidad, no autoridad: una skill que pasa el portón del
 * registro sigue necesitando autorización y ejecución gobernadas.
 * state: draft | engine-generated — pendiente de revisión humana.
 */
import type { Application, Request, RequestHandler, Response } from 'express';
import type { FixedWindowRateLimiter } from '../security/rate-limit';
import {
  ISABELLA_SKILLS,
  SkillId,
  skillGroups,
  type IsabellaSkill,
} from '../lib/lib/skill-registry';
import { capabilityRegistry, type CapabilityState } from '../lib/lib/capability-registry';

export const SKILL_CATALOG_ROUTES_VERSION = '1.0.0' as const;
export const SKILL_CATALOG_DISCLOSURE =
  'CAPABILITY ≠ AUTHORITY ≠ EXECUTION ≠ EVIDENCE ≠ LEARNING ≠ PRODUCTION' as const;

/**
 * Superficie publica declarada: solo introspeccion de capacidad ya registrada.
 * Any other route group must wire an authorization gate instead of reusing this token.
 */
export const SKILL_CATALOG_PUBLIC_SURFACE = 'read-only-capability-introspection' as const;

export interface SkillCatalogRouteDeps {
  readonly app: Application;
  readonly enforceRateLimit: (
    req: Request,
    res: Response,
    limiter: FixedWindowRateLimiter,
    bucket: string
  ) => boolean;
  readonly rateLimiter: FixedWindowRateLimiter;
  readonly publicSurface: typeof SKILL_CATALOG_PUBLIC_SURFACE;
}

interface SkillView {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly folder: string;
  readonly subfolder: string;
  readonly capability: string;
  readonly capabilityState: CapabilityState;
  readonly skillStatus: IsabellaSkill['status'];
  readonly passesRegistryGate: boolean;
  readonly requiredScopes: readonly string[];
}

function toSkillView(skill: IsabellaSkill): SkillView {
  const capabilityState = capabilityRegistry.stateOf(skill.capability);
  return {
    id: skill.id,
    name: skill.name,
    description: skill.description,
    folder: skill.folder,
    subfolder: skill.subfolder,
    capability: skill.capability,
    capabilityState,
    skillStatus: skill.status,
    passesRegistryGate:
      capabilityRegistry.isOperational(skill.capability) || skill.status === 'experimental',
    requiredScopes: skill.requiredScopes,
  };
}

function catalogBody(): {
  version: string;
  disclosure: string;
  summary: {
    skills: number;
    passingRegistryGate: number;
    blockedByRegistryGate: number;
    capabilityStates: Record<string, CapabilityState>;
  };
  groups: Array<{ folder: string; items: SkillView[] }>;
} {
  const groups = skillGroups().map((group) => ({
    folder: group.folder,
    items: group.items.map(toSkillView),
  }));
  const views = groups.flatMap((group) => group.items);
  const passing = views.filter((view) => view.passesRegistryGate).length;
  const capabilityStates: Record<string, CapabilityState> = {};
  for (const skill of ISABELLA_SKILLS) {
    capabilityStates[skill.capability] = capabilityRegistry.stateOf(skill.capability);
  }
  return {
    version: SKILL_CATALOG_ROUTES_VERSION,
    disclosure: SKILL_CATALOG_DISCLOSURE,
    summary: {
      skills: views.length,
      passingRegistryGate: passing,
      blockedByRegistryGate: views.length - passing,
      capabilityStates,
    },
    groups,
  };
}

export function registerSkillCatalogRoutes(deps: SkillCatalogRouteDeps): void {
  const list: RequestHandler = (req, res) => {
    if (!deps.enforceRateLimit(req, res, deps.rateLimiter, 'skill-catalog')) return;
    res.json(catalogBody());
  };

  const byId: RequestHandler = (req, res) => {
    if (!deps.enforceRateLimit(req, res, deps.rateLimiter, 'skill-catalog')) return;
    const requested = req.params.id ?? '';
    if (!SkillId.safeParse(requested).success) {
      res.status(400).json({ error: 'SKILL_ID_INVALID' });
      return;
    }
    const skill = ISABELLA_SKILLS.find((item) => item.id === requested);
    if (!skill) {
      res.status(404).json({ error: 'SKILL_NOT_FOUND' });
      return;
    }
    res.json({ ...toSkillView(skill), disclosure: SKILL_CATALOG_DISCLOSURE });
  };

  deps.app.get('/api/skills/catalog', list);
  deps.app.get('/api/skills/catalog/:id', byId);
}
