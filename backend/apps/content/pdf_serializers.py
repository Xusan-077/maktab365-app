from rest_framework import serializers

from .admin_serializers import LocalizedInput, StoredPathField
from .models import PdfBook, Subject
from .pdf_services import allowed_transitions
from .serializers import LocalizedField


class PdfBookAdminSerializer(serializers.ModelSerializer):
    subject = serializers.SlugRelatedField(slug_field="slug", queryset=Subject.objects.all())
    title = LocalizedInput()
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
    part_size = serializers.IntegerField(help_text="direct: har bo'lak hajmi (oxirgisidan boshqa)")
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


class PdfFileUrlSerializer(serializers.Serializer):
    url = serializers.CharField(help_text="Qisqa muddatli URL (S3: imzolangan; dev: backend yo'li)")
    expires_in = serializers.IntegerField()
