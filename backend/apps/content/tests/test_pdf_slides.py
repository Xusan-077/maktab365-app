# ruff: noqa: F811  — umumiy fixture'lar `test_pdf_books` dan import qilinadi
"""Bo'lim prezentatsiyalari (ixtiyoriy PDF slaydlar): yuklash, almashtirish, o'chirish, API."""

from unittest.mock import MagicMock

import pytest
from django.core.files.base import ContentFile
from django.core.files.storage import default_storage
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework.test import APIClient

from apps.accounts.models import AuditLog
from apps.content import pdf_storage
from apps.content.models import PdfBook, PdfBookChapter

from .test_admin_api import client_as
from .test_pdf_books import (  # noqa: F401
    BASE,
    admin,
    algebra,
    anon,
    create_book,
    editor,  # noqa: F401
    local_storage,
    make_pdf,
    remote,
    upload,
)

PUBLIC = "/api/v1/pdf-books"


@pytest.fixture
def book(admin, algebra):
    """Yuklangan (draft) 3 sahifali kitob; mundarijada 2 bo'lim, biri ichki bo'limli."""
    created = create_book(admin)
    assert upload(admin, created["id"]).status_code == 200
    resp = admin.patch(
        f"{BASE}/{created['id']}/",
        {
            "chapters": [
                {"title": "I bob", "page": 1, "children": [{"title": "1.1", "page": 2}]},
                {"title": "II bob", "page": 3},
            ]
        },
        "json",
    )
    assert resp.status_code == 200, resp.json()
    return resp.json()


def chapter_url(book, index=0, suffix=""):
    chapter_id = book["chapters"][index]["id"]
    return f"{BASE}/{book['id']}/chapters/{chapter_id}/slides{suffix}"


def upload_slides(client, book, index=0, **file_kwargs):
    data = file_kwargs.pop("data", make_pdf(pages=5))
    name = file_kwargs.pop("name", "slaydlar.pdf")
    content_type = file_kwargs.pop("content_type", "application/pdf")
    upload_file = SimpleUploadedFile(name, data, content_type=content_type)
    return client.post(chapter_url(book, index, "/upload/"), {"file": upload_file}, "multipart")


def slides_of(client, book_id, index=0):
    return client.get(f"{BASE}/{book_id}/").json()["chapters"][index]["slides"]


def slides_delete_url(book, index=0):
    return chapter_url(book, index, "/")


def stored_slides() -> list[str]:
    exists = default_storage.exists("pdf-slides")
    return default_storage.listdir("pdf-slides")[1] if exists else []


# --- Slaydsiz bo'lim avvalgidek ishlaydi ---


def test_chapter_without_slides_has_null_and_no_url(admin, book, anon):
    assert all(row["slides"] is None for row in book["chapters"])
    assert book["chapters"][0]["children"][0]["slides"] is None
    admin.post(f"{BASE}/{book['id']}/transition/", {"to": "published"}, "json")

    public = anon.get(f"{PUBLIC}/{book['id']}/").json()

    assert [c["slides"] for c in public["chapters"]] == [None, None]
    chapter_id = public["chapters"][0]["id"]
    assert anon.get(f"{PUBLIC}/{book['id']}/chapters/{chapter_id}/slides/").status_code == 404


def test_saving_chapters_without_slides_still_works(admin, book):
    resp = admin.patch(
        f"{BASE}/{book['id']}/",
        {"chapters": [{"title": "Yangi", "page": 2}]},
        "json",
    )

    assert resp.status_code == 200
    assert [c["title"] for c in resp.json()["chapters"]] == ["Yangi"]


# --- Yuklash (lokal proxy rejimi) ---


def test_upload_attaches_slides_and_audits(admin, book):
    resp = upload_slides(admin, book)

    assert resp.status_code == 200, resp.json()
    slides = resp.json()["chapters"][0]["slides"]
    assert slides["name"] == "slaydlar.pdf" and slides["page_count"] == 5
    assert slides["size_bytes"] > 0 and slides["updated_at"]
    chapter = PdfBookChapter.objects.get(pk=book["chapters"][0]["id"])
    assert chapter.slides_file.startswith("pdf-slides/") and chapter.has_slides
    assert resp.json()["chapters"][1]["slides"] is None  # boshqa bo'lim o'zgarmadi
    entry = AuditLog.objects.get(action="slides_upload")
    assert entry.target_id == book["chapters"][0]["id"] and "I bob" in entry.target_label
    assert entry.after["slides"]["page_count"] == 5 and entry.before["slides"] is None


@pytest.mark.parametrize(
    ("kwargs", "status", "code"),
    [
        ({"name": "a.pptx"}, 415, "unsupported_type"),
        ({"content_type": "application/zip"}, 415, "unsupported_type"),
        ({"data": b"%PDF-1.4 broken"}, 400, "invalid_pdf"),
        ({"data": b"PK\x03\x04 zip"}, 415, "unsupported_type"),
        ({"data": b""}, 400, None),
    ],
)
def test_upload_accepts_only_real_pdf(admin, book, kwargs, status, code):
    resp = upload_slides(admin, book, **kwargs)

    assert resp.status_code == status
    if code:
        assert resp.json()["code"] == code
    assert slides_of(admin, book["id"]) is None
    assert stored_slides() == []  # rad etilgan fayl yetim bo'lib qolmaydi


def test_no_size_limit_for_slides(admin, book, settings):
    settings.PDF_BOOK_MAX_BYTES = 50  # kitob chegarasi prezentatsiyaga tegmaydi

    assert upload_slides(admin, book).status_code == 200


def test_replace_removes_old_file(admin, book, django_capture_on_commit_callbacks):
    upload_slides(admin, book)
    old_key = PdfBookChapter.objects.get(pk=book["chapters"][0]["id"]).slides_file

    with django_capture_on_commit_callbacks(execute=True):
        resp = upload_slides(admin, book, data=make_pdf(pages=2), name="yangi.pdf")

    assert resp.status_code == 200
    slides = resp.json()["chapters"][0]["slides"]
    assert slides["name"] == "yangi.pdf" and slides["page_count"] == 2
    new_key = PdfBookChapter.objects.get(pk=book["chapters"][0]["id"]).slides_file
    assert new_key != old_key
    assert not default_storage.exists(old_key) and default_storage.exists(new_key)


def test_failed_replace_keeps_old_slides(admin, book):
    upload_slides(admin, book)
    key = PdfBookChapter.objects.get(pk=book["chapters"][0]["id"]).slides_file

    assert upload_slides(admin, book, data=b"%PDF-1.4 broken").status_code == 400

    assert slides_of(admin, book["id"])["page_count"] == 5
    assert default_storage.exists(key)


def test_unknown_chapter_is_404(admin, book):
    other = {"id": book["id"], "chapters": [{"id": "00000000-0000-4000-8000-000000000000"}]}

    assert upload_slides(admin, other).status_code == 404


# --- O'chirish ---


def test_delete_slides_clears_file_and_fields(admin, book, django_capture_on_commit_callbacks):
    upload_slides(admin, book)
    key = PdfBookChapter.objects.get(pk=book["chapters"][0]["id"]).slides_file

    with django_capture_on_commit_callbacks(execute=True):
        resp = admin.delete(slides_delete_url(book))

    assert resp.status_code == 200 and resp.json()["chapters"][0]["slides"] is None
    chapter = PdfBookChapter.objects.get(pk=book["chapters"][0]["id"])
    assert not chapter.slides_file and chapter.slides_page_count == 0
    assert chapter.slides_size_bytes == 0 and chapter.slides_updated_at is None
    assert not default_storage.exists(key)
    entry = AuditLog.objects.get(action="slides_delete")
    assert entry.before["slides"]["page_count"] == 5 and entry.after["slides"] is None


def test_delete_slides_keeps_everything_when_storage_fails(admin, book, monkeypatch):
    upload_slides(admin, book)
    key = PdfBookChapter.objects.get(pk=book["chapters"][0]["id"]).slides_file
    broken = MagicMock()
    broken.delete.side_effect = OSError("r2 down")
    monkeypatch.setattr(pdf_storage, "default_storage", broken)

    resp = admin.delete(slides_delete_url(book))

    assert resp.status_code == 502 and resp.json()["code"] == "storage_error"
    monkeypatch.undo()
    assert slides_of(admin, book["id"])["page_count"] == 5  # maydonlar o'zgarmadi
    assert default_storage.exists(key)
    assert not AuditLog.objects.filter(action="slides_delete").exists()


# --- Mundarijani saqlash prezentatsiyani saqlab qoladi ---


def test_saving_chapters_with_ids_keeps_slides(admin, book):
    upload_slides(admin, book)
    key = PdfBookChapter.objects.get(pk=book["chapters"][0]["id"]).slides_file
    first = book["chapters"][0]

    resp = admin.patch(
        f"{BASE}/{book['id']}/",
        {
            "chapters": [
                {"id": book["chapters"][1]["id"], "title": "II bob (yangi nom)", "page": 3},
                {"id": first["id"], "title": "I bob", "page": 1},
            ]
        },
        "json",
    )

    assert resp.status_code == 200, resp.json()
    rows = resp.json()["chapters"]
    assert [r["title"] for r in rows] == ["II bob (yangi nom)", "I bob"]
    assert rows[1]["id"] == first["id"] and rows[1]["slides"]["page_count"] == 5
    assert default_storage.exists(key)
    assert PdfBookChapter.objects.filter(book_id=book["id"]).count() == 2  # ichki bo'lim o'chdi


def test_removing_a_chapter_deletes_its_slides(admin, book):
    upload_slides(admin, book)
    key = PdfBookChapter.objects.get(pk=book["chapters"][0]["id"]).slides_file

    resp = admin.patch(f"{BASE}/{book['id']}/", {"chapters": [book["chapters"][1]]}, "json")

    assert resp.status_code == 200 and len(resp.json()["chapters"]) == 1
    assert not default_storage.exists(key)


def test_chapter_removal_is_rolled_back_when_storage_fails(admin, book, monkeypatch):
    upload_slides(admin, book)
    key = PdfBookChapter.objects.get(pk=book["chapters"][0]["id"]).slides_file
    broken = MagicMock()
    broken.delete.side_effect = OSError("r2 down")
    monkeypatch.setattr(pdf_storage, "default_storage", broken)

    resp = admin.patch(f"{BASE}/{book['id']}/", {"chapters": []}, "json")

    assert resp.status_code == 502 and resp.json()["code"] == "storage_error"
    monkeypatch.undo()
    assert PdfBookChapter.objects.filter(book_id=book["id"]).count() == 3  # qatorlar o'chmadi
    assert default_storage.exists(key)


def test_foreign_chapter_id_is_ignored(admin, book, catalog):
    other = create_book(admin, title={"uz": "Boshqa"})
    admin.patch(f"{BASE}/{other['id']}/", {"chapters": [{"title": "X", "page": 1}]}, "json")
    foreign_id = PdfBookChapter.objects.get(book_id=other["id"]).pk

    resp = admin.patch(
        f"{BASE}/{book['id']}/",
        {"chapters": [{"id": str(foreign_id), "title": "Mening", "page": 1}]},
        "json",
    )

    assert resp.status_code == 200
    assert str(PdfBookChapter.objects.get(pk=foreign_id).book_id) == other["id"]
    assert PdfBookChapter.objects.get(pk=foreign_id).title == "X"
    assert resp.json()["chapters"][0]["id"] != str(foreign_id)


# --- Kitobni o'chirish ---


def test_deleting_book_removes_slides_files(admin, book, django_capture_on_commit_callbacks):
    upload_slides(admin, book)
    upload_slides(admin, book, index=1)
    keys = list(
        PdfBookChapter.objects.exclude(slides_file="").values_list("slides_file", flat=True)
    )
    assert len(keys) == 2

    with django_capture_on_commit_callbacks(execute=True):
        assert admin.delete(f"{BASE}/{book['id']}/").status_code == 204

    assert not PdfBook.objects.exists() and not PdfBookChapter.objects.exists()
    assert all(not default_storage.exists(key) for key in keys)


def test_deleting_book_keeps_row_when_slides_storage_fails(admin, book, monkeypatch):
    upload_slides(admin, book)
    broken = MagicMock()
    broken.delete.side_effect = OSError("r2 down")
    monkeypatch.setattr(pdf_storage, "default_storage", broken)

    resp = admin.delete(f"{BASE}/{book['id']}/")

    assert resp.status_code == 502 and resp.json()["code"] == "storage_error"
    assert PdfBook.objects.filter(pk=book["id"]).exists()
    assert PdfBookChapter.objects.exclude(slides_file="").count() == 1


# --- Ruxsatlar ---


@pytest.mark.parametrize("role", [None, "student", "teacher"])
def test_non_staff_cannot_manage_slides(db, admin, book, role):
    client = client_as(role)

    assert upload_slides(client, book).status_code in (401, 403)
    assert client.delete(slides_delete_url(book)).status_code in (401, 403)
    init = client.post(
        chapter_url(book, 0, "/upload-init/"),
        {"filename": "a.pdf", "size": 10, "content_type": "application/pdf"},
        "json",
    )
    assert init.status_code in (401, 403)
    assert slides_of(admin, book["id"]) is None


def test_editor_uploads_but_cannot_delete(editor, admin, book):
    assert upload_slides(editor, book).status_code == 200

    assert editor.delete(slides_delete_url(book)).status_code == 403
    assert slides_of(admin, book["id"])["page_count"] == 5
    assert admin.delete(slides_delete_url(book)).status_code == 200


# --- Ochiq API ---


@pytest.fixture
def published(admin, book):
    upload_slides(admin, book)
    assert (
        admin.post(f"{BASE}/{book['id']}/transition/", {"to": "published"}, "json").status_code
        == 200
    )
    return book


def test_public_detail_lists_slides_info_without_file_key(anon, published):
    body = anon.get(f"{PUBLIC}/{published['id']}/").json()

    first, second = body["chapters"]
    assert first["slides"] == {"page_count": 5, "size_bytes": first["slides"]["size_bytes"]}
    assert set(first["slides"]) == {"page_count", "size_bytes"}  # URL/kalit/nom chiqmaydi
    assert second["slides"] is None and first["children"][0]["slides"] is None
    assert "pdf-slides" not in str(body)


def test_public_slides_url_and_range_file(anon, published):
    chapter_id = published["chapters"][0]["id"]

    resp = anon.get(f"{PUBLIC}/{published['id']}/chapters/{chapter_id}/slides/")

    assert resp.status_code == 200 and resp["Cache-Control"] == "private, no-store"
    url = resp.json()["url"]
    assert url.startswith(f"/api/v1/pdf-books/{published['id']}/chapters/{chapter_id}/slides/file/")
    full = anon.get(url)
    assert full.status_code == 200 and full["Content-Type"] == "application/pdf"
    body = b"".join(full.streaming_content)
    assert body.startswith(b"%PDF-")
    part = anon.get(url, HTTP_RANGE="bytes=0-9")
    assert part.status_code == 206 and part["Content-Range"].startswith("bytes 0-9/")
    assert len(b"".join(part.streaming_content)) == 10
    assert anon.get(url, HTTP_RANGE="bytes=99999999-").status_code == 416


def test_slides_file_needs_valid_token(anon, published):
    chapter_id = published["chapters"][0]["id"]
    base = f"{PUBLIC}/{published['id']}/chapters/{chapter_id}/slides/file/"

    assert anon.get(base).status_code == 404
    assert anon.get(f"{base}?token=bad").status_code == 404
    # Kitob PDF'i tokeni prezentatsiya uchun yaroqsiz (kalit boshqa).
    book_token = anon.get(f"{PUBLIC}/{published['id']}/file-url/").json()["url"].split("token=")[1]
    assert anon.get(f"{base}?token={book_token}").status_code == 404


def test_old_slides_token_dies_after_replace(admin, anon, published):
    chapter_id = published["chapters"][0]["id"]
    url = anon.get(f"{PUBLIC}/{published['id']}/chapters/{chapter_id}/slides/").json()["url"]

    upload_slides(admin, published, data=make_pdf(pages=2))

    assert anon.get(url).status_code == 404


def test_draft_book_slides_visible_to_staff_only(admin, anon, book):
    upload_slides(admin, book)
    chapter_id = book["chapters"][0]["id"]
    url = f"{PUBLIC}/{book['id']}/chapters/{chapter_id}/slides/"

    assert anon.get(url).status_code == 404
    assert client_as("student").get(url).status_code == 404
    assert admin.get(url).status_code == 200


def test_slides_url_of_missing_chapter_is_404(anon, published):
    url = f"{PUBLIC}/{published['id']}/chapters/00000000-0000-4000-8000-000000000000/slides/"

    assert anon.get(url).status_code == 404


def test_public_detail_cache_updates_after_slides_change(
    admin, anon, published, django_capture_on_commit_callbacks
):
    anon.get(f"{PUBLIC}/{published['id']}/")  # keshga tushadi
    with django_capture_on_commit_callbacks(execute=True):
        assert admin.delete(slides_delete_url(published)).status_code == 200

    body = anon.get(f"{PUBLIC}/{published['id']}/").json()

    assert body["chapters"][0]["slides"] is None


# --- S3/R2 rejimi (soxta mijoz) ---


def init_slides(admin, book, size=250, index=0):
    return admin.post(
        chapter_url(book, index, "/upload-init/"),
        {"filename": "slaydlar.pdf", "size": size, "content_type": "application/pdf"},
        "json",
    )


def test_direct_upload_with_long_upload_id(admin, book, remote, settings):  # noqa: F811
    settings.PDF_UPLOAD_PART_BYTES = 100
    long_id = "u" * 400
    remote.create_multipart_upload.return_value = {"UploadId": long_id}

    plan = init_slides(admin, book).json()

    assert plan["mode"] == "direct" and plan["part_size"] == 100 and len(plan["part_urls"]) == 3
    chapter = PdfBookChapter.objects.get(pk=book["chapters"][0]["id"])
    assert chapter.slides_pending_upload_id == long_id
    assert chapter.slides_pending_file.startswith("pdf-slides/")
    assert remote.create_multipart_upload.call_args.kwargs["Key"] == chapter.slides_pending_file

    default_storage.save(chapter.slides_pending_file, ContentFile(make_pdf(pages=4)))
    done = admin.post(
        chapter_url(book, 0, "/upload-complete/"),
        {
            "filename": "katta.pdf",
            "parts": [{"part_number": n, "etag": f'"e{n}"'} for n in (3, 1, 2)],
        },
        "json",
    )

    assert done.status_code == 200, done.json()
    slides = done.json()["chapters"][0]["slides"]
    assert slides["page_count"] == 4 and slides["name"] == "katta.pdf"
    kwargs = remote.complete_multipart_upload.call_args.kwargs
    assert [p["PartNumber"] for p in kwargs["MultipartUpload"]["Parts"]] == [1, 2, 3]
    chapter.refresh_from_db()
    assert chapter.slides_pending_file == "" and chapter.slides_pending_upload_id == ""
    assert upload_slides(admin, book).status_code == 409  # S3 rejimida proxy yopiq


def test_direct_upload_has_no_size_limit_and_scales_parts(admin, book, remote, settings):  # noqa: F811
    settings.PDF_BOOK_MAX_BYTES = 1000
    settings.PDF_UPLOAD_PART_BYTES = 8 * 1024**2
    size = 5 * 1024**3  # 5 GB

    resp = init_slides(admin, book, size=size)

    assert resp.status_code == 200
    assert len(resp.json()["part_urls"]) == 640 and resp.json()["part_size"] == 8 * 1024**2


def test_direct_upload_rejects_wrong_declared_type(admin, book, remote):  # noqa: F811
    resp = admin.post(
        chapter_url(book, 0, "/upload-init/"),
        {"filename": "a.pptx", "size": 10, "content_type": "application/pdf"},
        "json",
    )

    assert resp.status_code == 415
    remote.create_multipart_upload.assert_not_called()


def test_direct_complete_rejects_non_pdf_and_cleans_up(admin, book, remote):  # noqa: F811
    init_slides(admin, book)
    chapter = PdfBookChapter.objects.get(pk=book["chapters"][0]["id"])
    default_storage.save(chapter.slides_pending_file, ContentFile(b"not a pdf at all"))

    resp = admin.post(
        chapter_url(book, 0, "/upload-complete/"),
        {"parts": [{"part_number": 1, "etag": '"e1"'}]},
        "json",
    )

    assert resp.status_code == 415
    chapter.refresh_from_db()
    assert not chapter.slides_file and chapter.slides_pending_file == ""
    assert stored_slides() == []


def test_abort_clears_pending_and_keeps_current_slides(admin, book, remote):  # noqa: F811
    init_slides(admin, book)
    chapter = PdfBookChapter.objects.get(pk=book["chapters"][0]["id"])
    chapter.slides_file = "pdf-slides/current.pdf"
    chapter.slides_page_count = 3
    chapter.save()
    default_storage.save("pdf-slides/current.pdf", ContentFile(make_pdf(pages=3)))

    resp = admin.post(chapter_url(book, 0, "/upload-abort/"), {}, "json")

    assert resp.status_code == 204
    chapter.refresh_from_db()
    assert chapter.slides_pending_file == "" and chapter.slides_pending_upload_id == ""
    assert chapter.slides_file == "pdf-slides/current.pdf"
    remote.abort_multipart_upload.assert_called_once()


def test_complete_without_init_is_409(admin, book, remote):  # noqa: F811
    resp = admin.post(
        chapter_url(book, 0, "/upload-complete/"),
        {"parts": [{"part_number": 1, "etag": '"e"'}]},
        "json",
    )

    assert resp.status_code == 409 and resp.json()["code"] == "no_pending_upload"


def test_unauthenticated_client_cannot_abort(book):
    assert APIClient().post(chapter_url(book, 0, "/upload-abort/"), {}, "json").status_code in (
        401,
        403,
    )
