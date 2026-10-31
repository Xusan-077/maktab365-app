from django.db import transaction
from rest_framework import serializers

from apps.content import pdf_storage as storage
from apps.content.admin_serializers import StoredPathField
from apps.content.storage import covers_storage

from . import services
from .models import Book


class ChapterInputSerializer(serializers.Serializer):
    """Mundarija qatori; qiymatlar `services.chapter_errors` da tekshiriladi."""

    title = serializers.CharField(allow_blank=True, trim_whitespace=False)
    start_page = serializers.IntegerField()


class BookAdminSerializer(serializers.ModelSerializer):
    cover_image = StoredPathField("covers", storage=covers_storage, required=False)
    cover_url = serializers.FileField(
        source="cover_image", use_url=True, read_only=True, allow_null=True
    )
    chapters = ChapterInputSerializer(source="chapter_rows", many=True, required=False)
    has_file = serializers.SerializerMethodField()
    upload_pending = serializers.SerializerMethodField()
    allowed_transitions = serializers.SerializerMethodField()

    class Meta:
        model = Book
        fields = [
            "id",
            "title",
            "author",
            "type",
            "grade_level",
            "language",
            "description",
            "cover_image",
            "cover_url",
            "chapters",
            "has_file",
            "size_bytes",
            "page_count",
            "processed_pages",
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
            "size_bytes",
            "page_count",
            "processed_pages",
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
        book = super().update(instance, validated_data)
        new_cover = book.cover_image.name if book.cover_image else ""
        if old_cover and old_cover != new_cover:
            transaction.on_commit(lambda: storage.delete(old_cover, covers_storage()))
        if chapters is not None:
            services.replace_chapters(book, chapters)
        return book

    def get_has_file(self, book) -> bool:
        return bool(book.source_file)

    def get_upload_pending(self, book) -> bool:
        return bool(book.pending_file)

    def get_allowed_transitions(self, book) -> list[str]:
        request = self.context.get("request")
        role = getattr(getattr(request, "user", None), "role", "")
        return services.allowed_transitions(role, book)


class BookTransitionSerializer(serializers.Serializer):
    to = serializers.ChoiceField(choices=["draft", "published"])
