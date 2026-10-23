from django.core.validators import MaxLengthValidator, MaxValueValidator, MinValueValidator
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


DESCRIPTION_MAX = 2000
CHAPTER_TITLE_MAX = 200


class PdfBookStatus(models.TextChoices):
    DRAFT = "draft", "Draft"
    PUBLISHED = "published", "Published"


class PdfBook(UUIDModel, TimeStampedModel):
    """PDF darslik: fayl obyekt saqlashda (DB'da emas), o'quvchi sahifa-sahifa o'qiydi."""

    title = LocalizedTextField()
    description = models.TextField(blank=True, validators=[MaxLengthValidator(DESCRIPTION_MAX)])
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
    pending_file = models.CharField(max_length=1024, blank=True, editable=False)
    # R2/S3 UploadId 255 belgidan uzun bo'lishi mumkin: TextField (uzunlik chegarasi yo'q).
    pending_upload_id = models.TextField(blank=True, editable=False)

    class Meta:
        ordering = ["grade", "-created_at"]
        indexes = [models.Index(fields=["subject", "grade", "status"])]

    def __str__(self):
        return str(self.pk)

    def save(self, *args, **kwargs):
        if self.status == PdfBookStatus.PUBLISHED and self.published_at is None:
            self.published_at = timezone.now()
        super().save(*args, **kwargs)

    @property
    def chapter_tree(self) -> list[dict]:
        """Mundarija: yuqori daraja bo'limlari, har birida `children` (2 daraja)."""
        rows = list(self.chapters.all())
        children: dict = {}
        for row in rows:
            if row.parent_id:
                children.setdefault(row.parent_id, []).append(row)
        return [
            {
                "id": row.pk,
                "title": row.title,
                "page": row.page,
                "slides": row.slides_info,
                "children": [
                    {
                        "id": child.pk,
                        "title": child.title,
                        "page": child.page,
                        "slides": child.slides_info,
                    }
                    for child in children.get(row.pk, [])
                ],
            }
            for row in rows
            if row.parent_id is None
        ]


class PdfBookChapter(UUIDModel):
    """PDF mundarijasi qatori: sarlavha va PDF sahifa raqami (1 dan). Ichma-ich 2 daraja."""

    book = models.ForeignKey(PdfBook, on_delete=models.CASCADE, related_name="chapters")
    parent = models.ForeignKey(
        "self", null=True, blank=True, on_delete=models.CASCADE, related_name="children"
    )
    title = models.CharField(max_length=CHAPTER_TITLE_MAX)
    page = models.PositiveIntegerField(validators=[MinValueValidator(1)])
    order = models.PositiveIntegerField(default=0)
    # Ixtiyoriy prezentatsiya (PDF slaydlar): obyekt saqlashdagi kalit (`pdf-slides/<uuid>.pdf`).
    # Kalit va upload id uzun bo'lishi mumkin (R2 UploadId > 255): TextField.
    slides_file = models.TextField(blank=True, default="", editable=False)
    slides_name = models.CharField(max_length=255, blank=True, default="", editable=False)
    slides_page_count = models.PositiveIntegerField(default=0, editable=False)
    slides_size_bytes = models.PositiveBigIntegerField(default=0, editable=False)
    slides_updated_at = models.DateTimeField(null=True, blank=True, editable=False)
    # Yuklash davom etayotganda (`activate`gacha eski fayl o'qilaveradi).
    slides_pending_file = models.TextField(blank=True, default="", editable=False)
    slides_pending_upload_id = models.TextField(blank=True, default="", editable=False)

    class Meta:
        ordering = ["order", "page"]
        indexes = [models.Index(fields=["book", "order"])]
        constraints = [
            models.CheckConstraint(
                condition=models.Q(page__gte=1), name="content_chapter_page_gte_1"
            ),
        ]

    def __str__(self):
        return f"{self.title} ({self.page})"

    @property
    def has_slides(self) -> bool:
        return bool(self.slides_file)

    @property
    def slides_info(self) -> dict | None:
        """Prezentatsiya haqida qisqa ma'lumot (fayl kaliti hech qachon chiqmaydi) yoki `None`."""
        if not self.slides_file:
            return None
        return {
            "name": self.slides_name,
            "page_count": self.slides_page_count,
            "size_bytes": self.slides_size_bytes,
            "updated_at": self.slides_updated_at,
        }
