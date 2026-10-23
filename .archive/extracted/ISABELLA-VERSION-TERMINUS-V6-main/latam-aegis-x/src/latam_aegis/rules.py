from __future__ import annotations

from latam_aegis.domain import SecurityEvent


CRITICAL_RULES = {
    "credential_exfiltration",
    "audit_tampering",
    "private_key_access",
}


def detect_rules(event: SecurityEvent) -> list[str]:
    metadata = event.metadata
    reasons: list[str] = []

    if event.action == "bulk_export":
        reasons.append("bulk_data_export")

    if event.resource_class in {
        "credential_store",
        "private_keys",
        "secrets_manager",
    }:
        reasons.append("sensitive_resource_access")

    if metadata.get("secret_pattern_detected") is True:
        reasons.append("credential_exfiltration")

    if metadata.get("mass_download") is True:
        reasons.append("mass_download")

    if metadata.get("audit_log_tampering") is True:
        reasons.append("audit_tampering")

    return reasons
