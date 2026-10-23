from latam_aegis.config import Settings
from latam_aegis.domain import (
    AegisLevel,
    EventType,
    SecurityEvent,
)
from latam_aegis.pipeline import SecurityPipeline
from latam_aegis.audit import AuditLedger
from latam_aegis.ml import SafeFallbackDetector
from latam_aegis.wall import AdaptiveWall


def test_critical_exfiltration_escalates_wall() -> None:
    settings = Settings(
        hash_secret="test-hash-secret",
        audit_secret="test-audit-secret",
        dry_run=True,
    )

    pipeline = SecurityPipeline(
        settings=settings,
        model=SafeFallbackDetector(),
        wall=AdaptiveWall(),
        ledger=AuditLedger("test-audit-secret"),
    )

    event = SecurityEvent(
        event_id="evt-00000001",
        event_type=EventType.DATA_ACCESS,
        actor="user@example.com",
        source="10.0.0.12",
        action="bulk_export",
        resource_class="credential_store",
        features={
            "request_rate": 0.98,
            "volume": 0.99,
        },
        metadata={
            "secret_pattern_detected": True,
        },
    )

    result = pipeline.process(event)

    assert result.decision.value == "block"
    assert result.aegis_level >= AegisLevel.VAULT
    assert "credential_exfiltration" in result.reasons
