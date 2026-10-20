from django.conf import settings
from django.core.exceptions import ValidationError
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models
from django.utils import timezone

from apps.core.fields import LocalizedTextField
from apps.core.models import TimeStampedModel, UUIDModel

from .schemas import format_issues, validate_blocks

REVISION_LIMIT = 50


def validate_topic_blocks(value):
    """`blocks` — frontend `TopicBlock` sxemasi (schemas.py); xatoda blok va maydon yo'li."""
    issues = validate_blocks(value)
    if issues:
        raise ValidationError(format_issues(issues), code="invalid_blocks")


class Subject(UUIDModel, TimeStampedModel):
    slug = models.SlugField(unique=True)
    title = LocalizedTextField()
    icon = models.CharField(max_length=64, blank=True)
    order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["order", "slug"]

    def __str__(self):
        return self.slug


class Book(UUIDModel, TimeStampedModel):
    # Frontend kitob id'si (`algebra-9`) bilan bir xil: butun katalogda yagona.
    slug = models.SlugField(unique=True)
    subject = models.ForeignKey(Subject, on_delete=models.PROTECT, related_name="books")
    grade = models.PositiveSmallIntegerField(
        validators=[MinValueValidator(1), MaxValueValidator(11)], db_index=True
    )
    title = LocalizedTextField()
    author = LocalizedTextField()
    publisher = models.CharField(max_length=200, blank=True)
    edition = LocalizedTextField()
    year = models.PositiveSmallIntegerField(
        validators=[MinValueValidator(1990), MaxValueValidator(2100)]
    )
    cover = models.FileField(upload_to="covers/", blank=True)
    pdf = models.FileField(upload_to="pdf/", blank=True)
    topics_ready = models.BooleanField(default=False)
    order = models.PositiveIntegerField(default=0)
    is_published = models.BooleanField(default=False, db_index=True)

    class Meta:
        ordering = ["grade", "order", "slug"]
        indexes = [models.Index(fields=["subject", "grade"])]

    def __str__(self):
        return self.slug


class Chapter(UUIDModel, TimeStampedModel):
    book = models.ForeignKey(Book, on_delete=models.CASCADE, related_name="chapters")
    # Kontent papkasi nomi: import shu bo'yicha upsert qiladi.
    slug = models.SlugField()
    title = LocalizedTextField()
    order = models.PositiveIntegerField()

    class Meta:
        ordering = ["book", "order"]
        constraints = [
            models.UniqueConstraint(fields=["book", "slug"], name="chapter_slug_per_book"),
            models.UniqueConstraint(
                fields=["book", "order"],
                name="chapter_order_per_book",
                deferrable=models.Deferrable.DEFERRED,
            ),
        ]

    def __str__(self):
        return f"{self.book_id}/{self.slug}"


class TopicStatus(models.TextChoices):
    DRAFT = "draft", "Draft"
    REVIEWED = "reviewed", "Reviewed"
    PUBLISHED = "published", "Published"


class Topic(UUIDModel, TimeStampedModel):
    chapter = models.ForeignKey(Chapter, on_delete=models.CASCADE, related_name="topics")
    # `chapter.book` nusxasi: slug kitob ichida unique bo'lishi uchun (save() moslab turadi).
    book = models.ForeignKey(Book, on_delete=models.CASCADE, related_name="topics", editable=False)
    slug = models.SlugField()
    title = LocalizedTextField()
    summary = LocalizedTextField()
    blocks = models.JSONField(default=list, validators=[validate_topic_blocks])
    status = models.CharField(
        max_length=16, choices=TopicStatus.choices, default=TopicStatus.DRAFT, db_index=True
    )
    reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="+"
    )
    reviewed_at = models.DateTimeField(null=True, blank=True)
    notes = models.TextField(blank=True)
    order = models.PositiveIntegerField()
    published_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["chapter__order", "order"]
        constraints = [
            models.UniqueConstraint(fields=["book", "slug"], name="topic_slug_per_book"),
            models.UniqueConstraint(
                fields=["chapter", "order"],
                name="topic_order_per_chapter",
                deferrable=models.Deferrable.DEFERRED,
            ),
        ]
        indexes = [models.Index(fields=["book", "status"])]

    def __str__(self):
        return f"{self.book_id}/{self.slug}"

    def save(self, *args, **kwargs):
        self.book_id = self.chapter.book_id
        now = timezone.now()
        if self.status == TopicStatus.PUBLISHED and self.published_at is None:
            self.published_at = now
        if self.status != TopicStatus.DRAFT and self.reviewed_at is None:
            self.reviewed_at = now
        update_fields = kwargs.get("update_fields")
        if update_fields is not None:
            kwargs["update_fields"] = {*update_fields, "book", "published_at", "reviewed_at"}
        super().save(*args, **kwargs)
        self._snapshot()

    def _snapshot(self):
        """Mazmun (sarlavha/bloklar) o'zgargan bo'lsagina yangi revision; oxirgi 50 ta saqlanadi."""
        last = self.revisions.order_by("-created_at", "-id").first()
        if last and last.title == self.title and last.blocks == self.blocks:
            return
        TopicRevision.objects.create(
            topic=self,
            title=self.title,
            blocks=self.blocks,
            author=getattr(self, "revision_author", None),
            comment=getattr(self, "revision_comment", ""),
        )
        stale = self.revisions.order_by("-created_at", "-id").values_list("pk", flat=True)[
            REVISION_LIMIT:
        ]
        TopicRevision.objects.filter(pk__in=list(stale)).delete()


class TopicRevision(UUIDModel, TimeStampedModel):
    topic = models.ForeignKey(Topic, on_delete=models.CASCADE, related_name="revisions")
    title = LocalizedTextField()
    blocks = models.JSONField(default=list)
    author = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="+"
    )
    comment = models.CharField(max_length=200, blank=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.topic_id} @ {self.created_at:%Y-%m-%d %H:%M}"
