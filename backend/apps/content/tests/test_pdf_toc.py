import pytest
from rest_framework.test import APIClient

from apps.accounts.models import AuditLog
from apps.content.models import PdfBook, PdfBookChapter

from .test_admin_api import client_as
from .test_pdf_books import BASE, PUBLIC, algebra, create_book, local_storage, upload  # noqa: F401

pytestmark = pytest.mark.django_db

TOC = [
    {
        "title": "Kirish",
        "page": 1,
        "children": [{"title": "Maqsad", "page": 2}, {"title": "Tuzilma", "page": 3}],
    },
    {"title": "Algebra", "page": 3},
]


@pytest.fixture
def admin():
    return client_as("admin")


@pytest.fixture
def book(admin, algebra):  # noqa: F811
    """Yuklangan (3 sahifa) kitob."""
    created = create_book(admin)
    assert upload(admin, created["id"]).status_code == 200
    return created


def patch(client, book_id, body):
    return client.patch(f"{BASE}/{book_id}/", body, "json")


def titles(tree):
    return [(row["title"], [c["title"] for c in row["children"]]) for row in tree]


class TestWrite:
    def test_description_and_chapters_roundtrip(self, admin, book):
        response = patch(admin, book["id"], {"description": "Qisqa tavsif", "chapters": TOC})
        assert response.status_code == 200, response.json()
        body = response.json()
        assert body["description"] == "Qisqa tavsif"
        assert titles(body["chapters"]) == [("Kirish", ["Maqsad", "Tuzilma"]), ("Algebra", [])]
        assert [c["page"] for c in body["chapters"][0]["children"]] == [2, 3]
        assert all(c["id"] for c in body["chapters"])
        assert titles(admin.get(f"{BASE}/{book['id']}/").json()["chapters"]) == titles(
            body["chapters"]
        )

    def test_order_follows_list_order(self, admin, book):
        flipped = [TOC[1], TOC[0]]
        body = patch(admin, book["id"], {"chapters": flipped}).json()
        assert [c["title"] for c in body["chapters"]] == ["Algebra", "Kirish"]

    def test_replace_and_clear(self, admin, book):
        patch(admin, book["id"], {"chapters": TOC})
        body = patch(admin, book["id"], {"chapters": [{"title": "Yagona", "page": 1}]}).json()
        assert titles(body["chapters"]) == [("Yagona", [])]
        assert PdfBookChapter.objects.filter(book_id=book["id"]).count() == 1
        assert patch(admin, book["id"], {"chapters": []}).json()["chapters"] == []
        assert not PdfBookChapter.objects.filter(book_id=book["id"]).exists()

    def test_patch_without_chapters_keeps_them(self, admin, book):
        patch(admin, book["id"], {"chapters": TOC})
        body = patch(admin, book["id"], {"description": "Yangi"}).json()
        assert len(body["chapters"]) == 2 and body["description"] == "Yangi"

    def test_create_with_chapters_before_upload(self, admin, algebra):  # noqa: F811
        # Fayl hali yo'q (page_count = 0): yuqori chegara tekshirilmaydi.
        created = create_book(admin, description="Tavsif", chapters=[{"title": "A", "page": 250}])
        assert created["chapters"][0]["page"] == 250 and created["description"] == "Tavsif"

    def test_grandchildren_are_not_stored(self, admin, book):
        deep = [
            {
                "title": "A",
                "page": 1,
                "children": [{"title": "B", "page": 2, "children": [{"title": "C", "page": 3}]}],
            }
        ]
        body = patch(admin, book["id"], {"chapters": deep}).json()
        assert PdfBookChapter.objects.filter(book_id=book["id"]).count() == 2
        assert "children" not in body["chapters"][0]["children"][0]

    def test_whitespace_is_trimmed(self, admin, book):
        body = patch(admin, book["id"], {"chapters": [{"title": "  Kirish  ", "page": 1}]}).json()
        assert body["chapters"][0]["title"] == "Kirish"

    def test_editor_may_edit(self, book):
        editor = client_as("editor")
        assert patch(editor, book["id"], {"chapters": TOC}).status_code == 200

    def test_anonymous_and_student_cannot(self, book):
        assert patch(APIClient(), book["id"], {"chapters": TOC}).status_code in (401, 403)
        assert patch(client_as("student"), book["id"], {"chapters": TOC}).status_code == 403


class TestValidation:
    def codes(self, admin, book, chapters):
        response = patch(admin, book["id"], {"chapters": chapters})
        assert response.status_code == 400, response.json()
        return response.json()["details"]["chapters"]

    def test_page_beyond_pdf(self, admin, book):
        assert self.codes(admin, book, [{"title": "A", "page": 4}]) == ["chapter_page_exceeds"]
        # Ichki bo'lim ham tekshiriladi, chegara (oxirgi bet) o'tadi.
        nested = [{"title": "A", "page": 3, "children": [{"title": "B", "page": 9}]}]
        assert self.codes(admin, book, nested) == ["chapter_page_exceeds"]
        assert (
            patch(admin, book["id"], {"chapters": [{"title": "A", "page": 3}]}).status_code == 200
        )

    @pytest.mark.parametrize("page", [0, -1, 100_001])
    def test_page_must_be_positive(self, admin, book, page):
        assert self.codes(admin, book, [{"title": "A", "page": page}]) == ["chapter_page_invalid"]

    @pytest.mark.parametrize("title", ["", "   "])
    def test_title_required(self, admin, book, title):
        assert self.codes(admin, book, [{"title": title, "page": 1}]) == ["chapter_title_required"]

    def test_title_too_long(self, admin, book):
        assert self.codes(admin, book, [{"title": "x" * 201, "page": 1}]) == [
            "chapter_title_too_long"
        ]

    def test_too_many(self, admin, book):
        rows = [{"title": f"B{i}", "page": 1} for i in range(501)]
        assert self.codes(admin, book, rows) == ["chapters_too_many"]

    def test_all_problems_reported_together(self, admin, book):
        rows = [{"title": "", "page": 0}, {"title": "B", "page": 99}]
        assert self.codes(admin, book, rows) == [
            "chapter_page_exceeds",
            "chapter_page_invalid",
            "chapter_title_required",
        ]

    def test_invalid_patch_changes_nothing(self, admin, book):
        patch(admin, book["id"], {"chapters": TOC})
        patch(admin, book["id"], {"chapters": [{"title": "A", "page": 99}]})
        assert PdfBookChapter.objects.filter(book_id=book["id"]).count() == 4

    def test_description_limit(self, admin, book):
        assert patch(admin, book["id"], {"description": "x" * 2000}).status_code == 200
        too_long = patch(admin, book["id"], {"description": "x" * 2001})
        assert too_long.status_code == 400 and "description" in too_long.json()["details"]


class TestPublic:
    def publish(self, admin, book):
        admin.post(f"{BASE}/{book['id']}/transition/", {"to": "published"}, "json")

    def test_detail_has_description_and_chapters(self, admin, book):
        patch(admin, book["id"], {"description": "Tavsif", "chapters": TOC})
        self.publish(admin, book)
        body = APIClient().get(f"{PUBLIC}/{book['id']}/").json()
        assert body["description"] == "Tavsif"
        assert titles(body["chapters"]) == [("Kirish", ["Maqsad", "Tuzilma"]), ("Algebra", [])]

    def test_empty_by_default(self, admin, book):
        self.publish(admin, book)
        body = APIClient().get(f"{PUBLIC}/{book['id']}/").json()
        assert body["description"] == "" and body["chapters"] == []

    def test_list_stays_light(self, admin, book):
        patch(admin, book["id"], {"description": "Tavsif", "chapters": TOC})
        self.publish(admin, book)
        row = APIClient().get(f"{PUBLIC}/").json()["results"][0]
        assert "chapters" not in row and "description" not in row

    def test_edit_invalidates_public_cache(self, admin, book, django_capture_on_commit_callbacks):
        self.publish(admin, book)
        anon = APIClient()
        assert anon.get(f"{PUBLIC}/{book['id']}/").json()["chapters"] == []
        with django_capture_on_commit_callbacks(execute=True):
            patch(admin, book["id"], {"chapters": TOC})
        assert len(anon.get(f"{PUBLIC}/{book['id']}/").json()["chapters"]) == 2


class TestAuditAndCascade:
    def test_update_is_audited_with_chapter_count(self, admin, book):
        patch(admin, book["id"], {"description": "Tavsif", "chapters": TOC})
        entry = AuditLog.objects.filter(target_type="pdf_book", action="update").latest(
            "created_at"
        )
        assert entry.before["chapters"] == 0 and entry.after["chapters"] == 4
        assert entry.after["description"] == "Tavsif"

    def test_chapters_deleted_with_book(self, admin, book):
        patch(admin, book["id"], {"chapters": TOC})
        assert admin.delete(f"{BASE}/{book['id']}/").status_code == 204
        assert not PdfBook.objects.filter(pk=book["id"]).exists()
        assert not PdfBookChapter.objects.exists()
