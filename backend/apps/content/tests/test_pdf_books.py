import io
from unittest.mock import MagicMock

import pytest
from django.core.files.base import ContentFile
from django.core.files.storage import default_storage
from django.core.files.uploadedfile import SimpleUploadedFile
from pypdf import PdfWriter
from rest_framework.test import APIClient

from apps.accounts.models import AuditLog
from apps.content import pdf_storage
from apps.content.models import PdfBook

from .test_admin_api import client_as

BASE = "/api/v1/admin/pdf-books"
PUBLIC = "/api/v1/pdf-books"


def make_pdf(pages=3, encrypt=False) -> bytes:
    writer = PdfWriter()
    for _ in range(pages):
        writer.add_blank_page(width=200, height=200)
    if encrypt:
        writer.encrypt("owner-secret")
    out = io.BytesIO()
    writer.write(out)
    return out.getvalue()


def pdf_file(data=None, name="darslik.pdf", content_type="application/pdf"):
    return SimpleUploadedFile(name, data if data is not None else make_pdf(), content_type)


@pytest.fixture(autouse=True)
def local_storage(settings, tmp_path):
    settings.AWS_STORAGE_BUCKET_NAME = ""  # backend/.env dagi qiymatdan mustaqil
    settings.MEDIA_ROOT = tmp_path


@pytest.fixture
def editor(db):
    return client_as("editor")


@pytest.fixture
def admin(db):
    return client_as("admin")


@pytest.fixture
def algebra(catalog):
    return catalog.subject("algebra")


def stored_files() -> list[str]:
    return default_storage.listdir("pdf-books")[1] if default_storage.exists("pdf-books") else []


def create_book(client, **over):
    body = {"title": {"uz": "Algebra 9"}, "grade": 9, "subject": "algebra", **over}
    resp = client.post(f"{BASE}/", body, "json")
    assert resp.status_code == 201, resp.json()
    return resp.json()


def upload(client, book_id, **file_kwargs):
    return client.post(
        f"{BASE}/{book_id}/upload/", {"file": pdf_file(**file_kwargs)}, format="multipart"
    )


@pytest.fixture
def uploaded(admin, algebra):
    """Yuklangan (draft) 3 sahifali kitob."""
    book = create_book(admin)
    resp = upload(admin, book["id"])
    assert resp.status_code == 200, resp.json()
    return resp.json()


# --- Ruxsatlar ---


@pytest.mark.parametrize(
    ("role", "expected"),
    [(None, 401), ("student", 403), ("teacher", 403), ("editor", 200), ("admin", 200)],
)
def test_admin_endpoints_require_staff_on_the_backend(db, algebra, role, expected):
    client = client_as(role)

    assert client.get(f"{BASE}/").status_code == expected
    created = client.post(
        f"{BASE}/", {"title": {"uz": "A"}, "grade": 5, "subject": "algebra"}, "json"
    )
    assert created.status_code == (201 if expected == 200 else expected)


@pytest.mark.parametrize("role", [None, "student", "teacher"])
def test_non_staff_cannot_upload_or_publish(db, admin, algebra, role):
    book = create_book(admin)
    client = client_as(role)

    assert upload(client, book["id"]).status_code in (401, 403)
    init = client.post(
        f"{BASE}/{book['id']}/upload-init/",
        {"filename": "a.pdf", "size": 10, "content_type": "application/pdf"},
        "json",
    )
    assert init.status_code in (401, 403)
    assert client.post(
        f"{BASE}/{book['id']}/transition/", {"to": "published"}, "json"
    ).status_code in (
        401,
        403,
    )


def test_only_admin_can_delete(admin, editor, uploaded):
    assert editor.delete(f"{BASE}/{uploaded['id']}/").status_code == 403
    assert admin.delete(f"{BASE}/{uploaded['id']}/").status_code == 204


# --- Yuklash va tekshiruv ---


def test_upload_detects_pages_and_stores_under_uuid_name(uploaded):
    assert uploaded["page_count"] == 3
    assert uploaded["has_file"] and uploaded["status"] == "draft"
    book = PdfBook.objects.get(pk=uploaded["id"])
    assert book.file.name.startswith("pdf-books/") and "darslik" not in book.file.name
    assert book.file.name.endswith(".pdf")
    assert default_storage.exists(book.file.name)
    assert book.size_bytes == default_storage.size(book.file.name)


@pytest.mark.parametrize(
    ("kwargs", "status", "code"),
    [
        ({"name": "x.exe"}, 415, "unsupported_type"),
        ({"content_type": "image/png"}, 415, "unsupported_type"),
        ({"data": b"MZ-this-is-not-a-pdf" * 4}, 415, "unsupported_type"),  # kengaytma/MIME soxta
        ({"data": b"%PDF-1.4 garbage, no xref"}, 400, "invalid_pdf"),
        ({"data": make_pdf(encrypt=True)}, 400, "pdf_encrypted"),
        ({"data": b""}, 400, None),
    ],
)
def test_upload_rejects_bad_files(admin, algebra, kwargs, status, code):
    book = create_book(admin)

    resp = upload(admin, book["id"], **kwargs)

    assert resp.status_code == status
    if code:
        assert resp.json()["code"] == code
    assert not PdfBook.objects.get(pk=book["id"]).file
    assert stored_files() == []  # rad etilgan fayl yetim bo'lib qolmaydi


def test_upload_respects_size_limit(admin, algebra, settings):
    settings.PDF_BOOK_MAX_BYTES = 50
    book = create_book(admin)

    resp = upload(admin, book["id"])

    assert resp.status_code == 413 and resp.json()["code"] == "file_too_large"


def test_replace_swaps_file_and_removes_the_old_one(
    admin, uploaded, django_capture_on_commit_callbacks
):
    old_key = PdfBook.objects.get(pk=uploaded["id"]).file.name

    with django_capture_on_commit_callbacks(execute=True):
        resp = upload(admin, uploaded["id"], data=make_pdf(pages=7))

    assert resp.status_code == 200 and resp.json()["page_count"] == 7
    new_key = PdfBook.objects.get(pk=uploaded["id"]).file.name
    assert new_key != old_key
    assert not default_storage.exists(old_key) and default_storage.exists(new_key)


def test_failed_replace_keeps_the_old_file(admin, uploaded):
    old_key = PdfBook.objects.get(pk=uploaded["id"]).file.name

    assert upload(admin, uploaded["id"], data=b"%PDF-1.4 broken").status_code == 400

    book = PdfBook.objects.get(pk=uploaded["id"])
    assert book.file.name == old_key and book.page_count == 3
    assert default_storage.exists(old_key)


def test_delete_removes_files_and_writes_audit(admin, uploaded, django_capture_on_commit_callbacks):
    key = PdfBook.objects.get(pk=uploaded["id"]).file.name

    with django_capture_on_commit_callbacks(execute=True):
        assert admin.delete(f"{BASE}/{uploaded['id']}/").status_code == 204

    assert not PdfBook.objects.exists() and not default_storage.exists(key)
    entry = AuditLog.objects.get(action="delete", target_type="pdf_book")
    assert entry.target_id == uploaded["id"]


def test_upload_and_publish_are_audited(admin, uploaded):
    admin.post(f"{BASE}/{uploaded['id']}/transition/", {"to": "published"}, "json")

    actions = set(AuditLog.objects.filter(target_type="pdf_book").values_list("action", flat=True))
    assert {"create", "upload", "transition"} <= actions


def test_upload_is_rate_limited(admin, algebra, settings):
    from rest_framework.settings import api_settings

    rates = dict(api_settings.DEFAULT_THROTTLE_RATES, pdf_upload="2/hour")
    settings.REST_FRAMEWORK = {**settings.REST_FRAMEWORK, "DEFAULT_THROTTLE_RATES": rates}
    book = create_book(admin)

    statuses = [upload(admin, book["id"], data=b"").status_code for _ in range(3)]

    assert statuses[-1] == 429


# --- Nashr oqimi ---


def test_cannot_publish_without_file(admin, algebra):
    book = create_book(admin)

    resp = admin.post(f"{BASE}/{book['id']}/transition/", {"to": "published"}, "json")

    assert resp.status_code == 400 and resp.json()["code"] == "no_file"


def test_editor_publishes_but_only_admin_unpublishes(admin, editor, uploaded):
    url = f"{BASE}/{uploaded['id']}/transition/"

    assert editor.post(url, {"to": "published"}, "json").json()["status"] == "published"
    assert editor.post(url, {"to": "draft"}, "json").status_code == 403
    assert admin.post(url, {"to": "draft"}, "json").json()["status"] == "draft"
    assert admin.post(url, {"to": "draft"}, "json").status_code == 400


def test_edit_title_and_cover(admin, uploaded):
    cover = admin.post(
        "/api/v1/admin/uploads/",
        {
            "kind": "cover",
            "file": SimpleUploadedFile("c.png", b"\x89PNG\r\n\x1a\n" + b"0" * 16, "image/png"),
        },
        format="multipart",
    ).json()

    resp = admin.patch(
        f"{BASE}/{uploaded['id']}/",
        {"title": {"uz": "Yangi", "ru": "Новый"}, "cover": cover["path"]},
        "json",
    )

    assert resp.status_code == 200 and resp.json()["title"]["ru"] == "Новый"
    assert resp.json()["cover_url"].endswith(cover["path"].split("/")[-1])
    assert (
        admin.patch(f"{BASE}/{uploaded['id']}/", {"title": {"ru": "x"}}, "json").status_code == 400
    )
    assert admin.patch(f"{BASE}/{uploaded['id']}/", {"grade": 12}, "json").status_code == 400


# --- Ochiq katalog ---


@pytest.fixture
def anon():
    return APIClient()


def test_public_catalog_hides_drafts_and_fileless_books(catalog, anon, algebra):
    published = catalog.pdf_book(algebra, 9, "published", title={"uz": "Algebra 9"})
    catalog.pdf_book(algebra, 9, "draft", title={"uz": "Qoralama"})
    PdfBook.objects.create(
        title={"uz": "Fayl yo'q"}, grade=9, subject=algebra, status="published", page_count=0
    )

    listing = anon.get(f"{PUBLIC}/", {"grade": 9, "subject": "algebra"}).json()

    assert [b["id"] for b in listing["results"]] == [str(published.pk)]
    assert listing["results"][0]["unverified"] is False
    assert anon.get(f"{PUBLIC}/", {"grade": 8}).json()["results"] == []
    assert anon.get(f"{PUBLIC}/", {"q": "algeb"}).json()["count"] == 1
    draft = PdfBook.objects.get(status="draft")
    assert anon.get(f"{PUBLIC}/{draft.pk}/").status_code == 404
    assert anon.get(f"{PUBLIC}/{draft.pk}/file-url/").status_code == 404
    assert anon.get(f"{PUBLIC}/{published.pk}/").json()["page_count"] == 12


def test_show_drafts_publicly_flag_exposes_drafts_as_unverified(catalog, anon, algebra, settings):
    settings.SHOW_DRAFTS_PUBLICLY = True
    draft = catalog.pdf_book(algebra, 9, "draft")

    item = anon.get(f"{PUBLIC}/{draft.pk}/").json()

    assert item["unverified"] is True


def test_staff_sees_drafts_privately(catalog, editor, algebra):
    draft = catalog.pdf_book(algebra, 9, "draft")

    resp = editor.get(f"{PUBLIC}/")

    assert [b["id"] for b in resp.json()["results"]] == [str(draft.pk)]
    assert "no-store" in resp["Cache-Control"]


def test_public_list_is_cached_with_etag_and_invalidated_on_change(
    catalog, anon, algebra, django_capture_on_commit_callbacks
):
    book = catalog.pdf_book(algebra, 9, "published")

    first = anon.get(f"{PUBLIC}/")
    assert "max-age" in first["Cache-Control"]
    assert anon.get(f"{PUBLIC}/", HTTP_IF_NONE_MATCH=first["ETag"]).status_code == 304

    with django_capture_on_commit_callbacks(execute=True):
        book.status = "draft"
        book.save()
    assert anon.get(f"{PUBLIC}/").json()["results"] == []


def test_subjects_with_pdf_books(catalog, anon, algebra):
    geometry = catalog.subject("geometriya")
    catalog.pdf_book(algebra, 9)
    catalog.pdf_book(algebra, 9)
    catalog.pdf_book(geometry, 8)

    nine = anon.get(f"{PUBLIC}/subjects/", {"grade": 9}).json()
    everything = anon.get(f"{PUBLIC}/subjects/").json()

    assert [(s["slug"], s["books_count"]) for s in nine] == [("algebra", 2)]
    assert {s["slug"] for s in everything} == {"algebra", "geometriya"}


def test_list_searches_titles_and_hides_drafts(catalog, anon, algebra):
    catalog.pdf_book(algebra, 9, title={"uz": "Matematika darsligi"})
    catalog.pdf_book(algebra, 9, "draft", title={"uz": "Matematika qoralama"})

    found = anon.get(f"{PUBLIC}/", {"q": "matematika"}).json()

    assert [b["title"]["uz"] for b in found["results"]] == ["Matematika darsligi"]
    assert anon.get(f"{PUBLIC}/", {"q": "yo'q"}).json()["results"] == []
    # Eski mavzu/kitob qidiruvi olib tashlangan
    assert anon.get("/api/v1/search/", {"q": "matematika"}).status_code == 404


# --- Fayl berish (lokal) ---


@pytest.fixture
def served(admin, anon, uploaded):
    admin.post(f"{BASE}/{uploaded['id']}/transition/", {"to": "published"}, "json")
    info = anon.get(f"{PUBLIC}/{uploaded['id']}/file-url/")
    assert info.status_code == 200 and "no-store" in info["Cache-Control"]
    body = info.json()
    assert body["expires_in"] == 15 * 60
    return uploaded["id"], body["url"]


def body_of(resp) -> bytes:
    return b"".join(resp.streaming_content)


def test_file_serves_ranges(anon, served):
    _id, url = served
    full = default_storage.open(PdfBook.objects.get().file.name).read()

    whole = anon.get(url)
    assert whole.status_code == 200 and whole["Accept-Ranges"] == "bytes"
    assert whole["Content-Type"] == "application/pdf" and body_of(whole) == full

    part = anon.get(url, HTTP_RANGE="bytes=0-9")
    assert part.status_code == 206
    assert part["Content-Range"] == f"bytes 0-9/{len(full)}" and part["Content-Length"] == "10"
    assert body_of(part) == full[:10] and full.startswith(b"%PDF-")

    open_ended = anon.get(url, HTTP_RANGE="bytes=100-")
    assert body_of(open_ended) == full[100:] and open_ended.status_code == 206
    assert body_of(anon.get(url, HTTP_RANGE="bytes=-20")) == full[-20:]
    assert anon.get(url, HTTP_RANGE=f"bytes={len(full)}-").status_code == 416
    assert "Cache-Control" in part and "ETag" in part


def test_file_conditional_requests(anon, served):
    _id, url = served
    etag = anon.get(url)["ETag"]

    assert anon.get(url, HTTP_IF_NONE_MATCH=etag).status_code == 304
    stale = anon.get(url, HTTP_RANGE="bytes=0-4", HTTP_IF_RANGE='"other"')
    assert stale.status_code == 200  # If-Range mos emas: butun fayl


def test_file_requires_a_valid_current_token(admin, anon, served):
    book_id, url = served

    assert anon.get(f"{PUBLIC}/{book_id}/file/").status_code == 404
    assert anon.get(f"{PUBLIC}/{book_id}/file/?token=junk").status_code == 404

    upload(admin, book_id, data=make_pdf(pages=2))  # fayl almashdi: eski token yaroqsiz
    assert anon.get(url).status_code == 404


def test_file_token_expires(anon, served, settings):
    _id, url = served
    settings.PDF_SIGNED_URL_SECONDS = -120

    assert anon.get(url).status_code == 404


# --- S3/R2 rejimi (soxta mijoz bilan) ---


remote_temp_files: list = []


@pytest.fixture
def remote(settings, monkeypatch):
    remote_temp_files.clear()
    settings.AWS_STORAGE_BUCKET_NAME = "bucket"
    settings.PDF_UPLOAD_PART_BYTES = 100
    client = MagicMock()
    client.create_multipart_upload.return_value = {"UploadId": "up-1"}
    client.generate_presigned_url.side_effect = lambda op, Params, ExpiresIn: (
        f"https://r2.test/{op}/{Params.get('PartNumber', 0)}?exp={ExpiresIn}"
    )

    def get_object(Bucket, Key, Range):  # noqa: N803
        with default_storage.open(Key, "rb") as handle:
            return {"Body": io.BytesIO(handle.read(8))}

    def download_fileobj(Bucket, Key, Fileobj):  # noqa: N803
        with default_storage.open(Key, "rb") as handle:
            Fileobj.write(handle.read())
        remote_temp_files.append(Fileobj)

    client.get_object.side_effect = get_object
    client.download_fileobj.side_effect = download_fileobj
    monkeypatch.setattr(pdf_storage, "_client", lambda: client)
    return client


def test_direct_upload_plan_and_completion(admin, algebra, remote, settings):
    book = create_book(admin)
    data = make_pdf(pages=4)

    plan = admin.post(
        f"{BASE}/{book['id']}/upload-init/",
        {"filename": "k.pdf", "size": 250, "content_type": "application/pdf"},
        "json",
    ).json()

    assert plan["mode"] == "direct" and plan["part_size"] == 100
    assert len(plan["part_urls"]) == 3 and plan["part_urls"][0].startswith(
        "https://r2.test/upload_part/1"
    )
    assert f"exp={settings.PDF_SIGNED_URL_SECONDS}" in plan["part_urls"][0]
    pending = PdfBook.objects.get(pk=book["id"])
    assert pending.pending_upload_id == "up-1" and pending.pending_file.startswith("pdf-books/")
    assert upload(admin, book["id"]).status_code == 409  # S3 rejimida proxy yuklash yopiq

    default_storage.save(pending.pending_file, ContentFile(data))  # brauzer yuklagan deb faraz
    done = admin.post(
        f"{BASE}/{book['id']}/upload-complete/",
        {"parts": [{"part_number": n, "etag": f'"e{n}"'} for n in (3, 1, 2)]},
        "json",
    )

    assert done.status_code == 200 and done.json()["page_count"] == 4
    assert remote_temp_files and all(
        f.closed for f in remote_temp_files
    )  # vaqtinchalik fayl o'chdi
    kwargs = remote.complete_multipart_upload.call_args.kwargs
    assert [p["PartNumber"] for p in kwargs["MultipartUpload"]["Parts"]] == [1, 2, 3]
    assert PdfBook.objects.get(pk=book["id"]).pending_file == ""


def test_direct_upload_rejects_oversize_and_wrong_declared_type(admin, algebra, remote, settings):
    settings.PDF_BOOK_MAX_BYTES = 1000
    book = create_book(admin)
    url = f"{BASE}/{book['id']}/upload-init/"

    big = admin.post(
        url, {"filename": "k.pdf", "size": 1001, "content_type": "application/pdf"}, "json"
    )
    wrong = admin.post(
        url, {"filename": "k.zip", "size": 10, "content_type": "application/zip"}, "json"
    )

    assert big.status_code == 413 and wrong.status_code == 415
    remote.create_multipart_upload.assert_not_called()


def test_direct_complete_rejects_non_pdf_and_cleans_up(admin, algebra, remote):
    book = create_book(admin)
    admin.post(
        f"{BASE}/{book['id']}/upload-init/",
        {"filename": "k.pdf", "size": 50, "content_type": "application/pdf"},
        "json",
    )
    key = PdfBook.objects.get(pk=book["id"]).pending_file
    default_storage.save(key, ContentFile(b"not a pdf at all, just text"))

    resp = admin.post(
        f"{BASE}/{book['id']}/upload-complete/",
        {"parts": [{"part_number": 1, "etag": '"e"'}]},
        "json",
    )

    assert resp.status_code == 415
    assert not default_storage.exists(key)
    assert PdfBook.objects.get(pk=book["id"]).pending_file == ""


def test_temp_file_is_removed_even_when_pdf_is_invalid(admin, algebra, remote):
    book = create_book(admin)
    admin.post(
        f"{BASE}/{book['id']}/upload-init/",
        {"filename": "k.pdf", "size": 50, "content_type": "application/pdf"},
        "json",
    )
    key = PdfBook.objects.get(pk=book["id"]).pending_file
    default_storage.save(key, ContentFile(b"%PDF-1.4 broken body"))

    resp = admin.post(
        f"{BASE}/{book['id']}/upload-complete/",
        {"parts": [{"part_number": 1, "etag": '"e"'}]},
        "json",
    )

    assert resp.status_code == 400 and resp.json()["code"] == "invalid_pdf"
    assert remote_temp_files and all(f.closed for f in remote_temp_files)


def test_complete_without_init_conflicts(admin, algebra):
    book = create_book(admin)

    resp = admin.post(
        f"{BASE}/{book['id']}/upload-complete/",
        {"parts": [{"part_number": 1, "etag": '"e"'}]},
        "json",
    )

    assert resp.status_code == 409 and resp.json()["code"] == "no_pending_upload"


def test_signed_read_url_is_short_lived(catalog, anon, algebra, remote, settings):
    settings.PDF_SIGNED_URL_SECONDS = 600
    book = catalog.pdf_book(algebra)

    body = anon.get(f"{PUBLIC}/{book.pk}/file-url/").json()

    assert body == {"url": "https://r2.test/get_object/0?exp=600", "expires_in": 600}
    assert anon.get(f"{PUBLIC}/{book.pk}/file/").status_code == 404  # S3'da backend fayl bermaydi


def test_dashboard_counts_pdf_books_and_subjects(editor, catalog, algebra):
    catalog.pdf_book(algebra, 9)
    catalog.pdf_book(algebra, 8, "draft")

    data = editor.get("/api/v1/admin/dashboard/").data

    assert data["pdf_books"] == {"total": 2, "published": 1, "draft": 1}
    assert data["subjects_count"] == 1


def test_admin_subjects_report_pdf_books_count(editor, catalog, algebra):
    catalog.pdf_book(algebra, 9)
    catalog.pdf_book(algebra, 8, "draft")

    rows = editor.get("/api/v1/admin/subjects/").data["results"]

    assert [(row["slug"], row["pdf_books_count"]) for row in rows] == [("algebra", 2)]
