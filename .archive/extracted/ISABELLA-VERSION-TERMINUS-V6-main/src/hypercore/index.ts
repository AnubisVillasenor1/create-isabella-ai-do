/**
 * Isabella HyperCore Ω² + HyperPredict Ω — barrel (state: draft | engine-generated).
 *
 * Public surface of the cognitive hyperacceleration runtime. HyperCore PREDICTS,
 * COMPRESSES, ROUTES, SPECULATES, VERIFIES and AUDITS; it never executes a
 * governed side effect and never authorizes (CROWN authorizes; BookPI remembers).
 *
 * Barrel note: `canonicalJson`, `sha256Hex` and `softmax` alias out because
 * bookpi/crypto and cognition/moe already export homonyms with different
 * implementations; `HYPERCORE_MODES` was renamed at source to
 * `HYPERCORE_OMEGA_MODES` to avoid clashing with the V5 constant.
 */
import { randomUUID } from "node:crypto";
import { bookPiLedger, type BookPiEventInput } from "../bookpi/ledger";
import { createHyperCore, createBookPiAuditor, type HyperCore } from "./hypercore";
import { createHyperPredict, type HyperPredictAuditEvent, type HyperPredictEngine } from "./hyperpredict";

export {
  canonicalJson as hyperCoreCanonicalJson,
  sha256Hex as hyperCoreSha256Hex,
  sha3Hex,
  normalizeText,
  tokenize,
} from "./canonical";
export { softmax as hyperCoreSoftmax, expertAffinities, createDefaultExperts } from "./micro-moe";

export * from "./types";
export * from "./energy";
export * from "./context-compiler";
export * from "./adaptive-model-router";
export * from "./governed-semantic-cache";
export * from "./speculative-draft-engine";
export * from "./veritas-omega";
export * from "./cee";
export * from "./hyperpredict";
export * from "./hypercore";

const HYPERPREDICT_AUDIT_METHOD_ID =
  "TINA.YUN.HYPERPREDICT.predict_intent.v1.0.0.MEDIUM.INSTITUTIONAL";

/**
 * Route HyperPredict decisions into the append-only BookPI ledger. Decisions are
 * recorded as evidence, never as authority: BookPI remembers, CROWN authorizes.
 */
export function createHyperPredictAuditSink(
  append: (input: BookPiEventInput) => void = (input) => {
    bookPiLedger.append(input);
  },
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

/** Process-wide HyperPredict engine wired to BookPI evidence. */
export const hyperPredict: HyperPredictEngine = createHyperPredict({ audit: createHyperPredictAuditSink() });

/** Process-wide HyperCore orchestrator wired to the BookPI auditor. */
export const hyperCore: HyperCore = createHyperCore({ auditor: createBookPiAuditor() });
