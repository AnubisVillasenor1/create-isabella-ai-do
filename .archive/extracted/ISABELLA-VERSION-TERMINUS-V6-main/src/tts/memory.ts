/**
 * state: engine-generated
 * Memory Voice Core: per-actor pronunciation overrides ("Kubernetes" → "Kúbernetes"), learned from explicit
 * user instructions only — never inferred from audio. Bounded, in-memory, erasable (privacy).
 */
export class MemoryVoiceCore {
  private readonly actors = new Map<string, Map<string, string>>();

  constructor(private readonly maxActors = 500, private readonly maxEntries = 200) {}

  learn(actorId: string, written: string, spoken: string): void {
    const w = written.trim();
    const s = spoken.trim();
    if (!actorId || w.length < 2 || w.length > 40 || s.length < 1 || s.length > 80) throw new Error("TTS_MEMORY: invalid pronunciation entry");
    if (/[\u0000-\u001f\u007f<>]/.test(w + s)) throw new Error("TTS_MEMORY: control or markup characters are not allowed");
    let map = this.actors.get(actorId);
    if (!map) {
      if (this.actors.size >= this.maxActors) { const oldest = this.actors.keys().next().value; if (oldest !== undefined) this.actors.delete(oldest); }
      map = new Map();
    } else this.actors.delete(actorId); // refresh LRU position
    if (!map.has(w.toLowerCase()) && map.size >= this.maxEntries) throw new Error("TTS_MEMORY: pronunciation limit reached");
    map.set(w.toLowerCase(), s);
    this.actors.set(actorId, map);
  }

  /** Apply overrides as whole-word, case-insensitive replacements. */
  apply(actorId: string | undefined, text: string): string {
    const map = actorId ? this.actors.get(actorId) : undefined;
    if (!map || map.size === 0) return text;
    let out = text;
    for (const [written, spoken] of map) {
      const escaped = written.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      out = out.replace(new RegExp(`(?<![\\p{L}\\p{N}])${escaped}(?![\\p{L}\\p{N}])`, "giu"), () => spoken);
    }
    return out;
  }

  count(actorId: string): number { return this.actors.get(actorId)?.size ?? 0; }
  forget(actorId: string): boolean { return this.actors.delete(actorId); }
}
