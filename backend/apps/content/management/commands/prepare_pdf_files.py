"""Mavjud kitoblar: diagonal watermark'ni olib tashlash va yuklab olish nusxasini tayyorlash.

python manage.py prepare_pdf_files --missing-only   # yuklab olish nusxasi yo'qlar
python manage.py prepare_pdf_files --dry-run
python manage.py prepare_pdf_files --async          # Celery worker'ga navbat bilan
"""

from django.core.management.base import BaseCommand

from apps.content import pdf_files, text_layer
from apps.content.models import PdfBook
from apps.content.tasks import prepare_pdf_files


class Command(BaseCommand):
    help = (
        "PDF kitoblar: ekran nusxasidan diagonal watermark, yuklab olish nusxasiga burchak yozuvi."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--missing-only", action="store_true", help="Faqat yuklab olish nusxasi yo'qlar"
        )
        parser.add_argument("--dry-run", action="store_true", help="Faqat ro'yxatni yozadi")
        parser.add_argument(
            "--async", dest="use_async", action="store_true", help="Ishni Celery'ga beradi"
        )

    def handle(self, *args, **options):
        books = PdfBook.objects.exclude(file="").order_by("grade", "slug")
        if options["missing_only"]:
            books = books.filter(download_file="")
        prepared = cleaned = failed = 0
        for book in books.iterator():
            if options["dry_run"]:
                self.stdout.write(f"[dry-run] {book.slug}: {book.download_file.name or '-'}")
                continue
            if options["use_async"]:
                prepare_pdf_files.delay(str(book.pk))
                continue
            result = pdf_files.prepare_book(book.pk)
            if result is None:
                failed += 1
                self.stderr.write(f"tayyorlanmadi: {book.slug}")
                continue
            prepared += 1
            if result.cleaned_pages:
                cleaned += 1
                self.stdout.write(
                    f"watermark olib tashlandi: {book.slug} ({result.cleaned_pages} bet)"
                )
                text_layer.check_book(book.pk)  # fayl almashdi: matn qatlami yangi faylda
        if options["dry_run"]:
            return
        if options["use_async"]:
            self.stdout.write(self.style.SUCCESS(f"Navbatga qo'yildi: {books.count()}"))
            return
        self.stdout.write(
            self.style.SUCCESS(
                f"Tayyor: {prepared} (watermark tozalangan: {cleaned}), xato: {failed}"
            )
        )
