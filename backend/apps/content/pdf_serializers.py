from django.db import transaction
from rest_framework import serializers

from . import pdf_storage as storage
from .admin_serializers import LocalizedInput, StoredPathField
from .models import CoverMode, PdfBook, Subject
from .pdf_services import allowed_transitions, chapter_errors, replace_chapters
from .serializers import LocalizedField


class SlidesAdminSerializer(serializers.Serializer):
    """Bo'lim prezentatsiyasi (admin): fayl nomi, slaydlar soni, hajm. Fayl kaliti chiqmaydi."""

    name = serializers.CharField()
    page_count = serializers.IntegerField()
    size_bytes = serializers.IntegerField()
    updated_at = serializers.DateTimeField(allow_null=True)


class SlidesPublicSerializer(serializers.Serializer):
    """Ochiq API: faqat slaydlar soni va hajm (fayl URL'i alohida endpoint orqali)."""

    page_count = serializers.IntegerField()
    size_bytes = serializers.IntegerField()


class ChapterLeafSerializer(serializers.Serializer):
    """Mundarija qatori. Qiymatlar `pdf_services.chapter_errors` da tekshiriladi.

    `id` yozishda ixtiyoriy: berilsa shu bo'lim joyida yangilanadi (prezentatsiyasi saqlanadi),
    berilmasa yangi bo'lim yaratiladi. `slides` faqat o'qiladi.
    """

    id = serializers.UUIDField(required=False)
    title = serializers.CharField(allow_blank=True, trim_whitespace=False)
    page = serializers.IntegerField()
    slides = SlidesAdminSerializer(read_only=True, allow_null=True)


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
            "cover_mode",
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

    def validate(self, attrs):
        # Muqova rejimi va fayl izchil: `auto` — fayl yo'q, boshqa rejimda fayl majburiy.
        if "cover_mode" not in attrs and "cover" not in attrs:
            return attrs
        mode = attrs.get("cover_mode", getattr(self.instance, "cover_mode", CoverMode.AUTO))
        if "cover_mode" not in attrs and attrs.get("cover"):
            mode = attrs["cover_mode"] = CoverMode.CUSTOM if mode == CoverMode.AUTO else mode
        has_cover = (
            bool(attrs["cover"])
            if "cover" in attrs
            else bool(self.instance and self.instance.cover)
        )
        if mode == CoverMode.AUTO:
            attrs["cover"] = ""
        elif not has_cover:
            raise serializers.ValidationError({"cover": ["cover_required"]})
        return attrs

    def create(self, validated_data):
        chapters = validated_data.pop("chapter_tree", None)
        book = super().create(validated_data)
        if chapters is not None:
            replace_chapters(book, chapters)
        return book

    def update(self, instance, validated_data):
        chapters = validated_data.pop("chapter_tree", None)
        old_cover = instance.cover.name if instance.cover else ""
        book = super().update(instance, validated_data)
        new_cover = book.cover.name if book.cover else ""
        if old_cover and old_cover != new_cover:
            # Almashtirilgan/olib tashlangan eski rasm tranzaksiyadan keyin saqlashdan tozalanadi.
            transaction.on_commit(lambda: storage.delete(old_cover))
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
    etag = serializers.CharField(max_length=1024)


class PdfUploadCompleteSerializer(serializers.Serializer):
    parts = PdfUploadPartSerializer(many=True, max_length=10000)
    filename = serializers.CharField(
        max_length=255,
        required=False,
        allow_blank=True,
        help_text="Prezentatsiya uchun: asl fayl nomi (ko'rsatish uchun)",
    )


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
    cover = serializers.FileField(source="public_cover", use_url=True, allow_null=True)
    unverified = serializers.SerializerMethodField()
    published_at = serializers.DateTimeField(allow_null=True)

    def get_unverified(self, book) -> bool:
        return book.status != "published"


class PublicChapterLeafSerializer(serializers.Serializer):
    id = serializers.UUIDField()
    title = serializers.CharField()
    page = serializers.IntegerField()
    slides = SlidesPublicSerializer(allow_null=True)


class PublicChapterSerializer(PublicChapterLeafSerializer):
    children = PublicChapterLeafSerializer(many=True)


class PdfBookDetailSerializer(PdfBookSerializer):
    description = serializers.CharField()
    chapters = PublicChapterSerializer(source="chapter_tree", many=True)


class PdfFileUrlSerializer(serializers.Serializer):
    url = serializers.CharField(help_text="Qisqa muddatli URL (S3: imzolangan; dev: backend yo'li)")
    expires_in = serializers.IntegerField()
