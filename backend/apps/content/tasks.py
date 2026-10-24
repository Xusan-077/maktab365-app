"""Muqova variantlari so'rovni kutdirmasligi uchun Celery orqali."""

from celery import shared_task

from . import cover_variants
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
