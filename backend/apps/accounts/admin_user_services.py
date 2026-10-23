"""Admin paneldan foydalanuvchilarni boshqarish: yaratish, rol, bloklash, o'chirish.

Himoyalar shu yerda (view'da emas): env admin, oxirgi admin va admin o'zi. Parol hech qachon audit
jurnaliga yozilmaydi.
"""

import secrets

from django.db import transaction
from django.utils import timezone
from rest_framework import serializers, status
from rest_framework.exceptions import APIException

from . import audit, services
from .auth_services import _check_password_strength, blacklist_all, normalize_email
from .models import Role, User

AUDIT_FIELDS = ("email", "role", "is_active")
STAFF_ROLES = (Role.EDITOR, Role.ADMIN)


class EnvAdminProtected(APIException):
    status_code = status.HTTP_403_FORBIDDEN
    default_code = "env_admin_protected"
    default_detail = "The environment admin cannot be deleted, blocked or demoted."


class SelfActionForbidden(APIException):
    status_code = status.HTTP_403_FORBIDDEN
    default_code = "self_action_forbidden"
    default_detail = "You cannot delete, block or demote your own account."


class LastAdmin(APIException):
    status_code = status.HTTP_409_CONFLICT
    default_code = "last_admin"
    default_detail = "The last active admin cannot be deleted, blocked or demoted."


def temporary_password() -> str:
    return secrets.token_urlsafe(12)


def _display_name(user: User) -> str:
    profile = getattr(user, "profile", None)
    return profile.display_name if profile else ""


def _snap(user: User) -> dict:
    return {**audit.snapshot(user, AUDIT_FIELDS), "display_name": _display_name(user)}


def _sync_flags(user: User) -> None:
    """`is_staff`/`is_superuser` rolga mos bo'lsin (kontent ko'rinishi `is_staff` ga tayanadi)."""
    user.is_staff = user.role in STAFF_ROLES
    user.is_superuser = user.role == Role.ADMIN


def _guard_losing_admin(actor: User, target: User, *, reason: bool) -> None:
    """`reason` — amal targetni admin sifatida yoki faol holatda yo'qotadi."""
    if not reason:
        return
    if target.is_env_admin:
        raise EnvAdminProtected()
    if target.pk == actor.pk:
        raise SelfActionForbidden()
    if target.role == Role.ADMIN and target.is_active:
        has_other = (
            User.objects.select_for_update()
            .filter(role=Role.ADMIN, is_active=True)
            .exclude(pk=target.pk)
            .exists()
        )
        if not has_other:
            raise LastAdmin()


@transaction.atomic
def create_user(
    actor: User,
    *,
    email: str,
    role: str,
    display_name: str = "",
    password: str = "",
    request=None,
) -> tuple[User, str | None]:
    """`(user, vaqtinchalik parol)`: parol berilmasa tasodifiy parol (faqat bir marta qaytadi)."""
    email = normalize_email(email)
    if User.objects.filter(email__iexact=email).exists():
        raise serializers.ValidationError({"email": ["email_taken"]})
    generated = None if password else temporary_password()
    _check_password_strength(password or generated, User(email=email), "password")
    user = User.objects.create_user(email=email, password=password or generated, role=role)
    _sync_flags(user)
    user.email_verified_at = timezone.now()
    user.save(update_fields=["is_staff", "is_superuser", "email_verified_at"])
    profile = services.get_profile(user)
    profile.display_name = display_name.strip()
    profile.save(update_fields=["display_name"])
    audit.record(actor, "create", "user", user.pk, label=email, after=_snap(user), request=request)
    return user, generated


@transaction.atomic
def update_user(
    actor: User,
    target: User,
    *,
    role: str | None = None,
    is_active: bool | None = None,
    display_name: str | None = None,
    request=None,
) -> User:
    before = _snap(target)
    new_role = target.role if role is None else role
    new_active = target.is_active if is_active is None else is_active

    _guard_losing_admin(
        actor,
        target,
        reason=(target.role == Role.ADMIN and new_role != Role.ADMIN)
        or (target.is_active and not new_active),
    )

    if new_role != target.role:
        services.change_role(target, new_role, actor=actor, request=request)
        _sync_flags(target)
    if new_active != target.is_active:
        target.is_active = new_active
        if not new_active:
            blacklist_all(target)
    target.save(update_fields=["is_staff", "is_superuser", "is_active", "role"])

    if display_name is not None:
        profile = services.get_profile(target)
        profile.display_name = display_name.strip()
        profile.save(update_fields=["display_name"])

    after = _snap(target)
    if before != after:
        action = "update"
        if before["is_active"] != after["is_active"]:
            action = "unblock" if after["is_active"] else "block"
        elif before["role"] != after["role"]:
            action = "role_change"
        audit.record(
            actor,
            action,
            "user",
            target.pk,
            label=target.email or "",
            before=before,
            after=after,
            request=request,
        )
    return target


@transaction.atomic
def delete_user(actor: User, target: User, request=None) -> None:
    _guard_losing_admin(actor, target, reason=True)
    before, label = _snap(target), target.email or ""
    services.delete_account(target, request)
    audit.record(actor, "delete", "user", target.pk, label=label, before=before, request=request)
