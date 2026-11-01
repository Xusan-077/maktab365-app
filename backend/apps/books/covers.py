"""Saytda ko'rinadigan kichik muqova (WebP ~400px). Asl (katta) fayl faqat adminga beriladi."""

import hashlib
import io

import structlog
from django.core.files.base import ContentFile
from PIL import Image, ImageOps, UnidentifiedImageError

logger = structlog.get_logger(__name__)

SMALL_WIDTH = 400
QUALITY = 78
Image.MAX_IMAGE_PIXELS = 50_000_000


def marker(cover_name: str) -> str:
    return hashlib.md5(cover_name.encode(), usedforsecurity=False).hexdigest()[:8]


def build_small(book) -> None:
    """`cover_image` o'zgargan bo'lsa kichik variantni qayta quradi (xato kitobni to'xtatmaydi)."""
    from apps.content.storage import covers_storage

    store = covers_storage()
    source = book.cover_image.name if book.cover_image else ""
    current = book.cover_small.name if book.cover_small else ""
    if not source:
        if current:
            _drop(store, current)
            book.cover_small = ""
        return
    if current and f"-{marker(source)}." in current:
        return
    try:
        with store.open(source, "rb") as handle:
            image = ImageOps.exif_transpose(Image.open(handle))
            image.load()
        if image.width > SMALL_WIDTH:
            height = max(1, round(image.height * SMALL_WIDTH / image.width))
            image = image.resize((SMALL_WIDTH, height), Image.Resampling.LANCZOS)
        buffer = io.BytesIO()
        image.convert("RGB").save(buffer, format="WEBP", quality=QUALITY, method=4)
        name = store.save(
            f"covers/{book.pk}-s-{marker(source)}.webp", ContentFile(buffer.getvalue())
        )
    except (OSError, UnidentifiedImageError, ValueError):
        logger.warning("book_small_cover_failed", book=str(book.pk), key=source)
        return
    if current and current != name:
        _drop(store, current)
    book.cover_small = name


def _drop(store, name: str) -> None:
    try:
        store.delete(name)
    except Exception:  # noqa: BLE001 — eski variantni o'chirish xatosi muhim emas
        logger.warning("book_small_cover_delete_failed", key=name)
