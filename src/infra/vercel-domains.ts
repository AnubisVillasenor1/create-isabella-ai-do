export interface DomainSearchResult {
  domain: string;
  available: boolean;
  price?: number;
  renewalPrice?: number;
}

export async function searchDomains(domains: string[]): Promise<DomainSearchResult[]> {
  const res = await fetch('https://api.vercel.com/v1/registrar/domains/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ domains: domains.slice(0, 200) }),
  });
  if (!res.ok) throw new Error(`VERCEL_DOMAIN_SEARCH_${res.status}`);
  const data = (await res.json()) as {
    results?: Array<{ domain: string; available: boolean; price?: number; renewalPrice?: number }>;
  };
  return (data.results ?? []).map((r) => ({
    domain: r.domain,
    available: r.available,
    price: r.price,
    renewalPrice: r.renewalPrice,
  }));
}
