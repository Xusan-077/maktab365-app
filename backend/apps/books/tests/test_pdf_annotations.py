"""Maktab darsligi (PdfBook) yozuvlari: Kutubxona bilan bir xil `/me/books/<id>/...` manzillari."""

import pytest

from apps.books.models import PdfPageAnnotation, PdfPageNote
from apps.content.tests.conftest import catalog  # noqa: F401, F811
from apps.learning.tests.conftest import client_for, make_user

pytestmark = pytest.mark.django_db

ME = "/api/v1/me/books"


def drawing():
    return {
        "tool": "pen",
        "color": "#e5484d",
        "width": 0.004,
        "points": [[0.1, 0.1, 0.5], [0.2, 0.25, 0.6], [0.3, 0.2]],
    }


@pytest.fixture
def textbook(catalog):  # noqa: F811
    return catalog.pdf_book(catalog.subject(), pages=5)


@pytest.fixture
def reader():
    return client_for(make_user("pdf-annot@example.com"))


def put_page(client, book, page, items):
    return client.put(
        f"{ME}/{book.pk}/pages/{page}/annotations/", {"annotations": items}, format="json"
    )


def test_drawing_on_textbook_is_saved_and_listed(reader, textbook):
    response = put_page(reader, textbook, 2, [{"type": "drawing", "data": drawing()}])
    assert response.status_code == 200
    assert PdfPageAnnotation.objects.filter(pdf_book=textbook, page=2).count() == 1

    listed = reader.get(f"{ME}/{textbook.pk}/annotations/", {"pages": "1,2"}).json()
    assert [row["page"] for row in listed] == [2]
    assert listed[0]["type"] == "drawing"


def test_replace_removes_dropped_annotations(reader, textbook):
    first = put_page(reader, textbook, 1, [{"type": "drawing", "data": drawing()}]).json()
    kept = first[0]["id"]
    put_page(
        reader,
        textbook,
        1,
        [
            {"id": kept, "type": "drawing", "data": drawing()},
            {
                "type": "text",
                "data": {"x": 0.3, "y": 0.4, "text": "Muhim", "color": "ink", "size": 0.03},
            },
        ],
    )
    assert PdfPageAnnotation.objects.filter(pdf_book=textbook, page=1).count() == 2
    put_page(reader, textbook, 1, [])
    assert PdfPageAnnotation.objects.filter(pdf_book=textbook, page=1).count() == 0


def test_page_beyond_textbook_is_rejected(reader, textbook):
    response = put_page(reader, textbook, 99, [])
    assert response.status_code == 400


def test_solution_type_is_not_allowed_on_textbook(reader, textbook):
    solution = {
        "rect": {"x": 0.1, "y": 0.1, "w": 0.3, "h": 0.1},
        "title": "1-misol",
        "body": "$x=2$",
    }
    response = put_page(reader, textbook, 1, [{"type": "solution", "data": solution}])
    assert response.status_code == 400


def test_annotations_are_private_to_their_owner(reader, textbook):
    put_page(reader, textbook, 1, [{"type": "drawing", "data": drawing()}])
    stranger = client_for(make_user("stranger@example.com"))
    assert stranger.get(f"{ME}/{textbook.pk}/annotations/", {"pages": "1"}).json() == []


def test_draft_textbook_is_hidden_from_students(reader, catalog):  # noqa: F811
    draft = catalog.pdf_book(catalog.subject("draft"), status="draft")
    assert reader.get(f"{ME}/{draft.pk}/annotations/", {"pages": "1"}).status_code == 404


def test_notes_work_for_textbook(reader, textbook):
    url = f"{ME}/{textbook.pk}/pages/3/notes/"
    assert reader.get(url).json() == {"page": 3, "text": "", "updated_at": None}
    assert reader.put(url, {"text": "Takrorlash kerak"}, format="json").status_code == 200
    assert reader.get(url).json()["text"] == "Takrorlash kerak"
    assert PdfPageNote.objects.filter(pdf_book=textbook, page=3).count() == 1
    reader.put(url, {"text": ""}, format="json")
    assert PdfPageNote.objects.filter(pdf_book=textbook).count() == 0


def test_unknown_book_is_404(reader):
    assert (
        reader.get(
            f"{ME}/00000000-0000-0000-0000-000000000000/annotations/", {"pages": "1"}
        ).status_code
        == 404
    )


def test_marker_stroke_is_saved_with_its_tool(reader, textbook):
    marker = {**drawing(), "tool": "marker", "color": "#fde047", "width": 0.02}
    response = put_page(reader, textbook, 3, [{"type": "drawing", "data": marker}])
    assert response.status_code == 200
    saved = PdfPageAnnotation.objects.get(pdf_book=textbook, page=3)
    assert saved.data["tool"] == "marker"
    assert saved.data["width"] == 0.02
