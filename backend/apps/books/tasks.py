"""Og'ir ish so'rovni kutdirmaydi: PDF sahifa rasmlariga fonda aylantiriladi."""

from celery import shared_task

from . import services

# Global `CELERY_TASK_TIME_LIMIT` (5 daqiqa) katta kitob (300+ bet, skaner) uchun yetmaydi: vazifa
# o'ldirilsa kitob "tayyorlanmoqda"da qolib ketardi. Yumshoq chegara xatoni ushlab kitobni
# `failed` qiladi; qattiq chegara — faqat osilib qolgan jarayon uchun zaxira.
SOFT_TIME_LIMIT = 40 * 60
HARD_TIME_LIMIT = SOFT_TIME_LIMIT + 120


@shared_task(
    autoretry_for=(OSError,),
    retry_backoff=True,
    max_retries=3,
    ignore_result=True,
    soft_time_limit=SOFT_TIME_LIMIT,
    time_limit=HARD_TIME_LIMIT,
)
def process_book(book_id: str) -> None:
    services.process_book(book_id)
