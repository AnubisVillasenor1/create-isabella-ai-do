import { describe, expect, it } from "vitest";
import { PennyLaneBridge } from "../src/quantum";

describe("Isabella → PennyLane bridge", () => {
  it("exposes the canonical PennyLane ecosystem repositories", () => {
    const bridge = new PennyLaneBridge();
    expect(bridge.describe().repositories.pennylane).toBe("https://github.com/PennyLaneAI/pennylane");
    expect(bridge.describe().repositories.lightning).toContain("pennylane-lightning");
    expect(bridge.describe().repositories.catalyst).toContain("catalyst");
    expect(bridge.describe().repositories.qiskit).toContain("pennylane-qiskit");
  });

  it("fails closed when no bridge endpoint is configured", async () => {
    const bridge = new PennyLaneBridge();
    const result = await bridge.execute({
      circuit: { wires: 1, operations: [{ name: "Hadamard", wires: [0] }] },
    });
    expect(result.status).toBe("unavailable");
    expect(result.error).toBe("PENNYLANE_BRIDGE_ENDPOINT_NOT_CONFIGURED");
  });

  it("rejects malformed circuits before network access", async () => {
    const bridge = new PennyLaneBridge();
    const result = await bridge.execute({
      circuit: { wires: 0, operations: [] },
    });
    expect(result.status).toBe("rejected");
    expect(result.error).toBe("QUANTUM_INVALID_WIRE_COUNT");
  });
});
