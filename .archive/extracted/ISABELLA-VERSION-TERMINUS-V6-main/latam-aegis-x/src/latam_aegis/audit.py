from __future__ import annotations

import hashlib
import hmac
import json
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from typing import Any, Optional


@dataclass
class AuditEntry:
    decision_id: str
    tenant_id: str
    subject_id: str
    action: str
    resource: str
    outcome: str
    policy_version: str
    signature: str
    previous_hash: Optional[str] = None
    current_hash: Optional[str] = None


class AuditLedger:
    def __init__(self, secret: str) -> None:
        self._secret = secret
        self._previous_hash = "GENESIS"

    def append(self, payload: dict[str, Any]) -> dict[str, Any]:
        record = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "previous_hash": self._previous_hash,
            "payload": payload,
        }

        canonical = json.dumps(
            record,
            sort_keys=True,
            separators=(",", ":"),
        ).encode()

        record_hash = hmac.new(
            self._secret.encode(),
            canonical,
            hashlib.sha256,
        ).hexdigest()

        result = {
            **record,
            "record_hash": record_hash,
        }

        self._previous_hash = record_hash
        return result

    def record_decision(
        self,
        entry: AuditEntry,
    ) -> dict[str, Any]:
        """Registra una decisión de autorización en el ledger inmutable."""
        payload = asdict(entry)

        record = self.append(payload)
        entry.current_hash = record["record_hash"]
        entry.previous_hash = record.get("previous_hash")

        return record
