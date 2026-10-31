/**
 * Store backends accepted by ISABELLA_API_KEY_STORE and ISABELLA_FEDERATION_STORE.
 * Dependency-free so health checks can classify a mode without loading a driver.
 */
export const POSTGRES_STORE_MODES = ['postgres', 'postgresql', 'neon'] as const;

export function isPostgresStoreMode(mode: string): boolean {
  return (POSTGRES_STORE_MODES as readonly string[]).includes(mode.trim().toLowerCase());
}
