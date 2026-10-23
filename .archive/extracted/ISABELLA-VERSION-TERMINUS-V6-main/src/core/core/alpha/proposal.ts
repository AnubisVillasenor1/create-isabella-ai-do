/**
 * Alpha Subsystem: Proposal Engine
 *
 * Transforma hipótesis y contexto en propuestas de valor estructuradas.
 */

import type { Proposal } from "../contracts";

export interface ProposalInput {
  query: string;
  intent: string;
  hypothesis: string;
  alternatives: string[];
  risks: string[];
  experiments: string[];
  constraints?: {
    maxLatencyMs?: number;
    maxCostUsd?: number;
    maxSteps?: number;
  };
}

export class ProposalEngine {
  generate(input: ProposalInput): Proposal {
    return {
      proposalId: crypto.randomUUID(),
      title: `Propuesta: ${input.query.slice(0, 50)}`,
      problem: input.query,
      valueProposition: input.hypothesis,
      audience: ["ecosistema_tamv", "usuario_soberano"],
      alternatives: input.alternatives.map((alt) => ({
        name: typeof alt === "string" ? alt : "Alternativa",
        cost: 0,
        currency: "USD",
        risk: "low",
        timeToFirstResult: "inmediato",
      })),
      assumptions: ["Disponibilidad de servicios", "Permisos válidos"],
      uncertainties: input.risks.map((r) => String(r)),
      firstDeliverable: "Respuesta verificada por CROWN",
      metrics: ["Latencia", "Conformidad CROWN", "Trazabilidad BookPI"],
      status: "draft",
      createdAt: new Date().toISOString(),
    };
  }
}

export const proposalEngine = new ProposalEngine();
