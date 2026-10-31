from __future__ import annotations

import time
from enum import StrEnum

from pydantic import Field, SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict


class ExecutionMode(StrEnum):
    JOB = "job"
    BATCH = "batch"
    SESSION = "session"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_prefix="AEGIS_",
        extra="ignore",
    )

    environment: str = "development"
    dry_run: bool = True

    hash_secret: SecretStr = SecretStr("default-hash-secret-change-me")
    audit_secret: SecretStr = SecretStr("default-audit-secret-change-me")

    allowed_origins: list[str] = Field(
        default_factory=lambda: ["http://localhost", "http://127.0.0.1"]
    )
    build_commit: str = "local"
    start_time: float = Field(default_factory=time.time)

    ml_threshold: float = Field(default=0.82, ge=0, le=1)

    allow_quantum: bool = False
    allow_qesem: bool = False
    allow_session: bool = False

    ibm_channel: str = "ibm_quantum_platform"
    ibm_backend: str | None = None
    ibm_instance: str | None = None

    max_shots: int = Field(default=2048, ge=1, le=100_000)
    max_qubits: int = Field(default=32, ge=1, le=256)
    max_circuits: int = Field(default=128, ge=1, le=10_000)
    max_executions: int = Field(default=1_000_000, ge=1)

    max_job_seconds: int = 180
    max_batch_seconds: int = 900
    max_session_seconds: int = 600
