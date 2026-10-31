"""Ochiq kitoblar API'si: katalog, kitob tafsiloti, sahifa rasmlari. Hammasi `public_cached`."""

from django.db.models import Q
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import generics
from rest_framework.exceptions import NotFound, ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.content.cache import is_staff, public_cached
from apps.content.models import BookLanguage
from apps.content.views import GRADE_PARAM, PublicView, _int_param

from .models import Book, BookStatus, BookType
from .serializers import BookDetailSerializer, BookPageSerializer, BookSerializer

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


class BookPagesView(PublicView, APIView):
    @extend_schema(
        operation_id="books_pages",
        responses=BookPageSerializer(many=True),
        summary="Kitob sahifalari: rasm, eskiz va o'lchamlar (tartib bilan)",
        tags=TAGS,
    )
    @public_cached
    def get(self, request, pk):
        book = visible_book(request, pk)
        if book.status != BookStatus.READY and not is_staff(request.user):
            raise NotFound
        pages = book.pages.order_by("number")
        return Response(BookPageSerializer(pages, many=True, context={"request": request}).data)
