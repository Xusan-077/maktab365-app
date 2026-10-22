from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.exceptions import NotFound
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import PdfReadProgress
from .serializers import (
    MergeRequestSerializer,
    MergeResultSerializer,
    PdfBookmarkSerializer,
    PdfLibrarySerializer,
    PdfProgressSerializer,
    PdfProgressWriteSerializer,
)
from .services.merge import merge_guest_data
from .services.pdf import (
    add_pdf_bookmark,
    apply_pdf_progress,
    clamp_page,
    remove_pdf_bookmark,
    resolve_pdf_book,
    visible_bookmarks,
)
from .services.pdf import library as pdf_library

TAGS = ["learning"]


def _pdf_progress_qs(user):
    return PdfReadProgress.objects.filter(user=user).select_related("pdf_book")


class PdfProgressListView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(
        operation_id="me_pdf_progress_list",
        tags=TAGS,
        summary="PDF darsliklar bo'yicha oxirgi sahifalar (eng yangisi birinchi)",
        responses=PdfProgressSerializer(many=True),
    )
    def get(self, request):
        rows = _pdf_progress_qs(request.user).order_by("-updated_at")[:200]
        return Response(PdfProgressSerializer(rows, many=True).data)


class PdfProgressDetailView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(
        operation_id="me_pdf_progress_retrieve",
        tags=TAGS,
        responses=PdfProgressSerializer,
    )
    def get(self, request, pdf_book_id):
        book = resolve_pdf_book(request, pdf_book_id)
        row = _pdf_progress_qs(request.user).filter(pdf_book=book).first()
        if row is None:
            raise NotFound()
        return Response(PdfProgressSerializer(row).data)

    @extend_schema(
        operation_id="me_pdf_progress_update",
        tags=TAGS,
        summary="Oxirgi sahifani yozish (idempotent; qat'iy yangiroq mijoz vaqti yutadi)",
        request=PdfProgressWriteSerializer,
        responses=PdfProgressSerializer,
    )
    def put(self, request, pdf_book_id):
        serializer = PdfProgressWriteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        book = resolve_pdf_book(request, pdf_book_id)
        data = serializer.validated_data
        page = clamp_page(book, data["last_page"], strict=True)
        row, _changed = apply_pdf_progress(request.user, book, page, data.get("updated_at"))
        row.pdf_book = book
        return Response(PdfProgressSerializer(row).data)


class PdfBookmarkListView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(
        operation_id="me_pdf_bookmarks_list",
        tags=TAGS,
        summary="Saqlangan PDF darsliklar (eng yangisi birinchi)",
        responses=PdfBookmarkSerializer(many=True),
    )
    def get(self, request):
        rows = visible_bookmarks(request, request.user)[:200]
        return Response(PdfBookmarkSerializer(rows, many=True).data)


class PdfBookmarkDetailView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(
        operation_id="me_pdf_bookmarks_update",
        tags=TAGS,
        summary="Kitobni saqlash (idempotent)",
        request=None,
        responses=PdfBookmarkSerializer,
    )
    def put(self, request, pdf_book_id):
        book = resolve_pdf_book(request, pdf_book_id)
        bookmark, _created = add_pdf_bookmark(request.user, book)
        bookmark.pdf_book = book
        return Response(PdfBookmarkSerializer(bookmark).data)

    @extend_schema(
        operation_id="me_pdf_bookmarks_delete",
        tags=TAGS,
        summary="Saqlanganlardan olib tashlash (idempotent)",
        responses={204: None},
    )
    def delete(self, request, pdf_book_id):
        remove_pdf_bookmark(request.user, pdf_book_id)
        return Response(status=status.HTTP_204_NO_CONTENT)


class LibraryView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(
        operation_id="me_library",
        tags=TAGS,
        summary="Kabinet: oxirgi ochilgan PDF darsliklar va saqlanganlar soni",
        responses=PdfLibrarySerializer,
    )
    def get(self, request):
        return Response(PdfLibrarySerializer(pdf_library(request, request.user)).data)


class MergeGuestDataView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(
        operation_id="me_merge_guest_data",
        tags=TAGS,
        summary="Mehmon ma'lumotini akkauntga qo'shish (idempotent, har ro'yxat 500 tagacha)",
        request=MergeRequestSerializer,
        responses=MergeResultSerializer,
    )
    def post(self, request):
        serializer = MergeRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        result = merge_guest_data(
            request, data.get("pdf_progress", []), data.get("pdf_bookmarks", [])
        )
        return Response(MergeResultSerializer(result).data)
