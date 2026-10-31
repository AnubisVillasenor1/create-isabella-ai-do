export async function resolveSupabaseUserId(request: {
  headers: { authorization?: string | string[] };
}): Promise<string | null> {
  const rawAuthorization = request.headers.authorization;
  const authorization = Array.isArray(rawAuthorization) ? rawAuthorization[0] : rawAuthorization;
  const token = authorization?.replace(/^Bearer\s+/i, '').trim();
  const supabaseUrl = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY;
  if (!token || !supabaseUrl || !anonKey) return null;

  try {
    const response = await fetch(supabaseUrl.replace(/\/$/, '') + '/auth/v1/user', {
      headers: { apikey: anonKey, Authorization: 'Bearer ' + token },
      cache: 'no-store',
      signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok) return null;
    const user = (await response.json()) as { id?: string };
    return typeof user.id === 'string' && user.id.length > 0 ? user.id : null;
  } catch {
    return null;
  }
}
