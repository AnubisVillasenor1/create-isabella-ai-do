import { jsonResponse, safeTokenMatch } from "@/lib/isabella/omega/core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const styles: Record<string, { bpm: number; mood: string; instruments: string[] }> = {
  pop: { bpm: 108, mood: "uplifting", instruments: ["drums", "bass", "synth", "guitar"] },
  rock: { bpm: 124, mood: "energetic", instruments: ["drums", "bass", "electric guitar"] },
  ambient: { bpm: 76, mood: "reflective", instruments: ["pads", "piano", "textures"] },
  hiphop: { bpm: 92, mood: "grounded", instruments: ["drum machine", "bass", "keys", "samples"] },
  regional: { bpm: 102, mood: "expressive", instruments: ["guitar", "bass", "regional ensemble"] },
  electronic: { bpm: 126, mood: "driving", instruments: ["kick", "synth bass", "lead synth", "effects"] },
};

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
  const genre = typeof body.genre === "string" ? body.genre.toLowerCase().trim() : "pop";
  const title = typeof body.title === "string" ? body.title.trim().slice(0, 180) : "Untitled composition";
  const theme = typeof body.theme === "string" ? body.theme.trim().slice(0, 1000) : "";
  const duration = typeof body.durationSeconds === "number" && Number.isFinite(body.durationSeconds)
    ? Math.max(30, Math.min(600, Math.round(body.durationSeconds))) : 180;
  const style = styles[genre];
  if (!style) return jsonResponse({ error: "unsupported_genre", supported: Object.keys(styles) }, 400);

  const bars = Math.max(8, Math.round((duration * style.bpm) / 60 / 4));
  const sections = [
    { name: "Intro", bars: Math.max(4, Math.round(bars * 0.08)), purpose: "Present the sonic identity" },
    { name: "Verse 1", bars: Math.round(bars * 0.2), purpose: "Introduce the narrative and central image" },
    { name: "Chorus", bars: Math.round(bars * 0.16), purpose: "State the memorable central idea" },
    { name: "Verse 2", bars: Math.round(bars * 0.2), purpose: "Develop the story with new detail" },
    { name: "Chorus", bars: Math.round(bars * 0.16), purpose: "Reinforce the central idea with variation" },
    { name: "Bridge", bars: Math.round(bars * 0.12), purpose: "Create contrast and emotional movement" },
    { name: "Final chorus / outro", bars: Math.max(4, Math.round(bars * 0.08)), purpose: "Resolve the theme and end decisively" },
  ];
  return jsonResponse({
    planType: "composition_blueprint",
    generationStatus: "plan_only",
    title,
    genre,
    theme,
    bpm: style.bpm,
    mood: style.mood,
    durationSeconds: duration,
    instrumentation: style.instruments,
    sections,
    warnings: [
      "This endpoint creates a composition plan only; it does not synthesize or return audio.",
      "Section bar counts are a starting arrangement and may need adjustment to match exact duration.",
    ],
  });
}
