/**
 * state: engine-generated
 * TTS text normalization for Mexican Spanish (es-MX): markdown → speech text, numbers, money,
 * percentages, acronyms, abbreviations. Deterministic and dependency-free. es-MX conventions:
 * comma = thousands separator, dot = decimal point ("3.5" → "tres punto cinco"), "$" = pesos.
 */

const UNITS = ["cero", "uno", "dos", "tres", "cuatro", "cinco", "seis", "siete", "ocho", "nueve", "diez", "once", "doce", "trece", "catorce", "quince", "dieciséis", "diecisiete", "dieciocho", "diecinueve", "veinte", "veintiuno", "veintidós", "veintitrés", "veinticuatro", "veinticinco", "veintiséis", "veintisiete", "veintiocho", "veintinueve"] as const;
const TENS = ["", "", "", "treinta", "cuarenta", "cincuenta", "sesenta", "setenta", "ochenta", "noventa"] as const;
const HUNDREDS = ["", "ciento", "doscientos", "trescientos", "cuatrocientos", "quinientos", "seiscientos", "setecientos", "ochocientos", "novecientos"] as const;

function below1000(n: number, apocopeUno: boolean): string {
  if (n === 0) return "";
  if (n === 100) return "cien";
  const h = Math.floor(n / 100);
  const rest = n % 100;
  const parts: string[] = [];
  if (h > 0) parts.push(HUNDREDS[h] ?? "");
  if (rest > 0) {
    if (rest < 30) {
      const w = UNITS[rest] ?? "";
      parts.push(apocopeUno && rest === 1 ? "un" : apocopeUno && rest === 21 ? "veintiún" : w);
    } else {
      const t = Math.floor(rest / 10);
      const u = rest % 10;
      const tens = TENS[t] ?? "";
      parts.push(u === 0 ? tens : `${tens} y ${apocopeUno && u === 1 ? "un" : UNITS[u] ?? ""}`);
    }
  }
  return parts.join(" ");
}

/** Integer 0..999,999,999,999 to Spanish words. Larger values are read digit by digit. */
export function integerToSpanish(value: number): string {
  if (!Number.isInteger(value) || value < 0) throw new Error("TTS: integerToSpanish needs a non-negative integer");
  if (value > 999_999_999_999) return String(value).split("").map((d) => UNITS[Number(d)] ?? d).join(" ");
  if (value === 0) return "cero";
  const millionsTotal = Math.floor(value / 1_000_000);
  const thousands = Math.floor((value % 1_000_000) / 1_000);
  const rest = value % 1_000;
  const parts: string[] = [];
  if (millionsTotal > 0) {
    parts.push(millionsTotal === 1 ? "un millón" : `${integerToSpanish(millionsTotal).replace(/\buno$/, "un")} millones`);
  }
  if (thousands > 0) parts.push(thousands === 1 ? "mil" : `${below1000(thousands, true)} mil`);
  if (rest > 0) parts.push(below1000(rest, false));
  return parts.join(" ").replace(/\s+/g, " ").trim();
}

const LETTER_NAMES: Readonly<Record<string, string>> = { A: "a", B: "be", C: "ce", D: "de", E: "e", F: "efe", G: "ge", H: "hache", I: "i", J: "jota", K: "ka", L: "ele", M: "eme", N: "ene", Ñ: "eñe", O: "o", P: "pe", Q: "cu", R: "erre", S: "ese", T: "te", U: "u", V: "ve", W: "doble ve", X: "equis", Y: "ye", Z: "zeta" };

/** Acronyms with a fixed reading. Anything else ALL-CAPS without vowels is spelled out; with vowels it is read as a word. */
const ACRONYMS: Readonly<Record<string, string>> = {
  IA: "i a", API: "a pe i", CDMX: "ce de eme equis", TAMV: "te a eme ve", UNAM: "unam", IMSS: "i eme ese ese", SAT: "sat", CURP: "curp", RFC: "erre efe ce", CLABE: "clabe",
  USD: "dólares", MXN: "pesos mexicanos", URL: "u erre ele", HTTP: "hache te te pe", HTTPS: "hache te te pe ese", JSON: "yeison", SQL: "ese cu ele", UI: "u i", UX: "u equis", CPU: "ce pe u", GPU: "ge pe u",
  TTS: "te te ese", LLM: "ele ele eme", CI: "ce i", CD: "ce de", PDF: "pe de efe", BookPI: "buc pi ai",
};

const ABBREVIATIONS: ReadonlyArray<readonly [RegExp, string]> = [
  [/\bDra\./g, "doctora"], [/\bDr\./g, "doctor"], [/\bSra\./g, "señora"], [/\bSr\./g, "señor"], [/\bSrita\./g, "señorita"], [/\bLic\./g, "licenciado"], [/\bIng\./g, "ingeniero"],
  [/\bProf\./g, "profesor"], [/\bUds\./g, "ustedes"], [/\bUd\./g, "usted"], [/\betc\./g, "etcétera"], [/\bp\. ?ej\./g, "por ejemplo"], [/\bvs\./g, "versus"], [/\bAv\./g, "avenida"], [/\bCol\./g, "colonia"], [/\bNo\.\s?(?=\d)/g, "número "],
];

export function stripMarkdown(input: string): string {
  return input
    .replace(/```[\s\S]*?```/g, " bloque de código omitido. ")
    .replace(/`([^`\n]+)`/g, "$1")
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]+)\]\((?:[^)\s]+)\)/g, "$1")
    .replace(/https?:\/\/[^\s)>\]]+/g, "enlace")
    .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, "correo electrónico")
    .replace(/^\s{0,3}#{1,6}\s+/gm, "")
    .replace(/^\s*[-*•]\s+/gm, "")
    .replace(/^\s*\d+[.)]\s+/gm, "")
    .replace(/(\*\*|__|\*|_|~~)/g, "")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function parseEsMxNumber(raw: string): { int: number; frac: string } | null {
  const clean = raw.replace(/,/g, "");
  const [i = "", f = ""] = clean.split(".");
  if (!/^\d+$/.test(i) || (f !== "" && !/^\d+$/.test(f))) return null;
  const int = Number(i);
  return Number.isSafeInteger(int) ? { int, frac: f } : null;
}

function numberWords(raw: string): string | null {
  const n = parseEsMxNumber(raw);
  if (!n) return null;
  const whole = integerToSpanish(n.int);
  return n.frac === "" ? whole : `${whole} punto ${n.frac.split("").map((d) => UNITS[Number(d)] ?? d).join(" ")}`;
}

const NUM = String.raw`\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?`;

export function spellAcronym(token: string): string {
  return token.split("").map((c) => LETTER_NAMES[c] ?? c.toLowerCase()).join(" ");
}

/** Full normalization pipeline. Pronunciation overrides must be applied by the caller BEFORE this (see MemoryVoiceCore). */
export function normalizeEsMx(input: string): string {
  let t = stripMarkdown(input);
  for (const [re, rep] of ABBREVIATIONS) t = t.replace(re, rep);
  // money: "$1,500", "$1,500.50", "$19 USD"
  const money = (num: string, cur: "dólares" | "pesos" | "pesos mexicanos"): string | null => {
    const n = parseEsMxNumber(num); if (!n) return null;
    const cents = n.frac === "" ? "" : ` con ${integerToSpanish(Number(n.frac.padEnd(2, "0").slice(0, 2)))} centavos`;
    return `${integerToSpanish(n.int)} ${cur}${cents}`;
  };
  t = t.replace(new RegExp(String.raw`\$\s?(${NUM})(?:\s?(USD|MXN))?`, "g"), (m, num: string, cur: string | undefined) => money(num, cur === "USD" ? "dólares" : "pesos") ?? m);
  t = t.replace(new RegExp(String.raw`\b(USD|MXN)\s?(${NUM})`, "g"), (m, cur: string, num: string) => money(num, cur === "USD" ? "dólares" : "pesos mexicanos") ?? m);
  t = t.replace(new RegExp(String.raw`(${NUM})\s?%`, "g"), (_m, num: string) => { const w = numberWords(num); return w ? `${w} por ciento` : _m; });
  t = t.replace(/\b(\d{1,2}):(\d{2})\b/g, (_m, h: string, m: string) => `${integerToSpanish(Number(h))} ${m === "00" ? "en punto" : integerToSpanish(Number(m))}`);
  t = t.replace(new RegExp(String.raw`(?<![\w.,])(${NUM})(?![\w])`, "g"), (m, num: string) => numberWords(num) ?? m);
  // acronyms
  t = t.replace(/\b[A-ZÑ]{2,6}\b/g, (tok) => {
    const known = ACRONYMS[tok];
    if (known !== undefined) return known;
    return /[AEIOU]/.test(tok) ? tok.toLowerCase() : spellAcronym(tok);
  });
  t = t.replace(/\bBookPI\b/g, ACRONYMS.BookPI ?? "BookPI");
  return t.replace(/[ \t]+/g, " ").replace(/ ([,.;:!?])/g, "$1").trim();
}
