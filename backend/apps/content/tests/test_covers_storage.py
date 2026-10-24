"""Muqova/rasm — ommaviy `covers` saqlash; PDF — shaxsiy `default` (alohida bucket'lar)."""

import io

import pytest
from django.core.files.base import ContentFile
from django.core.files.storage import FileSystemStorage, default_storage, storages
from django.core.files.uploadedfile import SimpleUploadedFile
from PIL import Image

from apps.content import cover_variants
from apps.content.models import CoverMode, PdfBook
from apps.content.pdf_services import delete_book
from apps.content.storage import covers_storage

from .test_admin_api import PDF, client_as

BASE = "/api/v1/admin"
PUBLIC = "/api/v1/pdf-books"
CDN = "https://cdn.test/"


def png() -> bytes:
    out = io.BytesIO()
    Image.new("RGB", (800, 1000), (21, 84, 209)).save(out, format="PNG")
    return out.getvalue()


@pytest.fixture
def split(settings, tmp_path, monkeypatch):
    """`default` va `covers` — ikkita alohida papka; `covers` ommaviy domen bilan URL beradi."""
    settings.AWS_STORAGE_BUCKET_NAME = ""
    private = FileSystemStorage(location=str(tmp_path / "private"), base_url="/private/")
    public = FileSystemStorage(location=str(tmp_path / "public"), base_url=CDN)
    monkeypatch.setattr(default_storage, "_wrapped", private)
    monkeypatch.setitem(storages._storages, "covers", public)
    # `FileField(storage=callable)` saqlashni model yuklanganda bir marta hisoblaydi.
    for name in ("cover", "cover_small", "cover_large"):
        monkeypatch.setattr(PdfBook._meta.get_field(name), "storage", public)
    return private, public


@pytest.fixture
def editor(db):
    return client_as("editor")


def upload(client, kind, name, content, ctype):
    return client.post(
        f"{BASE}/uploads/",
        {"kind": kind, "file": SimpleUploadedFile(name, content, ctype)},
        format="multipart",
    )


@pytest.mark.parametrize("kind", ["cover", "image"])
def test_public_image_uploads_go_to_covers_storage(editor, split, kind):
    private, public = split

    resp = upload(editor, kind, "a.png", png(), "image/png")

    assert resp.status_code == 201
    assert public.exists(resp.data["path"]) and not private.exists(resp.data["path"])
    assert resp.data["url"] == f"{CDN}{resp.data['path']}"


def test_pdf_upload_stays_in_private_default_storage(editor, split):
    private, public = split

    resp = upload(editor, "pdf", "a.pdf", PDF, "application/pdf")

    assert resp.status_code == 201
    assert private.exists(resp.data["path"]) and not public.exists(resp.data["path"])


def test_cover_path_is_validated_against_covers_storage(editor, split, catalog):
    private, public = split
    subject = catalog.subject("algebra")
    book = catalog.pdf_book(subject, status="draft", cover_mode=CoverMode.AUTO)
    in_private = private.save("covers/x.png", ContentFile(png()))
    in_public = public.save("covers/y.png", ContentFile(png()))

    bad = editor.patch(
        f"{BASE}/pdf-books/{book.pk}/", {"cover_mode": "custom", "cover": in_private}, "json"
    )
    ok = editor.patch(
        f"{BASE}/pdf-books/{book.pk}/", {"cover_mode": "custom", "cover": in_public}, "json"
    )

    assert bad.status_code == 400 and ok.status_code == 200


def test_variants_are_read_from_and_written_to_covers_storage(split, catalog):
    private, public = split
    book = catalog.pdf_book(catalog.subject("algebra"), cover_mode=CoverMode.CUSTOM)
    book.cover = public.save("covers/a.png", ContentFile(png()))
    book.save()

    assert cover_variants.generate_variants(book) is True

    book.refresh_from_db()
    assert public.exists(book.cover_small.name) and public.exists(book.cover_large.name)
    assert not private.exists(book.cover_small.name) and not private.exists(book.cover_large.name)


def test_public_api_cover_urls_use_public_domain(split, catalog):
    private, public = split
    book = catalog.pdf_book(catalog.subject("algebra"), cover_mode=CoverMode.CUSTOM)
    book.cover = public.save("covers/a.png", ContentFile(png()))
    book.save()
    cover_variants.generate_variants(book)
    book.refresh_from_db()

    detail = client_as().get(f"{PUBLIC}/{book.pk}/").json()
    listing = client_as().get(f"{PUBLIC}/").json()["results"][0]

    assert detail["cover"] == f"{CDN}covers/a.png"
    assert detail["cover_large"] == f"{CDN}{book.cover_large.name}"
    assert listing["cover_small"] == f"{CDN}{book.cover_small.name}"


def test_delete_book_removes_pdf_from_default_and_covers_from_covers(split, catalog):
    private, public = split
    book = catalog.pdf_book(catalog.subject("algebra"), cover_mode=CoverMode.CUSTOM)
    private.save(book.file.name, ContentFile(PDF))
    book.cover = public.save("covers/a.png", ContentFile(png()))
    book.save()
    cover_variants.generate_variants(book)
    book.refresh_from_db()
    keys = [book.cover.name, book.cover_small.name, book.cover_large.name]

    delete_book(book)

    assert not any(public.exists(key) for key in keys)
    assert not private.exists(book.file.name)
    assert covers_storage() is public
