"""Kabinet va ustoz paneli uchun yig'ma ma'lumotlar (bitta so'rovda)."""

from django.db.models import Count, Q
from django.utils import timezone

from apps.accounts.services import get_profile
from apps.content.cache import is_staff, show_drafts
from apps.content.models import Book, TopicStatus

from ..models import Bookmark, BookmarkKind, ExerciseStatus, ReadStatus, RecentView, TopicProgress
from . import review

DASHBOARD_REVIEW_LIMIT = 4
TEACHER_RECENT_LIMIT = 8


def _grade_books(request, user) -> list[dict]:
    """O'quvchi sinfiga mos darsliklar: ko'rinadigan mavzular soni va o'qilgan/o'tilgan mavzular."""
    grade = get_profile(user).grade
    if grade is None:
        return []
    topic_filter = None if show_drafts(request) else Q(topics__status=TopicStatus.PUBLISHED)
    books = Book.objects.filter(grade=grade).annotate(total=Count("topics", filter=topic_filter))
    if not is_staff(user):
        books = books.filter(is_published=True)
    books = list(books.select_related("subject").filter(total__gt=0))

    counts = {
        row["topic__book_id"]: row
        for row in TopicProgress.objects.filter(user=user, topic__book__in=books)
        .values("topic__book_id")
        .annotate(
            read=Count("id", filter=Q(read_status=ReadStatus.READ)),
            passed=Count("id", filter=Q(exercise_status=ExerciseStatus.PASSED)),
        )
    }
    return [
        {
            "book_id": book.slug,
            "subject_id": book.subject.slug,
            "grade": book.grade,
            "topics_total": book.total,
            "topics_read": min(book.total, counts.get(book.id, {}).get("read", 0)),
            "topics_passed": min(book.total, counts.get(book.id, {}).get("passed", 0)),
        }
        for book in books
    ]


def student_dashboard(request) -> dict:
    user = request.user
    review_rows = review.review_queryset(user).select_related("topic__book")
    return {
        "continue": review.pick_continue(user),
        # `continue` bo'sh bo'lsa: hali hech narsa boshlanmaganmi yoki hammasi tugaganmi.
        "has_progress": review.active(user).exists(),
        "subjects": _grade_books(request, user),
        "review": {
            "count": review_rows.count(),
            "items": list(review_rows[:DASHBOARD_REVIEW_LIMIT]),
        },
        "weekly": review.weekly_summary(user, timezone.now()),
        "saved_count": Bookmark.objects.filter(user=user, kind=BookmarkKind.TOPIC).count(),
    }


def results(user) -> dict:
    groups = review.grouped_results(user)
    return {
        "counts": {name: len(items) for name, items in groups.items()},
        **groups,
    }


def teacher_dashboard(user) -> dict:
    bookmarks = Bookmark.objects.filter(user=user).select_related("topic__book", "book")
    return {
        "recent": list(
            RecentView.objects.filter(user=user).select_related("topic__book")[
                :TEACHER_RECENT_LIMIT
            ]
        ),
        "saved_topics": list(bookmarks.filter(kind=BookmarkKind.TOPIC)[:TEACHER_RECENT_LIMIT]),
        "saved_books": list(bookmarks.filter(kind=BookmarkKind.BOOK)[:TEACHER_RECENT_LIMIT]),
        "saved_topics_count": bookmarks.filter(kind=BookmarkKind.TOPIC).count(),
        "saved_books_count": bookmarks.filter(kind=BookmarkKind.BOOK).count(),
    }
