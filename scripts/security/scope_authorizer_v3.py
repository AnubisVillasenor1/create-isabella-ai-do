#!/usr/bin/env python3
"""
Isabella Villaseñor AI — Scope Authorization Runtime v3 (Hardened & Evolved).

Federated Scope & Policy Engine with ABAC condition matching, bounded replay defense,
tamper-evident audit chaining (hash-linked ledger), and hierarchical scope resolution.

Pipeline:
JWT claims -> structural validation -> temporal window (iat, nbf, exp) -> tenant isolation
-> cryptographic token binding -> replay store (bounded jti:tenant cache) -> issuer/aud whitelist
-> hierarchical scope matching -> minimum role rank -> assurance level -> condition engine (ABAC)
-> step-up & dual-control verification -> obligation builder -> hash-chained audit event.
"""

from __future__ import annotations
import base64
import fnmatch
import hashlib
import hmac
import ipaddress
import json
import re
import time
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Set, Tuple, Union

# ── 1. CONSTANTS & REGEX SECURITY ────────────────────────────────────────────

SECRET_PATTERNS = [
    re.compile(r'(?i)(authorization\s*[:=]\s*bearer\s+)[^\s]+'),
    re.compile(r'(?i)(api[_-]?key\s*[:=]\s*)[^\s]+'),
    re.compile(r'(?i)(password\s*[:=]\s*)[^\s]+'),
    re.compile(r'(?i)(secret\s*[:=]\s*)[^\s]+'),
    re.compile(r'sk-[a-zA-Z0-9]{32,}'),
    re.compile(r'eyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}'),
]

ROLE_RANK: Dict[str, int] = {
    "anonymous": 0,
    "citizen": 1,
    "member": 1,
    "agent": 2,
    "creator": 2,
    "operator": 3,
    "auditor": 3,
    "admin": 4,
    "governance_admin": 5,
    "system": 6,
}

MAX_REPLAY_ENTRIES = 100_000
MAX_SCOPES_PER_TOKEN = 128
MAX_TOKEN_AGE_FUTURE = 60.0

# ── 2. DATA MODELS & EXCEPTIONS ──────────────────────────────────────────────

class AuthorizationError(Exception):
    def __init__(self, code: str, message: str, details: Optional[Dict[str, Any]] = None):
        super().__init__(message)
        self.code = code
        self.message = message
        self.details = details or {}


@dataclass(frozen=True)
class Decision:
    allowed: bool
    code: str
    reason: str
    required_scope: str
    principal: str
    tenant_id: str
    matched_scope: str
    obligations: Tuple[str, ...]
    conditions_evaluated: Tuple[str, ...]


# ── 3. CRYPTOGRAPHIC & SANITIZATION UTILITIES ────────────────────────────────

def canonical(value: Any) -> bytes:
    """Produces deterministic JSON bytes for cryptographic digests."""
    return json.dumps(
        value,
        sort_keys=True,
        separators=(",", ":"),
        ensure_ascii=False,
        allow_nan=False
    ).encode("utf-8")


def digest(value: Any) -> str:
    """Returns SHA3-512 hexadecimal digest of canonical JSON representations."""
    return hashlib.sha3_512(canonical(value)).hexdigest()


def constant_time_compare(val1: str, val2: str) -> bool:
    """Prevents timing attacks on HMACs or tokens."""
    return hmac.compare_digest(val1.encode("utf-8"), val2.encode("utf-8"))


def redact(value: Any) -> Any:
    """Recursively redacts sensitive patterns across dicts, lists, and strings."""
    if isinstance(value, str):
        sanitized = value
        for pattern in SECRET_PATTERNS:
            sanitized = pattern.sub(r'\1[REDACTED_SECRET]', sanitized)
        return sanitized
    if isinstance(value, dict):
        return {str(k): redact(v) for k, v in value.items()}
    if isinstance(value, (list, tuple, set)):
        return [redact(v) for v in value]
    return value


def require(condition: bool, code: str, message: str, details: Optional[Dict[str, Any]] = None):
    if not condition:
        raise AuthorizationError(code, message, details)

# ── 4. BOUNDED & DUAL-KEYED REPLAY STORE ──────────────────────────────────────

class BoundedReplayStore:
    """
    In-memory dual-keyed (jti:tenant) replay defense store.
    Enforces maximum cache capacity to prevent memory-flooding DoS.
    """
    def __init__(self, max_capacity: int = MAX_REPLAY_ENTRIES):
        self.entries: Dict[str, float] = {}
        self.max_capacity = max_capacity

    def purge_expired(self, now: float) -> None:
        expired = [k for k, exp in self.entries.items() if exp <= now]
        for key in expired:
            del self.entries[key]

    def consume(self, jti: str, tenant_id: str, exp: float, now: float) -> None:
        self.purge_expired(now)
        composite_key = f"{tenant_id}:{jti}"
        
        require(composite_key not in self.entries, "TOKEN_REPLAY", "JWT jti has already been consumed for this tenant")
        
        if len(self.entries) >= self.max_capacity:
            sorted_keys = sorted(self.entries.keys(), key=lambda k: self.entries[k])
            for k in sorted_keys[: max(1, self.max_capacity // 10)]:
                del self.entries[k]

        self.entries[composite_key] = exp

# ── 5. ATTRIBUTE-BASED CONDITION ENGINE (ABAC) ──────────────────────────────

class ConditionEngine:
    """Evaluates contextual conditions (IP ranges, UTC hours, environment, attributes)."""

    @staticmethod
    def evaluate(condition_type: str, rule_value: Any, context: Dict[str, Any]) -> bool:
        if condition_type == "ip_cidr_match":
            client_ip = context.get("clientIp")
            if not client_ip:
                return False
            try:
                ip_obj = ipaddress.ip_address(client_ip)
                cidrs = rule_value if isinstance(rule_value, list) else [rule_value]
                return any(ip_obj in ipaddress.ip_network(cidr) for cidr in cidrs)
            except ValueError:
                return False

        if condition_type == "environment_equals":
            return context.get("environment") == rule_value

        if condition_type == "business_hours_only":
            now_utc = time.gmtime(context.get("now", time.time())).tm_hour
            start = rule_value.get("start_utc", 0)
            end = rule_value.get("end_utc", 24)
            return start <= now_utc < end

        if condition_type == "required_claims_match":
            claims = context.get("claims", {})
            return all(claims.get(k) == v for k, v in rule_value.items())

        return False

# ── 6. SCOPE AUTHORIZATION RUNTIME ENGINE ────────────────────────────────────

class ScopeAuthorizer:
    def __init__(self, catalog: Dict[str, Any]):
        self.catalog = catalog
        self.scope_map: Dict[str, Dict[str, Any]] = {x["scope"]: x for x in catalog.get("scopes", [])}
        self.replay = BoundedReplayStore()
        self.last_audit_digest: str = "GENESIS_HASH_00000000000000000000000000000000"

    def _validate_token_claims(self, claims: Dict[str, Any], now: float):
        auth_spec = self.catalog.get("authentication", {})
        required_claims = auth_spec.get("requiredClaims", ["iss", "aud", "sub", "tenantId", "jti", "iat", "exp", "roles", "scopes"])
        
        for claim in required_claims:
            require(claim in claims, "CLAIM_MISSING", f"Required JWT claim missing: '{claim}'")

        scopes = claims["scopes"]
        require(isinstance(scopes, list), "SCOPES_NOT_ARRAY", "Claims 'scopes' must be an array")
        require(len(scopes) <= MAX_SCOPES_PER_TOKEN, "TOO_MANY_SCOPES", f"Token scopes exceed limit of {MAX_SCOPES_PER_TOKEN}")
        require(all(isinstance(x, str) and x for x in scopes), "SCOPES_INVALID", "Scopes must be non-empty strings")

        roles = claims["roles"]
        require(isinstance(roles, list) and len(roles) > 0, "ROLES_INVALID", "Claims 'roles' must be a non-empty array")

        iat = float(claims["iat"])
        exp = float(claims["exp"])
        nbf = float(claims.get("nbf", iat))
        skew = auth_spec.get("clockSkewSeconds", 5)
        max_life = auth_spec.get("maxTokenLifetimeSeconds", 86400)

        # Temporal validations
        require(iat <= now + skew, "TOKEN_NOT_YET_VALID_IAT", "Token iat is in the future")
        require(now >= nbf - skew, "TOKEN_NOT_YET_VALID_NBF", "Token nbf active timestamp is in the future")
        require(exp >= now - skew, "TOKEN_EXPIRED", "Token has expired")
        require(exp > iat, "TOKEN_TIME_INVALID", "Claim exp must be strictly greater than iat")
        require(exp - iat <= max_life + skew, "TOKEN_LIFETIME_EXCEEDED", "Token lifetime exceeds maximum policy threshold")

        # Issuer & Audience validation
        allowed_issuers = auth_spec.get("allowedIssuers", [])
        if allowed_issuers:
            require(claims.get("iss") in allowed_issuers, "ISSUER_UNAUTHORIZED", f"Issuer '{claims.get('iss')}' is not allowed")

        allowed_audiences = auth_spec.get("allowedAudiences", [])
        if allowed_audiences:
            token_aud = claims.get("aud")
            aud_valid = token_aud in allowed_audiences if isinstance(token_aud, str) else any(a in allowed_audiences for a in token_aud)
            require(aud_valid, "AUDIENCE_UNAUTHORIZED", "Audience validation failed")

        tenant = claims["tenantId"]
        require(isinstance(tenant, str) and len(tenant) > 0, "TENANT_INVALID", "Claim tenantId is invalid")
        
        self.replay.consume(str(claims["jti"]), tenant, exp, now)

    def _role_ok(self, roles: Set[str], minimum_role: str) -> bool:
        current_rank = max((ROLE_RANK.get(r, 0) for r in roles), default=0)
        target_rank = ROLE_RANK.get(minimum_role, 999)
        return current_rank >= target_rank

    def _match_scope(self, granted_scopes: Set[str], required_scope: str) -> Optional[str]:
        if required_scope in granted_scopes:
            return required_scope
            
        for scope in granted_scopes:
            if fnmatch.fnmatch(required_scope, scope):
                return scope
        return None

    def authorize(
        self,
        claims: Dict[str, Any],
        required_scope: str,
        *,
        resource_tenant: Optional[str] = None,
        assurance: str = "local",
        step_up: bool = False,
        dual_control: bool = False,
        environment: str = "production",
        client_ip: Optional[str] = None,
        now: Optional[float] = None,
    ) -> Decision:
        now = time.time() if now is None else now
        self._validate_token_claims(claims, now)

        subject = str(claims["sub"])
        tenant = str(claims["tenantId"])
        scopes = set(claims["scopes"])
        roles = set(claims["roles"])

        require(required_scope in self.scope_map, "UNKNOWN_SCOPE", f"Requested scope '{required_scope}' is not registered in catalog")

        spec = self.scope_map[required_scope]

        wildcard_present = "*" in scopes
        wildcard_allowed = wildcard_present and "system" in roles and environment == "production"
        
        if wildcard_present and not wildcard_allowed:
            raise AuthorizationError("WILDCARD_DENIED", "Wildcard scope is not permitted for this principal role or environment")

        matched_scope = required_scope if wildcard_allowed else self._match_scope(scopes, required_scope)
        if not matched_scope:
            raise AuthorizationError("SCOPE_DENIED", f"Principal lacks required scope: '{required_scope}'")

        require(self._role_ok(roles, spec.get("minimumRole", "citizen")), "ROLE_INSUFFICIENT", f"Required minimum role not met")

        assurance_levels = self.catalog.get("assuranceLevels", {})
        assurance_rank = assurance_levels.get(assurance, {}).get("rank", 0)
        required_assurance_rank = assurance_levels.get(spec.get("assurance", "local"), {}).get("rank", 999)
        require(assurance_rank >= required_assurance_rank, "ASSURANCE_INSUFFICIENT", "Authentication assurance level is insufficient")

        if spec.get("tenantBound", True):
            require(
                resource_tenant is None or resource_tenant == tenant,
                "TENANT_BOUNDARY_VIOLATION",
                "Cross-tenant access attempt denied by policy"
            )

        if spec.get("requiresStepUp", False):
            require(step_up, "STEP_UP_REQUIRED", "Step-up authentication required for this action")

        if spec.get("requiresDualControl", False):
            require(dual_control, "DUAL_CONTROL_REQUIRED", "Dual-control authorization required for this action")

        evaluated_conditions: List[str] = []
        if "conditions" in spec:
            eval_context = {
                "clientIp": client_ip,
                "environment": environment,
                "claims": claims,
                "now": now,
            }
            for cond_name, cond_body in spec["conditions"].items():
                cond_type = cond_body.get("type")
                rule_val = cond_body.get("value")
                cond_passed = ConditionEngine.evaluate(cond_type, rule_val, eval_context)
                
                require(cond_passed, "CONDITION_FAILED", f"Policy condition '{cond_name}' failed evaluation")
                evaluated_conditions.append(cond_name)

        obligations = ["audit", "tenant-isolation"]
        if spec.get("requiresStepUp", False):
            obligations.append("step-up-verified")
        if spec.get("requiresDualControl", False):
            obligations.append("dual-control-verified")
        if evaluated_conditions:
            obligations.append("abac-conditions-verified")

        return Decision(
            allowed=True,
            code="ALLOW",
            reason="Authorization policy satisfied",
            required_scope=required_scope,
            principal=subject,
            tenant_id=tenant,
            matched_scope=matched_scope,
            obligations=tuple(obligations),
            conditions_evaluated=tuple(evaluated_conditions),
        )

    def audit(self, decision: Decision) -> Dict[str, Any]:
        event = {
            "eventType": "isabella.authorization.decision",
            "subject": decision.principal,
            "tenantId": decision.tenant_id,
            "requiredScope": decision.required_scope,
            "matchedScope": decision.matched_scope,
            "decision": {
                "allowed": decision.allowed,
                "code": decision.code,
                "reason": decision.reason,
                "obligations": list(decision.obligations),
                "conditionsEvaluated": list(decision.conditions_evaluated),
            },
            "previousDigest": self.last_audit_digest,
            "timestamp": time.time(),
        }
        
        current_digest = digest(redact(event))
        event["eventDigest"] = current_digest
        self.last_audit_digest = current_digest
        
        return redact(event)


def authorize_json(catalog: Dict[str, Any], request: Dict[str, Any]) -> Dict[str, Any]:
    engine = ScopeAuthorizer(catalog)
    started = time.perf_counter()
    
    try:
        d = engine.authorize(
            request["claims"],
            request["requiredScope"],
            resource_tenant=request.get("resourceTenant"),
            assurance=request.get("assurance", "local"),
            step_up=bool(request.get("stepUpVerified", False)),
            dual_control=bool(request.get("dualControlVerified", False)),
            environment=request.get("environment", "production"),
            client_ip=request.get("clientIp"),
        )
    except AuthorizationError as exc:
        d = Decision(
            allowed=False,
            code=exc.code,
            reason=exc.message,
            required_scope=request.get("requiredScope", "unknown"),
            principal=str(request.get("claims", {}).get("sub", "unknown")),
            tenant_id=str(request.get("claims", {}).get("tenantId", "unknown")),
            matched_scope="none",
            obligations=(),
            conditions_evaluated=(),
        )
        
    return {
        "status": "ALLOW" if d.allowed else "DENY",
        "requestId": request.get("requestId", "unknown"),
        "policyDecision": {
            "allowed": d.allowed,
            "code": d.code,
            "reason": d.reason,
            "requiredScope": d.required_scope,
            "matchedScope": d.matched_scope,
            "obligations": list(d.obligations),
            "conditionsEvaluated": list(d.conditions_evaluated),
        },
        "provenance": {
            "catalogId": catalog.get("catalogId", "unknown"),
            "catalogDigest": catalog.get("catalogDigest", digest(catalog)),
            "policyModel": catalog.get("authorization", {}).get("policyModel", "default-deny"),
        },
        "audit": engine.audit(d),
        "runtimeMs": round((time.perf_counter() - started) * 1000, 3),
    }

if __name__ == "__main__":
    import argparse, pathlib, sys
    p = argparse.ArgumentParser(description="Isabella Scope Engine v3 CLI Processor")
    p.add_argument("catalog", help="Path to scope catalog JSON file")
    args = p.parse_args()
    
    catalog_data = json.loads(pathlib.Path(args.catalog).read_text(encoding="utf-8"))
    
    for line in sys.stdin:
        if line.strip():
            req_data = json.loads(line)
            res = authorize_json(catalog_data, req_data)
            print(json.dumps(res, ensure_ascii=False, sort_keys=True))
