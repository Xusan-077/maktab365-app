"""So'rovni kutdirmaydigan og'ir ishlar Celery orqali: muqova variantlari, matn qatlami, OCR."""

from celery import shared_task

from . import cover_variants, ocr, pdf_files, text_layer
from .models import PdfBook


@shared_task(
    autoretry_for=(OSError,),
    retry_backoff=True,
    max_retries=3,
    ignore_result=True,
)
def generate_cover_variants(book_id: str) -> None:
    book = PdfBook.objects.filter(pk=book_id).first()
    if book is not None:
        cover_variants.generate_variants(book)


@shared_task(
    autoretry_for=(OSError,),
    retry_backoff=True,
    max_retries=3,
    ignore_result=True,
)
def detect_text_layer(book_id: str) -> None:
    """Yangi fayl biriktirilgach: PDF'da matn qatlami bormi (`PdfBook.has_text_layer`)."""
    text_layer.check_book(book_id)


@shared_task(
    autoretry_for=(OSError,),
    retry_backoff=True,
    max_retries=3,
    ignore_result=True,
)
def prepare_pdf_files(book_id: str) -> None:
    """Yangi fayl: diagonal watermark olib tashlanadi, yuklab olish nusxasi, so'ng matn qatlami."""
    pdf_files.prepare_book(book_id)
    text_layer.check_book(book_id)


# `ocr` navbatida (`CELERY_TASK_ROUTES`); vaqt chegarasi to'liq OCR yozilganda belgilanadi.
@shared_task(acks_late=True, ignore_result=True)
def ocr_pdf_book(book_id: str) -> None:
    ocr.run(book_id)
