"""Akkaunt biznes-mantiqi. Rolni o'zgartirish faqat shu yerdagi funksiyalar orqali."""

from collections.abc import Iterable

from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import APIException, PermissionDenied

from apps.core.net import client_ip

from .models import (
    AuthEvent,
    AuthEventType,
    Identity,
    Locale,
    Profile,
    Role,
    User,
    VerificationToken,
)

SELF_SERVICE_ROLES = frozenset({Role.STUDENT, Role.TEACHER})


class RoleForbidden(PermissionDenied):
    default_code = "role_forbidden"
    default_detail = "You cannot assign this role."


class InvalidRole(APIException):
    status_code = 400
    default_code = "invalid_role"
    default_detail = "Invalid role."


def client_meta(request) -> dict:
    """Audit uchun so'rovdan IP va User-Agent."""
    if request is None:
        return {"ip": None, "user_agent": ""}
    return {"ip": client_ip(request), "user_agent": request.META.get("HTTP_USER_AGENT", "")[:300]}


def log_event(user, type_: str, request=None, **meta) -> AuthEvent:
    return AuthEvent.objects.create(user=user, type=type_, meta=meta, **client_meta(request))


def get_profile(user: User) -> Profile:
    profile, _ = Profile.objects.get_or_create(user=user)
    return profile


def can_assign_role(actor: User, target_role: str) -> bool:
    """Oddiy foydalanuvchi faqat student<->teacher; editor/admin ni faqat admin beradi."""
    if actor.role == Role.ADMIN:
        return True
    return target_role in SELF_SERVICE_ROLES and actor.role in SELF_SERVICE_ROLES


@transaction.atomic
def change_role(user: User, new_role: str, *, actor: User | None = None, request=None) -> User:
    """Rolni o'zgartiradigan yagona joy. `actor=None` — foydalanuvchining o'zi."""
    if new_role not in Role.values:
        raise InvalidRole()
    actor = actor or user
    if not can_assign_role(actor, new_role):
        raise RoleForbidden()
    if user.role == new_role:
        return user
    old_role = user.role
    user.role = new_role
    user.save(update_fields=["role"])
    log_event(user, AuthEventType.ROLE_CHANGED, request, old=old_role, new=new_role)
    return user


@transaction.atomic
def update_profile(user: User, data: dict, request=None) -> Profile:
    profile = get_profile(user)
    for field, value in data.items():
        setattr(profile, field, value)
    profile.save()
    log_event(user, AuthEventType.PROFILE_UPDATED, request, fields=sorted(data))
    return profile


@transaction.atomic
def complete_onboarding(user: User, *, role: str, data: dict, request=None) -> Profile:
    """Rol + profil maydonlarini saqlab, `onboarded_at` ni belgilaydi (qayta chaqirish xavfsiz)."""
    change_role(user, role, request=request)
    profile = get_profile(user)
    for field, value in data.items():
        setattr(profile, field, value)
    if role == Role.STUDENT:
        profile.subjects, profile.grades = [], []
    else:
        profile.grade = None
    first_time = profile.onboarded_at is None
    profile.onboarded_at = profile.onboarded_at or timezone.now()
    profile.save()
    if first_time:
        log_event(user, AuthEventType.ONBOARDED, request, role=role)
    return profile


@transaction.atomic
def delete_account(user: User, request=None) -> None:
    """Soft delete + anonimlashtirish: shaxsiy ma'lumot o'chadi, id va audit izi qoladi."""
    from .auth_services import blacklist_all

    blacklist_all(user)
    VerificationToken.objects.filter(user=user).delete()
    Identity.objects.filter(user=user).delete()
    # O'qish ma'lumotlari (progress, xatcho'p, reja, oxirgi ko'rilganlar) butunlay o'chadi.
    user.topic_progress.all().delete()
    user.bookmarks.all().delete()
    user.study_goals.all().delete()
    user.recent_views.all().delete()
    Profile.objects.filter(user=user).update(
        display_name="",
        avatar_url="",
        grade=None,
        subjects=[],
        grades=[],
        locale=Locale.UZ,
        onboarded_at=None,
    )
    user.email = None
    user.email_verified_at = None
    user.is_active = False
    user.set_unusable_password()
    user.deleted_at = timezone.now()
    user.save()
    # Audit yozuvi akkaunt bilan bog'lanib qoladi, lekin IP/UA saqlanmaydi.
    AuthEvent.objects.filter(user=user).update(ip=None, user_agent="")
    AuthEvent.objects.create(user=user, type=AuthEventType.ACCOUNT_DELETED)


def export_data(user: User, request=None) -> dict:
    profile = get_profile(user)
    log_event(user, AuthEventType.DATA_EXPORTED, request)
    return {
        "exported_at": timezone.now(),
        "user": {
            "id": user.id,
            "email": user.email,
            "email_verified_at": user.email_verified_at,
            "role": user.role,
            "date_joined": user.date_joined,
            "last_login": user.last_login,
        },
        "profile": {
            "display_name": profile.display_name,
            "avatar_url": profile.avatar_url,
            "locale": profile.locale,
            "grade": profile.grade,
            "subjects": profile.subjects,
            "grades": profile.grades,
            "onboarded_at": profile.onboarded_at,
        },
        "identities": [
            {
                "provider": i.provider,
                "provider_uid": i.provider_uid,
                "email": i.email,
                "verified": i.verified,
                "created_at": i.created_at,
            }
            for i in user.identities.all()
        ],
        "auth_events": [
            {
                "type": e.type,
                "ip": e.ip,
                "user_agent": e.user_agent,
                "meta": e.meta,
                "created_at": e.created_at,
            }
            for e in user.auth_events.all()
        ],
        "learning": {
            "progress": user.topic_progress.select_related("topic__book"),
            "bookmarks": user.bookmarks.select_related("topic__book", "book"),
            "goals": user.study_goals.select_related("topic__book"),
        },
    }


def normalize_ids(values: Iterable) -> list:
    """Dublikatlarni tartibni saqlab olib tashlaydi."""
    return list(dict.fromkeys(values))
