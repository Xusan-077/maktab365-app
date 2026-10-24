import hashlib

from rest_framework.settings import api_settings
from rest_framework.throttling import AnonRateThrottle, SimpleRateThrottle, UserRateThrottle

from .net import client_ip


class _ClientIpMixin:
    """DRF `get_ident` xom `X-Forwarded-For` ni oladi; o'rniga `net.client_ip`."""

    def get_ident(self, request):
        return client_ip(request) or "unknown"


class AnonBurstThrottle(_ClientIpMixin, AnonRateThrottle):
    scope = "anon"


class UserBurstThrottle(_ClientIpMixin, UserRateThrottle):
    scope = "user"


class _LiveRateMixin:
    """Tezlik har so'rovda sozlamadan o'qiladi (DRF klass atributida eski qiymat qolmasin)."""

    def get_rate(self):
        return api_settings.DEFAULT_THROTTLE_RATES.get(self.scope)


class AuthRateThrottle(_ClientIpMixin, _LiveRateMixin, AnonRateThrottle):
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


class SupportRateThrottle(_ClientIpMixin, _LiveRateMixin, AnonRateThrottle):
    """Yordam murojaatlari: IP bo'yicha (kirgan foydalanuvchi ham)."""

    scope = "support"

    def get_cache_key(self, request, view):
        return self.cache_format % {"scope": self.scope, "ident": self.get_ident(request)}


class SupportBurstThrottle(SupportRateThrottle):
    """Yordam murojaatlari: ketma-ket yuborishga qarshi qisqa oyna (`support_burst`, IP)."""

    scope = "support_burst"


class PdfUploadThrottle(_LiveRateMixin, UserRateThrottle):
    """Admin PDF yuklash endpointlari: kirgan foydalanuvchi bo'yicha."""

    scope = "pdf_upload"


class StatsThrottle(_ClientIpMixin, _LiveRateMixin, AnonRateThrottle):
    """Anonim statistika hodisalari: IP bo'yicha (o'qish paytida sahifa-sahifa yuboriladi)."""

    scope = "stats"

    def get_cache_key(self, request, view):
        return self.cache_format % {"scope": self.scope, "ident": self.get_ident(request)}
