from __future__ import annotations

from enum import StrEnum

from latam_aegis.audit import AuditLedger
from latam_aegis.config import Settings
from latam_aegis.domain import (
    AegisLevel,
    Decision,
    DetectionResult,
    SecurityEvent,
)
from latam_aegis.ml import Detector
from latam_aegis.privacy import sanitize, stable_hash
from latam_aegis.rules import CRITICAL_RULES, detect_rules
from latam_aegis.wall import AdaptiveWall


class PipelineStage(StrEnum):
    NORMALIZATION = "normalization"
    CORRELATION = "correlation"
    AUTHENTICATION = "authentication"
    TENANT_RESOLUTION = "tenant_resolution"
    INPUT_VALIDATION = "input_validation"
    POLICY_EVALUATION = "policy_evaluation"
    CAPABILITY_CHECK = "capability_check"
    DOMAIN_OPERATION = "domain_operation"
    OUTPUT_VALIDATION = "output_validation"
    AUDIT = "audit"


class SecurityPipeline:
    def __init__(
        self,
        *,
        settings: Settings,
        model: Detector,
        wall: AdaptiveWall,
        ledger: AuditLedger,
    ) -> None:
        self._settings = settings
        self._model = model
        self._wall = wall
        self._ledger = ledger

    def process(
        self,
        event: SecurityEvent,
    ) -> DetectionResult:
        safe_event = event.model_copy(
            update={
                "actor": stable_hash(
                    event.actor,
                    self._settings.hash_secret.get_secret_value(),
                ),
                "source": stable_hash(
                    event.source,
                    self._settings.hash_secret.get_secret_value(),
                ),
                "metadata": sanitize(event.metadata),
            }
        )

        reasons = detect_rules(safe_event)
        score = self._model.score(
            list(safe_event.features.values())
        )

        level = self._level_for(
            score=score,
            reasons=reasons,
        )

        state = self._wall.escalate(
            level,
            reason=",".join(reasons) or "anomaly_score",
        )

        if CRITICAL_RULES.intersection(reasons):
            decision = Decision.BLOCK
            score = max(score, 0.99)
        elif score >= 0.95:
            decision = Decision.BLOCK
        elif score >= 0.82:
            decision = Decision.QUARANTINE
        elif score >= 0.60:
            decision = Decision.CHALLENGE
        elif score >= 0.30:
            decision = Decision.OBSERVE
        else:
            decision = Decision.ALLOW

        result = DetectionResult(
            event_id=event.event_id,
            score=score,
            decision=decision,
            aegis_level=state.level,
            reasons=reasons,
            model_version=self._model.version,
            learning_mode=(
                "incident_memory"
                if state.level >= AegisLevel.CONTAIN
                else "normal"
            ),
        )

        self._ledger.append(result.model_dump(mode="json"))
        return result

    def _level_for(
        self,
        *,
        score: float,
        reasons: list[str],
    ) -> AegisLevel:
        if "audit_tampering" in reasons:
            return AegisLevel.LOCKDOWN

        if CRITICAL_RULES.intersection(reasons):
            return AegisLevel.VAULT

        if score >= 0.90:
            return AegisLevel.ISOLATE

        if score >= 0.82:
            return AegisLevel.CONTAIN

        if score >= 0.60:
            return AegisLevel.WATCH

        return AegisLevel.OPEN
