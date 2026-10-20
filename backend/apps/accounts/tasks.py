"""Auth xatlari Celery orqali: so'rov SMTP'ni kutmaydi, javob vaqti akkauntga bog'liq emas."""

import smtplib

from celery import shared_task

from . import auth_services

RETRY = {
    "autoretry_for": (smtplib.SMTPException, OSError),
    "retry_backoff": True,
    "max_retries": 3,
    "ignore_result": True,
}


@shared_task(**RETRY)
def send_verification_email(user_id: str, meta: dict | None = None) -> None:
    auth_services.send_verification(user_id, meta)


@shared_task(**RETRY)
def send_password_reset_email(email: str, meta: dict | None = None) -> None:
    auth_services.send_password_reset(email, meta)
