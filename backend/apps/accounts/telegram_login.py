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

import structlog
from django.conf import settings
from django.core.cache import cache
from rest_framework.exceptions import APIException

from .models import Provider
from .providers import ProviderIdentity
from .providers.base import ProviderNotConfigured

PENDING = "pending"
CONFIRMED = "confirmed"
EXPIRED = "expired"
# Ichki holat: `/start` bosildi, bot telefon raqamini kutmoqda. API'da `pending` ko'rinadi.
AWAITING_PHONE = "awaiting_phone"

# `secrets.token_urlsafe(32)` — 43 belgi [A-Za-z0-9_-]: Telegram `start` parametriga mos (≤ 64).
TOKEN_BYTES = 32
NONCE_COOKIE = "tg_nonce"
NONCE_HEADER = "X-Telegram-Nonce"

CONFIRMED_TEXT = "✅ Tasdiqlandi. Saytga qayting."
EXPIRED_TEXT = "Havola eskirgan, saytdan qayta urinib ko'ring."
PHONE_PROMPT_TEXT = "Kirishni tugatish uchun pastdagi tugma orqali telefon raqamingizni yuboring."
PHONE_BUTTON_TEXT = "📱 Raqamni yuborish"
PHONE_DONE_TEXT = "✅ Raqam qabul qilindi. Saytga qayting."
PHONE_FOREIGN_TEXT = "Faqat o'zingizning raqamingizni yuborishingiz mumkin (tugma orqali)."
PHONE_INVALID_TEXT = "Faqat O'zbekiston raqamlari (+998…) qabul qilinadi."
PHONE_NONE_TEXT = "Kutilayotgan kirish topilmadi. Saytdan qayta urinib ko'ring."
HINT_TEXT = "Kirish uchun saytda «Telegram bilan kirish» tugmasini bosing."

log = structlog.get_logger()

_PHONE = re.compile(r"^998\d{9}$")
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


def normalize_phone(raw: object) -> str | None:
    """`+998 90 123-45-67`, `998901234567`, `901234567` → `+998901234567`; boshqasi — `None`."""
    digits = re.sub(r"\D", "", raw) if isinstance(raw, str) else ""
    if len(digits) == 9:
        digits = f"998{digits}"
    return f"+{digits}" if _PHONE.match(digits) else None


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


def _phone_key(telegram_id: int) -> str:
    return f"auth:tgphone:{telegram_id}"


def start(*, with_phone: bool = False) -> LoginStart:
    """`with_phone`: `/start` dan keyin bot telefon raqamini ham so'raydi."""
    if not is_configured():
        raise ProviderNotConfigured()
    token = secrets.token_urlsafe(TOKEN_BYTES)
    nonce = secrets.token_urlsafe(TOKEN_BYTES)
    ttl = settings.TELEGRAM_LOGIN_TTL_SECONDS
    entry = {
        "status": PENDING,
        "nonce": _digest(nonce),
        "expires_at": time.time() + ttl,
        "with_phone": with_phone,
    }
    cache.set(_key(token), entry, timeout=ttl)
    log.info("telegram_login_created", key=_digest(token)[:12])
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
    if entry is None:
        return EXPIRED
    return PENDING if entry["status"] == AWAITING_PHONE else entry["status"]


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
        provider=Provider.TELEGRAM,
        uid=str(sender["id"]),
        display_name=name[:60],
        phone=entry.get("phone", ""),
    )


def confirm(token: str, sender: Mapping[str, Any]) -> str | None:
    """`/start <token>`: kutilayotgan yozuvni yuboruvchi nomidan tasdiqlaydi.

    `CONFIRMED` | `AWAITING_PHONE` (telefon so'ralgan kirish) | `None` (token yo'q/eskirgan).
    """
    key = _key(token)
    entry = cache.get(key)
    if entry is None or entry["status"] != PENDING:
        return None
    remaining = int(entry["expires_at"] - time.time())
    if remaining <= 0:
        return None
    entry["status"] = AWAITING_PHONE if entry.get("with_phone") else CONFIRMED
    entry["telegram"] = {
        "id": int(sender["id"]),
        "first_name": str(sender.get("first_name") or "")[:255],
        "last_name": str(sender.get("last_name") or "")[:255],
        "username": str(sender.get("username") or "")[:255],
    }
    cache.set(key, entry, timeout=remaining)
    if entry["status"] == AWAITING_PHONE:
        # Kontakt xabarida token yo'q: yuboruvchi id bo'yicha yozuvga qaytiladi.
        cache.set(_phone_key(entry["telegram"]["id"]), key, timeout=remaining)
    return entry["status"]


def _handle_contact(message: Mapping[str, Any], sender: Mapping[str, Any], chat_id: Any) -> dict:
    """`request_contact` javobi: raqam faqat yuboruvchining o'zi bo'lsa qabul qilinadi."""

    def reply(text: str, *, remove_keyboard: bool = False) -> dict:
        out: dict = {"method": "sendMessage", "chat_id": chat_id, "text": text}
        if remove_keyboard:
            out["reply_markup"] = {"remove_keyboard": True}
        return out

    contact = message.get("contact")
    if not isinstance(contact, Mapping) or contact.get("user_id") != sender["id"]:
        return reply(PHONE_FOREIGN_TEXT)
    phone = normalize_phone(contact.get("phone_number"))
    if phone is None:
        return reply(PHONE_INVALID_TEXT, remove_keyboard=True)
    pointer = cache.get(_phone_key(sender["id"]))
    entry = cache.get(pointer) if pointer else None
    remaining = int(entry["expires_at"] - time.time()) if entry else 0
    if entry is None or entry["status"] != AWAITING_PHONE or remaining <= 0:
        return reply(PHONE_NONE_TEXT, remove_keyboard=True)
    entry["status"] = CONFIRMED
    entry["phone"] = phone
    cache.set(pointer, entry, timeout=remaining)
    cache.delete(_phone_key(sender["id"]))
    log.info("telegram_login_phone", key=pointer.rsplit(":", 1)[-1][:12])
    return reply(PHONE_DONE_TEXT, remove_keyboard=True)


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
    if message.get("contact") is not None:
        return _handle_contact(message, sender, chat["id"])
    match = _START.match(text) if isinstance(text, str) else None
    if match is None:
        return None
    token = match.group(1)
    if token is None:
        reply = HINT_TEXT
    else:
        state = confirm(token, sender)
        # Diagnostika: token emas, faqat xeshining boshi (start'dagi `key` bilan solishtiriladi).
        log.info("telegram_login_start", key=_digest(token)[:12], confirmed=state is not None)
        if state == AWAITING_PHONE:
            return {
                "method": "sendMessage",
                "chat_id": chat["id"],
                "text": PHONE_PROMPT_TEXT,
                "reply_markup": {
                    "keyboard": [[{"text": PHONE_BUTTON_TEXT, "request_contact": True}]],
                    "resize_keyboard": True,
                    "one_time_keyboard": True,
                },
            }
        reply = CONFIRMED_TEXT if state else EXPIRED_TEXT
    return {"method": "sendMessage", "chat_id": chat["id"], "text": reply}


def webhook_secret_valid(sent: str) -> bool:
    secret = settings.TELEGRAM_WEBHOOK_SECRET
    return bool(secret) and hmac.compare_digest(sent.encode(), secret.encode())
