import { createHash } from 'node:crypto';

/**
 * Hash a canonical request tuple instead of retaining user prompts/history as
 * Map keys. The governance method is included to isolate distinct policy paths.
 */
export function buildCognitionCacheKey(
  input: string,
  history: unknown,
  modelEngine: string,
  focusLens: string,
  methodId: string
): string {
  const canonical =
    JSON.stringify([modelEngine, focusLens, methodId, input, history ?? []]) ?? 'null';
  return createHash('sha256').update(canonical, 'utf8').digest('hex');
}
