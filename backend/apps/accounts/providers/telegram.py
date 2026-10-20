"""Telegram Login Widget: HMAC-SHA256, kalit = SHA256(BOT_TOKEN); `auth_date` va replay himoyasi."""

import hashlib
import hmac
import time
from collections.abc import Mapping
from typing import Any

from django.conf import settings
from django.core.cache import cache

from ..models import Provider
from .base import (
    AuthProvider,
    ProviderAuthExpired,
    ProviderAuthInvalid,
    ProviderAuthReplayed,
    ProviderIdentity,
    ProviderNotConfigured,
)

# Soatlar farqi uchun kichik zaxira (kelajakdagi `auth_date`).
CLOCK_SKEW_SECONDS = 30


# Widget imzolaydigan maydonlar; qolgan kalitlar (masalan, `locale`) imzoga kirmaydi.
SIGNED_FIELDS = ("id", "first_name", "last_name", "username", "photo_url", "auth_date")


def compute_hash(fields: Mapping[str, Any], bot_token: str) -> str:
    check_string = "\n".join(
        f"{key}={fields[key]}" for key in sorted(SIGNED_FIELDS) if fields.get(key) is not None
    )
    secret = hashlib.sha256(bot_token.encode()).digest()
    return hmac.new(secret, check_string.encode(), hashlib.sha256).hexdigest()


def _replay_key(digest: str) -> str:
    return f"auth:tg:{digest}"


class TelegramProvider(AuthProvider):
    provider = Provider.TELEGRAM

    def verify(self, payload: Mapping[str, Any]) -> ProviderIdentity:
        bot_token = settings.TELEGRAM_BOT_TOKEN
        if not bot_token:
            raise ProviderNotConfigured()
        sent = str(payload.get("hash", "")).lower()
        if not hmac.compare_digest(compute_hash(payload, bot_token), sent):
            raise ProviderAuthInvalid()
        age = time.time() - int(payload["auth_date"])
        max_age = settings.TELEGRAM_AUTH_MAX_AGE_SECONDS
        if age > max_age or age < -CLOCK_SKEW_SECONDS:
            raise ProviderAuthExpired()
        # Bir xil imzoni ikkinchi marta qabul qilmaymiz (kesib olingan so'rov).
        if not cache.add(_replay_key(sent), 1, timeout=max_age + CLOCK_SKEW_SECONDS):
            raise ProviderAuthReplayed()
        name = " ".join(
            part for part in (payload.get("first_name"), payload.get("last_name")) if part
        )
        return ProviderIdentity(
            provider=self.provider,
            uid=str(payload["id"]),
            display_name=name[:60],
            avatar_url=(payload.get("photo_url") or "")[:500],
        )
