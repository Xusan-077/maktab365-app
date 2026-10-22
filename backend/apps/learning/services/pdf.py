"""PDF darslikda oxirgi sahifani yozish qoidasi (PUT va mehmon ma'lumotini qo'shish uchun bir xil).

Idempotent: bir xil yozuv takror kelsa natija o'zgarmaydi. Sahifa monoton emas (o'quvchi orqaga
qaytishi mumkin), shuning uchun "oxirgi yozuv yutadi" qoidasi mijoz vaqti (`updated_at`) bo'yicha:
faqat qat'iy yangiroq yozuv almashtiradi; eski qurilmaning kech kelgan yozuvi yangisini bosmaydi.
"""

import uuid
from datetime import datetime

from django.db import IntegrityError, transaction
from django.utils import timezone
from rest_framework.exceptions import NotFound, ValidationError

from apps.content.models import PdfBook
from apps.content.pdf_services import visible_pdf_books

from ..models import PdfReadProgress


def resolve_pdf_book(request, pdf_book_id) -> PdfBook:
    """Ko'rinadigan PDF kitob (ochiq API bilan bir xil qoida), aks holda 404."""
    try:
        key = uuid.UUID(str(pdf_book_id))
    except ValueError:
        raise NotFound() from None
    book = visible_pdf_books(request).filter(pk=key).first()
    if book is None:
        raise NotFound()
    return book


def clamp_page(book: PdfBook, page: int, *, strict: bool) -> int:
    """`strict` — chegaradan tashqari sahifa xato; aks holda kitob sahifalariga qisqartiriladi."""
    if page > book.page_count:
        if strict:
            raise ValidationError({"last_page": ["page_out_of_range"]})
        return book.page_count
    return page


def apply_pdf_progress(
    user, book: PdfBook, page: int, client_at: datetime | None
) -> tuple[PdfReadProgress, bool]:
    """`(qator, o'zgardimi)`. `page` oldindan tekshirilgan/qisqartirilgan bo'lishi kerak."""
    now = timezone.now()
    at = min(client_at, now) if client_at else now  # kelajak vaqti `now` ga qisqartiriladi
    for _attempt in range(2):
        try:
            with transaction.atomic():
                row, created = PdfReadProgress.objects.select_for_update().get_or_create(
                    user=user,
                    pdf_book=book,
                    defaults={"last_page": page, "client_updated_at": at},
                )
                if created:
                    return row, True
                if row.client_updated_at is None or at > row.client_updated_at:
                    changed = row.last_page != page or row.client_updated_at != at
                    row.last_page, row.client_updated_at = page, at
                    row.save(update_fields=["last_page", "client_updated_at", "updated_at"])
                    return row, changed
                return row, False
        except IntegrityError:  # ikki parallel birinchi yozuv: ikkinchisi yangilash yo'liga tushadi
            continue
    raise RuntimeError("pdf progress upsert did not settle")  # pragma: no cover
