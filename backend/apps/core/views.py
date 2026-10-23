import redis
from django.conf import settings
from django.db import connection
from django.http import JsonResponse
from drf_spectacular.utils import extend_schema
from rest_framework import serializers, status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from .exceptions import error_body
from .version import version_info

CHECK_STATUS_CHOICES = ["ok", "error"]


class HealthChecksSerializer(serializers.Serializer):
    database = serializers.ChoiceField(choices=CHECK_STATUS_CHOICES)
    redis = serializers.ChoiceField(choices=CHECK_STATUS_CHOICES)


class HealthVersionSerializer(serializers.Serializer):
    commit = serializers.CharField(help_text="Qisqa git commit yoki `unknown`")
    api_revision = serializers.IntegerField(help_text="Frontend talab qiladigan API versiyasi")
    environment = serializers.CharField()


class HealthSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=["ok", "degraded"])
    checks = HealthChecksSerializer()
    version = HealthVersionSerializer()


def check_database() -> bool:
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
        return True
    except Exception:  # noqa: BLE001
        return False


def check_redis() -> bool:
    try:
        client = redis.Redis.from_url(
            settings.REDIS_URL, socket_connect_timeout=1, socket_timeout=1
        )
        return bool(client.ping())
    except Exception:  # noqa: BLE001
        return False


class HealthView(APIView):
    authentication_classes: list = []
    permission_classes = [AllowAny]
    throttle_classes: list = []

    @extend_schema(
        operation_id="health",
        summary="Servis holati (DB va Redis)",
        responses={200: HealthSerializer, 503: HealthSerializer},
        auth=[],
    )
    def get(self, request):
        checks = {
            "database": "ok" if check_database() else "error",
            "redis": "ok" if check_redis() else "error",
        }
        healthy = all(value == "ok" for value in checks.values())
        return Response(
            {
                "status": "ok" if healthy else "degraded",
                "checks": checks,
                "version": version_info(),
            },
            status=status.HTTP_200_OK if healthy else status.HTTP_503_SERVICE_UNAVAILABLE,
        )


def not_found(request, exception=None):
    return JsonResponse(error_body("not_found", "Not found."), status=404)


def server_error(request):
    return JsonResponse(error_body("server_error", "Internal server error."), status=500)
