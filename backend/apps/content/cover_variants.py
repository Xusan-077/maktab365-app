"""Muqova variantlari: `PdfBook.cover` dan 300px (ro'yxat) va 600px (tafsilot) WebP.

Asl rasm (admin yuklagan yoki PDF 1-beti) o'zgarmaydi va zaxira bo'lib qoladi. Variantlar
`covers/<uuid>-<kenglik>.webp` kalitlari bilan saqlanadi; asl rasm almashsa yoki olib tashlansa
eskilari tozalanadi.
"""

import io
import uuid

import structlog
from django.core.files.base import ContentFile
from django.core.files.storage import default_storage
from PIL import Image, ImageOps, UnidentifiedImageError

from .models import CoverMode, PdfBook

logger = structlog.get_logger(__name__)

SMALL_WIDTH = 300
LARGE_WIDTH = 600
WEBP_QUALITY = 80
# Kutilmagan katta rasm xotirani to'ldirmasin (admin yuklash chegarasi 5 MB, bu — piksellar).
Image.MAX_IMAGE_PIXELS = 50_000_000


def _resized_webp(source: Image.Image, width: int) -> bytes:
    """Kengligi `width` (asl rasmdan kichik bo'lsa kattalashtirilmaydi), nisbat saqlanadi."""
    image = source.copy()
    if image.width > width:
        height = max(1, round(image.height * width / image.width))
        image = image.resize((width, height), Image.Resampling.LANCZOS)
    buffer = io.BytesIO()
    image.save(buffer, format="WEBP", quality=WEBP_QUALITY, method=4)
    return buffer.getvalue()


def _open(key: str) -> Image.Image:
    with default_storage.open(key, "rb") as handle:
        image = Image.open(handle)
        image.load()
    image = ImageOps.exif_transpose(image)
    # Shaffoflik saqlanadi (WebP alfa'ni qo'llaydi); palitrali rejimlar RGB(A) ga o'tadi.
    return image.convert("RGBA" if "A" in image.getbands() or image.mode == "P" else "RGB")


def has_variants(book: PdfBook) -> bool:
    return bool(book.cover_small and book.cover_large)


def clear_variants(book: PdfBook) -> list[str]:
    """Maydonlarni bo'shatadi; saqlashdan o'chirilishi kerak kalitlarni qaytaradi."""
    old = [name for name in (book.cover_small.name, book.cover_large.name) if name]
    book.cover_small = ""
    book.cover_large = ""
    return old


def generate_variants(book: PdfBook) -> bool:
    """Variantlarni yaratadi va saqlaydi. Muvaffaqiyatli bo'lsa `True`.

    `auto` rejim yoki `cover` bo'sh bo'lsa variantlar o'chiriladi. Rasm o'qilmasa (buzuq/yo'q fayl)
    xato ko'tarilmaydi: ochiq API `cover` ga qaytadi.
    """
    if book.cover_mode == CoverMode.AUTO or not book.cover:
        old = clear_variants(book)
        if old:
            book.save(update_fields=["cover_small", "cover_large", "updated_at"])
            _delete(old)
        return False
    try:
        source = _open(book.cover.name)
    except (UnidentifiedImageError, OSError, ValueError, Image.DecompressionBombError):
        logger.warning("cover_variants_unreadable", book=str(book.pk), key=book.cover.name)
        return False

    token = uuid.uuid4()
    small = default_storage.save(
        f"covers/{token}-{SMALL_WIDTH}.webp", ContentFile(_resized_webp(source, SMALL_WIDTH))
    )
    large = default_storage.save(
        f"covers/{token}-{LARGE_WIDTH}.webp", ContentFile(_resized_webp(source, LARGE_WIDTH))
    )
    old = clear_variants(book)
    book.cover_small, book.cover_large = small, large
    book.save(update_fields=["cover_small", "cover_large", "updated_at"])
    _delete(old)
    return True


def _delete(keys: list[str]) -> None:
    for key in keys:
        try:
            default_storage.delete(key)
        except Exception:  # noqa: BLE001 — yetim fayl asosiy oqimni to'xtatmasin
            logger.warning("cover_variants_delete_failed", key=key)
