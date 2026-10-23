/**
 * MOE UI TRUTH — labels honestos de UI respecto al router MoE (ISA-451).
 * state: draft | engine-generated (pendiente revisión humana).
 *
 * No existe frontend; este contrato es la frontera que un futuro UI consumidor
 * debe respetar: un rótulo de UI que anuncie "MoE / DeepSeek-V3 / gate / expertos"
 * sólo es honesto si la familia de router satisface el contrato MoE soberano
 * (`src/cognition/moe/contract.ts`). El router heurístico (`adaptive-router`)
 * es HEURISTIC_LEXICAL y NO satisface el contrato: etiquetarlo como MoE o
 * DeepSeek-V3 es MISLABELED.
 */
import { satisfiesMoeContract, type RouterFamily } from "../cognition/moe/contract";

export type UiTruthVerdict = "HONEST_LABEL" | "MISLABELED";

export interface UiRouterLabelVerdict {
  readonly verdict: UiTruthVerdict;
  readonly family: RouterFamily;
  readonly label: string;
  readonly reason: string;
}

const RESERVED_CAPABILITY_MARKERS: readonly string[] = Object.freeze([
  "moe",
  "deepseek",
  "experts",
  "gate",
  "top-k",
  "logits",
  "router neuronal",
  "mixture of experts",
]);

export function classifyUiRouterLabel(family: RouterFamily, label: string): UiRouterLabelVerdict {
  const normalized = label.toLowerCase();
  const claimsMoeCapability = RESERVED_CAPABILITY_MARKERS.some((marker) => normalized.includes(marker));
  const contractSatisfied = satisfiesMoeContract(family);
  if (claimsMoeCapability && !contractSatisfied) {
    return Object.freeze({
      verdict: "MISLABELED" as const,
      family,
      label,
      reason: `UI_TRUTH: la familia ${family} no satisface el contrato MoE; el rótulo anuncia una capacidad que no tiene.`,
    });
  }
  return Object.freeze({
    verdict: "HONEST_LABEL" as const,
    family,
    label,
    reason: `UI_TRUTH: rótulo coherente con la familia ${family} (satisfiesMoeContract=${contractSatisfied}).`,
  });
}

export function assertRouterLabelHonest(family: RouterFamily, label: string): void {
  const verdict = classifyUiRouterLabel(family, label);
  if (verdict.verdict === "MISLABELED") throw new Error(verdict.reason);
}