// state: draft | engine-generated — pendiente de revisión humana.
import { SkillId, parseSkillInvocation, type IsabellaSkill } from './skill-registry';

/**
 * Adaptador del catálogo externo `agentic-awesome-skills` (2.877+ `SKILL.md` con
 * frontmatter YAML: name, description, category, risk, source, source_repo, license).
 *
 * Un `SKILL.md` importado es una CAPACIDAD DECLARADA, nunca una autoridad ni un
 * ejecutor: se registra con una capacidad no alta en el capabilityRegistry y estado
 * `unavailable`, para que toda invocación falle cerrado.
 * CAPABILITY ≠ AUTHORITY ≠ EXECUTION.
 *
 * El contenido no se vendoriza en este repositorio: se analiza desde el árbol que el
 * operador instale aparte (MIT + `LICENSE-CONTENT`, y licencias propias por skill).
 */

export const AAS_ID_PREFIX = 'aas:';
/** Capacidad deliberadamente ausente del capabilityRegistry: `stateOf` devuelve `unavailable`. */
export const AAS_CATALOG_CAPABILITY = 'catalog';

const AAS_FOLDER = 'Externos';
const AAS_SUBFOLDER = 'AAS';
/** Reutiliza el scope de lectura ya existente; no se inventa un scope sin puertas que lo respalde. */
const AAS_READ_SCOPE = 'isabella:chat';
const MAX_ID_CHARS = 80;
const MAX_NAME_CHARS = 120;
const MAX_DESCRIPTION_CHARS = 500;
const DEFAULT_MAX_ENTRIES = 200;

export type AasRisk = 'safe' | 'critical' | 'unknown';

/** Mapeable a `assessRisk({ criticality })` de `src/gameover/risk-engine`. */
export type AasCriticality = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export type AasResolutionCode = 'AAS_INVOCATION_INVALID' | 'SKILL_NOT_FOUND' | 'SKILL_UNAVAILABLE';

export interface AasSkillDescriptor {
  readonly name: string;
  readonly description: string;
  readonly category: string | null;
  readonly risk: AasRisk;
  readonly source: string | null;
  readonly sourceRepo: string | null;
  readonly license: string | null;
}

export type ParseFrontmatterResult =
  | { readonly ok: true; readonly descriptor: AasSkillDescriptor }
  | { readonly ok: false; readonly error: string };

export interface AasCatalogEntry {
  readonly skill: IsabellaSkill;
  readonly descriptor: AasSkillDescriptor;
  readonly criticality: AasCriticality;
}

export interface AasCatalogRejection {
  readonly name: string;
  readonly id: string | null;
  readonly reason: string;
}

export interface AasCatalogOptions {
  /**
   * IDs `aas:*` aprobados explícitamente por una persona. Si se suministra, SOLO entran
   * esos ids (incluye `risk: critical` revisado). Si se omite, entran solo `risk: safe`.
   */
  readonly allowlist?: readonly string[];
  readonly maxEntries?: number;
}

export interface AasCatalogResult {
  readonly entries: readonly AasCatalogEntry[];
  readonly rejected: readonly AasCatalogRejection[];
}

const FRONTMATTER_PATTERN = /^\uFEFF?---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/;
const KEY_LINE_PATTERN = /^[ \t]*([A-Za-z0-9_-]+):[ \t]*(.*)$/;
const INDENT_PATTERN = /^[ \t]/;

function unquote(raw: string): string {
  const value = raw.trim();
  if (value.length >= 2) {
    const first = value.charAt(0);
    const last = value.charAt(value.length - 1);
    if ((first === '"' || first === "'") && first === last) return value.slice(1, -1).trim();
  }
  return value;
}

/**
 * Extrae los campos de primer nivel. Las líneas indentadas que no continúan un escalar
 * plegado (`>`, `|`) son mapas anidados (`metadata:`) y se descartan: aplanarlas
 * fabricaría campos que el catálogo nunca declaró.
 */
export function parseAasFrontmatter(raw: string): ParseFrontmatterResult {
  const body = FRONTMATTER_PATTERN.exec(raw)?.[1];
  if (body === undefined) return { ok: false, error: 'AAS_FRONTMATTER_MISSING' };

  const fields = new Map<string, string>();
  let foldingKey: string | null = null;

  for (const line of body.split(/\r?\n/)) {
    if (line.trim() === '') {
      foldingKey = null;
      continue;
    }
    // La continuación de un escalar plegado no tiene dos puntos: se resuelve antes
    // de intentar casar una clave, o el bloque se cortaría contra el primer renglón.
    if (foldingKey !== null && INDENT_PATTERN.test(line)) {
      fields.set(foldingKey, `${fields.get(foldingKey) ?? ''} ${line.trim()}`.trim());
      continue;
    }
    const match = KEY_LINE_PATTERN.exec(line);
    if (!match) {
      foldingKey = null;
      continue;
    }
    if (INDENT_PATTERN.test(line)) continue;
    const [, key, rawValue] = match;
    const value = rawValue.trim();
    if (value.startsWith('>') || value.startsWith('|')) {
      foldingKey = key;
      fields.set(key, '');
    } else {
      foldingKey = null;
      fields.set(key, unquote(value));
    }
  }

  const name = fields.get('name') ?? '';
  const description = fields.get('description') ?? '';
  if (!name) return { ok: false, error: 'AAS_NAME_MISSING' };
  if (!description) return { ok: false, error: 'AAS_DESCRIPTION_MISSING' };

  const declared = (fields.get('risk') ?? '').toLowerCase();
  return {
    ok: true,
    descriptor: {
      name,
      description,
      category: fields.get('category') ?? null,
      // La ausencia de aviso no es un aviso de seguridad: `unknown` se trata como crítico.
      risk: declared === 'safe' ? 'safe' : declared === 'critical' ? 'critical' : 'unknown',
      source: fields.get('source') ?? null,
      sourceRepo: fields.get('source_repo') ?? null,
      license: fields.get('license') ?? null,
    },
  };
}

export function aasRiskToCriticality(risk: AasRisk): AasCriticality {
  return risk === 'safe' ? 'LOW' : 'CRITICAL';
}

/** `SkillId` solo admite `a-z0-9`, `-` y `:`, sin `:`/`-` en los extremos. */
export function aasSkillId(name: string): string | null {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, MAX_ID_CHARS - AAS_ID_PREFIX.length);
  if (!slug) return null;
  const id = `${AAS_ID_PREFIX}${slug}`;
  return SkillId.safeParse(id).success ? id : null;
}

export function toIsabellaSkill(descriptor: AasSkillDescriptor): IsabellaSkill | null {
  const id = aasSkillId(descriptor.name);
  if (!id) return null;
  return {
    id,
    name: descriptor.name.slice(0, MAX_NAME_CHARS),
    description: descriptor.description.slice(0, MAX_DESCRIPTION_CHARS),
    folder: AAS_FOLDER,
    subfolder: AAS_SUBFOLDER,
    capability: AAS_CATALOG_CAPABILITY,
    status: 'unavailable',
    requiredScopes: [AAS_READ_SCOPE],
  };
}

export function buildAasCatalog(
  descriptors: Iterable<AasSkillDescriptor>,
  options: AasCatalogOptions = {}
): AasCatalogResult {
  const maxEntries = options.maxEntries ?? DEFAULT_MAX_ENTRIES;
  const allowlist = options.allowlist ? new Set(options.allowlist) : null;
  const entries: AasCatalogEntry[] = [];
  const rejected: AasCatalogRejection[] = [];
  const seen = new Set<string>();

  for (const descriptor of descriptors) {
    const id = aasSkillId(descriptor.name);
    if (!id) {
      rejected.push({ name: descriptor.name, id: null, reason: 'AAS_ID_INVALID' });
      continue;
    }
    if (seen.has(id)) {
      rejected.push({ name: descriptor.name, id, reason: 'AAS_DUPLICATE_ID' });
      continue;
    }
    if (entries.length >= maxEntries) {
      rejected.push({ name: descriptor.name, id, reason: 'AAS_MAX_ENTRIES_REACHED' });
      continue;
    }
    const approved = allowlist ? allowlist.has(id) : descriptor.risk === 'safe';
    if (!approved) {
      rejected.push({
        name: descriptor.name,
        id,
        reason: descriptor.risk === 'safe' ? 'AAS_NOT_ALLOWLISTED' : 'AAS_RISK_NOT_APPROVED',
      });
      continue;
    }
    const skill = toIsabellaSkill(descriptor);
    if (!skill) {
      rejected.push({ name: descriptor.name, id, reason: 'AAS_ID_INVALID' });
      continue;
    }
    seen.add(id);
    entries.push({ skill, descriptor, criticality: aasRiskToCriticality(descriptor.risk) });
  }

  return { entries, rejected };
}

/**
 * Resuelve una invocación `@aas:<skill>` contra el catálogo. Nunca devuelve un skill
 * ejecutable: una capacidad declarada se contesta `SKILL_UNAVAILABLE`, igual que el
 * gate de `resolveSkillInvocation` cuando el capabilityRegistry no la da de alta.
 */
export function resolveCatalogSkill(
  input: string,
  entries: readonly AasCatalogEntry[]
): { code: AasResolutionCode; error: string } {
  const parsed = parseSkillInvocation(input);
  if (!parsed) return { code: 'AAS_INVOCATION_INVALID', error: 'Invocación de skill no válida.' };
  const entry = entries.find((item) => item.skill.id === parsed.requestedId);
  if (!entry)
    return { code: 'SKILL_NOT_FOUND', error: `Skill no registrado: @${parsed.requestedId}` };
  return {
    code: 'SKILL_UNAVAILABLE',
    error: `Capacidad externa declarada, no ejecutable: @${entry.skill.id}`,
  };
}
