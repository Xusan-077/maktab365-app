"""Saqlangan PDF darsliklar, kabinet kutubxonasi (`me/library/`), mehmon xatcho'plari."""

import pytest
from rest_framework.test import APIClient

from apps.learning.models import PdfBookmark, PdfReadProgress

from .conftest import Catalog

pytestmark = pytest.mark.django_db

MERGE = "/api/v1/me/merge-guest-data/"
LIST = "/api/v1/me/pdf-bookmarks/"
LIBRARY = "/api/v1/me/library/"


@pytest.fixture
def catalog(db):
    return Catalog()


@pytest.fixture
def book(catalog):
    return catalog.pdf_book(catalog.subject("algebra"), 9, pages=20)


def url(book):
    return f"{LIST}{book.pk}/"


def test_requires_login(book):
    assert APIClient().get(LIST).status_code == 401
    assert APIClient().put(url(book)).status_code == 401
    assert APIClient().delete(url(book)).status_code == 401
    assert APIClient().get(LIBRARY).status_code == 401


def test_put_is_idempotent_and_list_returns_the_book(api, book):
    assert api.put(url(book)).status_code == 200
    assert api.put(url(book)).status_code == 200

    rows = api.get(LIST).json()
    assert PdfBookmark.objects.count() == 1
    assert [row["book"]["id"] for row in rows] == [str(book.pk)]
    assert rows[0]["book"]["page_count"] == 20


def test_delete_is_idempotent(api, book):
    api.put(url(book))

    assert api.delete(url(book)).status_code == 204
    assert api.delete(url(book)).status_code == 204
    assert api.get(LIST).json() == []


def test_cannot_save_hidden_or_unknown_books(api, catalog, book):
    draft = catalog.pdf_book(book.subject, 9, "draft")

    assert api.put(url(draft)).status_code == 404
    assert api.put(f"{LIST}not-a-uuid/").status_code == 404
    assert not PdfBookmark.objects.exists()


def test_hidden_book_drops_out_of_the_list_but_can_be_removed(api, book):
    api.put(url(book))
    book.status = "draft"
    book.save()

    assert api.get(LIST).json() == []
    assert api.delete(url(book)).status_code == 204
    assert not PdfBookmark.objects.exists()


def test_bookmarks_are_private(api, other_api, book):
    api.put(url(book))

    assert other_api.get(LIST).json() == []
    other_api.delete(url(book))
    assert len(api.get(LIST).json()) == 1


def test_library_lists_recent_books_newest_first(api, catalog, book):
    other = catalog.pdf_book(book.subject, 8, pages=10)
    api.put(f"/api/v1/me/pdf-progress/{book.pk}/", {"last_page": 3}, "json")
    api.put(f"/api/v1/me/pdf-progress/{other.pk}/", {"last_page": 4}, "json")
    api.put(url(book))

    data = api.get(LIBRARY).json()

    assert [item["book"]["id"] for item in data["items"]] == [str(other.pk), str(book.pk)]
    assert [item["last_page"] for item in data["items"]] == [4, 3]
    assert data["saved_count"] == 1


def test_library_skips_hidden_books_and_is_empty_for_new_users(api, catalog, book):
    assert api.get(LIBRARY).json() == {"items": [], "saved_count": 0}
    api.put(f"/api/v1/me/pdf-progress/{book.pk}/", {"last_page": 3}, "json")
    book.status = "draft"
    book.save()

    assert api.get(LIBRARY).json()["items"] == []


# --- Mehmon ma'lumotini qo'shish ---


def test_merge_adds_bookmarks_once_and_reports_unknown(api, catalog, book, user):
    draft = catalog.pdf_book(book.subject, 9, "draft")
    payload = {"pdf_bookmarks": [str(book.pk), str(draft.pk), "junk"]}

    first = api.post(MERGE, payload, "json").json()
    second = api.post(MERGE, payload, "json").json()

    assert first["pdf_bookmarks"] == 1
    assert set(first["failed"]) == {str(draft.pk), "junk"}
    assert second["pdf_bookmarks"] == 0
    assert PdfBookmark.objects.filter(user=user).count() == 1


def test_merge_without_pdf_bookmarks_still_works(api):
    result = api.post(MERGE, {"pdf_progress": []}, "json").json()

    assert result["pdf_bookmarks"] == 0


# --- Akkaunt ma'lumoti ---


def test_export_and_delete_cover_bookmarks(api, user, book):
    api.put(url(book))
    api.put(f"/api/v1/me/pdf-progress/{book.pk}/", {"last_page": 2}, "json")

    export = api.get("/api/v1/me/export/").json()
    assert [row["book"]["id"] for row in export["learning"]["pdf_bookmarks"]] == [str(book.pk)]

    assert api.delete("/api/v1/me/").status_code in (200, 204)
    assert not PdfBookmark.objects.filter(user=user).exists()
    assert not PdfReadProgress.objects.filter(user=user).exists()
