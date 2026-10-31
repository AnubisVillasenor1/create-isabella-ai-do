// state: draft | engine-generated — Sociedad de Microagentes Ω∞ (Documento §VI).
// Registro gobernado de microagentes especializados. Cada agente es un nodo del Agent Mesh
// con identidad DID y un trust score individual; la selección es por confianza (no por
// antigüedad). El roster está acotado y el registro es explícito: NO se invocan 100+ agentes
// autónomos aquí — se modela el registro, la confianza y la selección gobernanle. No abre
// red, no ejecuta, no autoriza. Alineado con gobernanza de identidad agentiva (OIDC-A).

export const AGENT_CLUSTERS = [
  'executive',
  'scientific',
  'legal',
  'technological',
  'strategic',
] as const;
export type AgentCluster = (typeof AGENT_CLUSTERS)[number];

export interface AgentProfile {
  readonly did: string;
  readonly role: string;
  readonly cluster: AgentCluster;
  /** Confianza en [0,1]. Un agente sin historial arranca en el umbral mínimo. */
  readonly trustScore: number;
}

export interface SocietySelection {
  readonly agents: readonly AgentProfile[];
  readonly weights: readonly number[];
  readonly meanTrust: number;
}

const DEFAULT_ROSTER: readonly Omit<AgentProfile, 'did' | 'trustScore'>[] = Object.freeze([
  { role: 'executive', cluster: 'executive' },
  { role: 'planner', cluster: 'executive' },
  { role: 'coordinator', cluster: 'executive' },
  { role: 'research', cluster: 'scientific' },
  { role: 'evidence', cluster: 'scientific' },
  { role: 'citation', cluster: 'scientific' },
  { role: 'validation', cluster: 'scientific' },
  { role: 'legal', cluster: 'legal' },
  { role: 'compliance', cluster: 'legal' },
  { role: 'policy', cluster: 'legal' },
  { role: 'architect', cluster: 'technological' },
  { role: 'devops', cluster: 'technological' },
  { role: 'security', cluster: 'technological' },
  { role: 'testing', cluster: 'technological' },
  { role: 'futures', cluster: 'strategic' },
  { role: 'risk', cluster: 'strategic' },
  { role: 'scenario', cluster: 'strategic' },
  { role: 'economic', cluster: 'strategic' },
]);

const MIN_TRUST = 0.5;
const MAX_TRUST = 1;

function clampUnit(value: number): number {
  return Math.max(MIN_TRUST, Math.min(MAX_TRUST, value));
}

/**
 * Sociedad de microagentes acotada. El registro es determinista: `did` se deriva del rol
 * con un prefijo fijo, y la confianza evoluciona por refuerzo positivo/negativo acotado.
 */
export class MicroAgentSociety {
  private readonly agents = new Map<string, AgentProfile>();

  constructor(seedRoster = true) {
    if (seedRoster) {
      for (const entry of DEFAULT_ROSTER) {
        this.register({
          did: didForRole(entry.role),
          role: entry.role,
          cluster: entry.cluster,
          trustScore: MIN_TRUST,
        });
      }
    }
  }

  /** Registra o reemplaza un agente. Rechaza DID/rol vacíos y confianza fuera de rango. */
  register(agent: AgentProfile): void {
    if (!agent.did.trim()) throw new Error('AGENT_DID_REQUIRED');
    if (!agent.role.trim()) throw new Error('AGENT_ROLE_REQUIRED');
    if (!(agent.trustScore >= MIN_TRUST && agent.trustScore <= MAX_TRUST)) {
      throw new Error('AGENT_TRUST_OUT_OF_RANGE');
    }
    this.agents.set(
      agent.did,
      Object.freeze({ ...agent, trustScore: clampUnit(agent.trustScore) })
    );
  }

  size(): number {
    return this.agents.size;
  }

  list(): readonly AgentProfile[] {
    return [...this.agents.values()];
  }

  /** Ajusta la confianza de un agente tras un resultado (refuerzo acotado). */
  recordOutcome(did: string, success: boolean, delta = 0.05): AgentProfile {
    const current = this.agents.get(did);
    if (!current) throw new Error('AGENT_NOT_REGISTERED');
    const next = clampUnit(current.trustScore + (success ? delta : -delta));
    const updated = Object.freeze({ ...current, trustScore: next });
    this.agents.set(did, updated);
    return updated;
  }

  /**
   * Selección por confianza dentro de un clúster (o de toda la sociedad si se omite).
   * Devuelve los `topK` agentes de mayor trust y sus pesos normalizados (suma 1).
   */
  selectByTrust(cluster?: AgentCluster, topK = 3): SocietySelection {
    const pool = cluster ? this.list().filter((a) => a.cluster === cluster) : this.list();
    const ordered = pool
      .slice()
      .sort((a, b) => b.trustScore - a.trustScore || a.did.localeCompare(b.did));
    const chosen = ordered.slice(0, Math.max(0, topK));
    const total = chosen.reduce((acc, a) => acc + a.trustScore, 0);
    const weights = chosen.map((a) => (total === 0 ? 0 : a.trustScore / total));
    const meanTrust = chosen.length === 0 ? 0 : total / chosen.length;
    return Object.freeze({
      agents: Object.freeze(chosen),
      weights: Object.freeze(weights),
      meanTrust,
    });
  }
}

/** DID determinista por rol (namespace soberano de Isabella). */
export function didForRole(role: string): string {
  return `did:isabella:agent:${role}`;
}
