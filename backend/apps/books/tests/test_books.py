import pytest
from django.core.files.base import ContentFile
from django.core.files.uploadedfile import SimpleUploadedFile

from apps.accounts.models import AuditLog
from apps.books import services
from apps.books.models import Book, BookPage, BookStatus, BookType
from apps.content.tests.test_admin_api import client_as

from .conftest import blank_pdf, text_pdf

pytestmark = pytest.mark.django_db

ADMIN = "/api/v1/admin/books"
PUBLIC = "/api/v1/books"


def pdf_upload(data, name="kitob.pdf"):
    return {"file": SimpleUploadedFile(name, data, "application/pdf")}


def make_book(**over) -> Book:
    fields = {"title": "Sariq devni minib", "author": "X. To'xtaboyev", "type": BookType.FICTION}
    return Book.objects.create(**{**fields, **over})


def ready_book(**over) -> Book:
    book = make_book(status=BookStatus.READY, status_error="", is_published=True, **over)
    for number in (1, 2):
        BookPage.objects.create(
            book=book,
            number=number,
            image=f"book-pages/{book.pk}/{number}.webp",
            thumbnail=f"book-pages/{book.pk}/{number}-t.webp",
            width=1400,
            height=1960,
            text="Matn bor sahifa uchun yetarli uzunlikdagi matn" if number == 1 else "",
        )
    book.page_count = 2
    book.save()
    return book


@pytest.fixture
def editor(db):
    return client_as("editor")


@pytest.fixture
def admin(db):
    return client_as("admin")


# --- Admin: ruxsat va CRUD ---


def test_admin_api_requires_editor(anon):
    assert anon.get(f"{ADMIN}/").status_code in (401, 403)
    assert client_as("student").get(f"{ADMIN}/").status_code == 403
    assert client_as("teacher").get(f"{ADMIN}/").status_code == 403


def test_create_book_starts_without_file(editor):
    response = editor.post(
        f"{ADMIN}/",
        {"title": " Matematika 1 ", "type": "math", "grade_level": 5, "language": "uz"},
        format="json",
    )
    assert response.status_code == 201, response.content
    body = response.json()
    assert body["title"] == "Matematika 1"
    assert body["status"] == "failed"
    assert body["status_error"] == "no_file"
    assert body["has_file"] is False
    assert body["is_published"] is False
    assert body["allowed_transitions"] == []
    assert AuditLog.objects.filter(target_type="book", action="create").exists()


def test_validation_rejects_bad_type_grade_and_blank_title(editor):
    bad = editor.post(
        f"{ADMIN}/", {"title": "  ", "type": "novel", "grade_level": 12}, format="json"
    )
    assert bad.status_code == 400
    assert {"title", "type", "grade_level"} <= set(bad.json()["details"])


def test_chapters_are_validated_and_replaced(editor):
    book = ready_book()
    url = f"{ADMIN}/{book.pk}/"
    ok = editor.patch(
        url,
        {"chapters": [{"title": "Kirish", "start_page": 1}, {"title": "I bob", "start_page": 2}]},
        format="json",
    )
    assert ok.status_code == 200, ok.content
    assert [c["title"] for c in ok.json()["chapters"]] == ["Kirish", "I bob"]

    exceeds = editor.patch(url, {"chapters": [{"title": "X", "start_page": 3}]}, format="json")
    assert exceeds.status_code == 400
    assert "chapter_page_exceeds" in exceeds.json()["details"]["chapters"]

    unordered = editor.patch(
        url,
        {"chapters": [{"title": "A", "start_page": 2}, {"title": "B", "start_page": 1}]},
        format="json",
    )
    assert "chapter_page_order" in unordered.json()["details"]["chapters"]
    assert book.chapters.count() == 2  # xato so'rov mavjud mundarijani buzmadi


def test_only_admin_deletes(editor, admin):
    book = ready_book()
    assert editor.delete(f"{ADMIN}/{book.pk}/").status_code == 403
    assert admin.delete(f"{ADMIN}/{book.pk}/").status_code == 204
    assert not Book.objects.filter(pk=book.pk).exists()
    assert not BookPage.objects.exists()


# --- Yuklash va sahifalarni tayyorlash ---


def test_upload_converts_pdf_into_webp_pages(editor):
    book = make_book()
    response = editor.post(
        f"{ADMIN}/{book.pk}/upload/",
        pdf_upload(text_pdf(["Birinchi sahifa matni bu yerda", "Ikkinchi sahifa matni ham bor"])),
        format="multipart",
    )
    assert response.status_code == 200, response.content
    assert response.json()["page_count"] == 2

    book.refresh_from_db()  # Celery eager: aylantirish allaqachon tugagan
    assert book.status == BookStatus.READY
    assert book.processed_pages == 2
    assert book.cover_image  # birinchi sahifadan avto muqova

    pages = list(book.pages.order_by("number"))
    assert [p.number for p in pages] == [1, 2]
    first = pages[0]
    assert first.image.name.endswith(".webp") and first.thumbnail.name.endswith("-t.webp")
    # 300x420pt sahifa: masshtab MAX_SCALE (3) bilan cheklanadi
    assert (first.width, first.height) == (900, 1260)
    assert "Birinchi sahifa" in first.text
    with first.image.open("rb") as handle:
        assert handle.read(12)[8:12] == b"WEBP"


def test_blank_pages_have_no_text(editor):
    book = make_book()
    editor.post(f"{ADMIN}/{book.pk}/upload/", pdf_upload(blank_pdf(2)), format="multipart")
    assert list(book.pages.values_list("text", flat=True)) == ["", ""]


def test_upload_rejects_non_pdf_and_encrypted(editor):
    book = make_book()
    fake = editor.post(
        f"{ADMIN}/{book.pk}/upload/",
        {"file": SimpleUploadedFile("kitob.pdf", b"not a pdf at all", "application/pdf")},
        format="multipart",
    )
    assert fake.status_code == 415 and fake.json()["code"] == "unsupported_type"

    locked = editor.post(
        f"{ADMIN}/{book.pk}/upload/",
        pdf_upload(blank_pdf(1, encrypt=True)),
        format="multipart",
    )
    assert locked.status_code == 400 and locked.json()["code"] == "pdf_encrypted"
    book.refresh_from_db()
    assert not book.source_file and not book.pages.exists()


def test_corrupt_pdf_marks_book_failed():
    book = make_book(
        source_file=ContentFile(b"%PDF-1.4\n garbage without objects", name="book-sources/x.pdf")
    )
    services.process_book(book.pk)
    book.refresh_from_db()
    assert book.status == BookStatus.FAILED
    assert book.status_error == "invalid_pdf"
    assert not book.pages.exists()


def test_replacing_pdf_replaces_pages_and_files(editor):
    book = make_book()
    editor.post(f"{ADMIN}/{book.pk}/upload/", pdf_upload(blank_pdf(3)), format="multipart")
    old = [p.image.name for p in book.pages.all()]
    assert len(old) == 3

    editor.post(f"{ADMIN}/{book.pk}/upload/", pdf_upload(blank_pdf(1)), format="multipart")
    book.refresh_from_db()
    assert book.page_count == 1 and book.pages.count() == 1
    assert not any(book.pages.first().image.storage.exists(name) for name in old)


def test_reprocess_requires_file_and_runs_again(editor):
    book = make_book()
    assert editor.post(f"{ADMIN}/{book.pk}/reprocess/").status_code == 409
    editor.post(f"{ADMIN}/{book.pk}/upload/", pdf_upload(blank_pdf(2)), format="multipart")
    again = editor.post(f"{ADMIN}/{book.pk}/reprocess/")
    assert again.status_code == 202
    assert again.json()["status"] == "ready" and again.json()["page_count"] == 2


# --- Nashr ---


def test_publish_flow_and_roles(editor, admin):
    book = make_book()
    url = f"{ADMIN}/{book.pk}/transition/"
    assert editor.post(url, {"to": "published"}, format="json").status_code == 400  # tayyor emas

    editor.post(f"{ADMIN}/{book.pk}/upload/", pdf_upload(blank_pdf(1)), format="multipart")
    assert editor.post(url, {"to": "published"}, format="json").json()["is_published"] is True
    assert editor.post(url, {"to": "published"}, format="json").status_code == 400
    assert editor.post(url, {"to": "draft"}, format="json").status_code == 403
    assert admin.post(url, {"to": "draft"}, format="json").json()["is_published"] is False


# --- Ochiq API ---


def test_public_list_shows_only_published_ready(anon):
    ready_book(title="Ochiq")
    make_book(title="Qoralama")  # fayli yo'q
    make_book(title="Tayyorlanmoqda", status=BookStatus.PROCESSING, is_published=True)
    body = anon.get(f"{PUBLIC}/").json()
    assert [b["title"] for b in body["results"]] == ["Ochiq"]
    assert set(body["results"][0]) == {
        "id", "title", "author", "type", "grade_level", "language", "page_count", "cover",
        "created_at",
    }  # fmt: skip


def test_public_list_filters(anon):
    ready_book(title="Algebra", author="A", type=BookType.MATH, grade_level=7)
    ready_book(
        title="O'tkan kunlar", author="Abdulla Qodiriy", type=BookType.FICTION, language="ru"
    )

    def titles(query):
        return [b["title"] for b in anon.get(f"{PUBLIC}/{query}").json()["results"]]

    assert titles("?type=math") == ["Algebra"]
    assert titles("?grade=7") == ["Algebra"]
    assert titles("?language=ru") == ["O'tkan kunlar"]
    assert titles("?q=qodiriy") == ["O'tkan kunlar"]
    assert titles("?ordering=title") == ["Algebra", "O'tkan kunlar"]
    assert anon.get(f"{PUBLIC}/?type=nope").status_code == 400
    assert anon.get(f"{PUBLIC}/?language=de").status_code == 400


def test_public_detail_has_chapters_and_hides_unpublished(anon, editor):
    book = ready_book(description="Bolalar uchun")
    book.chapters.create(title="I bob", start_page=2, order=0)
    body = anon.get(f"{PUBLIC}/{book.pk}/").json()
    assert body["description"] == "Bolalar uchun"
    assert body["chapters"] == [
        {"id": body["chapters"][0]["id"], "title": "I bob", "start_page": 2}
    ]
    assert "source_file" not in body

    hidden = make_book()
    assert anon.get(f"{PUBLIC}/{hidden.pk}/").status_code == 404
    assert editor.get(f"{PUBLIC}/{hidden.pk}/").status_code == 200  # staff qoralamani ko'radi


def test_public_pages(anon):
    book = ready_book()
    pages = anon.get(f"{PUBLIC}/{book.pk}/pages/").json()
    assert [p["number"] for p in pages] == [1, 2]
    assert pages[0]["has_text"] is True and pages[1]["has_text"] is False
    assert {"image", "thumbnail", "width", "height"} <= set(pages[0])
    assert "text" not in pages[0]
    assert anon.get(f"{PUBLIC}/{make_book().pk}/pages/").status_code == 404


def test_public_cache_is_invalidated_on_change(anon, admin):
    book = ready_book(title="Eski nom")
    assert anon.get(f"{PUBLIC}/{book.pk}/").json()["title"] == "Eski nom"
    admin.patch(f"{ADMIN}/{book.pk}/", {"title": "Yangi nom"}, format="json")
    assert anon.get(f"{PUBLIC}/{book.pk}/").json()["title"] == "Yangi nom"
