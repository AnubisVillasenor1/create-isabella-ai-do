/** Consenso y consentimiento (IDENTITY & AUTHORITY — consent). */

export interface ConsentRecord {
  principalId: string;
  purpose: string;
  scope: readonly string[];
  grantedAt: string;
  grantedBy: "human" | "delegated";
  revokedAt?: string;
}

export interface ConsentRegistryLike {
  check(principalId: string, purpose: string, scope: string): boolean;
  register(record: ConsentRecord): void;
  revoke(principalId: string, purpose: string, scope: string): void;
}

export function createConsentRegistry(): ConsentRegistryLike {
  const records: ConsentRecord[] = [];

  return {
    check(principalId, purpose, scope) {
      return records.some(
        (r) =>
          r.principalId === principalId &&
          r.purpose === purpose &&
          !r.revokedAt &&
          r.scope.includes(scope),
      );
    },
    register(record) {
      if (record.grantedBy !== "human" && record.grantedBy !== "delegated") {
        throw new Error("CONSENT: el consentimiento debe provenir de un humano o de delegación explícita");
      }
      records.push({ ...record });
    },
    revoke(principalId, purpose, scope) {
      const target = records.find(
        (r) =>
          r.principalId === principalId &&
          r.purpose === purpose &&
          r.scope.includes(scope) &&
          !r.revokedAt,
      );
      if (target) {
        target.revokedAt = new Date().toISOString();
      }
    },
  };
}

export type ConsentRequirement = {
  purpose: string;
  scope: string;
};

/** La retirada de consentimiento es retroactiva y sin coste (reversibilidad). */
export function requireConsent(
  registry: ConsentRegistryLike,
  principalId: string,
  requirement: ConsentRequirement,
): boolean {
  return registry.check(principalId, requirement.purpose, requirement.scope);
}