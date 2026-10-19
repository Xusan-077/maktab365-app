from rest_framework.permissions import SAFE_METHODS, BasePermission


def IsRole(*roles: str) -> type[BasePermission]:  # noqa: N802 — permission sinfi fabrikasi
    """`permission_classes = [IsRole("teacher")]`. Foydalanuvchining `role` maydoni bo'yicha."""
    allowed = frozenset(roles)

    class _IsRole(BasePermission):
        def has_permission(self, request, view):
            user = request.user
            return bool(user and user.is_authenticated and getattr(user, "role", None) in allowed)

    _IsRole.__name__ = _IsRole.__qualname__ = f"IsRole({', '.join(sorted(allowed))})"
    return _IsRole


class IsOwner(BasePermission):
    """Obyekt egasi. Egalik maydoni nomi `view.owner_field` (default: `user`)."""

    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated)

    def has_object_permission(self, request, view, obj):
        field = getattr(view, "owner_field", "user")
        return getattr(obj, f"{field}_id", None) == request.user.pk


class ReadOnlyOrStaff(BasePermission):
    """O'qish hamma uchun, yozish faqat staff uchun."""

    def has_permission(self, request, view):
        if request.method in SAFE_METHODS:
            return True
        return bool(request.user and request.user.is_authenticated and request.user.is_staff)
