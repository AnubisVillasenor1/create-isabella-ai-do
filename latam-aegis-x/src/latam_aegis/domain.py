from __future__ import annotations

from datetime import datetime, timezone
from enum import IntEnum, StrEnum
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class ThreatLevel(StrEnum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class EventType(StrEnum):
    AUTHENTICATION = "authentication"
    API_REQUEST = "api_request"
    DATA_ACCESS = "data_access"
    FILE_OPERATION = "file_operation"
    NETWORK_FLOW = "network_flow"
    ADMIN_ACTION = "admin_action"


class Decision(StrEnum):
    ALLOW = "allow"
    OBSERVE = "observe"
    CHALLENGE = "challenge"
    QUARANTINE = "quarantine"
    BLOCK = "block"


class AegisLevel(IntEnum):
    OPEN = 0
    WATCH = 1
    CONTAIN = 2
    ISOLATE = 3
    VAULT = 4
    LOCKDOWN = 5


class SecurityEvent(BaseModel):
    model_config = ConfigDict(extra="forbid")

    event_id: str = Field(min_length=8, max_length=128)
    event_type: EventType
    actor: str = Field(min_length=1, max_length=512)
    source: str = Field(min_length=1, max_length=512)
    action: str = Field(min_length=1, max_length=256)
    resource_class: str = Field(min_length=1, max_length=128)

    features: dict[str, float] = Field(default_factory=dict)
    metadata: dict[str, Any] = Field(default_factory=dict)
    timestamp: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc)
    )


class DetectionResult(BaseModel):
    event_id: str
    score: float = Field(ge=0, le=1)
    decision: Decision
    aegis_level: AegisLevel
    reasons: list[str] = Field(default_factory=list)
    model_version: str
    learning_mode: str


class ModelInferenceResult(BaseModel):
    """Resultado de inferencia de un proveedor de modelos de IA.

    Es el artefacto producido por el ModelRouter (o por el
    SafeFallbackDetector) al analizar texto, distinto del
    DetectionResult del pipeline de eventos de seguridad.
    """

    model_config = ConfigDict(extra="forbid")

    threat_level: ThreatLevel = ThreatLevel.LOW
    confidence: float = Field(0.5, ge=0, le=1)
    categories: list[str] = Field(default_factory=list)
    model_provider: str
    model_version: str
    processing_time_ms: float = 0.0
