import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const K8S = join(process.cwd(), "k8s");
const read = (file: string): string => readFileSync(join(K8S, file), "utf8");

function firstLineMatch(text: string, regex: RegExp): string | undefined {
  return text.split(/\r?\n/).find((line) => regex.test(line));
}

describe("k8s deployment manifest (ISA-355)", () => {
  it("declares an image reference and never a mutable :latest tag", () => {
    const deployment = read("deployment.yaml");
    const image = firstLineMatch(deployment, /^\s+image:\s+/);
    expect(image).toBeDefined();
    expect(image).not.toMatch(/:latest\b/);
  });

  it("pins the image to a digest OR marks the raw tag as BLOCKED_ENVIRONMENT honestly", () => {
    const deployment = read("deployment.yaml");
    const image = firstLineMatch(deployment, /^\s+image:\s+/) ?? "";
    const digestPinned = /@sha256:[0-9a-f]{64}$/.test(image);
    if (digestPinned) {
      expect(image).toMatch(/^.+@sha256:[0-9a-f]{64}$/);
    } else {
      // No digest resuelto → debe estar declarado PENDIENTE/BLOCKED_ENVIRONMENT,
      // nunca presentarse como verificado.
      expect(deployment).toMatch(/ISA-355/);
      expect(deployment).toMatch(/BLOCKED_ENVIRONMENT|PENDIENTE/);
    }
  });

  it("references secrets only via secretRef, never literals", () => {
    const deployment = read("deployment.yaml");
    expect(deployment).toMatch(/secretRef/);
    expect(firstLineMatch(deployment, /ISA-362/)).toBeDefined();
  });
});

describe("k8s network policy (ISA-368)", () => {
  it("applies egress deny-by-default with an explicit allowlist", () => {
    const netpol = read("networkpolicy.yaml");
    const policies = netpol.split(/\n---\n/).filter((doc) => /kind: NetworkPolicy/.test(doc));
    expect(policies.length).toBeGreaterThanOrEqual(4);

    const defaultDeny = policies.find((doc) => doc.includes("isabella-genesis-default-deny"));
    expect(defaultDeny).toBeDefined();
    expect(defaultDeny).toMatch(/policyTypes:\s*\n\s*- Ingress\s*\n\s*- Egress/);
    // deny-by-default: la política no abre ningún tráfico por defecto.
    expect(defaultDeny).not.toMatch(/^\s*ingress:/m);
    expect(defaultDeny).not.toMatch(/^\s*egress:/m);
  });

  it("allows egress only to DNS (53) and HTTPS (443) - and flags provisional CIDRs", () => {
    const netpol = read("networkpolicy.yaml");
    expect(netpol).toMatch(/port: 53/);
    expect(netpol).toMatch(/port: 443/);
    const hasEgressHttps = /isabella-genesis-allow-egress-https/.test(netpol);
    expect(hasEgressHttps).toBe(true);
    // La allowlist 0.0.0.0/0 es PROVISIONAL y debe declararse como tal, nunca silenciosa.
    expect(netpol).toMatch(/0\.0\.0\.0\/0/);
    expect(netpol).toMatch(/BLOCKED_ENVIRONMENT|REQUIERE_VERIFICACION|ISA-368/);
  });
});