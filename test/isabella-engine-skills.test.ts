import { describe, expect, it } from 'vitest';
import { IsabellaEngine } from '../src/isabella';

describe('IsabellaEngine operational skill APIs', () => {
  it('compiles and records a reusable skill in the append-only ledger', () => {
    const engine = new IsabellaEngine();
    const { program, validation, ledger } = engine.compilarHabilidad({
      goal: 'entregar expediente',
      steps: [
        { primitive: 'observe', expectedObservation: 'expediente visible' },
        { primitive: 'pick', target: 'expediente' },
        { primitive: 'place', target: 'bandeja' },
        { primitive: 'verify', expectedObservation: 'expediente en bandeja' },
      ],
      postconditions: ['expediente en bandeja'],
      confidence: 0.95,
    });
    expect(validation.executable).toBe(true);
    expect(ledger.kind).toBe('skill-program');

    const { decision, ledger: decisionLedger } = engine.decidirEjecucion({
      program,
      actionChunkAvailable: true,
      observationConfident: true,
      progressConfirmed: true,
      highImpact: false,
    });
    expect(decision.mode).toBe('PROGRAM');
    expect(decisionLedger.kind).toBe('execution-decision');
    expect(engine.snapshot().ledgerEntries).toBe(2);
  });
});
