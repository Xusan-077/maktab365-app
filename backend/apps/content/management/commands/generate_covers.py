"""Mavjud kitoblar uchun muqova variantlari (300px / 600px WebP).

python manage.py generate_covers --missing-only
python manage.py generate_covers --dry-run
"""

from django.core.management.base import BaseCommand

from apps.content import cover_variants
from apps.content.models import CoverMode, PdfBook


class Command(BaseCommand):
    help = "PdfBook.cover dan cover_small (300px) va cover_large (600px) WebP variantlari."

    def add_arguments(self, parser):
        parser.add_argument(
            "--missing-only",
            action="store_true",
            help="Faqat variantlari yo'q (yoki to'liq bo'lmagan) kitoblar",
        )
        parser.add_argument("--dry-run", action="store_true", help="Faqat ro'yxatni yozadi")

    def handle(self, *args, **options):
        books = PdfBook.objects.exclude(cover="").exclude(cover_mode=CoverMode.AUTO)
        if options["missing_only"]:
            books = books.filter(cover_small="") | books.filter(cover_large="")
        done = failed = 0
        for book in books.order_by("created_at").distinct():
            if options["dry_run"]:
                self.stdout.write(f"[dry-run] {book.slug}: {book.cover.name}")
                continue
            if cover_variants.generate_variants(book):
                done += 1
            else:
                failed += 1
                self.stderr.write(f"o'tkazib yuborildi (rasm o'qilmadi): {book.slug}")
        if not options["dry_run"]:
            self.stdout.write(self.style.SUCCESS(f"Tayyor: {done}, o'tkazib yuborilgan: {failed}"))
