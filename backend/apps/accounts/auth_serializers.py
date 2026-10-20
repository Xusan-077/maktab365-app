"""`/api/v1/auth/*` so'rov va javob sxemalari.

Parol va email maydon xatolari `details` ichida **kod** sifatida qaytadi (`email_taken`,
`password_too_short`, `invalid_password`…) — foydalanuvchiga matnni frontend i18n tanlaydi.
"""

from rest_framework import serializers

from .models import Identity, Locale
from .serializers import MeSerializer

PASSWORD_MAX = 128


def password_field(**kwargs):
    return serializers.CharField(
        write_only=True, max_length=PASSWORD_MAX, trim_whitespace=False, **kwargs
    )


class RegisterSerializer(serializers.Serializer):
    email = serializers.EmailField(max_length=254)
    password = password_field()
    display_name = serializers.CharField(max_length=60, required=False, allow_blank=True)
    # Xatlar tili (frontend joriy tili); profilga yoziladi.
    locale = serializers.ChoiceField(choices=Locale.choices, required=False)


class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField(max_length=254)
    password = password_field()


class RefreshSerializer(serializers.Serializer):
    refresh = serializers.CharField()


class AuthTokensSerializer(serializers.Serializer):
    access = serializers.CharField()
    refresh = serializers.CharField()


class AuthSessionSerializer(AuthTokensSerializer):
    user = MeSerializer()
    is_new = serializers.BooleanField()


class TokenSerializer(serializers.Serializer):
    token = serializers.CharField(max_length=200)


class EmailSerializer(serializers.Serializer):
    email = serializers.EmailField(max_length=254)


class PasswordResetSerializer(serializers.Serializer):
    token = serializers.CharField(max_length=200)
    password = password_field()


class PasswordChangeSerializer(serializers.Serializer):
    # Parolsiz akkaunt (masalan, Google) uchun ixtiyoriy.
    current_password = password_field(required=False, allow_blank=True)
    new_password = password_field()
    # Joriy sessiya refresh'i: u saqlanadi, boshqa sessiyalar chiqariladi.
    refresh = serializers.CharField(required=False, allow_blank=True)


class OkSerializer(serializers.Serializer):
    ok = serializers.BooleanField()


# --- Google / Telegram / email OTP ---


class _LocaleMixin(serializers.Serializer):
    # Yangi akkaunt profili va OTP xati tili (frontend joriy tili); provayder isbotiga kirmaydi.
    locale = serializers.ChoiceField(choices=Locale.choices, required=False)


class GoogleAuthSerializer(_LocaleMixin):
    id_token = serializers.CharField(max_length=4096)


class TelegramAuthSerializer(_LocaleMixin):
    """Telegram Login Widget qaytargan maydonlar (imzo tekshiruvi providers/telegram.py da)."""

    id = serializers.IntegerField(min_value=1)
    first_name = serializers.CharField(max_length=255, allow_blank=False)
    last_name = serializers.CharField(max_length=255, required=False, allow_blank=False)
    username = serializers.CharField(max_length=255, required=False, allow_blank=False)
    photo_url = serializers.CharField(max_length=500, required=False, allow_blank=False)
    auth_date = serializers.IntegerField(min_value=1)
    hash = serializers.RegexField(r"^[0-9a-fA-F]{64}$")


class OtpRequestSerializer(_LocaleMixin):
    email = serializers.EmailField(max_length=254)


class OtpVerifySerializer(_LocaleMixin):
    email = serializers.EmailField(max_length=254)
    code = serializers.RegexField(r"^\d{6}$", max_length=6)


class IdentitySerializer(serializers.ModelSerializer):
    class Meta:
        model = Identity
        fields = ["id", "provider", "email", "verified", "created_at"]
        read_only_fields = fields


class IdentityListSerializer(serializers.Serializer):
    identities = IdentitySerializer(many=True)
    has_password = serializers.BooleanField()


class PasswordSetSerializer(serializers.Serializer):
    new_password = password_field()
