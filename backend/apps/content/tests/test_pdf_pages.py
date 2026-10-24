import pytest
from django.core.files.base import ContentFile
from django.core.files.storage import default_storage
from rest_framework.test import APIClient

from apps.content import pdf_storage
from apps.content.models import PdfBook

from .test_admin_api import client_as

PUBLIC = "/api/v1/pdf-books"


@pytest.fixture(autouse=True)
def local_storage(settings, tmp_path):
    settings.AWS_STORAGE_BUCKET_NAME = ""
    settings.MEDIA_ROOT = tmp_path


def test_slug_is_generated_unique_and_stable(catalog):
    algebra = catalog.subject("algebra")
    first = catalog.pdf_book(algebra, grade=9)
    second = catalog.pdf_book(algebra, grade=9)
    other = catalog.pdf_book(algebra, grade=10)
    assert first.slug == "9-sinf-algebra"
    assert second.slug == "9-sinf-algebra-2"
    assert other.slug == "10-sinf-algebra"

    first.grade = 8
    first.save()
    assert first.slug == "9-sinf-algebra"  # URL barqaror


def test_public_list_and_detail_expose_slug_group_language(catalog):
    algebra = catalog.subject("algebra", group="exact")
    book = catalog.pdf_book(algebra, grade=9)
    api = APIClient()

    item = api.get(PUBLIC + "/").json()["results"][0]
    assert item["slug"] == "9-sinf-algebra" and item["subject_group"] == "exact"
    by_slug = api.get(f"{PUBLIC}/by-slug/{book.slug}/")
    assert by_slug.status_code == 200 and by_slug.json()["id"] == str(book.pk)
    assert by_slug.json()["language"] == "uz" and by_slug.json()["allow_download"] is True
    assert api.get(f"{PUBLIC}/by-slug/yoq-kitob/").status_code == 404


def test_by_slug_hides_drafts(catalog):
    book = catalog.pdf_book(catalog.subject("fizika"), status="draft")
    assert APIClient().get(f"{PUBLIC}/by-slug/{book.slug}/").status_code == 404


def test_download_returns_attachment_url_and_counts(catalog):
    subject = catalog.subject("algebra")
    book = catalog.pdf_book(subject, title={"uz": "Algebra: 9/sinf"})
    api = APIClient()

    resp = api.get(f"{PUBLIC}/{book.pk}/download/")
    assert resp.status_code == 200
    data = resp.json()
    assert data["filename"] == "Algebra 9 sinf - 9-sinf - Darslik365.pdf"
    assert "download=" in data["url"] and data["url"].startswith(f"{PUBLIC}/{book.pk}/file/")
    assert resp["Cache-Control"] == "private, no-store"
    book.refresh_from_db()
    assert book.download_count == 1


def test_download_disabled_per_book(catalog):
    book = catalog.pdf_book(catalog.subject("algebra"), allow_download=False)
    resp = APIClient().get(f"{PUBLIC}/{book.pk}/download/")
    assert resp.status_code == 403 and resp.json()["code"] == "download_disabled"
    book.refresh_from_db()
    assert book.download_count == 0
    # O'qish baribir ochiq
    assert APIClient().get(f"{PUBLIC}/{book.pk}/file-url/").status_code == 200


def test_local_file_serves_attachment_when_download_param(catalog):
    subject = catalog.subject("algebra")
    book = catalog.pdf_book(subject, title={"uz": "Algebra"})
    default_storage.save(book.file.name, ContentFile(b"%PDF-1.4 test"))
    url = pdf_storage.download_url(book)["url"]
    resp = APIClient().get(url)
    assert resp.status_code == 200
    assert resp["Content-Disposition"].startswith("attachment; filename=")
    assert "filename*=UTF-8''Algebra" in resp["Content-Disposition"]
    inline = APIClient().get(pdf_storage.read_url(book)["url"])
    assert inline["Content-Disposition"] == "inline"


def test_content_disposition_encodes_non_ascii():
    header = pdf_storage.content_disposition("Matematika – o‘quv qo‘llanma.pdf")
    assert header.startswith('attachment; filename="')
    assert "filename*=UTF-8''Matematika%20%E2%80%93" in header


def test_admin_edits_subject_group_language_and_download_flag(catalog):
    admin = client_as("admin")
    subject = catalog.subject("algebra")
    resp = admin.patch(f"/api/v1/admin/subjects/{subject.pk}/", {"group": "exact"}, "json")
    assert resp.status_code == 200 and resp.json()["group"] == "exact"
    assert (
        admin.patch(f"/api/v1/admin/subjects/{subject.pk}/", {"group": "x"}, "json").status_code
        == 400
    )

    book = catalog.pdf_book(subject)
    resp = admin.patch(
        f"/api/v1/admin/pdf-books/{book.pk}/",
        {"language": "ru", "allow_download": False, "slug": "hack"},
        "json",
    )
    assert resp.status_code == 200
    assert resp.json()["language"] == "ru" and resp.json()["allow_download"] is False
    assert PdfBook.objects.get(pk=book.pk).slug == "9-sinf-algebra"  # slug o'zgarmaydi


def test_chapter_search_finds_sections_in_visible_books_only(catalog):
    from apps.content.models import PdfBookChapter

    algebra = catalog.subject("algebra")
    shown = catalog.pdf_book(algebra, grade=9)
    hidden = catalog.pdf_book(catalog.subject("fizika"), grade=9, status="draft")
    PdfBookChapter.objects.create(book=shown, title="Kvadrat tenglamalar", page=12, order=0)
    PdfBookChapter.objects.create(book=hidden, title="Kvadrat harakat", page=3, order=0)
    api = APIClient()

    hits = api.get(f"{PUBLIC}/search/", {"q": "kvadrat"}).json()
    assert [(h["title"], h["page"], h["book"]["slug"]) for h in hits] == [
        ("Kvadrat tenglamalar", 12, "9-sinf-algebra")
    ]
    assert hits[0]["book"]["grade"] == 9
    assert api.get(f"{PUBLIC}/search/", {"q": "k"}).json() == []
    assert api.get(f"{PUBLIC}/search/", {"q": "yoq"}).json() == []
