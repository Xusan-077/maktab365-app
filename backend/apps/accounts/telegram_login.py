"""Telegram bot orqali kirish (deep-link; Login Widget emas).

Oqim:
1. `start()` — sayt bir martalik `token` (32 bayt) va brauzerga bog'lanadigan `nonce` oladi; keshda
   (Redis) `TELEGRAM_LOGIN_TTL_SECONDS` ga `pending` yozuv. Foydalanuvchi
   `t.me/<bot>?start=<token>` ni ochadi.
2. Bot webhook'i `/start <token>` ni oladi → `handle_update()` yozuvni `confirmed` qiladi va
   yuboruvchining Telegram ma'lumotini saqlaydi (javob xabari webhook javobining o'zida).
3. Sayt `status()` ni so'raydi; `confirmed` bo'lgach `complete()` yozuvni bir martalik o'chiradi va
   Telegram shaxsini qaytaradi (sessiyani view `social_services.sign_in` bilan beradi).

Keshda token va nonce'ning faqat SHA-256 xeshi saqlanadi. `status()`/`complete()` nonce'siz
yoki boshqa nonce bilan 403 — havolani ko'rgan begona brauzer sessiyani ololmaydi.
"""

import hashlib
import hmac
import re
import secrets
import time
from collections.abc import Mapping
from dataclasses import dataclass
from typing import Any

from django.conf import settings
from django.core.cache import cache
from rest_framework.exceptions import APIException

from .models import Provider
from .providers import ProviderIdentity
from .providers.base import ProviderNotConfigured

PENDING = "pending"
CONFIRMED = "confirmed"
EXPIRED = "expired"

# `secrets.token_urlsafe(32)` — 43 belgi [A-Za-z0-9_-]: Telegram `start` parametriga mos (≤ 64).
TOKEN_BYTES = 32
NONCE_COOKIE = "tg_nonce"
NONCE_HEADER = "X-Telegram-Nonce"

CONFIRMED_TEXT = "✅ Tasdiqlandi. Saytga qayting."
EXPIRED_TEXT = "Havola eskirgan, saytdan qayta urinib ko'ring."
HINT_TEXT = "Kirish uchun saytda «Telegram bilan kirish» tugmasini bosing."

_START = re.compile(r"^/start(?:@\w+)?(?:\s+(\S+))?\s*$")


class LoginNonceMismatch(APIException):
    status_code = 403
    default_code = "telegram_nonce_mismatch"
    default_detail = "This sign-in link was started in another browser."


class LoginExpired(APIException):
    status_code = 410
    default_code = "telegram_login_expired"
    default_detail = "The sign-in link has expired."


class LoginPending(APIException):
    status_code = 409
    default_code = "telegram_login_pending"
    default_detail = "The sign-in has not been confirmed in Telegram yet."


@dataclass(frozen=True)
class LoginStart:
    token: str
    nonce: str
    bot_url: str
    expires_in: int


def _digest(value: str) -> str:
    return hashlib.sha256(value.encode()).hexdigest()


def _key(token: str) -> str:
    return f"auth:tglogin:{_digest(token)}"


def is_configured() -> bool:
    return bool(settings.TELEGRAM_BOT_USERNAME and settings.TELEGRAM_WEBHOOK_SECRET)


def start() -> LoginStart:
    if not is_configured():
        raise ProviderNotConfigured()
    token = secrets.token_urlsafe(TOKEN_BYTES)
    nonce = secrets.token_urlsafe(TOKEN_BYTES)
    ttl = settings.TELEGRAM_LOGIN_TTL_SECONDS
    entry = {"status": PENDING, "nonce": _digest(nonce), "expires_at": time.time() + ttl}
    cache.set(_key(token), entry, timeout=ttl)
    return LoginStart(
        token=token,
        nonce=nonce,
        bot_url=f"https://t.me/{settings.TELEGRAM_BOT_USERNAME}?start={token}",
        expires_in=ttl,
    )


def _entry(token: str, nonce: str) -> dict | None:
    """Yozuv (yo'q/eskirgan bo'lsa `None`); nonce mos kelmasa — 403."""
    entry = cache.get(_key(token)) if token else None
    if entry is None:
        return None
    if not nonce or not hmac.compare_digest(entry["nonce"], _digest(nonce)):
        raise LoginNonceMismatch()
    return entry


def status(token: str, nonce: str) -> str:
    entry = _entry(token, nonce)
    return EXPIRED if entry is None else entry["status"]


def complete(token: str, nonce: str) -> ProviderIdentity:
    """Tasdiqlangan yozuvni bir martalik iste'mol qiladi va Telegram shaxsini qaytaradi."""
    entry = _entry(token, nonce)
    if entry is None:
        raise LoginExpired()
    if entry["status"] != CONFIRMED:
        raise LoginPending()
    # O'chirishni faqat bitta so'rov yutadi (Redis DEL atomar): token ikkinchi marta ishlamaydi.
    if not cache.delete(_key(token)):
        raise LoginExpired()
    sender = entry["telegram"]
    name = " ".join(part for part in (sender.get("first_name"), sender.get("last_name")) if part)
    return ProviderIdentity(
        provider=Provider.TELEGRAM, uid=str(sender["id"]), display_name=name[:60]
    )


def confirm(token: str, sender: Mapping[str, Any]) -> bool:
    """`/start <token>`: kutilayotgan yozuvni yuboruvchi nomidan tasdiqlaydi."""
    key = _key(token)
    entry = cache.get(key)
    if entry is None or entry["status"] != PENDING:
        return False
    remaining = int(entry["expires_at"] - time.time())
    if remaining <= 0:
        return False
    entry["status"] = CONFIRMED
    entry["telegram"] = {
        "id": int(sender["id"]),
        "first_name": str(sender.get("first_name") or "")[:255],
        "last_name": str(sender.get("last_name") or "")[:255],
        "username": str(sender.get("username") or "")[:255],
    }
    cache.set(key, entry, timeout=remaining)
    return True


def handle_update(update: Mapping[str, Any]) -> dict | None:
    """Telegram update → webhook javobida bajariladigan `sendMessage` (yoki `None` — javobsiz)."""
    message = update.get("message") if isinstance(update, Mapping) else None
    if not isinstance(message, Mapping):
        return None
    chat = message.get("chat") or {}
    sender = message.get("from") or {}
    text = message.get("text")
    if chat.get("type") != "private" or not sender.get("id") or sender.get("is_bot"):
        return None
    match = _START.match(text) if isinstance(text, str) else None
    if match is None:
        return None
    token = match.group(1)
    if token is None:
        reply = HINT_TEXT
    else:
        reply = CONFIRMED_TEXT if confirm(token, sender) else EXPIRED_TEXT
    return {"method": "sendMessage", "chat_id": chat["id"], "text": reply}


def webhook_secret_valid(sent: str) -> bool:
    secret = settings.TELEGRAM_WEBHOOK_SECRET
    return bool(secret) and hmac.compare_digest(sent.encode(), secret.encode())
