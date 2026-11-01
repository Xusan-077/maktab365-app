"""Mavjud kitoblar uchun saytda ko'rinadigan kichik muqovani (WebP ~400px) quradi."""

from django.core.management.base import BaseCommand

from apps.books import covers
from apps.books.models import Book


class Command(BaseCommand):
    help = "cover_small bo'sh yoki eskirgan kitoblar uchun kichik muqovani qayta quradi."

    def add_arguments(self, parser):
        parser.add_argument("--dry-run", action="store_true")

    def handle(self, *args, **options):
        built = 0
        for book in Book.objects.exclude(cover_image="").iterator():
            before = book.cover_small.name if book.cover_small else ""
            covers.build_small(book)
            after = book.cover_small.name if book.cover_small else ""
            if after == before:
                continue
            built += 1
            if not options["dry_run"]:
                Book.objects.filter(pk=book.pk).update(cover_small=after)
        self.stdout.write(f"{built} ta muqova {'topildi' if options['dry_run'] else 'qurildi'}.")
