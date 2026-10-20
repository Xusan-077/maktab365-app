import hashlib

from rest_framework.settings import api_settings
from rest_framework.throttling import AnonRateThrottle, SimpleRateThrottle, UserRateThrottle


class AnonBurstThrottle(AnonRateThrottle):
    scope = "anon"


class UserBurstThrottle(UserRateThrottle):
    scope = "user"


class _LiveRateMixin:
    """Tezlik har so'rovda sozlamadan o'qiladi (DRF klass atributida eski qiymat qolmasin)."""

    def get_rate(self):
        return api_settings.DEFAULT_THROTTLE_RATES.get(self.scope)


class AuthRateThrottle(_LiveRateMixin, AnonRateThrottle):
    """Kirish/ro'yxatdan o'tish kabi sezgir endpoint'lar uchun (IP bo'yicha qattiqroq)."""

    scope = "auth"

    def get_cache_key(self, request, view):
        # Kirgan foydalanuvchi uchun ham IP bo'yicha (AnonRateThrottle ularni o'tkazib yuboradi).
        return self.cache_format % {"scope": self.scope, "ident": self.get_ident(request)}


class AuthEmailThrottle(_LiveRateMixin, SimpleRateThrottle):
    """Bir email manziliga qarshi urinishlar (IP almashtirib parol tanlashdan himoya)."""

    scope = "auth_email"

    def get_cache_key(self, request, view):
        email = request.data.get("email") if hasattr(request.data, "get") else None
        if not isinstance(email, str) or not email.strip():
            return None
        ident = hashlib.sha256(email.strip().lower().encode()).hexdigest()
        return self.cache_format % {"scope": self.scope, "ident": ident}
