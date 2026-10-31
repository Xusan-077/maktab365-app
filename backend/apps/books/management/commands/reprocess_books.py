"""Qotib qolgan yoki xato bilan tugagan kitoblarning sahifalarini qayta tayyorlashga yuboradi.

python manage.py reprocess_books --dry-run
python manage.py reprocess_books                   # qotganlar (progress o'zgarmaganlar)
python manage.py reprocess_books --failed          # xatoga tushganlar ham
python manage.py reprocess_books --all-processing  # "tayyorlanmoqda" hammasi
"""

from datetime import timedelta

from django.core.management.base import BaseCommand
from django.db.models import Q
from django.utils import timezone

from apps.books import services
from apps.books.models import Book, BookStatus
from apps.books.tasks import process_book


class Command(BaseCommand):
    help = "Qotgan (yoki xatoli) kitoblarni sahifalarni tayyorlashga qayta yuboradi."

    def add_arguments(self, parser):
        parser.add_argument("--failed", action="store_true", help="Xato holatidagilarni ham")
        parser.add_argument(
            "--all-processing",
            action="store_true",
            help="Vaqtga qaramay barcha 'tayyorlanmoqda' kitoblarni",
        )
        parser.add_argument(
            "--stalled-minutes",
            type=int,
            default=services.STALL_AFTER_SECONDS // 60,
            help="Progress shuncha daqiqa o'zgarmasa qotgan hisoblanadi",
        )
        parser.add_argument("--dry-run", action="store_true")

    def handle(self, *args, **options):
        limit = timezone.now() - timedelta(minutes=options["stalled_minutes"])
        processing = Q(status=BookStatus.PROCESSING)
        if not options["all_processing"]:
            processing &= Q(updated_at__lt=limit)
        query = processing
        if options["failed"]:
            query |= Q(status=BookStatus.FAILED)
        books = Book.objects.filter(query).exclude(source_file="").order_by("created_at")

        count = 0
        for book in books:
            count += 1
            progress = f"{book.processed_pages}/{book.page_count}"
            self.stdout.write(f"{book.pk}  {book.status:<10} {progress}  {book.title}")
            if options["dry_run"]:
                continue
            Book.objects.filter(pk=book.pk).update(
                status=BookStatus.PROCESSING,
                status_error="",
                processed_pages=0,
                updated_at=timezone.now(),
            )
            process_book.delay(str(book.pk))
        verb = "topildi" if options["dry_run"] else "navbatga qo'yildi"
        self.stdout.write(self.style.SUCCESS(f"{count} ta kitob {verb}."))
