from django.conf import settings
from django.core.exceptions import ValidationError
from django.core.validators import MaxValueValidator
from django.db import models

from apps.content.models import PdfBookChapter
from apps.content.storage import covers_storage
from apps.core.fields import LocalizedTextField
from apps.core.models import TimeStampedModel, UUIDModel

OPTIONS_PER_QUESTION = 4
QUESTION_TEXT_MAX = 1000
OPTION_TEXT_MAX = 300


class Difficulty(models.TextChoices):
    EASY = "easy", "Easy"
    MEDIUM = "medium", "Medium"
    HARD = "hard", "Hard"


def option_set_errors(options) -> list[str]:
    """Variantlar to'plami qoidasi (serializer va `Question.clean` uchun yagona manba).

    `options` — `is_correct` atributi yoki kaliti bor obyektlar. Xatolar — barqaror kodlar.
    """
    errors = []
    if len(options) != OPTIONS_PER_QUESTION:
        errors.append("options_count")
    correct = sum(
        1
        for option in options
        if (option.get("is_correct") if isinstance(option, dict) else option.is_correct)
    )
    if correct != 1:
        errors.append("options_one_correct")
    return errors


class Question(UUIDModel, TimeStampedModel):
    """Mavzu (mundarija bo'limi) testi savoli: aniq 4 variant, aniq 1 to'g'ri javob."""

    # Mavzu = `PdfBookChapter` (alohida Topic modeli yo'q, qarang docs/api-mavzu-materiallari.md).
    topic = models.ForeignKey(PdfBookChapter, on_delete=models.CASCADE, related_name="questions")
    text = LocalizedTextField()
    # Ixtiyoriy rasm: admin `uploads/` (kind=image) natijasi, ommaviy `covers` saqlashda.
    image = models.FileField(upload_to="images/", blank=True, storage=covers_storage)
    difficulty = models.CharField(
        max_length=8, choices=Difficulty.choices, default=Difficulty.MEDIUM
    )
    order = models.PositiveIntegerField(default=0)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["order", "created_at"]
        indexes = [models.Index(fields=["topic", "is_active"])]

    def __str__(self):
        return self.text.get("uz", "")[:60]

    def clean(self):
        super().clean()
        # Yangi (saqlanmagan) savolda variantlar hali yo'q — ular serializer'da tekshiriladi.
        if (
            self.pk
            and not self._state.adding
            and (errors := option_set_errors(list(self.options.all())))
        ):
            raise ValidationError({"options": errors})


class Option(UUIDModel):
    question = models.ForeignKey(Question, on_delete=models.CASCADE, related_name="options")
    text = LocalizedTextField()
    is_correct = models.BooleanField(default=False)
    # 0..3: savoldagi joyi (A, B, C, D).
    order = models.PositiveSmallIntegerField(
        validators=[MaxValueValidator(OPTIONS_PER_QUESTION - 1)]
    )

    class Meta:
        ordering = ["order"]
        constraints = [
            models.UniqueConstraint(fields=["question", "order"], name="games_option_order_unique"),
            # Bir savolda 2 ta to'g'ri javob bo'lishi baza darajasida ham mumkin emas.
            models.UniqueConstraint(
                fields=["question"],
                condition=models.Q(is_correct=True),
                name="games_option_one_correct",
            ),
            models.CheckConstraint(
                condition=models.Q(order__lt=OPTIONS_PER_QUESTION), name="games_option_order_lt_4"
            ),
        ]

    def __str__(self):
        return self.text.get("uz", "")[:60]


class GameSession(UUIDModel):
    """O'yin statistikasi: boshlash hech narsa sarflamaydi va bloklanmaydi."""

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="game_sessions"
    )
    # Mavzu o'chirilsa ham natija tarixi qoladi.
    topic = models.ForeignKey(
        PdfBookChapter,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="game_sessions",
    )
    game_type = models.CharField(max_length=32)
    started_at = models.DateTimeField(auto_now_add=True, db_index=True)
    finished_at = models.DateTimeField(null=True, blank=True)
    duration_seconds = models.PositiveIntegerField(null=True, blank=True)
    # [{name, score, correct, total}] — jamoalar (yakka o'yinda bitta).
    teams = models.JSONField(default=list, blank=True)

    class Meta:
        ordering = ["-started_at"]
        indexes = [models.Index(fields=["user", "-started_at"])]
