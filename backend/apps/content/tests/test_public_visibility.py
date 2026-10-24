"""Ochiq API faqat nashr qilingan kitoblarni beradi: yashirin (draft) kitob ro'yxatlarda yo'q."""

import pytest
from rest_framework.test import APIClient

from apps.content.models import PdfBook, PdfBookChapter

from .test_admin_api import client_as

PUBLIC = "/api/v1/pdf-books"

pytestmark = pytest.mark.django_db


@pytest.fixture(autouse=True)
def local_storage(settings, tmp_path):
    settings.AWS_STORAGE_BUCKET_NAME = ""  # backend/.env dagi qiymatdan mustaqil
    settings.MEDIA_ROOT = tmp_path


@pytest.fixture
def books(catalog):
    subject = catalog.subject("tabiiy-fanlar", group="natural")
    published = catalog.pdf_book(subject, 1, "published", title={"uz": "Tabiiy fanlar 1 qism"})
    hidden = catalog.pdf_book(subject, 1, "draft", title={"uz": "Tabiiy fanlar 2 qism"})
    for book in (published, hidden):
        PdfBookChapter.objects.create(book=book, title="O'simliklar dunyosi", page=1, order=0)
    return published, hidden


@pytest.fixture(params=["anon", "student", "editor", "admin"])
def client(request, db):
    return APIClient() if request.param == "anon" else client_as(request.param)


def ids(response) -> list[str]:
    body = response.json()
    rows = body["results"] if isinstance(body, dict) else body
    return [row["id"] for row in rows]


def test_manager_published_returns_only_published_books_with_file(books, catalog):
    published, _hidden = books
    PdfBook.objects.create(
        title={"uz": "Fayl yo'q"}, grade=1, subject=published.subject, status="published"
    )

    assert list(PdfBook.objects.published()) == [published]


@pytest.mark.parametrize(
    "params",
    [
        {},
        {"ordering": "newest"},
        {"q": "Tabiiy"},
        {"grade": 1},
        {"subject": "tabiiy-fanlar"},
        {"group": "natural"},
        {"page_size": 100},
    ],
)
def test_lists_show_only_published_for_everyone(books, client, params):
    published, _hidden = books

    assert ids(client.get(f"{PUBLIC}/", params)) == [str(published.pk)]


def test_subject_counts_ignore_hidden_books(books, client):
    rows = client.get(f"{PUBLIC}/subjects/", {"grade": 1}).json()

    assert [(row["slug"], row["books_count"]) for row in rows] == [("tabiiy-fanlar", 1)]


def test_chapter_search_ignores_hidden_books(books, client):
    published, _hidden = books
    hits = client.get(f"{PUBLIC}/search/", {"q": "simliklar"}).json()

    assert {hit["book"]["id"] for hit in hits} == {str(published.pk)}


def test_hidden_book_detail_is_404_for_the_public(books):
    _published, hidden = books
    anon = APIClient()

    assert ids(anon.get(f"{PUBLIC}/", {"ordering": "newest"})) == [str(books[0].pk)]
    for path in (
        f"{PUBLIC}/{hidden.pk}/",
        f"{PUBLIC}/by-slug/{hidden.slug}/",
        f"{PUBLIC}/{hidden.pk}/file-url/",
        f"{PUBLIC}/{hidden.pk}/download/",
    ):
        assert anon.get(path).status_code == 404, path


def test_staff_can_still_preview_a_hidden_book(books):
    _published, hidden = books
    editor = client_as("editor")

    detail = editor.get(f"{PUBLIC}/{hidden.pk}/")

    assert detail.status_code == 200
    assert detail.json()["unverified"] is True
    assert "no-store" in detail["Cache-Control"]
    assert editor.get(f"{PUBLIC}/{hidden.pk}/file-url/").status_code == 200


def test_hiding_a_published_book_removes_it_from_cached_lists(
    books, django_capture_on_commit_callbacks
):
    published, _hidden = books
    anon = APIClient()
    assert ids(anon.get(f"{PUBLIC}/", {"ordering": "newest"})) == [str(published.pk)]
    assert anon.get(f"{PUBLIC}/{published.pk}/").status_code == 200

    with django_capture_on_commit_callbacks(execute=True):
        published.status = "draft"
        published.save()

    assert ids(anon.get(f"{PUBLIC}/", {"ordering": "newest"})) == []
    assert anon.get(f"{PUBLIC}/{published.pk}/").status_code == 404
