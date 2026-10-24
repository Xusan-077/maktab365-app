"""Admin "Xabarlar": foydalanuvchi murojaatlari (darslikdagi xato, savol…), holat va izoh."""

import uuid

from django.db.models import Count, Q
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import OpenApiParameter, extend_schema, extend_schema_view
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response

from apps.content.admin_views import TAG, AdminViewSet

from .models import Kind, Status, SupportMessage
from .serializers import SupportAdminSerializer, SupportSummarySerializer

STATUS_PARAM = OpenApiParameter(
    "status",
    OpenApiTypes.STR,
    enum=list(Status.values),
    description="Holat; berilmasa spam'dan boshqa hammasi",
)
KIND_PARAM = OpenApiParameter("kind", OpenApiTypes.STR, enum=list(Kind.values))
BOOK_PARAM = OpenApiParameter("pdf_book", OpenApiTypes.UUID, description="Kitob id")


@extend_schema_view(
    list=extend_schema(
        operation_id="admin_support_list",
        tags=TAG,
        parameters=[STATUS_PARAM, KIND_PARAM, BOOK_PARAM],
    ),
    retrieve=extend_schema(operation_id="admin_support_retrieve", tags=TAG),
    partial_update=extend_schema(
        operation_id="admin_support_update",
        tags=TAG,
        summary=(
            "Holat (`new` — yangi, `in_progress` — ko'rildi, `resolved` — hal qilindi, `spam`) "
            "va izoh"
        ),
    ),
)
class SupportAdminViewSet(AdminViewSet):
    """Editor va admin: ko'radi, holat va izohni o'zgartiradi (audit bilan). O'chirish yo'q."""

    target_type = "support_message"
    snapshot_fields = ("status", "staff_note")
    serializer_class = SupportAdminSerializer
    http_method_names = ["get", "patch", "head", "options"]
    filter_backends: list = []
    ordering = ["-created_at"]

    def label(self, instance) -> str:
        return instance.message[:40]

    def get_queryset(self):
        rows = SupportMessage.objects.select_related("pdf_book", "user").order_by("-created_at")
        params = self.request.query_params
        status = params.get("status")
        if status:
            if status not in Status.values:
                raise ValidationError({"status": ["invalid"]})
            rows = rows.filter(status=status)
        elif self.action == "list":
            rows = rows.exclude(status=Status.SPAM)
        if kind := params.get("kind"):
            if kind not in Kind.values:
                raise ValidationError({"kind": ["invalid"]})
            rows = rows.filter(kind=kind)
        if book := params.get("pdf_book"):
            try:
                rows = rows.filter(pdf_book_id=uuid.UUID(book))
            except ValueError:
                raise ValidationError({"pdf_book": ["invalid"]}) from None
        return rows

    @extend_schema(
        operation_id="admin_support_summary",
        tags=TAG,
        responses=SupportSummarySerializer,
        summary="Yangi xabarlar soni (sidebar) va xabari bor kitoblar (filtr)",
    )
    @action(detail=False, methods=["get"])
    def summary(self, request):
        visible = SupportMessage.objects.exclude(status=Status.SPAM)
        books = (
            visible.filter(pdf_book__isnull=False)
            .values("pdf_book_id", "pdf_book__title", "pdf_book__grade")
            .annotate(count=Count("pk"), new=Count("pk", filter=Q(status=Status.NEW)))
            .order_by("-new", "-count")
        )
        data = {
            "new": visible.filter(status=Status.NEW).count(),
            "books": [
                {
                    "id": row["pdf_book_id"],
                    "title": row["pdf_book__title"],
                    "grade": row["pdf_book__grade"],
                    "count": row["count"],
                }
                for row in books
            ],
        }
        return Response(SupportSummarySerializer(data).data)
