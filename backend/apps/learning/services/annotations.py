"""PDF belgilari (highlight + qisqa eslatma): bitta foydalanuvchi uchun yozish qoidalari.

Idempotent: `id` mijozda yaratiladi; shu `id` bilan takror yozish yangilaydi (boshqa
foydalanuvchining `id`si bilan to'qnashuv — 404, mavjudligi oshkor bo'lmaydi). Mehmon belgilari
kirgandan keyin shu yo'l bilan qo'shiladi.
"""

import uuid

from django.db import transaction
from rest_framework.exceptions import NotFound, ValidationError

from apps.content.models import PdfBook

from ..models import PdfAnnotation

MAX_RECTS = 24
MAX_PER_BOOK = 300


def validate_rects(rects) -> list[dict]:
    """Har to'rtburchak `{x, y, w, h}`, hammasi 0..1 oralig'ida, w/h > 0."""
    if not isinstance(rects, list) or not 1 <= len(rects) <= MAX_RECTS:
        raise ValidationError({"rects": ["invalid_rects"]})
    clean = []
    for rect in rects:
        try:
            x, y, w, h = (float(rect[k]) for k in ("x", "y", "w", "h"))
        except (KeyError, TypeError, ValueError):
            raise ValidationError({"rects": ["invalid_rects"]}) from None
        if not (0 <= x <= 1 and 0 <= y <= 1 and 0 < w <= 1 and 0 < h <= 1):
            raise ValidationError({"rects": ["invalid_rects"]})
        clean.append({"x": round(x, 5), "y": round(y, 5), "w": round(w, 5), "h": round(h, 5)})
    return clean


@transaction.atomic
def save_annotation(
    user, book: PdfBook, annotation_id: uuid.UUID, *, page: int, color: str, rects, note: str
) -> tuple[PdfAnnotation, bool]:
    """`(belgi, yaratildimi)`."""
    if page > max(book.page_count, 1):
        raise ValidationError({"page": ["page_out_of_range"]})
    clean = validate_rects(rects)
    existing = PdfAnnotation.objects.filter(pk=annotation_id).first()
    if existing is not None and existing.user_id != user.pk:
        raise NotFound()
    if existing is None:
        if PdfAnnotation.objects.filter(user=user, pdf_book=book).count() >= MAX_PER_BOOK:
            raise ValidationError({"pdf_book": ["too_many_annotations"]})
        row = PdfAnnotation.objects.create(
            pk=annotation_id,
            user=user,
            pdf_book=book,
            page=page,
            color=color,
            rects=clean,
            note=note.strip(),
        )
        return row, True
    existing.pdf_book, existing.page, existing.color = book, page, color
    existing.rects, existing.note = clean, note.strip()
    existing.save()
    return existing, False
