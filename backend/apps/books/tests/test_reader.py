"""O'qish oynasi API'si: oxirgi bet, xatcho'plar, kitob ichida qidirish."""

import pytest

from apps.books.models import Bookmark, UserBookProgress
from apps.learning.tests.conftest import client_for, make_user

from .test_books import PUBLIC, make_book, ready_book

pytestmark = pytest.mark.django_db

ME = "/api/v1/me/books"


@pytest.fixture
def reader():
    return client_for(make_user("reader@example.com"))


@pytest.fixture
def book():
    return ready_book()


class TestProgress:
    def test_requires_login(self, anon, book):
        assert anon.get(f"{ME}/{book.pk}/progress/").status_code in (401, 403)

    def test_missing_progress_is_404(self, reader, book):
        assert reader.get(f"{ME}/{book.pk}/progress/").status_code == 404

    def test_put_saves_and_get_returns(self, reader, book):
        saved = reader.put(f"{ME}/{book.pk}/progress/", {"last_page": 2}, format="json")
        assert saved.status_code == 200
        assert saved.json()["last_page"] == 2
        assert saved.json()["page_count"] == 2
        assert reader.get(f"{ME}/{book.pk}/progress/").json()["last_page"] == 2
        assert UserBookProgress.objects.count() == 1

    def test_page_out_of_range_is_rejected(self, reader, book):
        response = reader.put(f"{ME}/{book.pk}/progress/", {"last_page": 3}, format="json")
        assert response.status_code == 400
        assert response.json()["details"]["page"] == ["out_of_range"]

    def test_stale_client_write_does_not_override(self, reader, book):
        url = f"{ME}/{book.pk}/progress/"
        reader.put(url, {"last_page": 2, "updated_at": "2026-10-31T10:00:00Z"}, format="json")
        stale = reader.put(
            url, {"last_page": 1, "updated_at": "2026-10-31T09:00:00Z"}, format="json"
        )
        assert stale.json()["last_page"] == 2
        fresh = reader.put(
            url, {"last_page": 1, "updated_at": "2026-10-31T11:00:00Z"}, format="json"
        )
        assert fresh.json()["last_page"] == 1

    def test_list_returns_own_books_only(self, reader, book):
        other = client_for(make_user("other@example.com"))
        reader.put(f"{ME}/{book.pk}/progress/", {"last_page": 2}, format="json")
        assert [row["book_id"] for row in reader.get(f"{ME}/progress/").json()] == [str(book.pk)]
        assert other.get(f"{ME}/progress/").json() == []

    def test_draft_book_is_hidden(self, reader):
        draft = make_book()
        assert (
            reader.put(f"{ME}/{draft.pk}/progress/", {"last_page": 1}, format="json").status_code
            == 404
        )


class TestBookmarks:
    def test_add_is_idempotent_and_listed_by_page(self, reader, book):
        url = f"{ME}/{book.pk}/bookmarks/"
        first = reader.post(url, {"page": 2}, format="json")
        again = reader.post(url, {"page": 2}, format="json")
        reader.post(url, {"page": 1}, format="json")
        assert (first.status_code, again.status_code) == (201, 200)
        assert Bookmark.objects.count() == 2
        assert [row["page"] for row in reader.get(url).json()] == [1, 2]

    def test_delete_is_idempotent(self, reader, book):
        reader.post(f"{ME}/{book.pk}/bookmarks/", {"page": 1}, format="json")
        assert reader.delete(f"{ME}/{book.pk}/bookmarks/1/").status_code == 204
        assert reader.delete(f"{ME}/{book.pk}/bookmarks/1/").status_code == 204
        assert Bookmark.objects.count() == 0

    def test_page_out_of_range_is_rejected(self, reader, book):
        assert (
            reader.post(f"{ME}/{book.pk}/bookmarks/", {"page": 9}, format="json").status_code == 400
        )

    def test_other_users_bookmarks_are_private(self, reader, book):
        other = client_for(make_user("other@example.com"))
        reader.post(f"{ME}/{book.pk}/bookmarks/", {"page": 1}, format="json")
        assert other.get(f"{ME}/{book.pk}/bookmarks/").json() == []
        other.delete(f"{ME}/{book.pk}/bookmarks/1/")
        assert Bookmark.objects.count() == 1


class TestSearch:
    def test_finds_pages_with_snippet(self, anon, book):
        response = anon.get(f"{PUBLIC}/{book.pk}/search/", {"q": "YETARLI"})
        assert response.status_code == 200
        hits = response.json()
        assert [hit["page"] for hit in hits] == [1]
        assert "yetarli" in hits[0]["snippet"]

    def test_short_query_is_rejected(self, anon, book):
        assert anon.get(f"{PUBLIC}/{book.pk}/search/", {"q": "a"}).status_code == 400

    def test_no_match_returns_empty_list(self, anon, book):
        assert anon.get(f"{PUBLIC}/{book.pk}/search/", {"q": "yoqmatn"}).json() == []

    def test_draft_book_is_hidden(self, anon):
        assert anon.get(f"{PUBLIC}/{make_book().pk}/search/", {"q": "matn"}).status_code == 404


class TestPageText:
    def test_returns_text_of_page(self, anon, book):
        response = anon.get(f"{PUBLIC}/{book.pk}/pages/1/text/")
        assert response.status_code == 200
        assert response.json()["number"] == 1
        assert "yetarli" in response.json()["text"]

    def test_missing_page_is_404(self, anon, book):
        assert anon.get(f"{PUBLIC}/{book.pk}/pages/9/text/").status_code == 404
