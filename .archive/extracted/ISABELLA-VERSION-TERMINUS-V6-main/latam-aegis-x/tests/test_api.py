import asyncio

import pytest

from latam_aegis.api import (
    AuthorizationService,
    IdentityService,
    KeyManager,
    ModelRouter,
    RateLimiter,
)
from latam_aegis.audit import AuditEntry, AuditLedger
from latam_aegis.config import Settings
from latam_aegis.domain import ThreatLevel
from latam_aegis.ml import SafeFallbackDetector


def _settings() -> Settings:
    return Settings(
        hash_secret="test-hash-secret",
        audit_secret="test-audit-secret",
        dry_run=True,
        environment="test",
    )


def test_key_manager_sign_and_verify() -> None:
    key_manager = KeyManager(_settings())
    payload = {"decision_id": "dec_1", "tenant_id": "t1", "allow": True}

    signature = key_manager.sign_payload(payload)

    assert key_manager.verify_signature(payload, signature)
    assert key_manager.get_current_key_id()


def test_key_manager_revocation() -> None:
    from datetime import datetime, timedelta, timezone

    key_manager = KeyManager(_settings())
    jti = "jti-revoked-1"

    assert not key_manager.is_token_revoked(jti)

    key_manager.revoke_token(jti, datetime.now(timezone.utc) + timedelta(minutes=5))

    assert key_manager.is_token_revoked(jti)


def test_idempotency_detects_duplicate() -> None:
    key_manager = KeyManager(_settings())

    assert key_manager.check_idempotency("my-idempotency-key-1", "t1")
    assert not key_manager.check_idempotency("my-idempotency-key-1", "t1")


def test_model_router_returns_inference() -> None:
    router = ModelRouter(_settings())
    result = asyncio.run(
        router.route_request(
            text="hello world",
            preferred_provider="openai",
            max_tokens=100,
            temperature=0.5,
        )
    )

    assert result.model_provider == "openai"
    assert result.threat_level == ThreatLevel.LOW
    assert 0 <= result.confidence <= 1


def test_safe_fallback_analyze() -> None:
    detector = SafeFallbackDetector()
    result = detector.analyze("some text to analyze")

    assert result.model_provider == "safe_fallback"
    assert result.threat_level in ThreatLevel


def test_authorization_service_emits_signed_decision() -> None:
    settings = _settings()
    ledger = AuditLedger(settings.audit_secret.get_secret_value())
    key_manager = KeyManager(settings)
    service = AuthorizationService(settings, ledger, key_manager)

    decision = asyncio.run(
        service.evaluate(
            subject_id="user-1",
            tenant_id="tenant-1",
            action="analyze",
            resource="/analyze",
        )
    )

    assert decision.allow is True
    assert decision.signature
    assert decision.decision_id


def test_audit_entry_record_decision() -> None:
    ledger = AuditLedger("test-audit-secret")
    entry = AuditEntry(
        decision_id="dec_1",
        tenant_id="t1",
        subject_id="u1",
        action="analyze",
        resource="/analyze",
        outcome="allow",
        policy_version="v1.0",
        signature="sig",
    )

    record = ledger.record_decision(entry)

    assert record["record_hash"]
    assert entry.current_hash == record["record_hash"]


def test_rate_limiter_allows_then_blocks() -> None:
    limiter = RateLimiter(_settings())

    assert limiter.is_allowed("t1", "/analyze", "u1", limit=2)
    assert limiter.is_allowed("t1", "/analyze", "u1", limit=2)
    assert not limiter.is_allowed("t1", "/analyze", "u1", limit=2)
