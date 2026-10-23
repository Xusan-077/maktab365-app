from django.conf import settings
from django.db import models
from django.db.models import Q
from django.utils import timezone

from apps.core.models import TimeStampedModel, UUIDModel


class PdfReadStatus(models.TextChoices):
    IN_PROGRESS = "in_progress", "In progress"
    READ = "read", "Read"


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
    # Holat monoton: `read` bir marta qo'yilgach orqaga qaytmaydi (o'quvchi sahifaga qaytsa ham).
    read_status = models.CharField(
        max_length=16, choices=PdfReadStatus.choices, default=PdfReadStatus.IN_PROGRESS
    )
    first_opened_at = models.DateTimeField(default=timezone.now)
    read_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["user", "pdf_book"], name="pdf_progress_once_per_book"),
            models.CheckConstraint(condition=Q(last_page__gte=1), name="pdf_progress_page_min_1"),
        ]
        indexes = [models.Index(fields=["user", "-updated_at"])]

    def __str__(self):
        return f"{self.user_id}/{self.pdf_book_id}"


class PdfBookmark(UUIDModel):
    """Saqlangan PDF darslik (foydalanuvchi + kitob uchun bitta yozuv)."""

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="pdf_bookmarks"
    )
    pdf_book = models.ForeignKey("content.PdfBook", on_delete=models.CASCADE, related_name="+")
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ["-created_at"]
        constraints = [
            models.UniqueConstraint(fields=["user", "pdf_book"], name="pdf_bookmark_once_per_book")
        ]

    def __str__(self):
        return f"{self.user_id}/{self.pdf_book_id}"


class StudyGoal(UUIDModel, TimeStampedModel):
    """O'quvchining shaxsiy rejasi: nom, ixtiyoriy kitob va muddat."""

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="study_goals"
    )
    title = models.CharField(max_length=200)
    pdf_book = models.ForeignKey(
        "content.PdfBook", null=True, blank=True, on_delete=models.SET_NULL, related_name="+"
    )
    due_date = models.DateField(null=True, blank=True)
    done_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        indexes = [models.Index(fields=["user", "done_at"])]

    def __str__(self):
        return f"{self.user_id}/{self.title}"


class AnnotationColor(models.TextChoices):
    YELLOW = "yellow", "Yellow"
    GREEN = "green", "Green"
    PINK = "pink", "Pink"


class PdfAnnotation(TimeStampedModel):
    """Sahifadagi belgi: bir yoki bir necha to'rtburchak (0..1 nisbatda), 3 rang va qisqa eslatma.

    `id` mijozda yaratiladi (UUID): takror yozish va mehmon ma'lumotini qo'shish idempotent.
    """

    id = models.UUIDField(primary_key=True, editable=False)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="pdf_annotations"
    )
    pdf_book = models.ForeignKey("content.PdfBook", on_delete=models.CASCADE, related_name="+")
    page = models.PositiveIntegerField()
    color = models.CharField(
        max_length=8, choices=AnnotationColor.choices, default=AnnotationColor.YELLOW
    )
    rects = models.JSONField(default=list)
    note = models.CharField(max_length=200, blank=True)

    class Meta:
        ordering = ["page", "created_at"]
        indexes = [models.Index(fields=["user", "pdf_book", "page"])]
        constraints = [
            models.CheckConstraint(condition=Q(page__gte=1), name="pdf_annotation_page_min_1")
        ]

    def __str__(self):
        return f"{self.user_id}/{self.pdf_book_id}/{self.page}"
