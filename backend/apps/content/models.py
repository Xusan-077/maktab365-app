from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models
from django.utils import timezone

from apps.core.fields import LocalizedTextField
from apps.core.models import TimeStampedModel, UUIDModel


class Subject(UUIDModel, TimeStampedModel):
    slug = models.SlugField(unique=True)
    title = LocalizedTextField()
    icon = models.CharField(max_length=64, blank=True)
    order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["order", "slug"]

    def __str__(self):
        return self.slug


class PdfBookStatus(models.TextChoices):
    DRAFT = "draft", "Draft"
    PUBLISHED = "published", "Published"


class PdfBook(UUIDModel, TimeStampedModel):
    """PDF darslik: fayl obyekt saqlashda (DB'da emas), o'quvchi sahifa-sahifa o'qiydi."""

    title = LocalizedTextField()
    grade = models.PositiveSmallIntegerField(
        validators=[MinValueValidator(1), MaxValueValidator(11)], db_index=True
    )
    subject = models.ForeignKey(Subject, on_delete=models.PROTECT, related_name="pdf_books")
    # Saqlash kaliti `pdf-books/<uuid>.pdf`: foydalanuvchi nomi hech qachon yo'lga tushmaydi.
    file = models.FileField(upload_to="pdf-books/", blank=True)
    size_bytes = models.PositiveBigIntegerField(default=0)
    page_count = models.PositiveIntegerField(default=0)
    cover = models.FileField(upload_to="covers/", blank=True)
    status = models.CharField(
        max_length=16, choices=PdfBookStatus.choices, default=PdfBookStatus.DRAFT, db_index=True
    )
    published_at = models.DateTimeField(null=True, blank=True)
    # Yuklash davom etayotganda: yangi fayl kaliti va (S3 multipart) upload id. `complete`gacha
    # `file` ga tegilmaydi, shuning uchun almashtirish paytida eski fayl o'qilaveradi.
    pending_file = models.CharField(max_length=255, blank=True, editable=False)
    pending_upload_id = models.CharField(max_length=255, blank=True, editable=False)

    class Meta:
        ordering = ["grade", "-created_at"]
        indexes = [models.Index(fields=["subject", "grade", "status"])]

    def __str__(self):
        return str(self.pk)

    def save(self, *args, **kwargs):
        if self.status == PdfBookStatus.PUBLISHED and self.published_at is None:
            self.published_at = timezone.now()
        super().save(*args, **kwargs)
