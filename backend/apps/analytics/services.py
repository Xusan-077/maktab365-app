"""Kitob statistikasi: yozish (atomik `F()+1`) va admin uchun yig'ish. Shaxsiy ma'lumotsiz."""

from datetime import date, timedelta

from django.db import transaction
from django.db.models import F, Sum
from django.utils import timezone

from .models import BookDailyStat, PageDailyStat

PERIODS = (7, 30)
TOP_PAGES = 15


def _today() -> date:
    return timezone.localdate()


def _bump(model, lookup: dict, field: str) -> None:
    """Qator bo'lsa `field += 1`, bo'lmasa yaratadi (poyga holatida qayta yangilaydi)."""
    with transaction.atomic():
        if model.objects.filter(**lookup).update(**{field: F(field) + 1}):
            return
        _, created = model.objects.get_or_create(**lookup, defaults={field: 1})
        if not created:
            model.objects.filter(**lookup).update(**{field: F(field) + 1})


def record_open(book_id) -> None:
    _bump(BookDailyStat, {"book_id": book_id, "day": _today()}, "opens")


def record_download(book_id) -> None:
    _bump(BookDailyStat, {"book_id": book_id, "day": _today()}, "downloads")


def record_page(book_id, page: int) -> None:
    _bump(PageDailyStat, {"book_id": book_id, "day": _today(), "page": page}, "views")


def summary(days: int) -> dict:
    """Oxirgi `days` kun (bugun bilan): jami, kitoblar, kunlar va eng ko'p o'qilgan betlar."""
    since = _today() - timedelta(days=days - 1)
    stats = BookDailyStat.objects.filter(day__gte=since)
    totals = stats.aggregate(opens=Sum("opens"), downloads=Sum("downloads"))

    per_book = (
        stats.values("book_id", "book__grade", "book__title", "book__slug")
        .annotate(opens=Sum("opens"), downloads=Sum("downloads"))
        .order_by("-opens", "-downloads", "book_id")
    )
    per_day = {
        row["day"]: row
        for row in stats.values("day").annotate(opens=Sum("opens"), downloads=Sum("downloads"))
    }
    daily = []
    for offset in range(days):
        day = since + timedelta(days=offset)
        row = per_day.get(day)
        daily.append(
            {
                "day": day,
                "opens": row["opens"] if row else 0,
                "downloads": row["downloads"] if row else 0,
            }
        )
    top_pages = (
        PageDailyStat.objects.filter(day__gte=since)
        .values("book_id", "book__grade", "book__title", "book__slug", "page")
        .annotate(views=Sum("views"))
        .order_by("-views", "book_id", "page")[:TOP_PAGES]
    )
    return {
        "days": days,
        "totals": {"opens": totals["opens"] or 0, "downloads": totals["downloads"] or 0},
        "books": [
            {
                "id": row["book_id"],
                "slug": row["book__slug"],
                "grade": row["book__grade"],
                "title": row["book__title"],
                "opens": row["opens"],
                "downloads": row["downloads"],
            }
            for row in per_book
        ],
        "daily": daily,
        "top_pages": [
            {
                "book_id": row["book_id"],
                "slug": row["book__slug"],
                "grade": row["book__grade"],
                "title": row["book__title"],
                "page": row["page"],
                "views": row["views"],
            }
            for row in top_pages
        ],
    }


def purge_older_than(days: int = 180) -> int:
    """Eski kunlik qatorlarni o'chiradi (saqlash muddati)."""
    cutoff = _today() - timedelta(days=days)
    deleted = PageDailyStat.objects.filter(day__lt=cutoff).delete()[0]
    deleted += BookDailyStat.objects.filter(day__lt=cutoff).delete()[0]
    return deleted
