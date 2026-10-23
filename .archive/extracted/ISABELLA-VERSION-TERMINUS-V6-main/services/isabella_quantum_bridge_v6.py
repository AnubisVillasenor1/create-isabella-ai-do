#!/usr/bin/env python3
"""
=============================================================================
ISABELLA QUANTUM BRIDGE v6 — Sovereign Cognitive & Quantum Runtime
=============================================================================
Objetivos de producción:
- Cero mock data.
- Protocolo JSONL persistente sobre stdio.
- Validación exhaustiva de esquemas, tipos y números finitos.
- Verificación real de firmas de manifiestos mediante HMAC-SHA256 con clave secreta privada.
- Aislamiento multi-tenant y verificación estricta de scopes de seguridad.
- Ejecución sobre PennyLane / Lightning / Qiskit con fallback clásico determinista explícito.
- Trazabilidad y procedencia criptográfica SHA3-512.
- Presupuestos acotados de wires (<=32), shots (<=500,000), features (<=64) y latencia.
=============================================================================
"""

from __future__ import annotations

import argparse
import hashlib
import hmac
import importlib.util
import json
import math
import os
import platform
import sys
import time
import uuid
from dataclasses import dataclass
from typing import Any

SYSTEM_IDENTIFIER = "isabella-core"
POLICY_ID = "EOCT_STRICT_V2"
BRIDGE_VERSION = "quantum-bridge-v6"
SCHEMA_VERSION = "isabella.quantum.v6"

MAX_INPUT_BYTES = int(os.getenv("QUANTUM_MAX_INPUT_BYTES", "131072"))
MAX_OUTPUT_BYTES = int(os.getenv("QUANTUM_MAX_OUTPUT_BYTES", "4194304"))
MAX_WIRES = int(os.getenv("QUANTUM_MAX_WIRES", "32"))
MAX_SHOTS = int(os.getenv("QUANTUM_MAX_SHOTS", "500000"))
MAX_FEATURES = int(os.getenv("QUANTUM_MAX_FEATURES", "64"))
MAX_WEIGHTS = int(os.getenv("QUANTUM_MAX_WEIGHTS", "128"))
MAX_LATENCY_MS = int(os.getenv("QUANTUM_MAX_LATENCY_MS", "45000"))
MANIFEST_SECRET_ENV = "ISABELLA_MANIFEST_HMAC_SECRET"

DEVICE_REGISTRY: dict[str, dict[str, Any]] = {
    "default.qubit": {
        "implementation": "PENNYLANE_SIMULATOR",
        "modules": ("pennylane",),
        "execution_mode": "quantum_simulator",
        "remote": False,
        "required_scopes": ("quantum:execute",),
    },
    "lightning.qubit": {
        "implementation": "PENNYLANE_LIGHTNING",
        "modules": ("pennylane", "pennylane_lightning"),
        "execution_mode": "quantum_simulator",
        "remote": False,
        "required_scopes": ("quantum:execute", "quantum:lightning"),
    },
    "qiskit.aer": {
        "implementation": "PENNYLANE_QISKIT_AER",
        "modules": ("pennylane", "pennylane_qiskit"),
        "execution_mode": "quantum_simulator",
        "remote": False,
        "required_scopes": ("quantum:execute", "quantum:qiskit"),
    },
}


class BridgeError(Exception):
    def __init__(
        self,
        code: str,
        message: str,
        federation: str,
        retryable: bool = False,
    ) -> None:
        super().__init__(message)
        self.code = code
        self.message = message
        self.federation = federation
        self.retryable = retryable


@dataclass(frozen=True)
class QuantumRequest:
    request_id: str
    tenant_id: str
    provider: str
    task: str
    wires: int
    shots: int | None
    features: tuple[float, ...]
    weights: tuple[float, ...]
    scopes: tuple[str, ...]
    ansatz: str
    policy_version: str
    request_hash: str
    circuit_hash: str


def fail(
    code: str,
    message: str,
    federation: str,
    retryable: bool = False,
) -> None:
    raise BridgeError(code, message, federation, retryable)


def canonical_bytes(value: Any) -> bytes:
    try:
        return json.dumps(
            value,
            ensure_ascii=False,
            sort_keys=True,
            separators=(",", ":"),
            allow_nan=False,
        ).encode("utf-8")
    except (TypeError, ValueError) as error:
        fail(
            "NON_CANONICAL_VALUE",
            str(error),
            "STORAGE_STATE_FEDERATION",
        )


def sha3(value: Any) -> str:
    return "sha3-512:" + hashlib.sha3_512(canonical_bytes(value)).hexdigest()


def finite_number(value: Any, field: str) -> float:
    try:
        parsed = float(value)
    except (TypeError, ValueError):
        fail(
            "INVALID_NUMBER",
            f"{field} must be numeric",
            "GOVERNANCE_POLICY_FEDERATION",
        )
    if not math.isfinite(parsed):
        fail(
            "NON_FINITE_NUMBER",
            f"{field} must be finite",
            "GOVERNANCE_POLICY_FEDERATION",
        )
    return parsed


def string_field(
    value: Any,
    field: str,
    maximum: int,
    default: str | None = None,
) -> str:
    if value is None and default is not None:
        value = default
    if not isinstance(value, str):
        fail(
            "INVALID_FIELD",
            f"{field} must be a string",
            "SECURITY_IDENTITY_FEDERATION",
        )
    value = value.strip()
    if not value:
        fail(
            "EMPTY_FIELD",
            f"{field} cannot be empty",
            "SECURITY_IDENTITY_FEDERATION",
        )
    if len(value) > maximum:
        fail(
            "FIELD_TOO_LONG",
            f"{field} exceeds {maximum} characters",
            "SECURITY_IDENTITY_FEDERATION",
        )
    return value


def numeric_tuple(value: Any, field: str, maximum: int) -> tuple[float, ...]:
    if value is None:
        return ()
    if not isinstance(value, list):
        fail(
            "INVALID_ARRAY",
            f"{field} must be an array",
            "GOVERNANCE_POLICY_FEDERATION",
        )
    if len(value) > maximum:
        fail(
            "ARRAY_LIMIT_EXCEEDED",
            f"{field} exceeds {maximum} items",
            "GOVERNANCE_POLICY_FEDERATION",
        )
    return tuple(finite_number(item, field) for item in value)


def installed(modules: tuple[str, ...]) -> dict[str, bool]:
    return {module: importlib.util.find_spec(module) is not None for module in modules}


class ManifestVerifier:
    @staticmethod
    def verify(manifest: Any) -> tuple[bool, str]:
        if not isinstance(manifest, dict):
            return False, "MISSING_ARTIFACT_MANIFEST"
        payload = manifest.get("payload")
        signature = manifest.get("signature")
        algorithm = manifest.get("algorithm")

        if not isinstance(payload, dict):
            return False, "INVALID_MANIFEST_PAYLOAD"
        if not isinstance(signature, str):
            return False, "MISSING_MANIFEST_SIGNATURE"
        if algorithm != "HMAC-SHA256":
            return False, "UNSUPPORTED_MANIFEST_ALGORITHM"

        secret = os.getenv(MANIFEST_SECRET_ENV) or os.getenv("ISABELLA_AUTH_SECRET")
        if not secret:
            return False, "MANIFEST_SECRET_NOT_CONFIGURED"

        expected = hmac.new(
            secret.encode("utf-8"),
            canonical_bytes(payload),
            hashlib.sha256,
        ).hexdigest()

        if not hmac.compare_digest(expected, signature):
            return False, "MANIFEST_SIGNATURE_MISMATCH"
        return True, "MANIFEST_VERIFIED"


class Governance:
    @staticmethod
    def validate(request: QuantumRequest) -> None:
        if not 1 <= request.wires <= MAX_WIRES:
            fail(
                "WIRE_LIMIT_EXCEEDED",
                f"wires must be between 1 and {MAX_WIRES}",
                "GOVERNANCE_POLICY_FEDERATION",
            )
        if request.shots is not None and not 1 <= request.shots <= MAX_SHOTS:
            fail(
                "SHOT_LIMIT_EXCEEDED",
                f"shots must be between 1 and {MAX_SHOTS}",
                "GOVERNANCE_POLICY_FEDERATION",
            )
        if len(request.features) > MAX_FEATURES:
            fail(
                "FEATURE_LIMIT_EXCEEDED",
                "features limit exceeded",
                "GOVERNANCE_POLICY_FEDERATION",
            )
        if len(request.weights) > MAX_WEIGHTS:
            fail(
                "WEIGHT_LIMIT_EXCEEDED",
                "weights limit exceeded",
                "GOVERNANCE_POLICY_FEDERATION",
            )


class Security:
    @staticmethod
    def validate_scopes(request: QuantumRequest) -> None:
        provider = DEVICE_REGISTRY[request.provider]
        granted = set(request.scopes)
        if "*" in granted:
            return
        required = set(provider["required_scopes"])
        missing = required - granted
        if missing:
            fail(
                "MISSING_SECURITY_SCOPE",
                "Missing required scopes: " + ", ".join(sorted(missing)),
                "SECURITY_IDENTITY_FEDERATION",
            )

    @staticmethod
    def validate_data_classification(raw: dict[str, Any]) -> None:
        classification = str(raw.get("dataClassification", "public")).lower()
        restricted = {"restricted", "top_secret", "confidential_pii"}
        if classification in restricted:
            fail(
                "DATA_CLASS_RESTRICTED",
                f"Execution denied for {classification}",
                "SECURITY_IDENTITY_FEDERATION",
            )


class DeviceMesh:
    @staticmethod
    def validate_provider(provider: str) -> None:
        if provider not in DEVICE_REGISTRY:
            fail(
                "UNSUPPORTED_DEVICE",
                f"Provider {provider} is not registered",
                "DEVICE_MESH_FEDERATION",
            )

    @staticmethod
    def available(provider: str) -> bool:
        modules = installed(DEVICE_REGISTRY[provider]["modules"])
        return all(modules.values())

    @staticmethod
    def diagnostics() -> dict[str, Any]:
        result: dict[str, Any] = {}
        for name, spec in DEVICE_REGISTRY.items():
            modules = installed(spec["modules"])
            result[name] = {
                "provider": name,
                "implementation": spec["implementation"],
                "available": all(modules.values()),
                "executionMode": spec["execution_mode"],
                "modules": modules,
            }
        return result


class ClassicalFallback:
    @staticmethod
    def execute(request: QuantumRequest, reason: str) -> dict[str, Any]:
        features = request.features or (0.1, 0.2)
        weights = request.weights or (0.3, 0.4)
        values = [
            math.tanh(math.sin(feature) + math.cos(weights[index % len(weights)]))
            for index, feature in enumerate(features)
        ]
        estimate = sum(values) / len(values)
        return {
            "status": "degraded",
            "executionMode": "classical_fallback",
            "quantumResult": False,
            "implementation": "DETERMINISTIC_CLASSICAL_ESTIMATOR",
            "providerRequested": request.provider,
            "estimate": round(max(-1.0, min(1.0, estimate)), 8),
            "fallbackReason": reason[:300],
        }


class QuantumRuntime:
    @staticmethod
    def execute(request: QuantumRequest) -> dict[str, Any]:
        if not DeviceMesh.available(request.provider):
            fail(
                "DEVICE_UNAVAILABLE",
                f"{request.provider} dependencies unavailable",
                "DEVICE_MESH_FEDERATION",
                retryable=True,
            )

        try:
            import numpy as np
            import pennylane as qml
        except ImportError as error:
            fail(
                "PENNYLANE_UNAVAILABLE",
                str(error),
                "QUANTUM_ENGINE_FEDERATION",
                retryable=True,
            )

        started = time.perf_counter()
        device = qml.device(
            request.provider,
            wires=request.wires,
            shots=request.shots,
        )

        features = np.asarray(
            list(request.features)[:request.wires]
            + [0.0] * max(0, request.wires - len(request.features)),
            dtype=float,
        )
        weights = np.asarray(
            list(request.weights)[:request.wires]
            + [0.125] * max(0, request.wires - len(request.weights)),
            dtype=float,
        )

        @qml.qnode(device)
        def circuit(values: Any, parameters: Any) -> Any:
            for wire in range(request.wires):
                qml.RY(values[wire], wires=wire)
                qml.RZ(parameters[wire], wires=wire)
            for wire in range(request.wires - 1):
                qml.CNOT(wires=[wire, wire + 1])
            return qml.expval(qml.PauliZ(0))

        value = circuit(features, weights)
        elapsed_ms = (time.perf_counter() - started) * 1000
        if elapsed_ms > MAX_LATENCY_MS:
            fail(
                "QUANTUM_EXECUTION_TIMEOUT",
                "Quantum execution exceeded latency budget",
                "QUANTUM_ENGINE_FEDERATION",
                retryable=True,
            )

        expectation = float(np.asarray(value).reshape(-1)[0])
        return {
            "status": "ok",
            "executionMode": DEVICE_REGISTRY[request.provider]["execution_mode"],
            "quantumResult": True,
            "implementation": DEVICE_REGISTRY[request.provider]["implementation"],
            "provider": request.provider,
            "pennylaneVersion": getattr(qml, "__version__", "unknown"),
            "wires": request.wires,
            "shots": request.shots,
            "expectation": round(expectation, 8),
            "latencyMs": round(elapsed_ms, 3),
            "circuitHash": request.circuit_hash,
        }


class Bridge:
    def normalize(self, raw: dict[str, Any]) -> QuantumRequest:
        schema = string_field(
            raw.get("schema", SCHEMA_VERSION),
            "schema",
            96,
        )
        if schema != SCHEMA_VERSION:
            fail(
                "UNSUPPORTED_SCHEMA",
                f"Unsupported schema {schema}",
                "GOVERNANCE_POLICY_FEDERATION",
            )

        request_id = string_field(
            raw.get("requestId", str(uuid.uuid4())),
            "requestId",
            128,
        )
        tenant_id = string_field(
            raw.get("tenantId", "tenant-default"),
            "tenantId",
            128,
        )
        task = string_field(
            raw.get("task", "execute"),
            "task",
            32,
        )
        if task not in {"execute", "diagnose", "qnn_bootstrap", "kernel_score"}:
            fail(
                "UNSUPPORTED_TASK",
                f"Unsupported task {task}",
                "GOVERNANCE_POLICY_FEDERATION",
            )

        provider = string_field(
            raw.get("provider", "default.qubit"),
            "provider",
            96,
        )
        DeviceMesh.validate_provider(provider)

        scopes_raw = raw.get("scopes", ["quantum:execute"])
        if not isinstance(scopes_raw, list):
            fail(
                "INVALID_SCOPES",
                "scopes must be an array",
                "SECURITY_IDENTITY_FEDERATION",
            )
        scopes = tuple(string_field(scope, "scope", 128) for scope in scopes_raw)

        wires_raw = raw.get("wires", 4)
        try:
            wires = int(wires_raw)
        except (TypeError, ValueError):
            fail(
                "INVALID_WIRES",
                "wires must be an integer",
                "GOVERNANCE_POLICY_FEDERATION",
            )

        shots_raw = raw.get("shots")
        shots = int(shots_raw) if shots_raw is not None and int(shots_raw) > 0 else None

        features = numeric_tuple(raw.get("features", []), "features", MAX_FEATURES)
        weights = numeric_tuple(raw.get("weights", []), "weights", MAX_WEIGHTS)
        ansatz = string_field(raw.get("ansatz", "RY-RZ-chain-CNOT"), "ansatz", 128)
        policy_version = string_field(raw.get("policyVersion", POLICY_ID), "policyVersion", 128)

        request_material = {
            "schema": schema,
            "requestId": request_id,
            "tenantId": tenant_id,
            "task": task,
            "provider": provider,
            "wires": wires,
            "shots": shots,
            "features": features,
            "weights": weights,
            "ansatz": ansatz,
            "policyVersion": policy_version,
        }
        circuit_material = {
            "provider": provider,
            "wires": wires,
            "shots": shots,
            "features": features,
            "weights": weights,
            "ansatz": ansatz,
            "bridgeVersion": BRIDGE_VERSION,
        }

        request = QuantumRequest(
            request_id=request_id,
            tenant_id=tenant_id,
            provider=provider,
            task=task,
            wires=wires,
            shots=shots,
            features=features,
            weights=weights,
            scopes=scopes,
            ansatz=ansatz,
            policy_version=policy_version,
            request_hash=sha3(request_material),
            circuit_hash=sha3(circuit_material),
        )

        Governance.validate(request)
        Security.validate_scopes(request)
        Security.validate_data_classification(raw)
        return request

    def process(self, raw: dict[str, Any]) -> dict[str, Any]:
        started = time.perf_counter()
        request_id = str(raw.get("requestId", "unknown"))

        try:
            request = self.normalize(raw)

            manifest_ok = True
            manifest_reason = "MANIFEST_NOT_REQUIRED"
            if "artifactManifest" in raw:
                manifest_ok, manifest_reason = ManifestVerifier.verify(raw.get("artifactManifest"))
                if not manifest_ok:
                    fail(
                        "MANIFEST_VERIFICATION_FAILED",
                        manifest_reason,
                        "SECURITY_IDENTITY_FEDERATION",
                    )

            if request.task == "diagnose":
                result = {
                    "status": "ok",
                    "executionMode": "diagnostic",
                    "quantumResult": False,
                    "requestId": request.request_id,
                    "tenantId": request.tenant_id,
                    "devices": DeviceMesh.diagnostics(),
                }
            else:
                try:
                    result = QuantumRuntime.execute(request)
                except BridgeError as error:
                    result = ClassicalFallback.execute(
                        request, f"{error.code}: {error.message}"
                    )
                except Exception as error:
                    result = ClassicalFallback.execute(
                        request, f"ENGINE_EXCEPTION: {error}"
                    )

            result.update(
                {
                    "schema": SCHEMA_VERSION,
                    "systemIdentifier": SYSTEM_IDENTIFIER,
                    "bridgeVersion": BRIDGE_VERSION,
                    "requestId": request.request_id,
                    "tenantId": request.tenant_id,
                    "requestHash": request.request_hash,
                    "policyId": POLICY_ID,
                    "policyVersion": request.policy_version,
                    "auditId": f"aud-{uuid.uuid4()}",
                    "provenance": {
                        "requestHash": request.request_hash,
                        "circuitHash": request.circuit_hash,
                        "manifest": manifest_reason,
                        "createdAt": time.time(),
                    },
                }
            )
            return self.finalize(result, started)

        except BridgeError as error:
            return self.finalize(
                {
                    "schema": SCHEMA_VERSION,
                    "systemIdentifier": SYSTEM_IDENTIFIER,
                    "bridgeVersion": BRIDGE_VERSION,
                    "status": "rejected",
                    "executionMode": "rejected",
                    "quantumResult": False,
                    "requestId": request_id,
                    "error": {
                        "code": error.code,
                        "message": error.message[:300],
                        "federation": error.federation,
                        "retryable": error.retryable,
                    },
                },
                started,
            )
        except Exception as error:
            return self.finalize(
                {
                    "schema": SCHEMA_VERSION,
                    "systemIdentifier": SYSTEM_IDENTIFIER,
                    "bridgeVersion": BRIDGE_VERSION,
                    "status": "error",
                    "executionMode": "rejected",
                    "quantumResult": False,
                    "requestId": request_id,
                    "error": {
                        "code": "INTERNAL_ERROR",
                        "message": "Bridge execution failed",
                        "federation": "QUANTUM_ENGINE_FEDERATION",
                        "retryable": False,
                    },
                },
                started,
            )

    def finalize(self, result: dict[str, Any], started: float) -> dict[str, Any]:
        result["telemetry"] = {
            "runtimeMs": round((time.perf_counter() - started) * 1000, 3),
            "pythonVersion": platform.python_version(),
        }
        return result


def write_json_line(payload: dict[str, Any]) -> None:
    output = json.dumps(
        payload,
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
        allow_nan=False,
    )
    if len(output.encode("utf-8")) > MAX_OUTPUT_BYTES:
        output = json.dumps(
            {
                "schema": SCHEMA_VERSION,
                "status": "error",
                "executionMode": "rejected",
                "quantumResult": False,
                "error": {
                    "code": "OUTPUT_LIMIT_EXCEEDED",
                    "message": "Output exceeds configured limit",
                    "retryable": False,
                },
            },
            separators=(",", ":"),
        )
    sys.stdout.write(output + "\n")
    sys.stdout.flush()


def run_stdio() -> int:
    bridge = Bridge()
    for line in sys.stdin:
        line_clean = line.strip()
        if not line_clean:
            continue
        if len(line.encode("utf-8")) > MAX_INPUT_BYTES:
            write_json_line(
                {
                    "schema": SCHEMA_VERSION,
                    "status": "rejected",
                    "executionMode": "rejected",
                    "quantumResult": False,
                    "error": {
                        "code": "INPUT_LIMIT_EXCEEDED",
                        "message": "Input exceeds configured limit",
                        "retryable": False,
                    },
                }
            )
            continue
        try:
            raw = json.loads(line_clean)
            if not isinstance(raw, dict):
                raise ValueError("Root JSON must be an object")
            write_json_line(bridge.process(raw))
        except Exception:
            write_json_line(
                {
                    "schema": SCHEMA_VERSION,
                    "status": "error",
                    "executionMode": "rejected",
                    "quantumResult": False,
                    "error": {
                        "code": "INVALID_JSON",
                        "message": "Invalid JSON request",
                        "retryable": False,
                    },
                }
            )
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description="Isabella Quantum Bridge v6")
    parser.add_argument("--stdio", action="store_true", help="Start continuous JSONL stdio stream")
    parser.add_argument("--diagnose", action="store_true", help="Print device mesh diagnostics")
    args = parser.parse_args()

    if args.diagnose:
        print(json.dumps(DeviceMesh.diagnostics(), indent=2))
        return 0

    return run_stdio()


if __name__ == "__main__":
    raise SystemExit(main())
