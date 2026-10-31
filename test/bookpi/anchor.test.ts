// state: draft | engine-generated — Evidencia computacional del anclaje Merkle del ledger.
// Un test verde demuestra capacidad computacional, NO autoridad ni producción (AGENTS.md §1).
import { describe, expect, it } from 'vitest';
import { InMemoryBookPiLedger, type BookPiEventInput } from '../../src/bookpi/ledger';
import {
  anchorLedger,
  proveEventInclusion,
  verifyEventInclusion,
  verifyAnchorConsistency,
} from '../../src/bookpi/anchor';

const FIXED_CLOCK = () => '2026-01-01T00:00:00.000Z';

function eventInput(seq: number): BookPiEventInput {
  return {
    id: `ev-${seq}`,
    timestamp: FIXED_CLOCK(),
    type: 'genesis.turn.allowed',
    methodId: 'TINA.GENESIS.CONVERGENCE.TURN.V1.MEDIUM.INSTITUTIONAL',
    principal: 'did:isabella:operator:1',
    riskTier: 'MEDIUM',
    status: 'SUPPORTED',
  };
}

function seededLedger(count: number): InMemoryBookPiLedger {
  const ledger = new InMemoryBookPiLedger();
  for (let i = 1; i <= count; i += 1) ledger.append(eventInput(i));
  return ledger;
}

describe('bookpi/anchor — raíz y pruebas de inclusión', () => {
  it('devuelve null para un libro vacío (no inventa raíz sobre cero hojas)', () => {
    expect(anchorLedger([], FIXED_CLOCK)).toBeNull();
  });

  it('produce una raíz SHA-256 estable y de 64 hex', () => {
    const events = seededLedger(4).list();
    const a = anchorLedger(events, FIXED_CLOCK);
    const b = anchorLedger(events, FIXED_CLOCK);
    expect(a).not.toBeNull();
    expect(a?.merkleRoot).toMatch(/^[0-9a-f]{64}$/);
    expect(a?.merkleRoot).toBe(b?.merkleRoot);
    expect(a?.leafCount).toBe(4);
  });

  it('genera y verifica una prueba de inclusión para cada evento', () => {
    const events = seededLedger(5).list();
    for (let i = 1; i <= 5; i += 1) {
      const proof = proveEventInclusion(events, `ev-${i}`);
      expect(verifyEventInclusion(proof)).toBe(true);
    }
  });

  it('rechaza una prueba adulterada (root incorrecto)', () => {
    const events = seededLedger(3).list();
    const proof = proveEventInclusion(events, 'ev-2');
    expect(verifyEventInclusion({ ...proof, merkleRoot: 'f'.repeat(64) })).toBe(false);
  });

  it('detecta la alteración de la cadena respecto del anclaje publicado', () => {
    const events = seededLedger(3).list();
    const anchor = anchorLedger(events, FIXED_CLOCK);
    expect(anchor).not.toBeNull();
    if (!anchor) return;
    expect(verifyAnchorConsistency(events, anchor, 'ev-2')).toBe(true);
    // Un libro distinto (un evento menos) no es consistente con el anclaje publicado.
    const shorter = seededLedger(2).list();
    expect(verifyAnchorConsistency(shorter, anchor, 'ev-2')).toBe(false);
  });

  it('falla ante un id desconocido', () => {
    const events = seededLedger(2).list();
    expect(() => proveEventInclusion(events, 'no-existe')).toThrow('BOOKPI_ANCHOR_EVENT_NOT_FOUND');
  });
});
