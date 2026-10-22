from rest_framework import serializers

from apps.content.pdf_serializers import PdfBookSerializer

from .models import PdfBookmark, PdfReadProgress
from .services.merge import MERGE_LIMIT

# --- PDF oxirgi sahifa, kutubxona, xatcho'plar ---


class PdfProgressWriteSerializer(serializers.Serializer):
    """PUT: PDF darslikda oxirgi sahifa. `updated_at` — mijozdagi yozuv vaqti."""

    last_page = serializers.IntegerField(min_value=1, max_value=100000)
    updated_at = serializers.DateTimeField(required=False)


class PdfProgressSerializer(serializers.ModelSerializer):
    pdf_book_id = serializers.UUIDField(read_only=True)
    last_page = serializers.SerializerMethodField()

    class Meta:
        model = PdfReadProgress
        fields = ["pdf_book_id", "last_page", "updated_at"]
        read_only_fields = fields

    def get_last_page(self, row) -> int:
        # Kitob qisqa fayl bilan almashtirilgan bo'lsa ham chegaradan chiqmaydi.
        return min(row.last_page, row.pdf_book.page_count) if row.pdf_book.page_count else 1


class PdfLibraryItemSerializer(serializers.ModelSerializer):
    book = PdfBookSerializer(source="pdf_book")
    last_page = serializers.SerializerMethodField()

    class Meta:
        model = PdfReadProgress
        fields = ["book", "last_page", "updated_at"]
        read_only_fields = fields

    def get_last_page(self, row) -> int:
        return min(row.last_page, row.pdf_book.page_count) if row.pdf_book.page_count else 1


class PdfLibrarySerializer(serializers.Serializer):
    items = PdfLibraryItemSerializer(many=True)
    saved_count = serializers.IntegerField()


class PdfBookmarkSerializer(serializers.ModelSerializer):
    book = PdfBookSerializer(source="pdf_book")

    class Meta:
        model = PdfBookmark
        fields = ["book", "created_at"]
        read_only_fields = fields


# --- mehmon ma'lumotini qo'shish ---


class GuestPdfProgressSerializer(PdfProgressWriteSerializer):
    pdf_book_id = serializers.CharField(max_length=64)


class MergeRequestSerializer(serializers.Serializer):
    pdf_progress = GuestPdfProgressSerializer(many=True, required=False, max_length=MERGE_LIMIT)
    pdf_bookmarks = serializers.ListField(
        child=serializers.CharField(max_length=64), required=False, max_length=MERGE_LIMIT
    )


class MergeResultSerializer(serializers.Serializer):
    pdf_progress = serializers.IntegerField()
    pdf_bookmarks = serializers.IntegerField()
    failed = serializers.ListField(child=serializers.CharField())
