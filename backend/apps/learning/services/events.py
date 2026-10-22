"""O'qish hodisalari (`POST me/events/`): kitob ochildi, kitob o'qib bo'lindi.

Ikkalasi ham idempotent: takror kelsa natija o'zgarmaydi. `book_opened` kitobni "oxirgi
ochilganlar" ro'yxatining boshiga qo'yadi (sahifa qiymatiga tegmaydi), `book_read` esa monoton
"o'qilgan" holatini qo'yadi.
"""

from django.db import IntegrityError, transaction
from django.utils import timezone

from apps.content.models import PdfBook

from ..models import PdfReadProgress
from .pdf import mark_read

BOOK_OPENED = "book_opened"
BOOK_READ = "book_read"
EVENT_KINDS = (BOOK_OPENED, BOOK_READ)


def _row_for_update(user, book: PdfBook) -> PdfReadProgress:
    for _attempt in range(2):
        try:
            with transaction.atomic():
                row, _created = PdfReadProgress.objects.select_for_update().get_or_create(
                    user=user, pdf_book=book, defaults={"last_page": 1}
                )
                return row
        except IntegrityError:  # parallel birinchi yozuv
            continue
    raise RuntimeError("pdf progress upsert did not settle")  # pragma: no cover


def record_event(user, book: PdfBook, kind: str) -> PdfReadProgress:
    now = timezone.now()
    with transaction.atomic():
        row = _row_for_update(user, book)
        if kind == BOOK_READ:
            mark_read(row, now)
        # `updated_at` (auto_now) yangilanadi: kitob "oxirgi ochilgan" bo'lib qoladi.
        row.save()
    return row
