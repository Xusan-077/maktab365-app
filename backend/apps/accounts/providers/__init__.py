from ..models import Provider
from .base import AuthProvider, ProviderIdentity
from .email_otp import EmailOtpProvider
from .google import GoogleProvider
from .telegram import TelegramProvider

_PROVIDERS: dict[str, AuthProvider] = {
    Provider.GOOGLE: GoogleProvider(),
    Provider.TELEGRAM: TelegramProvider(),
    Provider.EMAIL_OTP: EmailOtpProvider(),
}


def get_provider(name: str) -> AuthProvider | None:
    return _PROVIDERS.get(name)


__all__ = ["AuthProvider", "ProviderIdentity", "get_provider"]
