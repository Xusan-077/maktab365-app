"""Bosh sahifa, natijalar, takrorlash kerak, ustoz paneli: shakl, mantiq, egalik."""

from datetime import timedelta

import pytest
from django.utils import timezone
from rest_framework.test import APIClient

from apps.learning.models import PdfReadProgress
from apps.learning.services.review import REVIEW_AFTER_DAYS, needs_review

from .conftest import Catalog, client_for, make_user

pytestmark = pytest.mark.django_db

DASHBOARD = "/api/v1/me/dashboard/"
RESULTS = "/api/v1/me/results/"
TEACHER = "/api/v1/me/teacher/dashboard/"


@pytest.fixture
def catalog(db):
    return Catalog()


@pytest.fixture
def algebra(catalog):
    return catalog.subject("algebra")


def put(api, book, page, at=None):
    body = {"last_page": page}
    if at is not None:
        body["updated_at"] = at.isoformat()
    return api.put(f"/api/v1/me/pdf-progress/{book.pk}/", body, "json")


def age(book, user, days):
    """Yozuvni `days` kun oldinga suradi (`updated_at` auto_now, shuning uchun update())."""
    when = timezone.now() - timedelta(days=days)
    PdfReadProgress.objects.filter(user=user, pdf_book=book).update(updated_at=when)


def test_requires_login():
    for url in (DASHBOARD, RESULTS, TEACHER, "/api/v1/me/recent/"):
        assert APIClient().get(url).status_code == 401


def test_empty_dashboard_shape(api):
    body = api.get(DASHBOARD).json()

    assert body == {
        "continue": None,
        "subjects": [],
        "review": [],
        "week": {"opened": 0, "read": 0},
        "saved_count": 0,
        "open_goals": 0,
    }


def test_dashboard_continue_is_latest_and_counts(api, user, catalog, algebra):
    old = catalog.pdf_book(algebra, 9, pages=30)
    new = catalog.pdf_book(algebra, 9, pages=30)
    catalog.pdf_book(algebra, 9, pages=30)  # ochilmagan
    put(api, old, 5)
    put(api, new, 30)  # oxirgi bet: o'qilgan
    api.put(f"/api/v1/me/pdf-bookmarks/{old.pk}/")
    api.post("/api/v1/me/goals/", {"title": "reja"}, "json")

    body = api.get(DASHBOARD).json()

    assert body["continue"]["book"]["id"] == str(new.pk)
    assert body["continue"]["last_page"] == 30 and body["continue"]["read_status"] == "read"
    assert body["subjects"] == [
        {
            "slug": "algebra",
            "title": {"uz": "Algebra"},
            "icon": "",
            "books_total": 3,
            "books_opened": 2,
            "books_read": 1,
        }
    ]
    assert body["week"] == {"opened": 2, "read": 1}
    assert body["saved_count"] == 1 and body["open_goals"] == 1


def test_week_ignores_old_activity(api, user, catalog, algebra):
    book = catalog.pdf_book(algebra, 9, pages=10)
    put(api, book, 10)
    PdfReadProgress.objects.update(
        first_opened_at=timezone.now() - timedelta(days=20),
        read_at=timezone.now() - timedelta(days=20),
    )

    assert api.get(DASHBOARD).json()["week"] == {"opened": 0, "read": 0}


def test_hidden_books_are_left_out(api, user, catalog, algebra):
    draft = catalog.pdf_book(algebra, 9, "draft", pages=10)
    PdfReadProgress.objects.create(user=user, pdf_book=draft, last_page=3)

    body = api.get(DASHBOARD).json()

    assert body["continue"] is None and body["subjects"] == []
    assert api.get("/api/v1/me/recent/").json() == []


# --- takrorlash kerak ---


def test_review_logic_boundaries(api, user, catalog, algebra):
    stale = catalog.pdf_book(algebra, 9, pages=30)
    fresh = catalog.pdf_book(algebra, 9, pages=30)
    finished = catalog.pdf_book(algebra, 9, pages=30)
    just_opened = catalog.pdf_book(algebra, 9, pages=30)
    for book, page in ((stale, 8), (fresh, 8), (finished, 30), (just_opened, 1)):
        put(api, book, page)
    for book in (stale, finished, just_opened):
        age(book, user, REVIEW_AFTER_DAYS + 3)
    age(fresh, user, REVIEW_AFTER_DAYS - 3)

    due = [i["book"]["id"] for i in api.get(DASHBOARD).json()["review"]]

    assert due == [str(stale.pk)]  # oxirigacha o'qilgan va 1-bet takrorlashga tushmaydi


def test_review_is_oldest_first_and_pure(api, user, catalog, algebra):
    a, b = catalog.pdf_book(algebra, 9, pages=30), catalog.pdf_book(algebra, 9, pages=30)
    put(api, a, 5)
    put(api, b, 5)
    age(a, user, 10)
    age(b, user, 30)

    review = api.get(RESULTS).json()["review"]

    assert [i["book"]["id"] for i in review] == [str(b.pk), str(a.pk)]
    row = PdfReadProgress.objects.get(user=user, pdf_book=a)
    assert needs_review(row) and not needs_review(row, row.updated_at - timedelta(days=1))


# --- natijalar ---


def test_results_split_read_in_progress_and_review(api, user, catalog, algebra):
    read, going = catalog.pdf_book(algebra, 9, pages=10), catalog.pdf_book(algebra, 9, pages=10)
    put(api, read, 10)
    put(api, going, 4)
    age(going, user, 15)

    body = api.get(RESULTS).json()

    assert [i["book"]["id"] for i in body["read"]] == [str(read.pk)]
    assert body["read"][0]["read_at"] is not None
    assert [i["book"]["id"] for i in body["in_progress"]] == [str(going.pk)]
    assert [i["book"]["id"] for i in body["review"]] == [str(going.pk)]
    assert body["review_after_days"] == REVIEW_AFTER_DAYS


def test_data_is_private(api, other_api, user, catalog, algebra):
    book = catalog.pdf_book(algebra, 9, pages=10)
    put(api, book, 10)
    api.put(f"/api/v1/me/pdf-bookmarks/{book.pk}/")

    for url in (DASHBOARD, RESULTS):
        body = other_api.get(url).json()
        assert "read" not in body or body["read"] == []
        assert body.get("continue") is None
    assert other_api.get("/api/v1/me/recent/").json() == []
    assert other_api.get(DASHBOARD).json()["saved_count"] == 0


def test_recent_is_capped_at_twenty(api, user, catalog, algebra):
    for _ in range(23):
        put(api, catalog.pdf_book(algebra, 9, pages=5), 2)

    assert len(api.get("/api/v1/me/recent/").json()) == 20


# --- ustoz paneli ---


def test_teacher_dashboard_is_teacher_only(api):
    assert api.get(TEACHER).status_code == 403  # o'quvchi (default rol)


def test_teacher_dashboard_shape_and_grades(catalog, algebra):
    teacher = make_user("ustoz@example.com", grades=[8, 9])
    teacher.role = "teacher"
    teacher.save()
    api = client_for(teacher)
    g9 = catalog.pdf_book(algebra, 9, pages=10)
    catalog.pdf_book(algebra, 9, pages=10)
    catalog.pdf_book(algebra, 8, pages=10)
    catalog.pdf_book(algebra, 5, pages=10)  # ustozning sinfi emas
    put(api, g9, 10)

    body = api.get(TEACHER).json()

    assert set(body) == {
        "continue",
        "subjects",
        "review",
        "week",
        "saved_count",
        "open_goals",
        "grades",
    }
    assert body["continue"]["book"]["id"] == str(g9.pk)
    assert body["grades"] == [
        {"grade": 8, "books_total": 1, "books_opened": 0},
        {"grade": 9, "books_total": 2, "books_opened": 1},
    ]
