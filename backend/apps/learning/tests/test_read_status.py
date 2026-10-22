"""“O'qilgan” holati: monotonlik, hodisalar (`events/`), mehmon qo'shilishi (umumiy kontrakt)."""

import json
from datetime import timedelta
from pathlib import Path

import pytest
from django.utils import timezone
from django.utils.dateparse import parse_datetime
from rest_framework.test import APIClient

from apps.learning.models import PdfReadProgress, PdfReadStatus

from .conftest import Catalog

pytestmark = pytest.mark.django_db

FIXTURES = Path(__file__).resolve().parents[4] / "contracts" / "fixtures"
EVENTS = "/api/v1/me/events/"
MERGE = "/api/v1/me/merge-guest-data/"
PAGES = 20


@pytest.fixture
def book(db):
    catalog = Catalog()
    return catalog.pdf_book(catalog.subject("algebra"), 9, pages=PAGES)


def put(api, book, page, at=None):
    body = {"last_page": page}
    if at is not None:
        body["updated_at"] = at.isoformat()
    return api.put(f"/api/v1/me/pdf-progress/{book.pk}/", body, "json")


def event(api, book, kind):
    return api.post(EVENTS, {"kind": kind, "pdf_book_id": str(book.pk)}, "json")


def test_new_progress_is_in_progress_with_open_time(api, book):
    body = put(api, book, 3).json()

    assert body["read_status"] == "in_progress"
    row = PdfReadProgress.objects.get()
    assert row.first_opened_at and row.read_at is None


def test_reaching_last_page_marks_read(api, book):
    assert put(api, book, PAGES).json()["read_status"] == "read"
    assert PdfReadProgress.objects.get().read_at is not None


def test_read_status_never_goes_back(api, book):
    now = timezone.now()
    put(api, book, PAGES, now - timedelta(minutes=10))
    read_at = PdfReadProgress.objects.get().read_at

    back = put(api, book, 2, now - timedelta(minutes=5)).json()

    assert back["last_page"] == 2  # sahifa orqaga qaytdi
    assert back["read_status"] == "read"  # holat qoldi
    assert PdfReadProgress.objects.get().read_at == read_at


def test_stale_write_on_last_page_still_raises_status(api, book):
    now = timezone.now()
    put(api, book, 5, now - timedelta(minutes=1))

    stale = put(api, book, PAGES, now - timedelta(minutes=30)).json()

    assert stale["last_page"] == 5
    assert stale["read_status"] == "read"


def test_put_is_idempotent_for_read(api, book):
    at = timezone.now() - timedelta(minutes=1)

    assert put(api, book, PAGES, at).json() == put(api, book, PAGES, at).json()
    assert PdfReadProgress.objects.count() == 1


# --- hodisalar ---


def test_events_require_login(book):
    resp = APIClient().post(EVENTS, {"kind": "book_opened", "pdf_book_id": str(book.pk)}, "json")
    assert resp.status_code == 401


def test_book_opened_creates_row_and_is_idempotent(api, book):
    first = event(api, book, "book_opened")
    second = event(api, book, "book_opened")

    assert first.status_code == 200 and first.json()["last_page"] == 1
    assert second.json()["read_status"] == "in_progress"
    assert PdfReadProgress.objects.count() == 1


def test_book_opened_keeps_page_and_moves_book_to_front(api, book):
    other = Catalog().pdf_book(book.subject, 9, pages=10)
    put(api, book, 9)
    put(api, other, 4)

    event(api, book, "book_opened")

    items = api.get("/api/v1/me/recent/").json()
    assert [(i["book"]["id"], i["last_page"]) for i in items] == [
        (str(book.pk), 9),
        (str(other.pk), 4),
    ]


def test_book_read_marks_read_once(api, book):
    event(api, book, "book_read")
    read_at = PdfReadProgress.objects.get().read_at
    again = event(api, book, "book_read").json()

    assert again["read_status"] == "read"
    assert PdfReadProgress.objects.get().read_at == read_at


def test_event_rejects_unknown_kind_and_hidden_book(api, book):
    draft = Catalog().pdf_book(book.subject, 9, "draft")

    assert (
        api.post(EVENTS, {"kind": "nope", "pdf_book_id": str(book.pk)}, "json").status_code == 400
    )
    assert event(api, draft, "book_opened").status_code == 404
    assert not PdfReadProgress.objects.exists()


def test_events_only_touch_own_row(api, other_api, book):
    put(api, book, 5)

    event(other_api, book, "book_read")

    assert PdfReadProgress.objects.get(user__email="ali@example.com").read_status == "in_progress"
    assert PdfReadProgress.objects.get(user__email="vali@example.com").read_status == "read"


# --- mehmon qo'shilishi: umumiy kontrakt ---


def read_cases():
    data = json.loads((FIXTURES / "merge-pdf-read-status.json").read_text(encoding="utf-8"))
    return [pytest.param(case, id=case["name"]) for case in data["cases"]]


@pytest.mark.parametrize("case", read_cases())
def test_merge_read_status_follows_shared_contract(api, user, case):
    catalog = Catalog()
    book = catalog.pdf_book(catalog.subject("x"), 9, pages=case["page_count"])
    if case["account"] == "read":
        put(api, book, case["page_count"], timezone.now() - timedelta(days=2))
    elif case["account"] == "in_progress":
        put(api, book, 1, timezone.now() - timedelta(days=2))
    guest = {
        "pdf_book_id": str(book.pk),
        "last_page": case["guest_page"],
        "updated_at": parse_datetime("2026-01-01T10:00:00Z").isoformat(),
    }

    api.post(MERGE, {"pdf_progress": [guest]}, "json")
    api.post(MERGE, {"pdf_progress": [guest]}, "json")  # idempotent

    row = PdfReadProgress.objects.get(user=user, pdf_book=book)
    assert row.read_status == case["merged_status"]


def test_merge_read_book_in_one_call_counts_once(api, book):
    guest = [
        {"pdf_book_id": str(book.pk), "last_page": PAGES, "updated_at": "2026-01-01T10:00:00Z"}
    ]

    first = api.post(MERGE, {"pdf_progress": guest}, "json").json()
    second = api.post(MERGE, {"pdf_progress": guest}, "json").json()

    assert first["pdf_progress"] == 1 and second["pdf_progress"] == 0
    assert PdfReadProgress.objects.get().read_status == PdfReadStatus.READ
