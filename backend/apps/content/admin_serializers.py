from django.core.files.storage import default_storage
from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers

from apps.core.fields import LOCALES, validate_localized_text

from .admin_services import allowed_transitions, next_order
from .models import Book, Chapter, Subject, Topic, TopicStatus, validate_topic_blocks
from .serializers import LocalizedTextSerializer


@extend_schema_field(LocalizedTextSerializer)
class LocalizedInput(serializers.JSONField):
    """`LocalizedText` kirishi: `uz` majburiy (model validatori bilan bir xil)."""

    default_validators = [validate_localized_text]


@extend_schema_field(LocalizedTextSerializer)
class OptionalLocalizedInput(serializers.JSONField):
    """Qisqa mazmun kabi maydonlar uchun: `uz` bo'sh bo'lishi mumkin."""

    def to_internal_value(self, data):
        value = super().to_internal_value(data)
        if not isinstance(value, dict) or set(value) - set(LOCALES):
            raise serializers.ValidationError("invalid")
        if any(not isinstance(text, str) for text in value.values()):
            raise serializers.ValidationError("invalid")
        return {"uz": "", **value}


@extend_schema_field(
    {
        "type": "array",
        "description": "Mavzu bloklari; sxema: `apps/content/schemas.py` (frontend `TopicBlock`).",
        "items": {"type": "object", "additionalProperties": True},
    }
)
class BlocksInput(serializers.JSONField):
    default_validators = [validate_topic_blocks]


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
    """Slug yaratishda beriladi, keyin o'zgarmaydi (u mavzu/kitob identifikatorlariga kiradi)."""

    def validate_slug(self, value):
        if self.instance is not None and value != self.instance.slug:
            raise serializers.ValidationError("slug_immutable")
        return value


class SubjectAdminSerializer(ImmutableSlugMixin, serializers.ModelSerializer):
    title = LocalizedInput()
    books_count = serializers.IntegerField(read_only=True)
    pdf_books_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = Subject
        fields = [
            "id",
            "slug",
            "title",
            "icon",
            "order",
            "books_count",
            "pdf_books_count",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]


class BookAdminSerializer(ImmutableSlugMixin, serializers.ModelSerializer):
    subject = serializers.SlugRelatedField(slug_field="slug", queryset=Subject.objects.all())
    title = LocalizedInput()
    author = LocalizedInput()
    edition = LocalizedInput()
    cover = StoredPathField("covers", required=False)
    pdf = StoredPathField("pdf", required=False)
    cover_url = serializers.FileField(source="cover", use_url=True, read_only=True, allow_null=True)
    pdf_url = serializers.FileField(source="pdf", use_url=True, read_only=True, allow_null=True)
    chapters_count = serializers.IntegerField(read_only=True)
    topics_count = serializers.IntegerField(read_only=True)
    published_topics_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = Book
        fields = [
            "id",
            "slug",
            "subject",
            "grade",
            "title",
            "author",
            "publisher",
            "edition",
            "year",
            "cover",
            "cover_url",
            "pdf",
            "pdf_url",
            "order",
            "is_published",
            "chapters_count",
            "topics_count",
            "published_topics_count",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]


class ChapterAdminSerializer(ImmutableSlugMixin, serializers.ModelSerializer):
    title = LocalizedInput()
    book = serializers.PrimaryKeyRelatedField(queryset=Book.objects.all())
    book_slug = serializers.SlugField(source="book.slug", read_only=True)
    topics_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = Chapter
        fields = [
            "id",
            "book",
            "book_slug",
            "slug",
            "title",
            "order",
            "topics_count",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "order", "created_at", "updated_at"]
        validators: list = []

    def validate(self, attrs):
        if self.instance is not None:
            if "book" in attrs and attrs["book"] != self.instance.book:
                raise serializers.ValidationError({"book": ["book_immutable"]})
            book = self.instance.book
        else:
            book = attrs["book"]
        slug = attrs.get("slug")
        clash = Chapter.objects.filter(book=book, slug=slug)
        if self.instance is not None:
            clash = clash.exclude(pk=self.instance.pk)
        if slug and clash.exists():
            raise serializers.ValidationError({"slug": ["slug_taken"]})
        return attrs

    def create(self, validated_data):
        validated_data["order"] = next_order(Chapter.objects.filter(book=validated_data["book"]))
        return super().create(validated_data)


class TopicListSerializer(serializers.ModelSerializer):
    title = LocalizedInput(read_only=True)
    chapter_slug = serializers.SlugField(source="chapter.slug", read_only=True)
    book_slug = serializers.SlugField(source="book.slug", read_only=True)

    class Meta:
        model = Topic
        fields = [
            "id",
            "slug",
            "chapter",
            "chapter_slug",
            "book",
            "book_slug",
            "title",
            "status",
            "order",
            "reviewed_at",
            "published_at",
            "updated_at",
        ]
        read_only_fields = fields


class TopicAdminSerializer(ImmutableSlugMixin, serializers.ModelSerializer):
    title = LocalizedInput()
    summary = OptionalLocalizedInput(required=False)
    blocks = BlocksInput(required=False)
    chapter = serializers.PrimaryKeyRelatedField(queryset=Chapter.objects.select_related("book"))
    chapter_slug = serializers.SlugField(source="chapter.slug", read_only=True)
    book_slug = serializers.SlugField(source="book.slug", read_only=True)
    reviewed_by_email = serializers.EmailField(
        source="reviewed_by.email", read_only=True, allow_null=True
    )
    allowed_transitions = serializers.SerializerMethodField()

    class Meta:
        model = Topic
        fields = [
            "id",
            "slug",
            "chapter",
            "chapter_slug",
            "book",
            "book_slug",
            "title",
            "summary",
            "blocks",
            "notes",
            "status",
            "order",
            "reviewed_by_email",
            "reviewed_at",
            "published_at",
            "allowed_transitions",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "book",
            "status",
            "order",
            "reviewed_at",
            "published_at",
            "created_at",
            "updated_at",
        ]
        validators: list = []

    def get_allowed_transitions(self, topic) -> list[TopicStatus]:
        role = getattr(self.context["request"].user, "role", "")
        return allowed_transitions(role, topic.status)

    def validate(self, attrs):
        chapter = attrs["chapter"] if self.instance is None else self.instance.chapter
        slug = attrs.get("slug")
        clash = Topic.objects.filter(book=chapter.book, slug=slug)
        if self.instance is not None:
            clash = clash.exclude(pk=self.instance.pk)
        if slug and clash.exists():
            raise serializers.ValidationError({"slug": ["slug_taken"]})
        return attrs

    def create(self, validated_data):
        chapter = validated_data["chapter"]
        validated_data["order"] = next_order(Topic.objects.filter(chapter=chapter))
        topic = Topic(**validated_data)
        topic.revision_author = self.context["request"].user
        topic.save()
        return topic

    def update(self, instance, validated_data):
        # Bobni o'zgartirish faqat reorder orqali (tartib raqami va kesh bilan birga).
        validated_data.pop("chapter", None)
        instance.revision_author = self.context["request"].user
        return super().update(instance, validated_data)


class TransitionSerializer(serializers.Serializer):
    to = serializers.ChoiceField(choices=TopicStatus.choices)


class ReorderSerializer(serializers.Serializer):
    chapters = serializers.ListField(child=serializers.UUIDField(), required=False)
    topics = serializers.DictField(
        child=serializers.ListField(child=serializers.UUIDField()), required=False
    )

    def validate_topics(self, value):
        try:
            return {serializers.UUIDField().to_internal_value(k): v for k, v in value.items()}
        except serializers.ValidationError:
            raise serializers.ValidationError("unknown_chapter") from None

    def validate(self, attrs):
        if not attrs:
            raise serializers.ValidationError({"chapters": ["required"]})
        return attrs


class UploadRequestSerializer(serializers.Serializer):
    file = serializers.FileField()
    kind = serializers.ChoiceField(choices=["cover", "image", "pdf"])


class UploadResultSerializer(serializers.Serializer):
    path = serializers.CharField()
    url = serializers.CharField()
    name = serializers.CharField()
    size = serializers.IntegerField()
    content_type = serializers.CharField()
