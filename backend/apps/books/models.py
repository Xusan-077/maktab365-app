from django.conf import settings
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
    # Yuklangan PDF sinxron tekshiriladi: fayl bo'lsa kitob darhol `ready`. `processing` faqat
    # eski (sahifa rasmlari fonda tayyorlangan) yozuvlar uchun qoldirilgan; yangi kod uni qo'ymaydi.
    PROCESSING = "processing", "Tayyorlanmoqda"
    READY = "ready", "Tayyor"
    FAILED = "failed", "Xato"


class BookQuerySet(models.QuerySet):
    def public(self):
        """Ochiq API ko'radigan kitoblar: nashr qilingan va sahifalari tayyor."""
        return self.filter(is_published=True, status=BookStatus.READY)


class Book(UUIDModel, TimeStampedModel):
    """Kitob: o'quvchi PDF'ni brauzerda PDF.js bilan chizadi (HTTP Range, imzolangan URL)."""

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
    # Ommaviy `covers` saqlash (CDN orqali beriladi).
    cover_image = models.FileField(upload_to="covers/", blank=True, storage=covers_storage)
    # Muqova PDF'ning 1-betidan avtomatik olingan (admin qo'lda yuklagan muqova ustun va
    # hech qachon almashtirilmaydi; avto muqova PDF almashganda yangilanadi).
    cover_generated = models.BooleanField(default=False, editable=False)
    # PDF shaxsiy `default` saqlashda qoladi; o'quvchiga faqat qisqa muddatli imzolangan URL
    # (`books/<id>/file-url/`) beriladi, kalitning o'zi API'da chiqmaydi.
    source_file = models.FileField(upload_to="book-sources/", blank=True)
    size_bytes = models.PositiveBigIntegerField(default=0)
    page_count = models.PositiveIntegerField(default=0)
    # Eski (fonda tayyorlash) davridan qolgan ko'rsatkich: yangi kodda ishlatilmaydi.
    processed_pages = models.PositiveIntegerField(default=0, editable=False)
    # PDF'da matn qatlami bor (qidiruv, matnli rejim); `None` — noma'lum (eski yozuv).
    has_text_layer = models.BooleanField(null=True, blank=True, editable=False)
    # PDF yuklashda qayta yozilgan (object streams): Range bilan tez ochiladi.
    is_optimized = models.BooleanField(default=False, editable=False)
    # Fayl yuklanmaguncha kitob "tayyor" emas (`no_file`).
    status = models.CharField(
        max_length=16, choices=BookStatus.choices, default=BookStatus.FAILED, db_index=True
    )
    # Mashina o'qiydigan kod (matn emas): `no_file` (yangi kitob); eski yozuvlarda `invalid_pdf`.
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
    """ESKI: sahifa rasmlari (fonda tayyorlangan kitoblar). Yangi kitoblar uchun yaratilmaydi; eski
    yozuvlar o'chirilmaydi (yozuvlar eskizi va eksport ularni hali ishlatadi)."""

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


class UserBookProgress(UUIDModel, TimeStampedModel):
    """Kitobda oxirgi ochilgan bet (foydalanuvchi + kitob uchun bitta yozuv)."""

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="book_progress"
    )
    book = models.ForeignKey(Book, on_delete=models.CASCADE, related_name="progress")
    last_page = models.PositiveIntegerField(validators=[MinValueValidator(1)])
    # Faqat shu vaqtdan yangiroq mijoz yozuvi betni almashtiradi: kech kelgan eski yozuv
    # (boshqa qurilma, oflayn) yangisini bosmaydi.
    client_updated_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["user", "book"], name="books_progress_once_per_book"),
        ]
        indexes = [models.Index(fields=["user", "-updated_at"])]

    def __str__(self):
        return f"{self.user_id}/{self.book_id}/{self.last_page}"


class Bookmark(UUIDModel):
    """Kitobdagi xatcho'p: foydalanuvchi + kitob + bet (bir betga bitta)."""

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="book_bookmarks"
    )
    book = models.ForeignKey(Book, on_delete=models.CASCADE, related_name="bookmarks")
    page = models.PositiveIntegerField(validators=[MinValueValidator(1)])
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["page"]
        constraints = [
            models.UniqueConstraint(fields=["user", "book", "page"], name="books_bookmark_once")
        ]

    def __str__(self):
        return f"{self.user_id}/{self.book_id}/{self.page}"


class PageNote(UUIDModel, TimeStampedModel):
    """Betga yozilgan matn (yon daftar): foydalanuvchi + kitob + bet uchun bitta."""

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="book_page_notes"
    )
    book = models.ForeignKey(Book, on_delete=models.CASCADE, related_name="page_notes")
    page = models.PositiveIntegerField(validators=[MinValueValidator(1)])
    text = models.TextField(blank=True, validators=[MaxLengthValidator(20000)])

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["user", "book", "page"], name="books_note_once_per_page"
            )
        ]

    def __str__(self):
        return f"{self.user_id}/{self.book_id}/{self.page}"


class AnnotationType(models.TextChoices):
    DRAWING = "drawing", "Chizma"
    HIGHLIGHT = "highlight", "Belgilash"
    TEXT = "text", "Matn"


class PageAnnotation(UUIDModel, TimeStampedModel):
    """Bet ustidagi chizma/belgi/matn. Koordinatalar bet o'lchamiga nisbatan 0..1 (zoom va
    qurilmadan mustaqil); `data` tuzilishi `type` ga bog'liq (`annotation_validation.py`)."""

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="book_annotations"
    )
    book = models.ForeignKey(Book, on_delete=models.CASCADE, related_name="annotations")
    page = models.PositiveIntegerField(validators=[MinValueValidator(1)])
    type = models.CharField(max_length=12, choices=AnnotationType.choices)
    data = models.JSONField()

    class Meta:
        ordering = ["created_at"]
        indexes = [models.Index(fields=["user", "book", "page"])]

    def __str__(self):
        return f"{self.user_id}/{self.book_id}/{self.page}/{self.type}"
