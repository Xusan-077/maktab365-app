from django.conf import settings
from django.core.validators import MaxLengthValidator, MaxValueValidator, MinValueValidator
from django.db import models
from django.utils import timezone
from django.utils.text import slugify

from apps.content.models import BookLanguage, PdfBook
from apps.content.storage import covers_storage
from apps.core.fields import LocalizedTextField
from apps.core.models import TimeStampedModel, UUIDModel

DESCRIPTION_MAX = 4000
SLUG_MAX = 120

# Tizimli tur: maktab darsliklari (`apps.content.PdfBook`) shu tur ostida ko'rsatiladi.
TEXTBOOK_TYPE_SLUG = "maktab-darsliklari"
FICTION_TYPE_SLUG = "badiiy-kitoblar"
OTHER_TYPE_SLUG = "boshqa"


class ReadingMode(models.TextChoices):
    """O'qish oynasi rejimi (katalog turidan alohida): math yechim, test kaliti, badiiy matn."""

    STANDARD = "standard", "Oddiy"
    FICTION = "fiction", "Badiiy kitob"
    MATH = "math", "Matematika"
    TEST = "test", "Test to'plami"


class BookType(UUIDModel, TimeStampedModel):
    """Katalog guruhi (admin boshqaradi): "Maktab darsliklari", "Badiiy kitoblar", "Boshqa"…"""

    name = LocalizedTextField()
    slug = models.SlugField(max_length=SLUG_MAX, unique=True)
    order = models.PositiveIntegerField(default=0)
    is_active = models.BooleanField(default=True)
    # Tizimli tur o'chirilmaydi va slug'i o'zgarmaydi.
    is_system = models.BooleanField(default=False, editable=False)

    class Meta:
        ordering = ["order", "slug"]

    def __str__(self):
        return self.slug


_CYRILLIC = {
    **dict(zip("абвгдезийклмнопрстуфыэ", "abvgdezijklmnoprstufye", strict=True)),
    **{"ж": "j", "х": "x", "ц": "ts", "ч": "ch", "ш": "sh", "щ": "sh", "ю": "yu", "я": "ya"},
    **{"ё": "yo", "ў": "o", "қ": "q", "ғ": "g", "ҳ": "h", "ъ": "", "ь": ""},
}


def make_slug(text: str, fallback: str = "kitob") -> str:
    """URL uchun slug: kirill harflar lotinga o'giriladi, bo'sh chiqsa `fallback`."""
    latin = "".join(_CYRILLIC.get(ch, ch) for ch in text.lower())
    return slugify(latin.replace("'", "").replace("ʻ", ""))[: SLUG_MAX - 6].strip("-") or fallback


def unique_book_slug(title: str, exclude_pk=None) -> str:
    base = make_slug(title)
    taken = set(
        Book.objects.filter(slug__startswith=base)
        .exclude(pk=exclude_pk)
        .values_list("slug", flat=True)
    )
    slug, n = base, 1
    while slug in taken:
        n += 1
        slug = f"{base}-{n}"
    return slug


def default_book_type_id():
    """Tur berilmagan kitob uchun "Boshqa" (migratsiya yaratadi; yo'q bo'lsa — shu yerda)."""
    obj, _ = BookType.objects.get_or_create(
        slug=OTHER_TYPE_SLUG,
        defaults={"name": {"uz": "Boshqa", "ru": "Другое", "en": "Other"}, "order": 100},
    )
    return obj.pk


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
    # URL uchun barqaror identifikator (yaratilganda sarlavhadan; keyin o'zgarmaydi).
    slug = models.SlugField(max_length=SLUG_MAX, unique=True, blank=True)
    author = models.CharField(max_length=255, blank=True)
    # Katalog guruhi (admin boshqaradi) va o'qish rejimi (reader xatti-harakati) alohida.
    book_type = models.ForeignKey(
        BookType,
        on_delete=models.PROTECT,
        related_name="books",
        default=default_book_type_id,
    )
    reading_mode = models.CharField(
        max_length=16, choices=ReadingMode.choices, default=ReadingMode.STANDARD, db_index=True
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
    # Saytga beriladigan kichik (~400px) WebP variant: `cover_image` o'zgarsa `save()` qayta quradi.
    cover_small = models.FileField(
        upload_to="covers/", blank=True, editable=False, storage=covers_storage
    )
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
        indexes = [models.Index(fields=["book_type", "is_published", "status"])]

    def __str__(self):
        return self.title

    @property
    def public_cover(self):
        """Saytga beriladigan muqova: kichik variant (yo'q bo'lsa — asl)."""
        return self.cover_small or self.cover_image

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = unique_book_slug(self.title, exclude_pk=self.pk)
        if self.is_published and self.published_at is None:
            self.published_at = timezone.now()
        from .covers import build_small

        before = self.cover_small.name if self.cover_small else ""
        build_small(self)
        if (self.cover_small.name if self.cover_small else "") != before:
            update_fields = kwargs.get("update_fields")
            if update_fields is not None:
                kwargs["update_fields"] = {*update_fields, "cover_small"}
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
    # Faqat math kitoblar: misolga bog'langan yechim maydoni (to'rtburchak + sarlavha + LaTeX matn).
    SOLUTION = "solution", "Misol yechimi"


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


class AnswerKeyItem(UUIDModel):
    """Test kitobining to'g'ri javobi (admin kiritadi): bet + savol raqami bo'yicha bitta.

    Foydalanuvchiga HECH QACHON yuborilmaydi: tekshirish faqat serverda (`testmode.grade`).
    """

    book = models.ForeignKey(Book, on_delete=models.CASCADE, related_name="answer_key")
    page = models.PositiveIntegerField(validators=[MinValueValidator(1)])
    question = models.PositiveIntegerField(validators=[MinValueValidator(1)])
    answer = models.CharField(max_length=120)

    class Meta:
        ordering = ["page", "question"]
        constraints = [
            models.UniqueConstraint(
                fields=["book", "page", "question"], name="books_key_once_per_question"
            )
        ]

    def __str__(self):
        return f"{self.book_id}/{self.page}/{self.question}"


class SheetAnswer(UUIDModel, TimeStampedModel):
    """Foydalanuvchining javob varag'idagi javobi (bet + savol bo'yicha bitta, qoralama)."""

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="book_sheet_answers"
    )
    book = models.ForeignKey(Book, on_delete=models.CASCADE, related_name="sheet_answers")
    page = models.PositiveIntegerField(validators=[MinValueValidator(1)])
    question = models.PositiveIntegerField(validators=[MinValueValidator(1)])
    answer = models.CharField(max_length=120)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["user", "book", "page", "question"], name="books_sheet_once_per_question"
            )
        ]

    def __str__(self):
        return f"{self.user_id}/{self.book_id}/{self.page}/{self.question}"


class AnswerAttempt(UUIDModel):
    """Tekshirish urinishi: ball va har savol uchun to'g'ri/xato (kalitning o'zi saqlanmaydi)."""

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="book_attempts"
    )
    book = models.ForeignKey(Book, on_delete=models.CASCADE, related_name="attempts")
    created_at = models.DateTimeField(auto_now_add=True)
    score = models.PositiveIntegerField()
    total = models.PositiveIntegerField()
    results = models.JSONField(default=list)

    class Meta:
        ordering = ["-created_at"]
        indexes = [models.Index(fields=["user", "book", "-created_at"])]

    def __str__(self):
        return f"{self.user_id}/{self.book_id}: {self.score}/{self.total}"


class PdfPageNote(UUIDModel, TimeStampedModel):
    """Maktab darsligi (`PdfBook`) betining yon daftar yozuvi: `PageNote` ning darslik varianti."""

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="pdf_page_notes"
    )
    pdf_book = models.ForeignKey(PdfBook, on_delete=models.CASCADE, related_name="page_notes")
    page = models.PositiveIntegerField(validators=[MinValueValidator(1)])
    text = models.TextField(blank=True, validators=[MaxLengthValidator(20000)])

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["user", "pdf_book", "page"], name="books_pdf_note_once_per_page"
            )
        ]

    def __str__(self):
        return f"{self.user_id}/{self.pdf_book_id}/{self.page}"


class PdfPageAnnotation(UUIDModel, TimeStampedModel):
    """Maktab darsligi betidagi chizma/belgi/matn: `PageAnnotation` ning darslik varianti
    (koordinatalar 0..1, `data` tuzilishi `annotation_validation.py` da)."""

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="pdf_page_annotations"
    )
    pdf_book = models.ForeignKey(PdfBook, on_delete=models.CASCADE, related_name="annotations")
    page = models.PositiveIntegerField(validators=[MinValueValidator(1)])
    type = models.CharField(max_length=12, choices=AnnotationType.choices)
    data = models.JSONField()

    class Meta:
        ordering = ["created_at"]
        indexes = [models.Index(fields=["user", "pdf_book", "page"])]

    def __str__(self):
        return f"{self.user_id}/{self.pdf_book_id}/{self.page}/{self.type}"
