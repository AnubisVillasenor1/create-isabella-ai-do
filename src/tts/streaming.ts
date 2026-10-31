/**
 * state: draft | engine-generated
 * Incremental speech segmentation and barge-in coordination.
 *
 * The sentence cutter absorbs LLM deltas and emits only complete, bounded speech
 * units. Hidden reasoning blocks are never spoken, even when a tag is split across
 * two deltas. This is a deterministic text transform: it does not synthesize audio,
 * decide authority, or claim that a provider streams PCM.
 *
 * Attribution: the algorithm is inspired by Hermes Agent's `SentenceChunker`
 * (MIT, tools/tts_streaming.py). This TypeScript implementation is independent and
 * adds Spanish-aware boundaries, hard memory/chunk caps and the barge-in registry.
 */

const REASONING_TAGS = [
  'think',
  'thinking',
  'reasoning',
  'analysis',
  'scratchpad',
  'thought',
] as const;
const TAG_NAMES = REASONING_TAGS.join('|');
const THINK_BLOCK_RE = new RegExp(`<(${TAG_NAMES})(?:\\s[^>]*)?>.*?<\\/\\1>`, 'gis');
const THINK_OPEN_RE = new RegExp(`<(?:${TAG_NAMES})(?=[\\s>]|$)`, 'i');
const SENTENCE_BOUNDARY_RE = /[.!?…]+["'”’»)]*\s+|\n{2,}/g;

const DEFAULTS = Object.freeze({
  minLength: 6,
  maxChunkChars: 240,
  maxBufferChars: 16_384,
  maxThinkHoldChars: 65_536,
});

export interface SentenceChunkerOptions {
  /** Fragments shorter than this are merged into the next sentence. Floor 1. */
  readonly minLength?: number;
  /** Hard ceiling for one emitted speech unit. Split at clause/space boundaries. */
  readonly maxChunkChars?: number;
  /** Hard ceiling for the unflushed buffer (runaway upstream protection). */
  readonly maxBufferChars?: number;
}

function clampInt(value: number | undefined, fallback: number, lo: number, hi: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.min(hi, Math.max(lo, Math.trunc(value)));
}

function trimChunk(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

/** Split one oversized sentence at a comma or space before the ceiling. */
function splitOversized(text: string, maxChunkChars: number): string[] {
  const out: string[] = [];
  let rest = trimChunk(text);
  while (rest.length > maxChunkChars) {
    const window = rest.slice(0, maxChunkChars);
    const comma = window.lastIndexOf(',');
    const space = window.lastIndexOf(' ');
    const cut = comma > maxChunkChars * 0.4 ? comma + 1 : space > 0 ? space : maxChunkChars;
    const head = trimChunk(rest.slice(0, cut));
    if (!head) break;
    out.push(head);
    rest = trimChunk(rest.slice(cut));
  }
  if (rest) out.push(rest);
  return out;
}

function stripClosedReasoning(text: string): string {
  // Repeat because adjacent or nested blocks may appear in a single delta.
  let current = text;
  for (let i = 0; i < 4; i += 1) {
    const next = current.replace(THINK_BLOCK_RE, '');
    if (next === current) break;
    current = next;
  }
  return current;
}

/**
 * Incremental sentence cutter for LLM deltas.
 * `feed` returns every complete speech unit now ready; `flush` drains the tail.
 */
export class SentenceChunker {
  private readonly minLength: number;
  private readonly maxChunkChars: number;
  private readonly maxBufferChars: number;
  private buffer = '';

  constructor(options: SentenceChunkerOptions = {}) {
    this.minLength = clampInt(options.minLength, DEFAULTS.minLength, 1, 1_000);
    this.maxChunkChars = clampInt(options.maxChunkChars, DEFAULTS.maxChunkChars, 32, 4_000);
    this.maxBufferChars = Math.max(
      this.maxChunkChars * 2,
      clampInt(options.maxBufferChars, DEFAULTS.maxBufferChars, 256, 1_000_000)
    );
  }

  /** Bytes are not relevant here; chars bound memory and downstream TTS work. */
  get pendingChars(): number {
    return this.buffer.length;
  }

  feed(delta: string): string[] {
    if (typeof delta !== 'string' || delta.length === 0) return [];
    this.buffer = stripClosedReasoning(this.buffer + delta);

    if (THINK_OPEN_RE.test(this.buffer)) {
      // An unterminated reasoning block is never spoken. Keep only a bounded hold:
      // a hostile upstream cannot grow process memory indefinitely.
      if (this.buffer.length > DEFAULTS.maxThinkHoldChars) {
        const open = this.buffer.search(THINK_OPEN_RE);
        this.buffer = open > 0 ? this.buffer.slice(0, open) : '';
      }
      return [];
    }

    const out: string[] = [];
    SENTENCE_BOUNDARY_RE.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = SENTENCE_BOUNDARY_RE.exec(this.buffer)) !== null) {
      const end = match.index + match[0].length;
      const head = this.buffer.slice(0, end);
      if (head.trim().length < this.minLength) continue;
      for (const piece of splitOversized(head, this.maxChunkChars)) out.push(piece);
      this.buffer = this.buffer.slice(end);
      SENTENCE_BOUNDARY_RE.lastIndex = 0;
    }

    // A single oversized delta can exceed the cap by many times; drain repeatedly
    // so the retained buffer is always bounded at the end of `feed`.
    while (this.buffer.length > this.maxBufferChars) {
      const cut = this.buffer.lastIndexOf(' ', this.maxChunkChars);
      const at = cut > this.maxChunkChars * 0.4 ? cut : this.maxChunkChars;
      for (const piece of splitOversized(this.buffer.slice(0, at), this.maxChunkChars))
        out.push(piece);
      this.buffer = this.buffer.slice(at);
    }
    return out;
  }

  flush(): string[] {
    const cleaned = stripClosedReasoning(this.buffer);
    const open = cleaned.search(THINK_OPEN_RE);
    const tail = trimChunk(open >= 0 ? cleaned.slice(0, open) : cleaned);
    this.buffer = '';
    return tail ? splitOversized(tail, this.maxChunkChars) : [];
  }

  reset(): void {
    this.buffer = '';
  }
}

export interface BargeInOptions {
  readonly ttlMs?: number;
  readonly maxEntries?: number;
  readonly now?: () => number;
  readonly maxKeyLength?: number;
}

/**
 * Per-actor barge-in latch. A mark is consumed once, so a stale interruption never
 * silences a later, unrelated reply. Keys are session/actor identifiers, not content.
 */
export class BargeInRegistry {
  readonly ttlMs: number;
  private readonly maxEntries: number;
  private readonly now: () => number;
  private readonly maxKeyLength: number;
  private readonly marks = new Map<string, number>();

  constructor(options: BargeInOptions = {}) {
    this.ttlMs = clampInt(options.ttlMs, 120_000, 1_000, 3_600_000);
    this.maxEntries = clampInt(options.maxEntries, 512, 1, 10_000);
    this.now = options.now ?? Date.now;
    this.maxKeyLength = clampInt(options.maxKeyLength, 160, 8, 512);
  }

  private validKey(key: string): boolean {
    return key.length > 0 && key.length <= this.maxKeyLength && !/[\s\u0000-\u001f]/.test(key);
  }

  private purge(now: number): void {
    for (const [key, at] of this.marks) {
      if (now - at >= this.ttlMs) this.marks.delete(key);
    }
  }

  mark(key: string): boolean {
    if (!this.validKey(key)) return false;
    const now = this.now();
    this.purge(now);
    if (!this.marks.has(key) && this.marks.size >= this.maxEntries) {
      const oldest = this.marks.keys().next();
      if (!oldest.done) this.marks.delete(oldest.value);
    }
    this.marks.set(key, now);
    return true;
  }

  /** Pop the latch; true only when a mark exists and is still within TTL. */
  consume(key: string): boolean {
    if (!this.validKey(key)) return false;
    const now = this.now();
    const at = this.marks.get(key);
    if (at === undefined) return false;
    this.marks.delete(key);
    return now - at < this.ttlMs;
  }

  clear(key: string): boolean {
    return this.marks.delete(key);
  }

  get size(): number {
    this.purge(this.now());
    return this.marks.size;
  }
}

/**
 * Pause after a streamed speech unit, in the same bounded range as the prosody
 * planner. It is a plan value for the player, not measured audio.
 */
export function chunkPauseMs(
  text: string,
  emotion: { readonly urgency?: number; readonly calm?: number } = {}
): number {
  const trimmed = text.trimEnd();
  const terminal = trimmed.slice(-1);
  const atParagraph = /\n{2,}$/.test(text) || /\n$/.test(text);
  let base =
    terminal === '…'
      ? 600
      : terminal === '?' || terminal === '!'
        ? 378
        : terminal === '.'
          ? 420
          : 140;
  if (atParagraph) base = 707;
  const urgency = Math.min(1, Math.max(0, emotion.urgency ?? 0));
  const calm = Math.min(1, Math.max(0, emotion.calm ?? 0));
  return Math.round(Math.min(900, Math.max(60, base * (1 - 0.3 * urgency + 0.2 * calm))));
}
