from django.conf import settings
from django.db import transaction
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import OpenApiParameter, extend_schema, extend_schema_view
from rest_framework.decorators import action
from rest_framework.exceptions import NotFound
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.response import Response

from apps.accounts import audit
from apps.core.throttling import PdfUploadThrottle

from . import ocr as ocr_service
from . import pdf_services as services
from . import pdf_storage as storage
from . import slides_services as slides
from .admin_services import UploadError
from .admin_views import TAG, AdminViewSet, IsAdmin
from .models import PdfBook, PdfBookChapter
from .pdf_serializers import (
    PdfBookAdminSerializer,
    PdfTransitionSerializer,
    PdfUploadCompleteSerializer,
    PdfUploadFileSerializer,
    PdfUploadInitSerializer,
    PdfUploadPlanSerializer,
)

CHAPTER_PATH = r"chapters/(?P<chapter_id>[0-9a-fA-F-]{36})/slides"
CHAPTER_PARAM = OpenApiParameter("chapter_id", OpenApiTypes.UUID, OpenApiParameter.PATH)


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
        "cover_mode",
    )
    serializer_class = PdfBookAdminSerializer
    http_method_names = ["get", "post", "patch", "delete", "head", "options"]
    search_fields = ["title__uz", "title__ru", "title__en"]
    ordering_fields = ["grade", "updated_at", "created_at", "page_count"]
    ordering = ["grade", "-created_at"]

    def get_permissions(self):
        # Prezentatsiyani olib tashlash kitobni o'chirish kabi — faqat admin.
        if self.action == "slides_delete":
            return [IsAdmin()]
        return super().get_permissions()

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
        with transaction.atomic():
            pk = instance.pk
            # Saqlash xatosida (`storage_error`) tranzaksiya qaytadi: kitob va audit saqlanmaydi.
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
        operation_id="admin_pdf_books_duplicate",
        tags=TAG,
        summary="Nusxalash: mundarija va tavsif bilan yangi qoralama (fayl ko'chirilmaydi)",
        request=None,
        responses={201: PdfBookAdminSerializer},
    )
    @action(detail=True, methods=["post"])
    def duplicate(self, request, pk=None):
        source = self.get_object()
        with transaction.atomic():
            copy = services.duplicate_book(source)
            audit.record(
                request.user,
                "duplicate",
                self.target_type,
                copy.pk,
                label=self.label(copy),
                before={"source_id": str(source.pk)},
                after=self.snap(copy),
                request=request,
            )
        fresh = self.get_queryset().get(pk=copy.pk)
        data = PdfBookAdminSerializer(fresh, context=self.get_serializer_context()).data
        return Response(data, status=201)

    @extend_schema(
        operation_id="admin_pdf_books_ocr",
        tags=TAG,
        summary=(
            "OCR so'rash (matn qatlami yo'q kitob): holat `ocr_status` da. Xatolar: "
            "`ocr_disabled` (503), `no_file`, `ocr_not_needed`, `ocr_in_progress` (409)"
        ),
        request=None,
        responses={202: PdfBookAdminSerializer},
    )
    @action(detail=True, methods=["post"])
    def ocr(self, request, pk=None):
        book = self.get_object()
        with transaction.atomic():
            ocr_service.request_ocr(book)
            self.log("ocr_request", book)
        fresh = self.get_queryset().get(pk=book.pk)
        data = PdfBookAdminSerializer(fresh, context=self.get_serializer_context()).data
        return Response(data, status=202)

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

    # --- Bo'lim prezentatsiyalari (ixtiyoriy PDF slaydlar) ---

    def _chapter(self, book: PdfBook, chapter_id) -> PdfBookChapter:
        chapter = PdfBookChapter.objects.filter(book=book, pk=chapter_id).first()
        if chapter is None:
            raise NotFound("Bo'lim topilmadi.")
        return chapter

    def _slides_snapshot(self, chapter: PdfBookChapter) -> dict | None:
        info = chapter.slides_info
        if info is None:
            return None
        return {key: info[key] for key in ("name", "page_count", "size_bytes")}

    def _slides_log(self, action_name, book, chapter, before, after):
        audit.record(
            self.request.user,
            action_name,
            "pdf_book_slides",
            chapter.pk,
            label=f"{self.label(book)} / {chapter.title}",
            before={"book_id": str(book.pk), "slides": before},
            after={"book_id": str(book.pk), "slides": after},
            request=self.request,
        )

    def _book_response(self, book: PdfBook) -> Response:
        fresh = self.get_queryset().get(pk=book.pk)
        return Response(PdfBookAdminSerializer(fresh, context=self.get_serializer_context()).data)

    @extend_schema(
        operation_id="admin_pdf_books_slides_upload_init",
        tags=TAG,
        summary="Bo'lim prezentatsiyasini yuklashni boshlash (yangi yoki almashtirish)",
        parameters=[CHAPTER_PARAM],
        request=PdfUploadInitSerializer,
        responses=PdfUploadPlanSerializer,
    )
    @action(
        detail=True,
        methods=["post"],
        url_path=f"{CHAPTER_PATH}/upload-init",
        url_name="slides-upload-init",
        throttle_classes=[PdfUploadThrottle],
        parser_classes=[JSONParser, FormParser],
    )
    def slides_upload_init(self, request, pk=None, chapter_id=None):
        chapter = self._chapter(self.get_object(), chapter_id)
        body = PdfUploadInitSerializer(data=request.data)
        body.is_valid(raise_exception=True)
        data = body.validated_data
        plan = slides.begin_upload(chapter, data["filename"], data["size"], data["content_type"])
        return Response(
            {
                "mode": plan.mode,
                "part_size": plan.part_size,
                "part_urls": list(plan.part_urls),
                "expires_in": settings.PDF_SIGNED_URL_SECONDS,
            }
        )

    @extend_schema(
        operation_id="admin_pdf_books_slides_upload_complete",
        tags=TAG,
        summary="Prezentatsiya multipart yuklashini yakunlash: tekshiruv, slaydlar soni",
        parameters=[CHAPTER_PARAM],
        request=PdfUploadCompleteSerializer,
        responses=PdfBookAdminSerializer,
    )
    @action(
        detail=True,
        methods=["post"],
        url_path=f"{CHAPTER_PATH}/upload-complete",
        url_name="slides-upload-complete",
        throttle_classes=[PdfUploadThrottle],
    )
    def slides_upload_complete(self, request, pk=None, chapter_id=None):
        book = self.get_object()
        chapter = self._chapter(book, chapter_id)
        body = PdfUploadCompleteSerializer(data=request.data)
        body.is_valid(raise_exception=True)
        before = self._slides_snapshot(chapter)
        saved = slides.complete_direct(
            chapter, body.validated_data["parts"], body.validated_data.get("filename", "")
        )
        self._slides_log("slides_upload", book, saved, before, self._slides_snapshot(saved))
        return self._book_response(book)

    @extend_schema(
        operation_id="admin_pdf_books_slides_upload_file",
        tags=TAG,
        summary="Lokal (dev) rejim: prezentatsiyani backend orqali yuklash",
        parameters=[CHAPTER_PARAM],
        request={"multipart/form-data": PdfUploadFileSerializer},
        responses=PdfBookAdminSerializer,
    )
    @action(
        detail=True,
        methods=["post"],
        url_path=f"{CHAPTER_PATH}/upload",
        url_name="slides-upload",
        throttle_classes=[PdfUploadThrottle],
        parser_classes=[MultiPartParser],
    )
    def slides_upload(self, request, pk=None, chapter_id=None):
        if storage.is_remote():
            raise UploadError("direct_upload_required", 409)
        book = self.get_object()
        chapter = self._chapter(book, chapter_id)
        body = PdfUploadFileSerializer(data=request.data)
        body.is_valid(raise_exception=True)
        before = self._slides_snapshot(chapter)
        saved = slides.store_proxy(chapter, body.validated_data["file"])
        self._slides_log("slides_upload", book, saved, before, self._slides_snapshot(saved))
        return self._book_response(book)

    @extend_schema(
        operation_id="admin_pdf_books_slides_upload_abort",
        tags=TAG,
        summary="Tugallanmagan prezentatsiya yuklashini bekor qilish",
        parameters=[CHAPTER_PARAM],
        request=None,
        responses={204: None},
    )
    @action(
        detail=True,
        methods=["post"],
        url_path=f"{CHAPTER_PATH}/upload-abort",
        url_name="slides-upload-abort",
        throttle_classes=[PdfUploadThrottle],
    )
    def slides_upload_abort(self, request, pk=None, chapter_id=None):
        chapter = self._chapter(self.get_object(), chapter_id)
        slides.abort(chapter)
        return Response(status=204)

    @extend_schema(
        operation_id="admin_pdf_books_slides_delete",
        tags=TAG,
        summary="Bo'lim prezentatsiyasini o'chirish (faqat admin)",
        parameters=[CHAPTER_PARAM],
        responses={200: PdfBookAdminSerializer},
    )
    @action(
        detail=True,
        methods=["delete"],
        url_path=CHAPTER_PATH,
        url_name="slides-delete",
    )
    def slides_delete(self, request, pk=None, chapter_id=None):
        book = self.get_object()
        chapter = self._chapter(book, chapter_id)
        before = self._slides_snapshot(chapter)
        with transaction.atomic():
            # Saqlash xatosida (`storage_error`) hech narsa o'zgarmaydi.
            slides.remove(chapter)
            self._slides_log("slides_delete", book, chapter, before, None)
        return self._book_response(book)
