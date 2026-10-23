from __future__ import annotations

from enum import StrEnum


class QuantumMode(StrEnum):
    JOB = "job"
    BATCH = "batch"
    SESSION = "session"


def choose_quantum_mode(
    *,
    jobs: int,
    iterative: bool,
    inputs_ready: bool,
    sessions_enabled: bool,
) -> QuantumMode:
    if jobs <= 1:
        return QuantumMode.JOB

    if iterative or not inputs_ready:
        if not sessions_enabled:
            raise PermissionError("Session no habilitada.")

        return QuantumMode.SESSION

    return QuantumMode.BATCH
