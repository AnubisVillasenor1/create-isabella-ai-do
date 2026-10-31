/**
 * Cognitive Capital Market — mercado de activos cognitivos (state: draft | engine-generated).
 *
 * Evolución del IMF Ω∞: comercia conocimiento, experiencia, simulaciones, modelos, workflows, gemelos
 * digitales, ontologías, políticas y evaluaciones. Intelligence-as-an-Asset → Cognitive-Capital-as-a-Service.
 *
 * CAPABILITY ≠ AUTHORITY ≠ EXECUTION ≠ EVIDENCE ≠ LEARNING ≠ PRODUCTION.
 */
export type CognitiveAssetType =
  | 'knowledge'
  | 'experience'
  | 'simulation'
  | 'model'
  | 'workflow'
  | 'digital-twin'
  | 'ontology'
  | 'policy'
  | 'evaluation';

export interface CognitiveAsset {
  readonly id: string;
  readonly type: CognitiveAssetType;
  readonly owner: string;
  readonly title: string;
  readonly valuation: number;
  readonly currency: string;
  readonly metadata: Readonly<Record<string, unknown>>;
  readonly createdAt: string;
  readonly status: 'listed' | 'sold' | 'retired';
}

export interface TradeRecord {
  readonly id: string;
  readonly assetId: string;
  readonly buyer: string;
  readonly seller: string;
  readonly price: number;
  readonly currency: string;
  readonly timestamp: string;
  readonly royaltyBps: number;
}

export class CognitiveCapitalMarket {
  private readonly assets = new Map<string, CognitiveAsset>();
  private readonly trades: TradeRecord[] = [];
  private seq = 0;

  listAsset(input: {
    id: string;
    type: CognitiveAssetType;
    owner: string;
    title: string;
    valuation: number;
    currency?: string;
    metadata?: Record<string, unknown>;
  }): CognitiveAsset {
    if (typeof input.id !== 'string' || input.id.length === 0)
      throw new RangeError('CCM: id required');
    if (typeof input.owner !== 'string' || input.owner.length === 0)
      throw new RangeError('CCM: owner required');
    if (typeof input.title !== 'string' || input.title.length === 0)
      throw new RangeError('CCM: title required');
    if (!Number.isFinite(input.valuation) || input.valuation < 0)
      throw new RangeError('CCM: valuation must be >= 0');
    if (this.assets.has(input.id)) throw new RangeError('CCM: duplicate asset id');
    const asset: CognitiveAsset = {
      id: input.id,
      type: input.type,
      owner: input.owner,
      title: input.title,
      valuation: input.valuation,
      currency: input.currency ?? 'USD',
      metadata: Object.freeze({ ...(input.metadata ?? {}) }),
      createdAt: new Date().toISOString(),
      status: 'listed',
    };
    this.assets.set(asset.id, asset);
    return asset;
  }

  get(id: string): CognitiveAsset | undefined {
    return this.assets.get(id);
  }

  search(filter: {
    type?: CognitiveAssetType;
    owner?: string;
    minValuation?: number;
    maxValuation?: number;
  }): readonly CognitiveAsset[] {
    let out = [...this.assets.values()].filter((a) => a.status === 'listed');
    if (filter.type !== undefined) out = out.filter((a) => a.type === filter.type);
    if (filter.owner !== undefined) out = out.filter((a) => a.owner === filter.owner);
    if (filter.minValuation !== undefined)
      out = out.filter((a) => a.valuation >= filter.minValuation!);
    if (filter.maxValuation !== undefined)
      out = out.filter((a) => a.valuation <= filter.maxValuation!);
    return out;
  }

  trade(assetId: string, buyer: string, price: number, royaltyBps = 250): TradeRecord {
    const asset = this.assets.get(assetId);
    if (asset === undefined) throw new RangeError('CCM: unknown asset');
    if (asset.status !== 'listed') throw new RangeError('CCM: asset not listed');
    if (typeof buyer !== 'string' || buyer.length === 0)
      throw new RangeError('CCM: buyer required');
    if (!Number.isFinite(price) || price < 0) throw new RangeError('CCM: price must be >= 0');
    if (!Number.isInteger(royaltyBps) || royaltyBps < 0 || royaltyBps > 10000)
      throw new RangeError('CCM: royaltyBps 0..10000');
    const trade: TradeRecord = {
      id: `trade-${(this.seq += 1)}`,
      assetId,
      buyer,
      seller: asset.owner,
      price,
      currency: asset.currency,
      timestamp: new Date().toISOString(),
      royaltyBps,
    };
    this.trades.push(trade);
    this.assets.set(assetId, { ...asset, status: 'sold' });
    return trade;
  }

  retire(assetId: string): CognitiveAsset {
    const asset = this.assets.get(assetId);
    if (asset === undefined) throw new RangeError('CCM: unknown asset');
    const retired: CognitiveAsset = { ...asset, status: 'retired' };
    this.assets.set(assetId, retired);
    return retired;
  }

  portfolio(owner: string): readonly CognitiveAsset[] {
    return [...this.assets.values()].filter((a) => a.owner === owner);
  }

  tradesFor(assetId: string): readonly TradeRecord[] {
    return this.trades.filter((t) => t.assetId === assetId);
  }

  stats(): { assets: number; listed: number; sold: number; trades: number; volume: number } {
    const all = [...this.assets.values()];
    return {
      assets: all.length,
      listed: all.filter((a) => a.status === 'listed').length,
      sold: all.filter((a) => a.status === 'sold').length,
      trades: this.trades.length,
      volume: this.trades.reduce((s, t) => s + t.price, 0),
    };
  }
}
