"""Kirish provayderlari uchun umumiy interfeys: `verify(payload) -> ProviderIdentity`.

Har provayder alohida modul. Ular faqat tashqi isbotni (id_token, imzo, kod) tekshiradi va
tasdiqlangan shaxsni qaytaradi; akkaunt bilan bog'lash `social_services.py` da.
"""

from abc import ABC, abstractmethod
from collections.abc import Mapping
from dataclasses import dataclass
from typing import Any, ClassVar

from rest_framework.exceptions import APIException


class ProviderAuthInvalid(APIException):
    status_code = 401
    default_code = "provider_auth_invalid"
    default_detail = "Provider credentials are invalid."


class ProviderAuthExpired(APIException):
    status_code = 401
    default_code = "provider_auth_expired"
    default_detail = "Provider credentials have expired."


class ProviderAuthReplayed(APIException):
    status_code = 401
    default_code = "provider_auth_replayed"
    default_detail = "Provider credentials were already used."


class ProviderEmailUnverified(APIException):
    status_code = 401
    default_code = "provider_email_unverified"
    default_detail = "The provider did not verify this email address."


class ProviderNotConfigured(APIException):
    status_code = 503
    default_code = "provider_not_configured"
    default_detail = "This sign-in method is not available."


@dataclass(frozen=True)
class ProviderIdentity:
    provider: str
    uid: str
    # Faqat provayder tasdiqlagan email (`email_verified=True`) bog'lashda hisobga olinadi.
    email: str | None = None
    email_verified: bool = False
    display_name: str = ""
    avatar_url: str = ""
    # Bot orqali tasdiqlangan telefon (+998XXXXXXXXX); faqat Telegram bot oqimida.
    phone: str = ""


class AuthProvider(ABC):
    provider: ClassVar[str]

    @abstractmethod
    def verify(self, payload: Mapping[str, Any]) -> ProviderIdentity:
        """Isbotni tekshiradi; yaroqsiz bo'lsa `ProviderAuth*` xatosini ko'taradi."""
