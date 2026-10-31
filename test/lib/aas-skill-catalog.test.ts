// state: draft | engine-generated — pendiente de revisión humana.
import { describe, expect, it } from 'vitest';
import {
  AAS_CATALOG_CAPABILITY,
  aasRiskToCriticality,
  aasSkillId,
  buildAasCatalog,
  parseAasFrontmatter,
  resolveCatalogSkill,
  toIsabellaSkill,
  type AasCatalogEntry,
  type AasSkillDescriptor,
} from '../../src/lib/lib/aas-skill-catalog';
import { SkillId } from '../../src/lib/lib/skill-registry';

function descriptor(overrides: Partial<AasSkillDescriptor> = {}): AasSkillDescriptor {
  return {
    name: 'jq',
    description: 'Expert jq usage for JSON querying.',
    category: 'development',
    risk: 'safe',
    source: 'community',
    sourceRepo: null,
    license: null,
    ...overrides,
  };
}

function parseFailureCode(input: string): string {
  const parsed = parseAasFrontmatter(input);
  if (parsed.ok) throw new Error('se esperaba un fallo de parseo');
  return parsed.error;
}

function parseSafeSkillFrontmatter() {
  return parseAasFrontmatter(
    [
      '---',
      'name: jq',
      'description: "Expert jq usage for JSON querying, filtering, transformation."',
      'category: development',
      'risk: safe',
      'source: community',
      'date_added: "2026-03-28"',
      '---',
      '# jq',
    ].join('\n')
  );
}

describe('AAS frontmatter parser', () => {
  it('lee el frontmatter real de una skill segura', () => {
    const parsed = parseSafeSkillFrontmatter();
    if (!parsed.ok) throw new Error(`unexpected parse failure: ${parsed.error}`);
    expect(parsed.descriptor).toEqual({
      name: 'jq',
      description: 'Expert jq usage for JSON querying, filtering, transformation.',
      category: 'development',
      risk: 'safe',
      source: 'community',
      sourceRepo: null,
      license: null,
    });
  });

  it('plega una descripción multilínea con `>`', () => {
    const parsed = parseAasFrontmatter(
      [
        '---',
        'name: moyu',
        'description: >',
        '  Anti-over-engineering guardrail that activates',
        '  when an agent expands scope.',
        'risk: safe',
        'source: community',
        '---',
        'body',
      ].join('\n')
    );
    if (!parsed.ok) throw new Error(`unexpected parse failure: ${parsed.error}`);
    expect(parsed.descriptor.name).toBe('moyu');
    expect(parsed.descriptor.description).toBe(
      'Anti-over-engineering guardrail that activates when an agent expands scope.'
    );
  });

  it('no aplana mapas anidados y conserva la licencia upstream', () => {
    const parsed = parseAasFrontmatter(
      [
        '---',
        'name: cirq',
        'description: Quantum circuits.',
        'license: Apache-2.0 license',
        'metadata:',
        '    skill-author: K-Dense Inc.',
        'risk: critical',
        '---',
      ].join('\n')
    );
    if (!parsed.ok) throw new Error(`unexpected parse failure: ${parsed.error}`);
    expect(parsed.descriptor.license).toBe('Apache-2.0 license');
    expect(parsed.descriptor.risk).toBe('critical');
    expect(parsed.descriptor.category).toBeNull();
  });

  it('falla cerrado sin frontmatter, sin nombre o sin descripción', () => {
    expect(parseAasFrontmatter('sin frontmatter')).toEqual({
      ok: false,
      error: 'AAS_FRONTMATTER_MISSING',
    });
    expect(parseFailureCode('---\nrisk: safe\n---\n')).toBe('AAS_NAME_MISSING');
    expect(parseFailureCode('---\nname: x\n---\n')).toBe('AAS_DESCRIPTION_MISSING');
  });

  it('trata un riesgo ausente o ilegible como no seguro', () => {
    const parsed = parseAasFrontmatter('---\nname: x\ndescription: y\nrisk: maybe\n---\n');
    if (!parsed.ok) throw new Error(`unexpected parse failure: ${parsed.error}`);
    expect(parsed.descriptor.risk).toBe('unknown');
    expect(aasRiskToCriticality(parsed.descriptor.risk)).toBe('CRITICAL');
    expect(aasRiskToCriticality('safe')).toBe('LOW');
  });
});

describe('AAS identifiers', () => {
  it('normaliza nombres a ids admisibles por SkillId', () => {
    expect(aasSkillId('jq')).toBe('aas:jq');
    expect(aasSkillId('007')).toBe('aas:007');
    expect(aasSkillId('Foo Bar!')).toBe('aas:foo-bar');
    expect(aasSkillId('  --weird--  ')).toBe('aas:weird');
  });

  it('rechaza nombres sin caracteres admisibles', () => {
    expect(aasSkillId('---')).toBeNull();
    expect(aasSkillId('日本語')).toBeNull();
  });
});

describe('AAS a IsabellaSkill', () => {
  it('registra la skill externa como capacidad declarada y no operativa', () => {
    const parsed = parseSafeSkillFrontmatter();
    if (!parsed.ok) throw new Error(`unexpected parse failure: ${parsed.error}`);
    const skill = toIsabellaSkill(parsed.descriptor);
    if (!skill) throw new Error('unexpected id rejection');
    expect(skill.id).toBe('aas:jq');
    expect(skill.status).toBe('unavailable');
    expect(skill.capability).toBe(AAS_CATALOG_CAPABILITY);
    expect(SkillId.safeParse(skill.id).success).toBe(true);
  });
});

describe('buildAasCatalog', () => {
  it('sin allowlist admite solo riesgo safe', () => {
    const catalog = buildAasCatalog([
      descriptor(),
      descriptor({ name: 'lex', risk: 'critical' }),
      descriptor({ name: 'moyu', risk: 'unknown' }),
    ]);
    expect(catalog.entries.map((entry) => entry.skill.id)).toEqual(['aas:jq']);
    expect(catalog.rejected.map((rejection) => rejection.reason)).toEqual([
      'AAS_RISK_NOT_APPROVED',
      'AAS_RISK_NOT_APPROVED',
    ]);
  });

  it('con allowlist solo admite lo aprobado, incluso crítico revisado', () => {
    const catalog = buildAasCatalog(
      [descriptor(), descriptor({ name: 'lex', risk: 'critical' }), descriptor({ name: 'tmux' })],
      { allowlist: ['aas:lex'] }
    );
    expect(catalog.entries.map((entry) => entry.skill.id)).toEqual(['aas:lex']);
    expect(catalog.entries[0]?.criticality).toBe('CRITICAL');
    expect(catalog.rejected.map((rejection) => rejection.reason)).toEqual([
      'AAS_NOT_ALLOWLISTED',
      'AAS_NOT_ALLOWLISTED',
    ]);
  });

  it('rechaza duplicados e ids inválidos y respeta el tope', () => {
    const catalog = buildAasCatalog(
      [descriptor(), descriptor(), descriptor({ name: '日本語' }), descriptor({ name: 'tmux' })],
      { maxEntries: 1 }
    );
    expect(catalog.entries).toHaveLength(1);
    expect(catalog.rejected.map((rejection) => rejection.reason)).toEqual([
      'AAS_DUPLICATE_ID',
      'AAS_ID_INVALID',
      'AAS_MAX_ENTRIES_REACHED',
    ]);
  });
});

describe('resolveCatalogSkill', () => {
  const built = toIsabellaSkill(descriptor());
  const catalog: readonly AasCatalogEntry[] = built
    ? [{ skill: built, descriptor: descriptor(), criticality: 'LOW' }]
    : [];

  it('una skill externa declarada jamás se ejecuta', () => {
    expect(resolveCatalogSkill('@aas:jq filtra este json', catalog).code).toBe('SKILL_UNAVAILABLE');
  });

  it('distingue skill desconocida de invocación inválida', () => {
    expect(resolveCatalogSkill('@aas:inexistente', catalog).code).toBe('SKILL_NOT_FOUND');
    expect(resolveCatalogSkill('sin trigger', catalog).code).toBe('AAS_INVOCATION_INVALID');
  });
});
