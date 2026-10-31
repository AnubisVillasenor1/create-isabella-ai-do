/**
 * GAME OVER — Universal Agent Governance Protocol (UAGP-1) (state: draft).
 *
 * Decide, score and record agent actions before execution. Never execute,
 * never certify. See docs/reference/GOVERNANCE.md for the fidelity
 * contract and the Jenkins gate that consumes this engine.
 */
export * from './types';
export * from './constitution';
export * from './trust-engine';
export * from './risk-engine';
export * from './ethics-engine';
export * from './explainability-engine';
export * from './cognitive-court';
export * from './passport-authority';
export * from './passport-store';
export * from './validator';
export * from './human-approval-gate';
export * from './audit';
export * from './gateway';

import { createPassportAuthority } from './passport-authority';
import { createJsonPassportStore } from './passport-store';
import { createUagpGateway } from './gateway';

// Process-wide AI Passport registry. Durable when GAMEOVER_PASSPORT_PATH points
// at a persistent volume; otherwise in-memory (single process, no durability).
const passportStorePath = (process.env.GAMEOVER_PASSPORT_PATH ?? '').trim();
export const passportAuthority = createPassportAuthority(
  passportStorePath ? { store: createJsonPassportStore(passportStorePath) } : {}
);

/** Process-wide UAGP-1 gateway wired to the shared passport authority. */
export const uagpGateway = createUagpGateway({ passportAuthority });
