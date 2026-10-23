"""Ochiq PDF darsliklar API'si: katalog, imzolangan o'qish URL'i va (dev) Range bilan fayl."""

import re
from email.utils import formatdate

from django.core.files.storage import default_storage
from django.db.models import Count, Q
from django.http import HttpResponse, StreamingHttpResponse
from django.utils import timezone
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import generics
from rest_framework.exceptions import NotFound
from rest_framework.response import Response
from rest_framework.views import APIView

from . import pdf_storage as storage
from .cache import public_cached
from .models import PdfBook, PdfBookChapter, Subject
from .pdf_serializers import PdfBookDetailSerializer, PdfBookSerializer, PdfFileUrlSerializer
from .pdf_services import visible_pdf_books
from .serializers import SubjectSerializer
from .views import GRADE_PARAM, SUBJECT_PARAM, PublicView, _int_param

TAGS = ["content"]
CHUNK = 64 * 1024
RANGE_RE = re.compile(r"^bytes=(\d*)-(\d*)$")


class PdfBookListView(PublicView, generics.ListAPIView):
    serializer_class = PdfBookSerializer
    filter_backends: list = []

    def get_queryset(self):
        request = self.request
        books = visible_pdf_books(request)
        if (grade := _int_param(request, "grade")) is not None:
            books = books.filter(grade=grade)
        if subject := request.query_params.get("subject"):
            books = books.filter(subject__slug=subject)
        if query := request.query_params.get("q", "").strip():
            books = books.filter(
                Q(title__uz__icontains=query)
                | Q(title__ru__icontains=query)
                | Q(title__en__icontains=query)
            )
        return books.order_by("grade", "subject__order", "-created_at", "pk")

    @extend_schema(
        operation_id="pdf_books_list",
        parameters=[
            GRADE_PARAM,
            SUBJECT_PARAM,
            OpenApiParameter("q", OpenApiTypes.STR, description="Kitob nomi bo'yicha"),
        ],
        summary="PDF darsliklar (sahifalangan)",
        tags=TAGS,
    )
    @public_cached
    def get(self, request, *args, **kwargs):
        return super().get(request, *args, **kwargs)


class PdfBookSubjectListView(PublicView, APIView):
    @extend_schema(
        operation_id="pdf_books_subjects_list",
        parameters=[GRADE_PARAM],
        responses=SubjectSerializer(many=True),
        summary="PDF darsligi bor fanlar (ixtiyoriy: sinf bo'yicha), `books_count` — PDF soni",
        tags=TAGS,
    )
    @public_cached
    def get(self, request):
        visible = visible_pdf_books(request)
        if (grade := _int_param(request, "grade")) is not None:
            visible = visible.filter(grade=grade)
        counts = dict(
            visible.order_by()
            .values("subject_id")
            .annotate(n=Count("pk"))
            .values_list("subject_id", "n")
        )
        subjects = [s for s in Subject.objects.order_by("order", "slug") if s.pk in counts]
        for subject in subjects:
            subject.books_count = counts[subject.pk]
        return Response(SubjectSerializer(subjects, many=True).data)


def _visible_book_or_404(request, pk) -> PdfBook:
    book = visible_pdf_books(request).filter(pk=pk).first()
    if book is None:
        raise NotFound("Kitob topilmadi.")
    return book


class PdfBookDetailView(PublicView, APIView):
    @extend_schema(
        operation_id="pdf_books_retrieve",
        responses=PdfBookDetailSerializer,
        summary="PDF darslik",
        tags=TAGS,
    )
    @public_cached
    def get(self, request, pk):
        book = _visible_book_or_404(request, pk)
        return Response(PdfBookDetailSerializer(book, context={"request": request}).data)


class PdfFileUrlView(PublicView, APIView):
    throttle_classes = APIView.throttle_classes  # imzo berish: umumiy tezlik chegarasida

    @extend_schema(
        operation_id="pdf_books_file_url",
        responses=PdfFileUrlSerializer,
        summary="Qisqa muddatli o'qish URL'i (keshlanmaydi)",
        tags=TAGS,
    )
    def get(self, request, pk):
        book = _visible_book_or_404(request, pk)
        response = Response(PdfFileUrlSerializer(storage.read_url(book)).data)
        response["Cache-Control"] = "private, no-store"
        return response


def _parse_range(header: str, size: int) -> tuple[int, int] | None | str:
    """`(start, end)`, `None` (butun fayl) yoki `"invalid"` (416)."""
    match = RANGE_RE.match(header.strip())
    if not match:
        return None  # tushunarsiz yoki ko'p oraliqli so'rov — butun fayl
    first, last = match.groups()
    if not first and not last:
        return None
    if not first:  # oxirgi N bayt
        length = int(last)
        if length == 0:
            return "invalid"
        return max(size - length, 0), size - 1
    start = int(first)
    end = min(int(last), size - 1) if last else size - 1
    if start >= size or start > end:
        return "invalid"
    return start, end


def _iterate(key: str, start: int, end: int):
    remaining = end - start + 1
    with default_storage.open(key, "rb") as handle:
        handle.seek(start)
        while remaining > 0:
            chunk = handle.read(min(CHUNK, remaining))
            if not chunk:
                break
            remaining -= len(chunk)
            yield chunk


def _serve_ranged(request, key: str, etag_seed: str, modified: float):
    """Lokal saqlashdagi faylni HTTP Range (206/416) va ETag (304) bilan beradi."""
    size = default_storage.size(key)
    etag = f'"{etag_seed}-{size}"'
    base = {
        "Accept-Ranges": "bytes",
        "ETag": etag,
        "Cache-Control": "private, max-age=600",
        "Content-Disposition": "inline",
        "Last-Modified": formatdate(modified, usegmt=True),
    }
    if request.META.get("HTTP_IF_NONE_MATCH") == etag:
        response = HttpResponse(status=304)
        for name, value in base.items():
            response[name] = value
        return response

    header = request.META.get("HTTP_RANGE", "")
    if_range = request.META.get("HTTP_IF_RANGE")
    window = None if (if_range and if_range != etag) else _parse_range(header, size)
    if window == "invalid":
        response = HttpResponse(status=416)
        response["Content-Range"] = f"bytes */{size}"
        return response

    start, end = window if window else (0, size - 1)
    response = StreamingHttpResponse(
        _iterate(key, start, end),
        status=206 if window else 200,
        content_type=storage.PDF_MIME,
    )
    response["Content-Length"] = str(end - start + 1)
    if window:
        response["Content-Range"] = f"bytes {start}-{end}/{size}"
    for name, value in base.items():
        response[name] = value
    return response


class PdfFileView(APIView):
    """Faqat lokal (dev) saqlashda: imzolangan token bilan, HTTP Range qo'llab-quvvatlanadi.

    S3-mos saqlashda fayl obyekt saqlashning o'zidan imzolangan URL bilan beriladi.
    """

    authentication_classes: list = []
    permission_classes: list = []
    throttle_classes: list = []

    @extend_schema(exclude=True)
    def get(self, request, pk):
        if storage.is_remote():
            raise NotFound()
        book = PdfBook.objects.filter(pk=pk).exclude(file="").first()
        token = request.query_params.get("token", "")
        if book is None or not storage.check_file_token(token, book):
            raise NotFound()
        return _serve_ranged(request, book.file.name, book.pk.hex, book.updated_at.timestamp())


def _chapter_with_slides_or_404(request, pk, chapter_id) -> tuple[PdfBook, PdfBookChapter]:
    """Ko'rinadigan kitobning prezentatsiyasi bor bo'limi (aks holda 404)."""
    book = _visible_book_or_404(request, pk)
    chapter = (
        PdfBookChapter.objects.filter(book=book, pk=chapter_id).exclude(slides_file="").first()
    )
    if chapter is None:
        raise NotFound("Prezentatsiya topilmadi.")
    return book, chapter


class PdfChapterSlidesUrlView(PublicView, APIView):
    throttle_classes = APIView.throttle_classes  # imzo berish: umumiy tezlik chegarasida

    @extend_schema(
        operation_id="pdf_books_chapter_slides_url",
        responses=PdfFileUrlSerializer,
        summary="Bo'lim prezentatsiyasining qisqa muddatli o'qish URL'i (keshlanmaydi)",
        tags=TAGS,
    )
    def get(self, request, pk, chapter_id):
        book, chapter = _chapter_with_slides_or_404(request, pk, chapter_id)
        response = Response(PdfFileUrlSerializer(storage.slides_read_url(book, chapter)).data)
        response["Cache-Control"] = "private, no-store"
        return response


class PdfChapterSlidesFileView(APIView):
    """Lokal (dev) saqlashda prezentatsiya fayli: imzolangan token, HTTP Range."""

    authentication_classes: list = []
    permission_classes: list = []
    throttle_classes: list = []

    @extend_schema(exclude=True)
    def get(self, request, pk, chapter_id):
        if storage.is_remote():
            raise NotFound()
        chapter = (
            PdfBookChapter.objects.filter(book_id=pk, pk=chapter_id).exclude(slides_file="").first()
        )
        token = request.query_params.get("token", "")
        if chapter is None or not storage.check_key_token(token, pk, chapter.slides_file):
            raise NotFound()
        modified = (chapter.slides_updated_at or timezone.now()).timestamp()
        return _serve_ranged(request, chapter.slides_file, chapter.pk.hex, modified)
