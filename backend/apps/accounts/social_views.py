from drf_spectacular.utils import PolymorphicProxySerializer, extend_schema
from rest_framework import status
from rest_framework.exceptions import NotFound
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.core.throttling import AuthRateThrottle

from . import otp_services, social_services
from .auth_serializers import (
    AuthSessionSerializer,
    GoogleAuthSerializer,
    IdentityListSerializer,
    IdentitySerializer,
    OkSerializer,
    OtpRequestSerializer,
    OtpVerifySerializer,
    PasswordSetSerializer,
    TelegramAuthSerializer,
)
from .auth_views import OK, PublicAuthView, session_response, validated
from .models import Provider
from .providers import get_provider

PROVIDER_SERIALIZERS = {
    Provider.GOOGLE: GoogleAuthSerializer,
    Provider.TELEGRAM: TelegramAuthSerializer,
    Provider.EMAIL_OTP: OtpVerifySerializer,
}


def provider_identity(provider: str, data: dict):
    """Isbotni tekshiradi. `locale` provayder payload'iga kirmaydi (Telegram imzosi buzilmasin)."""
    payload = {key: value for key, value in data.items() if key != "locale"}
    return get_provider(provider).verify(payload)


class ProviderLoginView(PublicAuthView):
    provider: str

    def post(self, request):
        data = validated(PROVIDER_SERIALIZERS[self.provider], request)
        identity = provider_identity(self.provider, data)
        user, is_new = social_services.sign_in(identity, locale=data.get("locale"), request=request)
        return session_response(user, is_new=is_new)


class GoogleLoginView(ProviderLoginView):
    provider = Provider.GOOGLE

    @extend_schema(
        operation_id="auth_google",
        summary="Google id_token orqali kirish/ro'yxatdan o'tish",
        request=GoogleAuthSerializer,
        responses=AuthSessionSerializer,
        tags=["auth"],
    )
    def post(self, request):
        return super().post(request)


class TelegramLoginView(ProviderLoginView):
    provider = Provider.TELEGRAM

    @extend_schema(
        operation_id="auth_telegram",
        summary="Telegram Login Widget orqali kirish/ro'yxatdan o'tish",
        request=TelegramAuthSerializer,
        responses=AuthSessionSerializer,
        tags=["auth"],
    )
    def post(self, request):
        return super().post(request)


class OtpRequestView(PublicAuthView):
    @extend_schema(
        operation_id="auth_otp_request",
        summary="Emailga 6 xonali kod yuborish (60 soniyada bir marta)",
        request=OtpRequestSerializer,
        responses=OkSerializer,
        tags=["auth"],
    )
    def post(self, request):
        data = validated(OtpRequestSerializer, request)
        otp_services.request_code(data["email"], data.get("locale"), request)
        return Response(OK)


class OtpVerifyView(ProviderLoginView):
    provider = Provider.EMAIL_OTP

    @extend_schema(
        operation_id="auth_otp_verify",
        summary="Email kodi orqali kirish/ro'yxatdan o'tish",
        request=OtpVerifySerializer,
        responses=AuthSessionSerializer,
        tags=["auth"],
    )
    def post(self, request):
        return super().post(request)


# --- /me/identities/ ---

LinkRequest = PolymorphicProxySerializer(
    component_name="LinkIdentityRequest",
    serializers=list(PROVIDER_SERIALIZERS.values()),
    resource_type_field_name=None,
)


class IdentityListView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(operation_id="me_identities_list", responses=IdentityListSerializer, tags=["me"])
    def get(self, request):
        data = {
            "identities": social_services.list_identities(request.user),
            "has_password": request.user.has_usable_password(),
        }
        return Response(IdentityListSerializer(data).data)


class IdentityLinkView(APIView):
    permission_classes = [IsAuthenticated]
    throttle_classes = [AuthRateThrottle]

    @extend_schema(
        operation_id="me_identities_link",
        summary="Kirish usulini ulash (google | telegram | email_otp)",
        request=LinkRequest,
        responses={200: IdentitySerializer},
        tags=["me"],
    )
    def post(self, request, provider):
        serializer_class = PROVIDER_SERIALIZERS.get(provider)
        if serializer_class is None:
            raise NotFound()
        data = validated(serializer_class, request)
        identity = provider_identity(provider, data)
        linked = social_services.link_identity(request.user, identity, request)
        return Response(IdentitySerializer(linked).data)


class IdentityDetailView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(
        operation_id="me_identities_delete",
        summary="Kirish usulini o'chirish (oxirgisini o'chirib bo'lmaydi)",
        responses={204: None},
        tags=["me"],
    )
    def delete(self, request, identity_id):
        social_services.unlink_identity(request.user, identity_id, request)
        return Response(status=status.HTTP_204_NO_CONTENT)


class PasswordSetView(APIView):
    permission_classes = [IsAuthenticated]
    throttle_classes = [AuthRateThrottle]

    @extend_schema(
        operation_id="me_password_set",
        summary="Parolsiz akkaunt uchun parol o'rnatish",
        request=PasswordSetSerializer,
        responses=OkSerializer,
        tags=["me"],
    )
    def post(self, request):
        data = validated(PasswordSetSerializer, request)
        social_services.set_password(request.user, data["new_password"], request)
        return Response(OK)
