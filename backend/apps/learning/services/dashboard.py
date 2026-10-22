"""Kabinet va ustoz paneli uchun yig'ma ma'lumot (bosh sahifa, natijalar)."""

from collections import Counter
from datetime import timedelta

from django.db.models import Count
from django.utils import timezone

from apps.accounts.services import get_profile
from apps.content.models import Subject
from apps.content.pdf_services import visible_pdf_books

from ..models import PdfReadProgress, PdfReadStatus
from .goals import user_goals
from .pdf import visible_bookmarks
from .review import REVIEW_AFTER_DAYS, review_rows

PANEL_LIMIT = 8
RECENT_LIMIT = 20
RESULTS_LIMIT = 200
WEEK = timedelta(days=7)


def _progress(request, user):
    visible = visible_pdf_books(request)
    return (
        PdfReadProgress.objects.filter(user=user, pdf_book__in=visible)
        .select_related("pdf_book__subject")
        .order_by("-updated_at")
    )


def recent(request, user) -> list[PdfReadProgress]:
    return list(_progress(request, user)[:RECENT_LIMIT])


def _subject_stats(request, rows) -> list[dict]:
    """Foydalanuvchi o'qiy boshlagan fanlar: fandagi kitoblar, ochilgan va o'qilganlar soni."""
    opened, read = Counter(), Counter()
    for row in rows:
        slug = row.pdf_book.subject.slug
        opened[slug] += 1
        read[slug] += row.read_status == PdfReadStatus.READ
    if not opened:
        return []
    totals = dict(
        visible_pdf_books(request)
        .filter(subject__slug__in=opened)
        .order_by()
        .values_list("subject__slug")
        .annotate(total=Count("pk"))
    )
    subjects = Subject.objects.filter(slug__in=opened)
    return [
        {
            "slug": subject.slug,
            "title": subject.title,
            "icon": subject.icon,
            "books_total": totals.get(subject.slug, 0),
            "books_opened": opened[subject.slug],
            "books_read": read[subject.slug],
        }
        for subject in subjects
    ]


def dashboard(request, user) -> dict:
    rows = list(_progress(request, user))
    since = timezone.now() - WEEK
    return {
        "continue": rows[0] if rows else None,
        "subjects": _subject_stats(request, rows),
        "review": review_rows(rows, limit=PANEL_LIMIT),
        "week": {
            "opened": sum(row.first_opened_at >= since for row in rows),
            "read": sum(bool(row.read_at and row.read_at >= since) for row in rows),
        },
        "saved_count": visible_bookmarks(request, user).count(),
        "open_goals": user_goals(user).filter(done_at__isnull=True).count(),
    }


def results(request, user) -> dict:
    """Natijalar: o'qilganlar, jarayondagilar va takrorlash kerakligi (alohida ro'yxatlar)."""
    rows = list(_progress(request, user)[:RESULTS_LIMIT])
    read = sorted(
        (row for row in rows if row.read_status == PdfReadStatus.READ),
        key=lambda row: row.read_at or row.updated_at,
        reverse=True,
    )
    return {
        "read": read,
        "in_progress": [row for row in rows if row.read_status == PdfReadStatus.IN_PROGRESS],
        "review": review_rows(rows),
        "review_after_days": REVIEW_AFTER_DAYS,
    }


def teacher_dashboard(request, user) -> dict:
    """Ustoz: umumiy ko'rsatkichlar + dars beradigan sinflari bo'yicha kutubxona qamrovi."""
    data = dashboard(request, user)
    grades = [g for g in get_profile(user).grades if isinstance(g, int)]
    books = visible_pdf_books(request).filter(grade__in=grades).order_by()
    total = dict(books.values_list("grade").annotate(n=Count("pk")))
    progress = _progress(request, user).filter(pdf_book__grade__in=grades)
    opened = Counter(row.pdf_book.grade for row in progress)
    data["grades"] = [
        {"grade": grade, "books_total": total.get(grade, 0), "books_opened": opened[grade]}
        for grade in sorted(set(grades))
    ]
    return data
