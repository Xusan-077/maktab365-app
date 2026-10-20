from collections.abc import Mapping
from typing import Any

from django.conf import settings
from google.auth.exceptions import GoogleAuthError
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token

from ..models import Provider
from .base import (
    AuthProvider,
    ProviderAuthExpired,
    ProviderAuthInvalid,
    ProviderEmailUnverified,
    ProviderIdentity,
    ProviderNotConfigured,
)

# Sertifikatlar keshi shu sessiyada saqlanadi.
_request = google_requests.Request()


class GoogleProvider(AuthProvider):
    provider = Provider.GOOGLE

    def verify(self, payload: Mapping[str, Any]) -> ProviderIdentity:
        client_id = settings.GOOGLE_CLIENT_ID
        if not client_id:
            raise ProviderNotConfigured()
        try:
            # Imzo, `aud` (== client_id), `iss` (accounts.google.com) va `exp` tekshiriladi.
            claims = id_token.verify_oauth2_token(payload["id_token"], _request, client_id)
        except GoogleAuthError as exc:
            if "expired" in str(exc).lower():
                raise ProviderAuthExpired() from exc
            raise ProviderAuthInvalid() from exc
        except ValueError as exc:
            raise ProviderAuthInvalid() from exc
        uid, email = claims.get("sub"), claims.get("email")
        if not uid or not email:
            raise ProviderAuthInvalid()
        if claims.get("email_verified") is not True:
            raise ProviderEmailUnverified()
        return ProviderIdentity(
            provider=self.provider,
            uid=str(uid),
            email=email,
            email_verified=True,
            display_name=(claims.get("name") or "")[:60],
            avatar_url=(claims.get("picture") or "")[:500],
        )
