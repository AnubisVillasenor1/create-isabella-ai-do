#!/usr/bin/env python3
"""Optional Isabella -> PennyLane bridge.

The Node/Genesis runtime owns governance. This service only executes an already
authorized quantum request and returns a JSON result.
"""

from __future__ import annotations

import hashlib
import json
import os
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import Any

try:
    import pennylane as qml
except Exception:  # pragma: no cover - environment dependent
    qml = None


BACKENDS = {
    "pennylane": "default.qubit",
    "pennylane-lightning": "lightning.qubit",
}


def jsonable(value: Any) -> Any:
    if hasattr(value, "tolist"):
        return value.tolist()
    if isinstance(value, dict):
        return {str(k): jsonable(v) for k, v in value.items()}
    if isinstance(value, (list, tuple)):
        return [jsonable(v) for v in value]
    if hasattr(value, "item"):
        try:
            return value.item()
        except Exception:
            pass
    return value


def operation(name: str, wires: list[int], parameters: list[float] | None) -> None:
    if qml is None:
        raise RuntimeError("PENNYLANE_NOT_INSTALLED")
    constructor = getattr(qml, name, None)
    if constructor is None:
        raise ValueError(f"QUANTUM_UNSUPPORTED_OPERATION:{name}")
    kwargs = {"wires": wires if len(wires) > 1 else wires[0]}
    constructor(*(parameters or []), **kwargs)


def build_measurement(circuit: dict[str, Any]):
    measurements = circuit.get("measurements") or ["probs"]
    if len(measurements) != 1:
        raise ValueError("QUANTUM_ONLY_ONE_MEASUREMENT_IS_SUPPORTED")
    measurement = measurements[0]
    if measurement == "probs":
        return qml.probs(wires=range(circuit["wires"]))
    if measurement == "state":
        return qml.state()
    if measurement == "sample":
        return qml.sample()
    if isinstance(measurement, str) and measurement.startswith("expval:"):
        _, observable, wire = measurement.split(":", 2)
        obs_ctor = getattr(qml, observable, None)
        if obs_ctor is None:
            raise ValueError(f"QUANTUM_UNSUPPORTED_OBSERVABLE:{observable}")
        return qml.expval(obs_ctor(wires=int(wire)))
    raise ValueError(f"QUANTUM_UNSUPPORTED_MEASUREMENT:{measurement}")


def execute(payload: dict[str, Any]) -> dict[str, Any]:
    if qml is None:
        raise RuntimeError("PENNYLANE_NOT_INSTALLED")

    circuit = payload["circuit"]
    backend = payload.get("backend") or "pennylane-lightning"
    if backend == "catalyst":
        try:
            qjit = qml.qjit
        except AttributeError as exc:
            raise RuntimeError("CATALYST_NOT_AVAILABLE") from exc
        device_name = "lightning.qubit"
    else:
        device_name = BACKENDS.get(backend)
        qjit = None

    if device_name is None:
        if backend == "pennylane-qiskit":
            raise RuntimeError("QISKIT_BACKEND_REQUIRES_PLUGIN_ADAPTER")
        raise RuntimeError(f"QUANTUM_BACKEND_UNSUPPORTED:{backend}")

    shots = payload.get("shots")
    seed = payload.get("seed")
    kwargs = {"wires": int(circuit["wires"])}
    if shots is not None:
        kwargs["shots"] = int(shots)
    if seed is not None:
        kwargs["seed"] = int(seed)

    dev = qml.device(device_name, **kwargs)

    @qml.qnode(dev)
    def circuit_fn():
        for item in circuit.get("operations", []):
            operation(item["name"], item["wires"], item.get("parameters"))
        return build_measurement(circuit)

    if qjit is not None:
        circuit_fn = qjit(circuit_fn)

    return jsonable(circuit_fn())


class Handler(BaseHTTPRequestHandler):
    server_version = "IsabellaPennyLaneBridge/1.0"

    def _send(self, status: int, body: dict[str, Any]) -> None:
        raw = json.dumps(body, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("content-type", "application/json; charset=utf-8")
        self.send_header("content-length", str(len(raw)))
        self.end_headers()
        self.wfile.write(raw)

    def do_GET(self) -> None:
        if self.path != "/health":
            self._send(404, {"status": "not_found"})
            return
        self._send(200 if qml is not None else 503, {
            "status": "ready" if qml is not None else "unavailable",
            "provider": "PennyLane",
            "backends": list(BACKENDS),
            "catalyst": bool(qml is not None and hasattr(qml, "qjit")),
        })

    def do_POST(self) -> None:
        if self.path != "/execute":
            self._send(404, {"status": "not_found"})
            return
        started = time.perf_counter()
        try:
            length = int(self.headers.get("content-length", "0"))
            if length > 2_000_000:
                raise ValueError("QUANTUM_PAYLOAD_TOO_LARGE")
            payload = json.loads(self.rfile.read(length))
            request_hash = hashlib.sha256(
                json.dumps(payload, sort_keys=True, separators=(",", ":")).encode()
            ).hexdigest()
            result = execute(payload)
            self._send(200, {
                "status": "executed",
                "requestId": payload.get("requestId"),
                "requestHash": request_hash,
                "backend": payload.get("backend", "pennylane-lightning"),
                "latencyMs": round((time.perf_counter() - started) * 1000, 3),
                "result": result,
            })
        except Exception as exc:
            self._send(503, {
                "status": "unavailable",
                "error": str(exc),
                "latencyMs": round((time.perf_counter() - started) * 1000, 3),
            })


if __name__ == "__main__":
    host = os.getenv("PENNYLANE_BRIDGE_HOST", "127.0.0.1")
    port = int(os.getenv("PENNYLANE_BRIDGE_PORT", "8000"))
    ThreadingHTTPServer((host, port), Handler).serve_forever()
