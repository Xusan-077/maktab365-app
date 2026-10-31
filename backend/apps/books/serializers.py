"""Ochiq (loginsiz) kitoblar API'si serializer'lari."""

from rest_framework import serializers

from .models import Book, BookChapter, Bookmark, BookPage, UserBookProgress


class BookSerializer(serializers.ModelSerializer):
    cover = serializers.FileField(source="cover_image", use_url=True, read_only=True)

    class Meta:
        model = Book
        fields = [
            "id",
            "title",
            "author",
            "type",
            "grade_level",
            "language",
            "page_count",
            "cover",
            "created_at",
        ]
        read_only_fields = fields


class BookChapterSerializer(serializers.ModelSerializer):
    class Meta:
        model = BookChapter
        fields = ["id", "title", "start_page"]
        read_only_fields = fields


class BookDetailSerializer(BookSerializer):
    chapters = BookChapterSerializer(many=True, read_only=True)

    class Meta(BookSerializer.Meta):
        fields = [*BookSerializer.Meta.fields, "description", "chapters"]
        read_only_fields = fields


class BookPageSerializer(serializers.ModelSerializer):
    image = serializers.FileField(use_url=True, read_only=True)
    thumbnail = serializers.FileField(use_url=True, read_only=True)
    has_text = serializers.SerializerMethodField(
        help_text="Sahifada matn qatlami bor (badiiy matnli rejim, kitob ichida qidiruv)"
    )

    class Meta:
        model = BookPage
        fields = ["number", "image", "thumbnail", "width", "height", "has_text"]
        read_only_fields = fields

    def get_has_text(self, page: BookPage) -> bool:
        return bool(page.text)


class BookSearchHitSerializer(serializers.Serializer):
    page = serializers.IntegerField(read_only=True)
    snippet = serializers.CharField(read_only=True, help_text="Moslik atrofidagi matn parchasi")


class BookProgressSerializer(serializers.ModelSerializer):
    book_id = serializers.UUIDField(read_only=True)
    page_count = serializers.IntegerField(source="book.page_count", read_only=True)

    class Meta:
        model = UserBookProgress
        fields = ["book_id", "last_page", "page_count", "updated_at"]
        read_only_fields = fields


class BookProgressWriteSerializer(serializers.Serializer):
    last_page = serializers.IntegerField(min_value=1)
    updated_at = serializers.DateTimeField(
        required=False, help_text="Mijozda bet o'zgargan vaqt (kech kelgan eski yozuv bosmaydi)"
    )


class BookmarkSerializer(serializers.ModelSerializer):
    class Meta:
        model = Bookmark
        fields = ["id", "page", "created_at"]
        read_only_fields = fields


class BookmarkWriteSerializer(serializers.Serializer):
    page = serializers.IntegerField(min_value=1)


class BookPageTextSerializer(serializers.ModelSerializer):
    class Meta:
        model = BookPage
        fields = ["number", "text"]
        read_only_fields = fields
