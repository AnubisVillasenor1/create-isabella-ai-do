// Ω∞-16 Federated Digital Twin (state: draft | engine-generated).
// Gemelos digitales federados: cada arista de federación sólo se autoriza
// cuando existe una concesión aprobada por un ser humano y no expirada.
// Fail-closed: sin concesión humana vigente y gemelo conocido, no hay arista.

export interface TwinNode {
  id: string;
  capabilities: string[];
  dataResidency: string;
}

export interface FederationGrant {
  fromTwin: string;
  toTwin: string;
  scope: string;
  approvedByHuman: boolean;
  expiresAt?: string;
}

export interface FederationEdge {
  fromTwin: string;
  toTwin: string;
  scope: string;
  authorized: boolean;
  reason: 'authorized' | 'human_approval_required' | 'expired' | 'unknown_twin';
}

export interface FederationView {
  nodes: TwinNode[];
  edges: FederationEdge[];
}

function compare(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function dedupeSorted(values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    if (!seen.has(value)) {
      seen.add(value);
      out.push(value);
    }
  }
  out.sort(compare);
  return out;
}

export function federateDigitalTwins(input: {
  nodes: TwinNode[];
  grants: FederationGrant[];
  now?: string;
}): FederationView {
  const now = input.now ?? new Date().toISOString();
  const ids = new Set<string>();

  for (const node of input.nodes) {
    if (ids.has(node.id)) {
      throw new Error('FEDERATION_DUPLICATE_TWIN');
    }
    ids.add(node.id);
  }

  const nodes: TwinNode[] = input.nodes.map((node) => ({
    id: node.id,
    capabilities: dedupeSorted(node.capabilities),
    dataResidency: node.dataResidency,
  }));
  nodes.sort((a, b) => compare(a.id, b.id));

  const edges: FederationEdge[] = input.grants.map((grant) => {
    let reason: FederationEdge['reason'];
    if (!ids.has(grant.fromTwin) || !ids.has(grant.toTwin)) {
      reason = 'unknown_twin';
    } else if (grant.expiresAt !== undefined && grant.expiresAt <= now) {
      reason = 'expired';
    } else if (!grant.approvedByHuman) {
      reason = 'human_approval_required';
    } else {
      reason = 'authorized';
    }
    return {
      fromTwin: grant.fromTwin,
      toTwin: grant.toTwin,
      scope: grant.scope,
      authorized: reason === 'authorized',
      reason,
    };
  });

  edges.sort(
    (a, b) =>
      compare(a.fromTwin, b.fromTwin) || compare(a.toTwin, b.toTwin) || compare(a.scope, b.scope)
  );

  return { nodes, edges };
}
