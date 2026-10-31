"""Kirgan o'quvchining kitoblardagi holati: oxirgi bet va xatcho'plar (`/me/books/...`)."""

from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.exceptions import NotFound, ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.core.permissions import IsLearner

from .models import Book, Bookmark, BookStatus, UserBookProgress
from .serializers import (
    BookmarkSerializer,
    BookmarkWriteSerializer,
    BookProgressSerializer,
    BookProgressWriteSerializer,
)
from .views import visible_book

TAGS = ["books"]
BOOKMARKS_PER_BOOK = 200
PROGRESS_LIST_LIMIT = 200


def valid_page(book: Book, page: int) -> int:
    if page > max(book.page_count, 1):
        raise ValidationError({"page": ["out_of_range"]})
    return page


class MyBookProgressListView(APIView):
    permission_classes = [IsLearner]

    @extend_schema(
        operation_id="me_books_progress_list",
        tags=TAGS,
        summary="Kitoblar bo'yicha oxirgi betlar (eng yangisi birinchi)",
        responses=BookProgressSerializer(many=True),
    )
    def get(self, request):
        rows = (
            UserBookProgress.objects.filter(
                user=request.user, book__is_published=True, book__status=BookStatus.READY
            )
            .select_related("book")
            .order_by("-updated_at")[:PROGRESS_LIST_LIMIT]
        )
        return Response(BookProgressSerializer(rows, many=True).data)


class MyBookProgressView(APIView):
    permission_classes = [IsLearner]

    @extend_schema(
        operation_id="me_books_progress_retrieve",
        tags=TAGS,
        responses=BookProgressSerializer,
    )
    def get(self, request, pk):
        book = visible_book(request, pk)
        row = UserBookProgress.objects.filter(user=request.user, book=book).first()
        if row is None:
            raise NotFound
        return Response(BookProgressSerializer(row).data)

    @extend_schema(
        operation_id="me_books_progress_update",
        tags=TAGS,
        summary="Oxirgi betni yozish (idempotent; qat'iy yangiroq mijoz vaqti yutadi)",
        request=BookProgressWriteSerializer,
        responses=BookProgressSerializer,
    )
    def put(self, request, pk):
        serializer = BookProgressWriteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        book = visible_book(request, pk)
        data = serializer.validated_data
        page = valid_page(book, data["last_page"])
        client_time = data.get("updated_at")
        row, created = UserBookProgress.objects.get_or_create(
            user=request.user,
            book=book,
            defaults={"last_page": page, "client_updated_at": client_time},
        )
        stale = (
            not created
            and client_time is not None
            and row.client_updated_at is not None
            and client_time <= row.client_updated_at
        )
        if not created and not stale:
            row.last_page = page
            row.client_updated_at = client_time
            row.save(update_fields=["last_page", "client_updated_at", "updated_at"])
        return Response(BookProgressSerializer(row).data)


class MyBookmarksView(APIView):
    permission_classes = [IsLearner]

    @extend_schema(
        operation_id="me_books_bookmarks_list",
        tags=TAGS,
        summary="Kitobdagi xatcho'plar (bet bo'yicha)",
        responses=BookmarkSerializer(many=True),
    )
    def get(self, request, pk):
        book = visible_book(request, pk)
        rows = Bookmark.objects.filter(user=request.user, book=book).order_by("page")
        return Response(BookmarkSerializer(rows, many=True).data)

    @extend_schema(
        operation_id="me_books_bookmarks_create",
        tags=TAGS,
        summary="Betga xatcho'p qo'yish (idempotent)",
        request=BookmarkWriteSerializer,
        responses={200: BookmarkSerializer, 201: BookmarkSerializer},
    )
    def post(self, request, pk):
        serializer = BookmarkWriteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        book = visible_book(request, pk)
        page = valid_page(book, serializer.validated_data["page"])
        mine = Bookmark.objects.filter(user=request.user, book=book)
        existing = mine.filter(page=page).first()
        if existing is not None:
            return Response(BookmarkSerializer(existing).data)
        if mine.count() >= BOOKMARKS_PER_BOOK:
            raise ValidationError({"page": ["too_many"]})
        created = Bookmark.objects.create(user=request.user, book=book, page=page)
        return Response(BookmarkSerializer(created).data, status=status.HTTP_201_CREATED)


class MyBookmarkDetailView(APIView):
    permission_classes = [IsLearner]

    @extend_schema(
        operation_id="me_books_bookmarks_delete",
        tags=TAGS,
        summary="Xatcho'pni olib tashlash (idempotent)",
        responses={204: None},
    )
    def delete(self, request, pk, page):
        book = visible_book(request, pk)
        Bookmark.objects.filter(user=request.user, book=book, page=page).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
