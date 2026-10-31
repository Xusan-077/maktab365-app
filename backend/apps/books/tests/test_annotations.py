"""Bet yozuvlari (yon daftar) va annotatsiyalar: egalik, validatsiya, hajm chegaralari."""

import uuid

import pytest

from apps.books import annotation_validation as validation
from apps.books.models import PageAnnotation, PageNote
from apps.learning.tests.conftest import client_for, make_user

from .test_books import make_book, ready_book

pytestmark = pytest.mark.django_db

ME = "/api/v1/me/books"


def drawing(points=None, **over):
    data = {
        "tool": "pen",
        "color": "#e5484d",
        "width": 0.004,
        "points": points if points is not None else [[0.1, 0.1, 0.5], [0.2, 0.25, 0.6], [0.3, 0.2]],
    }
    return {**data, **over}


def highlight(**over):
    return {"color": "#fde047", "rects": [{"x": 0.1, "y": 0.2, "w": 0.5, "h": 0.04}], **over}


def text(**over):
    return {"x": 0.3, "y": 0.4, "text": "Muhim!", "color": "ink", "size": 0.03, **over}


@pytest.fixture
def reader():
    return client_for(make_user("annot@example.com"))


@pytest.fixture
def book():
    return ready_book()


def put_page(client, book, page, items):
    return client.put(
        f"{ME}/{book.pk}/pages/{page}/annotations/", {"annotations": items}, format="json"
    )


class TestNotes:
    def test_requires_login(self, anon, book):
        assert anon.get(f"{ME}/{book.pk}/pages/1/notes/").status_code in (401, 403)
        assert anon.put(f"{ME}/{book.pk}/pages/1/notes/", {"text": "x"}).status_code in (401, 403)

    def test_empty_note_is_returned_for_unwritten_page(self, reader, book):
        body = reader.get(f"{ME}/{book.pk}/pages/1/notes/").json()
        assert body == {"page": 1, "text": "", "updated_at": None}

    def test_put_saves_updates_and_get_returns(self, reader, book):
        url = f"{ME}/{book.pk}/pages/2/notes/"
        assert reader.put(url, {"text": "Birinchi"}, format="json").status_code == 200
        reader.put(url, {"text": "Ikkinchi"}, format="json")
        assert reader.get(url).json()["text"] == "Ikkinchi"
        assert PageNote.objects.count() == 1

    def test_blank_text_deletes_the_note(self, reader, book):
        url = f"{ME}/{book.pk}/pages/1/notes/"
        reader.put(url, {"text": "bor"}, format="json")
        assert reader.put(url, {"text": "  \n"}, format="json").json()["text"] == ""
        assert not PageNote.objects.exists()

    def test_notes_are_private(self, reader, book):
        other = client_for(make_user("other-note@example.com"))
        reader.put(f"{ME}/{book.pk}/pages/1/notes/", {"text": "sir"}, format="json")
        assert other.get(f"{ME}/{book.pk}/pages/1/notes/").json()["text"] == ""
        other.put(f"{ME}/{book.pk}/pages/1/notes/", {"text": "boshqa"}, format="json")
        assert reader.get(f"{ME}/{book.pk}/pages/1/notes/").json()["text"] == "sir"

    def test_page_out_of_range_and_too_long(self, reader, book):
        assert reader.get(f"{ME}/{book.pk}/pages/3/notes/").status_code == 400
        long_text = "a" * (validation.NOTE_MAX + 1)
        response = reader.put(f"{ME}/{book.pk}/pages/1/notes/", {"text": long_text}, format="json")
        assert response.status_code == 400

    def test_unpublished_book_is_hidden_from_readers(self, reader):
        hidden = make_book(is_published=False)
        assert reader.get(f"{ME}/{hidden.pk}/pages/1/notes/").status_code == 404


class TestPageReplace:
    def test_saves_all_three_types_and_lists_them(self, reader, book):
        ids = [str(uuid.uuid4()) for _ in range(3)]
        response = put_page(
            reader,
            book,
            1,
            [
                {"id": ids[0], "type": "drawing", "data": drawing()},
                {"id": ids[1], "type": "highlight", "data": highlight()},
                {"id": ids[2], "type": "text", "data": text()},
            ],
        )
        assert response.status_code == 200
        assert [row["id"] for row in response.json()] == ids
        listed = reader.get(f"{ME}/{book.pk}/annotations/?page=1").json()
        assert [row["type"] for row in listed] == ["drawing", "highlight", "text"]
        assert listed[0]["data"]["points"][0] == [0.1, 0.1, 0.5]

    def test_replace_removes_missing_and_keeps_ids_stable(self, reader, book):
        first, second = str(uuid.uuid4()), str(uuid.uuid4())
        put_page(
            reader,
            book,
            1,
            [
                {"id": first, "type": "text", "data": text()},
                {"id": second, "type": "highlight", "data": highlight()},
            ],
        )
        created_at = PageAnnotation.objects.get(pk=first).created_at
        put_page(reader, book, 1, [{"id": first, "type": "text", "data": text(text="Yangi")}])
        rows = PageAnnotation.objects.filter(book=book)
        assert [str(row.pk) for row in rows] == [first]
        assert rows[0].data["text"] == "Yangi"
        assert rows[0].created_at == created_at

    def test_resending_is_idempotent(self, reader, book):
        items = [{"id": str(uuid.uuid4()), "type": "drawing", "data": drawing()}]
        put_page(reader, book, 1, items)
        put_page(reader, book, 1, items)
        assert PageAnnotation.objects.count() == 1

    def test_empty_list_clears_the_page_only(self, reader, book):
        put_page(reader, book, 1, [{"type": "text", "data": text()}])
        put_page(reader, book, 2, [{"type": "text", "data": text()}])
        put_page(reader, book, 1, [])
        assert list(PageAnnotation.objects.values_list("page", flat=True)) == [2]

    def test_missing_id_is_assigned_by_server(self, reader, book):
        response = put_page(reader, book, 1, [{"type": "text", "data": text()}])
        assert uuid.UUID(response.json()[0]["id"])

    def test_duplicate_ids_are_rejected(self, reader, book):
        same = str(uuid.uuid4())
        response = put_page(
            reader,
            book,
            1,
            [{"id": same, "type": "text", "data": text()}] * 2,
        )
        assert response.status_code == 400

    def test_id_owned_by_someone_else_is_a_conflict(self, reader, book):
        other = client_for(make_user("owner@example.com"))
        taken = str(uuid.uuid4())
        put_page(other, book, 1, [{"id": taken, "type": "text", "data": text()}])
        response = put_page(reader, book, 1, [{"id": taken, "type": "text", "data": text()}])
        assert response.status_code == 400
        assert response.json()["details"]["annotations"] == ["id_conflict"]
        assert PageAnnotation.objects.get(pk=taken).user.email == "owner@example.com"

    def test_requires_login(self, anon, book):
        assert put_page(anon, book, 1, []).status_code in (401, 403)

    def test_page_out_of_range(self, reader, book):
        assert put_page(reader, book, 3, []).status_code == 400

    def test_replacing_does_not_touch_other_users(self, reader, book):
        other = client_for(make_user("neighbour@example.com"))
        put_page(other, book, 1, [{"type": "text", "data": text()}])
        put_page(reader, book, 1, [])
        assert PageAnnotation.objects.filter(user__email="neighbour@example.com").count() == 1


class TestOwnership:
    def test_list_shows_only_own_annotations(self, reader, book):
        other = client_for(make_user("snoop@example.com"))
        put_page(reader, book, 1, [{"type": "text", "data": text()}])
        assert other.get(f"{ME}/{book.pk}/annotations/?page=1").json() == []

    def test_foreign_annotation_is_404_for_patch_and_delete(self, reader, book):
        other = client_for(make_user("thief@example.com"))
        annotation_id = put_page(reader, book, 1, [{"type": "text", "data": text()}]).json()[0][
            "id"
        ]
        url = f"{ME}/{book.pk}/annotations/{annotation_id}/"
        assert other.patch(url, {"data": text(text="x")}, format="json").status_code == 404
        assert other.delete(url).status_code == 404
        assert PageAnnotation.objects.filter(pk=annotation_id).exists()

    def test_requires_login(self, anon, book):
        assert anon.get(f"{ME}/{book.pk}/annotations/?page=1").status_code in (401, 403)
        assert anon.post(f"{ME}/{book.pk}/annotations/", {}, format="json").status_code in (
            401,
            403,
        )


class TestSingleEndpoints:
    def test_create_patch_delete(self, reader, book):
        url = f"{ME}/{book.pk}/annotations/"
        new_id = str(uuid.uuid4())
        created = reader.post(
            url, {"id": new_id, "page": 1, "type": "text", "data": text()}, format="json"
        )
        assert created.status_code == 201
        # Qayta yuborish idempotent: yangi yozuv yaratilmaydi.
        again = reader.post(
            url, {"id": new_id, "page": 1, "type": "text", "data": text()}, format="json"
        )
        assert again.status_code == 200
        assert PageAnnotation.objects.count() == 1

        detail = f"{url}{new_id}/"
        patched = reader.patch(detail, {"data": text(text="O'zgardi")}, format="json")
        assert patched.status_code == 200
        assert patched.json()["data"]["text"] == "O'zgardi"
        assert reader.delete(detail).status_code == 204
        assert not PageAnnotation.objects.exists()

    def test_patch_validates_against_the_stored_type(self, reader, book):
        annotation_id = put_page(reader, book, 1, [{"type": "text", "data": text()}]).json()[0][
            "id"
        ]
        bad = reader.patch(
            f"{ME}/{book.pk}/annotations/{annotation_id}/", {"data": drawing()}, format="json"
        )
        assert bad.status_code == 400

    def test_list_several_pages_and_limit(self, reader, book):
        put_page(reader, book, 1, [{"type": "text", "data": text()}])
        put_page(reader, book, 2, [{"type": "highlight", "data": highlight()}])
        both = reader.get(f"{ME}/{book.pk}/annotations/?pages=1,2").json()
        assert [row["page"] for row in both] == [1, 2]
        assert reader.get(f"{ME}/{book.pk}/annotations/").status_code == 400
        many = ",".join(str(n) for n in range(1, 12))
        assert reader.get(f"{ME}/{book.pk}/annotations/?pages={many}").status_code == 400
        assert reader.get(f"{ME}/{book.pk}/annotations/?pages=a").status_code == 400


def bad(reader, book, annotation_type, data):
    response = put_page(reader, book, 1, [{"type": annotation_type, "data": data}])
    assert response.status_code == 400, response.json()
    return response.json()["details"]


class TestValidation:
    def test_drawing_rejects_bad_fields(self, reader, book):
        for field, value in (
            ("tool", "laser"),
            ("color", "red"),
            ("width", 5),
            ("points", []),
        ):
            details = bad(reader, book, "drawing", drawing(**{field: value}))
            assert field in str(details)

    def test_drawing_points_must_be_normalized_numbers(self, reader, book):
        bad(reader, book, "drawing", drawing(points=[[1.5, 0.2]]))
        bad(reader, book, "drawing", drawing(points=[[-0.1, 0.2]]))
        bad(reader, book, "drawing", drawing(points=[["a", 0.2]]))
        bad(reader, book, "drawing", drawing(points=[[0.1]]))
        bad(reader, book, "drawing", drawing(points=[[True, 0.2]]))

    def test_point_count_is_limited(self, reader, book):
        too_many = [[0.5, 0.5]] * (validation.MAX_POINTS + 1)
        details = bad(reader, book, "drawing", drawing(points=too_many))
        assert "too_many_points" in str(details)

    def test_limit_exact_count_is_accepted(self, reader, book):
        exact = [[0.5, 0.5]] * validation.MAX_POINTS
        assert (
            put_page(
                reader, book, 1, [{"type": "drawing", "data": drawing(points=exact)}]
            ).status_code
            == 200
        )

    def test_highlight_rects(self, reader, book):
        bad(reader, book, "highlight", highlight(rects=[]))
        bad(reader, book, "highlight", highlight(rects=[{"x": 0.9, "y": 0.1, "w": 0.5, "h": 0.1}]))
        bad(reader, book, "highlight", highlight(rects=[{"x": 0.1, "y": 0.1, "w": 0, "h": 0.1}]))
        bad(reader, book, "highlight", highlight(rects=["x"]))
        many = [{"x": 0.1, "y": 0.1, "w": 0.1, "h": 0.1}] * (validation.MAX_RECTS + 1)
        bad(reader, book, "highlight", highlight(rects=many))

    def test_text_rules(self, reader, book):
        bad(reader, book, "text", text(text="   "))
        bad(reader, book, "text", text(text="a" * (validation.MAX_TEXT + 1)))
        bad(reader, book, "text", text(size=0.9))
        bad(reader, book, "text", text(x=2))

    def test_unknown_type_and_non_object_data(self, reader, book):
        assert put_page(reader, book, 1, [{"type": "image", "data": {}}]).status_code == 400
        bad(reader, book, "text", "plain string")
        bad(reader, book, "text", [1, 2])

    def test_unknown_keys_are_dropped_and_numbers_rounded(self, reader, book):
        payload = text(x=0.123456789, evil="<script>")
        stored = put_page(reader, book, 1, [{"type": "text", "data": payload}]).json()[0]["data"]
        assert "evil" not in stored
        assert stored["x"] == 0.12346

    def test_ink_and_hex_colors_are_accepted(self, reader, book):
        for color in ("ink", "#AABBCC", "#aabbcc"):
            ok = put_page(reader, book, 1, [{"type": "text", "data": text(color=color)}])
            assert ok.status_code == 200


class TestSizeLimits:
    def test_too_many_annotations_on_a_page(self, reader, book):
        items = [{"type": "text", "data": text()}] * (validation.MAX_PER_PAGE + 1)
        response = put_page(reader, book, 1, items)
        assert response.status_code == 400

    def test_page_byte_budget(self, reader, book):
        # Har chizma ~ 5000 nuqta (~100 KB): 6 tasi 500 KB dan oshadi.
        heavy = [[round(i / 5000, 5), 0.5, 0.5] for i in range(validation.MAX_POINTS)]
        item = {"type": "drawing", "data": drawing(points=heavy)}
        assert validation.data_size(item["data"]) > 80_000
        response = put_page(reader, book, 1, [item] * 7)
        assert response.status_code == 400
        assert response.json()["details"]["annotations"] == ["page_too_large"]
        assert not PageAnnotation.objects.exists()

    def test_single_post_respects_the_page_budget(self, reader, book):
        heavy = [[round(i / 5000, 5), 0.5, 0.5] for i in range(validation.MAX_POINTS)]
        items = [{"type": "drawing", "data": drawing(points=heavy)} for _ in range(6)]
        assert put_page(reader, book, 1, items).status_code == 200
        response = reader.post(
            f"{ME}/{book.pk}/annotations/",
            {"page": 1, "type": "drawing", "data": drawing(points=heavy)},
            format="json",
        )
        assert response.status_code == 400
        assert PageAnnotation.objects.count() == 6

    def test_deleting_user_cascades(self, reader, book):
        put_page(reader, book, 1, [{"type": "text", "data": text()}])
        reader.put(f"{ME}/{book.pk}/pages/1/notes/", {"text": "yozuv"}, format="json")
        book.delete()
        assert not PageAnnotation.objects.exists() and not PageNote.objects.exists()
