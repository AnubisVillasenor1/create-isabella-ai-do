export interface SafeFetchOptions {
  allowlist: string[];
  timeoutMs?: number;
}

export async function fetchSafeUpstream(
  url: string,
  init: RequestInit = {},
  options: SafeFetchOptions
): Promise<Response> {
  const parsed = new URL(url);
  if (parsed.protocol !== 'https:') throw new Error('FETCH_SAFE: https required');
  if (!options.allowlist.includes(parsed.hostname)) throw new Error('FETCH_SAFE: host not allowed');
  // No redirects
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? 10_000);
  try {
    const res = await fetch(url, { ...init, redirect: 'error', signal: controller.signal });
    return res;
  } finally {
    clearTimeout(timer);
  }
}
