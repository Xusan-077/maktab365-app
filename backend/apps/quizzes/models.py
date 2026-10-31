from django.conf import settings
from django.db import models
from django.db.models.functions import Lower

from apps.content.storage import covers_storage
from apps.core.models import TimeStampedModel, UUIDModel

TITLE_MAX = 120
DESCRIPTION_MAX = 1000
CATEGORY_NAME_MAX = 40
QUESTION_TEXT_MAX = 500
OPTION_TEXT_MAX = 200
OPTIONS_MIN = 2
OPTIONS_MAX = 6
QUESTIONS_MAX = 100
QUIZZES_PER_TEACHER_MAX = 200
CATEGORIES_PER_TEACHER_MAX = 30
TIME_PER_QUESTION_CHOICES = (15, 30, 60)


class Visibility(models.TextChoices):
    PRIVATE = "private", "Private"
    PUBLIC = "public", "Public"


class QuizCategory(UUIDModel):
    """Kategoriya: `teacher=null` — tayyor (hamma uchun), aks holda ustozning o'zi qo'shgani."""

    name = models.CharField(max_length=CATEGORY_NAME_MAX)
    teacher = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.CASCADE,
        related_name="quiz_categories",
    )
    # Tayyor kategoriyalar ro'yxatdagi joyi; ustoznikilari oxirida (nom bo'yicha).
    order = models.PositiveSmallIntegerField(default=100)

    class Meta:
        ordering = ["order", "name"]
        constraints = [
            models.UniqueConstraint(
                Lower("name"),
                "teacher",
                name="quizzes_category_teacher_name_unique",
                condition=models.Q(teacher__isnull=False),
            ),
            models.UniqueConstraint(
                Lower("name"),
                name="quizzes_category_preset_name_unique",
                condition=models.Q(teacher__isnull=True),
            ),
        ]

    def __str__(self):
        return self.name


class Quiz(UUIDModel, TimeStampedModel):
    """Ustozning shaxsiy testi (o'quvchilar bazasiga bog'lanmaydi)."""

    teacher = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="quizzes"
    )
    title = models.CharField(max_length=TITLE_MAX)
    description = models.TextField(max_length=DESCRIPTION_MAX, blank=True)
    category = models.ForeignKey(
        QuizCategory, null=True, blank=True, on_delete=models.SET_NULL, related_name="quizzes"
    )
    cover_image = models.FileField(
        upload_to="images/", blank=True, null=True, storage=covers_storage
    )
    visibility = models.CharField(
        max_length=7, choices=Visibility.choices, default=Visibility.PRIVATE
    )
    # Savolga soniya; `null` — taymersiz.
    time_per_question = models.PositiveSmallIntegerField(
        null=True, blank=True, choices=[(v, str(v)) for v in TIME_PER_QUESTION_CHOICES]
    )
    shuffle_questions = models.BooleanField(default=False)
    shuffle_options = models.BooleanField(default=False)

    class Meta:
        ordering = ["-updated_at"]
        indexes = [models.Index(fields=["teacher", "-updated_at"])]
        verbose_name_plural = "quizzes"

    def __str__(self):
        return self.title


class QuizQuestion(UUIDModel):
    quiz = models.ForeignKey(Quiz, on_delete=models.CASCADE, related_name="questions")
    text = models.CharField(max_length=QUESTION_TEXT_MAX)
    image = models.FileField(upload_to="images/", blank=True, null=True, storage=covers_storage)
    order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["order", "id"]

    def __str__(self):
        return self.text[:60]


class QuizOption(UUIDModel):
    question = models.ForeignKey(QuizQuestion, on_delete=models.CASCADE, related_name="options")
    text = models.CharField(max_length=OPTION_TEXT_MAX)
    is_correct = models.BooleanField(default=False)
    order = models.PositiveSmallIntegerField(default=0)

    class Meta:
        ordering = ["order", "id"]
        constraints = [
            # Bir savolda ikkita to'g'ri javob baza darajasida ham mumkin emas.
            models.UniqueConstraint(
                fields=["question"],
                condition=models.Q(is_correct=True),
                name="quizzes_option_one_correct",
            ),
        ]

    def __str__(self):
        return self.text[:60]


class QuizAttempt(UUIDModel):
    """Ustozning o'ynagan natijasi. `answers` — o'sha paytdagi matnlar nusxasi, shuning uchun test
    keyin tahrirlansa ham tarix o'zgarmaydi."""

    quiz = models.ForeignKey(Quiz, on_delete=models.CASCADE, related_name="attempts")
    teacher = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="quiz_attempts"
    )
    score = models.PositiveSmallIntegerField()
    total = models.PositiveSmallIntegerField()
    time_spent = models.PositiveIntegerField(default=0)
    answers = models.JSONField(default=list, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [models.Index(fields=["quiz", "-created_at"])]
