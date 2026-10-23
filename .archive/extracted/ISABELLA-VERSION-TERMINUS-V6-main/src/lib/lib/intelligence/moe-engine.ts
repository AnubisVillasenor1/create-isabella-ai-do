import type { IntelligenceProvider, IntelligenceRequest, IntelligenceResponse } from "./contracts";

export interface MoEExpert {
  readonly modelId: string;
  readonly providerId: string;
  readonly capabilities: readonly string[];
  readonly priority: number;
  readonly productionApproved: boolean;
}
export interface MoERoute {
  requestId: string;
  selected: MoEExpert[];
  topK: number;
  strategy: "capability-weighted-top-k";
}
export interface MoERunResult {
  route: MoERoute;
  responses: IntelligenceResponse[];
  selected: IntelligenceResponse;
  executedExpertCount: number;
}
function capabilityScore(expert: MoEExpert, request: IntelligenceRequest): number {
  const modality = request.modality ?? "text";
  return (
    (expert.capabilities.includes(modality) ? 0.35 : 0) +
    (request.preferredModel === expert.modelId ? 0.25 : 0) +
    Math.max(0, Math.min(expert.priority, 100)) / 1000
  );
}
export function createMoERoute(
  request: IntelligenceRequest,
  providers: ReadonlyMap<string, IntelligenceProvider>,
  descriptors: ReadonlyMap<
    string,
    { modalities: readonly string[]; enabled: boolean; productionApproved: boolean }
  >,
  topK = 3,
): MoERoute {
  const experts = [...providers.entries()]
    .map(([modelId, provider]) => {
      const descriptor = descriptors.get(modelId);
      return {
        modelId,
        providerId: provider.providerId,
        capabilities: descriptor?.modalities ?? [...provider.capabilities],
        priority: descriptor?.productionApproved ? 100 : 0,
        productionApproved: descriptor?.productionApproved === true,
      };
    })
    .filter((expert) => descriptors.get(expert.modelId)?.enabled !== false)
    .sort(
      (a, b) =>
        capabilityScore(b, request) - capabilityScore(a, request) ||
        a.modelId.localeCompare(b.modelId),
    );
  return {
    requestId: request.requestId,
    selected: experts.slice(0, Math.max(1, Math.min(topK, 5))),
    topK: Math.max(1, Math.min(topK, 5)),
    strategy: "capability-weighted-top-k",
  };
}
function utility(response: IntelligenceResponse): number {
  const riskPenalty =
    response.risk === "CRITICAL"
      ? 1
      : response.risk === "HIGH"
        ? 0.5
        : response.risk === "MEDIUM"
          ? 0.2
          : 0;
  const degradationPenalty = response.degraded ? 0.35 : 0;
  const lengthSignal = Math.min(response.text.trim().length / 400, 1) * 0.15;
  return (
    1 -
    riskPenalty -
    degradationPenalty +
    lengthSignal -
    Math.min(response.latencyMs / 60000, 1) * 0.1
  );
}
export async function executeMoE(
  request: IntelligenceRequest,
  route: MoERoute,
  providers: ReadonlyMap<string, IntelligenceProvider>,
): Promise<MoERunResult> {
  const responses = (
    await Promise.all(
      route.selected.map(async (expert) => {
        const provider = providers.get(expert.modelId);
        if (!provider || !(await provider.health())) return null;
        try {
          return await provider.invoke(request);
        } catch {
          return null;
        }
      }),
    )
  ).filter((value): value is IntelligenceResponse => value !== null);
  if (!responses.length) throw new Error("moe_inference_unavailable:no_expert_succeeded");
  const selected = [...responses].sort(
    (a, b) => utility(b) - utility(a) || a.modelId.localeCompare(b.modelId),
  )[0];
  return { route, responses, selected, executedExpertCount: responses.length };
}
