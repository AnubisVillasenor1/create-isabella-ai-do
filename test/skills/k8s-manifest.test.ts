import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { CANONICAL_SKILLS } from "../../src/skills";

const manifestPath = fileURLToPath(new URL("../../deploy/k8s/isabella-hypercore-omega.yaml", import.meta.url));
const yaml = readFileSync(manifestPath, "utf8");

function occurrences(haystack: string, needle: string): number {
  return haystack.split(needle).length - 1;
}

describe("ISABELLA HYPERCORE Ω Kubernetes manifest", () => {
  it("declares a sovereign namespace, runtime config and KMS-managed secret", () => {
    expect(yaml).toContain("kind: Namespace");
    expect(yaml).toContain("name: isabella-hypercore");
    expect(yaml).toContain("kind: ConfigMap");
    expect(yaml).toContain("EXECUTION_MODE: \"FAIL_CLOSED\"");
    expect(yaml).toContain("kind: Secret");
    expect(yaml).toContain("REPLACE_WITH_KMS_MANAGED_SECRET");
  });

  it("maps every canonical skill to its own microservice", () => {
    for (const skill of CANONICAL_SKILLS) {
      expect(yaml).toContain(`tamv.io/skill-id: ${skill.id}`);
    }
  });

  it("declares startup, readiness and liveness probes for every workload", () => {
    const expected = CANONICAL_SKILLS.length + 1;
    expect(occurrences(yaml, "kind: Deployment")).toBeGreaterThanOrEqual(expected);
    expect(occurrences(yaml, "startupProbe:")).toBeGreaterThanOrEqual(expected);
    expect(occurrences(yaml, "readinessProbe:")).toBeGreaterThanOrEqual(expected);
    expect(occurrences(yaml, "livenessProbe:")).toBeGreaterThanOrEqual(expected);
  });

  it("segments each microservice with autoscaling and disruption budgets", () => {
    expect(occurrences(yaml, "kind: HorizontalPodAutoscaler")).toBeGreaterThanOrEqual(CANONICAL_SKILLS.length);
    expect(occurrences(yaml, "kind: PodDisruptionBudget")).toBeGreaterThanOrEqual(3);
    expect(occurrences(yaml, "kind: NetworkPolicy")).toBeGreaterThanOrEqual(CANONICAL_SKILLS.length + 1);
  });

  it("enforces least privilege and an immutable root filesystem", () => {
    expect(occurrences(yaml, "runAsNonRoot: true")).toBeGreaterThanOrEqual(CANONICAL_SKILLS.length + 1);
    expect(occurrences(yaml, "allowPrivilegeEscalation: false")).toBeGreaterThanOrEqual(CANONICAL_SKILLS.length + 1);
    expect(occurrences(yaml, "readOnlyRootFilesystem: true")).toBeGreaterThanOrEqual(CANONICAL_SKILLS.length + 1);
    expect(yaml).not.toContain("runAsUser: 0");
  });
});
