"""Telegram bot orqali kirish: `auth/telegram/{start,status,complete,webhook}/`.

Mantiq `telegram_login.py` da.
"""

import re

from django.conf import settings
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework.exceptions import APIException
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.core.throttling import AuthRateThrottle, TelegramStartThrottle, TelegramStatusThrottle

from . import social_services, telegram_login
from .auth_serializers import (
    TELEGRAM_LOGIN_PATTERN,
    TelegramLoginCompleteSerializer,
    TelegramLoginSessionSerializer,
    TelegramLoginStartRequestSerializer,
    TelegramLoginStartSerializer,
    TelegramLoginStatusSerializer,
)
from .auth_views import PublicAuthView, session_response, validated
from .services import get_profile

NONCE_PARAM = OpenApiParameter(
    telegram_login.NONCE_HEADER,
    OpenApiTypes.STR,
    OpenApiParameter.HEADER,
    required=False,
    description="`start` bergan nonce (yoki `tg_nonce` cookie'si).",
)


class WebhookForbidden(APIException):
    status_code = 403
    default_code = "forbidden"
    default_detail = "Invalid webhook secret."


def request_nonce(request) -> str:
    """Next serveri nonce'ni sarlavhada uzatadi; to'g'ridan-to'g'ri mijoz — cookie'da."""
    return request.headers.get(telegram_login.NONCE_HEADER) or request.COOKIES.get(
        telegram_login.NONCE_COOKIE, ""
    )


class TelegramLoginStartView(PublicAuthView):
    throttle_classes = [TelegramStartThrottle]

    @extend_schema(
        operation_id="auth_telegram_start",
        summary="Telegram bot orqali kirish: bir martalik havola (5 daqiqa)",
        request=TelegramLoginStartRequestSerializer,
        responses=TelegramLoginStartSerializer,
        tags=["auth"],
    )
    def post(self, request):
        data = validated(TelegramLoginStartRequestSerializer, request)
        login = telegram_login.start(with_phone=data["with_phone"])
        response = Response(
            {
                "token": login.token,
                "bot_url": login.bot_url,
                "expires_in": login.expires_in,
                "nonce": login.nonce,
            }
        )
        response.set_cookie(
            telegram_login.NONCE_COOKIE,
            login.nonce,
            max_age=login.expires_in,
            path="/api/v1/auth/telegram/",
            secure=not settings.DEBUG,
            httponly=True,
            samesite="Lax",
        )
        return response


class TelegramLoginStatusView(PublicAuthView):
    throttle_classes = [TelegramStatusThrottle]

    @extend_schema(
        operation_id="auth_telegram_status",
        summary="Telegram orqali kirish holati (pending | confirmed | expired)",
        parameters=[
            OpenApiParameter("token", OpenApiTypes.STR, OpenApiParameter.QUERY, required=True),
            NONCE_PARAM,
        ],
        responses=TelegramLoginStatusSerializer,
        tags=["auth"],
    )
    def get(self, request):
        token = request.query_params.get("token", "")
        if not re.fullmatch(TELEGRAM_LOGIN_PATTERN, token):
            return Response({"status": telegram_login.EXPIRED})
        return Response({"status": telegram_login.status(token, request_nonce(request))})


class TelegramLoginCompleteView(PublicAuthView):
    throttle_classes = [AuthRateThrottle]

    @extend_schema(
        operation_id="auth_telegram_complete",
        summary="Tasdiqlangan Telegram kirishini sessiyaga almashtirish (token bir martalik)",
        request=TelegramLoginCompleteSerializer,
        parameters=[NONCE_PARAM],
        responses=TelegramLoginSessionSerializer,
        tags=["auth"],
    )
    def post(self, request):
        data = validated(TelegramLoginCompleteSerializer, request)
        identity = telegram_login.complete(data["token"], request_nonce(request))
        user, is_new = social_services.sign_in(identity, locale=data.get("locale"), request=request)
        response = session_response(user, is_new=is_new)
        response.data["profile_completed"] = get_profile(user).onboarded_at is not None
        response.delete_cookie(telegram_login.NONCE_COOKIE, path="/api/v1/auth/telegram/")
        return response


class TelegramWebhookView(APIView):
    """Faqat Telegram: `X-Telegram-Bot-Api-Secret-Token` = `TELEGRAM_WEBHOOK_SECRET`."""

    authentication_classes: list = []
    permission_classes = [AllowAny]
    throttle_classes: list = []

    @extend_schema(
        operation_id="auth_telegram_webhook",
        summary="Telegram bot webhook'i (/start <token>)",
        request=OpenApiTypes.OBJECT,
        responses=OpenApiTypes.OBJECT,
        tags=["auth"],
    )
    def post(self, request):
        sent = request.headers.get("X-Telegram-Bot-Api-Secret-Token", "")
        if not telegram_login.webhook_secret_valid(sent):
            raise WebhookForbidden()
        # Javob xabari webhook javobining o'zida (Telegram uni Bot API chaqiruvi sifatida bajaradi).
        return Response(telegram_login.handle_update(request.data) or {})
