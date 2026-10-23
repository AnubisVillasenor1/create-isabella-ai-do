/**
 * Alpha Subsystem: Context Builder
 *
 * Estructura y contextualiza la sesión, el proyecto y el territorio.
 */

export interface SessionContext {
  sessionId: string;
  startedAt: string;
  turnCount: number;
  lastActivityAt: string;
  memoryEnabled: boolean;
}

export interface TerritoryContext {
  territoryName: string;
  locationId?: string;
  jurisdiction?: string;
}

export interface ContextConstraints {
  maxLatencyMs?: number;
  maxCostUsd?: number;
  maxSteps?: number;
  requiredCapabilities?: string[];
  forbiddenCapabilities?: string[];
}

export interface ContextFrame {
  session: SessionContext;
  project?: {
    projectId?: string;
  };
  territory: TerritoryContext;
  constraints: ContextConstraints;
  builtAt: string;
}

export class ContextBuilder {
  build(input: {
    session: SessionContext;
    project?: { projectId?: string };
    territory?: TerritoryContext;
    constraints?: ContextConstraints;
  }): ContextFrame {
    return {
      session: input.session,
      project: input.project,
      territory: input.territory ?? { territoryName: "Mineral del Monte" },
      constraints: input.constraints ?? {},
      builtAt: new Date().toISOString(),
    };
  }
}

export const contextBuilder = new ContextBuilder();
