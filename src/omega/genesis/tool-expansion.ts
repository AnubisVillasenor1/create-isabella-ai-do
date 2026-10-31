// state: draft | engine-generated — Expansión gobernada de herramientas a 250 (Documento §X).
// Taxonomía canónica de dominios con sus cuotas (30+35+25+40+20+25+15+20+15+10+10+5 = 250) y
// un REGISTRO acotado: cada dominio no puede superar su cuota y toda herramienta declara un
// RiskTier. La selección prioriza las de menor riesgo (mínima autoridad necesaria). El
// registro modela y acota el catálogo; NO ejecuta herramientas ni abre red. Invocar una
// herramienta gobernada sigue exigiendo CROWN + allowlist reales (src/tools, src/agents).
import type { RiskTier } from '../../authority/method-id';

export interface ToolDomainQuota {
  readonly domain: string;
  readonly quota: number;
  readonly riskFloor: RiskTier;
}

/** Cuotas del Documento §X. La suma es exactamente 250. */
export const TOOL_DOMAIN_QUOTAS: readonly ToolDomainQuota[] = Object.freeze([
  { domain: 'gobernanza', quota: 30, riskFloor: 'HIGH' },
  { domain: 'seguridad', quota: 35, riskFloor: 'HIGH' },
  { domain: 'memoria', quota: 25, riskFloor: 'MEDIUM' },
  { domain: 'agi', quota: 40, riskFloor: 'MEDIUM' },
  { domain: 'moe', quota: 20, riskFloor: 'MEDIUM' },
  { domain: 'investigacion', quota: 25, riskFloor: 'LOW' },
  { domain: 'audio', quota: 15, riskFloor: 'LOW' },
  { domain: 'vision', quota: 20, riskFloor: 'MEDIUM' },
  { domain: 'automatizacion', quota: 15, riskFloor: 'MEDIUM' },
  { domain: 'economia', quota: 10, riskFloor: 'HIGH' },
  { domain: 'observabilidad', quota: 10, riskFloor: 'LOW' },
  { domain: 'compliance', quota: 5, riskFloor: 'HIGH' },
]);

export const TOOL_TAXONOMY_TOTAL = 250;

const RISK_ORDER: readonly RiskTier[] = ['NEGLIGIBLE', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

export function riskRank(risk: RiskTier): number {
  const idx = RISK_ORDER.indexOf(risk);
  return idx < 0 ? RISK_ORDER.length : idx;
}

export interface ToolDescriptor {
  readonly id: string;
  readonly domain: string;
  readonly name: string;
  readonly risk: RiskTier;
}

export interface RegisteredTool extends ToolDescriptor {
  readonly registeredAt: string;
}

/** Suma de cuotas declaradas (para el contrato de que la taxonomía totaliza 250). */
export function totalQuota(): number {
  return TOOL_DOMAIN_QUOTAS.reduce((acc, entry) => acc + entry.quota, 0);
}

function quotaFor(domain: string): ToolDomainQuota | undefined {
  return TOOL_DOMAIN_QUOTAS.find((entry) => entry.domain === domain);
}

/**
 * Registro acotado y determinista. `add` falla si el dominio es desconocido, si se supera la
 * cuota del dominio, si falta id/nombre o si el riesgo declarado queda POR DEBAJO del suelo
 * del dominio (no se subdeclara el riesgo en dominios sensibles).
 */
export class GovernedToolRegistry {
  private readonly tools = new Map<string, RegisteredTool>();

  add(tool: ToolDescriptor, clock: () => string = () => new Date().toISOString()): RegisteredTool {
    if (!tool.id.trim()) throw new Error('TOOL_ID_REQUIRED');
    if (!tool.name.trim()) throw new Error('TOOL_NAME_REQUIRED');
    const domain = quotaFor(tool.domain);
    if (!domain) throw new Error('TOOL_DOMAIN_UNKNOWN');
    if (riskRank(tool.risk) < riskRank(domain.riskFloor)) {
      // No se permite SUBDECLARAR el riesgo en un dominio sensible: gobernanza/seguridad/economía
      // exigen una clasificación mínima coherente con su impacto.
      throw new Error('TOOL_RISK_BELOW_DOMAIN_FLOOR');
    }
    const inDomain = [...this.tools.values()].filter((t) => t.domain === tool.domain).length;
    if (!this.tools.has(tool.id) && inDomain >= domain.quota) {
      throw new Error('TOOL_DOMAIN_QUOTA_EXCEEDED');
    }
    const registered: RegisteredTool = Object.freeze({ ...tool, registeredAt: clock() });
    this.tools.set(tool.id, registered);
    return registered;
  }

  size(): number {
    return this.tools.size;
  }

  list(): readonly RegisteredTool[] {
    return [...this.tools.values()];
  }

  countInDomain(domain: string): number {
    return [...this.tools.values()].filter((t) => t.domain === domain).length;
  }

  /**
   * Selecciona hasta `max` herramientas de un dominio priorizando MENOR riesgo (mínima
   * autoridad necesaria). Con `allowHighRisk=false` excluye HIGH y CRITICAL.
   */
  selectForDomain(domain: string, max = 5, allowHighRisk = true): readonly RegisteredTool[] {
    const pool = this.list().filter((t) => t.domain === domain);
    const safe = allowHighRisk ? pool : pool.filter((t) => riskRank(t.risk) < riskRank('HIGH'));
    return Object.freeze(
      safe
        .slice()
        .sort((a, b) => riskRank(a.risk) - riskRank(b.risk) || a.id.localeCompare(b.id))
        .slice(0, Math.max(0, max))
    );
  }
}
