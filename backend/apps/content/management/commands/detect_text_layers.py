"""Mavjud kitoblarda matn qatlami bormi (kitob ichidan qidiruv uchun): `PdfBook.has_text_layer`.

python manage.py detect_text_layers --missing-only
python manage.py detect_text_layers --dry-run
python manage.py detect_text_layers --async   # Celery worker'ga navbat bilan
"""

from django.core.management.base import BaseCommand

from apps.content import text_layer
from apps.content.models import PdfBook
from apps.content.tasks import detect_text_layer


class Command(BaseCommand):
    help = "PDF kitoblar matn qatlamini tekshirib `has_text_layer` ga yozadi."

    def add_arguments(self, parser):
        parser.add_argument(
            "--missing-only", action="store_true", help="Faqat hali tekshirilmaganlar (null)"
        )
        parser.add_argument("--dry-run", action="store_true", help="Faqat ro'yxatni yozadi")
        parser.add_argument(
            "--async", dest="use_async", action="store_true", help="Tekshiruvni Celery'ga beradi"
        )

    def handle(self, *args, **options):
        books = PdfBook.objects.exclude(file="").order_by("grade", "slug")
        if options["missing_only"]:
            books = books.filter(has_text_layer__isnull=True)
        with_text = without_text = unknown = 0
        for book in books.iterator():
            if options["dry_run"]:
                self.stdout.write(f"[dry-run] {book.slug}: {book.has_text_layer}")
                continue
            if options["use_async"]:
                detect_text_layer.delay(str(book.pk))
                continue
            found = text_layer.check_book(book.pk)
            if found is None:
                unknown += 1
                self.stderr.write(f"o'qilmadi: {book.slug}")
            elif found:
                with_text += 1
            else:
                without_text += 1
                self.stdout.write(f"matn qatlami yo'q: {book.slug}")
        if options["dry_run"]:
            return
        if options["use_async"]:
            self.stdout.write(self.style.SUCCESS(f"Navbatga qo'yildi: {books.count()}"))
            return
        self.stdout.write(
            self.style.SUCCESS(f"Matn bor: {with_text}, yo'q: {without_text}, o'qilmadi: {unknown}")
        )
