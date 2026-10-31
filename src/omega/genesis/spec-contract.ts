// state: draft | engine-generated — Contrato Anti-Deriva Ω (Documento §XVI · spec↔código).
// AGENTS.md §6: en conflicto entre código y spec gana la spec, y la divergencia se ARCHIVA.
// Este módulo fija la FUENTE CANÓNICA compartida entre el código (`src/skills/foundational.ts`)
// y los contratos abiertos (`openapi/*`, `asyncapi/*`): para cada uno de los cinco skills
// fundacionales declara un slug, un operationId REST, un canal AsyncAPI y su RiskTier. Expone
// verificadores que detectan DERIVA: un skill sin operación publicada, una operación huérfana,
// un canal que no corresponde a su skill, o un RiskTier que cambió sin actualizar la spec. No
// arranca servidor ni abre red: valida estructuras. Un contract-check verde es capacidad
// computacional, NO la afirmación de que un endpoint exista en producción (AGENTS.md §1).
import { FOUNDATIONAL_SKILLS } from '../../skills/foundational';
import { SKILL_CHANNELS, type SkillChannel } from './event-bus';
import type { RiskTier } from '../../authority/method-id';

export const GENESIS_SKILL_SLUGS = ['orion', 'sophia', 'argus', 'mnemos', 'lumen'] as const;
export type GenesisSkillSlug = (typeof GENESIS_SKILL_SLUGS)[number];

export interface SkillOperationSpec {
  readonly slug: GenesisSkillSlug;
  readonly skillId: string;
  readonly methodId: string;
  readonly riskTier: RiskTier;
  readonly operationId: string;
  readonly path: string;
  readonly channel: SkillChannel;
}

/** operationId canónico derivado del slug (estable entre la spec y el código). */
export function operationIdFor(slug: GenesisSkillSlug): string {
  return `invokeGenesis${slug.charAt(0).toUpperCase()}${slug.slice(1)}`;
}

export function pathFor(slug: GenesisSkillSlug): string {
  return `/omega/genesis/skills/${slug}/invoke`;
}

function channelFor(slug: GenesisSkillSlug): SkillChannel | null {
  const needle = `.${slug}.`;
  return (
    ((SKILL_CHANNELS as readonly string[]).find((c) => c.includes(needle)) as
      SkillChannel | undefined) ?? null
  );
}

/**
 * Deriva el contrato canónico: por cada slug busca el skill fundacional cuyo id arranca con
 * ese slug. Si falta o está duplicado, lo registra como problema de deriva en `issues`.
 */
export function deriveSkillContract(): {
  readonly specs: readonly SkillOperationSpec[];
  readonly issues: readonly string[];
} {
  const issues: string[] = [];
  const specs: SkillOperationSpec[] = [];
  for (const slug of GENESIS_SKILL_SLUGS) {
    const matches = FOUNDATIONAL_SKILLS.filter((skill) => skill.id.startsWith(`${slug}_`));
    if (matches.length === 0) {
      issues.push(`SKILL_MISSING: no hay skill fundacional para el slug '${slug}'`);
      continue;
    }
    if (matches.length > 1) {
      issues.push(`SKILL_AMBIGUOUS: ${matches.length} skills para el slug '${slug}'`);
    }
    const skill = matches[0];
    if (!skill) continue;
    const channel = channelFor(slug);
    if (!channel) {
      issues.push(`CHANNEL_MISSING: ningún canal AsyncAPI para el slug '${slug}'`);
      continue;
    }
    specs.push({
      slug,
      skillId: skill.id,
      methodId: skill.methodId,
      riskTier: skill.riskTier,
      operationId: operationIdFor(slug),
      path: pathFor(slug),
      channel,
    });
  }
  // Skills huérfanos: algún skill fundacional cuyo id no arranca con ningún slug conocido.
  for (const skill of FOUNDATIONAL_SKILLS) {
    const known = GENESIS_SKILL_SLUGS.some((slug) => skill.id.startsWith(`${slug}_`));
    if (!known) issues.push(`SKILL_ORPHAN: '${skill.id}' no pertenece a ningún slug canónico`);
  }
  return { specs: Object.freeze(specs), issues: Object.freeze(issues) };
}

export interface ContractCheck {
  readonly ok: boolean;
  readonly issues: readonly string[];
}

/** Verificación interna de que el contrato derivado está libre de deriva. */
export function checkGenesisContract(): ContractCheck {
  const { specs, issues: baseIssues } = deriveSkillContract();
  const issues: string[] = [...baseIssues];
  const seenOps = new Set<string>();
  for (const spec of specs) {
    if (seenOps.has(spec.operationId)) issues.push(`DUPLICATE_OPERATION: ${spec.operationId}`);
    seenOps.add(spec.operationId);
  }
  return Object.freeze({
    ok: issues.length === 0 && specs.length === GENESIS_SKILL_SLUGS.length,
    issues,
  });
}

/**
 * Detecta deriva de la spec OpenAPI: compara la lista de operationIds publicados (tal como
 * aparecen en el YAML) contra los esperados. Devuelve los faltantes y los sobrantes.
 */
export function checkOpenApiDrift(publishedOperationIds: readonly string[]): ContractCheck {
  const { specs } = deriveSkillContract();
  const expected = new Set(specs.map((s) => s.operationId));
  const published = new Set(publishedOperationIds);
  const issues: string[] = [];
  for (const op of expected) if (!published.has(op)) issues.push(`MISSING_OPERATION: ${op}`);
  for (const op of published) if (!expected.has(op)) issues.push(`UNEXPECTED_OPERATION: ${op}`);
  return Object.freeze({ ok: issues.length === 0, issues: Object.freeze(issues) });
}

/**
 * Detecta deriva de la spec AsyncAPI: compara los canales publicados contra los que el
 * contrato canónico requiere (uno por skill).
 */
export function checkAsyncApiDrift(publishedChannels: readonly string[]): ContractCheck {
  const { specs } = deriveSkillContract();
  const expected = new Set<string>(specs.map((s) => s.channel));
  const published = new Set(publishedChannels);
  const issues: string[] = [];
  for (const ch of expected) if (!published.has(ch)) issues.push(`MISSING_CHANNEL: ${ch}`);
  for (const ch of published) if (!expected.has(ch)) issues.push(`UNEXPECTED_CHANNEL: ${ch}`);
  return Object.freeze({ ok: issues.length === 0, issues: Object.freeze(issues) });
}
