/**
 * Layer 7: voice memory (pronunciation + bounded style adjustment) per subject
 * hash. Memory is consent-scoped, erasable and never contains raw audio.
 */
import { clamp } from './util';
import type { ProsodyAdjustment, VoiceMemoryRecord, VoiceTraits } from './types';

const MAX_ENTRIES = 256;
const MAX_WRITTEN = 60;
const MAX_SPOKEN = 120;

export class IvccMemoryError extends Error {
  constructor(
    readonly code: 'IVCC_MEMORY_ENTRY_INVALID' | 'IVCC_MEMORY_FULL',
    message: string
  ) {
    super(message);
    this.name = 'IvccMemoryError';
  }
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function sanitizePronunciation(
  written: unknown,
  spoken: unknown
): { written: string; spoken: string } {
  if (typeof written !== 'string' || typeof spoken !== 'string') {
    throw new IvccMemoryError('IVCC_MEMORY_ENTRY_INVALID', 'written and spoken must be strings');
  }
  const cleanWritten = written.trim().replace(/\s+/g, ' ');
  const cleanSpoken = spoken.trim().replace(/\s+/g, ' ');
  if (
    !cleanWritten ||
    !cleanSpoken ||
    cleanWritten.length > MAX_WRITTEN ||
    cleanSpoken.length > MAX_SPOKEN
  ) {
    throw new IvccMemoryError(
      'IVCC_MEMORY_ENTRY_INVALID',
      'pronunciation entry is empty or too long'
    );
  }
  if (cleanWritten === cleanSpoken) {
    throw new IvccMemoryError(
      'IVCC_MEMORY_ENTRY_INVALID',
      'pronunciation entry does not change the text'
    );
  }
  return { written: cleanWritten, spoken: cleanSpoken };
}

export function applyPronunciationMemory(
  text: string,
  memory: VoiceMemoryRecord | null
): { text: string; applied: number } {
  if (!memory || memory.entries.length === 0) return { text, applied: 0 };
  let output = text;
  let applied = 0;
  for (const entry of [...memory.entries].sort((a, b) => b.written.length - a.written.length)) {
    const pattern = new RegExp(
      `(?<![\\p{L}\\p{N}])${escapeRegExp(entry.written)}(?![\\p{L}\\p{N}])`,
      'giu'
    );
    if (pattern.test(output)) {
      output = output.replace(pattern, () => entry.spoken);
      applied += 1;
    }
  }
  return { text: output, applied };
}

export function addPronunciationEntry(
  memory: VoiceMemoryRecord | null,
  subjectHash: string,
  written: string,
  spoken: string,
  now: string
): VoiceMemoryRecord {
  const entry = sanitizePronunciation(written, spoken);
  const current = memory ?? { subjectHash, entries: [], adjustment: null, updatedAt: now };
  if (current.entries.length >= MAX_ENTRIES) {
    throw new IvccMemoryError(
      'IVCC_MEMORY_FULL',
      `voice memory is limited to ${MAX_ENTRIES} entries`
    );
  }
  const withoutDuplicate = current.entries.filter(
    (item) => item.written.toLowerCase() !== entry.written.toLowerCase()
  );
  return {
    ...current,
    entries: [...withoutDuplicate, { ...entry, createdAt: now }],
    updatedAt: now,
  };
}

export function setProsodyAdjustment(
  memory: VoiceMemoryRecord | null,
  subjectHash: string,
  adjustment: { rateDelta?: unknown; pitchDelta?: unknown; warmthDelta?: unknown },
  now: string
): VoiceMemoryRecord {
  const rateDelta =
    typeof adjustment.rateDelta === 'number' && Number.isFinite(adjustment.rateDelta)
      ? clamp(adjustment.rateDelta, -0.15, 0.15)
      : 0;
  const pitchDelta =
    typeof adjustment.pitchDelta === 'number' && Number.isFinite(adjustment.pitchDelta)
      ? clamp(adjustment.pitchDelta, -2, 2)
      : 0;
  const warmthDelta =
    typeof adjustment.warmthDelta === 'number' && Number.isFinite(adjustment.warmthDelta)
      ? clamp(adjustment.warmthDelta, -0.2, 0.2)
      : 0;
  const current = memory ?? { subjectHash, entries: [], adjustment: null, updatedAt: now };
  const nextAdjustment: ProsodyAdjustment = { rateDelta, pitchDelta, warmthDelta, updatedAt: now };
  return { ...current, adjustment: nextAdjustment, updatedAt: now };
}

export function effectiveTraits(
  traits: VoiceTraits,
  memory: VoiceMemoryRecord | null
): VoiceTraits {
  if (!memory?.adjustment) return traits;
  const adjustment = memory.adjustment;
  return {
    ...traits,
    rate: clamp(traits.rate + adjustment.rateDelta, 0.15, 0.95),
    warmth: clamp(traits.warmth + adjustment.warmthDelta, 0.1, 0.95),
  };
}

export function effectivePitchOffset(memory: VoiceMemoryRecord | null): number {
  return memory?.adjustment?.pitchDelta ?? 0;
}
