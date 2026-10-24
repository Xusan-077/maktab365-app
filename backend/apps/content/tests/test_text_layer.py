"""Matn qatlami (kitob ichidan qidiruv) va OCR skeleti."""

import io

import pytest
from django.core.files.base import ContentFile
from django.core.files.storage import default_storage
from django.core.management import call_command
from pypdf import PdfWriter
from pypdf.generic import DecodedStreamObject, DictionaryObject, NameObject
from rest_framework.test import APIClient

from apps.content import ocr, text_layer
from apps.content.models import OcrStatus, PdfBook

from .test_admin_api import client_as
from .test_pdf_books import BASE, create_book, make_pdf

LINE = b"Chiziqli funksiya va uning grafigi: y = kx + b ko'rinishidagi funksiya"


def text_pdf(text_pages=4, blank_pages=0) -> bytes:
    """Helvetica bilan yozilgan matnli sahifalar (+ ixtiyoriy bo'sh "skan" sahifalar)."""
    writer = PdfWriter()
    font = writer._add_object(
        DictionaryObject(
            {
                NameObject("/Type"): NameObject("/Font"),
                NameObject("/Subtype"): NameObject("/Type1"),
                NameObject("/BaseFont"): NameObject("/Helvetica"),
            }
        )
    )
    for _ in range(text_pages):
        page = writer.add_blank_page(width=612, height=792)
        page[NameObject("/Resources")] = DictionaryObject(
            {NameObject("/Font"): DictionaryObject({NameObject("/F1"): font})}
        )
        stream = DecodedStreamObject()
        stream.set_data(b"BT /F1 12 Tf 72 700 Td (" + LINE + b") Tj ET")
        page[NameObject("/Contents")] = writer._add_object(stream)
    for _ in range(blank_pages):
        writer.add_blank_page(width=612, height=792)
    out = io.BytesIO()
    writer.write(out)
    return out.getvalue()


@pytest.fixture(autouse=True)
def local_storage(settings, tmp_path):
    settings.AWS_STORAGE_BUCKET_NAME = ""
    settings.MEDIA_ROOT = tmp_path


@pytest.fixture
def admin(db):
    return client_as("admin")


@pytest.fixture
def algebra(catalog):
    return catalog.subject("algebra")


def upload_bytes(client, book_id, data: bytes):
    from django.core.files.uploadedfile import SimpleUploadedFile

    file = SimpleUploadedFile("darslik.pdf", data, "application/pdf")
    return client.post(f"{BASE}/{book_id}/upload/", {"file": file}, format="multipart")


# --- Aniqlash (sof) ---


def test_detect_text_and_scanned_pdfs():
    assert text_layer.detect(io.BytesIO(text_pdf(5))) is True
    assert text_layer.detect(io.BytesIO(make_pdf(30))) is False
    # Bitta matnli sahifa (masalan, titul) skanerlangan kitobni "matnli" qilmaydi.
    assert text_layer.detect(io.BytesIO(text_pdf(1, 40))) is False
    assert text_layer.detect(io.BytesIO(text_pdf(20, 20))) is True


def test_sample_indexes_spread_over_the_book():
    assert text_layer.sample_indexes(3) == [0, 1, 2]
    sample = text_layer.sample_indexes(300)
    assert len(sample) == 12 and sample[0] < 25 and sample[-1] > 275


# --- Yuklash → Celery ---


@pytest.mark.parametrize(("data", "expected"), [(text_pdf(4), True), (make_pdf(4), False)])
def test_upload_detects_text_layer(
    admin, algebra, django_capture_on_commit_callbacks, data, expected
):
    book = create_book(admin)
    with django_capture_on_commit_callbacks(execute=True):
        assert upload_bytes(admin, book["id"], data).status_code == 200

    assert PdfBook.objects.get(pk=book["id"]).has_text_layer is expected
    detail = admin.get(f"{BASE}/{book['id']}/").json()
    assert detail["has_text_layer"] is expected


def test_replacing_the_file_resets_text_layer_and_ocr(admin, algebra):
    book = create_book(admin)
    upload_bytes(admin, book["id"], text_pdf(4))
    PdfBook.objects.filter(pk=book["id"]).update(
        has_text_layer=False, ocr_status=OcrStatus.FAILED, ocr_error="ocr_failed"
    )

    upload_bytes(admin, book["id"], text_pdf(4))  # on_commit bajarilmaydi: faqat qayta tiklash

    fresh = PdfBook.objects.get(pk=book["id"])
    assert fresh.has_text_layer is None
    assert (fresh.ocr_status, fresh.ocr_error) == (OcrStatus.NONE, "")


def test_public_detail_exposes_text_layer(catalog, algebra):
    book = catalog.pdf_book(algebra, 9)
    PdfBook.objects.filter(pk=book.pk).update(has_text_layer=False)

    body = APIClient().get(f"/api/v1/pdf-books/{book.pk}/").json()

    assert body["has_text_layer"] is False


def test_command_checks_existing_books(catalog, algebra):
    scanned = catalog.pdf_book(
        algebra, 9, file=default_storage.save("pdf-books/a.pdf", ContentFile(make_pdf(5)))
    )
    texted = catalog.pdf_book(
        algebra, 9, file=default_storage.save("pdf-books/b.pdf", ContentFile(text_pdf(5)))
    )
    broken = catalog.pdf_book(algebra, 9, file="pdf-books/missing.pdf")
    out = io.StringIO()

    call_command("detect_text_layers", "--missing-only", stdout=out, stderr=io.StringIO())

    values = dict(PdfBook.objects.values_list("pk", "has_text_layer"))
    assert values[scanned.pk] is False
    assert values[texted.pk] is True
    assert values[broken.pk] is None
    assert "Matn bor: 1, yo'q: 1, o'qilmadi: 1" in out.getvalue()


def test_command_dry_run_writes_nothing(catalog, algebra):
    book = catalog.pdf_book(
        algebra, 9, file=default_storage.save("pdf-books/c.pdf", ContentFile(make_pdf(2)))
    )

    call_command("detect_text_layers", "--dry-run", stdout=io.StringIO())

    assert PdfBook.objects.get(pk=book.pk).has_text_layer is None


# --- OCR skeleti ---


@pytest.fixture
def scanned(catalog, algebra):
    book = catalog.pdf_book(algebra, 9)
    PdfBook.objects.filter(pk=book.pk).update(has_text_layer=False)
    return book


def ocr_url(book) -> str:
    return f"{BASE}/{book.pk}/ocr/"


def test_ocr_is_disabled_by_default(admin, scanned, settings):
    settings.OCR_ENABLED = False

    resp = admin.post(ocr_url(scanned))

    assert resp.status_code == 503 and resp.json()["code"] == "ocr_disabled"
    assert admin.get(f"{BASE}/{scanned.pk}/").json()["ocr_available"] is False


def test_ocr_requires_staff(scanned, settings):
    settings.OCR_ENABLED = True

    assert client_as("student").post(ocr_url(scanned)).status_code == 403


def test_ocr_flow_skeleton_ends_with_not_implemented(
    admin, scanned, settings, django_capture_on_commit_callbacks
):
    settings.OCR_ENABLED = True

    with django_capture_on_commit_callbacks(execute=False) as callbacks:
        resp = admin.post(ocr_url(scanned))
    assert resp.status_code == 202
    assert resp.json()["ocr_status"] == "queued"
    assert admin.post(ocr_url(scanned)).json()["code"] == "ocr_in_progress"

    for callback in callbacks:  # worker (eager) task'ni bajaradi
        callback()

    fresh = PdfBook.objects.get(pk=scanned.pk)
    assert (fresh.ocr_status, fresh.ocr_error) == (OcrStatus.FAILED, "ocr_not_implemented")
    assert fresh.ocr_updated_at is not None
    # Muvaffaqiyatsizdan keyin qayta so'rash mumkin.
    with django_capture_on_commit_callbacks(execute=False):
        assert admin.post(ocr_url(scanned)).status_code == 202


def test_ocr_rejects_books_with_text_or_without_file(admin, catalog, algebra, settings):
    settings.OCR_ENABLED = True
    with_text = catalog.pdf_book(algebra, 9)
    PdfBook.objects.filter(pk=with_text.pk).update(has_text_layer=True)
    no_file = catalog.pdf_book(algebra, 9, file="")

    assert admin.post(ocr_url(with_text)).json()["code"] == "ocr_not_needed"
    assert admin.post(ocr_url(no_file)).json()["code"] == "no_file"


def test_worker_ignores_books_that_are_not_queued(scanned):
    ocr.run(scanned.pk)

    assert PdfBook.objects.get(pk=scanned.pk).ocr_status == OcrStatus.NONE
