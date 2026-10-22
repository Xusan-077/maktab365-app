"""PDF darslikda oxirgi sahifa: yozish qoidasi, ko'rinish, mehmon qo'shilishi, akkaunt ma'lumoti."""

import json
from datetime import timedelta
from pathlib import Path

import pytest
from django.utils import timezone
from django.utils.dateparse import parse_datetime
from rest_framework.test import APIClient

from apps.learning.models import PdfReadProgress

from .conftest import Catalog

pytestmark = pytest.mark.django_db

FIXTURES = Path(__file__).resolve().parents[4] / "contracts" / "fixtures"
MERGE = "/api/v1/me/merge-guest-data/"


@pytest.fixture
def book(db):
    catalog = Catalog()
    return catalog.pdf_book(catalog.subject("algebra"), 9, pages=20)


def url(book):
    return f"/api/v1/me/pdf-progress/{book.pk}/"


def put(api, book, page, at=None):
    body = {"last_page": page}
    if at is not None:
        body["updated_at"] = at.isoformat()
    return api.put(url(book), body, "json")


def test_requires_login(book):
    assert APIClient().put(url(book), {"last_page": 3}, "json").status_code == 401
    assert APIClient().get("/api/v1/me/pdf-progress/").status_code == 401


def test_put_saves_and_get_reads(api, book):
    assert api.get(url(book)).status_code == 404

    resp = put(api, book, 5)

    assert resp.status_code == 200 and resp.json()["last_page"] == 5
    assert api.get(url(book)).json()["pdf_book_id"] == str(book.pk)
    assert [row["last_page"] for row in api.get("/api/v1/me/pdf-progress/").json()] == [5]


def test_put_is_idempotent(api, book, user):
    at = timezone.now() - timedelta(minutes=1)

    first = put(api, book, 8, at).json()
    second = put(api, book, 8, at).json()

    assert first == second
    assert PdfReadProgress.objects.filter(user=user).count() == 1


def test_page_can_go_back_but_stale_writes_lose(api, book):
    now = timezone.now()
    put(api, book, 10, now - timedelta(minutes=10))

    assert put(api, book, 4, now - timedelta(minutes=5)).json()["last_page"] == 4  # yangiroq
    assert put(api, book, 15, now - timedelta(minutes=8)).json()["last_page"] == 4  # eskiroq
    assert put(api, book, 15, now - timedelta(minutes=5)).json()["last_page"] == 4  # teng vaqt


def test_future_client_time_is_clamped_to_now(api, book):
    put(api, book, 3, timezone.now() + timedelta(days=30))

    # Kelajak vaqti yozuvni "muzlatib" qo'ymaydi: saqlangan vaqt `now` dan oshmaydi.
    assert PdfReadProgress.objects.get().client_updated_at <= timezone.now()
    assert put(api, book, 7).json()["last_page"] == 7


@pytest.mark.parametrize("page", [0, -1, "x"])
def test_page_must_be_positive_integer(api, book, page):
    resp = api.put(url(book), {"last_page": page}, "json")

    assert resp.status_code == 400
    assert not PdfReadProgress.objects.exists()


def test_page_beyond_the_book_has_stable_code(api, book):
    resp = put(api, book, 21)

    assert resp.status_code == 400
    assert resp.json()["details"]["last_page"] == ["page_out_of_range"]
    assert not PdfReadProgress.objects.exists()


def test_invisible_or_unknown_book_is_404(api, book):
    draft = Catalog().pdf_book(book.subject, 9, "draft")

    assert put(api, draft, 2).status_code == 404
    junk = api.put("/api/v1/me/pdf-progress/not-a-uuid/", {"last_page": 2}, "json")
    assert junk.status_code == 404
    assert not PdfReadProgress.objects.exists()


def test_progress_is_private_to_the_owner(api, other_api, book):
    put(api, book, 9)

    assert other_api.get(url(book)).status_code == 404
    assert other_api.get("/api/v1/me/pdf-progress/").json() == []
    assert put(other_api, book, 2).json()["last_page"] == 2
    assert api.get(url(book)).json()["last_page"] == 9


def test_shorter_replacement_file_clamps_reported_page(api, book):
    put(api, book, 18)
    book.page_count = 10
    book.save()

    assert api.get(url(book)).json()["last_page"] == 10


# --- Mehmon ma'lumotini qo'shish ---


def merge(api, items):
    return api.post(MERGE, {"pdf_progress": items}, "json")


def contract_cases():
    data = json.loads((FIXTURES / "merge-pdf-progress.json").read_text(encoding="utf-8"))
    return [pytest.param(case, id=case["name"]) for case in data["cases"]]


@pytest.mark.parametrize("case", contract_cases())
def test_merge_follows_shared_contract(api, book, user, case):
    if case["account"]:
        put(api, book, case["account"]["last_page"], parse_datetime(case["account"]["updated_at"]))
    guest = case["guest"]

    resp = merge(
        api,
        [
            {
                "pdf_book_id": str(book.pk),
                "last_page": guest["last_page"],
                "updated_at": guest["updated_at"],
            }
        ],
    )

    assert resp.status_code == 200 and resp.json()["failed"] == []
    row = PdfReadProgress.objects.get(user=user)
    assert row.last_page == case["merged"]["last_page"]
    assert row.client_updated_at == parse_datetime(case["merged"]["updated_at"])


def test_merge_is_idempotent_and_counts_changes(api, book):
    item = {"pdf_book_id": str(book.pk), "last_page": 6, "updated_at": "2026-01-02T10:00:00Z"}

    assert merge(api, [item]).json()["pdf_progress"] == 1
    assert merge(api, [item]).json()["pdf_progress"] == 0


def test_merge_reports_unknown_books_and_clamps_pages(api, book, user):
    draft = Catalog().pdf_book(book.subject, 9, "draft")
    items = [
        {"pdf_book_id": str(book.pk), "last_page": 999, "updated_at": "2026-01-02T10:00:00Z"},
        {"pdf_book_id": str(draft.pk), "last_page": 2},
        {"pdf_book_id": "junk", "last_page": 2},
    ]

    result = merge(api, items).json()

    assert result["pdf_progress"] == 1
    assert sorted(result["failed"]) == sorted([str(draft.pk), "junk"])
    assert (
        PdfReadProgress.objects.get(user=user).last_page == 20
    )  # kitob sahifalariga qisqartirildi


def test_merge_without_pdf_progress_still_works(api):
    assert api.post(MERGE, {}, "json").json() == {
        "progress": 0,
        "bookmarks": 0,
        "pdf_progress": 0,
        "pdf_bookmarks": 0,
        "failed": [],
    }


# --- Akkaunt ma'lumoti ---


def test_export_includes_pdf_progress(api, book):
    put(api, book, 12)

    exported = api.get("/api/v1/me/export/").json()

    assert [row["last_page"] for row in exported["learning"]["pdf_progress"]] == [12]


def test_delete_account_removes_pdf_progress(api, book, user):
    put(api, book, 12)

    assert api.delete("/api/v1/me/").status_code == 204
    assert not PdfReadProgress.objects.filter(user=user).exists()
