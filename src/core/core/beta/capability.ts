/**
 * Beta Subsystem: Capability Registry
 *
 * Registro y selección de capacidades/herramientas autorizadas.
 */

import type { IsabellaDualRequest } from '../contracts';

export interface CapabilitySelection {
  capabilityId: string;
  name: string;
  authorized: boolean;
}

export class CapabilityRegistry {
  select(input: {
    intent: string;
    requestedCapabilities: string[];
    allowedScopes: string[];
    constraints?: IsabellaDualRequest['constraints'];
  }): CapabilitySelection | null {
    if (input.requestedCapabilities.length === 0) {
      return null;
    }

    const first = input.requestedCapabilities[0];
    if (!first) return null;
    return {
      capabilityId: first,
      name: `Capability_${first}`,
      authorized: input.allowedScopes.includes(first) || input.allowedScopes.includes('all'),
    };
  }
}

export const capabilityRegistry = new CapabilityRegistry();
