from types import SimpleNamespace

from apps.core.permissions import IsOwner, IsRole, ReadOnlyOrStaff


def request(method="GET", **user):
    defaults = {"is_authenticated": True, "is_staff": False, "role": "student", "pk": 1}
    return SimpleNamespace(method=method, user=SimpleNamespace(**{**defaults, **user}))


def test_is_role():
    perm = IsRole("teacher", "admin")()
    assert perm.has_permission(request(role="teacher"), None)
    assert not perm.has_permission(request(role="student"), None)
    assert not perm.has_permission(request(is_authenticated=False, role="teacher"), None)


def test_is_owner():
    perm = IsOwner()
    view = SimpleNamespace(owner_field="user")
    assert perm.has_object_permission(request(pk=1), view, SimpleNamespace(user_id=1))
    assert not perm.has_object_permission(request(pk=1), view, SimpleNamespace(user_id=2))


def test_read_only_or_staff():
    perm = ReadOnlyOrStaff()
    assert perm.has_permission(request("GET", is_authenticated=False), None)
    assert not perm.has_permission(request("POST"), None)
    assert perm.has_permission(request("POST", is_staff=True), None)
