"""Watermark: ekran nusxasi diagonal yozuvsiz, yuklab olish nusxasida kichik burchak yozuvi."""

import io

import pytest
from django.core.files.base import ContentFile
from django.core.files.storage import default_storage
from django.core.management import call_command
from pypdf import PdfReader, PdfWriter
from pypdf.generic import (
    ArrayObject,
    DecodedStreamObject,
    DictionaryObject,
    NameObject,
    NumberObject,
)
from rest_framework.test import APIClient

from apps.content import pdf_files, pdf_stamp
from apps.content.models import PdfBook

from .test_admin_api import client_as
from .test_pdf_books import BASE, create_book

BODY = b"BT /F1 12 Tf 72 700 Td (Kvadrat tenglama: ax^2 + bx + c = 0 ko'rinishidagi tenglama) Tj ET"


def _font(writer):
    return writer._add_object(
        DictionaryObject(
            {
                NameObject("/Type"): NameObject("/Font"),
                NameObject("/Subtype"): NameObject("/Type1"),
                NameObject("/BaseFont"): NameObject("/Helvetica"),
            }
        )
    )


def _stream(writer, data: bytes):
    stream = DecodedStreamObject()
    stream.set_data(data)
    return writer._add_object(stream)


def baked_pdf(pages=3, rotate=0, watermark=True) -> bytes:
    """Sayt tashqarisida (PyMuPDF) qo'shilgan diagonal watermark'li PDF: oxirgi kontent bo'lagi
    `q /fzFrm0 Do Q`, forma ichida "darslik365.uz"."""
    writer = PdfWriter()
    font = _font(writer)
    form = DecodedStreamObject()
    form.set_data(b"BT /F1 40 Tf 0 0 Td (darslik365.uz) Tj ET")
    form.update(
        {
            NameObject("/Type"): NameObject("/XObject"),
            NameObject("/Subtype"): NameObject("/Form"),
            NameObject("/BBox"): ArrayObject([NumberObject(v) for v in (0, 0, 300, 60)]),
            NameObject("/Resources"): DictionaryObject(
                {NameObject("/Font"): DictionaryObject({NameObject("/F1"): font})}
            ),
        }
    )
    form_ref = writer._add_object(form)
    for _ in range(pages):
        page = writer.add_blank_page(width=612, height=792)
        if rotate:
            page[NameObject("/Rotate")] = NumberObject(rotate)
        resources = {NameObject("/Font"): DictionaryObject({NameObject("/F1"): font})}
        items = [_stream(writer, b" q "), _stream(writer, BODY), _stream(writer, b" Q ")]
        if watermark:
            resources[NameObject("/XObject")] = DictionaryObject({NameObject("/fzFrm0"): form_ref})
            items.append(_stream(writer, b" q /fzFrm0 Do Q "))
        page[NameObject("/Resources")] = DictionaryObject(resources)
        page[NameObject("/Contents")] = ArrayObject(items)
    out = io.BytesIO()
    writer.write(out)
    return out.getvalue()


def prepared(data: bytes) -> tuple[int, PdfReader | None, PdfReader]:
    view, download = io.BytesIO(), io.BytesIO()
    cleaned = pdf_stamp.prepare(io.BytesIO(data), view, download)
    view_reader = PdfReader(io.BytesIO(view.getvalue())) if cleaned else None
    return cleaned, view_reader, PdfReader(io.BytesIO(download.getvalue()))


def texts(reader: PdfReader) -> list[str]:
    return [page.extract_text() or "" for page in reader.pages]


# --- Sof (DB'siz) ---


def test_baked_diagonal_watermark_is_removed_and_text_kept():
    cleaned, view, download = prepared(baked_pdf(pages=3))

    assert cleaned == 3
    assert all("darslik365" not in text and "Kvadrat tenglama" in text for text in texts(view))
    assert len(view.pages) == 3
    # Yuklab olish nusxasida diagonal yo'q, faqat burchakdagi kichik yozuv (bir marta).
    assert all(text.count("darslik365.uz") == 1 for text in texts(download))


def test_clean_pdf_is_not_rewritten_but_download_gets_the_corner_mark():
    cleaned, view, download = prepared(baked_pdf(pages=2, watermark=False))

    assert cleaned == 0 and view is None
    assert all("darslik365.uz" in text and "Kvadrat" in text for text in texts(download))


def test_only_the_pymupdf_overlay_pattern_is_removed():
    # Oxirgi bo'lak boshqa narsa (matn) bo'lsa — tegilmaydi.
    writer = PdfWriter()
    font = _font(writer)
    page = writer.add_blank_page(width=200, height=200)
    page[NameObject("/Resources")] = DictionaryObject(
        {NameObject("/Font"): DictionaryObject({NameObject("/F1"): font})}
    )
    page[NameObject("/Contents")] = ArrayObject(
        [_stream(writer, BODY), _stream(writer, b"BT /F1 9 Tf 10 10 Td (darslik365.uz) Tj ET")]
    )
    assert pdf_stamp.strip_baked_watermark(writer) == 0


def _corner_matrix(reader: PdfReader, index: int = 0) -> list[float]:
    data = reader.pages[index]["/Contents"][-1].get_object().get_data().decode()
    return [float(value) for value in data.split(" Tf ")[1].split(" Tm")[0].split()]


@pytest.mark.parametrize(
    ("rotate", "direction", "corner"),
    [
        # (a, b) — matn yo'nalishi; (e, f) — boshlanish nuqtasi (612×792 sahifa).
        (0, (1, 0), lambda e, f: e > 500 and f < 30),
        (90, (0, 1), lambda e, f: e > 580 and f > 700),
        (180, (-1, 0), lambda e, f: e < 110 and f > 760),
        (270, (0, -1), lambda e, f: e < 30 and f < 110),
    ],
)
def test_corner_mark_follows_page_rotation(rotate, direction, corner):
    _cleaned, _view, download = prepared(baked_pdf(pages=1, rotate=rotate))
    a, b, _c, _d, e, f = _corner_matrix(download)

    assert (a, b) == direction
    assert corner(e, f), (e, f)


def test_corner_mark_is_small_and_translucent():
    assert pdf_stamp.FONT_SIZE <= 8
    assert pdf_stamp.OPACITY <= 0.6
    assert pdf_stamp.TEXT_WIDTH < 50


# --- Yuklash → Celery → yuklab olish ---


@pytest.fixture(autouse=True)
def local_storage(settings, tmp_path):
    settings.AWS_STORAGE_BUCKET_NAME = ""
    settings.MEDIA_ROOT = tmp_path


def upload(client, book_id, data: bytes):
    from django.core.files.uploadedfile import SimpleUploadedFile

    file = SimpleUploadedFile("darslik.pdf", data, "application/pdf")
    return client.post(f"{BASE}/{book_id}/upload/", {"file": file}, format="multipart")


def read_stored(key: str) -> PdfReader:
    with default_storage.open(key, "rb") as handle:
        return PdfReader(io.BytesIO(handle.read()))


@pytest.mark.django_db
def test_upload_cleans_view_file_and_download_serves_the_marked_copy(
    catalog, django_capture_on_commit_callbacks
):
    catalog.subject("algebra")
    admin = client_as("admin")
    book = create_book(admin)
    with django_capture_on_commit_callbacks(execute=True):
        assert upload(admin, book["id"], baked_pdf(pages=3)).status_code == 200

    stored = PdfBook.objects.get(pk=book["id"])
    assert stored.download_file and stored.file.name != stored.download_file.name
    assert all("darslik365" not in text for text in texts(read_stored(stored.file.name)))
    assert all("darslik365.uz" in text for text in texts(read_stored(stored.download_file.name)))
    assert stored.has_text_layer is True  # tekshiruv tozalangan faylda bajarildi

    admin.post(f"{BASE}/{book['id']}/transition/", {"to": "published"}, "json")
    anon = APIClient()
    reading = anon.get(f"/api/v1/pdf-books/{book['id']}/file-url/").json()["url"]
    downloading = anon.get(f"/api/v1/pdf-books/{book['id']}/download/").json()["url"]
    view_bytes = b"".join(anon.get(reading).streaming_content)
    download_bytes = b"".join(anon.get(downloading).streaming_content)
    assert "darslik365" not in texts(PdfReader(io.BytesIO(view_bytes)))[0]
    assert "darslik365.uz" in texts(PdfReader(io.BytesIO(download_bytes)))[0]


@pytest.mark.django_db
def test_replacing_the_file_drops_the_old_download_copy(
    catalog, django_capture_on_commit_callbacks
):
    catalog.subject("algebra")
    admin = client_as("admin")
    book = create_book(admin)
    with django_capture_on_commit_callbacks(execute=True):
        upload(admin, book["id"], baked_pdf(pages=2))
    first = PdfBook.objects.get(pk=book["id"]).download_file.name

    with django_capture_on_commit_callbacks(execute=True):
        upload(admin, book["id"], baked_pdf(pages=4, watermark=False))

    fresh = PdfBook.objects.get(pk=book["id"])
    assert fresh.download_file.name != first and not default_storage.exists(first)
    assert len(read_stored(fresh.download_file.name).pages) == 4


@pytest.mark.django_db
def test_prepare_skips_when_the_file_changed_meanwhile(catalog, monkeypatch):
    subject = catalog.subject("algebra")
    key = default_storage.save("pdf-books/old.pdf", ContentFile(baked_pdf(pages=1)))
    book = catalog.pdf_book(subject, 9, file=key)
    real_save = pdf_files.storage.save_local_file

    def swap_then_save(target, path):
        PdfBook.objects.filter(pk=book.pk).update(file="pdf-books/other.pdf")
        real_save(target, path)

    monkeypatch.setattr(pdf_files.storage, "save_local_file", swap_then_save)

    assert pdf_files.prepare_book(book.pk) is None
    assert PdfBook.objects.get(pk=book.pk).download_file.name == ""


@pytest.mark.django_db
def test_command_prepares_existing_books(catalog):
    subject = catalog.subject("algebra")
    baked = catalog.pdf_book(
        subject, 9, file=default_storage.save("pdf-books/a.pdf", ContentFile(baked_pdf(2)))
    )
    clean = catalog.pdf_book(
        subject,
        9,
        file=default_storage.save("pdf-books/b.pdf", ContentFile(baked_pdf(2, watermark=False))),
    )
    out = io.StringIO()

    call_command("prepare_pdf_files", "--missing-only", stdout=out, stderr=io.StringIO())

    assert "Tayyor: 2 (watermark tozalangan: 1), xato: 0" in out.getvalue()
    assert PdfBook.objects.get(pk=baked.pk).file.name != baked.file.name
    assert PdfBook.objects.get(pk=clean.pk).file.name == clean.file.name
    assert all(
        PdfBook.objects.filter(pk__in=[baked.pk, clean.pk]).values_list("download_file", flat=True)
    )
