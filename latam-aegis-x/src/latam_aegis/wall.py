from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone

from latam_aegis.domain import AegisLevel


@dataclass(slots=True, frozen=True)
class WallState:
    level: AegisLevel
    reasons: tuple[str, ...]
    activated_at: datetime


@dataclass(slots=True, frozen=True)
class FirewallRule:
    rule_id: str
    pattern: str
    action: str
    priority: int = 0


@dataclass(slots=True, frozen=True)
class RateLimitConfig:
    max_requests: int = 100
    window_seconds: int = 60
    burst: int = 20


class AdaptiveWall:
    def __init__(self) -> None:
        self._level = AegisLevel.OPEN
        self._reasons: set[str] = set()
        self._activated_at = datetime.now(timezone.utc)

    @property
    def level(self) -> AegisLevel:
        return self._level

    def escalate(
        self,
        level: AegisLevel,
        reason: str,
    ) -> WallState:
        self._level = max(self._level, level)
        self._reasons.add(reason)
        self._activated_at = datetime.now(timezone.utc)

        return self.state()

    def state(self) -> WallState:
        return WallState(
            level=self._level,
            reasons=tuple(sorted(self._reasons)),
            activated_at=self._activated_at,
        )

    def reset(self, approved: bool) -> WallState:
        if not approved:
            raise PermissionError("Se requiere autorización.")

        self._level = AegisLevel.OPEN
        self._reasons.clear()
        self._activated_at = datetime.now(timezone.utc)

        return self.state()
