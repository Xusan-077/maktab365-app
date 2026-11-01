"""Ochiq kitoblar API'si: katalog, kitob tafsiloti, sahifa rasmlari. Hammasi `public_cached`."""

from django.db.models import Q
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import generics
from rest_framework.exceptions import NotFound, ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.content import pdf_storage as storage
from apps.content.cache import is_staff, public_cached
from apps.content.models import BookLanguage
from apps.content.pdf_serializers import PdfFileUrlSerializer
from apps.content.pdf_views import _serve_ranged
from apps.content.views import GRADE_PARAM, PublicView, _int_param

from . import services
from .models import Book, BookStatus, BookType
from .serializers import (
    BookDetailSerializer,
    BookPageSerializer,
    BookPageTextSerializer,
    BookSearchHitSerializer,
    BookSerializer,
)

TAGS = ["books"]


def visible_books(request):
    """Ochiq ro'yxat: faqat nashr qilingan va tayyor. Bitta kitob: staff qoralamani ham ochadi."""
    return Book.objects.public()


def visible_book(request, pk):
    books = Book.objects.all() if is_staff(request.user) else Book.objects.public()
    book = books.filter(pk=pk).first()
    if book is None:
        raise NotFound
    return book


class BookListView(PublicView, generics.ListAPIView):
    serializer_class = BookSerializer
    filter_backends: list = []

    def get_queryset(self):
        request = self.request
        books = visible_books(request)
        if (book_type := request.query_params.get("type")) is not None:
            if book_type not in BookType.values:
                raise ValidationError({"type": ["invalid"]})
            books = books.filter(type=book_type)
        if (grade := _int_param(request, "grade")) is not None:
            books = books.filter(grade_level=grade)
        if language := request.query_params.get("language"):
            if language not in BookLanguage.values:
                raise ValidationError({"language": ["invalid"]})
            books = books.filter(language=language)
        if query := request.query_params.get("q", "").strip():
            books = books.filter(Q(title__icontains=query) | Q(author__icontains=query))
        if request.query_params.get("ordering") == "title":
            return books.order_by("title", "pk")
        return books.order_by("-created_at", "pk")

    @extend_schema(
        operation_id="books_list",
        parameters=[
            OpenApiParameter("type", OpenApiTypes.STR, enum=list(BookType.values)),
            GRADE_PARAM,
            OpenApiParameter("language", OpenApiTypes.STR, enum=list(BookLanguage.values)),
            OpenApiParameter("q", OpenApiTypes.STR, description="Nom yoki muallif bo'yicha"),
            OpenApiParameter(
                "ordering",
                OpenApiTypes.STR,
                enum=["title"],
                description="`title` — alifbo bo'yicha (standart: yangilari birinchi)",
            ),
        ],
        summary="Kitoblar katalogi (sahifalangan)",
        tags=TAGS,
    )
    @public_cached
    def get(self, request, *args, **kwargs):
        return super().get(request, *args, **kwargs)


class BookDetailView(PublicView, APIView):
    @extend_schema(
        operation_id="books_retrieve",
        responses=BookDetailSerializer,
        summary="Kitob tafsiloti (tavsif, mundarija)",
        tags=TAGS,
    )
    @public_cached
    def get(self, request, pk):
        book = visible_book(request, pk)
        return Response(BookDetailSerializer(book, context={"request": request}).data)


class BookFileUrlView(PublicView, APIView):
    throttle_classes = APIView.throttle_classes  # imzo berish: umumiy tezlik chegarasida

    @extend_schema(
        operation_id="books_file_url",
        responses=PdfFileUrlSerializer,
        summary="PDF o'qish URL'i: qisqa muddatli, keshlanmaydi, HTTP Range ishlaydi",
        tags=TAGS,
    )
    def get(self, request, pk):
        book = visible_book(request, pk)
        if not book.source_file:
            raise NotFound
        response = Response(PdfFileUrlSerializer(services.read_url(book)).data)
        response["Cache-Control"] = "private, no-store"
        return response


class BookFileView(APIView):
    """Faqat lokal (dev) saqlashda: imzolangan token bilan PDF, HTTP Range (206/416) bilan.

    S3-mos saqlashda PDF obyekt saqlashning o'zidan imzolangan URL bilan beriladi.
    """

    authentication_classes: list = []
    permission_classes: list = []
    throttle_classes: list = []

    @extend_schema(exclude=True)
    def get(self, request, pk):
        if storage.is_remote():
            raise NotFound
        book = Book.objects.filter(pk=pk).exclude(source_file="").first()
        token = request.query_params.get("token", "")
        if book is None or not storage.check_key_token(token, book.pk, book.source_file.name):
            raise NotFound
        return _serve_ranged(
            request, book.source_file.name, book.pk.hex, book.updated_at.timestamp()
        )


class BookPagesView(PublicView, APIView):
    @extend_schema(
        operation_id="books_pages",
        responses=BookPageSerializer(many=True),
        deprecated=True,
        summary="ESKI: sahifa rasmlari (faqat avval tayyorlangan kitoblar; endi PDF.js)",
        tags=TAGS,
    )
    @public_cached
    def get(self, request, pk):
        book = visible_book(request, pk)
        if book.status != BookStatus.READY and not is_staff(request.user):
            raise NotFound
        pages = book.pages.order_by("number")
        return Response(BookPageSerializer(pages, many=True, context={"request": request}).data)


SEARCH_MIN_LENGTH = 2
SEARCH_LIMIT = 50
SNIPPET_RADIUS = 40


def snippet_around(text: str, query: str) -> str:
    """Birinchi moslik atrofidagi qisqa parcha (bo'shliqlar bitta qilinadi)."""
    flat = " ".join(text.split())
    at = flat.lower().find(query.lower())
    if at < 0:
        return flat[: SNIPPET_RADIUS * 2]
    start = max(0, at - SNIPPET_RADIUS)
    end = min(len(flat), at + len(query) + SNIPPET_RADIUS)
    return f"{'…' if start else ''}{flat[start:end]}{'…' if end < len(flat) else ''}"


class BookSearchView(PublicView, APIView):
    @extend_schema(
        operation_id="books_search",
        deprecated=True,
        parameters=[
            OpenApiParameter("q", OpenApiTypes.STR, required=True, description="Kamida 2 belgi")
        ],
        responses=BookSearchHitSerializer(many=True),
        summary="Kitob ichida qidirish: moslik topilgan betlar va matn parchalari",
        tags=TAGS,
    )
    @public_cached
    def get(self, request, pk):
        book = visible_book(request, pk)
        query = request.query_params.get("q", "").strip()
        if len(query) < SEARCH_MIN_LENGTH:
            raise ValidationError({"q": ["too_short"]})
        pages = (
            book.pages.filter(text__icontains=query)
            .order_by("number")
            .values_list("number", "text")[:SEARCH_LIMIT]
        )
        hits = [{"page": number, "snippet": snippet_around(text, query)} for number, text in pages]
        return Response(BookSearchHitSerializer(hits, many=True).data)


class BookPageTextView(PublicView, APIView):
    @extend_schema(
        operation_id="books_page_text",
        deprecated=True,
        responses=BookPageTextSerializer,
        summary="Sahifa matni (badiiy kitobning matnli o'qish rejimi)",
        tags=TAGS,
    )
    @public_cached
    def get(self, request, pk, number):
        book = visible_book(request, pk)
        page = book.pages.filter(number=number).first()
        if page is None:
            raise NotFound
        return Response(BookPageTextSerializer(page).data)
