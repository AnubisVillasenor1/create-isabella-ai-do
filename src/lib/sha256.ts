/**
 * Deterministic SHA-256 digest (NIST FIPS 180-4).
 *
 * Single source of truth for `sha256Hex`, which previously existed as
 * near-identical copies in `bookpi/crypto`, `cognition/moe/hash`,
 * `hypercore/canonical` and `skills/canonical-json` (exported duplicates), plus
 * private copies in `bookpi/merkle`, `cognition/native-comprehension` and
 * `isabella/engine`. Behavior is unchanged: `update(input)` defaults to UTF-8
 * for strings and passes byte buffers through verbatim, so every former copy
 * (string-only or `string | Uint8Array`) can re-export this function as-is.
 *
 * state: draft | engine-generated.
 */
import { createHash } from 'node:crypto';

export function sha256Hex(input: string | Uint8Array): string {
  return createHash('sha256').update(input).digest('hex');
}
