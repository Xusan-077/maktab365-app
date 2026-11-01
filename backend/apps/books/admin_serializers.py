from django.conf import settings
from django.db import transaction
from rest_framework import serializers

from apps.content import pdf_storage as storage
from apps.content.admin_serializers import LocalizedInput, StoredPathField
from apps.content.serializers import LocalizedField
from apps.content.storage import covers_storage

from . import services
from .models import Book, BookType, make_slug


class ChapterInputSerializer(serializers.Serializer):
    """Mundarija qatori; qiymatlar `services.chapter_errors` da tekshiriladi."""

    title = serializers.CharField(allow_blank=True, trim_whitespace=False)
    start_page = serializers.IntegerField()


class BookTypeAdminSerializer(serializers.ModelSerializer):
    name = LocalizedInput()
    book_count = serializers.IntegerField(read_only=True, default=0)
    slug = serializers.SlugField(max_length=120, required=False)

    class Meta:
        model = BookType
        fields = ["id", "slug", "name", "order", "is_active", "is_system", "book_count"]
        read_only_fields = ["id", "is_system", "book_count"]

    def validate_slug(self, value):
        if self.instance is not None and value != self.instance.slug:
            raise serializers.ValidationError("slug_immutable")
        if self.instance is None and BookType.objects.filter(slug=value).exists():
            raise serializers.ValidationError("slug_taken")
        return value

    def validate_is_active(self, value):
        if self.instance is not None and self.instance.is_system and not value:
            raise serializers.ValidationError("system_type")
        return value

    def create(self, validated_data):
        if not validated_data.get("slug"):
            base = make_slug(validated_data["name"].get("uz", ""), "tur")
            slug, n = base, 1
            while BookType.objects.filter(slug=slug).exists():
                n += 1
                slug = f"{base}-{n}"
            validated_data["slug"] = slug
        return super().create(validated_data)


class BookTypeInfoSerializer(serializers.ModelSerializer):
    name = LocalizedField()

    class Meta:
        model = BookType
        fields = ["id", "slug", "name"]
        read_only_fields = fields


class BookAdminSerializer(serializers.ModelSerializer):
    book_type = serializers.PrimaryKeyRelatedField(queryset=BookType.objects.all(), required=False)
    book_type_info = BookTypeInfoSerializer(source="book_type", read_only=True)
    cover_image = StoredPathField("covers", storage=covers_storage, required=False)
    cover_url = serializers.FileField(
        source="cover_image", use_url=True, read_only=True, allow_null=True
    )
    chapters = ChapterInputSerializer(source="chapter_rows", many=True, required=False)
    has_file = serializers.SerializerMethodField()
    open_warning = serializers.SerializerMethodField()
    upload_pending = serializers.SerializerMethodField()
    allowed_transitions = serializers.SerializerMethodField()

    class Meta:
        model = Book
        fields = [
            "id",
            "slug",
            "title",
            "author",
            "book_type",
            "book_type_info",
            "reading_mode",
            "grade_level",
            "language",
            "description",
            "cover_image",
            "cover_url",
            "chapters",
            "has_file",
            "size_bytes",
            "page_count",
            "has_text_layer",
            "is_optimized",
            "open_warning",
            "status",
            "status_error",
            "is_published",
            "published_at",
            "upload_pending",
            "allowed_transitions",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "slug",
            "size_bytes",
            "page_count",
            "has_text_layer",
            "is_optimized",
            "status",
            "status_error",
            "is_published",
            "published_at",
            "created_at",
            "updated_at",
        ]

    def to_representation(self, instance):
        data = super().to_representation(instance)
        data["chapters"] = [
            {"title": row.title, "start_page": row.start_page} for row in instance.chapters.all()
        ]
        return data

    def validate_title(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError("title_required")
        return value

    def validate_book_type(self, value):
        current = self.instance.book_type_id if self.instance is not None else None
        if not value.is_active and value.pk != current:
            raise serializers.ValidationError("type_inactive")
        return value

    def validate_chapters(self, value):
        page_count = self.instance.page_count if self.instance is not None else 0
        if codes := services.chapter_errors(value, page_count):
            raise serializers.ValidationError(codes)
        return value

    def create(self, validated_data):
        chapters = validated_data.pop("chapter_rows", None)
        book = super().create(validated_data)
        if chapters:
            services.replace_chapters(book, chapters)
        return book

    def update(self, instance, validated_data):
        chapters = validated_data.pop("chapter_rows", None)
        old_cover = instance.cover_image.name if instance.cover_image else ""
        if "cover_image" in validated_data:  # qo'lda yuklangan muqova avto muqovadan ustun
            validated_data["cover_generated"] = False
        book = super().update(instance, validated_data)
        if "cover_image" in validated_data and not book.cover_image:
            services.regenerate_cover(book)  # "Avtomatik muqova": PDF 1-betidan
        new_cover = book.cover_image.name if book.cover_image else ""
        if old_cover and old_cover != new_cover:
            transaction.on_commit(lambda: storage.delete(old_cover, covers_storage()))
        if chapters is not None:
            services.replace_chapters(book, chapters)
        return book

    def get_has_file(self, book) -> bool:
        return bool(book.source_file)

    def get_open_warning(self, book) -> bool:
        """Katta PDF optimallashtirilmagan: sahifalar sekin ochilishi mumkin."""
        return (
            bool(book.source_file)
            and not book.is_optimized
            and book.size_bytes > settings.BOOK_OPTIMIZE_WARN_BYTES
        )

    def get_upload_pending(self, book) -> bool:
        return bool(book.pending_file)

    def get_allowed_transitions(self, book) -> list[str]:
        request = self.context.get("request")
        role = getattr(getattr(request, "user", None), "role", "")
        return services.allowed_transitions(role, book)


class BookTransitionSerializer(serializers.Serializer):
    to = serializers.ChoiceField(choices=["draft", "published"])
