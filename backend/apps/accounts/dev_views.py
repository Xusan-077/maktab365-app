"""Faqat dev/e2e: yuborilgan OTP kodini qaytaradi (`OTP_DEV_INBOX`). Prod'da URL ro'yxatda yo'q."""

from django.core.cache import cache
from drf_spectacular.utils import extend_schema
from rest_framework.exceptions import NotFound
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from . import otp_services


class DevOtpInboxView(APIView):
    authentication_classes: list = []
    permission_classes = [AllowAny]
    throttle_classes: list = []

    @extend_schema(exclude=True)
    def get(self, request):
        email = otp_services.normalize_email(request.query_params.get("email", ""))
        code = cache.get(otp_services.dev_inbox_key(email)) if email else None
        if code is None:
            raise NotFound()
        return Response({"code": code})
