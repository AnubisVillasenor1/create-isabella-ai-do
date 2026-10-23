export type SupabaseIdentity = { id: string; email: string | null };

export async function authenticateSupabaseRequest(request: Request): Promise<SupabaseIdentity | null> {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
  const url = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!token || !url || !anonKey) return null;

  try {
    const response = await fetch(`${url.replace(/\/$/, "")}/auth/v1/user`, {
      headers: { apikey: anonKey, Authorization: `Bearer ${token}` },
      cache: "no-store",
      signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok) return null;
    const user = await response.json() as { id?: string; email?: string };
    if (typeof user.id !== "string" || user.id.length < 1) return null;
    return { id: user.id, email: typeof user.email === "string" ? user.email : null };
  } catch {
    return null;
  }
}
