"""Staff'ga xabar: so'rov SMTP'ni kutmasligi uchun Celery orqali."""

import smtplib

from celery import shared_task
from django.conf import settings
from django.core.mail import send_mail

from .models import SupportMessage


def _one_line(value: str, limit: int) -> str:
    return " ".join(value.split())[:limit]


@shared_task(
    autoretry_for=(smtplib.SMTPException, OSError),
    retry_backoff=True,
    max_retries=3,
    ignore_result=True,
)
def notify_staff(message_id: str) -> None:
    recipients = settings.SUPPORT_NOTIFY_EMAILS
    if not recipients:
        return
    msg = SupportMessage.objects.filter(pk=message_id).first()
    if msg is None:
        return
    body = "\n".join(
        [
            f"Kind: {msg.kind}",
            f"From: {_one_line(msg.name, 100) or '-'} <{msg.email or '-'}>",
            f"User: {msg.user_id or 'anonymous'}",
            f"Topic: {msg.topic or '-'}",
            f"Page: {msg.page_url or '-'}",
            "",
            msg.message,
        ]
    )
    send_mail(
        subject=f"[maktab365 support] {msg.kind}: {_one_line(msg.message, 60)}",
        message=body,
        from_email=settings.DEFAULT_FROM_EMAIL,
        recipient_list=list(recipients),
    )
