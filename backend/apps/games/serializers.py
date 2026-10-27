import re

from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers

from apps.content.serializers import LocalizedField

from . import services
from .models import Difficulty, GameSession

GAME_TYPE_RE = re.compile(r"^[a-z0-9_-]{1,32}$")
MAX_TEAMS = 8
TEAM_NAME_MAX = 40
MAX_DURATION_SECONDS = 4 * 60 * 60


class GameSubjectSerializer(serializers.Serializer):
    slug = serializers.SlugField()
    title = LocalizedField()


class GameTextbookSerializer(serializers.Serializer):
    id = serializers.UUIDField()
    slug = serializers.SlugField()
    title = LocalizedField()


class GameTopicSerializer(serializers.Serializer):
    """O'yin uchun mavzu (mundarija bo'limi): nom — bo'lim nomi, kitob tilida (tarjimasiz)."""

    id = serializers.UUIDField()
    slug = serializers.SerializerMethodField()
    title = serializers.CharField()
    subject = serializers.SerializerMethodField()
    grade = serializers.IntegerField(source="book.grade")
    textbook = serializers.SerializerMethodField()
    question_count = serializers.IntegerField()

    def get_slug(self, topic) -> str:
        return services.topic_slug(topic)

    @extend_schema_field(GameSubjectSerializer)
    def get_subject(self, topic):
        subject = topic.book.subject
        return {"slug": subject.slug, "title": subject.title}

    @extend_schema_field(GameTextbookSerializer)
    def get_textbook(self, topic):
        book = topic.book
        return {"id": book.pk, "slug": book.slug, "title": book.title}


class GameOptionSerializer(serializers.Serializer):
    id = serializers.UUIDField()
    text = LocalizedField()


class GameQuestionSerializer(serializers.Serializer):
    """Savol o'yin uchun: `is_correct` yo'q, javob `answer_token` bilan serverda tekshiriladi."""

    id = serializers.UUIDField()
    text = LocalizedField()
    image = serializers.FileField(use_url=True, allow_null=True)
    difficulty = serializers.ChoiceField(choices=Difficulty.choices)
    options = GameOptionSerializer(source="shuffled_options", many=True)
    answer_token = serializers.SerializerMethodField()

    def get_answer_token(self, question) -> str:
        return services.answer_token(question)

    def to_representation(self, question):
        data = super().to_representation(question)
        if not question.image:
            data["image"] = None
        return data


class GameQuestionsSerializer(serializers.Serializer):
    topic = GameTopicSerializer()
    questions = GameQuestionSerializer(many=True)


class CheckAnswerRequestSerializer(serializers.Serializer):
    answer_token = serializers.CharField(max_length=500)
    option_id = serializers.UUIDField()


class CheckAnswerSerializer(serializers.Serializer):
    correct = serializers.BooleanField()
    correct_option_id = serializers.UUIDField()


class AllowanceSerializer(serializers.Serializer):
    month = serializers.DateField()
    free_games_limit = serializers.IntegerField()
    free_games_used = serializers.IntegerField()
    free_games_left = serializers.IntegerField()
    coins = serializers.IntegerField()
    game_cost_coins = serializers.IntegerField()


def validate_game_type(value: str) -> str:
    if not GAME_TYPE_RE.match(value):
        raise serializers.ValidationError("invalid_game_type")
    return value


class TopicSlugField(serializers.CharField):
    """Mavzu slug'i → o'ynaladigan bo'lim (404 emas — maydon xatosi `topic_not_found`)."""

    def to_internal_value(self, data):
        slug = super().to_internal_value(data)
        try:
            return services.get_playable_topic(slug)
        except services.NotFound:
            raise serializers.ValidationError("topic_not_found") from None

    def to_representation(self, value):
        return services.topic_slug(value)


class SessionStartRequestSerializer(serializers.Serializer):
    game_type = serializers.CharField(max_length=32, validators=[validate_game_type])
    topic = TopicSlugField(required=False, allow_null=True)


class SessionStartSerializer(serializers.Serializer):
    session_id = serializers.UUIDField()
    paid_with = serializers.ChoiceField(choices=["free", "coins"])
    allowance = AllowanceSerializer()


class TeamResultSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=TEAM_NAME_MAX)
    score = serializers.IntegerField(min_value=0, max_value=1_000_000)
    correct = serializers.IntegerField(min_value=0, max_value=1000)
    total = serializers.IntegerField(min_value=0, max_value=1000)

    def validate(self, attrs):
        if attrs["correct"] > attrs["total"]:
            raise serializers.ValidationError({"correct": ["correct_exceeds_total"]})
        return attrs


class SessionFinishRequestSerializer(serializers.Serializer):
    game_type = serializers.CharField(
        max_length=32, validators=[validate_game_type], required=False
    )
    topic = TopicSlugField(required=False, allow_null=True)
    teams = TeamResultSerializer(many=True, allow_empty=False, max_length=MAX_TEAMS)
    duration_seconds = serializers.IntegerField(min_value=0, max_value=MAX_DURATION_SECONDS)


class GameSessionSerializer(serializers.ModelSerializer):
    topic = serializers.SerializerMethodField()
    teams = TeamResultSerializer(many=True, read_only=True)

    def get_topic(self, session) -> str | None:
        return services.topic_slug(session.topic) if session.topic else None

    class Meta:
        model = GameSession
        fields = [
            "id",
            "game_type",
            "topic",
            "paid_with",
            "coins_spent",
            "started_at",
            "finished_at",
            "duration_seconds",
            "teams",
        ]
        read_only_fields = fields
