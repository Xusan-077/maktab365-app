"""«Mening yozuvlarim»: barcha yozuvlar bet bo'yicha jamlangan (`/me/annotations/`).

Bir yozuv (entry) = bitta kitobning bitta beti: yon daftar matni, chizma/belgi/matn
annotatsiyalari va xatcho'p. Faqat o'zinikini ko'radi: har bir so'rov `user=request.user` bilan.
Ro'yxat sahifalanadi: avval (kitob, bet) kalitlari filtr bo'yicha topilib saralanadi, so'ng
faqat shu sahifadagi kalitlar uchun ma'lumot olinadi.
"""

import re
from collections import defaultdict
from uuid import UUID

from django.db.models import Max, Q
from django.http import FileResponse
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import serializers
from rest_framework.exceptions import NotFound, ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.core.permissions import IsLearner

from .me_views import valid_page
from .models import AnnotationType, Book, Bookmark, BookPage, BookStatus, PageAnnotation, PageNote
from .views import visible_book

TAGS = ["books"]
ENTRY_TYPES = ("note", "highlight", "drawing", "text", "bookmark")
DEFAULT_PAGE_SIZE = 20
MAX_PAGE_SIZE = 50
MAX_QUERY_LENGTH = 100
COLOR_RE = re.compile(r"^#[0-9a-fA-F]{6}$")

Key = tuple[UUID, int]

IMAGE_TYPES = {
    ".webp": "image/webp",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
}


class EntryBookSerializer(serializers.Serializer):
    id = serializers.UUIDField()
    title = serializers.CharField()
    cover = serializers.FileField(source="cover_image", use_url=True, read_only=True)


class EntryPageSerializer(serializers.Serializer):
    image = serializers.FileField(use_url=True, read_only=True)
    thumbnail = serializers.FileField(use_url=True, read_only=True)
    width = serializers.IntegerField()
    height = serializers.IntegerField()


class EntryAnnotationSerializer(serializers.Serializer):
    id = serializers.UUIDField()
    type = serializers.ChoiceField(choices=AnnotationType.choices)
    data = serializers.JSONField()
    updated_at = serializers.DateTimeField()


class PageEntrySerializer(serializers.Serializer):
    book = EntryBookSerializer()
    page = serializers.IntegerField()
    image = EntryPageSerializer(allow_null=True)
    note = serializers.CharField(allow_blank=True)
    note_updated_at = serializers.DateTimeField(allow_null=True)
    annotations = EntryAnnotationSerializer(many=True)
    bookmarked = serializers.BooleanField()
    updated_at = serializers.DateTimeField()


class PageEntryListSerializer(serializers.Serializer):
    count = serializers.IntegerField()
    page = serializers.IntegerField()
    page_size = serializers.IntegerField()
    results = PageEntrySerializer(many=True)


class EntryBookCountSerializer(serializers.Serializer):
    id = serializers.UUIDField()
    title = serializers.CharField()
    count = serializers.IntegerField(help_text="Yozuvi bor betlar soni")


def _ready(queryset):
    return queryset.filter(book__is_published=True, book__status=BookStatus.READY)


def _positive_int(raw: str | None, default: int, field: str, maximum: int | None = None) -> int:
    if raw in (None, ""):
        return default
    try:
        value = int(raw)
    except ValueError as error:
        raise ValidationError({field: ["invalid"]}) from error
    if value < 1:
        raise ValidationError({field: ["invalid"]})
    return min(value, maximum) if maximum else value


def parse_filters(params) -> dict:
    book = params.get("book") or None
    if book:
        try:
            book = UUID(book)
        except ValueError as error:
            raise ValidationError({"book": ["invalid"]}) from error
    kind = params.get("type") or None
    if kind and kind not in ENTRY_TYPES:
        raise ValidationError({"type": ["invalid"]})
    color = params.get("color") or None
    if color:
        if not COLOR_RE.match(color):
            raise ValidationError({"color": ["invalid"]})
        color = color.lower()
    query = (params.get("q") or "").strip()[:MAX_QUERY_LENGTH]
    return {"book": book, "type": kind, "color": color, "q": query}


def _allowed_sources(filters: dict) -> set[str]:
    allowed = {filters["type"]} if filters["type"] else set(ENTRY_TYPES)
    if filters["color"]:
        allowed &= {"highlight"}
    if filters["q"]:
        allowed &= {"note", "text"}
    return allowed


def entry_keys(user, filters: dict) -> dict[Key, object]:
    """Filtrga mos (kitob, bet) kalitlari va ularning oxirgi o'zgarish vaqti."""
    allowed = _allowed_sources(filters)
    book = filters["book"]
    found: dict[Key, object] = {}

    def collect(queryset, stamp: str):
        queryset = _ready(queryset)
        if book:
            queryset = queryset.filter(book_id=book)
        for book_id, page, at in queryset.values_list("book_id", "page").annotate(at=Max(stamp)):
            key = (book_id, page)
            if key not in found or at > found[key]:
                found[key] = at

    if "note" in allowed:
        notes = PageNote.objects.filter(user=user).exclude(text="")
        if filters["q"]:
            notes = notes.filter(text__icontains=filters["q"])
        collect(notes, "updated_at")
    annotations = PageAnnotation.objects.filter(user=user)
    for kind in ("highlight", "drawing", "text"):
        if kind not in allowed:
            continue
        rows = annotations.filter(type=kind)
        if kind == "highlight" and filters["color"]:
            rows = rows.filter(data__color__iexact=filters["color"])
        if kind == "text" and filters["q"]:
            rows = rows.filter(data__text__icontains=filters["q"])
        collect(rows, "updated_at")
    if "bookmark" in allowed:
        collect(Bookmark.objects.filter(user=user), "created_at")
    return found


def _sorted_keys(found: dict[Key, object]) -> list[Key]:
    """Kitoblar oxirgi faolligi bo'yicha (yangisi birinchi), kitob ichida bet tartibida."""
    latest: dict[UUID, object] = {}
    for (book_id, _page), at in found.items():
        if book_id not in latest or at > latest[book_id]:
            latest[book_id] = at
    return sorted(found, key=lambda key: (-latest[key[0]].timestamp(), str(key[0]), key[1]))


def build_entries(user, keys: list[Key]) -> list[dict]:
    if not keys:
        return []
    match = Q()
    for book_id, page in keys:
        match |= Q(book_id=book_id, page=page)
    notes = {(n.book_id, n.page): n for n in PageNote.objects.filter(user=user).filter(match)}
    marks = {(m.book_id, m.page) for m in Bookmark.objects.filter(user=user).filter(match)}
    by_key: dict[Key, list[PageAnnotation]] = defaultdict(list)
    for item in PageAnnotation.objects.filter(user=user).filter(match):
        by_key[(item.book_id, item.page)].append(item)
    books = Book.objects.in_bulk({book_id for book_id, _ in keys})
    page_match = Q()
    for book_id, page in keys:
        page_match |= Q(book_id=book_id, number=page)
    pages = {(p.book_id, p.number): p for p in BookPage.objects.filter(page_match)}

    entries = []
    for key in keys:
        note = notes.get(key)
        annotations = by_key.get(key, [])
        stamps = [a.updated_at for a in annotations]
        if note:
            stamps.append(note.updated_at)
        entries.append(
            {
                "book": books[key[0]],
                "page": key[1],
                "image": pages.get(key),
                "note": note.text if note else "",
                "note_updated_at": note.updated_at if note else None,
                "annotations": annotations,
                "bookmarked": key in marks,
                "updated_at": max(stamps) if stamps else None,
            }
        )
    return entries


class MyEntriesView(APIView):
    permission_classes = [IsLearner]

    @extend_schema(
        operation_id="me_annotations_list",
        tags=TAGS,
        summary="Mening yozuvlarim: bet bo'yicha jamlangan (yon daftar, annotatsiya, xatcho'p)",
        parameters=[
            OpenApiParameter("book", OpenApiTypes.UUID, description="Kitob bo'yicha"),
            OpenApiParameter(
                "type", OpenApiTypes.STR, enum=list(ENTRY_TYPES), description="Yozuv turi"
            ),
            OpenApiParameter("color", OpenApiTypes.STR, description="Belgilash rangi (#rrggbb)"),
            OpenApiParameter("q", OpenApiTypes.STR, description="Yon daftar va matn bo'yicha"),
            OpenApiParameter("page", OpenApiTypes.INT, description="Sahifa raqami (1 dan)"),
            OpenApiParameter(
                "page_size", OpenApiTypes.INT, description=f"1..{MAX_PAGE_SIZE}, standart 20"
            ),
        ],
        responses=PageEntryListSerializer,
    )
    def get(self, request):
        params = request.query_params
        filters = parse_filters(params)
        size = _positive_int(params.get("page_size"), DEFAULT_PAGE_SIZE, "page_size", MAX_PAGE_SIZE)
        page = _positive_int(params.get("page"), 1, "page")
        keys = _sorted_keys(entry_keys(request.user, filters))
        chunk = keys[(page - 1) * size : page * size]
        payload = {
            "count": len(keys),
            "page": page,
            "page_size": size,
            "results": build_entries(request.user, chunk),
        }
        return Response(PageEntryListSerializer(payload, context={"request": request}).data)


class MyEntryBooksView(APIView):
    permission_classes = [IsLearner]

    @extend_schema(
        operation_id="me_annotations_books",
        tags=TAGS,
        summary="Yozuvi bor kitoblar (filtr ro'yxati uchun)",
        responses=EntryBookCountSerializer(many=True),
    )
    def get(self, request):
        keys = entry_keys(request.user, {"book": None, "type": None, "color": None, "q": ""})
        counts: dict[UUID, int] = defaultdict(int)
        for book_id, _page in keys:
            counts[book_id] += 1
        books = Book.objects.in_bulk(counts)
        rows = [
            {"id": book_id, "title": books[book_id].title, "count": count}
            for book_id, count in counts.items()
        ]
        rows.sort(key=lambda row: row["title"].lower())
        return Response(EntryBookCountSerializer(rows, many=True).data)


class MyPageImageView(APIView):
    """Sahifa rasmi (eksport uchun): brauzer canvas'i boshqa origin'dagi rasmni o'qiy olmaydi
    (CORS), shuning uchun rasm shu API orqali, BFF bilan bir origin'da beriladi."""

    permission_classes = [IsLearner]

    @extend_schema(
        operation_id="me_books_page_image",
        tags=TAGS,
        summary="Sahifa rasmi baytlari (yozuvli eksport uchun)",
        responses={(200, "image/*"): OpenApiTypes.BINARY},
    )
    def get(self, request, pk, number):
        book = visible_book(request, pk)
        page = valid_page(book, number)
        row = BookPage.objects.filter(book=book, number=page).first()
        if row is None or not row.image:
            raise NotFound
        suffix = "." + row.image.name.rsplit(".", 1)[-1].lower()
        content_type = IMAGE_TYPES.get(suffix, "application/octet-stream")
        response = FileResponse(row.image.open("rb"), content_type=content_type)
        response["Cache-Control"] = "private, max-age=3600"
        return response
