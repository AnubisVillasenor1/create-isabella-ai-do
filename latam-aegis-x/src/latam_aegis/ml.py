from __future__ import annotations

from collections.abc import Sequence
from dataclasses import dataclass
from enum import StrEnum
from typing import Protocol

import numpy as np

from latam_aegis.domain import ModelInferenceResult, ThreatLevel


class ModelProvider(StrEnum):
    OPENAI = "openai"
    ANTHROPIC = "anthropic"
    GOOGLE = "google"


@dataclass(frozen=True, slots=True)
class ModelCapability:
    provider: ModelProvider
    max_tokens: int
    supports_multimodal: bool = False


class Detector(Protocol):
    version: str

    def score(self, features: Sequence[float]) -> float:
        ...


class SafeFallbackDetector:
    version = "fallback-v1"

    def score(self, features: Sequence[float]) -> float:
        if not features:
            return 0.0

        values = [
            max(0.0, min(1.0, float(value)))
            for value in features
        ]

        return sum(values) / len(values)

    def analyze(self, text: str) -> ModelInferenceResult:
        """Análisis seguro por defecto cuando todos los proveedores fallan."""
        score = min(1.0, len(text) / 5000.0)

        if score >= 0.9:
            threat = ThreatLevel.CRITICAL
        elif score >= 0.7:
            threat = ThreatLevel.HIGH
        elif score >= 0.4:
            threat = ThreatLevel.MEDIUM
        else:
            threat = ThreatLevel.LOW

        return ModelInferenceResult(
            threat_level=threat,
            confidence=0.90,
            categories=["safe_fallback"],
            model_provider="safe_fallback",
            model_version=self.version,
            processing_time_ms=1.0,
        )


class NumpyDetector:
    def __init__(self, model: object, version: str) -> None:
        self._model = model
        self.version = version

    def score(self, features: Sequence[float]) -> float:
        matrix = np.asarray([list(features)], dtype=float)

        if hasattr(self._model, "predict_proba"):
            return float(self._model.predict_proba(matrix)[0][-1])

        if hasattr(self._model, "decision_function"):
            raw = float(self._model.decision_function(matrix)[0])
            return float(1 / (1 + np.exp(-raw)))

        raise TypeError("Modelo no compatible.")
