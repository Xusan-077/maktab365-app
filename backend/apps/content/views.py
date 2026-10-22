from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import OpenApiParameter
from rest_framework import serializers
from rest_framework.permissions import AllowAny

GRADE_PARAM = OpenApiParameter("grade", OpenApiTypes.INT, description="Sinf (1–11)")
SUBJECT_PARAM = OpenApiParameter("subject", OpenApiTypes.STR, description="Fan slug'i")


def _int_param(request, name: str) -> int | None:
    raw = request.query_params.get(name)
    if raw in (None, ""):
        return None
    try:
        return int(raw)
    except ValueError:
        raise serializers.ValidationError({name: ["invalid"]}) from None


class PublicView:
    """Ochiq (loginsiz) o'qish uchun umumiy sozlama; tezlik chegarasi o'rniga kesh ishlaydi."""

    permission_classes = [AllowAny]
    throttle_classes: list = []
