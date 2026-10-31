from __future__ import annotations

import hashlib
import hmac
import re
from collections.abc import Mapping
from typing import Any


SENSITIVE_KEYS = {
    "password",
    "secret",
    "token",
    "access_token",
    "refresh_token",
    "api_key",
    "private_key",
    "authorization",
    "cookie",
}


def stable_hash(value: str, secret: str) -> str:
    return hmac.new(
        secret.encode(),
        value.strip().lower().encode(),
        hashlib.sha256,
    ).hexdigest()[:32]


def redact_text(value: str) -> str:
    value = re.sub(
        r"Bearer\s+[A-Za-z0-9._\-]+",
        "Bearer [REDACTED]",
        value,
    )

    return re.sub(
        r"(?i)(api[_-]?key|token|secret|password)\s*[:=]\s*\S+",
        r"\1=[REDACTED]",
        value[:2048],
    )


def sanitize(
    value: Mapping[str, Any],
) -> dict[str, Any]:
    output: dict[str, Any] = {}

    for key, item in value.items():
        if key.lower() in SENSITIVE_KEYS:
            output[key] = "[REDACTED]"
        elif isinstance(item, Mapping):
            output[key] = sanitize(item)
        elif isinstance(item, str):
            output[key] = redact_text(item)
        elif isinstance(item, (int, float, bool)) or item is None:
            output[key] = item
        else:
            output[key] = str(item)[:512]

    return output
