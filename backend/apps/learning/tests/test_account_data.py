import pytest

from apps.learning.models import PdfBookmark, PdfReadProgress

from .conftest import Catalog

pytestmark = pytest.mark.django_db


@pytest.fixture
def book(db):
    catalog = Catalog()
    return catalog.pdf_book(catalog.subject("algebra"), 9, pages=20)


def fill(api, book):
    api.put(f"/api/v1/me/pdf-progress/{book.pk}/", {"last_page": 7}, format="json")
    api.put(f"/api/v1/me/pdf-bookmarks/{book.pk}/")


def test_export_includes_pdf_data_only(api, book):
    fill(api, book)

    learning = api.get("/api/v1/me/export/").json()["learning"]

    assert set(learning) == {"pdf_progress", "pdf_bookmarks", "goals"}
    assert [(row["pdf_book_id"], row["last_page"]) for row in learning["pdf_progress"]] == [
        (str(book.pk), 7)
    ]
    assert [row["book"]["id"] for row in learning["pdf_bookmarks"]] == [str(book.pk)]


def test_delete_account_removes_only_own_reading_data(api, other_api, book):
    fill(api, book)
    fill(other_api, book)

    assert api.delete("/api/v1/me/").status_code == 204

    assert PdfReadProgress.objects.count() == 1  # faqat boshqa foydalanuvchiniki
    assert PdfBookmark.objects.count() == 1
