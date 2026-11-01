import pytest
from django.core.files.base import ContentFile
from django.core.files.uploadedfile import SimpleUploadedFile

from apps.accounts.models import AuditLog
from apps.books.models import Book, BookPage, BookStatus, BookType
from apps.content.storage import covers_storage
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


# --- Yuklash: PDF sinxron tekshiriladi, kitob darhol tayyor ---


def test_upload_makes_book_ready_with_page_count_and_cover(editor):
    book = make_book()
    response = editor.post(
        f"{ADMIN}/{book.pk}/upload/",
        pdf_upload(text_pdf(["Birinchi sahifa matni bu yerda", "Ikkinchi sahifa matni ham bor"])),
        format="multipart",
    )
    assert response.status_code == 200, response.content
    body = response.json()
    assert body["page_count"] == 2 and body["status"] == "ready" and body["status_error"] == ""
    assert body["allowed_transitions"] == ["published"]
    assert body["has_text_layer"] is True

    book.refresh_from_db()
    assert book.cover_image and book.cover_generated
    with book.cover_image.open("rb") as handle:
        data = handle.read()
    assert data[8:12] == b"WEBP"
    import io

    from PIL import Image

    width, height = Image.open(io.BytesIO(data)).size
    assert width == 800 and height == 1120  # 300x420pt, eni 800
    assert not BookPage.objects.filter(book=book).exists()  # yangi kitobga sahifa rasmlari yo'q


def test_scanned_pdf_has_no_text_layer(editor):
    book = make_book()
    body = editor.post(
        f"{ADMIN}/{book.pk}/upload/", pdf_upload(blank_pdf(6)), format="multipart"
    ).json()
    assert body["has_text_layer"] is False and body["page_count"] == 6


def test_manual_cover_is_never_replaced_by_pdf_cover(editor):
    book = make_book(cover_image="covers/manual.webp")
    editor.post(f"{ADMIN}/{book.pk}/upload/", pdf_upload(blank_pdf(2)), format="multipart")
    book.refresh_from_db()
    assert book.cover_image.name == "covers/manual.webp" and not book.cover_generated


def test_generated_cover_is_refreshed_when_pdf_is_replaced(editor):
    book = make_book()
    editor.post(f"{ADMIN}/{book.pk}/upload/", pdf_upload(blank_pdf(2)), format="multipart")
    book.refresh_from_db()
    first = book.cover_image.name
    editor.post(f"{ADMIN}/{book.pk}/upload/", pdf_upload(blank_pdf(3)), format="multipart")
    book.refresh_from_db()
    assert book.cover_generated and book.cover_image.name != first
    assert book.page_count == 3
    assert not book.cover_image.storage.exists(first)  # eski avto muqova tozalandi


def test_clearing_cover_regenerates_it_from_pdf(editor):
    book = make_book()
    editor.post(f"{ADMIN}/{book.pk}/upload/", pdf_upload(blank_pdf(2)), format="multipart")
    covers_storage().save("covers/qolda2.webp", ContentFile(b"RIFF....WEBPmanual"))
    editor.patch(f"{ADMIN}/{book.pk}/", {"cover_image": "covers/qolda2.webp"}, format="json")
    cleared = editor.patch(f"{ADMIN}/{book.pk}/", {"cover_image": ""}, format="json")
    assert cleared.status_code == 200, cleared.content
    book.refresh_from_db()
    assert book.cover_generated and book.cover_image.name.endswith(".webp")
    assert book.cover_image.name != "covers/qolda2.webp"
    assert book.cover_image.storage.exists(book.cover_image.name)


def test_admin_cover_upload_wins_over_generated(editor):
    book = make_book()
    editor.post(f"{ADMIN}/{book.pk}/upload/", pdf_upload(blank_pdf(2)), format="multipart")
    covers_storage().save("covers/qolda.webp", ContentFile(b"RIFF....WEBPmanual"))
    patched = editor.patch(
        f"{ADMIN}/{book.pk}/", {"cover_image": "covers/qolda.webp"}, format="json"
    )
    assert patched.status_code == 200, patched.content
    book.refresh_from_db()
    assert book.cover_image.name == "covers/qolda.webp" and not book.cover_generated
    editor.post(f"{ADMIN}/{book.pk}/upload/", pdf_upload(blank_pdf(4)), format="multipart")
    book.refresh_from_db()
    assert book.cover_image.name == "covers/qolda.webp"


def test_upload_rejects_non_pdf_encrypted_and_corrupt(editor):
    book = make_book()

    def attempt(data):
        return editor.post(
            f"{ADMIN}/{book.pk}/upload/",
            {"file": SimpleUploadedFile("kitob.pdf", data, "application/pdf")},
            format="multipart",
        )

    fake = attempt(b"not a pdf at all")
    assert fake.status_code == 415 and fake.json()["code"] == "unsupported_type"
    locked = attempt(blank_pdf(1, encrypt=True))
    assert locked.status_code == 400 and locked.json()["code"] == "pdf_encrypted"
    corrupt = attempt(b"%PDF-1.4\n garbage without objects")
    assert corrupt.status_code == 400 and corrupt.json()["code"] == "invalid_pdf"
    book.refresh_from_db()
    assert not book.source_file and book.status == BookStatus.FAILED


def test_rejected_replacement_keeps_previous_file(editor):
    book = make_book()
    editor.post(f"{ADMIN}/{book.pk}/upload/", pdf_upload(blank_pdf(2)), format="multipart")
    book.refresh_from_db()
    old = book.source_file.name
    bad = editor.post(
        f"{ADMIN}/{book.pk}/upload/", pdf_upload(b"%PDF-1.4\n broken"), format="multipart"
    )
    assert bad.status_code == 400
    book.refresh_from_db()
    assert book.source_file.name == old and book.status == BookStatus.READY


def test_upload_size_limit(editor, settings):
    settings.BOOK_PDF_MAX_BYTES = 100
    book = make_book()
    big = editor.post(f"{ADMIN}/{book.pk}/upload/", pdf_upload(blank_pdf(5)), format="multipart")
    assert big.status_code == 413 and big.json()["code"] == "file_too_large"
    init = editor.post(
        f"{ADMIN}/{book.pk}/upload-init/",
        {"filename": "k.pdf", "size": 5000, "content_type": "application/pdf"},
        format="json",
    )
    assert init.status_code == 413 and init.json()["code"] == "file_too_large"


def test_no_reprocess_endpoint(editor):
    book = make_book()
    assert editor.post(f"{ADMIN}/{book.pk}/reprocess/").status_code == 404


# --- PDF o'qish URL'i va HTTP Range ---


def uploaded(editor, pages=3, **over):
    book = make_book(is_published=True, **over)
    editor.post(f"{ADMIN}/{book.pk}/upload/", pdf_upload(blank_pdf(pages)), format="multipart")
    book.refresh_from_db()
    return book


def test_file_url_is_signed_uncached_and_hides_storage_key(anon, editor):
    book = uploaded(editor)
    response = anon.get(f"{PUBLIC}/{book.pk}/file-url/")
    assert response.status_code == 200
    assert response["Cache-Control"] == "private, no-store"
    body = response.json()
    assert body["url"].startswith(f"/api/v1/books/{book.pk}/file/?token=")
    assert body["expires_in"] > 0
    assert "book-sources" not in body["url"]


def test_file_url_requires_visible_book_with_file(anon, editor):
    draft = uploaded(editor)
    Book.objects.filter(pk=draft.pk).update(is_published=False)
    assert anon.get(f"{PUBLIC}/{draft.pk}/file-url/").status_code == 404
    assert editor.get(f"{PUBLIC}/{draft.pk}/file-url/").status_code == 200  # staff ko'radi
    assert anon.get(f"{PUBLIC}/{make_book(is_published=True).pk}/file-url/").status_code == 404


def test_local_file_supports_range_requests(anon, editor):
    book = uploaded(editor)
    url = anon.get(f"{PUBLIC}/{book.pk}/file-url/").json()["url"]
    size = book.size_bytes

    whole = anon.get(url)
    assert whole.status_code == 200 and whole["Accept-Ranges"] == "bytes"
    assert b"".join(whole.streaming_content)[:5] == b"%PDF-"

    part = anon.get(url, HTTP_RANGE="bytes=0-99")
    assert part.status_code == 206
    assert part["Content-Range"] == f"bytes 0-99/{size}" and part["Content-Length"] == "100"
    assert len(b"".join(part.streaming_content)) == 100

    tail = anon.get(url, HTTP_RANGE="bytes=-50")
    assert (
        tail.status_code == 206 and tail["Content-Range"] == f"bytes {size - 50}-{size - 1}/{size}"
    )
    assert anon.get(url, HTTP_RANGE=f"bytes={size + 10}-").status_code == 416


def test_local_file_rejects_bad_or_replaced_token(anon, editor):
    book = uploaded(editor)
    url = anon.get(f"{PUBLIC}/{book.pk}/file-url/").json()["url"]
    assert anon.get(f"/api/v1/books/{book.pk}/file/").status_code == 404
    assert anon.get(f"/api/v1/books/{book.pk}/file/?token=nope").status_code == 404
    # Fayl almashtirilgach eski havola yaroqsiz.
    editor.post(f"{ADMIN}/{book.pk}/upload/", pdf_upload(blank_pdf(1)), format="multipart")
    assert anon.get(url).status_code == 404


# --- Eski ma'lumotni xavfsiz o'tkazish (migratsiya) ---


def test_legacy_migration_keeps_pages_and_unsticks_books():
    import importlib

    from django.apps import apps as global_apps

    migration = importlib.import_module("apps.books.migrations.0004_books_pdf_viewer")
    stuck = make_book(
        title="Qotgan", status=BookStatus.PROCESSING, source_file="book-sources/a.pdf"
    )
    failed = make_book(
        title="Render xatosi", status=BookStatus.FAILED, status_error="render_failed",
        source_file="book-sources/b.pdf",
    )  # fmt: skip
    broken = make_book(
        title="Buzuq", status=BookStatus.FAILED, status_error="invalid_pdf",
        source_file="book-sources/c.pdf",
    )  # fmt: skip
    empty = make_book(title="Faylsiz")
    legacy = ready_book(title="Eski tayyor")
    pages_before = BookPage.objects.count()

    migration.legacy_to_ready(global_apps, None)

    for book, status, error in [
        (stuck, "ready", ""),
        (failed, "ready", ""),
        (broken, "failed", "invalid_pdf"),
        (empty, "failed", "no_file"),
    ]:
        book.refresh_from_db()
        assert (book.status, book.status_error) == (status, error), book.title
    assert BookPage.objects.count() == pages_before  # eski sahifalar o'chmadi
    legacy.refresh_from_db()
    assert legacy.has_text_layer is True  # 1-sahifada matn bor edi
    stuck.refresh_from_db()
    assert stuck.has_text_layer is None  # noma'lum: mijoz o'zi tekshiradi


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
    make_book(title="Eski, tayyorlanmoqda", status=BookStatus.PROCESSING, is_published=True)
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
