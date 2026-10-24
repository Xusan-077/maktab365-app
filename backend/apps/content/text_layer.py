"""PDF matn qatlami: kitob ichidan qidiruv faqat shu qatlam bo'lsa ishlaydi.

Skanerlangan kitobda sahifalar rasm — `extract_text` bo'sh yoki bir-ikki belgi (sahifa raqami)
qaytaradi. Butun kitob o'qilmaydi: sahifalar teng oraliqda tanlanadi, ularning kamida
`MIN_TEXT_SHARE` qismida `MIN_PAGE_CHARS` dan ko'p belgi bo'lsa — matn bor.
"""

import math

import structlog
from django.db import transaction

from . import pdf_storage as storage
from .cache import bump_content_version
from .models import PdfBook

SAMPLE_PAGES = 12
MIN_PAGE_CHARS = 40
MIN_TEXT_SHARE = 0.3

logger = structlog.get_logger(__name__)


def sample_indexes(total: int, limit: int = SAMPLE_PAGES) -> list[int]:
    """`total` sahifadan ko'pi bilan `limit` ta, butun kitob bo'ylab teng oraliqda (0 dan)."""
    if total <= limit:
        return list(range(total))
    step = total / limit
    return sorted({int(i * step + step / 2) for i in range(limit)})


def _chars(page) -> int:
    try:
        text = page.extract_text() or ""
    except Exception:  # noqa: BLE001 — buzuq shrift/kontent: shu sahifada matn yo'q deb hisoblanadi
        return 0
    return len("".join(text.split()))


def detect(handle) -> bool:
    """PDF'da qidirsa bo'ladigan matn qatlami bormi (pypdf; fayl ochilgan holda beriladi)."""
    from pypdf import PdfReader

    pages = PdfReader(handle, strict=False).pages
    indexes = sample_indexes(len(pages))
    if not indexes:
        return False
    with_text = sum(1 for index in indexes if _chars(pages[index]) >= MIN_PAGE_CHARS)
    return with_text >= max(1, math.ceil(len(indexes) * MIN_TEXT_SHARE))


def check_book(book_id) -> bool | None:
    """Kitob faylini tekshirib `has_text_layer` ga yozadi. Fayl o'qilmasa `None` (o'zgarmaydi).

    Natija faqat tekshirilgan fayl hamon kitobniki bo'lsa yoziladi (orada almashtirilgan bo'lsa —
    yangi fayl uchun alohida task bor). `update()` boshqa maydonlarga tegmaydi.
    """
    book = PdfBook.objects.filter(pk=book_id).exclude(file="").first()
    if book is None:
        return None
    key = book.file.name
    try:
        with storage.opened(key) as handle:
            found = detect(handle)
    except Exception:  # noqa: BLE001 — buzuq/yo'q fayl: holat noma'lum qoladi, log'da ko'rinadi
        logger.warning("pdf_text_layer_check_failed", book_id=str(book_id), key=key)
        return None
    with transaction.atomic():
        if PdfBook.objects.filter(pk=book.pk, file=key).update(has_text_layer=found):
            # `update()` signal bermaydi: ochiq API (`has_text_layer`) keshi qo'lda yangilanadi.
            transaction.on_commit(bump_content_version)
    return found
