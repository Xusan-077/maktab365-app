from django.conf import settings
from django.db import models

from apps.core.models import TimeStampedModel, UUIDModel


class Kind(models.TextChoices):
    QUESTION = "question", "Question"
    SUGGESTION = "suggestion", "Suggestion"
    BUG = "bug", "Bug"
    CONTENT_ERROR = "content_error", "Content error"


class Status(models.TextChoices):
    NEW = "new", "New"
    IN_PROGRESS = "in_progress", "In progress"
    RESOLVED = "resolved", "Resolved"
    SPAM = "spam", "Spam"


class SupportMessage(UUIDModel, TimeStampedModel):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="support_messages",
    )
    name = models.CharField(max_length=100, blank=True)
    email = models.EmailField(max_length=254, blank=True)
    kind = models.CharField(max_length=16, choices=Kind.choices, default=Kind.QUESTION)
    message = models.TextField(max_length=2000)
    page_url = models.URLField(max_length=500, blank=True)
    # Mavzu identifikatori (mavzu sahifasidagi "Xato topdingizmi?" havolasidan).
    topic = models.CharField(max_length=100, blank=True)
    user_agent = models.CharField(max_length=300, blank=True)
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.NEW)
    staff_note = models.TextField(blank=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [models.Index(fields=["user", "-created_at"])]

    def __str__(self) -> str:
        return f"{self.kind}: {self.message[:40]}"
