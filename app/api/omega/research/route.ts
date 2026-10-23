import { createHash } from "node:crypto";
import { jsonResponse, safeTokenMatch } from "@/lib/isabella/omega/core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function hash(value: string) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

export async function POST(request: Request) {
  const supplied = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? null;
  if (!safeTokenMatch(supplied, process.env.ISABELLA_OMEGA_API_TOKEN)) return jsonResponse({ error: "unauthorized" }, 401);

  let body: Record<string, unknown>;
  try {
    const parsed: unknown = await request.json();
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return jsonResponse({ error: "invalid_body" }, 400);
    body = parsed as Record<string, unknown>;
  } catch {
    return jsonResponse({ error: "invalid_json" }, 400);
  }

  const title = typeof body.title === "string" ? body.title.trim() : "";
  const claims = Array.isArray(body.claims) ? body.claims : [];
  const sources = Array.isArray(body.sources) ? body.sources : [];
  if (!title || title.length > 240) return jsonResponse({ error: "invalid_title" }, 400);
  if (claims.length > 200 || sources.length > 200) return jsonResponse({ error: "too_many_items" }, 400);
  const serialized = JSON.stringify({ title, claims, sources });
  if (serialized.length > 80_000) return jsonResponse({ error: "research_object_too_large" }, 413);

  const sourceIds = sources.map((source, index) => {
    const normalized = typeof source === "object" && source !== null ? source as Record<string, unknown> : { value: source };
    return {
      index,
      title: typeof normalized.title === "string" ? normalized.title.slice(0, 500) : null,
      url: typeof normalized.url === "string" ? normalized.url.slice(0, 2048) : null,
      sha256: hash(JSON.stringify(source)),
    };
  });
  const claimChecks = claims.map((claim, index) => ({
    index,
    claimSha256: hash(JSON.stringify(claim)),
    status: "unverified" as const,
    note: "Hashing proves content identity only; it does not establish truth or source authenticity.",
  }));

  return jsonResponse({
    researchId: hash(serialized),
    title,
    status: "draft_unverified",
    sourceCount: sources.length,
    claimCount: claims.length,
    sourceIds,
    claimChecks,
    verified: false,
    generatedAt: new Date().toISOString(),
  }, 200);
}
