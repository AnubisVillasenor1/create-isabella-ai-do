/**
 * state: engine-generated
 * Isabella native voice — es-MX text normalization for speech (numbers, currency, percentages,
 * acronyms, abbreviations, markdown/URLs). Pure, deterministic, no I/O.
 */

const UNITS = ["cero", "uno", "dos", "tres", "cuatro", "cinco", "seis", "siete", "ocho", "nueve", "diez", "once", "doce", "trece", "catorce", "quince", "dieciséis", "diecisiete", "dieciocho", "diecinueve", "veinte", "veintiuno", "veintidós", "veintitrés", "veinticuatro", "veinticinco", "veintiséis", "veintisiete", "veintiocho", "veintinueve"] as const;
const TENS = ["", "", "", "treinta", "cuarenta", "cincuenta", "sesenta", "setenta", "ochenta", "noventa"] as const;
const HUNDREDS = ["", "ciento", "doscientos", "trescientos", "cuatrocientos", "quinientos", "seiscientos", "setecientos", "ochocientos", "novecientos"] as const;

const MAX_SAFE_WORDS = 999_999_999_999;

function below1000(n: number, apocope: boolean): string {
  if (n === 0) return "";
  if (n === 100) return "cien";
  const parts: string[] = [];
  const h = Math.floor(n / 100);
  const rest = n % 100;
  if (h > 0) parts.push(HUNDREDS[h] ?? "");
  if (rest > 0) {
    if (rest < 30) {
      let w: string = UNITS[rest] ?? "";
      if (apocope && rest === 1) w = "un";
      else if (apocope && rest === 21) w = "veintiún";
      parts.push(w);
    } else {
      const t = Math.floor(rest / 10);
      const u = rest % 10;
      const tw = TENS[t] ?? "";
      if (u === 0) parts.push(tw);
      else parts.push(`${tw} y ${apocope && u === 1 ? "un" : (UNITS[u] ?? "")}`);
    }
  }
  return parts.join(" ");
}

/** Integer to Spanish words (es-MX). Throws outside 0..999,999,999,999 so callers must guard. */
export function integerToWords(n: number): string {
  if (!Number.isInteger(n) || n < 0 || n > MAX_SAFE_WORDS) throw new RangeError("integerToWords: out of range");
  if (n === 0) return "cero";
  const millardos = Math.floor(n / 1_000_000_000); // "mil millones" groups
  const millones = Math.floor((n % 1_000_000_000) / 1_000_000);
  const miles = Math.floor((n % 1_000_000) / 1000);
  const units = n % 1000;
  const out: string[] = [];
  const totalMillions = millardos * 1000 + millones;
  if (totalMillions > 0) {
    if (millardos > 0) {
      out.push(millardos === 1 ? "mil" : `${below1000(millardos, true)} mil`);
      out.push(millones === 0 ? "millones" : `${below1000(millones, true)} millones`);
      if (millones === 0) { /* "mil millones" */ }
    } else {
      out.push(millones === 1 ? "un millón" : `${below1000(millones, true)} millones`);
    }
  }
  if (miles > 0) out.push(miles === 1 ? "mil" : `${below1000(miles, true)} mil`);
  if (units > 0) out.push(below1000(units, false));
  return out.join(" ").replace(/\s+/g, " ").trim();
}

function decimalDigitsToWords(frac: string): string {
  return [...frac].map((d) => UNITS[Number(d)] ?? d).join(" ");
}

/** "16.7" → "dieciséis punto siete" (es-MX reads the decimal point as "punto"). */
export function numberStringToWords(raw: string): string {
  const clean = raw.replace(/,/g, "");
  const [intPart = "0", frac] = clean.split(".");
  const n = Number(intPart);
  if (!Number.isFinite(n) || n > MAX_SAFE_WORDS) return raw;
  const words = integerToWords(n);
  return frac && /^\d+$/.test(frac) ? `${words} punto ${decimalDigitsToWords(frac.slice(0, 6))}` : words;
}

const ACRONYMS: Readonly<Record<string, string>> = {
  IA: "i a", AI: "a i", API: "a pe i", APIs: "a pe is", URL: "u erre ele", SQL: "ese cu ele", TTS: "te te ese", STT: "ese te te",
  CPU: "ce pe u", GPU: "ge pe u", RFC: "erre efe ce", CURP: "curp", CDMX: "ce de eme equis", TAMV: "te a eme ve",
  BookPI: "buc pe i", CROWN: "crown", AEGIS: "ey-yis", UI: "u i", UX: "u equis", CI: "ce i", CD: "ce de", HTTP: "hache te te pe",
  HTTPS: "hache te te pe ese", JSON: "yeison", PDF: "pe de efe", IVA: "iva", MXN: "pesos mexicanos", USD: "dólares", ML: "eme ele", LLM: "ele ele eme",
};

const ABBREVIATIONS: ReadonlyArray<readonly [RegExp, string]> = [
  [/\bDra\.(?=\s)/g, "doctora"], [/\bDr\.(?=\s)/g, "doctor"], [/\bLic\.(?=\s)/g, "licenciado"], [/\bIng\.(?=\s)/g, "ingeniero"],
  [/\bSra\.(?=\s)/g, "señora"], [/\bSr\.(?=\s)/g, "señor"], [/\bp\. ?ej\./gi, "por ejemplo"], [/\betc\./gi, "etcétera"], [/\bvs\.?(?=\s)/gi, "versus"],
];

const UNIT_WORDS: Readonly<Record<string, readonly [string, string]>> = {
  ms: ["milisegundo", "milisegundos"], s: ["segundo", "segundos"], km: ["kilómetro", "kilómetros"], kg: ["kilogramo", "kilogramos"],
  gb: ["gigabyte", "gigabytes"], mb: ["megabyte", "megabytes"], hz: ["hercio", "hercios"],
};

/** Thousands groups need exactly three digits ("1,502"); "1,2,3" stays a list. */
const NUM = String.raw`\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?`;

function stripMarkup(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, " (bloque de código omitido) ")
    .replace(/`([^`\n]+)`/g, "$1")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]+)\]\((?:[^)\s]+)\)/g, "$1")
    .replace(/https?:\/\/[^\s<>)]+/g, "enlace")
    .replace(/^\s{0,3}#{1,6}\s+/gm, "")
    .replace(/^\s*[-*•]\s+/gm, "")
    .replace(/^\s*\d+[.)]\s+/gm, "")
    .replace(/[*_~>|]/g, "")
    .replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/gu, "");
}

function moneyWords(amount: string, unit: "pesos" | "dólares"): string {
  const clean = amount.replace(/,/g, "");
  const [i = "0", f] = clean.split(".");
  const n = Number(i);
  if (!Number.isFinite(n) || n > MAX_SAFE_WORDS) return `${amount} ${unit}`;
  const singular = unit === "pesos" ? "peso" : "dólar";
  const base = `${integerToWords(n)} ${n === 1 ? singular : unit}`;
  if (f && /^\d{1,2}$/.test(f) && Number(f) > 0) {
    const cents = Number(f.padEnd(2, "0"));
    return `${base} con ${integerToWords(cents)} centavos`;
  }
  return base;
}

export function normalizeForSpeech(input: string): string {
  let t = stripMarkup(input);
  for (const [re, rep] of ABBREVIATIONS) t = t.replace(re, rep);
  // currency (US$/USD/dólares first, then $ as MXN)
  t = t.replace(new RegExp(String.raw`(?:US\$|USD\s?\$?|\$\s?)(${NUM})(?:\s?(USD|MXN|MN))?`, "gi"), (_m, amt: string, cur?: string) => {
    const isUsd = /^US\$|^USD/i.test(_m) || (cur ?? "").toUpperCase() === "USD";
    return moneyWords(amt, isUsd ? "dólares" : "pesos");
  });
  t = t.replace(new RegExp(String.raw`(${NUM})\s?%`, "g"), (_m, n: string) => `${numberStringToWords(n)} por ciento`);
  t = t.replace(new RegExp(String.raw`(${NUM})\s?(ms|km|kg|gb|mb|hz|s)\b`, "gi"), (_m, n: string, u: string) => {
    const entry = UNIT_WORDS[u.toLowerCase()];
    const plain = Number(n.replace(/,/g, ""));
    return entry ? `${numberStringToWords(n)} ${plain === 1 ? entry[0] : entry[1]}` : _m;
  });
  t = t.replace(new RegExp(String.raw`\b(?:${NUM})\b`, "g"), (n) => numberStringToWords(n));
  t = t.replace(/\b[A-Za-z][A-Za-z]{1,5}s?\b/g, (w) => ACRONYMS[w] ?? w);
  return t.replace(/[ \t]+/g, " ").replace(/ *\n */g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}
