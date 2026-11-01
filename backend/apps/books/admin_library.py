"""Admin "Kutubxona": maktab darsliklari (`PdfBook`) va kutubxona kitoblari (`Book`)."""

from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import serializers
from rest_framework.views import APIView

from apps.content.admin_views import IsEditor
from apps.content.models import PdfBook, PdfBookStatus
from apps.content.serializers import LocalizedField
from apps.core.pagination import DefaultPagination

from .models import TEXTBOOK_TYPE_SLUG, Book, BookType

ROW_LIMIT = 2000  # har manbadan (admin hajmi); undan ko'pi saralashda kesiladi


class LibraryRowSerializer(serializers.Serializer):
    kind = serializers.ChoiceField(
        choices=["book", "textbook"], help_text="`textbook` — PdfBook (maktab darsligi)"
    )
    id = serializers.UUIDField()
    slug = serializers.CharField()
    title = serializers.CharField()
    subtitle = serializers.CharField(allow_blank=True)
    type_slug = serializers.CharField()
    type_name = LocalizedField()
    reading_mode = serializers.CharField(allow_blank=True)
    grade = serializers.IntegerField(allow_null=True)
    language = serializers.CharField()
    cover = serializers.CharField(allow_null=True)
    page_count = serializers.IntegerField()
    is_published = serializers.BooleanField()
    status = serializers.CharField()
    created_at = serializers.DateTimeField()


class LibraryPageSerializer(serializers.Serializer):
    count = serializers.IntegerField()
    next = serializers.CharField(allow_null=True)
    previous = serializers.CharField(allow_null=True)
    results = LibraryRowSerializer(many=True)


def _url(request, field):
    if not field:
        return None
    url = field.url
    return request.build_absolute_uri(url) if url.startswith("/") else url


def _book_rows(request, params, types):
    qs = Book.objects.select_related("book_type")
    if slug := params.get("type"):
        qs = qs.filter(book_type__slug=slug)
    if q := params.get("q", "").strip():
        qs = qs.filter(title__icontains=q) | qs.filter(author__icontains=q)
    if (published := params.get("published")) in ("true", "false"):
        qs = qs.filter(is_published=published == "true")
    for book in qs.order_by("-created_at")[:ROW_LIMIT]:
        yield {
            "kind": "book",
            "id": book.pk,
            "slug": book.slug,
            "title": book.title,
            "subtitle": book.author,
            "type_slug": book.book_type.slug,
            "type_name": book.book_type.name,
            "reading_mode": book.reading_mode,
            "grade": book.grade_level,
            "language": book.language,
            "cover": _url(request, book.public_cover),
            "page_count": book.page_count,
            "is_published": book.is_published,
            "status": book.status,
            "created_at": book.created_at,
        }


def _textbook_rows(request, params, types):
    textbook_type = types.get(TEXTBOOK_TYPE_SLUG)
    qs = PdfBook.objects.select_related("subject")
    if q := params.get("q", "").strip():
        qs = qs.filter(title__uz__icontains=q) | qs.filter(title__ru__icontains=q)
    if (published := params.get("published")) in ("true", "false"):
        qs = qs.filter(status=PdfBookStatus.PUBLISHED if published == "true" else "draft")
    for book in qs.order_by("-created_at")[:ROW_LIMIT]:
        yield {
            "kind": "textbook",
            "id": book.pk,
            "slug": book.slug,
            "title": (book.title or {}).get("uz", book.slug),
            "subtitle": (book.subject.title or {}).get("uz", ""),
            "type_slug": TEXTBOOK_TYPE_SLUG,
            "type_name": textbook_type.name if textbook_type else {"uz": "Maktab darsliklari"},
            "reading_mode": "",
            "grade": book.grade,
            "language": book.language,
            "cover": _url(request, book.cover_small or book.cover),
            "page_count": book.page_count,
            "is_published": book.status == PdfBookStatus.PUBLISHED,
            "status": book.status,
            "created_at": book.created_at,
        }


class AdminLibraryView(APIView):
    permission_classes = [IsEditor]

    @extend_schema(
        operation_id="admin_library_list",
        tags=["admin"],
        parameters=[
            OpenApiParameter("type", OpenApiTypes.STR, description="Tur slug'i; bo'sh — hammasi"),
            OpenApiParameter("q", OpenApiTypes.STR),
            OpenApiParameter("published", OpenApiTypes.BOOL),
            OpenApiParameter("page", OpenApiTypes.INT),
            OpenApiParameter("page_size", OpenApiTypes.INT),
        ],
        responses=LibraryPageSerializer,
        summary="Kutubxona: darsliklar va kitoblar bitta ro'yxatda (yangilari birinchi)",
    )
    def get(self, request):
        params = request.query_params
        types = {t.slug: t for t in BookType.objects.all()}
        wanted = params.get("type", "")
        rows = []
        if wanted in ("", TEXTBOOK_TYPE_SLUG):
            rows += _textbook_rows(request, params, types)
        if wanted != TEXTBOOK_TYPE_SLUG:
            rows += _book_rows(request, params, types)
        rows.sort(key=lambda row: row["created_at"], reverse=True)
        paginator = DefaultPagination()
        page = paginator.paginate_queryset(rows, request)
        return paginator.get_paginated_response(LibraryRowSerializer(page, many=True).data)
