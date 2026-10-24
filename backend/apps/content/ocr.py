"""Matn qatlami yo'q (skanerlangan) kitoblarni OCR qilish. HOZIRCHA SKELET: holat oqimi va admin
interfeysi tayyor, OCR'ning o'zi (`_run_ocrmypdf`) yozilmagan — `ocr_not_implemented` bilan tugaydi.

Holatlar (`PdfBook.ocr_status`): none → queued (admin so'radi) → processing (worker oldi) →
done | failed (`ocr_error` — kod). `failed`/`done` dan qayta so'rash mumkin.

Reja (to'liq yozilganda):
1. Infra: alohida Railway servisi — o'sha Dockerfile + `apt-get install ocrmypdf tesseract-ocr
   tesseract-ocr-uzb tesseract-ocr-uzb-cyrl tesseract-ocr-rus ghostscript`, buyruq
   `celery -A config worker -Q ocr --concurrency=1 --max-tasks-per-child=1` (CPU/RAM og'ir; asosiy
   worker va web'ga ta'sir qilmasin). `OCR_ENABLED=true` faqat shu servis tayyor bo'lgach.
2. `_run_ocrmypdf`: `pdf_storage.opened(book.file)` → vaqtinchalik kirish fayli →
   `ocrmypdf.ocr(src, dst, language=settings.OCR_LANGUAGES.split("+"), skip_text=True,
   optimize=1, output_type="pdf", jobs=1, progress_bar=False)` (`skip_text` — matni bor
   sahifalarga tegmaydi; `pdfa` emas: hajm keskin oshadi). Tillar: `uzb+rus` (kirill o'zbekcha
   kitoblar uchun `uzb_cyrl` qo'shiladi; ko'p til — sekinroq va xatoliroq, kitob tiliga qarab
   tanlash keyingi qadam).
3. Natija `pdf_storage.new_key()` ga yuklanadi va `pdf_services.activate(book, key, ocr=True)`
   bilan biriktiriladi (sahifalar soni tekshiriladi, eski fayl `on_commit` da o'chadi, matn
   qatlami qayta tekshiriladi). Sahifalar soni o'zgargan bo'lsa — `ocr_pages_mismatch`, fayl
   almashtirilmaydi (mundarija va progress sahifa raqamiga bog'langan).
4. Chegaralar: task `time_limit` ~1 soat (`CELERY_TASK_TIME_LIMIT` dan alohida), `acks_late`,
   worker o'chsa `processing` da qolgan yozuvlarni `manage.py` buyrug'i `failed` qiladi.
"""

import structlog
from django.conf import settings
from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import APIException

from .models import OcrStatus, PdfBook

logger = structlog.get_logger(__name__)


class OcrRejected(APIException):
    """OCR rad etildi: `ocr_disabled` (503), `no_file`, `ocr_not_needed`, `ocr_in_progress`."""

    status_code = 409
    default_code = "ocr_rejected"
    default_detail = "OCR request rejected."

    def __init__(self, code: str, http_status: int = 409):
        self.status_code = http_status
        self.default_code = code
        super().__init__(code, code)


class OcrFailed(Exception):
    def __init__(self, code: str):
        super().__init__(code)
        self.code = code


def is_available() -> bool:
    return bool(settings.OCR_ENABLED)


def _set_status(book_id, status: str, error: str = "", only_from=None) -> bool:
    """Holatni atomik yozadi (`update()`: boshqa maydonlarga tegmaydi); `only_from` — kutilgan."""
    rows = PdfBook.objects.filter(pk=book_id)
    if only_from is not None:
        rows = rows.filter(ocr_status__in=only_from)
    return bool(rows.update(ocr_status=status, ocr_error=error, ocr_updated_at=timezone.now()))


def request_ocr(book: PdfBook) -> None:
    """Admin so'rovi: tekshiradi, `queued` qiladi, tranzaksiyadan keyin task'ni navbatga qo'yadi."""
    from .tasks import ocr_pdf_book

    if not is_available():
        raise OcrRejected("ocr_disabled", 503)
    if not book.file:
        raise OcrRejected("no_file")
    if book.has_text_layer:
        raise OcrRejected("ocr_not_needed")
    # Ikki marta bosish yoki ikki admin: faqat faol bo'lmagan holatdan o'tadi (poyga yo'q).
    if not _set_status(
        book.pk, OcrStatus.QUEUED, only_from=[OcrStatus.NONE, OcrStatus.DONE, OcrStatus.FAILED]
    ):
        raise OcrRejected("ocr_in_progress")
    transaction.on_commit(lambda: ocr_pdf_book.delay(str(book.pk)))


def run(book_id) -> None:
    """Worker: `queued` → `processing` → `done`/`failed`. Boshqa holatdagi kitobga tegmaydi."""
    if not _set_status(book_id, OcrStatus.PROCESSING, only_from=[OcrStatus.QUEUED]):
        return
    book = PdfBook.objects.filter(pk=book_id).exclude(file="").first()
    try:
        if book is None:
            raise OcrFailed("no_file")
        _run_ocrmypdf(book)
    except OcrFailed as exc:
        _set_status(book_id, OcrStatus.FAILED, exc.code)
        return
    except Exception:  # noqa: BLE001 — kutilmagan xato: holat "failed", tafsilot log'da
        logger.exception("pdf_ocr_failed", book_id=str(book_id))
        _set_status(book_id, OcrStatus.FAILED, "ocr_failed")
        return
    _set_status(book_id, OcrStatus.DONE)


def _run_ocrmypdf(book: PdfBook) -> None:
    """SKELET: modul docstring'idagi 2–3-qadamlar shu yerda yoziladi."""
    raise OcrFailed("ocr_not_implemented")
