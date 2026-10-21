"""
Ochiq kontent keshi: javob tanasi Redis'da, kalit kontent versiyasiga bog'liq. Kontent
(fan/kitob/bob/mavzu) o'zgarsa versiya almashadi va eski kalitlar o'z-o'zidan eskiradi.
"""

import hashlib
import time
from functools import wraps

from django.conf import settings
from django.core.cache import cache
from django.http import HttpResponse
from rest_framework.renderers import JSONRenderer
from rest_framework.response import Response

VERSION_KEY = "content:version"
ENTRY_TTL = 60 * 60


def content_version() -> int:
    version = cache.get(VERSION_KEY)
    if version is None:
        version = time.time_ns()
        cache.set(VERSION_KEY, version, None)
    return version


def bump_content_version() -> None:
    """Kontent o'zgardi (nashr, tahrir, import): barcha keshlangan javoblar yaroqsiz."""
    cache.set(VERSION_KEY, time.time_ns(), None)


def _cache_key(request, show_drafts: bool) -> str:
    # Til (Accept-Language/?locale=) qidiruv snippetiga ta'sir qiladi.
    query = request.META.get("QUERY_STRING", "")
    raw = f"{request.path}?{query}|{request_locale(request)}|{show_drafts}"
    return f"content:v{content_version()}:{hashlib.sha1(raw.encode()).hexdigest()}"  # noqa: S324


def request_locale(request) -> str:
    """`?locale=` yoki `Accept-Language` (uz/ru/en); default `uz`."""
    wanted = request.query_params.get("locale") if hasattr(request, "query_params") else None
    if not wanted:
        header = request.META.get("HTTP_ACCEPT_LANGUAGE", "")
        wanted = header.split(",")[0].split(";")[0].split("-")[0].strip().lower() if header else ""
    return wanted if wanted in ("uz", "ru", "en") else "uz"


def is_staff(user) -> bool:
    return bool(
        user
        and user.is_authenticated
        and (user.is_staff or getattr(user, "role", "") in ("editor", "admin"))
    )


def show_drafts(request) -> bool:
    """Draft/reviewed mavzular ko'rinadimi: staff yoki `SHOW_DRAFTS_PUBLICLY`."""
    return is_staff(request.user) or settings.SHOW_DRAFTS_PUBLICLY


def _etag_matches(header: str, etag: str) -> bool:
    candidates = {part.strip().removeprefix("W/") for part in header.split(",")}
    return "*" in candidates or etag in candidates


def public_cached(get):
    """GET metodini keshlaydi: Redis (versiyaga bog'liq), ETag/If-None-Match va qisqa Cache-Control.

    Staff javobi (draftlar bilan) keshlanmaydi va `private`.
    """

    @wraps(get)
    def wrapper(self, request, *args, **kwargs):
        if is_staff(request.user):
            response = get(self, request, *args, **kwargs)
            response["Cache-Control"] = "private, no-store"
            response["Vary"] = "Authorization"
            return response

        key = _cache_key(request, settings.SHOW_DRAFTS_PUBLICLY)
        entry = cache.get(key)
        if entry is None:
            response = get(self, request, *args, **kwargs)
            if response.status_code != 200:
                return response
            body = JSONRenderer().render(response.data)
            entry = (body, '"' + hashlib.sha1(body).hexdigest() + '"')  # noqa: S324
            cache.set(key, entry, ENTRY_TTL)
        body, etag = entry
        headers = {
            "ETag": etag,
            "Cache-Control": f"public, max-age={settings.CONTENT_CACHE_MAX_AGE}",
            "Vary": "Authorization, Accept-Language",
        }
        if _etag_matches(request.META.get("HTTP_IF_NONE_MATCH", ""), etag):
            return Response(status=304, headers=headers)
        response = HttpResponse(body, content_type="application/json")
        for name, value in headers.items():
            response[name] = value
        return response

    return wrapper
