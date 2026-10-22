from django.conf import settings
from django.db import models
from django.db.models import Q

from apps.core.models import TimeStampedModel, UUIDModel

RECENT_LIMIT = 20


class ReadStatus(models.TextChoices):
    NOT_STARTED = "not_started", "Not started"
    IN_PROGRESS = "in_progress", "In progress"
    READ = "read", "Read"


class ExerciseStatus(models.TextChoices):
    NOT_STARTED = "not_started", "Not started"
    IN_PROGRESS = "in_progress", "In progress"
    PASSED = "passed", "Passed"


# Holat darajalari: holat faqat yuqoriga ko'tariladi (monoton).
READ_RANK = {ReadStatus.NOT_STARTED: 0, ReadStatus.IN_PROGRESS: 1, ReadStatus.READ: 2}
EXERCISE_RANK = {
    ExerciseStatus.NOT_STARTED: 0,
    ExerciseStatus.IN_PROGRESS: 1,
    ExerciseStatus.PASSED: 2,
}


class TopicProgress(UUIDModel, TimeStampedModel):
    """Foydalanuvchining bitta mavzu bo'yicha progressi. "O'qidim" va "mashqdan o'tdim" alohida."""

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="topic_progress"
    )
    topic = models.ForeignKey("content.Topic", on_delete=models.CASCADE, related_name="+")
    read_status = models.CharField(
        max_length=16, choices=ReadStatus.choices, default=ReadStatus.NOT_STARTED
    )
    exercise_status = models.CharField(
        max_length=16, choices=ExerciseStatus.choices, default=ExerciseStatus.NOT_STARTED
    )
    last_block_id = models.CharField(max_length=64, blank=True)
    scroll_position = models.FloatField(null=True, blank=True)
    # [{"exercise_id", "attempts" (xato urinishlar), "last_wrong_at"}] — "Takrorlash kerak" manbai.
    mistakes = models.JSONField(default=list, blank=True)
    # {"solved": [exercise_id…], "attempts": {exercise_id: jami urinishlar}}
    exercise_stats = models.JSONField(default=dict, blank=True)
    first_opened_at = models.DateTimeField(null=True, blank=True)
    read_at = models.DateTimeField(null=True, blank=True)
    passed_at = models.DateTimeField(null=True, blank=True)
    # Monoton bo'lmagan maydonlar (last_block_id, scroll_position, mistakes) shu vaqtdan
    # yangiroq mijoz yozuvi bilan almashadi: eski qurilmaning kech kelgan yozuvi yangisini bosmaydi.
    client_updated_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["user", "topic"], name="progress_once_per_topic"),
        ]
        indexes = [models.Index(fields=["user", "-updated_at"])]

    def __str__(self):
        return f"{self.user_id}/{self.topic_id}"


class BookmarkKind(models.TextChoices):
    BOOK = "book", "Book"
    TOPIC = "topic", "Topic"


class Bookmark(UUIDModel):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="bookmarks"
    )
    kind = models.CharField(max_length=8, choices=BookmarkKind.choices)
    book = models.ForeignKey(
        "content.Book", null=True, blank=True, on_delete=models.CASCADE, related_name="+"
    )
    topic = models.ForeignKey(
        "content.Topic", null=True, blank=True, on_delete=models.CASCADE, related_name="+"
    )
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["user", "topic"],
                condition=Q(kind="topic"),
                name="bookmark_topic_once",
            ),
            models.UniqueConstraint(
                fields=["user", "book"],
                condition=Q(kind="book"),
                name="bookmark_book_once",
            ),
            models.CheckConstraint(
                condition=(
                    Q(kind="topic", topic__isnull=False, book__isnull=True)
                    | Q(kind="book", book__isnull=False, topic__isnull=True)
                ),
                name="bookmark_kind_matches_target",
            ),
        ]

    def __str__(self):
        return f"{self.user_id}/{self.kind}"


class StudyGoal(UUIDModel, TimeStampedModel):
    """O'quvchining shaxsiy o'qish rejasi maqsadi."""

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="study_goals"
    )
    title = models.CharField(max_length=200)
    topic = models.ForeignKey(
        "content.Topic", null=True, blank=True, on_delete=models.SET_NULL, related_name="+"
    )
    due_date = models.DateField(null=True, blank=True)
    done_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]

    @property
    def is_done(self) -> bool:
        return self.done_at is not None

    def __str__(self):
        return self.title


class RecentView(UUIDModel):
    """Oxirgi ochilgan mavzular (har foydalanuvchida `RECENT_LIMIT` tagacha)."""

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="recent_views"
    )
    topic = models.ForeignKey("content.Topic", on_delete=models.CASCADE, related_name="+")
    viewed_at = models.DateTimeField()

    class Meta:
        ordering = ["-viewed_at"]
        constraints = [models.UniqueConstraint(fields=["user", "topic"], name="recent_once")]
        indexes = [models.Index(fields=["user", "-viewed_at"])]


class PdfReadProgress(UUIDModel, TimeStampedModel):
    """PDF darslikda oxirgi ochilgan sahifa (foydalanuvchi + kitob uchun bitta yozuv)."""

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="pdf_progress"
    )
    pdf_book = models.ForeignKey("content.PdfBook", on_delete=models.CASCADE, related_name="+")
    last_page = models.PositiveIntegerField()
    # Faqat shu vaqtdan yangiroq mijoz yozuvi sahifani almashtiradi: kech kelgan eski yozuv
    # (boshqa qurilma, oflayn navbat) yangisini bosmaydi.
    client_updated_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["user", "pdf_book"], name="pdf_progress_once_per_book"),
            models.CheckConstraint(condition=Q(last_page__gte=1), name="pdf_progress_page_min_1"),
        ]
        indexes = [models.Index(fields=["user", "-updated_at"])]

    def __str__(self):
        return f"{self.user_id}/{self.pdf_book_id}"
