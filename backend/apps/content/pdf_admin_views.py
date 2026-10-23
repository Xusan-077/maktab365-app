from django.conf import settings
from django.db import transaction
from drf_spectacular.utils import OpenApiParameter, extend_schema, extend_schema_view
from rest_framework.decorators import action
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.response import Response

from apps.accounts import audit
from apps.core.throttling import PdfUploadThrottle

from . import pdf_services as services
from . import pdf_storage as storage
from .admin_services import UploadError
from .admin_views import TAG, AdminViewSet
from .models import PdfBook
from .pdf_serializers import (
    PdfBookAdminSerializer,
    PdfTransitionSerializer,
    PdfUploadCompleteSerializer,
    PdfUploadFileSerializer,
    PdfUploadInitSerializer,
    PdfUploadPlanSerializer,
)


@extend_schema_view(
    list=extend_schema(
        operation_id="admin_pdf_books_list",
        tags=TAG,
        parameters=[
            OpenApiParameter("grade", int),
            OpenApiParameter("subject", str, description="Fan slug'i"),
            OpenApiParameter("status", str, enum=["published", "draft"]),
        ],
    ),
    create=extend_schema(operation_id="admin_pdf_books_create", tags=TAG),
    retrieve=extend_schema(operation_id="admin_pdf_books_retrieve", tags=TAG),
    partial_update=extend_schema(operation_id="admin_pdf_books_update", tags=TAG),
    destroy=extend_schema(operation_id="admin_pdf_books_delete", tags=TAG),
)
class PdfBookAdminViewSet(AdminViewSet):
    target_type = "pdf_book"
    snapshot_fields = (
        "title",
        "description",
        "grade",
        "subject_id",
        "status",
        "page_count",
        "size_bytes",
    )
    serializer_class = PdfBookAdminSerializer
    http_method_names = ["get", "post", "patch", "delete", "head", "options"]
    search_fields = ["title__uz", "title__ru", "title__en"]
    ordering_fields = ["grade", "updated_at", "created_at", "page_count"]
    ordering = ["grade", "-created_at"]

    def label(self, instance) -> str:
        return (instance.title or {}).get("uz", str(instance.pk))

    def snap(self, instance):
        data = super().snap(instance)
        data["file"], data["cover"] = str(instance.file or ""), str(instance.cover or "")
        data["chapters"] = instance.chapters.count()
        return data

    def get_queryset(self):
        qs = PdfBook.objects.select_related("subject").prefetch_related("chapters")
        params = self.request.query_params
        if params.get("grade", "").isdigit():
            qs = qs.filter(grade=int(params["grade"]))
        if params.get("subject"):
            qs = qs.filter(subject__slug=params["subject"])
        if params.get("status") in ("published", "draft"):
            qs = qs.filter(status=params["status"])
        return qs

    def perform_destroy(self, instance):
        before, label = self.snap(instance), self.label(instance)
        keys = (instance.file.name if instance.file else "", instance.pending_file)
        pending_key, pending_upload = instance.pending_file, instance.pending_upload_id
        with transaction.atomic():
            pk = instance.pk
            instance.delete()
            audit.record(
                self.request.user,
                "delete",
                self.target_type,
                pk,
                label=label,
                before=before,
                request=self.request,
            )
            transaction.on_commit(lambda: storage.abort_upload(pending_key, pending_upload))
            transaction.on_commit(lambda: services.purge_files(*keys))

    @extend_schema(
        operation_id="admin_pdf_books_transition",
        tags=TAG,
        request=PdfTransitionSerializer,
        responses=PdfBookAdminSerializer,
    )
    @action(detail=True, methods=["post"])
    def transition(self, request, pk=None):
        """Nashr: draft→published (editor/admin, fayl bo'lishi shart), published→draft (admin)."""
        book = self.get_object()
        body = PdfTransitionSerializer(data=request.data)
        body.is_valid(raise_exception=True)
        before = self.snap(book)
        with transaction.atomic():
            book = services.transition_pdf_book(book, body.validated_data["to"], request.user)
            self.log("transition", book, before=before, after=self.snap(book))
        return Response(PdfBookAdminSerializer(book, context=self.get_serializer_context()).data)

    @extend_schema(
        operation_id="admin_pdf_books_upload_init",
        tags=TAG,
        summary="Yuklashni boshlash (yangi fayl yoki almashtirish)",
        request=PdfUploadInitSerializer,
        responses=PdfUploadPlanSerializer,
    )
    @action(
        detail=True,
        methods=["post"],
        url_path="upload-init",
        throttle_classes=[PdfUploadThrottle],
        parser_classes=[JSONParser, FormParser],
    )
    def upload_init(self, request, pk=None):
        book = self.get_object()
        body = PdfUploadInitSerializer(data=request.data)
        body.is_valid(raise_exception=True)
        data = body.validated_data
        plan = services.begin_upload(book, data["filename"], data["size"], data["content_type"])
        return Response(
            {
                "mode": plan.mode,
                "part_size": plan.part_size,
                "part_urls": list(plan.part_urls),
                "expires_in": settings.PDF_SIGNED_URL_SECONDS,
            }
        )

    @extend_schema(
        operation_id="admin_pdf_books_upload_complete",
        tags=TAG,
        summary="S3 multipart yuklashni yakunlash: tekshiruv, sahifalar soni",
        request=PdfUploadCompleteSerializer,
        responses=PdfBookAdminSerializer,
    )
    @action(
        detail=True,
        methods=["post"],
        url_path="upload-complete",
        throttle_classes=[PdfUploadThrottle],
    )
    def upload_complete(self, request, pk=None):
        book = self.get_object()
        body = PdfUploadCompleteSerializer(data=request.data)
        body.is_valid(raise_exception=True)
        before = self.snap(book)
        book = services.complete_direct(book, body.validated_data["parts"])
        self.log("upload", book, before=before, after=self.snap(book))
        return Response(PdfBookAdminSerializer(book, context=self.get_serializer_context()).data)

    @extend_schema(
        operation_id="admin_pdf_books_upload_file",
        tags=TAG,
        summary="Lokal (dev) rejim: faylni backend orqali yuklash",
        request={"multipart/form-data": PdfUploadFileSerializer},
        responses=PdfBookAdminSerializer,
    )
    @action(
        detail=True,
        methods=["post"],
        url_path="upload",
        throttle_classes=[PdfUploadThrottle],
        parser_classes=[MultiPartParser],
    )
    def upload(self, request, pk=None):
        if storage.is_remote():
            raise UploadError("direct_upload_required", 409)
        book = self.get_object()
        body = PdfUploadFileSerializer(data=request.data)
        body.is_valid(raise_exception=True)
        before = self.snap(book)
        book = services.store_proxy(book, body.validated_data["file"])
        self.log("upload", book, before=before, after=self.snap(book))
        return Response(PdfBookAdminSerializer(book, context=self.get_serializer_context()).data)
