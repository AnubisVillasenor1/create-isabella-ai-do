import { createHash, randomUUID } from "node:crypto";

export type PennyLaneBackend =
  | "pennylane"
  | "pennylane-lightning"
  | "catalyst"
  | "pennylane-qiskit";

export interface QuantumOperation {
  name: string;
  wires: number[];
  parameters?: number[];
}

export interface QuantumCircuit {
  name?: string;
  wires: number;
  operations: readonly QuantumOperation[];
  measurements?: readonly string[];
}

export interface PennyLaneExecutionRequest {
  circuit: QuantumCircuit;
  backend?: PennyLaneBackend;
  shots?: number | null;
  seed?: number;
  metadata?: Readonly<Record<string, string>>;
}

export interface PennyLaneExecutionResult {
  requestId: string;
  backend: PennyLaneBackend;
  status: "executed" | "unavailable" | "rejected";
  latencyMs: number;
  requestHash: string;
  result?: unknown;
  error?: string;
}

export interface PennyLaneBridgeConfig {
  endpoint?: string;
  timeoutMs?: number;
  defaultBackend?: PennyLaneBackend;
}

export const PENNYLANE_REPOSITORIES = Object.freeze({
  pennylane: "https://github.com/PennyLaneAI/pennylane",
  lightning: "https://github.com/PennyLaneAI/pennylane-lightning",
  catalyst: "https://github.com/PennyLaneAI/catalyst",
  qiskit: "https://github.com/PennyLaneAI/pennylane-qiskit",
});

export class PennyLaneBridge {
  private readonly endpoint?: string;
  private readonly timeoutMs: number;
  private readonly defaultBackend: PennyLaneBackend;

  constructor(config: PennyLaneBridgeConfig = {}) {
    this.endpoint = config.endpoint?.replace(/\/$/, "");
    this.timeoutMs = Math.max(100, Math.min(config.timeoutMs ?? 5000, 30000));
    this.defaultBackend = config.defaultBackend ?? "pennylane-lightning";
  }

  describe() {
    return {
      provider: "PennyLane",
      status: this.endpoint ? "configured" : "not-configured",
      endpoint: this.endpoint ?? null,
      defaultBackend: this.defaultBackend,
      repositories: PENNYLANE_REPOSITORIES,
      contract: "isabella.quantum.pennylane.v1",
    } as const;
  }

  async health(): Promise<{ status: "ready" | "unavailable"; latencyMs: number; endpoint: string | null }> {
    if (!this.endpoint) return { status: "unavailable", latencyMs: 0, endpoint: null };
    const started = Date.now();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await fetch(`${this.endpoint}/health`, { signal: controller.signal });
      return { status: response.ok ? "ready" : "unavailable", latencyMs: Date.now() - started, endpoint: this.endpoint };
    } catch {
      return { status: "unavailable", latencyMs: Date.now() - started, endpoint: this.endpoint };
    } finally {
      clearTimeout(timer);
    }
  }

  async execute(request: PennyLaneExecutionRequest): Promise<PennyLaneExecutionResult> {
    const requestId = randomUUID();
    const started = Date.now();
    const backend = request.backend ?? this.defaultBackend;
    const requestHash = createHash("sha256")
      .update(JSON.stringify({ ...request, backend }))
      .digest("hex");

    const validationError = validateCircuit(request.circuit);
    if (validationError) {
      return { requestId, backend, status: "rejected", latencyMs: Date.now() - started, requestHash, error: validationError };
    }

    if (!this.endpoint) {
      return {
        requestId,
        backend,
        status: "unavailable",
        latencyMs: Date.now() - started,
        requestHash,
        error: "PENNYLANE_BRIDGE_ENDPOINT_NOT_CONFIGURED",
      };
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await fetch(`${this.endpoint}/execute`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-isabella-request-id": requestId },
        body: JSON.stringify({ ...request, backend, requestId, requestHash }),
        signal: controller.signal,
      });
      const text = await response.text();
      let result: unknown = text;
      try { result = text ? JSON.parse(text) : null; } catch { /* keep text */ }
      if (!response.ok) {
        return { requestId, backend, status: "rejected", latencyMs: Date.now() - started, requestHash, error: `PENNYLANE_HTTP_${response.status}`, result };
      }
      return { requestId, backend, status: "executed", latencyMs: Date.now() - started, requestHash, result };
    } catch (error) {
      return {
        requestId,
        backend,
        status: "unavailable",
        latencyMs: Date.now() - started,
        requestHash,
        error: error instanceof Error ? error.message : "PENNYLANE_BRIDGE_UNAVAILABLE",
      };
    } finally {
      clearTimeout(timer);
    }
  }
}

function validateCircuit(circuit: QuantumCircuit): string | null {
  if (!circuit || !Number.isInteger(circuit.wires) || circuit.wires < 1 || circuit.wires > 128) {
    return "QUANTUM_INVALID_WIRE_COUNT";
  }
  if (!Array.isArray(circuit.operations) || circuit.operations.length > 4096) {
    return "QUANTUM_INVALID_OPERATION_COUNT";
  }
  for (const operation of circuit.operations) {
    if (!operation?.name || !Array.isArray(operation.wires) || operation.wires.length === 0) {
      return "QUANTUM_INVALID_OPERATION";
    }
    if (operation.wires.some((wire: number) => !Number.isInteger(wire) || wire < 0 || wire >= circuit.wires)) {
      return "QUANTUM_WIRE_OUT_OF_RANGE";
    }
    if (operation.parameters?.some((value: number) => !Number.isFinite(value))) {
      return "QUANTUM_INVALID_PARAMETER";
    }
  }
  return null;
}

export function createPennyLaneBridgeFromEnv(): PennyLaneBridge {
  return new PennyLaneBridge({
    endpoint: process.env.PENNYLANE_BRIDGE_URL,
    timeoutMs: Number(process.env.PENNYLANE_BRIDGE_TIMEOUT_MS ?? 5000),
    defaultBackend: (process.env.PENNYLANE_BACKEND as PennyLaneBackend | undefined) ?? "pennylane-lightning",
  });
}
