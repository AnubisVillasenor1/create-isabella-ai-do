/**
 * Boolean environment flags.
 *
 * A boolean flag set to the string "false" is non-empty and therefore truthy
 * in JavaScript. A .env file that documents VERCEL=false would otherwise be
 * read as "serverless", which silently disables the HTTP listener and the
 * durable stores. Every boolean flag must go through this helper instead of
 * raw truthiness.
 */
export type EnvLike = Readonly<Record<string, string | undefined>>;

const TRUTHY = new Set(['1', 'true', 'yes', 'on']);
const FALSY = new Set(['', '0', 'false', 'no', 'off']);

export function envFlag(env: EnvLike, name: string): boolean {
  const raw = (env[name] ?? '').trim().toLowerCase();
  if (TRUTHY.has(raw)) return true;
  if (FALSY.has(raw)) return false;
  // Any other explicit value (for example a deployment id) means "set".
  return true;
}
