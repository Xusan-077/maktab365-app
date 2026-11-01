"""Yuklangan PDF'dan sinxron ma'lumot (pypdfium2): sahifalar soni, matn qatlami va muqova (1-bet).

Sahifa rasmlari tayyorlanmaydi: o'quvchi PDF'ni brauzerda PDF.js bilan chizadi.
"""

import io
from dataclasses import dataclass

import pypdfium2 as pdfium
import pypdfium2.raw as pdfium_c
from pypdfium2 import PdfiumError

from apps.content.admin_services import UploadError

COVER_WIDTH = 800
COVER_MAX_HEIGHT = 1200  # juda uzun sahifa (lenta) muqovasi cheksiz cho'zilmasin
COVER_QUALITY = 80
MIN_TEXT_CHARS = 20  # sahifada shundan kam belgi — matn qatlami yo'q deb hisoblanadi
TEXT_PROBE_PAGES = 5  # matn qatlami shuncha sahifa (kitob bo'ylab bir tekis) bo'yicha aniqlanadi


@dataclass(frozen=True)
class PdfInfo:
    page_count: int
    has_text_layer: bool
    cover: bytes | None


def _open(handle) -> pdfium.PdfDocument:
    try:
        return pdfium.PdfDocument(handle)
    except PdfiumError as exc:
        if getattr(exc, "err_code", None) == pdfium_c.FPDF_ERR_PASSWORD:
            raise UploadError("pdf_encrypted") from exc
        raise UploadError("invalid_pdf") from exc


def _probe_indexes(count: int) -> list[int]:
    """Boshi, oxiri va oralig'idagi sahifalar: sarlavha betida matn bo'lmasligi mumkin."""
    if count <= 1:
        return [0]
    spread = {round(i * (count - 1) / (TEXT_PROBE_PAGES - 1)) for i in range(TEXT_PROBE_PAGES)}
    return sorted(spread)


def _has_text(page) -> bool:
    textpage = page.get_textpage()
    try:
        return len(textpage.get_text_range().strip()) >= MIN_TEXT_CHARS
    finally:
        textpage.close()


def _render_cover(page) -> bytes:
    width, height = page.get_size()
    scale = min(COVER_WIDTH / max(width, 1.0), COVER_MAX_HEIGHT / max(height, 1.0))
    image = page.render(scale=scale).to_pil().convert("RGB")
    buffer = io.BytesIO()
    image.save(buffer, format="WEBP", quality=COVER_QUALITY, method=4)
    return buffer.getvalue()


def inspect_pdf(handle, *, want_cover: bool) -> PdfInfo:
    """Buzuq/shifrlangan PDF — `invalid_pdf` / `pdf_encrypted` (`UploadError`, 400)."""
    document = _open(handle)
    try:
        count = len(document)
        if count < 1:
            raise UploadError("invalid_pdf")
        try:
            has_text = False
            for index in _probe_indexes(count):
                page = document[index]
                try:
                    if _has_text(page):
                        has_text = True
                        break
                finally:
                    page.close()
            cover = None
            if want_cover:
                first = document[0]
                try:
                    cover = _render_cover(first)
                finally:
                    first.close()
        except (PdfiumError, OSError, ValueError, MemoryError) as exc:
            raise UploadError("invalid_pdf") from exc
        return PdfInfo(page_count=count, has_text_layer=has_text, cover=cover)
    finally:
        document.close()
