import { randomUUID } from 'node:crypto';
import { bookPiLedger, type BookPiEventInput } from '../bookpi/ledger';
import { createHyperCore, createBookPiAuditor, type HyperCore } from './hypercore';
import {
  createHyperPredict,
  type HyperPredictAuditEvent,
  type HyperPredictEngine,
} from './hyperpredict';
import { createHyperCoreTurboOptimizer, hyperCoreTurbo } from './turbo-optimizer';

export {
  canonicalJson as hyperCoreCanonicalJson,
  sha256Hex as hyperCoreSha256Hex,
  sha3Hex,
  normalizeText,
  tokenize,
} from './canonical';
export { softmax as hyperCoreSoftmax, expertAffinities, createDefaultExperts } from './micro-moe';

export * from './types';
export * from './energy';
export * from './context-compiler';
export * from './adaptive-model-router';
export * from './governed-semantic-cache';
export * from './speculative-draft-engine';
export * from './veritas-omega';
export * from './cee';
export * from './hyperpredict';
export * from './hypercore';
export * from './turbo-optimizer';

const HYPERPREDICT_AUDIT_METHOD_ID =
  'TINA.YUN.HYPERPREDICT.predict_intent.v1.0.0.MEDIUM.INSTITUTIONAL';

export function createHyperPredictAuditSink(
  append: (input: BookPiEventInput) => void = (input) => {
    bookPiLedger.append(input);
  }
): (event: HyperPredictAuditEvent) => void {
  return (event) => {
    append({
      id: `hyperpredict-${randomUUID()}`,
      timestamp: new Date().toISOString(),
      type: event.type,
      methodId: HYPERPREDICT_AUDIT_METHOD_ID,
      principal: event.subject,
      riskTier: event.risk.toUpperCase(),
      status: event.decision,
    });
  };
}

export const hyperPredict: HyperPredictEngine = createHyperPredict({
  audit: createHyperPredictAuditSink(),
});
export const hyperCore: HyperCore = createHyperCore({ auditor: createBookPiAuditor() });
export const hyperCoreTurboRuntime = createHyperCoreTurboOptimizer(60000, 512);
export const hyperCoreTurboState = {
  snapshot: () => hyperCoreTurbo.snapshot(),
  warm: <T>(key: string, factory: () => T) => hyperCoreTurbo.resolve(key, factory),
  reset: () => hyperCoreTurbo.purge(),
  runtime: hyperCoreTurbo,
};
