"""PDF belgilari (highlight + eslatma): CRUD, egalik, tekshiruvlar, mehmon ma'lumotini qo'shish."""

import uuid

import pytest
from rest_framework.test import APIClient

from apps.learning.models import PdfAnnotation

from .conftest import Catalog

pytestmark = pytest.mark.django_db

LIST = "/api/v1/me/pdf-annotations/"
MERGE = "/api/v1/me/merge-guest-data/"
RECT = {"x": 0.1, "y": 0.2, "w": 0.5, "h": 0.05}


@pytest.fixture
def catalog(db):
    return Catalog()


@pytest.fixture
def book(catalog):
    return catalog.pdf_book(catalog.subject("algebra"), 9, pages=20)


def payload(book, **over):
    return {
        "pdf_book_id": str(book.pk),
        "page": 3,
        "color": "green",
        "rects": [RECT],
        "note": "Muhim formula",
        **over,
    }


def put(api, book, annotation_id=None, **over):
    annotation_id = annotation_id or uuid.uuid4()
    return api.put(f"{LIST}{annotation_id}/", payload(book, **over), "json"), annotation_id


def test_requires_login(book):
    assert APIClient().get(LIST, {"pdf_book": str(book.pk)}).status_code == 401
    assert APIClient().put(f"{LIST}{uuid.uuid4()}/", payload(book), "json").status_code == 401


def test_put_creates_then_updates_idempotently(api, book):
    resp, annotation_id = put(api, book)
    assert resp.status_code == 200
    assert resp.json()["color"] == "green" and resp.json()["rects"] == [RECT]

    again, _ = put(api, book, annotation_id, color="pink", note="Yangilandi")
    assert again.status_code == 200
    assert PdfAnnotation.objects.count() == 1
    row = PdfAnnotation.objects.get()
    assert (row.color, row.note) == ("pink", "Yangilandi")

    listed = api.get(LIST, {"pdf_book": str(book.pk)}).json()
    assert [a["id"] for a in listed] == [str(annotation_id)]


def test_validation(api, book):
    assert put(api, book, page=21)[0].json()["details"]["page"] == ["page_out_of_range"]
    assert put(api, book, color="red")[0].status_code == 400
    assert put(api, book, rects=[])[0].status_code == 400
    assert put(api, book, rects=[{**RECT, "x": 1.5}])[0].status_code == 400
    assert put(api, book, rects=[{**RECT, "w": 0}])[0].status_code == 400
    assert put(api, book, note="x" * 201)[0].status_code == 400
    assert put(api, book, pdf_book_id=str(uuid.uuid4()))[0].status_code == 404
    assert PdfAnnotation.objects.count() == 0


def test_ownership_is_isolated(api, other_api, book):
    _, annotation_id = put(api, book)
    # Boshqa foydalanuvchi shu id bilan yoza olmaydi va ko'rmaydi
    assert other_api.put(f"{LIST}{annotation_id}/", payload(book), "json").status_code == 404
    assert other_api.get(LIST, {"pdf_book": str(book.pk)}).json() == []
    other_api.delete(f"{LIST}{annotation_id}/")
    assert PdfAnnotation.objects.filter(pk=annotation_id).exists()


def test_delete_is_idempotent(api, book):
    _, annotation_id = put(api, book)
    assert api.delete(f"{LIST}{annotation_id}/").status_code == 204
    assert api.delete(f"{LIST}{annotation_id}/").status_code == 204
    assert PdfAnnotation.objects.count() == 0


def test_list_requires_visible_book(api, catalog):
    draft = catalog.pdf_book(catalog.subject("fizika"), 9, status="draft")
    assert api.get(LIST, {"pdf_book": str(draft.pk)}).status_code == 404
    assert api.get(LIST).status_code == 404


def test_merge_adds_guest_annotations_once(api, book):
    guest_id = str(uuid.uuid4())
    body = {"pdf_annotations": [{"id": guest_id, **payload(book)}]}
    first = api.post(MERGE, body, "json").json()
    second = api.post(MERGE, body, "json").json()
    assert first["pdf_annotations"] == 1 and second["pdf_annotations"] == 0
    assert PdfAnnotation.objects.count() == 1


def test_merge_reports_invalid_annotations_as_failed(api, book):
    ghost = str(uuid.uuid4())
    body = {
        "pdf_annotations": [
            {"id": str(uuid.uuid4()), **payload(book, pdf_book_id=ghost)},
            {"id": str(uuid.uuid4()), **payload(book, page=999)},
        ]
    }
    result = api.post(MERGE, body, "json").json()
    assert result["pdf_annotations"] == 0
    assert ghost in result["failed"] and str(book.pk) in result["failed"]
