"""«Mening yozuvlarim»: jamlash, filtr, qidiruv, sahifalash, egalik va sahifa rasmi."""

from datetime import timedelta

import pytest
from django.utils import timezone

from apps.books.models import Bookmark, BookPage, PageAnnotation, PageNote
from apps.learning.tests.conftest import client_for, make_user

from .test_books import make_book, ready_book

pytestmark = pytest.mark.django_db

URL = "/api/v1/me/annotations/"
BOOKS_URL = "/api/v1/me/annotations/books/"


@pytest.fixture
def me():
    user = make_user("entries@example.com")
    return user, client_for(user)


@pytest.fixture
def book():
    return ready_book()


def note(user, book, page, text):
    return PageNote.objects.create(user=user, book=book, page=page, text=text)


def mark(user, book, page, color="#fde047"):
    return PageAnnotation.objects.create(
        user=user,
        book=book,
        page=page,
        type="highlight",
        data={"color": color, "rects": [{"x": 0.1, "y": 0.1, "w": 0.4, "h": 0.05}]},
    )


def sketch(user, book, page):
    return PageAnnotation.objects.create(
        user=user,
        book=book,
        page=page,
        type="drawing",
        data={"tool": "pen", "color": "ink", "width": 0.004, "points": [[0.1, 0.1, 0.5]]},
    )


def label(user, book, page, text):
    return PageAnnotation.objects.create(
        user=user,
        book=book,
        page=page,
        type="text",
        data={"x": 0.2, "y": 0.2, "text": text, "color": "ink", "size": 0.03},
    )


def pages_of(response):
    return [(row["book"]["id"], row["page"]) for row in response.json()["results"]]


class TestAccess:
    def test_requires_login(self, anon):
        assert anon.get(URL).status_code in (401, 403)
        assert anon.get(BOOKS_URL).status_code in (401, 403)

    def test_empty_for_new_user(self, me):
        body = me[1].get(URL).json()
        assert body["count"] == 0
        assert body["results"] == []

    def test_only_own_entries(self, me, book):
        user, client = me
        stranger = make_user("stranger-entries@example.com")
        note(stranger, book, 1, "begona sir")
        mark(stranger, book, 1)
        note(user, book, 2, "meniki")
        body = client.get(URL).json()
        assert body["count"] == 1
        assert body["results"][0]["page"] == 2
        assert "begona" not in str(body)
        assert client.get(BOOKS_URL).json()[0]["count"] == 1


class TestGrouping:
    def test_one_entry_per_page_merges_note_annotations_and_bookmark(self, me, book):
        user, client = me
        note(user, book, 1, "Eslatma")
        mark(user, book, 1)
        sketch(user, book, 1)
        Bookmark.objects.create(user=user, book=book, page=1)
        body = client.get(URL).json()
        assert body["count"] == 1
        entry = body["results"][0]
        assert entry["note"] == "Eslatma"
        assert entry["bookmarked"] is True
        assert sorted(item["type"] for item in entry["annotations"]) == ["drawing", "highlight"]
        assert entry["book"]["title"] == book.title
        assert entry["image"]["width"] == 1400
        # Rasm havolalari mutlaq bo'lishi shart: frontend boshqa origin'da.
        assert entry["image"]["image"].startswith("http")

    def test_ordering_latest_book_first_then_by_page(self, me):
        user, client = me
        old, fresh = ready_book(title="Eski"), ready_book(title="Yangi")
        now = timezone.now()
        for book, page, minutes in ((old, 2, 3), (old, 1, 2), (fresh, 1, 1)):
            row = note(user, book, page, "x")
            PageNote.objects.filter(pk=row.pk).update(updated_at=now - timedelta(minutes=minutes))
        assert pages_of(client.get(URL)) == [
            (str(fresh.pk), 1),
            (str(old.pk), 1),
            (str(old.pk), 2),
        ]

    def test_empty_note_and_hidden_books_are_skipped(self, me, book):
        user, client = me
        note(user, book, 1, "")
        draft = make_book(title="Qoralama")
        note(user, draft, 1, "ko'rinmaydi")
        assert client.get(URL).json()["count"] == 0


class TestFilters:
    @pytest.fixture
    def filled(self, me, book):
        user, client = me
        note(user, book, 1, "Fotosintez haqida")
        mark(user, book, 2, "#fde047")
        mark(user, book, 2, "#86efac")
        label(user, book, 3, "Imtihonda keladi")
        sketch(user, book, 1)
        Bookmark.objects.create(user=user, book=book, page=2)
        return client

    def test_by_type(self, filled):
        assert [p for _, p in pages_of(filled.get(URL, {"type": "highlight"}))] == [2]
        assert [p for _, p in pages_of(filled.get(URL, {"type": "note"}))] == [1]
        assert [p for _, p in pages_of(filled.get(URL, {"type": "text"}))] == [3]
        assert [p for _, p in pages_of(filled.get(URL, {"type": "drawing"}))] == [1]
        assert [p for _, p in pages_of(filled.get(URL, {"type": "bookmark"}))] == [2]

    def test_by_highlight_color(self, filled):
        assert pages_of(filled.get(URL, {"color": "#86efac"}))[0][1] == 2
        assert filled.get(URL, {"color": "#f9a8d4"}).json()["count"] == 0
        # Rang filtri faqat belgilashlarni qaytaradi: boshqa tur bilan birga bo'sh.
        assert filled.get(URL, {"color": "#86efac", "type": "note"}).json()["count"] == 0

    def test_search_in_notes_and_text_annotations(self, filled):
        assert [p for _, p in pages_of(filled.get(URL, {"q": "fotosintez"}))] == [1]
        assert [p for _, p in pages_of(filled.get(URL, {"q": "IMTIHON"}))] == [3]
        assert filled.get(URL, {"q": "yo'q matn"}).json()["count"] == 0

    def test_by_book(self, filled, me):
        other = ready_book(title="Boshqa")
        note(me[0], other, 1, "x")
        body = filled.get(URL, {"book": str(other.pk)}).json()
        assert body["count"] == 1
        assert body["results"][0]["book"]["id"] == str(other.pk)

    def test_found_entry_still_has_all_its_content(self, filled):
        entry = filled.get(URL, {"q": "fotosintez"}).json()["results"][0]
        assert entry["note"] == "Fotosintez haqida"
        assert [item["type"] for item in entry["annotations"]] == ["drawing"]

    @pytest.mark.parametrize(
        "params",
        [
            {"type": "sticker"},
            {"color": "red"},
            {"book": "nope"},
            {"page": "0"},
            {"page_size": "x"},
        ],
    )
    def test_invalid_params(self, filled, params):
        assert filled.get(URL, params).status_code == 400


class TestPagination:
    def test_pages_and_size_cap(self, me):
        user, client = me
        big = ready_book(title="Katta")
        BookPage.objects.bulk_create(
            BookPage(
                book=big,
                number=n,
                image=f"i{n}.webp",
                thumbnail=f"t{n}.webp",
                width=100,
                height=140,
            )
            for n in range(3, 8)
        )
        big.page_count = 7
        big.save()
        for n in range(1, 8):
            note(user, big, n, f"n{n}")
        first = client.get(URL, {"page_size": 3}).json()
        second = client.get(URL, {"page_size": 3, "page": 2}).json()
        last = client.get(URL, {"page_size": 3, "page": 3}).json()
        assert first["count"] == 7
        assert [r["page"] for r in first["results"]] == [1, 2, 3]
        assert [r["page"] for r in second["results"]] == [4, 5, 6]
        assert [r["page"] for r in last["results"]] == [7]
        assert client.get(URL, {"page": 9}).json()["results"] == []
        assert client.get(URL, {"page_size": 500}).json()["page_size"] == 50


class TestBooksFacet:
    def test_counts_pages_per_book(self, me):
        user, client = me
        first, second = ready_book(title="B kitob"), ready_book(title="A kitob")
        note(user, first, 1, "x")
        mark(user, first, 1)
        mark(user, first, 2)
        note(user, second, 1, "y")
        rows = client.get(BOOKS_URL).json()
        assert [(r["title"], r["count"]) for r in rows] == [("A kitob", 1), ("B kitob", 2)]
