import { createHash } from "node:crypto";
import { isCategory, type Category } from "./taxonomy";
import { SpanishNormalizer } from "./normalizer";

export interface TermEntry {
  term: string;
  country: string;
  category: Category;
  meaning: string;
  tags: readonly string[];
  examples: readonly string[];
  source: string;
  confidence: number;
  adultFlag: boolean;
  entryHash: string;
  timestamp: string;
}

export interface AnalyzeResult {
  input: string;
  normalized: string;
  matches: readonly TermEntry[];
  contexts: readonly string[];
  count: number;
}

export interface IngestRecord {
  term?: unknown;
  word?: unknown;
  country?: unknown;
  category?: unknown;
  type?: unknown;
  meaning?: unknown;
  definicion?: unknown;
  tags?: unknown;
  examples?: unknown;
  ejemplos?: unknown;
  source?: unknown;
  confidence?: unknown;
}

const ADULT_MARKERS = ["sexual", "porno", "erótico", "explícito", "genital", "coito"];
const CONTEXT_MAP: Readonly<Record<string, string>> = Object.freeze({ aguas: "warning", chamba: "work", lana: "money", laburo: "work", bondi: "transport" });

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value.trim() : fallback;
}
function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string").map((item) => item.trim()).filter(Boolean) : [];
}
function boundedConfidence(value: unknown): number {
  const number = typeof value === "number" && Number.isFinite(value) ? value : 0.5;
  return Math.min(1, Math.max(0, number));
}

export class LatinoGenesis {
  private readonly normalizer = new SpanishNormalizer();
  private readonly entries = new Map<string, TermEntry>();

  constructor(seed: readonly IngestRecord[] = []) {
    this.ingest(seed, "seed");
  }

  addTerm(record: IngestRecord, defaultCountry = "LATAM", defaultSource = "operator-curated"): TermEntry | null {
    const term = this.normalizer.clean(asString(record.term ?? record.word));
    const meaning = asString(record.meaning ?? record.definicion);
    if (!term || !meaning) return null;
    const rawCategory = this.normalizer.clean(asString(record.category ?? record.type, "expresion"));
    const category: Category = isCategory(rawCategory) ? rawCategory : "expresion";
    const country = asString(record.country, defaultCountry) || defaultCountry;
    const source = asString(record.source, defaultSource) || defaultSource;
    const adultFlag = ADULT_MARKERS.some((marker) => `${term} ${meaning}`.includes(marker));
    const raw = `${term}|${country}|${category}|${meaning}`;
    const entryHash = createHash("sha256").update(raw).digest("hex");
    const entry: TermEntry = Object.freeze({
      term, country, category, meaning,
      tags: Object.freeze(asStringArray(record.tags)),
      examples: Object.freeze(asStringArray(record.examples ?? record.ejemplos)),
      source, confidence: boundedConfidence(record.confidence), adultFlag, entryHash,
      timestamp: new Date().toISOString(),
    });
    this.entries.set(entryHash, entry);
    return entry;
  }

  ingest(records: readonly IngestRecord[], source = "operator-curated", country = "LATAM"): number {
    let added = 0;
    for (const record of records) if (this.addTerm({ ...record, source: record.source ?? source }, country, source)) added += 1;
    return added;
  }

  search(term: string): readonly TermEntry[] {
    const query = this.normalizer.clean(term);
    return [...this.entries.values()].filter((entry) => entry.term === query && !entry.adultFlag);
  }

  analyze(input: string): AnalyzeResult {
    const normalized = this.normalizer.clean(input);
    const tokens = this.normalizer.tokens(normalized);
    const matches = [...this.entries.values()].filter((entry) => !entry.adultFlag && tokens.includes(entry.term));
    const contexts = [...new Set(tokens.map((token) => CONTEXT_MAP[token]).filter((value): value is string => Boolean(value)))];
    return Object.freeze({ input, normalized, matches: Object.freeze(matches), contexts: Object.freeze(contexts.length ? contexts : ["neutral"]), count: matches.length });
  }

  stats(): { totalTerms: number; byCountry: Readonly<Record<string, number>> } {
    const byCountry: Record<string, number> = {};
    for (const entry of this.entries.values()) byCountry[entry.country] = (byCountry[entry.country] ?? 0) + 1;
    return { totalTerms: this.entries.size, byCountry: Object.freeze(byCountry) };
  }
}

export const SEED_LATAM: readonly IngestRecord[] = Object.freeze([
  { term: "chamba", meaning: "trabajo", category: "regionalismo", country: "MX", tags: ["laboral"] },
  { term: "lana", meaning: "dinero", category: "jerga", country: "MX", tags: ["economía"] },
  { term: "aguas", meaning: "ten cuidado", category: "expresion", country: "MX", tags: ["advertencia"] },
  { term: "ahorita", meaning: "expresión temporal cuyo sentido depende del contexto", category: "regionalismo", country: "MX" },
  { term: "laburo", meaning: "trabajo", category: "regionalismo", country: "AR" },
  { term: "bondi", meaning: "autobús", category: "regionalismo", country: "AR" },
]);
