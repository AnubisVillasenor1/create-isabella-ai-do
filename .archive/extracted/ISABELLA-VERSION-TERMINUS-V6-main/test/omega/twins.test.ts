import { describe, expect, it } from "vitest";
import {
  federateDigitalTwins,
  type FederationGrant,
  type TwinNode,
} from "../../src/omega/twins";

function twin(id: string, capabilities: string[] = ["infer"]): TwinNode {
  return { id, capabilities, dataResidency: "mx" };
}

function grant(overrides: Partial<FederationGrant> = {}): FederationGrant {
  return {
    fromTwin: "a",
    toTwin: "b",
    scope: "telemetry",
    approvedByHuman: true,
    ...overrides,
  };
}

describe("Ω∞-16 Federated Digital Twin", () => {
  it("una concesión aprobada por humano sin expiración autoriza la arista", () => {
    const view = federateDigitalTwins({
      nodes: [twin("a"), twin("b")],
      grants: [grant()],
      now: "2026-10-16T00:00:00.000Z",
    });
    expect(view.edges).toHaveLength(1);
    expect(view.edges[0]?.authorized).toBe(true);
    expect(view.edges[0]?.reason).toBe("authorized");
  });

  it("una concesión sin aprobación humana se rechaza (fail-closed)", () => {
    const view = federateDigitalTwins({
      nodes: [twin("a"), twin("b")],
      grants: [grant({ approvedByHuman: false })],
      now: "2026-10-16T00:00:00.000Z",
    });
    expect(view.edges[0]?.authorized).toBe(false);
    expect(view.edges[0]?.reason).toBe("human_approval_required");
  });

  it("una concesión expirada se rechaza aunque esté aprobada", () => {
    const view = federateDigitalTwins({
      nodes: [twin("a"), twin("b")],
      grants: [grant({ expiresAt: "2026-10-15T00:00:00.000Z" })],
      now: "2026-10-16T00:00:00.000Z",
    });
    expect(view.edges[0]?.authorized).toBe(false);
    expect(view.edges[0]?.reason).toBe("expired");
  });

  it("una concesión hacia o desde un gemelo desconocido se rechaza", () => {
    const view = federateDigitalTwins({
      nodes: [twin("a")],
      grants: [grant({ toTwin: "ghost" })],
      now: "2026-10-16T00:00:00.000Z",
    });
    expect(view.edges[0]?.authorized).toBe(false);
    expect(view.edges[0]?.reason).toBe("unknown_twin");
  });

  it("un id de gemelo duplicado lanza FEDERATION_DUPLICATE_TWIN", () => {
    expect(() =>
      federateDigitalTwins({ nodes: [twin("a"), twin("a")], grants: [] }),
    ).toThrow("FEDERATION_DUPLICATE_TWIN");
  });

  it("ordena nodos por id y aristas de forma determinista", () => {
    const view = federateDigitalTwins({
      nodes: [twin("z"), twin("a"), twin("m")],
      grants: [
        grant({ fromTwin: "m", toTwin: "a", scope: "zeta" }),
        grant({ fromTwin: "m", toTwin: "a", scope: "alfa" }),
        grant({ fromTwin: "a", toTwin: "z", scope: "telemetry" }),
      ],
      now: "2026-10-16T00:00:00.000Z",
    });
    expect(view.nodes.map((n) => n.id)).toEqual(["a", "m", "z"]);
    expect(
      view.edges.map((e) => [e.fromTwin, e.toTwin, e.scope]),
    ).toEqual([
      ["a", "z", "telemetry"],
      ["m", "a", "alfa"],
      ["m", "a", "zeta"],
    ]);
  });

  it("las capabilities devueltas son copias deduplicadas y ordenadas", () => {
    const input: TwinNode[] = [twin("a", ["zeta", "alfa", "zeta"])];
    const view = federateDigitalTwins({ nodes: input, grants: [] });
    expect(view.nodes[0]?.capabilities).toEqual(["alfa", "zeta"]);
    view.nodes[0]?.capabilities.push("mutated");
    expect(input[0]?.capabilities).toEqual(["zeta", "alfa", "zeta"]);
  });
});
