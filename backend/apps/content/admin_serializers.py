from django.core.files.storage import default_storage
from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers

from apps.core.fields import validate_localized_text

from .models import Subject
from .serializers import LocalizedTextSerializer


@extend_schema_field(LocalizedTextSerializer)
class LocalizedInput(serializers.JSONField):
    """`LocalizedText` kirishi: `uz` majburiy (model validatori bilan bir xil)."""

    default_validators = [validate_localized_text]


class StoredPathField(serializers.CharField):
    """Saqlangan fayl yo'li (`POST uploads/` natijasi): prefiks va mavjudligi tekshiriladi."""

    def __init__(self, prefix: str, **kwargs):
        self.prefix = prefix
        super().__init__(allow_blank=True, **kwargs)

    def to_representation(self, value):
        return value.name if value else ""

    def to_internal_value(self, data):
        path = super().to_internal_value(data)
        if not path:
            return ""
        if (
            not path.startswith(f"{self.prefix}/")
            or ".." in path.split("/")
            or "\\" in path
            or not default_storage.exists(path)
        ):
            raise serializers.ValidationError("invalid_file")
        return path


class ImmutableSlugMixin:
    """Slug yaratishda beriladi, keyin o'zgarmaydi (u kitob/fan identifikatorlariga kiradi)."""

    def validate_slug(self, value):
        if self.instance is not None and value != self.instance.slug:
            raise serializers.ValidationError("slug_immutable")
        return value


class SubjectAdminSerializer(ImmutableSlugMixin, serializers.ModelSerializer):
    title = LocalizedInput()
    pdf_books_count = serializers.SerializerMethodField()

    def get_pdf_books_count(self, subject) -> int:
        # Ro'yxatda queryset annotatsiyasi; yaratish/o'zgartirish javobida alohida hisoblanadi.
        count = getattr(subject, "pdf_books_count", None)
        return subject.pdf_books.count() if count is None else count

    class Meta:
        model = Subject
        fields = [
            "id",
            "slug",
            "title",
            "icon",
            "order",
            "group",
            "pdf_books_count",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]


class UploadRequestSerializer(serializers.Serializer):
    file = serializers.FileField()
    kind = serializers.ChoiceField(choices=["cover", "image", "pdf"])


class UploadResultSerializer(serializers.Serializer):
    path = serializers.CharField()
    url = serializers.CharField()
    name = serializers.CharField()
    size = serializers.IntegerField()
    content_type = serializers.CharField()
