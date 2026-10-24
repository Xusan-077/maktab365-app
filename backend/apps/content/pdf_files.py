"""Kitob PDF'ining hosila fayllari: ekran nusxasi (diagonal watermark'siz) va yuklab olish nusxasi.

`prepare_book` Celery'da (`tasks.prepare_pdf_files`) yoki `manage.py prepare_pdf_files` bilan:
asl faylda sayt tashqarisida qo'shilgan diagonal "darslik365.uz" bo'lsa, toza nusxa `file` o'rniga
qo'yiladi (eski kalit o'chadi); `download_file` — pastki o'ng burchakda kichik yozuvli nusxa.
Natija faqat tekshirilgan fayl hamon kitobniki bo'lsa yoziladi (orada almashtirilgan bo'lsa —
yangi fayl uchun alohida task bor), aks holda yaratilgan fayllar o'chiriladi.
"""

import os
import tempfile
from dataclasses import dataclass

import structlog
from django.db import transaction

from . import pdf_stamp
from . import pdf_storage as storage
from .cache import bump_content_version
from .models import PdfBook

logger = structlog.get_logger(__name__)


@dataclass(frozen=True)
class Prepared:
    cleaned_pages: int
    download_key: str


def prepare_book(book_id) -> Prepared | None:
    book = PdfBook.objects.filter(pk=book_id).exclude(file="").first()
    if book is None:
        return None
    key = book.file.name
    with tempfile.TemporaryDirectory() as tmp:
        view_path, download_path = os.path.join(tmp, "view.pdf"), os.path.join(tmp, "download.pdf")
        try:
            with (
                storage.opened(key) as source,
                open(view_path, "wb") as view,
                open(download_path, "wb") as download,
            ):
                cleaned = pdf_stamp.prepare(source, view, download)
        except Exception:  # noqa: BLE001 — buzuq/yo'q fayl: o'qish asl fayl bilan davom etadi
            logger.warning("pdf_prepare_failed", book_id=str(book_id), key=key)
            return None
        view_key = storage.new_key() if cleaned else key
        download_key = storage.new_key()
        created = [download_key, *([view_key] if cleaned else [])]
        if cleaned:
            storage.save_local_file(view_key, view_path)
        storage.save_local_file(download_key, download_path)
        size = os.path.getsize(view_path) if cleaned else book.size_bytes

    with transaction.atomic():
        current = PdfBook.objects.select_for_update().filter(pk=book.pk, file=key).first()
        if current is None:
            transaction.on_commit(lambda: [storage.delete(k) for k in created])
            return None
        old_download = current.download_file.name if current.download_file else ""
        PdfBook.objects.filter(pk=book.pk).update(
            file=view_key, download_file=download_key, size_bytes=size
        )
        stale = [k for k in (key if cleaned else "", old_download) if k]
        transaction.on_commit(lambda: [storage.delete(k) for k in stale])
        # `update()` signal bermaydi: ochiq API (hajm) keshi qo'lda yangilanadi.
        transaction.on_commit(bump_content_version)
    if cleaned:
        logger.info("pdf_watermark_removed", book_id=str(book_id), pages=cleaned)
    return Prepared(cleaned, download_key)
