"""Email bir martalik kodi: 6 xonali, muddatli, urinishlari cheklangan, faqat HMAC xeshi saqlanadi.

Kod bazada ochiq saqlanmaydi (6 xonali kodni oddiy xesh bilan tiklash oson, shuning uchun HMAC +
SECRET_KEY). Qayta so'rash cooldown'i cache'da; kod yaratish va xat yuborish Celery task'ida.
"""

import hashlib
import hmac
import math
import secrets
import time

from django.conf import settings
from django.core.cache import cache
from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import APIException, Throttled

from .models import AuthEvent, AuthEventType, Locale, OtpChallenge, User
from .services import client_meta

CODE_LENGTH = 6


class OtpInvalid(APIException):
    status_code = 400
    default_code = "invalid_code"
    default_detail = "The code is incorrect."


class OtpExpired(APIException):
    status_code = 400
    default_code = "code_expired"
    default_detail = "The code has expired."


class OtpLocked(Throttled):
    default_code = "otp_locked"
    default_detail = "Too many wrong attempts. Request a new code."


class OtpCooldown(Throttled):
    default_code = "otp_cooldown"
    default_detail = "A code was sent recently."


def normalize_email(email: str) -> str:
    return email.strip().lower()


def hash_code(email: str, code: str) -> str:
    key = settings.SECRET_KEY.encode()
    return hmac.new(key, f"otp:{email}:{code}".encode(), hashlib.sha256).hexdigest()


def _cooldown_key(email: str) -> str:
    return f"auth:otp:{hashlib.sha256(email.encode()).hexdigest()}"


def dev_inbox_key(email: str) -> str:
    return f"dev:otp:{email}"


def request_code(email: str, locale: str | None = None, request=None) -> None:
    """Doim bir xil ishlaydi (akkaunt bor-yo'qligi oshkor bo'lmaydi); xat Celery task'ida."""
    from .tasks import send_otp_email_task

    email = normalize_email(email)
    now = time.time()
    until = cache.get(_cooldown_key(email))
    if until and until > now:
        raise OtpCooldown(wait=math.ceil(until - now))
    cooldown = settings.OTP_RESEND_COOLDOWN_SECONDS
    cache.set(_cooldown_key(email), now + cooldown, timeout=cooldown)
    meta = client_meta(request)
    transaction.on_commit(lambda: send_otp_email_task.delay(email, locale, meta))


def send_code(email: str, locale: str | None = None, meta: dict | None = None) -> None:
    """Celery task ichida: oldingi kodlarni bekor qilib, yangisini yaratadi va yuboradi."""
    from .emails import send_otp_email

    code = f"{secrets.randbelow(10**CODE_LENGTH):0{CODE_LENGTH}d}"
    now = timezone.now()
    user = User.objects.select_related("profile").filter(email=email, is_active=True).first()
    profile = getattr(user, "profile", None)
    with transaction.atomic():
        OtpChallenge.objects.filter(email=email, consumed_at__isnull=True).update(consumed_at=now)
        OtpChallenge.objects.create(
            email=email, code_hash=hash_code(email, code), expires_at=now + settings.OTP_TTL
        )
    if settings.OTP_DEV_INBOX:
        cache.set(dev_inbox_key(email), code, timeout=15 * 60)
    send_otp_email(to=email, code=code, locale=profile.locale if profile else locale or Locale.UZ)
    AuthEvent.objects.create(user=user, type=AuthEventType.OTP_SENT, **(meta or client_meta(None)))


def verify_code(email: str, code: str) -> str:
    """Kodni tekshiradi va sarflaydi; tasdiqlangan (normallashgan) emailni qaytaradi."""
    email = normalize_email(email)
    error: APIException | None = None
    # Xato urinish hisobi tranzaksiya qaytishidan saqlansin: xatoni blokdan keyin ko'taramiz.
    with transaction.atomic():
        challenge = (
            OtpChallenge.objects.select_for_update()
            .filter(email=email, consumed_at__isnull=True)
            .order_by("-created_at")
            .first()
        )
        now = timezone.now()
        if challenge is None:
            error = OtpInvalid()
        elif challenge.expires_at <= now:
            error = OtpExpired()
        elif challenge.attempts >= settings.OTP_MAX_ATTEMPTS:
            error = OtpLocked()
        else:
            challenge.attempts += 1
            if hmac.compare_digest(challenge.code_hash, hash_code(email, str(code))):
                challenge.consumed_at = now
            elif challenge.attempts >= settings.OTP_MAX_ATTEMPTS:
                error = OtpLocked()
            else:
                error = OtpInvalid()
            challenge.save(update_fields=["attempts", "consumed_at"])
    if error is not None:
        raise error
    return email
