/**
 * Braintrust observability integration — tracing and evaluation (state: draft | engine-generated).
 *
 * Uses BRAINTRUST_API_KEY and BRAINTRUST_PROJECT_ID. Fail-closed: no key → disabled (null).
 * CAPABILITY ≠ AUTHORITY ≠ EXECUTION ≠ EVIDENCE ≠ LEARNING ≠ PRODUCTION.
 */
export interface BraintrustConfig {
  readonly apiKey: string;
  readonly projectId: string;
}

export function braintrustConfig(env: Record<string, string | undefined>): BraintrustConfig | null {
  const apiKey = env.BRAINTRUST_API_KEY?.trim();
  const projectId = env.BRAINTRUST_PROJECT_ID?.trim();
  if (!apiKey || !projectId) return null;
  return { apiKey, projectId };
}

export function describeBraintrustReadiness(env: Record<string, string | undefined>): {
  configured: boolean;
  projectId: string | null;
} {
  const c = braintrustConfig(env);
  return { configured: c !== null, projectId: c?.projectId ?? null };
}

export async function initBraintrust(
  env: Record<string, string | undefined>
): Promise<{ enabled: boolean; projectId: string | null }> {
  const c = braintrustConfig(env);
  if (!c) return { enabled: false, projectId: null };
  // Lazy import to avoid loading the SDK when disabled.
  try {
    const bt = await import('braintrust');
    // Braintrust SDK init (best-effort; no hard dependency on specific API surface).
    if (typeof (bt as { initLogger?: unknown }).initLogger === 'function') {
      (bt as { initLogger: (opts: { apiKey: string; projectName: string }) => unknown }).initLogger(
        { apiKey: c.apiKey, projectName: c.projectId }
      );
    }
    return { enabled: true, projectId: c.projectId };
  } catch (e) {
    console.warn('[Isabella] braintrust init failed', {
      message: e instanceof Error ? e.message.slice(0, 180) : String(e),
    });
    return { enabled: false, projectId: c.projectId };
  }
}
