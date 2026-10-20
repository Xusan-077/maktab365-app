"""Email + parol autentifikatsiyasi: JWT juftliklari, bir martalik email tokenlari, bloklash.

Xavfsizlik qoidalari:
- Email tokenining faqat SHA-256 xeshi saqlanadi; token bir martalik va muddatli.
- Kirishda akkaunt bor-yo'qligi oshkor qilinmaydi: xato bir xil, vaqt ham (soxta xesh hisoblanadi).
- Parol tiklash so'rovi doim bir xil javob beradi; qidiruv va xat Celery task'ida.
- Ketma-ket noto'g'ri parollardan keyin email vaqtincha bloklanadi (cache — prod'da Redis).
"""

import hashlib
import math
import secrets
import time

from django.conf import settings
from django.contrib.auth.models import update_last_login
from django.contrib.auth.password_validation import validate_password
from django.core.cache import cache
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import IntegrityError, transaction
from django.utils import timezone
from rest_framework import serializers
from rest_framework.exceptions import APIException, Throttled
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.settings import api_settings as jwt_settings
from rest_framework_simplejwt.token_blacklist.models import BlacklistedToken, OutstandingToken
from rest_framework_simplejwt.tokens import RefreshToken

from .models import (
    AuthEvent,
    AuthEventType,
    Identity,
    Locale,
    Profile,
    Provider,
    TokenPurpose,
    User,
    VerificationToken,
)
from .services import client_meta, log_event

# --- xatolar (code — barqaror kalit, frontend i18n shunga qarab matn tanlaydi) ---


class InvalidToken(APIException):
    """simplejwt `InvalidToken` bilan bir xil kod, lekin autentifikatorsiz view'da ham 401."""

    status_code = 401
    default_code = "token_not_valid"
    default_detail = "Token is invalid or expired."


class InvalidCredentials(APIException):
    status_code = 401
    default_code = "invalid_credentials"
    default_detail = "Invalid email or password."


class LoginLocked(Throttled):
    default_code = "login_locked"
    default_detail = "Too many failed attempts. Try again later."


class ResendCooldown(Throttled):
    default_code = "resend_cooldown"
    default_detail = "Verification email was sent recently."


class InvalidAuthToken(APIException):
    status_code = 400
    default_code = "invalid_token"
    default_detail = "The link is invalid or has already been used."


class AuthTokenExpired(APIException):
    status_code = 400
    default_code = "token_expired"
    default_detail = "The link has expired."


class AlreadyVerified(APIException):
    status_code = 400
    default_code = "already_verified"
    default_detail = "Email is already verified."


class NoEmail(APIException):
    status_code = 400
    default_code = "no_email"
    default_detail = "Account has no email address."


TOKEN_TTL = {
    TokenPurpose.EMAIL_VERIFY: lambda: settings.AUTH_EMAIL_VERIFY_TTL,
    TokenPurpose.PASSWORD_RESET: lambda: settings.AUTH_PASSWORD_RESET_TTL,
}


def normalize_email(email: str) -> str:
    return email.strip().lower()


def _digest(value: str) -> str:
    return hashlib.sha256(value.encode()).hexdigest()


def password_error_codes(password: str, user: User | None = None) -> list[str]:
    """Django validatorlari natijasi kod sifatida (`password_too_short`, …) — matn frontend'da."""
    try:
        validate_password(password, user)
    except DjangoValidationError as exc:
        return list(dict.fromkeys(error.code or "password_invalid" for error in exc.error_list))
    return []


def _check_password_strength(password: str, user: User, field: str) -> None:
    codes = password_error_codes(password, user)
    if codes:
        raise serializers.ValidationError({field: codes})


# --- JWT ---


def issue_tokens(user: User) -> dict:
    refresh = RefreshToken.for_user(user)
    return {"access": str(refresh.access_token), "refresh": str(refresh)}


def _parse_refresh(raw: str) -> RefreshToken:
    try:
        return RefreshToken(raw)
    except TokenError as exc:
        raise InvalidToken(str(exc)) from exc


def rotate_refresh(raw: str) -> dict:
    """Refresh'ni bir martalik almashtiradi: eskisi blacklist'ga, yangi juftlik qaytadi."""
    refresh = _parse_refresh(raw)
    user = User.objects.filter(
        pk=refresh.payload.get(jwt_settings.USER_ID_CLAIM), is_active=True
    ).first()
    if user is None:
        raise InvalidToken("No active account for this token.")
    with transaction.atomic():
        outstanding = (
            OutstandingToken.objects.select_for_update()
            .filter(jti=refresh.payload[jwt_settings.JTI_CLAIM])
            .first()
        )
        if outstanding is None:
            raise InvalidToken("Unknown token.")
        # Bir vaqtda ikki marta ishlatilsa, faqat bittasi o'tadi.
        _, created = BlacklistedToken.objects.get_or_create(token=outstanding)
        if not created:
            raise InvalidToken("Token is blacklisted.")
    return issue_tokens(user)


def blacklist_refresh(raw: str) -> User | None:
    """Bitta refresh'ni bekor qiladi (logout). Yaroqsiz token — jim (idempotent)."""
    try:
        refresh = RefreshToken(raw)
    except TokenError:
        return None
    refresh.blacklist()
    return User.objects.filter(pk=refresh.payload.get(jwt_settings.USER_ID_CLAIM)).first()


def refresh_jti_for(raw: str | None, user: User) -> str | None:
    """Foydalanuvchiga tegishli, yaroqli refresh'ning jti'si (aks holda `None`)."""
    if not raw:
        return None
    try:
        refresh = RefreshToken(raw)
    except TokenError:
        return None
    if str(refresh.payload.get(jwt_settings.USER_ID_CLAIM)) != str(user.pk):
        return None
    return refresh.payload[jwt_settings.JTI_CLAIM]


def blacklist_all(user: User, *, keep_jti: str | None = None) -> int:
    """Barcha amaldagi refresh tokenlarni bekor qiladi (`keep_jti` dan tashqari)."""
    tokens = OutstandingToken.objects.filter(
        user=user, expires_at__gt=timezone.now(), blacklistedtoken__isnull=True
    )
    if keep_jti:
        tokens = tokens.exclude(jti=keep_jti)
    created = BlacklistedToken.objects.bulk_create(
        [BlacklistedToken(token=token) for token in tokens], ignore_conflicts=True
    )
    return len(created)


# --- bloklash (ketma-ket noto'g'ri parollar) ---


def _lock_key(email: str) -> str:
    return f"auth:lock:{_digest(email)}"


def _fail_key(email: str) -> str:
    return f"auth:fail:{_digest(email)}"


def ensure_not_locked(email: str) -> None:
    until = cache.get(_lock_key(email))
    if until and until > time.time():
        raise LoginLocked(wait=math.ceil(until - time.time()))


def _record_failure(email: str, user: User | None, request) -> None:
    key = _fail_key(email)
    cache.add(key, 0, timeout=settings.AUTH_LOCKOUT_SECONDS)
    try:
        count = cache.incr(key)
    except ValueError:  # kalit shu orada muddati o'tib o'chgan
        cache.set(key, 1, timeout=settings.AUTH_LOCKOUT_SECONDS)
        count = 1
    log_event(user, AuthEventType.LOGIN_FAILED, request, attempt=count)
    if count >= settings.AUTH_LOCKOUT_THRESHOLD:
        lock_seconds = settings.AUTH_LOCKOUT_SECONDS
        cache.set(_lock_key(email), time.time() + lock_seconds, timeout=lock_seconds)
        cache.delete(key)
        log_event(user, AuthEventType.LOGIN_LOCKED, request)
        raise LoginLocked(wait=lock_seconds)


def clear_failures(email: str) -> None:
    cache.delete_many([_fail_key(email), _lock_key(email)])


# --- kirish va ro'yxatdan o'tish ---


def authenticate_password(email: str, password: str, request=None) -> User:
    email = normalize_email(email)
    ensure_not_locked(email)
    user = User.objects.filter(email=email).first()
    if user is None or not user.has_usable_password():
        # Vaqt farqidan himoya: akkaunt yo'q bo'lsa ham xesh hisoblanadi.
        User().set_password(password)
        valid = False
    else:
        valid = user.check_password(password) and user.is_active
    if not valid:
        _record_failure(email, user, request)
        raise InvalidCredentials()
    clear_failures(email)
    update_last_login(None, user)
    log_event(user, AuthEventType.LOGIN, request, method=Provider.PASSWORD)
    return user


def register(
    *, email: str, password: str, display_name: str = "", locale: str | None = None, request=None
) -> User:
    email = normalize_email(email)
    _check_password_strength(password, User(email=email), "password")
    email_taken = serializers.ValidationError({"email": ["email_taken"]})
    if User.objects.filter(email=email).exists():
        raise email_taken
    try:
        with transaction.atomic():
            user = User.objects.create_user(email=email, password=password)
            Profile.objects.create(
                user=user, display_name=display_name.strip(), locale=locale or Locale.UZ
            )
            Identity.objects.create(
                user=user, provider=Provider.PASSWORD, provider_uid=str(user.pk), email=email
            )
    except IntegrityError as exc:  # bir vaqtdagi ikkinchi ro'yxatdan o'tish
        raise email_taken from exc
    update_last_login(None, user)
    log_event(user, AuthEventType.REGISTERED, request, method=Provider.PASSWORD)
    _schedule_verification(user, request)
    return user


# --- email tokenlari ---


def issue_email_token(user: User, purpose: str) -> str:
    """Yangi bir martalik token; shu maqsaddagi oldingi ishlatilmagan tokenlar bekor bo'ladi."""
    now = timezone.now()
    VerificationToken.objects.filter(user=user, purpose=purpose, used_at__isnull=True).update(
        used_at=now
    )
    raw = secrets.token_urlsafe(32)
    VerificationToken.objects.create(
        user=user,
        purpose=purpose,
        token_hash=_digest(raw),
        email=user.email,
        expires_at=now + TOKEN_TTL[purpose](),
    )
    return raw


def _locked_valid_token(raw: str, purpose: str) -> VerificationToken:
    """Tranzaksiya ichida chaqiriladi: tokenni qulflaydi va yaroqliligini tekshiradi."""
    record = (
        VerificationToken.objects.select_for_update()
        .select_related("user")
        .filter(token_hash=_digest(raw or ""), purpose=purpose)
        .first()
    )
    if record is None or record.used_at is not None:
        raise InvalidAuthToken()
    if record.expires_at <= timezone.now():
        raise AuthTokenExpired()
    user = record.user
    if user.deleted_at is not None or not user.is_active or user.email != record.email:
        raise InvalidAuthToken()
    return record


def _resend_key(user: User) -> str:
    return f"auth:resend:{user.pk}"


def _schedule_verification(user: User, request=None) -> None:
    from .tasks import send_verification_email

    cooldown = settings.AUTH_RESEND_COOLDOWN_SECONDS
    cache.set(_resend_key(user), time.time() + cooldown, timeout=cooldown)
    meta = client_meta(request)
    transaction.on_commit(lambda: send_verification_email.delay(str(user.pk), meta))


def resend_verification(user: User, request=None) -> None:
    if not user.email:
        raise NoEmail()
    if user.email_verified_at is not None:
        raise AlreadyVerified()
    until = cache.get(_resend_key(user))
    if until and until > time.time():
        raise ResendCooldown(wait=math.ceil(until - time.time()))
    _schedule_verification(user, request)


def send_verification(user_id: str, meta: dict | None = None) -> bool:
    """Celery task ichida: token yaratadi va xat yuboradi."""
    from .emails import send_token_email

    user = (
        User.objects.select_related("profile")
        .filter(pk=user_id, is_active=True, email__isnull=False, email_verified_at__isnull=True)
        .first()
    )
    if user is None:
        return False
    raw = issue_email_token(user, TokenPurpose.EMAIL_VERIFY)
    send_token_email(
        to=user.email, purpose=TokenPurpose.EMAIL_VERIFY, token=raw, locale=_locale_of(user)
    )
    AuthEvent.objects.create(
        user=user, type=AuthEventType.EMAIL_VERIFICATION_SENT, **(meta or client_meta(None))
    )
    return True


@transaction.atomic
def verify_email(raw: str, request=None) -> User:
    record = _locked_valid_token(raw, TokenPurpose.EMAIL_VERIFY)
    record.used_at = timezone.now()
    record.save(update_fields=["used_at"])
    user = record.user
    if user.email_verified_at is None:
        user.email_verified_at = record.used_at
        user.save(update_fields=["email_verified_at"])
        Identity.objects.filter(user=user, provider=Provider.PASSWORD).update(verified=True)
        log_event(user, AuthEventType.EMAIL_VERIFIED, request)
    return user


# --- parol ---


def request_password_reset(email: str, request=None) -> None:
    """Doim bir xil ishlaydi: akkaunt bor-yo'qligi faqat task ichida aniqlanadi."""
    from .tasks import send_password_reset_email

    meta = client_meta(request)
    normalized = normalize_email(email)
    transaction.on_commit(lambda: send_password_reset_email.delay(normalized, meta))


def send_password_reset(email: str, meta: dict | None = None) -> bool:
    """Celery task ichida: akkaunt bo'lsa token yaratadi va xat yuboradi."""
    from .emails import send_token_email

    user = User.objects.select_related("profile").filter(email=email, is_active=True).first()
    if user is None:
        return False
    raw = issue_email_token(user, TokenPurpose.PASSWORD_RESET)
    send_token_email(
        to=user.email, purpose=TokenPurpose.PASSWORD_RESET, token=raw, locale=_locale_of(user)
    )
    AuthEvent.objects.create(
        user=user, type=AuthEventType.PASSWORD_RESET_REQUESTED, **(meta or client_meta(None))
    )
    return True


def _set_password(user: User, password: str) -> None:
    user.set_password(password)
    user.save(update_fields=["password"])
    Identity.objects.get_or_create(
        user=user,
        provider=Provider.PASSWORD,
        provider_uid=str(user.pk),
        defaults={"email": user.email or "", "verified": user.email_verified_at is not None},
    )


@transaction.atomic
def reset_password(raw: str, password: str, request=None) -> User:
    record = _locked_valid_token(raw, TokenPurpose.PASSWORD_RESET)
    user = record.user
    # Kuchsiz parolda token ishlatilmaydi (tranzaksiya qaytadi) — foydalanuvchi qayta urina oladi.
    _check_password_strength(password, user, "password")
    now = timezone.now()
    record.used_at = now
    record.save(update_fields=["used_at"])
    _set_password(user, password)
    if user.email_verified_at is None:
        # Xatdagi havola orqali kelgan — email egaligi isbotlangan.
        user.email_verified_at = now
        user.save(update_fields=["email_verified_at"])
    blacklist_all(user)
    clear_failures(user.email)
    log_event(user, AuthEventType.PASSWORD_RESET, request)
    return user


@transaction.atomic
def change_password(
    user: User, *, current: str, new: str, keep_refresh: str | None = None, request=None
) -> None:
    """Parolni almashtiradi; joriy sessiyadan (`keep_refresh`) boshqa refresh'lar bekor bo'ladi."""
    if user.has_usable_password() and not user.check_password(current or ""):
        raise serializers.ValidationError({"current_password": ["invalid_password"]})
    _check_password_strength(new, user, "new_password")
    _set_password(user, new)
    revoked = blacklist_all(user, keep_jti=refresh_jti_for(keep_refresh, user))
    log_event(user, AuthEventType.PASSWORD_CHANGED, request, revoked_sessions=revoked)


def logout(raw: str, request=None) -> None:
    user = blacklist_refresh(raw)
    if user is not None:
        log_event(user, AuthEventType.LOGOUT, request)


def logout_all(user: User, request=None) -> None:
    revoked = blacklist_all(user)
    log_event(user, AuthEventType.LOGOUT_ALL, request, revoked_sessions=revoked)


def _locale_of(user: User) -> str:
    profile = getattr(user, "profile", None)
    return profile.locale if profile else Locale.UZ
