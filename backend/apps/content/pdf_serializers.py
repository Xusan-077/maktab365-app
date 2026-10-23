from rest_framework import serializers

from .admin_serializers import LocalizedInput, StoredPathField
from .models import PdfBook, Subject
from .pdf_services import allowed_transitions, chapter_errors, replace_chapters
from .serializers import LocalizedField


class ChapterLeafSerializer(serializers.Serializer):
    """Mundarija qatori. Qiymatlar `pdf_services.chapter_errors` da tekshiriladi."""

    id = serializers.UUIDField(read_only=True)
    title = serializers.CharField(allow_blank=True, trim_whitespace=False)
    page = serializers.IntegerField()


class ChapterSerializer(ChapterLeafSerializer):
    """Yuqori daraja; `children` — ichki bo'limlar (ular uchun `children` yo'q: 2 daraja)."""

    children = ChapterLeafSerializer(many=True, required=False)


class PdfBookAdminSerializer(serializers.ModelSerializer):
    subject = serializers.SlugRelatedField(slug_field="slug", queryset=Subject.objects.all())
    title = LocalizedInput()
    chapters = ChapterSerializer(source="chapter_tree", many=True, required=False)
    cover = StoredPathField("covers", required=False)
    cover_url = serializers.FileField(source="cover", use_url=True, read_only=True, allow_null=True)
    has_file = serializers.SerializerMethodField()
    upload_pending = serializers.SerializerMethodField()
    allowed_transitions = serializers.SerializerMethodField()

    class Meta:
        model = PdfBook
        fields = [
            "id",
            "title",
            "description",
            "chapters",
            "grade",
            "subject",
            "cover",
            "cover_url",
            "has_file",
            "size_bytes",
            "page_count",
            "status",
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
            "status",
            "published_at",
            "created_at",
            "updated_at",
        ]

    def validate_chapters(self, value):
        page_count = self.instance.page_count if self.instance is not None else 0
        if codes := chapter_errors(value, page_count):
            raise serializers.ValidationError(codes)
        return value

    def create(self, validated_data):
        chapters = validated_data.pop("chapter_tree", None)
        book = super().create(validated_data)
        if chapters is not None:
            replace_chapters(book, chapters)
        return book

    def update(self, instance, validated_data):
        chapters = validated_data.pop("chapter_tree", None)
        book = super().update(instance, validated_data)
        if chapters is not None:
            replace_chapters(book, chapters)
        return book

    def get_has_file(self, book) -> bool:
        return bool(book.file)

    def get_upload_pending(self, book) -> bool:
        return bool(book.pending_file)

    def get_allowed_transitions(self, book) -> list[str]:
        request = self.context.get("request")
        role = getattr(getattr(request, "user", None), "role", "")
        return allowed_transitions(role, book.status)


class PdfTransitionSerializer(serializers.Serializer):
    to = serializers.ChoiceField(choices=["draft", "published"])


class PdfUploadInitSerializer(serializers.Serializer):
    filename = serializers.CharField(max_length=255)
    size = serializers.IntegerField(min_value=1)
    content_type = serializers.CharField(max_length=100)


class PdfUploadPlanSerializer(serializers.Serializer):
    mode = serializers.ChoiceField(choices=["direct", "proxy"])
    part_size = serializers.IntegerField(
        help_text=(
            "direct: har bo'lak hajmi (oxirgisidan boshqa); fayl hajmiga qarab hisoblanadi, "
            "bo'laklar soni 10 000 dan oshmaydi"
        )
    )
    part_urls = serializers.ListField(
        child=serializers.CharField(), help_text="direct: har bo'lak uchun imzolangan PUT URL"
    )
    expires_in = serializers.IntegerField()


class PdfUploadPartSerializer(serializers.Serializer):
    part_number = serializers.IntegerField(min_value=1, max_value=10000)
    etag = serializers.CharField(max_length=200)


class PdfUploadCompleteSerializer(serializers.Serializer):
    parts = PdfUploadPartSerializer(many=True, max_length=10000)


class PdfUploadFileSerializer(serializers.Serializer):
    file = serializers.FileField()


# --- Ochiq ---


class PdfBookSerializer(serializers.Serializer):
    id = serializers.UUIDField()
    title = LocalizedField()
    grade = serializers.IntegerField()
    subject = serializers.SlugField(source="subject.slug")
    subject_title = LocalizedField(source="subject.title")
    page_count = serializers.IntegerField()
    size_bytes = serializers.IntegerField()
    cover = serializers.FileField(use_url=True, allow_null=True)
    unverified = serializers.SerializerMethodField()
    published_at = serializers.DateTimeField(allow_null=True)

    def get_unverified(self, book) -> bool:
        return book.status != "published"


class PdfBookDetailSerializer(PdfBookSerializer):
    description = serializers.CharField()
    chapters = ChapterSerializer(source="chapter_tree", many=True)


class PdfFileUrlSerializer(serializers.Serializer):
    url = serializers.CharField(help_text="Qisqa muddatli URL (S3: imzolangan; dev: backend yo'li)")
    expires_in = serializers.IntegerField()
