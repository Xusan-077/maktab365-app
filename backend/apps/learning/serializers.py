from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers

from .models import (
    Bookmark,
    BookmarkKind,
    ExerciseStatus,
    ReadStatus,
    RecentView,
    StudyGoal,
    TopicProgress,
)
from .services.merge import MERGE_LIMIT
from .services.topics import topic_key

ID_LENGTH = 64
GOAL_LIMIT = 200


# --- progress ---


class MistakeSerializer(serializers.Serializer):
    exercise_id = serializers.CharField(max_length=ID_LENGTH)
    attempts = serializers.IntegerField(min_value=1, max_value=1000, default=1)
    last_wrong_at = serializers.DateTimeField(required=False, allow_null=True)


class MistakeOutSerializer(serializers.Serializer):
    exercise_id = serializers.CharField()
    attempts = serializers.IntegerField()
    last_wrong_at = serializers.DateTimeField(allow_null=True)


class ExerciseStatsSerializer(serializers.Serializer):
    solved = serializers.ListField(
        child=serializers.CharField(max_length=ID_LENGTH), max_length=500, required=False
    )
    attempts = serializers.DictField(
        child=serializers.IntegerField(min_value=0, max_value=10_000), required=False
    )

    def validate_attempts(self, value):
        if len(value) > 500 or any(len(key) > ID_LENGTH for key in value):
            raise serializers.ValidationError("invalid")
        return value


class ProgressWriteSerializer(serializers.Serializer):
    """PUT: to'liq holat. Yuborilmagan maydonga tegilmaydi."""

    read_status = serializers.ChoiceField(choices=ReadStatus.choices, required=False)
    exercise_status = serializers.ChoiceField(choices=ExerciseStatus.choices, required=False)
    last_block_id = serializers.CharField(max_length=ID_LENGTH, allow_blank=True, required=False)
    scroll_position = serializers.FloatField(
        min_value=0, max_value=1, allow_null=True, required=False
    )
    mistakes = MistakeSerializer(many=True, required=False, max_length=500)
    exercise_stats = ExerciseStatsSerializer(required=False)
    # Mijozdagi yozuv vaqti: eski qurilmaning kech kelgan yozuvi yangisini bosmaydi.
    updated_at = serializers.DateTimeField(required=False)


class TopicProgressSerializer(serializers.ModelSerializer):
    topic_id = serializers.SerializerMethodField()
    book_id = serializers.CharField(source="topic.book.slug", read_only=True)
    mistakes = MistakeOutSerializer(many=True)
    exercise_stats = serializers.SerializerMethodField()

    class Meta:
        model = TopicProgress
        fields = [
            "topic_id",
            "book_id",
            "read_status",
            "exercise_status",
            "last_block_id",
            "scroll_position",
            "mistakes",
            "exercise_stats",
            "first_opened_at",
            "read_at",
            "passed_at",
            "updated_at",
        ]

    def get_topic_id(self, obj) -> str:
        return topic_key(obj.topic)

    @extend_schema_field(ExerciseStatsSerializer)
    def get_exercise_stats(self, obj) -> dict:
        stats = obj.exercise_stats or {}
        return {"solved": stats.get("solved", []), "attempts": stats.get("attempts", {})}


class EventSerializer(serializers.Serializer):
    TYPES = ["topic_opened", "topic_read", "exercise_answered"]

    type = serializers.ChoiceField(choices=TYPES)
    topic_id = serializers.CharField(max_length=200)
    exercise_id = serializers.CharField(max_length=ID_LENGTH, required=False)
    correct = serializers.BooleanField(required=False)
    # Ochilishdagi urinish raqami: birinchi urinishda to'g'ri javob xatoni o'chiradi.
    attempt = serializers.IntegerField(min_value=1, max_value=1000, default=1)
    last_block_id = serializers.CharField(max_length=ID_LENGTH, required=False)

    def validate(self, attrs):
        if attrs["type"] == "exercise_answered":
            missing = {
                name: ["required"] for name in ("exercise_id", "correct") if name not in attrs
            }
            if missing:
                raise serializers.ValidationError(missing)
        return attrs


# --- bookmarks / recent ---


class BookmarkSerializer(serializers.ModelSerializer):
    topic_id = serializers.SerializerMethodField()
    book_id = serializers.SerializerMethodField()

    class Meta:
        model = Bookmark
        fields = ["id", "kind", "topic_id", "book_id", "created_at"]

    def get_topic_id(self, obj) -> str | None:
        return topic_key(obj.topic) if obj.topic_id else None

    def get_book_id(self, obj) -> str | None:
        return obj.book.slug if obj.book_id else None


class BookmarkWriteSerializer(serializers.Serializer):
    kind = serializers.ChoiceField(choices=BookmarkKind.choices)
    topic_id = serializers.CharField(max_length=200, required=False)
    book_id = serializers.CharField(max_length=200, required=False)

    def validate(self, attrs):
        field = "topic_id" if attrs["kind"] == BookmarkKind.TOPIC else "book_id"
        if not attrs.get(field):
            raise serializers.ValidationError({field: ["required"]})
        return attrs


class RecentViewSerializer(serializers.ModelSerializer):
    topic_id = serializers.SerializerMethodField()
    book_id = serializers.CharField(source="topic.book.slug", read_only=True)

    class Meta:
        model = RecentView
        fields = ["topic_id", "book_id", "viewed_at"]

    def get_topic_id(self, obj) -> str:
        return topic_key(obj.topic)


# --- goals ---


class StudyGoalSerializer(serializers.ModelSerializer):
    topic_id = serializers.SerializerMethodField()
    done = serializers.BooleanField(source="is_done", read_only=True)

    class Meta:
        model = StudyGoal
        fields = ["id", "title", "topic_id", "due_date", "done", "done_at", "created_at"]

    def get_topic_id(self, obj) -> str | None:
        return topic_key(obj.topic) if obj.topic_id else None


class StudyGoalWriteSerializer(serializers.Serializer):
    title = serializers.CharField(max_length=200)
    topic_id = serializers.CharField(max_length=200, allow_null=True, required=False)
    due_date = serializers.DateField(allow_null=True, required=False)
    done = serializers.BooleanField(required=False)

    def validate_title(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError("blank")
        return value


class StudyGoalPatchSerializer(StudyGoalWriteSerializer):
    title = serializers.CharField(max_length=200, required=False)


# --- dashboard / results ---


class WeeklySerializer(serializers.Serializer):
    since = serializers.DateTimeField()
    finished = serializers.IntegerField()
    read = serializers.IntegerField()
    exercises_passed = serializers.IntegerField()
    mistakes = serializers.IntegerField()
    active = serializers.IntegerField()


class DashboardBookSerializer(serializers.Serializer):
    book_id = serializers.CharField()
    subject_id = serializers.CharField()
    grade = serializers.IntegerField()
    topics_total = serializers.IntegerField()
    topics_read = serializers.IntegerField()
    topics_passed = serializers.IntegerField()


class ReviewSummarySerializer(serializers.Serializer):
    count = serializers.IntegerField()
    items = TopicProgressSerializer(many=True)


class DashboardSerializer(serializers.Serializer):
    # `continue` — Python kalit so'zi: maydon sinf nomlar fazosi orqali e'lon qilinadi.
    locals()["continue"] = TopicProgressSerializer(allow_null=True)
    has_progress = serializers.BooleanField()
    subjects = DashboardBookSerializer(many=True)
    review = ReviewSummarySerializer()
    weekly = WeeklySerializer()
    saved_count = serializers.IntegerField()


class ResultCountsSerializer(serializers.Serializer):
    mastered = serializers.IntegerField()
    review = serializers.IntegerField()
    in_progress = serializers.IntegerField()


class ResultsSerializer(serializers.Serializer):
    counts = ResultCountsSerializer()
    mastered = TopicProgressSerializer(many=True)
    review = TopicProgressSerializer(many=True)
    in_progress = TopicProgressSerializer(many=True)


class TeacherDashboardSerializer(serializers.Serializer):
    recent = RecentViewSerializer(many=True)
    saved_topics = BookmarkSerializer(many=True)
    saved_books = BookmarkSerializer(many=True)
    saved_topics_count = serializers.IntegerField()
    saved_books_count = serializers.IntegerField()


# --- merge ---


class GuestProgressSerializer(ProgressWriteSerializer):
    topic_id = serializers.CharField(max_length=200)


class MergeRequestSerializer(serializers.Serializer):
    progress = GuestProgressSerializer(many=True, required=False, max_length=MERGE_LIMIT)
    bookmarks = BookmarkWriteSerializer(many=True, required=False, max_length=MERGE_LIMIT)


class MergeResultSerializer(serializers.Serializer):
    progress = serializers.IntegerField()
    bookmarks = serializers.IntegerField()
    failed = serializers.ListField(child=serializers.CharField())
