"""“Takrorlash kerak” qoidasi.

Boshlangan, lekin tugatilmagan kitob (`in_progress`, 1-betdan keyin) oxirgi faolligidan
`REVIEW_AFTER_DAYS` kun o'tgach takrorlashga tushadi: eng uzoq to'xtab qolgani birinchi.
Oxirigacha o'qilgan kitob (`read`) — yaxshi o'zlashtirilgan, takrorlash ro'yxatiga tushmaydi.
"""

from datetime import datetime, timedelta

from django.utils import timezone

from ..models import PdfReadProgress, PdfReadStatus

REVIEW_AFTER_DAYS = 7


def needs_review(row: PdfReadProgress, now: datetime | None = None) -> bool:
    now = now or timezone.now()
    return (
        row.read_status == PdfReadStatus.IN_PROGRESS
        and row.last_page > 1
        and row.updated_at <= now - timedelta(days=REVIEW_AFTER_DAYS)
    )


def review_rows(rows, now: datetime | None = None, limit: int | None = None) -> list:
    """`rows` — o'sha foydalanuvchining progress qatorlari; eng eskisi birinchi."""
    now = now or timezone.now()
    due = sorted((row for row in rows if needs_review(row, now)), key=lambda row: row.updated_at)
    return due[:limit] if limit else due
