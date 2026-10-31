import { describe, expect, it } from 'vitest';
import { IvccEngine } from '../../src/ivcc/engine';
import { interpretSemantics } from '../../src/ivcc/semantic';
import { MemoryIvccStore } from '../../src/ivcc/store';

const SUBJECT_SALT = Buffer.alloc(32, 7);
const WATERMARK_KEY = Buffer.alloc(32, 9);

function makeEngine(): IvccEngine {
  return new IvccEngine({
    store: new MemoryIvccStore(),
    subjectSalt: SUBJECT_SALT,
    watermarkKey: WATERMARK_KEY,
    tts: null,
  });
}

const TEXT = 'Primera oración completa. Segunda oración completa. Tercera oración completa.';

describe('IVCC deterministic cognitive layers', () => {
  it('detects warning intent, urgency and clause structure', () => {
    const semantic = interpretSemantics(
      'Alerta: hay un riesgo crítico en el servidor. Actúa de inmediato.'
    );
    expect(semantic.intent).toBe('WARN');
    expect(semantic.urgency).toBeGreaterThan(0.3);
    expect(semantic.clauses.length).toBeGreaterThanOrEqual(2);
    expect(semantic.confidence).toBeGreaterThan(0.3);
  });

  it('produces identical repeated emphasis (no stateful global regex)', () => {
    const first = interpretSemantics('URGENTE: revisa el pago 19 hoy.');
    const second = interpretSemantics('URGENTE: revisa el pago 19 hoy.');
    expect(second.emphasis.map((span) => span.text)).toEqual(
      first.emphasis.map((span) => span.text)
    );
    expect(first.emphasis.some((span) => /urgente/i.test(span.text))).toBe(true);
  });

  it('gates emphasis and breathing by declared tier', async () => {
    const engine = makeEngine();
    const compact = await engine.plan({ text: TEXT, tier: 'S' }, 'tester');
    const extended = await engine.plan({ text: TEXT, tier: 'L' }, 'tester');
    expect(compact.status).toBe('planned');
    expect(extended.status).toBe('planned');
    if (compact.status !== 'planned' || extended.status !== 'planned') return;

    expect(Object.keys(compact.cognitive.emotion)).toHaveLength(12);
    expect(compact.emphasis.spans).toHaveLength(0);
    expect(compact.breathing.totalBreaths).toBe(0);
    expect(extended.breathing.totalBreaths).toBeGreaterThan(0);
    expect(extended.breathing.modeled).toBe(false);
    expect(compact.authorizationPerformed).toBe(false);
    expect(compact.executionPerformed).toBe(false);
  });

  it('rejects text above the tier limit instead of truncating it', async () => {
    const result = await makeEngine().plan({ text: 'a'.repeat(2_001), tier: 'S' }, 'tester');
    expect(result.status).toBe('denied');
    if (result.status === 'denied') {
      expect(result.reason).toBe('IVCC_TEXT_SIZE_LIMIT_EXCEEDED');
    }
  });

  it('audits hashes and digests, never raw text', async () => {
    const engine = makeEngine();
    await engine.plan({ text: 'Texto secreto de prueba.' }, 'tester');
    const audit = await engine.readAudit({}, 'admin');
    expect(audit.chainValid).toBe(true);
    expect(JSON.stringify(audit.events)).not.toContain('Texto secreto');
    expect(JSON.stringify(audit.events)).not.toContain('texto secreto');
  });
});
