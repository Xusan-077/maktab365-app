from django.core.validators import MaxLengthValidator, MaxValueValidator, MinValueValidator
from django.db import models
from django.utils import timezone

from apps.content.models import BookLanguage
from apps.content.storage import covers_storage
from apps.core.models import TimeStampedModel, UUIDModel

DESCRIPTION_MAX = 4000


class BookType(models.TextChoices):
    TEXTBOOK = "textbook", "Darslik"
    FICTION = "fiction", "Badiiy kitob"
    MATH = "math", "Matematika"
    TEST = "test", "Test to'plami"
    OTHER = "other", "Boshqa"


class BookStatus(models.TextChoices):
    # Manba PDF'dan sahifa rasmlari tayyorlanmoqda / tayyor / xato bilan to'xtagan.
    PROCESSING = "processing", "Tayyorlanmoqda"
    READY = "ready", "Tayyor"
    FAILED = "failed", "Xato"


class BookQuerySet(models.QuerySet):
    def public(self):
        """Ochiq API ko'radigan kitoblar: nashr qilingan va sahifalari tayyor."""
        return self.filter(is_published=True, status=BookStatus.READY)


class Book(UUIDModel, TimeStampedModel):
    """Kitob: PDF serverda sahifa rasmlariga aylantiriladi, o'quvchi rasmlarni o'qiydi."""

    objects = BookQuerySet.as_manager()

    title = models.CharField(max_length=255)
    author = models.CharField(max_length=255, blank=True)
    type = models.CharField(
        max_length=16, choices=BookType.choices, default=BookType.OTHER, db_index=True
    )
    grade_level = models.PositiveSmallIntegerField(
        null=True,
        blank=True,
        validators=[MinValueValidator(1), MaxValueValidator(11)],
        db_index=True,
    )
    language = models.CharField(max_length=8, choices=BookLanguage.choices, default=BookLanguage.UZ)
    description = models.TextField(blank=True, validators=[MaxLengthValidator(DESCRIPTION_MAX)])
    # Ommaviy `covers` saqlash (sahifa rasmlari ham shu yerda: CDN orqali beriladi).
    cover_image = models.FileField(upload_to="covers/", blank=True, storage=covers_storage)
    # Manba PDF shaxsiy `default` saqlashda qoladi va hech qachon ochiq API'da chiqmaydi.
    source_file = models.FileField(upload_to="book-sources/", blank=True)
    size_bytes = models.PositiveBigIntegerField(default=0)
    page_count = models.PositiveIntegerField(default=0)
    # Jarayon ko'rsatkichi (admin "37 / 120"): tayyor sahifalar soni.
    processed_pages = models.PositiveIntegerField(default=0, editable=False)
    # Fayl yuklanmaguncha kitob "xato" emas, "tayyorlanmoqda" ham emas: sahifalari yo'q.
    status = models.CharField(
        max_length=16, choices=BookStatus.choices, default=BookStatus.FAILED, db_index=True
    )
    # Mashina o'qiydigan kod (matn emas): `no_file` | `invalid_pdf` | `render_failed`.
    status_error = models.CharField(max_length=64, blank=True, default="no_file", editable=False)
    is_published = models.BooleanField(default=False, db_index=True)
    published_at = models.DateTimeField(null=True, blank=True)
    # Yuklash davomida (S3 multipart): `complete`gacha `source_file` ga tegilmaydi.
    pending_file = models.CharField(max_length=1024, blank=True, editable=False)
    pending_upload_id = models.TextField(blank=True, editable=False)

    class Meta:
        ordering = ["-created_at", "pk"]
        indexes = [models.Index(fields=["type", "is_published", "status"])]

    def __str__(self):
        return self.title

    def save(self, *args, **kwargs):
        if self.is_published and self.published_at is None:
            self.published_at = timezone.now()
        super().save(*args, **kwargs)


class BookPage(UUIDModel):
    book = models.ForeignKey(Book, on_delete=models.CASCADE, related_name="pages")
    number = models.PositiveIntegerField()
    image = models.FileField(upload_to="book-pages/", storage=covers_storage)
    thumbnail = models.FileField(upload_to="book-pages/", storage=covers_storage)
    # Rasm o'lchami: o'quvchi sahifa joyini oldindan egallaydi (layout sakramaydi) va chizish
    # qatlami aynan shu koordinatalarda ishlaydi.
    width = models.PositiveIntegerField()
    height = models.PositiveIntegerField()
    # PDF matn qatlamidan (badiiy kitob matnli rejimi, kitob ichida qidiruv); matn yo'q — bo'sh.
    text = models.TextField(blank=True, default="")

    class Meta:
        ordering = ["number"]
        constraints = [
            models.UniqueConstraint(fields=["book", "number"], name="books_page_unique_number")
        ]


class BookChapter(UUIDModel):
    book = models.ForeignKey(Book, on_delete=models.CASCADE, related_name="chapters")
    title = models.CharField(max_length=200)
    start_page = models.PositiveIntegerField(validators=[MinValueValidator(1)])
    order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["order", "start_page"]
