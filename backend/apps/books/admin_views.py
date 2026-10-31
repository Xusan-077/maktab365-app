"""Kitoblar admin API'si (`/api/v1/admin/books/`): editor+admin, o'chirish — faqat admin."""

from django.conf import settings
from django.db import transaction
from drf_spectacular.utils import OpenApiParameter, extend_schema, extend_schema_view
from rest_framework.decorators import action
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.response import Response

from apps.accounts import audit
from apps.content import pdf_storage as storage
from apps.content.admin_services import UploadError
from apps.content.admin_views import TAG, AdminViewSet
from apps.content.pdf_serializers import (
    PdfUploadCompleteSerializer,
    PdfUploadFileSerializer,
    PdfUploadInitSerializer,
    PdfUploadPlanSerializer,
)
from apps.core.throttling import PdfUploadThrottle

from . import services
from .admin_serializers import BookAdminSerializer, BookTransitionSerializer
from .models import Book, BookStatus, BookType


@extend_schema_view(
    list=extend_schema(
        operation_id="admin_books_list",
        tags=TAG,
        parameters=[
            OpenApiParameter("type", str, enum=list(BookType.values)),
            OpenApiParameter("status", str, enum=list(BookStatus.values)),
            OpenApiParameter("published", bool),
        ],
    ),
    create=extend_schema(operation_id="admin_books_create", tags=TAG),
    retrieve=extend_schema(operation_id="admin_books_retrieve", tags=TAG),
    partial_update=extend_schema(operation_id="admin_books_update", tags=TAG),
    destroy=extend_schema(operation_id="admin_books_delete", tags=TAG),
)
class BookAdminViewSet(AdminViewSet):
    target_type = "book"
    snapshot_fields = (
        "title",
        "author",
        "type",
        "grade_level",
        "language",
        "description",
        "status",
        "is_published",
        "page_count",
        "size_bytes",
    )
    serializer_class = BookAdminSerializer
    http_method_names = ["get", "post", "patch", "delete", "head", "options"]
    search_fields = ["title", "author"]
    ordering_fields = ["created_at", "updated_at", "title", "page_count"]
    ordering = ["-created_at"]

    def label(self, instance) -> str:
        return instance.title

    def snap(self, instance):
        data = super().snap(instance)
        data["source_file"] = str(instance.source_file or "")
        data["cover_image"] = str(instance.cover_image or "")
        data["chapters"] = instance.chapters.count()
        return data

    def get_queryset(self):
        qs = Book.objects.prefetch_related("chapters")
        params = self.request.query_params
        if params.get("type") in BookType.values:
            qs = qs.filter(type=params["type"])
        if params.get("status") in BookStatus.values:
            qs = qs.filter(status=params["status"])
        if params.get("published") in ("true", "false"):
            qs = qs.filter(is_published=params["published"] == "true")
        return qs

    def perform_destroy(self, instance):
        before, label = self.snap(instance), self.label(instance)
        with transaction.atomic():
            pk = instance.pk
            services.delete_book(instance)
            audit.record(
                self.request.user,
                "delete",
                self.target_type,
                pk,
                label=label,
                before=before,
                request=self.request,
            )

    def _response(self, book: Book, status: int = 200) -> Response:
        fresh = self.get_queryset().get(pk=book.pk)
        data = BookAdminSerializer(fresh, context=self.get_serializer_context()).data
        return Response(data, status=status)

    @extend_schema(
        operation_id="admin_books_transition",
        tags=TAG,
        summary="Nashr: tayyor kitobni chiqarish (editor/admin), qaytarish (admin)",
        request=BookTransitionSerializer,
        responses=BookAdminSerializer,
    )
    @action(detail=True, methods=["post"])
    def transition(self, request, pk=None):
        book = self.get_object()
        body = BookTransitionSerializer(data=request.data)
        body.is_valid(raise_exception=True)
        before = self.snap(book)
        with transaction.atomic():
            book = services.transition(book, body.validated_data["to"], request.user)
            self.log("transition", book, before=before, after=self.snap(book))
        return self._response(book)

    @extend_schema(
        operation_id="admin_books_reprocess",
        tags=TAG,
        summary="Sahifalarni qayta tayyorlash (xato yoki PDF o'zgargandan keyin)",
        request=None,
        responses={202: BookAdminSerializer},
    )
    @action(detail=True, methods=["post"], throttle_classes=[PdfUploadThrottle])
    def reprocess(self, request, pk=None):
        from .tasks import process_book

        book = self.get_object()
        if not book.source_file:
            raise UploadError("no_file", 409)
        if book.status == BookStatus.PROCESSING:
            raise UploadError("processing_in_progress", 409)
        before = self.snap(book)
        with transaction.atomic():
            book.status, book.status_error, book.processed_pages = BookStatus.PROCESSING, "", 0
            book.save()
            transaction.on_commit(lambda: process_book.delay(str(book.pk)))
            self.log("reprocess", book, before=before, after=self.snap(book))
        return self._response(book, 202)

    @extend_schema(
        operation_id="admin_books_upload_init",
        tags=TAG,
        summary="PDF yuklashni boshlash (yangi fayl yoki almashtirish)",
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
        operation_id="admin_books_upload_complete",
        tags=TAG,
        summary="S3 multipart yuklashni yakunlash: tekshiruv va sahifalarni tayyorlashni boshlash",
        request=PdfUploadCompleteSerializer,
        responses=BookAdminSerializer,
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
        return self._response(book)

    @extend_schema(
        operation_id="admin_books_upload_file",
        tags=TAG,
        summary="Lokal (dev) rejim: PDF'ni backend orqali yuklash",
        request={"multipart/form-data": PdfUploadFileSerializer},
        responses=BookAdminSerializer,
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
        return self._response(book)
