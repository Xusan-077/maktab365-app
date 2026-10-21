import pytest

from apps.learning.models import Bookmark, RecentView, StudyGoal, TopicProgress

from .conftest import DISCRIMINANT, VIYET

pytestmark = pytest.mark.django_db


def fill(api):
    api.put(f"/api/v1/me/progress/{DISCRIMINANT}/", {"read_status": "read"}, format="json")
    api.post("/api/v1/me/events/", {"type": "topic_opened", "topic_id": VIYET}, format="json")
    api.post("/api/v1/me/bookmarks/", {"kind": "topic", "topic_id": VIYET}, format="json")
    api.post("/api/v1/me/goals/", {"title": "Takrorlash"}, format="json")


def test_export_includes_learning_data(api, library):
    fill(api)
    body = api.get("/api/v1/me/export/").json()["learning"]
    assert {p["topic_id"] for p in body["progress"]} == {DISCRIMINANT, VIYET}
    assert [b["topic_id"] for b in body["bookmarks"]] == [VIYET]
    assert [g["title"] for g in body["goals"]] == ["Takrorlash"]


def test_delete_account_removes_learning_data(api, other_api, library):
    fill(api)
    fill(other_api)
    assert api.delete("/api/v1/me/").status_code == 204
    assert TopicProgress.objects.count() == 2  # faqat boshqa foydalanuvchiniki
    assert Bookmark.objects.count() == 1
    assert StudyGoal.objects.count() == 1
    assert RecentView.objects.count() == 1
