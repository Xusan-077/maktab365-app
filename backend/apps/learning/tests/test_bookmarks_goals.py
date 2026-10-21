import pytest

from apps.learning.models import Bookmark, StudyGoal

from .conftest import DISCRIMINANT, DRAFT, VIYET

pytestmark = pytest.mark.django_db

BOOKMARKS = "/api/v1/me/bookmarks/"
GOALS = "/api/v1/me/goals/"


class TestBookmarks:
    def add(self, api, **body):
        return api.post(BOOKMARKS, body, format="json")

    def test_add_is_idempotent(self, api, library):
        first = self.add(api, kind="topic", topic_id=DISCRIMINANT)
        assert first.status_code == 201
        assert first.json()["topic_id"] == DISCRIMINANT
        assert first.json()["book_id"] is None
        second = self.add(api, kind="topic", topic_id=DISCRIMINANT)
        assert second.status_code == 200
        assert second.json()["id"] == first.json()["id"]
        assert Bookmark.objects.count() == 1

    def test_book_bookmark(self, api, library):
        response = self.add(api, kind="book", book_id="algebra-9")
        assert response.status_code == 201
        assert response.json()["book_id"] == "algebra-9"
        assert response.json()["topic_id"] is None

    def test_validation(self, api, library):
        assert self.add(api, kind="topic").status_code == 400
        assert self.add(api, kind="book", topic_id=DISCRIMINANT).status_code == 400
        assert self.add(api, kind="topic", topic_id="yoq").status_code == 404
        assert self.add(api, kind="topic", topic_id=DRAFT).status_code == 404
        assert self.add(api, kind="book", book_id="yoq").status_code == 404

    def test_list_filter_and_order(self, api, library):
        self.add(api, kind="topic", topic_id=DISCRIMINANT)
        self.add(api, kind="book", book_id="algebra-9")
        self.add(api, kind="topic", topic_id=VIYET)
        everything = api.get(BOOKMARKS).json()
        assert len(everything) == 3
        assert everything[0]["topic_id"] == VIYET  # eng yangisi birinchi
        topics = api.get(BOOKMARKS, {"kind": "topic"}).json()
        assert {b["topic_id"] for b in topics} == {DISCRIMINANT, VIYET}

    def test_delete_is_idempotent(self, api, library):
        self.add(api, kind="topic", topic_id=DISCRIMINANT)
        url = f"{BOOKMARKS}?kind=topic&topic_id={DISCRIMINANT}"
        assert api.delete(url).status_code == 204
        assert api.delete(url).status_code == 204
        assert Bookmark.objects.count() == 0
        assert api.delete(f"{BOOKMARKS}?kind=topic").status_code == 400

    def test_delete_book(self, api, library):
        self.add(api, kind="book", book_id="algebra-9")
        assert api.delete(f"{BOOKMARKS}?kind=book&book_id=algebra-9").status_code == 204
        assert Bookmark.objects.count() == 0

    def test_isolation(self, api, other_api, library):
        self.add(api, kind="topic", topic_id=DISCRIMINANT)
        assert other_api.get(BOOKMARKS).json() == []
        other_api.delete(f"{BOOKMARKS}?kind=topic&topic_id={DISCRIMINANT}")
        assert Bookmark.objects.count() == 1

    def test_requires_login(self, library):
        from rest_framework.test import APIClient

        assert APIClient().get(BOOKMARKS).status_code in (401, 403)


class TestGoals:
    def test_crud(self, api, library):
        created = api.post(GOALS, {"title": "  Diskriminantni takrorlash "}, format="json")
        assert created.status_code == 201
        goal = created.json()
        assert goal["title"] == "Diskriminantni takrorlash"
        assert goal["done"] is False
        assert goal["topic_id"] is None

        url = f"{GOALS}{goal['id']}/"
        done = api.patch(url, {"done": True}, format="json").json()
        assert done["done"] is True and done["done_at"]
        undone = api.patch(url, {"done": False, "title": "Yangi"}, format="json").json()
        assert undone["done"] is False and undone["done_at"] is None
        assert undone["title"] == "Yangi"

        linked = api.patch(
            url, {"topic_id": DISCRIMINANT, "due_date": "2030-01-01"}, format="json"
        ).json()
        assert linked["topic_id"] == DISCRIMINANT
        assert linked["due_date"] == "2030-01-01"
        assert api.get(url).json()["topic_id"] == DISCRIMINANT

        assert [g["id"] for g in api.get(GOALS).json()] == [goal["id"]]
        assert api.delete(url).status_code == 204
        assert api.get(GOALS).json() == []
        assert api.get(url).status_code == 404

    def test_newest_first(self, api, library):
        api.post(GOALS, {"title": "Birinchi"}, format="json")
        api.post(GOALS, {"title": "Ikkinchi"}, format="json")
        assert [g["title"] for g in api.get(GOALS).json()] == ["Ikkinchi", "Birinchi"]

    def test_validation(self, api, library):
        assert api.post(GOALS, {"title": "   "}, format="json").status_code == 400
        assert api.post(GOALS, {}, format="json").status_code == 400
        assert api.post(GOALS, {"title": "x" * 201}, format="json").status_code == 400
        assert api.post(GOALS, {"title": "a", "topic_id": "yoq"}, format="json").status_code == 404

    def test_limit(self, api, user, library):
        StudyGoal.objects.bulk_create([StudyGoal(user=user, title=f"g{i}") for i in range(200)])
        response = api.post(GOALS, {"title": "ortiqcha"}, format="json")
        assert response.status_code == 400
        assert response.json()["details"]["title"] == ["goal_limit"]

    def test_other_users_goal_is_404(self, api, other_api, library):
        goal = api.post(GOALS, {"title": "Mening"}, format="json").json()
        url = f"{GOALS}{goal['id']}/"
        assert other_api.get(url).status_code == 404
        assert other_api.patch(url, {"done": True}, format="json").status_code == 404
        assert other_api.delete(url).status_code == 404
        assert other_api.get(GOALS).json() == []
        assert StudyGoal.objects.get().done_at is None
