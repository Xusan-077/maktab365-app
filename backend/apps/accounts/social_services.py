"""Google / Telegram / email OTP orqali kirish va ulangan kirish usullarini boshqarish.

Bog'lash qoidalari (akkaunt o'g'irlashdan saqlanish):
- Provayder TASDIQLAGAN email bersa va shu email'li akkaunt TASDIQLANGAN bo'lsa — avtomatik
  bog'lanadi.
- Shu email'li akkaunt tasdiqlanMAGAN bo'lsa — bog'lanmaydi (`email_unverified_account`). Istisno:
  email OTP — kod o'sha emailning egaligini isbotlaydi; akkaunt tasdiqlanadi, lekin undan oldin
  qo'yilgan parol va sessiyalar bekor qilinadi (birovning emailiga oldindan ochilgan akkaunt).
- Telegram email bermaydi: faqat `telegram` identity bo'yicha topiladi.
"""

from django.contrib.auth.models import update_last_login
from django.db import IntegrityError, transaction
from django.utils import timezone
from rest_framework.exceptions import APIException, NotFound

from .auth_services import (
    InvalidCredentials,
    NoEmail,
    _check_password_strength,
    _set_password,
    blacklist_all,
    normalize_email,
)
from .models import (
    AuthEventType,
    Identity,
    Locale,
    Profile,
    Provider,
    TokenPurpose,
    User,
    VerificationToken,
)
from .providers import ProviderIdentity
from .services import log_event


class EmailUnverifiedAccount(APIException):
    status_code = 409
    default_code = "email_unverified_account"
    default_detail = "An unverified account already uses this email."


class IdentityTaken(APIException):
    status_code = 409
    default_code = "identity_taken"
    default_detail = "This sign-in method belongs to another account."


class ProviderAlreadyLinked(APIException):
    status_code = 409
    default_code = "provider_already_linked"
    default_detail = "Another account of this provider is already linked."


class EmailInUse(APIException):
    status_code = 409
    default_code = "email_in_use"
    default_detail = "This email belongs to another account."


class LastIdentity(APIException):
    status_code = 409
    default_code = "last_identity"
    default_detail = "The last sign-in method cannot be removed."


class PasswordAlreadySet(APIException):
    status_code = 400
    default_code = "password_already_set"
    default_detail = "The account already has a password."


def _verified_email(identity: ProviderIdentity) -> str | None:
    if identity.email and identity.email_verified:
        return normalize_email(identity.email)
    return None


def _attach(user: User, identity: ProviderIdentity) -> Identity:
    return Identity.objects.create(
        user=user,
        provider=identity.provider,
        provider_uid=identity.uid,
        email=_verified_email(identity) or "",
        verified=bool(_verified_email(identity)),
    )


def _reclaim_unverified(user: User, request) -> None:
    """Kod orqali email egaligi isbotlandi: oldindan qo'yilgan kirish ma'lumotlari bekor bo'ladi."""
    now = timezone.now()
    user.email_verified_at = now
    user.set_unusable_password()
    user.save(update_fields=["email_verified_at", "password"])
    Identity.objects.filter(user=user, provider=Provider.PASSWORD).delete()
    VerificationToken.objects.filter(
        user=user, purpose=TokenPurpose.EMAIL_VERIFY, used_at__isnull=True
    ).update(used_at=now)
    blacklist_all(user)
    log_event(user, AuthEventType.EMAIL_VERIFIED, request, method=Provider.EMAIL_OTP)


def _create_user(identity: ProviderIdentity, email: str | None, locale: str | None) -> User:
    now = timezone.now()
    user = User.objects.create_user(email=email)
    if email:
        user.email_verified_at = now
        user.save(update_fields=["email_verified_at"])
    Profile.objects.create(
        user=user,
        display_name=identity.display_name[:60],
        avatar_url=identity.avatar_url,
        locale=locale or Locale.UZ,
    )
    _attach(user, identity)
    return user


def _resolve(identity: ProviderIdentity, locale: str | None, request) -> tuple[User, bool]:
    email = _verified_email(identity)
    with transaction.atomic():
        user = User.objects.select_for_update().filter(email=email).first() if email else None
        if user is None:
            return _create_user(identity, email, locale), True
        if user.email_verified_at is None:
            if identity.provider != Provider.EMAIL_OTP:
                raise EmailUnverifiedAccount()
            _reclaim_unverified(user, request)
        _attach(user, identity)
        log_event(
            user, AuthEventType.IDENTITY_LINKED, request, provider=identity.provider, auto=True
        )
        return user, False


def sign_in(
    identity: ProviderIdentity, *, locale: str | None = None, request=None
) -> tuple[User, bool]:
    """Tasdiqlangan provayder shaxsi bo'yicha foydalanuvchini topadi, bog'laydi yoki yaratadi."""
    found = (
        Identity.objects.select_related("user")
        .filter(provider=identity.provider, provider_uid=identity.uid)
        .first()
    )
    if found is not None:
        user, is_new = found.user, False
    else:
        try:
            user, is_new = _resolve(identity, locale, request)
        except IntegrityError:  # bir vaqtdagi ikkinchi so'rov shu identity'ni yaratib bo'ldi
            return sign_in(identity, locale=locale, request=request)
    if not user.is_active or user.deleted_at is not None:
        raise InvalidCredentials()
    update_last_login(None, user)
    if is_new:
        log_event(user, AuthEventType.REGISTERED, request, method=identity.provider)
    log_event(user, AuthEventType.LOGIN, request, method=identity.provider)
    return user, is_new


# --- ulangan kirish usullari ---


def list_identities(user: User) -> list[Identity]:
    return list(user.identities.order_by("created_at"))


@transaction.atomic
def link_identity(user: User, identity: ProviderIdentity, request=None) -> Identity:
    """Kirgan foydalanuvchiga yangi kirish usuli qo'shadi (qayta qo'shish xavfsiz)."""
    User.all_objects.select_for_update().get(pk=user.pk)
    taken = Identity.objects.filter(provider=identity.provider, provider_uid=identity.uid).first()
    if taken is not None:
        if taken.user_id != user.pk:
            raise IdentityTaken()
        return taken
    if user.identities.filter(provider=identity.provider).exists():
        raise ProviderAlreadyLinked()
    email = _verified_email(identity)
    owner = User.objects.filter(email=email).exclude(pk=user.pk).first() if email else None
    if owner is not None and identity.provider == Provider.EMAIL_OTP:
        # OTP emaili bo'yicha kirish shu emailning egasiga olib borardi — noaniqlik.
        raise EmailInUse()
    linked = _attach(user, identity)
    if email and owner is None and (user.email is None or user.email == email):
        # Provayder email egaligini isbotladi: akkauntda email yo'q yoki tasdiqlanmagan bo'lsa.
        update = []
        if user.email is None:
            user.email = email
            update.append("email")
        if user.email_verified_at is None:
            user.email_verified_at = timezone.now()
            update.append("email_verified_at")
        if update:
            user.save(update_fields=update)
    log_event(user, AuthEventType.IDENTITY_LINKED, request, provider=identity.provider)
    return linked


@transaction.atomic
def unlink_identity(user: User, identity_id, request=None) -> None:
    User.all_objects.select_for_update().get(pk=user.pk)
    identity = user.identities.filter(pk=identity_id).first()
    if identity is None:
        raise NotFound()
    if user.identities.count() <= 1:
        raise LastIdentity()
    if identity.provider == Provider.PASSWORD:
        user.set_unusable_password()
        user.save(update_fields=["password"])
    provider = identity.provider
    identity.delete()
    log_event(user, AuthEventType.IDENTITY_UNLINKED, request, provider=provider)


@transaction.atomic
def set_password(user: User, password: str, request=None) -> None:
    """Parolsiz akkaunt (Google/Telegram/OTP) uchun birinchi parol."""
    if user.has_usable_password():
        raise PasswordAlreadySet()
    if not user.email:
        raise NoEmail()
    _check_password_strength(password, user, "new_password")
    _set_password(user, password)
    log_event(user, AuthEventType.PASSWORD_SET, request)
