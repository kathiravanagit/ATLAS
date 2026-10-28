"""Invariant: every state-changing route is authenticated, and either CSRF-guarded
or listed in a set whose exception is itself tested.

The route table is enumerated from the live FastAPI app rather than a hand-kept
list, so adding an endpoint without a guard fails here instead of shipping. Two
exceptions exist, and both are narrow enough to assert:

* ``PRE_AUTH_ROUTES`` mint the session the CSRF token is bound to, so they cannot
  carry one; each is rate-limited in-process and issues no authority beyond the
  credentials supplied.
* ``CSRF_EXEMPT`` routes compute over the request body only. They must keep an
  authentication gate and must not take a database session — a handler that later
  gains one breaks its own exemption instead of quietly widening it.
"""
import inspect

from fastapi.params import Depends as DependsParam
from fastapi.routing import APIRoute

import auth
import main

MUTATING_METHODS = {"POST", "PUT", "PATCH", "DELETE"}

# Endpoints that establish a session. CSRF tokens are bound to a session, so no
# valid token can exist before these run.
PRE_AUTH_ROUTES = {
    "/api/auth/login",
    "/api/auth/register",
    "/api/auth/refresh",
}

# Stateless computations carried in a POST body: no rows read or written, no
# external service called. Authentication still applies.
CSRF_EXEMPT = {
    "/api/model/detect-anomaly",
    "/api/nlp/triage",
}

CSRF_GATE = "require_csrf"


def _walk(dependant, seen=None):
    """Yield every dependency callable reachable from a route's signature."""
    seen = seen if seen is not None else set()
    for sub in dependant.dependencies:
        if id(sub) in seen:
            continue
        seen.add(id(sub))
        yield sub.call
        yield from _walk(sub, seen)


def _names(dependant):
    """Qualified names of a route's dependency callables, including factories."""
    names = set()
    for call in _walk(dependant):
        names.add(getattr(call, "__name__", ""))
        names.add(getattr(call, "__qualname__", ""))
    return names


def _is_auth_gate(names):
    """True when a route requires an authenticated principal.

    ``verify_token`` is the base gate; ``require_permission`` and ``require_role``
    are closures over it, so their ``__qualname__`` is what identifies them.
    """
    if "verify_token" in names:
        return True
    return any(
        name.startswith(("require_permission", "require_role"))
        for name in names
    )


def _handler_takes_db(route):
    """True when the handler itself asks for a database session.

    Transitive ``get_db`` from the auth gate does not count: the gate needs the
    session to resolve the caller, which is not a statement about what the
    handler does with it.
    """
    for parameter in inspect.signature(route.endpoint).parameters.values():
        default = parameter.default
        if not isinstance(default, DependsParam):
            continue
        dependency = getattr(default, "dependency", None)
        if getattr(dependency, "__name__", "") == "get_db":
            return True
    return False


def _mutating_routes():
    return [
        route
        for route in main.app.routes
        if isinstance(route, APIRoute) and set(route.methods) & MUTATING_METHODS
    ]


def test_route_table_is_discoverable():
    """Guard against the enumeration silently finding nothing."""
    routes = _mutating_routes()
    assert len(routes) >= 20, f"only {len(routes)} mutating routes discovered — enumeration is broken"


def test_only_pre_auth_routes_skip_authentication():
    unguarded = {
        route.path for route in _mutating_routes() if not _is_auth_gate(_names(route.dependant))
    }
    assert unguarded == PRE_AUTH_ROUTES, (
        "state-changing routes skipping authentication must be exactly the pre-auth set; "
        f"unexpected: {sorted(unguarded - PRE_AUTH_ROUTES)}, "
        f"missing: {sorted(PRE_AUTH_ROUTES - unguarded)}"
    )


def test_pre_auth_routes_are_real_routes():
    """A stale entry would quietly permit a future unauthenticated endpoint."""
    paths = {route.path for route in _mutating_routes()}
    stale = sorted(PRE_AUTH_ROUTES - paths)
    assert not stale, "pre-auth exemptions naming routes that no longer exist: " + ", ".join(stale)


def test_every_mutating_route_is_csrf_guarded_or_documented():
    missing = {
        route.path
        for route in _mutating_routes()
        if CSRF_GATE not in _names(route.dependant)
        and route.path not in PRE_AUTH_ROUTES
        and route.path not in CSRF_EXEMPT
    }
    assert not missing, "state-changing routes without CSRF protection: " + ", ".join(sorted(missing))


def test_csrf_exemptions_are_real_routes():
    """A stale exemption would quietly widen the hole it documents."""
    paths = {route.path for route in _mutating_routes()}
    stale = sorted(CSRF_EXEMPT - paths)
    assert not stale, "CSRF exemptions naming routes that no longer exist: " + ", ".join(stale)


def test_csrf_exempt_routes_cannot_touch_the_database():
    """The exemption's stated condition, enforced rather than documented."""
    offenders = [
        route.path for route in _mutating_routes()
        if route.path in CSRF_EXEMPT and _handler_takes_db(route)
    ]
    assert not offenders, (
        "CSRF-exempt routes must stay stateless but now take a database session: "
        + ", ".join(offenders)
    )


def test_csrf_exempt_routes_still_require_authentication():
    """Stateless is not the same as public."""
    for route in _mutating_routes():
        if route.path in CSRF_EXEMPT:
            assert _is_auth_gate(_names(route.dependant)), (
                f"{route.path} is CSRF-exempt and must still require a caller"
            )


def test_exemption_sets_are_disjoint():
    """A path in both sets would evade both checks' intent."""
    assert not (PRE_AUTH_ROUTES & CSRF_EXEMPT)


def test_csrf_token_endpoint_is_not_itself_exempted():
    """Sanity: the token issuer must remain a normal, auditable route."""
    assert "/api/csrf-token" not in CSRF_EXEMPT
    assert "/api/csrf-token" not in PRE_AUTH_ROUTES


def test_permission_gate_covers_known_roles():
    """Every permission named by a route exists in the role table."""
    known = {permission for permissions in auth.ROLE_permissions.values() for permission in permissions}
    assert known >= {"read", "write", "override", "manage_users"}
