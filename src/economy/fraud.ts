import { assessFraud, type FraudInput } from '../commerce/anti-fraud';
import type { CommerceRiskLevel, FraudVerdict } from '../commerce/types';

// SCER Fraud Graph (state: draft | engine-generated).
// Analiza entidades y relaciones (cuentas, dispositivos, IPs, pagos, correos) para
// detectar colusión. Construye componentes conexas y alimenta el veredicto del
// motor antifraude existente (src/commerce/anti-fraud.ts). Analizar NO sanciona:
// sólo eleva la revisión humana (fail-closed hacia revisión, nunca hacia cobro).

export type FraudEntityKind = 'account' | 'device' | 'payment' | 'ip' | 'email';

export interface FraudEntity {
  readonly id: string;
  readonly kind: FraudEntityKind;
}

export type FraudRelation =
  'shares_device' | 'shares_ip' | 'shares_card' | 'shares_email' | 'referred';

export interface FraudEdge {
  readonly from: string;
  readonly to: string;
  readonly relation: FraudRelation;
}

export interface FraudCluster {
  readonly entities: readonly string[];
  readonly accounts: number;
  readonly risk: CommerceRiskLevel;
}

export interface FraudAnalysis {
  readonly verdict: FraudVerdict;
  readonly clusters: readonly FraudCluster[];
  readonly metrics: Readonly<{ entities: number; clusters: number; linkedAccounts: number }>;
  readonly analyzedAt: string;
}

const KINDS: readonly FraudEntityKind[] = ['account', 'device', 'payment', 'ip', 'email'];
const RELATIONS: readonly FraudRelation[] = [
  'shares_device',
  'shares_ip',
  'shares_card',
  'shares_email',
  'referred',
];

function clusterRisk(accounts: number): CommerceRiskLevel {
  if (accounts >= 5) return 'high';
  if (accounts >= 3) return 'medium';
  return 'low';
}

/**
 * Analiza el grafo antifraude. Determinista. Deriva señales estructurales
 * (cuentas relacionadas, reutilización de credenciales, clics automatizados) y
 * las entrega al veredicto antifraude; nunca decide irreversiblemente.
 */
export function analyzeFraudGraph(
  entities: readonly FraudEntity[],
  edges: readonly FraudEdge[],
  clock: () => string = () => new Date().toISOString()
): FraudAnalysis {
  if (!Array.isArray(entities) || entities.length === 0) {
    throw new Error('FRAUD_ENTITIES_REQUIRED');
  }
  const kindOf = new Map<string, FraudEntityKind>();
  for (const entity of entities) {
    if (typeof entity.id !== 'string' || entity.id.trim() === '')
      throw new Error('FRAUD_ENTITY_ID_REQUIRED');
    if (!KINDS.includes(entity.kind))
      throw new Error(`FRAUD_ENTITY_KIND_INVALID:${String(entity.kind)}`);
    if (kindOf.has(entity.id)) throw new Error(`FRAUD_ENTITY_DUPLICATE:${entity.id}`);
    kindOf.set(entity.id, entity.kind);
  }

  const parent = new Map<string, string>();
  const find = (x: string): string => {
    let root = x;
    while (parent.get(root) !== root) root = parent.get(root) as string;
    return root;
  };
  const union = (a: string, b: string): void => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent.set(ra, rb);
  };
  for (const id of kindOf.keys()) parent.set(id, id);

  for (const edge of edges) {
    if (!RELATIONS.includes(edge.relation))
      throw new Error(`FRAUD_RELATION_INVALID:${String(edge.relation)}`);
    if (!kindOf.has(edge.from) || !kindOf.has(edge.to))
      throw new Error('FRAUD_EDGE_UNKNOWN_ENTITY');
    union(edge.from, edge.to);
  }

  const groups = new Map<string, string[]>();
  for (const id of kindOf.keys()) {
    const root = find(id);
    let members = groups.get(root);
    if (!members) {
      members = [];
      groups.set(root, members);
    }
    members.push(id);
  }

  let linkedAccounts = 0;
  let credentialReuse = false;
  let automatedClicks = false;
  const clusters: FraudCluster[] = [];
  for (const root of [...groups.keys()].sort()) {
    const members = (groups.get(root) as string[]).slice().sort();
    const accounts = members.filter((id) => kindOf.get(id) === 'account').length;
    const devices = members.filter((id) => kindOf.get(id) === 'device').length;
    const payments = members.filter((id) => kindOf.get(id) === 'payment').length;
    if (accounts >= 2) linkedAccounts += accounts - 1;
    if (accounts >= 3 && devices >= 1) credentialReuse = true;
    if (accounts >= 2 && payments >= 1) credentialReuse = true;
    if (accounts >= 5 && devices >= 1) automatedClicks = true;
    clusters.push({ entities: members, accounts, risk: clusterRisk(accounts) });
  }

  const signals: FraudInput = {
    relatedAccounts: linkedAccounts >= 1,
    credentialReuse,
    automatedClicks,
  };
  const verdict = assessFraud(signals);

  return {
    verdict,
    clusters,
    metrics: { entities: kindOf.size, clusters: clusters.length, linkedAccounts },
    analyzedAt: clock(),
  };
}
