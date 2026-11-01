"""Ochiq (loginsiz) kitoblar API'si serializer'lari."""

from rest_framework import serializers

from apps.content.serializers import LocalizedField

from . import annotation_validation as validation
from .models import (
    AnnotationType,
    Book,
    BookChapter,
    Bookmark,
    BookPage,
    BookType,
    PageAnnotation,
    UserBookProgress,
)


class BookTypeSerializer(serializers.ModelSerializer):
    """Ochiq tur: katalog tablari (nom 3 tilda; uz-Cyrl frontendda o'giriladi)."""

    name = LocalizedField()

    book_count = serializers.IntegerField(read_only=True, default=0)

    class Meta:
        model = BookType
        fields = ["id", "slug", "name", "order", "book_count"]
        read_only_fields = fields


class BookTypeRefSerializer(serializers.ModelSerializer):
    name = LocalizedField()

    class Meta:
        model = BookType
        fields = ["id", "slug", "name"]
        read_only_fields = fields


class BookSerializer(serializers.ModelSerializer):
    cover = serializers.FileField(source="public_cover", use_url=True, read_only=True)
    book_type = BookTypeRefSerializer(read_only=True)

    class Meta:
        model = Book
        fields = [
            "id",
            "slug",
            "title",
            "author",
            "book_type",
            "reading_mode",
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
        fields = [*BookSerializer.Meta.fields, "description", "chapters", "has_text_layer"]
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


class PageNoteSerializer(serializers.Serializer):
    page = serializers.IntegerField(read_only=True)
    text = serializers.CharField(read_only=True, allow_blank=True)
    updated_at = serializers.DateTimeField(read_only=True, allow_null=True)


class PageNoteWriteSerializer(serializers.Serializer):
    text = serializers.CharField(
        allow_blank=True, trim_whitespace=False, max_length=validation.NOTE_MAX
    )


class PageAnnotationSerializer(serializers.ModelSerializer):
    class Meta:
        model = PageAnnotation
        fields = ["id", "page", "type", "data", "created_at", "updated_at"]
        read_only_fields = fields


class AnnotationInputSerializer(serializers.Serializer):
    """Mijoz `id` (UUID) beradi: optimistik yozuv va qayta yuborish idempotent bo'ladi."""

    id = serializers.UUIDField(required=False)
    type = serializers.ChoiceField(choices=AnnotationType.choices)
    data = serializers.JSONField()

    def validate(self, attrs):
        attrs["data"] = validation.clean_data(attrs["type"], attrs["data"])
        return attrs


class AnnotationCreateSerializer(AnnotationInputSerializer):
    page = serializers.IntegerField(min_value=1)


class AnnotationUpdateSerializer(serializers.Serializer):
    data = serializers.JSONField()


class PageAnnotationsReplaceSerializer(serializers.Serializer):
    annotations = AnnotationInputSerializer(many=True, allow_empty=True)

    def validate_annotations(self, items):
        if len(items) > validation.MAX_PER_PAGE:
            raise serializers.ValidationError("too_many_annotations")
        ids = [item["id"] for item in items if "id" in item]
        if len(ids) != len(set(ids)):
            raise serializers.ValidationError("duplicate_id")
        return items
