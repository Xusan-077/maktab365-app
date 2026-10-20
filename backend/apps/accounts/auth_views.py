from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.core.throttling import AuthEmailThrottle, AuthRateThrottle

from . import auth_services
from .auth_serializers import (
    AuthSessionSerializer,
    AuthTokensSerializer,
    EmailSerializer,
    LoginSerializer,
    OkSerializer,
    PasswordChangeSerializer,
    PasswordResetSerializer,
    RefreshSerializer,
    RegisterSerializer,
    TokenSerializer,
)
from .serializers import MeSerializer

OK = {"ok": True}


class PublicAuthView(APIView):
    """Kirmagan foydalanuvchi uchun: eskirgan `Authorization` sarlavhasi so'rovni buzmasin."""

    authentication_classes: list = []
    permission_classes = [AllowAny]
    throttle_classes = [AuthRateThrottle, AuthEmailThrottle]


def session_response(user, *, is_new: bool, status_code=status.HTTP_200_OK) -> Response:
    data = {**auth_services.issue_tokens(user), "user": MeSerializer(user).data, "is_new": is_new}
    return Response(data, status=status_code)


def validated(serializer_class, request) -> dict:
    serializer = serializer_class(data=request.data)
    serializer.is_valid(raise_exception=True)
    return serializer.validated_data


class RegisterView(PublicAuthView):
    @extend_schema(
        operation_id="auth_register",
        request=RegisterSerializer,
        responses={201: AuthSessionSerializer},
        tags=["auth"],
    )
    def post(self, request):
        data = validated(RegisterSerializer, request)
        user = auth_services.register(request=request, **data)
        return session_response(user, is_new=True, status_code=status.HTTP_201_CREATED)


class LoginView(PublicAuthView):
    @extend_schema(
        operation_id="auth_login",
        request=LoginSerializer,
        responses=AuthSessionSerializer,
        tags=["auth"],
    )
    def post(self, request):
        data = validated(LoginSerializer, request)
        user = auth_services.authenticate_password(data["email"], data["password"], request)
        return session_response(user, is_new=False)


class RefreshView(PublicAuthView):
    # Token o'zi kalit; so'rovlar Next serveridan keladi (bitta IP) — IP throttle qo'yilmaydi.
    throttle_classes: list = []

    @extend_schema(
        operation_id="auth_refresh",
        request=RefreshSerializer,
        responses=AuthTokensSerializer,
        tags=["auth"],
    )
    def post(self, request):
        data = validated(RefreshSerializer, request)
        return Response(auth_services.rotate_refresh(data["refresh"]))


class LogoutView(PublicAuthView):
    throttle_classes: list = []

    @extend_schema(
        operation_id="auth_logout",
        summary="Refresh tokenni bekor qilish (idempotent)",
        request=RefreshSerializer,
        responses={204: None},
        tags=["auth"],
    )
    def post(self, request):
        data = validated(RefreshSerializer, request)
        auth_services.logout(data["refresh"], request)
        return Response(status=status.HTTP_204_NO_CONTENT)


class LogoutAllView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(
        operation_id="auth_logout_all",
        summary="Barcha qurilmalardagi sessiyalarni bekor qilish",
        request=None,
        responses={204: None},
        tags=["auth"],
    )
    def post(self, request):
        auth_services.logout_all(request.user, request)
        return Response(status=status.HTTP_204_NO_CONTENT)


class EmailVerifyView(PublicAuthView):
    throttle_classes = [AuthRateThrottle]

    @extend_schema(
        operation_id="auth_email_verify",
        request=TokenSerializer,
        responses=OkSerializer,
        tags=["auth"],
    )
    def post(self, request):
        data = validated(TokenSerializer, request)
        auth_services.verify_email(data["token"], request)
        return Response(OK)


class EmailResendView(APIView):
    permission_classes = [IsAuthenticated]
    throttle_classes = [AuthRateThrottle]

    @extend_schema(
        operation_id="auth_email_resend",
        summary="Tasdiqlash xatini qayta yuborish (60 soniyada bir marta)",
        request=None,
        responses=OkSerializer,
        tags=["auth"],
    )
    def post(self, request):
        auth_services.resend_verification(request.user, request)
        return Response(OK)


class PasswordForgotView(PublicAuthView):
    @extend_schema(
        operation_id="auth_password_forgot",
        summary="Parol tiklash xati (akkaunt bor-yo'qligidan qat'i nazar doim 200)",
        request=EmailSerializer,
        responses=OkSerializer,
        tags=["auth"],
    )
    def post(self, request):
        data = validated(EmailSerializer, request)
        auth_services.request_password_reset(data["email"], request)
        return Response(OK)


class PasswordResetView(PublicAuthView):
    throttle_classes = [AuthRateThrottle]

    @extend_schema(
        operation_id="auth_password_reset",
        request=PasswordResetSerializer,
        responses=OkSerializer,
        tags=["auth"],
    )
    def post(self, request):
        data = validated(PasswordResetSerializer, request)
        auth_services.reset_password(data["token"], data["password"], request)
        return Response(OK)


class PasswordChangeView(APIView):
    permission_classes = [IsAuthenticated]
    throttle_classes = [AuthRateThrottle]

    @extend_schema(
        operation_id="auth_password_change",
        summary="Parolni almashtirish; joriy sessiyadan boshqa refresh tokenlar bekor qilinadi",
        request=PasswordChangeSerializer,
        responses=OkSerializer,
        tags=["auth"],
    )
    def post(self, request):
        data = validated(PasswordChangeSerializer, request)
        auth_services.change_password(
            request.user,
            current=data.get("current_password", ""),
            new=data["new_password"],
            keep_refresh=data.get("refresh") or None,
            request=request,
        )
        return Response(OK)
