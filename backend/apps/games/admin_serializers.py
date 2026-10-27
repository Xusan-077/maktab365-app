from django.db import transaction
from django.db.models import Max
from rest_framework import serializers

from apps.content.admin_serializers import LocalizedInput, StoredPathField
from apps.content.storage import covers_storage
from apps.core.fields import validate_localized_text

from .models import (
    OPTION_TEXT_MAX,
    OPTIONS_PER_QUESTION,
    QUESTION_TEXT_MAX,
    Difficulty,
    Option,
    Question,
    option_set_errors,
)

IMPORT_MAX = 200


def _localized(limit: int):
    """`LocalizedInput` validatorlari: umumiy qoida (uz majburiy) + har til matni uzunligi.
    (`validators=` berilsa DRF `default_validators` ni almashtiradi — shuning uchun ikkalasi.)"""

    def max_length(value: dict):
        if any(len(text) > limit for text in value.values()):
            raise serializers.ValidationError("text_too_long")

    return [validate_localized_text, max_length]


class OptionAdminSerializer(serializers.ModelSerializer):
    text = LocalizedInput(validators=_localized(OPTION_TEXT_MAX))

    class Meta:
        model = Option
        fields = ["id", "text", "is_correct", "order"]
        read_only_fields = ["id", "order"]


class QuestionInputMixin(serializers.Serializer):
    """Savol + aniq 4 variant (tartib A..D ro'yxat tartibidan), aniq 1 to'g'ri javob."""

    text = LocalizedInput(validators=_localized(QUESTION_TEXT_MAX))
    # Berilmasa model default'i (`medium`); `default=` PATCH sxemasida maydonni majburiy qiladi.
    difficulty = serializers.ChoiceField(choices=Difficulty.choices, required=False)
    options = OptionAdminSerializer(many=True)

    def validate_options(self, value):
        if errors := option_set_errors(value):
            raise serializers.ValidationError(errors)
        return value


class QuestionAdminSerializer(QuestionInputMixin, serializers.ModelSerializer):
    image = StoredPathField("images", storage=covers_storage, required=False)
    image_url = serializers.FileField(source="image", use_url=True, read_only=True, allow_null=True)

    class Meta:
        model = Question
        fields = [
            "id",
            "topic",
            "text",
            "image",
            "image_url",
            "difficulty",
            "order",
            "is_active",
            "options",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "topic", "order", "created_at", "updated_at"]

    def to_representation(self, question):
        data = super().to_representation(question)
        if not question.image:
            data["image_url"] = None
        return data

    @transaction.atomic
    def create(self, validated_data):
        options = validated_data.pop("options")
        topic = self.context["topic"]
        last = topic.questions.aggregate(last=Max("order"))["last"]
        question = Question.objects.create(
            topic=topic, order=0 if last is None else last + 1, **validated_data
        )
        write_options(question, options)
        return question

    @transaction.atomic
    def update(self, question, validated_data):
        options = validated_data.pop("options", None)
        for field, value in validated_data.items():
            setattr(question, field, value)
        question.save()
        if options is not None:
            write_options(question, options)
        return question


def write_options(question: Question, options: list[dict]) -> None:
    """4 variantni joyida yozadi (A..D tartibi bo'yicha; id'lar saqlanadi)."""
    # Avval to'g'ri belgisini olib tashlaymiz: "bitta to'g'ri" cheklovi oraliq holatda buzilmasin.
    question.options.update(is_correct=False)
    existing = {option.order: option for option in question.options.all()}
    for order, data in enumerate(options):
        option = existing.get(order) or Option(question=question, order=order)
        option.text = data["text"]
        option.is_correct = data["is_correct"]
        option.save()
    question.options.filter(order__gte=OPTIONS_PER_QUESTION).delete()


class QuestionImportItemSerializer(QuestionInputMixin):
    is_active = serializers.BooleanField(default=True)


class QuestionImportRequestSerializer(serializers.Serializer):
    questions = QuestionImportItemSerializer(many=True, allow_empty=False, max_length=IMPORT_MAX)
    # `true` — faqat tekshiradi (oldindan ko'rish), hech narsa saqlanmaydi.
    dry_run = serializers.BooleanField(default=False)


class QuestionImportResultSerializer(serializers.Serializer):
    created = serializers.IntegerField()
    dry_run = serializers.BooleanField()


class QuestionReorderRequestSerializer(serializers.Serializer):
    ids = serializers.ListField(child=serializers.UUIDField(), allow_empty=True)
