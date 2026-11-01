"""PDF o'qish URL'larini berish himoyasi (ikkala kutubxona uchun umumiy).

- tezlik chegarasi: IP bo'yicha va (kirgan bo'lsa) foydalanuvchi bo'yicha alohida;
- ketma-ket ko'p so'rov (skrapping belgisi) `file_url_burst` ogohlantirishi bilan loglanadi;
- boshqa saytdan (hotlink) kelgan brauzer so'rovi (`Origin`/`Referer`) rad etiladi.
  Next serveridan (BFF) kelgan so'rovda bu sarlavhalar bo'lmaydi — ular o'tadi.
"""

from urllib.parse import urlsplit

import structlog
from django.conf import settings
from django.core.cache import cache
from rest_framework.exceptions import APIException
from rest_framework.throttling import SimpleRateThrottle

from .net import client_ip
from .throttling import _LiveRateMixin

logger = structlog.get_logger(__name__)

BURST_WINDOW_SECONDS = 60


class OriginNotAllowed(APIException):
    status_code = 403
    default_code = "origin_not_allowed"
    default_detail = "Origin is not allowed."


class FileUrlIpThrottle(_LiveRateMixin, SimpleRateThrottle):
    scope = "file_url_ip"

    def get_cache_key(self, request, view):
        ident = client_ip(request) or "unknown"
        return self.cache_format % {"scope": self.scope, "ident": ident}


class FileUrlUserThrottle(_LiveRateMixin, SimpleRateThrottle):
    scope = "file_url_user"

    def get_cache_key(self, request, view):
        user = getattr(request, "user", None)
        if not user or not user.is_authenticated:
            return None
        return self.cache_format % {"scope": self.scope, "ident": str(user.pk)}


FILE_URL_THROTTLES = [FileUrlIpThrottle, FileUrlUserThrottle]


def _allowed_hosts() -> set[str]:
    origins = [*settings.CORS_ALLOWED_ORIGINS, settings.FRONTEND_URL]
    return {urlsplit(o).netloc for o in origins if o}


def check_origin(request) -> None:
    """Brauzer `Origin`/`Referer` yuborgan bo'lsa, u sayt domenlaridan biri bo'lishi shart."""
    for header in ("HTTP_ORIGIN", "HTTP_REFERER"):
        value = request.META.get(header, "")
        if value and urlsplit(value).netloc not in _allowed_hosts():
            logger.warning("file_url_foreign_origin", origin=value[:200], ip=client_ip(request))
            raise OriginNotAllowed


def log_file_url(request, kind: str, book_id) -> None:
    """Har berilgan URL loglanadi; bir IP daqiqada `FILE_URL_BURST_LOG` dan oshsa ogohlantirish."""
    ip = client_ip(request) or "unknown"
    key = f"file-url-burst:{ip}"
    cache.add(key, 0, BURST_WINDOW_SECONDS)
    try:
        count = cache.incr(key)
    except ValueError:
        count = 1
    user = getattr(request, "user", None)
    user_id = str(user.pk) if user is not None and user.is_authenticated else None
    event = logger.warning if count > settings.FILE_URL_BURST_LOG else logger.info
    event(
        "file_url_burst" if count > settings.FILE_URL_BURST_LOG else "file_url_issued",
        kind=kind,
        book=str(book_id),
        ip=ip,
        user=user_id,
        count_last_minute=count,
    )
