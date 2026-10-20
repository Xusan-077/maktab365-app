"""Mijoz IP manzili: `X-Forwarded-For` ga ko'r-ko'rona ishonilmaydi (throttle'ni chetlab o'tish).

- So'rov Next serveridan (BFF/Auth.js) kelgan bo'lsa — `X-Forwarded-Secret` sarlavhasi
  `FORWARDED_IP_SECRET` ga teng — u yuborgan `X-Forwarded-For` (bitta qiymat) ishlatiladi.
- Aks holda: `TRUSTED_PROXY_HOPS` ta ishonchli proxy qo'shgan o'ngdagi yozuv yoki `REMOTE_ADDR`.
"""

import ipaddress

from django.conf import settings
from django.utils.crypto import constant_time_compare


def _valid_ip(value: str | None) -> str | None:
    if not value:
        return None
    try:
        return str(ipaddress.ip_address(value.strip()))
    except ValueError:
        return None


def _forwarded(request) -> list[str]:
    raw = request.META.get("HTTP_X_FORWARDED_FOR", "")
    return [part.strip() for part in raw.split(",") if part.strip()]


def is_trusted_forwarder(request) -> bool:
    secret = getattr(settings, "FORWARDED_IP_SECRET", "")
    sent = request.META.get("HTTP_X_FORWARDED_SECRET", "")
    return bool(secret) and constant_time_compare(sent, secret)


def client_ip(request) -> str | None:
    if request is None:
        return None
    chain = _forwarded(request)
    if chain and is_trusted_forwarder(request):
        ip = _valid_ip(chain[-1])
        if ip:
            return ip
    hops = getattr(settings, "TRUSTED_PROXY_HOPS", 0)
    if hops and len(chain) >= hops:
        ip = _valid_ip(chain[-hops])
        if ip:
            return ip
    return _valid_ip(request.META.get("REMOTE_ADDR"))
