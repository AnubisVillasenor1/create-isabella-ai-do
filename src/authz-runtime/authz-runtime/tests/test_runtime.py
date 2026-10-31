"""Pruebas obligatorias del PDP (modo verificador inyectado, sin red)."""

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from isabella_runtime import AuthzError, Runtime  # noqa: E402

CATALOG = json.loads((Path(__file__).resolve().parent / "catalog.json").read_text())


class FakeVerifier:
    def __init__(self, claims):
        self.claims = claims

    def verify(self, token):
        return self.claims


def make_runtime(claims):
    return Runtime(CATALOG, verifier=FakeVerifier(claims))


def req(scope, resource_tenant=None, **over):
    payload = {
        "requestId": "r", "traceId": "t", "accessToken": "x",
        "requiredScope": scope, "resourceTenant": resource_tenant,
    }
    payload.update(over)
    return payload


def test_basic_allow():
    rt = make_runtime({
        "sub": "u1", "tenantId": "tenant-001", "roles": ["member"],
        "scopes": ["memory:read"], "iss": "i", "aud": "a",
        "jti": "j1", "iat": 1000, "exp": 1900,
    })
    d = rt.authorize(req("memory:read", None)).decision
    assert d["allowed"], d


def test_client_assurance_ignored_on_high_scope():
    # Aunque el request afirme aal3/step-up/dual-control/environment,
    # el token NO los lleva -> debe DENEGAR (prueba el fix critico).
    rt = make_runtime({
        "sub": "admin1", "tenantId": "tenant-001", "roles": ["governance_admin"],
        "scopes": ["governance:approve"], "iss": "i", "aud": "a",
        "jti": "j2", "iat": 1000, "exp": 1900,
    })
    d = rt.authorize(req(
        "governance:approve", None,
        assurance="aal3", stepUpVerified=True, dualControlVerified=True,
        environment="controlled",
    )).decision
    assert not d["allowed"], "client-supplied assurance must NOT bypass ABAC"
    assert d["code"] == "ASSURANCE_INSUFFICIENT", d


def test_high_scope_allowed_with_claims():
    rt = make_runtime({
        "sub": "admin1", "tenantId": "tenant-001", "roles": ["governance_admin"],
        "scopes": ["governance:approve"], "aal": "aal3", "step_up": True,
        "dual_control": True, "environment": "controlled",
        "iss": "i", "aud": "a", "jti": "j3", "iat": 1000, "exp": 1900,
    })
    d = rt.authorize(req("governance:approve", None)).decision
    assert d["allowed"], d


def test_cross_tenant_denied():
    rt = make_runtime({
        "sub": "u1", "tenantId": "tenant-001", "roles": ["member"],
        "scopes": ["memory:read"], "iss": "i", "aud": "a",
        "jti": "j4", "iat": 1000, "exp": 1900,
    })
    d = rt.authorize(req("memory:read", "tenant-999")).decision
    assert not d["allowed"] and d["code"] == "TENANT_BOUNDARY_VIOLATION", d


def test_replay_detected():
    claims = {
        "sub": "u1", "tenantId": "tenant-001", "roles": ["member"],
        "scopes": ["memory:read"], "iss": "i", "aud": "a",
        "jti": "j5", "iat": 1000, "exp": 1900,
    }
    rt = make_runtime(claims)
    assert rt.authorize(req("memory:read", None)).decision["allowed"]
    try:
        rt.authorize(req("memory:read", None))
        assert False, "replay should be detected"
    except AuthzError as e:
        assert e.code == "TOKEN_REPLAY"


if __name__ == "__main__":
    for name, fn in list(globals().items()):
        if name.startswith("test_") and callable(fn):
            fn()
            print("PASS", name)
    print("ALL TESTS PASSED")
