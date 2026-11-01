"""Kitoblar admin API'si (`/api/v1/admin/books/`): editor+admin, o'chirish — faqat admin."""

from django.conf import settings
from django.db import transaction
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import OpenApiParameter, extend_schema, extend_schema_view
from rest_framework import serializers
from rest_framework.decorators import action
from rest_framework.exceptions import APIException, NotFound, ValidationError
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.response import Response

from apps.accounts import audit
from apps.content import pdf_storage as storage
from apps.content.admin_services import UploadError
from apps.content.admin_views import TAG, AdminViewSet, IsAdmin
from apps.content.pdf_serializers import (
    PdfDownloadSerializer,
    PdfUploadCompleteSerializer,
    PdfUploadFileSerializer,
    PdfUploadInitSerializer,
    PdfUploadPlanSerializer,
)
from apps.core.admin_download import cover_response, safe_filename
from apps.core.throttling import PdfUploadThrottle

from . import services, testmode
from .admin_serializers import (
    BookAdminSerializer,
    BookTransitionSerializer,
    BookTypeAdminSerializer,
)
from .models import AnswerKeyItem, Book, BookStatus, BookType, ReadingMode


class AnswerKeyItemSerializer(serializers.Serializer):
    page = serializers.IntegerField()
    question = serializers.IntegerField()
    answer = serializers.CharField()


class AnswerKeyImportSerializer(serializers.Serializer):
    text = serializers.CharField(max_length=400_000, trim_whitespace=False)
    mode = serializers.ChoiceField(choices=["replace", "merge"], default="replace")


class AnswerKeySavedSerializer(serializers.Serializer):
    saved = serializers.IntegerField()
    total = serializers.IntegerField()


@extend_schema_view(
    list=extend_schema(
        operation_id="admin_books_list",
        tags=TAG,
        parameters=[
            OpenApiParameter("type", str, description="Tur slug'i"),
            OpenApiParameter("reading_mode", str, enum=list(ReadingMode.values)),
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
        "book_type_id",
        "reading_mode",
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
        qs = Book.objects.select_related("book_type").prefetch_related("chapters")
        params = self.request.query_params
        if params.get("type"):
            qs = qs.filter(book_type__slug=params["type"])
        if params.get("reading_mode") in ReadingMode.values:
            qs = qs.filter(reading_mode=params["reading_mode"])
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
        summary="S3 multipart yuklashni yakunlash: PDF sinxron tekshiriladi, kitob darhol tayyor",
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

    def get_permissions(self):
        if self.action in ("download", "cover_download"):
            return [IsAdmin()]
        return super().get_permissions()

    @extend_schema(
        operation_id="admin_books_download",
        tags=TAG,
        summary="PDF'ni yuklab olish URL'i (FAQAT admin; foydalanuvchilarda yuklab olish yo'q)",
        responses=PdfDownloadSerializer,
    )
    @action(detail=True, methods=["get"])
    def download(self, request, pk=None):
        book = self.get_object()
        if not book.source_file:
            raise NotFound
        name = safe_filename(book.title, "pdf")
        data = storage.key_download_url(
            book.source_file.name, str(book.pk), f"/api/v1/books/{book.pk}/file/", name
        )
        self.log("download_pdf", book)
        response = Response(PdfDownloadSerializer(data).data)
        response["Cache-Control"] = "private, no-store"
        return response

    @extend_schema(
        operation_id="admin_books_cover_download",
        tags=TAG,
        summary="Muqovaning asl (katta) faylini yuklab olish (FAQAT admin)",
        responses={(200, "application/octet-stream"): OpenApiTypes.BINARY},
    )
    @action(detail=True, methods=["get"], url_path="cover-download")
    def cover_download(self, request, pk=None):
        book = self.get_object()
        self.log("download_cover", book)
        return cover_response(book.cover_image, book.title)

    def _test_book(self) -> Book:
        book = self.get_object()
        if book.reading_mode != ReadingMode.TEST:
            raise ValidationError({"detail": ["not_test_book"]})
        return book

    @extend_schema(
        methods=["GET"],
        operation_id="admin_books_answer_key",
        tags=TAG,
        summary="Test kitob: javoblar kaliti (faqat editor/admin)",
        responses=AnswerKeyItemSerializer(many=True),
    )
    @extend_schema(
        methods=["DELETE"],
        operation_id="admin_books_answer_key_clear",
        tags=TAG,
        summary="Kalitni to'liq o'chirish (foydalanuvchi javoblari ham tozalanadi)",
        responses={204: None},
    )
    @action(
        detail=True,
        methods=["get", "delete"],
        url_path="answer-key",
        pagination_class=None,
    )
    def answer_key(self, request, pk=None):
        book = self._test_book()
        if request.method == "DELETE":
            before = {"items": AnswerKeyItem.objects.filter(book=book).count()}
            with transaction.atomic():
                testmode.save_key(book, [], replace=True)
                self.log("answer_key_clear", book, before=before, after={"items": 0})
            return Response(status=204)
        rows = AnswerKeyItem.objects.filter(book=book)
        return Response(
            [{"page": r.page, "question": r.question, "answer": r.answer} for r in rows]
        )

    @extend_schema(
        operation_id="admin_books_answer_key_import",
        tags=TAG,
        summary="Kalitni ommaviy kiritish: har qator `bet, savol, javob`",
        request=AnswerKeyImportSerializer,
        responses=AnswerKeySavedSerializer,
    )
    @action(detail=True, methods=["post"], url_path="answer-key/import")
    def answer_key_import(self, request, pk=None):
        book = self._test_book()
        body = AnswerKeyImportSerializer(data=request.data)
        body.is_valid(raise_exception=True)
        rows, errors = testmode.parse_key_text(body.validated_data["text"], book.page_count)
        if errors:
            shown = [f"{e.line}: {e.code}" for e in errors[:50]]
            raise ValidationError({"text": shown})
        if not rows:
            raise ValidationError({"text": ["empty"]})
        replace = body.validated_data["mode"] == "replace"
        before = {"items": AnswerKeyItem.objects.filter(book=book).count()}
        with transaction.atomic():
            saved = testmode.save_key(book, rows, replace=replace)
            total = AnswerKeyItem.objects.filter(book=book).count()
            self.log("answer_key_import", book, before=before, after={"items": total})
        return Response({"saved": saved, "total": total})


@extend_schema_view(
    list=extend_schema(operation_id="admin_book_types_list", tags=TAG),
    create=extend_schema(operation_id="admin_book_types_create", tags=TAG),
    retrieve=extend_schema(operation_id="admin_book_types_retrieve", tags=TAG),
    partial_update=extend_schema(operation_id="admin_book_types_update", tags=TAG),
    destroy=extend_schema(operation_id="admin_book_types_delete", tags=TAG),
)
class BookTypeAdminViewSet(AdminViewSet):
    """Katalog turlari: editor+admin yaratadi/tahrirlaydi, o'chirish — admin (bo'sh va tizimsiz)."""

    target_type = "book_type"
    snapshot_fields = ("slug", "name", "order", "is_active")
    serializer_class = BookTypeAdminSerializer
    http_method_names = ["get", "post", "patch", "delete", "head", "options"]
    pagination_class = None
    ordering = ["order", "slug"]

    def get_queryset(self):
        from django.db.models import Count

        return BookType.objects.annotate(book_count=Count("books")).order_by("order", "slug")

    def label(self, instance) -> str:
        return instance.slug

    def perform_destroy(self, instance):
        if instance.is_system:
            raise SystemTypeError
        super().perform_destroy(instance)


class SystemTypeError(APIException):
    status_code = 409
    default_code = "system_type"
    default_detail = "System type cannot be deleted."
