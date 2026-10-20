from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers


class LocalizedTextSerializer(serializers.Serializer):
    """Ko'p tilli matn: API tilni tanlamaydi, klient `getLocalized` bilan tanlaydi."""

    uz = serializers.CharField()
    ru = serializers.CharField(required=False)
    en = serializers.CharField(required=False)


@extend_schema_field(LocalizedTextSerializer)
class LocalizedField(serializers.Field):
    """`LocalizedTextField` qiymatini o'zgartirmay qaytaradi."""

    def to_representation(self, value):
        return value


@extend_schema_field(
    {
        "type": "array",
        "description": "Mavzu bloklari; sxema: `apps/content/schemas.py` (frontend `TopicBlock`).",
        "items": {"type": "object", "additionalProperties": True},
    }
)
class BlocksField(serializers.Field):
    def to_representation(self, value):
        return value


class GradeSerializer(serializers.Serializer):
    grade = serializers.IntegerField(min_value=1, max_value=11)
    books_count = serializers.IntegerField()


class SubjectSerializer(serializers.Serializer):
    slug = serializers.SlugField()
    title = LocalizedField()
    icon = serializers.CharField()
    order = serializers.IntegerField()
    books_count = serializers.IntegerField()


class BookSerializer(serializers.Serializer):
    slug = serializers.SlugField()
    subject = serializers.SlugField(source="subject.slug")
    grade = serializers.IntegerField()
    title = LocalizedField()
    author = LocalizedField()
    publisher = serializers.CharField()
    edition = LocalizedField()
    year = serializers.IntegerField()
    cover = serializers.FileField(use_url=True, allow_null=True)
    pdf = serializers.FileField(use_url=True, allow_null=True)
    topics_ready = serializers.SerializerMethodField()
    topics_count = serializers.IntegerField(source="visible_topics")

    def get_topics_ready(self, book) -> bool:
        return book.visible_topics > 0


class TopicSummarySerializer(serializers.Serializer):
    slug = serializers.SlugField()
    order = serializers.IntegerField()
    title = LocalizedField()
    summary = LocalizedField()
    unverified = serializers.SerializerMethodField()

    def get_unverified(self, topic) -> bool:
        return topic.status != "published"


class ChapterSerializer(serializers.Serializer):
    slug = serializers.SlugField()
    order = serializers.IntegerField()
    title = LocalizedField()
    topics = TopicSummarySerializer(many=True, source="visible_topic_list")


class BookDetailSerializer(BookSerializer):
    chapters = ChapterSerializer(many=True, source="chapter_list")


class TopicLinkSerializer(serializers.Serializer):
    slug = serializers.SlugField()
    title = LocalizedField()


class BreadcrumbSubjectSerializer(serializers.Serializer):
    slug = serializers.SlugField()
    title = LocalizedField()


class BreadcrumbBookSerializer(serializers.Serializer):
    slug = serializers.SlugField()
    title = LocalizedField()
    grade = serializers.IntegerField()


class BreadcrumbChapterSerializer(serializers.Serializer):
    slug = serializers.SlugField()
    order = serializers.IntegerField()
    title = LocalizedField()


class BreadcrumbSerializer(serializers.Serializer):
    subject = BreadcrumbSubjectSerializer(source="book.subject")
    book = BreadcrumbBookSerializer()
    chapter = BreadcrumbChapterSerializer()


class TopicDetailSerializer(TopicSummarySerializer):
    book = serializers.SlugField(source="book.slug")
    chapter = serializers.SlugField(source="chapter.slug")
    status = serializers.CharField()
    blocks = BlocksField()
    previous = TopicLinkSerializer(allow_null=True)
    next = TopicLinkSerializer(allow_null=True)
    breadcrumb = BreadcrumbSerializer(source="*")


class SearchBookSerializer(serializers.Serializer):
    slug = serializers.SlugField()
    title = LocalizedField()
    grade = serializers.IntegerField()
    subject = serializers.SlugField(source="subject.slug")


class SearchResultSerializer(serializers.Serializer):
    topic = TopicSummarySerializer(source="*")
    book = SearchBookSerializer()
    chapter_order = serializers.IntegerField(source="chapter.order")
    chapter_title = LocalizedField(source="chapter.title")
    snippet = serializers.CharField(
        help_text="Mos so'zlar ⟦…⟧ ichida belgilangan parcha (asl matndan)."
    )
    rank = serializers.FloatField()


class SearchResponseSerializer(serializers.Serializer):
    count = serializers.IntegerField()
    results = SearchResultSerializer(many=True)
