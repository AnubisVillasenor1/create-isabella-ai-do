/**
 * state: draft
 * Usage: tsx scripts/voice-profile-compare.ts <audio.wav>
 * Measures a 16-bit PCM WAV and compares it with the Isabella reference profile.
 * Convert other formats first (e.g. ffmpeg -i in.mp3 -ac 1 -ar 16000 out.wav). Exit 1 if any metric is out of tolerance.
 */
import { readFileSync } from "node:fs";
import { compareToProfile, measure, parseWav16 } from "../src/inference/voice-analysis";
import { ISABELLA_VOICE_PROFILE } from "../src/inference/voice-profile";

const file = process.argv[2];
if (!file) { console.error("usage: tsx scripts/voice-profile-compare.ts <audio.wav>"); process.exit(2); }
const m = measure(parseWav16(readFileSync(file)));
const rows = compareToProfile(m, ISABELLA_VOICE_PROFILE);
console.log(JSON.stringify({ profile: ISABELLA_VOICE_PROFILE.id, durationS: Number(m.durationS.toFixed(1)), rows }, null, 2));
process.exit(rows.every((r) => r.ok) ? 0 : 1);
