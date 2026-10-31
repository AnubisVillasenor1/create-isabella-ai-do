import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import { IsabellaGenesisRuntime } from '../../src/genesis/runtime';
import { EXPERT_REGISTRY } from '../../src/cognition/experts';
import {
  UNIVERSE_STATE_LEGEND,
  buildUniverseSnapshot,
  federationsOf,
  riskTierDistribution,
} from '../../src/genesis/universe';

/**
 * state: draft | engine-generated — El mapa del hero solo es honesto si su fuente lo es.
 * `src/server.ts` llegó a publicar `toolsCount: 2` cuando el registro tenía decenas de herramientas
 * y `crown: 'ACTIVE'` sin ninguna sonda. Este archivo fija la regla contraria: los conteos se
 * derivan de lo que entra y ningún motor puede llamarse "ACTIVE" por decreto.
 */

const NODES = [
  { id: 'ALPHA', name: 'Alpha', role: 'prueba', federation: 'FED-2 B', status: 'DECLARED', weight: 0.9, icon: 'a' },
  { id: 'BRAVO', name: 'Bravo', role: 'prueba', federation: 'FED-1 A', status: 'DECLARED', weight: 0.5, icon: 'b' },
  { id: 'CHARLIE', name: 'Charlie', role: 'prueba', federation: 'FED-1 A', status: 'ACTIVE', weight: 1, icon: 'c' },
];

function sources(overrides: Record<string, unknown> = {}) {
  return {
    crownNodes: NODES,
    experts: [
      { id: 'E00_IDENTITY', riskCeiling: 'MEDIUM' },
      { id: 'E01_SECURITY', riskCeiling: 'HIGH' },
    ],
    toolRiskTiers: ['LOW', 'LOW', 'CRITICAL'],
    capabilityDescriptors: [{ id: 'cap-1', domain: 'GOVERNANCE', riskTier: 'LOW' }],
    counts: { skills: 4, modules: 5, protocols: 6, customizations: 7, memoryClaims: 8 },
    toolEvidence: {
      configured: true,
      sealedEvents: 2,
      sealFailures: 0,
      withheldResults: 0,
      tools: 3,
    },
    blackout: { envFlag: false, haltCount: 0 },
    bookpi: {
      backend: 'VOLATILE_IN_MEMORY_HASH_CHAIN',
      durability: 'PROCESS_MEMORY_NOT_DURABLE',
    },
    quantumDescription: { backend: 'LOCAL_SIMULATION' },
    ikesPersistenceConfigured: false,
    ...overrides,
  };
}

const subsystem = (snapshot: ReturnType<typeof buildUniverseSnapshot>, id: string) => {
  const entry = snapshot.subsystems.find((item) => item.id === id);
  if (entry === undefined) throw new Error(`subsystem ${id} missing`);
  return entry;
};

describe('universo observable del mapa', () => {
  it('deriva cada conteo de las entradas: no hay números hardcodeados', () => {
    const three = buildUniverseSnapshot(sources());
    expect(three.counts.tools).toBe(3);
    expect(subsystem(three, 'tools').count).toBe(3);

    const eleven = buildUniverseSnapshot(sources({ toolRiskTiers: Array.from({ length: 11 }, () => 'LOW') }));
    expect(eleven.counts.tools).toBe(11);
    expect(subsystem(eleven, 'tools').count).toBe(11);

    expect(buildUniverseSnapshot(sources({ counts: { ...sources().counts, skills: 99 } })).counts.skills).toBe(99);
    expect(subsystem(three, 'experts').count).toBe(2);
    expect(subsystem(three, 'crownNodes').count).toBe(NODES.length);
  });

  it('ningún motor se declara ACTIVE por decreto y el PDP no cableado se nombra como tal', () => {
    const snapshot = buildUniverseSnapshot(sources());
    const declared = Object.values(snapshot.engineStates).filter((value) => typeof value === 'string');
    expect(declared.length).toBeGreaterThan(4);
    for (const value of declared) expect(value).not.toBe('ACTIVE');
    expect(snapshot.engineStates.pdp).toBe('MODULE_NOT_WIRED_TO_HTTP');
    expect(snapshot.engineStates.crown).toBe('WIRED_RUNTIME_DECISION');
    expect(snapshot.engineStates.aegis).toBe('WIRED_TOOL_GUARD');
  });

  it('todo estado con nombre existe en la leyenda: el mapa no puede inventar categorías', () => {
    const snapshot = buildUniverseSnapshot(sources());
    const legend = snapshot.stateLegend as Record<string, string>;
    for (const item of snapshot.subsystems) {
      expect(Object.keys(legend)).toContain(item.state);
    }
    for (const key of [
      'crown',
      'aegis',
      'ikes',
      'veritas',
      'pdp',
      'litleTrustFabric',
      'blackout',
      'ikesPersistence',
    ] as const) {
      expect(Object.keys(legend)).toContain(String(snapshot.engineStates[key]));
    }
  });

  it('reporta el apagado gobernable según el estado real del interruptor', () => {
    expect(buildUniverseSnapshot(sources()).engineStates.blackout).toBe('NOT_HALTED');
    expect(buildUniverseSnapshot(sources({ blackout: { envFlag: false, haltCount: 2 } })).engineStates.blackout).toBe(
      'HALTED'
    );
    const env = buildUniverseSnapshot(sources({ blackout: { envFlag: true, haltCount: 0 } }));
    expect(env.engineStates.blackout).toBe('ENV_HALT_ENGAGED');
    expect(env.engineStates.blackoutHalts).toBe(0);
  });

  it('distingue memoria volátil de puerto configurado, sin afirmar durabilidad externa', () => {
    const volatileSnapshot = buildUniverseSnapshot(sources());
    expect(volatileSnapshot.engineStates.ikesPersistence).toBe('VOLATILE_IN_PROCESS');
    expect(subsystem(volatileSnapshot, 'memory').state).toBe('VOLATILE_IN_PROCESS');

    const configured = buildUniverseSnapshot(sources({ ikesPersistenceConfigured: true }));
    expect(configured.engineStates.ikesPersistence).toBe('SUPABASE_CONFIGURED_NOT_PROBED_HERE');
    expect(subsystem(configured, 'memory').state).toBe('SUPABASE_CONFIGURED_NOT_PROBED_HERE');
  });

  it('agrupa federaciones derivadas y ordenadas sin perder nodos', () => {
    const groups = federationsOf(NODES);
    expect(groups.map((group) => group.label)).toEqual(['FED-1 A', 'FED-2 B']);
    expect(groups[0]?.nodes).toEqual(['BRAVO', 'CHARLIE']);
    const total = groups.reduce((sum, group) => sum + group.nodes.length, 0);
    expect(total).toBe(NODES.length);
    expect(buildUniverseSnapshot(sources()).federations).toEqual(groups);
  });

  it('ordena la distribución de riesgo y suma exactamente una vez por herramienta', () => {
    const distribution = riskTierDistribution(['LOW', 'CRITICAL', 'LOW', 'HIGH']);
    expect(Object.keys(distribution)).toEqual(['CRITICAL', 'HIGH', 'LOW']);
    expect(Object.values(distribution).reduce((a, b) => a + b, 0)).toBe(4);
  });

  it('es determinista: la misma entrada produce el mismo snapshot', () => {
    const a = buildUniverseSnapshot(sources());
    const b = buildUniverseSnapshot(sources());
    expect(JSON.stringify(a)).toEqual(JSON.stringify(b));
  });

  it('el plano y su cliente no usan Math.random: la única aleatoriedad admitida es el ruido decorativo del chat', () => {
    const plan = fs.readFileSync(new URL('../../src/genesis/universe.ts', import.meta.url), 'utf8');
    const client = fs.readFileSync(new URL('../../src/ui/universe-map.js', import.meta.url), 'utf8');
    expect(plan).not.toContain('Math.random');
    expect(client).not.toContain('Math.random');
  });

  it('con los registros reales del runtime el conteo de herramientas no es un dígito inventado', () => {
    const runtime = new IsabellaGenesisRuntime();
    const tools = runtime.tools.list();
    const snapshot = buildUniverseSnapshot(
      sources({
        toolRiskTiers: tools.map((tool) => String(tool.riskTier)),
        experts: EXPERT_REGISTRY,
        capabilityDescriptors: runtime.capabilities
          .list()
          .map((item) => ({ id: item.id, domain: item.domain, riskTier: item.riskTier })),
        counts: {
          skills: runtime.skills.list().length,
          modules: runtime.modules.list().length,
          protocols: runtime.protocols.list().length,
          customizations: runtime.customizations.list().length,
          memoryClaims: runtime.memory.listClaims().length,
        },
        toolEvidence: runtime.tools.diagnostics(),
      })
    );
    expect(tools.length).toBeGreaterThan(2);
    expect(snapshot.counts.tools).toBe(tools.length);
    expect(snapshot.evidence.tools).toBe(tools.length);
    expect(snapshot.expertModules).toHaveLength(EXPERT_REGISTRY.length);
    expect(Object.values(snapshot.toolsByRiskTier).reduce((a, b) => a + b, 0)).toBe(tools.length);
  });
});
