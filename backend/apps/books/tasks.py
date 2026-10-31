"""Og'ir ish so'rovni kutdirmaydi: PDF sahifa rasmlariga fonda aylantiriladi."""

from celery import shared_task

from . import services


@shared_task(
    autoretry_for=(OSError,),
    retry_backoff=True,
    max_retries=3,
    ignore_result=True,
)
def process_book(book_id: str) -> None:
    services.process_book(book_id)
