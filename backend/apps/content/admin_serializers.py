from django.core.files.storage import default_storage
from django.db.models import Count
from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers

from apps.core.fields import validate_localized_text

from . import admin_services as services
from .models import PdfBook, Subject
from .serializers import LocalizedTextSerializer


@extend_schema_field(LocalizedTextSerializer)
class LocalizedInput(serializers.JSONField):
    """`LocalizedText` kirishi: `uz` majburiy (model validatori bilan bir xil)."""

    default_validators = [validate_localized_text]


class StoredPathField(serializers.CharField):
    """Saqlangan fayl yo'li (`POST uploads/` natijasi): prefiks va mavjudligi tekshiriladi."""

    def __init__(self, prefix: str, storage=None, **kwargs):
        self.prefix = prefix
        # Callable (`covers_storage`) yoki `Storage`; berilmasa shaxsiy `default`.
        self.storage = storage
        super().__init__(allow_blank=True, **kwargs)

    def _storage(self):
        storage = self.storage if self.storage is not None else default_storage
        return storage() if callable(storage) else storage

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
            or not (self._storage().exists(path))
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
    grades = serializers.ListField(
        child=serializers.IntegerField(), allow_empty=True, required=False
    )
    pdf_books_count = serializers.SerializerMethodField()

    def get_pdf_books_count(self, subject) -> int:
        # Ro'yxatda queryset annotatsiyasi; yaratish/o'zgartirish javobida alohida hisoblanadi.
        count = getattr(subject, "pdf_books_count", None)
        return subject.pdf_books.count() if count is None else count

    def validate_grades(self, value):
        if not value:
            raise serializers.ValidationError("grades_required")
        if any(not 1 <= grade <= 11 for grade in value):
            raise serializers.ValidationError("grades_invalid")
        if len(set(value)) != len(value):
            raise serializers.ValidationError("grades_duplicate")
        value = sorted(value)
        if self.instance is not None:
            # Sinf olib tashlansa va shu sinfda fanning kitobi bo'lsa — kitoblar saqlanadi, 409.
            removed = set(self.instance.grades) - set(value)
            if removed:
                rows = (
                    PdfBook.objects.filter(subject=self.instance, grade__in=removed)
                    .order_by()
                    .values("grade")
                    .annotate(n=Count("pk"))
                )
                if conflicts := {row["grade"]: row["n"] for row in rows}:
                    raise services.GradeHasBooks(conflicts)
        return value

    class Meta:
        model = Subject
        fields = [
            "id",
            "slug",
            "title",
            "icon",
            "order",
            "group",
            "grades",
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
