from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.models import Role
from apps.content.pdf_services import public_pdf_books
from apps.core.permissions import IsRole
from apps.core.throttling import StatsThrottle

from . import services
from .serializers import StatEventSerializer, StatsSummarySerializer


class BookStatEventView(APIView):
    """Anonim hisoblagich: kitob ochildi / sahifa ko'rildi. Faqat son; kirish talab qilinmaydi."""

    permission_classes = [AllowAny]
    authentication_classes: list = []
    throttle_classes = [StatsThrottle]

    @extend_schema(
        operation_id="pdf_books_stat_event",
        request=StatEventSerializer,
        responses={204: None},
        summary="Anonim statistika hodisasi (ochilish yoki sahifa)",
        tags=["content"],
    )
    def post(self, request, pk):
        body = StatEventSerializer(data=request.data)
        body.is_valid(raise_exception=True)
        # Qoralama va noma'lum kitoblar hisoblanmaydi (jim 204: mavjudlik oshkor bo'lmasin).
        book = public_pdf_books().filter(pk=pk).first()
        if book is not None:
            if body.validated_data["kind"] == "open":
                services.record_open(book.pk)
            elif body.validated_data["page"] <= max(book.page_count, 1):
                services.record_page(book.pk, body.validated_data["page"])
        return Response(status=204)


class AdminStatsView(APIView):
    permission_classes = [IsRole(Role.EDITOR, Role.ADMIN)]

    @extend_schema(
        operation_id="admin_stats",
        parameters=[OpenApiParameter("days", int, enum=list(services.PERIODS))],
        responses=StatsSummarySerializer,
        tags=["admin"],
    )
    def get(self, request):
        raw = request.query_params.get("days", "7")
        days = int(raw) if raw.isdigit() and int(raw) in services.PERIODS else 7
        return Response(StatsSummarySerializer(services.summary(days)).data)
