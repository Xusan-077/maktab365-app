from collections.abc import Mapping
from typing import Any

from .. import otp_services
from ..models import Provider
from .base import AuthProvider, ProviderIdentity


class EmailOtpProvider(AuthProvider):
    provider = Provider.EMAIL_OTP

    def verify(self, payload: Mapping[str, Any]) -> ProviderIdentity:
        email = otp_services.verify_code(payload["email"], payload["code"])
        return ProviderIdentity(provider=self.provider, uid=email, email=email, email_verified=True)
