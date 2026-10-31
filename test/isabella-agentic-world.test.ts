import { describe, expect, it } from 'vitest';
import {
  arbitrateHybridExecution,
  compileSkillProgram,
  validateSkillProgram,
} from '../src/isabella';

describe('Isabella agentic world skill layer', () => {
  it('compiles deterministic, verifiable reusable skills', () => {
    const input = {
      goal: 'transferir objeto al destino',
      steps: [
        { primitive: 'pick' as const, target: 'objeto' },
        { primitive: 'place' as const, target: 'destino' },
        { primitive: 'verify' as const, expectedObservation: 'objeto en destino' },
      ],
      postconditions: ['objeto en destino'],
      confidence: 0.9,
    };
    const a = compileSkillProgram(input);
    const b = compileSkillProgram(input);
    expect(a.digest).toBe(b.digest);
    expect(validateSkillProgram(a).executable).toBe(true);
  });

  it('fails closed when a program lacks verification', () => {
    const program = {
      id: 'skill_test',
      goal: 'mover objeto',
      steps: [{ primitive: 'move' as const, target: 'objeto' }],
      preconditions: [],
      postconditions: ['objeto movido'],
      confidence: 0.9,
      digest: 'test',
    };
    expect(validateSkillProgram(program).valid).toBe(false);
    expect(validateSkillProgram(program).reasons).toContain('POSTCONDITION_VERIFICATION_REQUIRED');
  });

  it('uses a grounded program before action-chunk fallback', () => {
    const program = compileSkillProgram({
      goal: 'entregar objeto',
      steps: [
        { primitive: 'pick', target: 'objeto' },
        { primitive: 'place', target: 'destino' },
        { primitive: 'verify', expectedObservation: 'entregado' },
      ],
      confidence: 0.8,
    });
    expect(
      arbitrateHybridExecution({
        program,
        actionChunkAvailable: true,
        observationConfident: true,
        progressConfirmed: true,
        highImpact: false,
      }).mode
    ).toBe('PROGRAM');
    expect(
      arbitrateHybridExecution({
        program,
        actionChunkAvailable: true,
        observationConfident: false,
        progressConfirmed: false,
        highImpact: false,
      }).mode
    ).toBe('ACTION_CHUNK');
  });

  it('forces human review for high-impact execution', () => {
    const program = compileSkillProgram({
      goal: 'acción sensible',
      steps: [{ primitive: 'verify', expectedObservation: 'confirmado' }],
      confidence: 0.95,
    });
    expect(
      arbitrateHybridExecution({
        program,
        actionChunkAvailable: true,
        observationConfident: true,
        progressConfirmed: true,
        highImpact: true,
      }).mode
    ).toBe('HUMAN_REVIEW');
  });
});
