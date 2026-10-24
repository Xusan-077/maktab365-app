"""Dev bazaga demo darsliklar: python manage.py seed_demo_books [--reset].

Faqat DEBUG'da ishlaydi. `seed_subjects` ni chaqiradi, so'ng 12 ta nashr qilingan kitob yaratadi
(turli sinf, fan va til; 3 tasida muqova bor). PDF fayllari Pillow bilan yasalgan oddiy sahifalar.
Idempotent: demo kitoblar `description == DEMO_MARKER` bilan topiladi;
`--reset` ularni o'chirib qayta yaratadi.
"""

import io
import uuid
from dataclasses import dataclass

from django.conf import settings
from django.core.files.base import ContentFile
from django.core.files.storage import default_storage
from django.core.management import call_command
from django.core.management.base import BaseCommand, CommandError
from PIL import Image, ImageDraw, ImageFont

from apps.content import cover_variants
from apps.content.models import BookLanguage, CoverMode, PdfBook, PdfBookStatus, Subject
from apps.content.pdf_services import delete_book

DEMO_MARKER = "demo-seed"
PAGES = 12
PAGE_SIZE = (595, 842)  # A4 @ 72 dpi
COVER_SIZE = (900, 1200)  # 3:4


@dataclass(frozen=True)
class Demo:
    grade: int
    subject: str
    language: str
    cover: tuple[int, int, int] | None = None  # RGB; berilsa muqova rasmi yaratiladi


# 12 ta kitob: har fan guruhidan, 3 xil til, 3 tasi muqovali.
DEMOS: tuple[Demo, ...] = (
    Demo(1, "matematika", BookLanguage.UZ, (232, 93, 117)),
    Demo(2, "ona-tili", BookLanguage.UZ),
    Demo(3, "tabiiy-fan", BookLanguage.RU),
    Demo(4, "tasviriy-san-at", BookLanguage.UZ),
    Demo(5, "tarix", BookLanguage.UZ, (44, 122, 123)),
    Demo(6, "biologiya", BookLanguage.RU),
    Demo(7, "fizika", BookLanguage.UZ),
    Demo(8, "ingliz-tili", BookLanguage.EN),
    Demo(9, "algebra", BookLanguage.UZ, (21, 84, 209)),
    Demo(9, "geometriya", BookLanguage.RU),
    Demo(10, "kimyo", BookLanguage.UZ),
    Demo(11, "adabiyot", BookLanguage.UZ),
)

TITLE_FIELD = {BookLanguage.UZ: "uz", BookLanguage.RU: "ru", BookLanguage.EN: "en"}


def _font(size: int) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    return ImageFont.load_default(size=size)


def _pdf_bytes(title: str, grade: int) -> bytes:
    """Sahifa raqami va sarlavhali oddiy ko'p sahifali PDF."""
    pages = []
    for number in range(1, PAGES + 1):
        page = Image.new("RGB", PAGE_SIZE, "white")
        draw = ImageDraw.Draw(page)
        draw.text((48, 56), f"{grade}-sinf · {title}", fill=(21, 84, 209), font=_font(30))
        draw.text((48, 120), f"{number}-bet", fill=(7, 22, 51), font=_font(22))
        for line in range(12):
            y = 200 + line * 44
            draw.rectangle(
                (48, y, PAGE_SIZE[0] - 48 - (line % 4) * 40, y + 10), fill=(225, 229, 238)
            )
        pages.append(page)
    buffer = io.BytesIO()
    pages[0].save(buffer, format="PDF", save_all=True, append_images=pages[1:], resolution=72.0)
    return buffer.getvalue()


def _cover_png(title: str, grade: int, color: tuple[int, int, int]) -> bytes:
    image = Image.new("RGB", COVER_SIZE, color)
    draw = ImageDraw.Draw(image)
    draw.ellipse((420, -180, 1180, 580), fill=tuple(min(255, c + 28) for c in color))
    draw.text((64, 72), f"{grade}-SINF", fill="white", font=_font(56))
    draw.text((64, COVER_SIZE[1] - 190), title, fill="white", font=_font(96))
    buffer = io.BytesIO()
    image.save(buffer, format="PNG")
    return buffer.getvalue()


class Command(BaseCommand):
    help = "Dev bazaga 12 ta demo darslik (faqat DEBUG)."

    def add_arguments(self, parser):
        parser.add_argument(
            "--reset",
            action="store_true",
            help="Avval demo kitoblarni o'chiradi, so'ng qayta yaratadi.",
        )

    def handle(self, *args, **options):
        if not settings.DEBUG:
            raise CommandError("seed_demo_books faqat DEBUG=True da ishlaydi.")

        call_command("seed_subjects", stdout=self.stdout)
        demo_books = PdfBook.objects.filter(description=DEMO_MARKER)
        if options["reset"]:
            removed = 0
            for book in demo_books:
                delete_book(book)
                removed += 1
            self.stdout.write(f"o'chirildi: {removed}")

        existing = {
            (b.grade, b.subject.slug, b.language) for b in demo_books.select_related("subject")
        }
        created = 0
        for demo in DEMOS:
            if (demo.grade, demo.subject, demo.language) in existing:
                continue
            self._create(demo)
            created += 1
        self.stdout.write(
            self.style.SUCCESS(f"demo kitoblar: {created} yangi, {len(DEMOS) - created} mavjud")
        )

    def _create(self, demo: Demo) -> None:
        subject = Subject.objects.get(slug=demo.subject)
        title = subject.title.get(TITLE_FIELD[demo.language]) or subject.title["uz"]
        pdf = _pdf_bytes(title, demo.grade)
        key = default_storage.save(f"pdf-books/{uuid.uuid4()}.pdf", ContentFile(pdf))
        book = PdfBook(
            title={"uz": subject.title["uz"], **{TITLE_FIELD[demo.language]: title}},
            description=DEMO_MARKER,
            language=demo.language,
            grade=demo.grade,
            subject=subject,
            file=key,
            size_bytes=len(pdf),
            page_count=PAGES,
            status=PdfBookStatus.PUBLISHED,
        )
        if demo.cover:
            book.cover = default_storage.save(
                f"covers/{uuid.uuid4()}.png", ContentFile(_cover_png(title, demo.grade, demo.cover))
            )
            book.cover_mode = CoverMode.CUSTOM
        book.save()
        if demo.cover:
            cover_variants.generate_variants(book)
