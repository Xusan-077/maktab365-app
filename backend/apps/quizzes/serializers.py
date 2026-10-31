from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers

from apps.content.admin_serializers import StoredPathField
from apps.content.storage import covers_storage

from . import services
from .models import (
    CATEGORIES_PER_TEACHER_MAX,
    CATEGORY_NAME_MAX,
    DESCRIPTION_MAX,
    OPTION_TEXT_MAX,
    OPTIONS_MAX,
    OPTIONS_MIN,
    QUESTION_TEXT_MAX,
    QUESTIONS_MAX,
    QUIZZES_PER_TEACHER_MAX,
    TIME_PER_QUESTION_CHOICES,
    TITLE_MAX,
    Quiz,
    QuizAttempt,
    QuizCategory,
    QuizOption,
    QuizQuestion,
    Visibility,
)


class CategorySerializer(serializers.ModelSerializer):
    is_preset = serializers.SerializerMethodField()

    class Meta:
        model = QuizCategory
        fields = ["id", "name", "is_preset"]
        read_only_fields = fields

    def get_is_preset(self, category) -> bool:
        return category.teacher_id is None


class CategoryCreateSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=CATEGORY_NAME_MAX, trim_whitespace=True)

    def validate_name(self, value):
        teacher = self.context["request"].user
        if services.categories_for(teacher).filter(name__iexact=value).exists():
            raise serializers.ValidationError("category_exists")
        if teacher.quiz_categories.count() >= CATEGORIES_PER_TEACHER_MAX:
            raise serializers.ValidationError("categories_limit")
        return value


class OptionSerializer(serializers.ModelSerializer):
    # Mavjud variantni yangilash uchun `id` (yangisida yo'q).
    id = serializers.UUIDField(required=False)
    text = serializers.CharField(max_length=OPTION_TEXT_MAX, trim_whitespace=True)

    class Meta:
        model = QuizOption
        fields = ["id", "text", "is_correct"]


class QuestionSerializer(serializers.ModelSerializer):
    id = serializers.UUIDField(required=False)
    text = serializers.CharField(max_length=QUESTION_TEXT_MAX, trim_whitespace=True)
    image = StoredPathField("images", storage=covers_storage, required=False, allow_null=True)
    image_url = serializers.FileField(source="image", use_url=True, read_only=True, allow_null=True)
    options = OptionSerializer(many=True)

    class Meta:
        model = QuizQuestion
        fields = ["id", "text", "image", "image_url", "options"]

    def to_representation(self, question):
        data = super().to_representation(question)
        if not question.image:
            data["image_url"] = None
            data["image"] = ""
        return data

    def validate_options(self, value):
        errors = []
        if not OPTIONS_MIN <= len(value) <= OPTIONS_MAX:
            errors.append("options_count")
        if sum(1 for option in value if option["is_correct"]) != 1:
            errors.append("options_one_correct")
        if errors:
            raise serializers.ValidationError(errors)
        return value


class QuizListSerializer(serializers.ModelSerializer):
    category = CategorySerializer(read_only=True, allow_null=True)
    cover_url = serializers.FileField(
        source="cover_image", use_url=True, read_only=True, allow_null=True
    )
    question_count = serializers.IntegerField(read_only=True)
    attempts_count = serializers.IntegerField(read_only=True)
    # Eng yaxshi natija, butun foiz (urinish bo'lmasa null).
    best_percent = serializers.IntegerField(read_only=True, allow_null=True)

    class Meta:
        model = Quiz
        fields = [
            "id",
            "title",
            "description",
            "category",
            "cover_url",
            "visibility",
            "time_per_question",
            "shuffle_questions",
            "shuffle_options",
            "question_count",
            "attempts_count",
            "best_percent",
            "created_at",
            "updated_at",
        ]
        read_only_fields = fields

    def to_representation(self, quiz):
        data = super().to_representation(quiz)
        if not quiz.cover_image:
            data["cover_url"] = None
        return data


class QuizSerializer(serializers.ModelSerializer):
    """To'liq test (ustoz): savollar va variantlar `is_correct` bilan, nested yoziladi."""

    title = serializers.CharField(max_length=TITLE_MAX, trim_whitespace=True)
    description = serializers.CharField(
        max_length=DESCRIPTION_MAX, allow_blank=True, required=False, trim_whitespace=True
    )
    category = CategorySerializer(read_only=True, allow_null=True)
    category_id = serializers.PrimaryKeyRelatedField(
        source="category",
        queryset=QuizCategory.objects.all(),
        write_only=True,
        required=False,
        allow_null=True,
    )
    cover_image = StoredPathField("images", storage=covers_storage, required=False, allow_null=True)
    cover_url = serializers.FileField(
        source="cover_image", use_url=True, read_only=True, allow_null=True
    )
    visibility = serializers.ChoiceField(choices=Visibility.choices, required=False)
    time_per_question = serializers.ChoiceField(
        choices=TIME_PER_QUESTION_CHOICES, required=False, allow_null=True
    )
    questions = QuestionSerializer(many=True)

    class Meta:
        model = Quiz
        fields = [
            "id",
            "title",
            "description",
            "category",
            "category_id",
            "cover_image",
            "cover_url",
            "visibility",
            "time_per_question",
            "shuffle_questions",
            "shuffle_options",
            "questions",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]

    def to_representation(self, quiz):
        data = super().to_representation(quiz)
        if not quiz.cover_image:
            data["cover_url"] = None
            data["cover_image"] = ""
        return data

    def validate_category_id(self, category):
        teacher = self.context["request"].user
        if category is not None and category.teacher_id not in (None, teacher.pk):
            raise serializers.ValidationError("invalid_category")
        return category

    def validate_questions(self, value):
        if not value:
            raise serializers.ValidationError("questions_required")
        if len(value) > QUESTIONS_MAX:
            raise serializers.ValidationError("questions_too_many")
        return value

    def validate(self, attrs):
        if self.instance is None and (
            self.context["request"].user.quizzes.count() >= QUIZZES_PER_TEACHER_MAX
        ):
            raise serializers.ValidationError({"title": ["quizzes_limit"]})
        return attrs

    def create(self, validated_data):
        return services.save_quiz(self, self.context["request"].user)

    def update(self, quiz, validated_data):
        return services.save_quiz(self, self.context["request"].user)


class QuizUploadRequestSerializer(serializers.Serializer):
    file = serializers.FileField()


class QuizUploadResultSerializer(serializers.Serializer):
    path = serializers.CharField()
    url = serializers.CharField()


class AttemptAnswerSerializer(serializers.Serializer):
    question_id = serializers.UUIDField()
    option_id = serializers.UUIDField(allow_null=True)


class AttemptCreateSerializer(serializers.Serializer):
    answers = AttemptAnswerSerializer(many=True, min_length=1, max_length=QUESTIONS_MAX)
    # Bir o'yin uchun bitta natija: bir xil `attempt_id` qayta yuborilsa, mavjud natija qaytadi.
    attempt_id = serializers.UUIDField(required=False)
    time_spent = serializers.IntegerField(min_value=0, max_value=24 * 60 * 60)


class AttemptReviewSerializer(serializers.Serializer):
    question_id = serializers.UUIDField()
    question = serializers.CharField()
    option_id = serializers.UUIDField(allow_null=True)
    option_text = serializers.CharField(allow_null=True)
    correct_option_id = serializers.UUIDField(allow_null=True)
    correct_option_text = serializers.CharField(allow_null=True)
    correct = serializers.BooleanField()


class AttemptSerializer(serializers.ModelSerializer):
    answers = AttemptReviewSerializer(many=True, read_only=True)

    class Meta:
        model = QuizAttempt
        fields = ["id", "quiz", "score", "total", "time_spent", "answers", "created_at"]
        read_only_fields = fields


class PublicOptionSerializer(serializers.Serializer):
    id = serializers.UUIDField()
    text = serializers.CharField()


def _absolute_url(serializer, file) -> str | None:
    if not file:
        return None
    url = file.url
    request = serializer.context.get("request")
    return request.build_absolute_uri(url) if request and url.startswith("/") else url


class PublicQuestionSerializer(serializers.Serializer):
    id = serializers.UUIDField()
    text = serializers.CharField()
    image_url = serializers.SerializerMethodField()
    options = PublicOptionSerializer(many=True)

    @extend_schema_field(serializers.CharField(allow_null=True))
    def get_image_url(self, question):
        return _absolute_url(self, question.image)


class PublicQuizSerializer(serializers.Serializer):
    """Ochiq test: `is_correct` yo'q, javob `check/` orqali serverda tekshiriladi."""

    id = serializers.UUIDField()
    title = serializers.CharField()
    description = serializers.CharField()
    category = CategorySerializer(allow_null=True)
    cover_url = serializers.SerializerMethodField()
    time_per_question = serializers.IntegerField(allow_null=True)
    shuffle_questions = serializers.BooleanField()
    shuffle_options = serializers.BooleanField()
    questions = PublicQuestionSerializer(many=True)

    @extend_schema_field(serializers.CharField(allow_null=True))
    def get_cover_url(self, quiz):
        return _absolute_url(self, quiz.cover_image)


class CheckRequestSerializer(serializers.Serializer):
    question_id = serializers.UUIDField()
    option_id = serializers.UUIDField()


class CheckResultSerializer(serializers.Serializer):
    correct = serializers.BooleanField()
    correct_option_id = serializers.UUIDField()
