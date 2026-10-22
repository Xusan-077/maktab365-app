"""Mehmon ma'lumotini qo'shish (qoidalar ikki tomon uchun umumiy `merge-*.json` fixture'lari)."""

import json
from pathlib import Path

import pytest
from django.utils.dateparse import parse_datetime

from apps.learning.models import Bookmark, TopicProgress

from .conftest import CHISIQLI, DISCRIMINANT, VIYET, client_for, make_user

pytestmark = pytest.mark.django_db

FIXTURES = Path(__file__).resolve().parents[4] / "contracts" / "fixtures"
URL = "/api/v1/me/merge-guest-data/"


def load(name):
    return json.loads((FIXTURES / name).read_text(encoding="utf-8"))["cases"]


def progress_payload(key, state):
    return {
        "topic_id": key,
        "read_status": state["read_status"],
        "exercise_status": state["exercise_status"],
        "last_block_id": state["last_block_id"],
        "mistakes": [{"exercise_id": e} for e in state["mistakes"]],
        "exercise_stats": {"solved": state["solved"], "attempts": state["attempts"]},
        "updated_at": state["updated_at"],
    }


def seed_account(user, topic, state):
    row = TopicProgress.objects.create(
        user=user,
        topic=topic,
        read_status=state["read_status"],
        exercise_status=state["exercise_status"],
        last_block_id=state["last_block_id"],
        mistakes=[
            {"exercise_id": e, "attempts": 1, "last_wrong_at": None} for e in state["mistakes"]
        ],
        exercise_stats={"solved": state["solved"], "attempts": state["attempts"]},
    )
    stamp = parse_datetime(state["updated_at"])
    TopicProgress.objects.filter(pk=row.pk).update(updated_at=stamp, client_updated_at=stamp)


def current_state(user, topic):
    row = TopicProgress.objects.get(user=user, topic=topic)
    return {
        "read_status": row.read_status,
        "exercise_status": row.exercise_status,
        "last_block_id": row.last_block_id,
        "mistakes": sorted(m["exercise_id"] for m in row.mistakes),
        "solved": sorted(row.exercise_stats["solved"]),
        "attempts": row.exercise_stats["attempts"],
    }


@pytest.fixture
def topic(library):
    from apps.content.models import Topic

    return Topic.objects.get(slug="diskriminant")


@pytest.mark.parametrize("case", load("merge-progress.json"), ids=lambda c: c["name"])
def test_progress_rules_from_shared_fixture(library, topic, case):
    user = make_user("merge@example.com")
    api = client_for(user)
    if case["account"]:
        seed_account(user, topic, case["account"])

    body = {"progress": [progress_payload(DISCRIMINANT, case["guest"])]}
    assert api.post(URL, body, format="json").status_code == 200

    expected = {k: v for k, v in case["merged"].items() if k != "updated_at"}
    expected["solved"] = sorted(expected["solved"])
    assert current_state(user, topic) == expected

    # takror chaqirish hech narsani o'zgartirmaydi
    again = api.post(URL, body, format="json")
    assert again.json()["progress"] == 0
    assert current_state(user, topic) == expected


@pytest.mark.parametrize("case", load("merge-bookmarks.json"), ids=lambda c: c["name"])
def test_bookmark_rules_from_shared_fixture(library, case):
    keys = {"t1": DISCRIMINANT, "t2": VIYET, "t3": CHISIQLI}
    user = make_user("bm@example.com")
    api = client_for(user)
    for item in case["account"]:
        assert (
            api.post(
                "/api/v1/me/bookmarks/", {"kind": "topic", "topic_id": keys[item]}, format="json"
            ).status_code
            == 201
        )

    body = {"bookmarks": [{"kind": "topic", "topic_id": keys[i]} for i in case["guest"]]}
    assert api.post(URL, body, format="json").status_code == 200
    saved = {b["topic_id"] for b in api.get("/api/v1/me/bookmarks/").json()}
    assert saved == {keys[i] for i in case["merged"]}

    again = api.post(URL, body, format="json").json()
    assert again["bookmarks"] == 0


class TestEndpoint:
    def test_result_shape_and_idempotence(self, api, library):
        body = {
            "progress": [
                {"topic_id": DISCRIMINANT, "read_status": "read"},
                {"topic_id": "yoq-mavzu", "read_status": "read"},
            ],
            "bookmarks": [
                {"kind": "topic", "topic_id": VIYET},
                {"kind": "book", "book_id": "algebra-9"},
                {"kind": "book", "book_id": "yoq-kitob"},
            ],
        }
        first = api.post(URL, body, format="json").json()
        assert first == {
            "progress": 1,
            "bookmarks": 2,
            "pdf_progress": 0,
            "pdf_bookmarks": 0,
            "failed": ["yoq-mavzu", "yoq-kitob"],
        }
        second = api.post(URL, body, format="json").json()
        assert second["progress"] == 0
        assert second["bookmarks"] == 0
        assert Bookmark.objects.count() == 2
        assert TopicProgress.objects.count() == 1

    def test_empty_body_is_ok(self, api, library):
        assert api.post(URL, {}, format="json").json() == {
            "progress": 0,
            "bookmarks": 0,
            "pdf_progress": 0,
            "pdf_bookmarks": 0,
            "failed": [],
        }

    def test_size_limit_500(self, api, library):
        ok = {"progress": [{"topic_id": DISCRIMINANT}] * 500}
        assert api.post(URL, ok, format="json").status_code == 200
        too_many = {"progress": [{"topic_id": DISCRIMINANT}] * 501}
        response = api.post(URL, too_many, format="json")
        assert response.status_code == 400
        assert response.json()["code"] == "validation_error"
        assert "progress" in response.json()["details"]
        bookmarks = {"bookmarks": [{"kind": "topic", "topic_id": VIYET}] * 501}
        assert api.post(URL, bookmarks, format="json").status_code == 400

    def test_does_not_touch_other_users(self, api, other_api, library, topic):
        other = TopicProgress.objects.create(
            user=other_api.handler._force_user, topic=topic, read_status="read"
        )
        api.post(
            URL,
            {"progress": [{"topic_id": DISCRIMINANT, "read_status": "in_progress"}]},
            format="json",
        )
        other.refresh_from_db()
        assert other.read_status == "read"
        assert TopicProgress.objects.count() == 2

    def test_draft_topics_cannot_be_merged(self, api, library):
        body = {"progress": [{"topic_id": "algebra-9-qoralama", "read_status": "read"}]}
        assert api.post(URL, body, format="json").json()["failed"] == ["algebra-9-qoralama"]
        assert TopicProgress.objects.count() == 0
