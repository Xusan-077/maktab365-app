from datetime import timedelta

import pytest
from django.utils import timezone

from apps.learning.models import RECENT_LIMIT, RecentView, TopicProgress

from .conftest import DISCRIMINANT, DRAFT, EXERCISES, PIFAGOR, VIYET

pytestmark = pytest.mark.django_db

URL = "/api/v1/me/progress/{}/"


def put(api, key, **body):
    return api.put(URL.format(key), body, format="json")


def iso(delta_seconds=0):
    return (timezone.now() + timedelta(seconds=delta_seconds)).isoformat()


class TestAuth:
    def test_requires_login(self, library):
        from rest_framework.test import APIClient

        anon = APIClient()
        for response in (
            anon.get(URL.format(DISCRIMINANT)),
            anon.put(URL.format(DISCRIMINANT), {}, format="json"),
            anon.get("/api/v1/me/progress/"),
            anon.post("/api/v1/me/events/", {}, format="json"),
            anon.get("/api/v1/me/dashboard/"),
            anon.get("/api/v1/me/results/"),
            anon.post("/api/v1/me/merge-guest-data/", {}, format="json"),
        ):
            assert response.status_code in (401, 403)


class TestGetPut:
    def test_untouched_topic_is_empty_and_not_created(self, api, library):
        body = api.get(URL.format(DISCRIMINANT)).json()
        assert body["topic_id"] == DISCRIMINANT
        assert body["book_id"] == "algebra-9"
        assert body["read_status"] == "not_started"
        assert body["exercise_status"] == "not_started"
        assert body["mistakes"] == []
        assert body["updated_at"] is None
        assert TopicProgress.objects.count() == 0

    def test_unknown_and_hidden_topics_are_404(self, api, library):
        assert api.get(URL.format("yoq-mavzu")).status_code == 404
        assert api.get(URL.format(DRAFT)).status_code == 404  # draft ochiq ko'rinmaydi
        assert put(api, DRAFT, read_status="read").status_code == 404

    def test_put_saves_state(self, api, library):
        response = put(
            api,
            DISCRIMINANT,
            read_status="in_progress",
            last_block_id="rule",
            scroll_position=0.4,
            mistakes=[{"exercise_id": EXERCISES[0], "attempts": 2}],
            exercise_stats={"solved": [EXERCISES[1]], "attempts": {EXERCISES[1]: 1}},
        )
        assert response.status_code == 200
        body = response.json()
        assert body["read_status"] == "in_progress"
        assert body["last_block_id"] == "rule"
        assert body["scroll_position"] == 0.4
        assert body["mistakes"][0]["exercise_id"] == EXERCISES[0]
        assert body["mistakes"][0]["attempts"] == 2
        assert body["exercise_stats"] == {
            "solved": [EXERCISES[1]],
            "attempts": {EXERCISES[1]: 1},
        }
        assert body["first_opened_at"]
        assert api.get(URL.format(DISCRIMINANT)).json() == body

    def test_validation_errors_use_flat_format(self, api, library):
        response = put(api, DISCRIMINANT, read_status="bogus", scroll_position=3)
        assert response.status_code == 400
        assert response.json()["code"] == "validation_error"
        assert {"read_status", "scroll_position"} <= set(response.json()["details"])

    def test_empty_put_creates_nothing(self, api, library):
        assert put(api, DISCRIMINANT).status_code == 200
        assert TopicProgress.objects.count() == 0


class TestMonotonic:
    def test_status_never_goes_down(self, api, library):
        put(api, DISCRIMINANT, read_status="read", exercise_status="passed")
        body = put(api, DISCRIMINANT, read_status="not_started", exercise_status="in_progress")
        assert body.json()["read_status"] == "read"
        assert body.json()["exercise_status"] == "passed"

    def test_read_and_exercise_are_independent(self, api, library):
        body = put(api, DISCRIMINANT, read_status="read").json()
        assert (body["read_status"], body["exercise_status"]) == ("read", "not_started")
        body = put(api, DISCRIMINANT, exercise_status="passed").json()
        assert (body["read_status"], body["exercise_status"]) == ("read", "passed")
        assert body["read_at"] and body["passed_at"]

    def test_stats_only_grow(self, api, library):
        put(api, DISCRIMINANT, exercise_stats={"solved": ["a"], "attempts": {"a": 3}})
        body = put(
            api, DISCRIMINANT, exercise_stats={"solved": ["b"], "attempts": {"a": 1, "b": 2}}
        ).json()
        assert body["exercise_stats"] == {"solved": ["a", "b"], "attempts": {"a": 3, "b": 2}}

    def test_stale_write_does_not_override_block_or_mistakes(self, api, library):
        put(
            api,
            DISCRIMINANT,
            last_block_id="new",
            mistakes=[{"exercise_id": "x"}],
            updated_at=iso(-10),
        )
        stale = put(
            api,
            DISCRIMINANT,
            read_status="read",
            last_block_id="old",
            mistakes=[],
            updated_at=iso(-60),
        ).json()
        assert stale["last_block_id"] == "new"
        assert [m["exercise_id"] for m in stale["mistakes"]] == ["x"]
        assert stale["read_status"] == "read"  # holat baribir ko'tariladi

    def test_newer_write_overrides_block_and_clears_mistakes(self, api, library):
        put(
            api,
            DISCRIMINANT,
            last_block_id="a",
            mistakes=[{"exercise_id": "x"}],
            updated_at=iso(-60),
        )
        body = put(api, DISCRIMINANT, last_block_id="b", mistakes=[], updated_at=iso(-5)).json()
        assert body["last_block_id"] == "b"
        assert body["mistakes"] == []

    def test_future_client_time_is_clamped(self, api, library):
        put(api, DISCRIMINANT, last_block_id="a", updated_at=iso(86400 * 365))
        # soat noto'g'ri qurilma keyingi oddiy yozuvni bloklab qo'ymaydi
        body = put(api, DISCRIMINANT, last_block_id="b", updated_at=iso(0)).json()
        assert body["last_block_id"] in ("a", "b")
        row = TopicProgress.objects.get()
        assert row.client_updated_at <= timezone.now()


class TestIdempotent:
    def test_repeated_put_changes_nothing(self, api, library):
        payload = {
            "read_status": "in_progress",
            "exercise_status": "in_progress",
            "last_block_id": "rule",
            "mistakes": [{"exercise_id": "x", "attempts": 1}],
            "exercise_stats": {"solved": ["y"], "attempts": {"x": 1, "y": 1}},
            "updated_at": iso(-5),
        }
        first = put(api, DISCRIMINANT, **payload).json()
        second = put(api, DISCRIMINANT, **payload).json()
        assert first == second
        assert TopicProgress.objects.count() == 1

    def test_mistakes_are_deduplicated(self, api, library):
        body = put(
            api,
            DISCRIMINANT,
            mistakes=[
                {"exercise_id": "x", "attempts": 1},
                {"exercise_id": "x", "attempts": 3},
            ],
        ).json()
        assert [(m["exercise_id"], m["attempts"]) for m in body["mistakes"]] == [("x", 3)]


class TestIsolation:
    def test_cannot_see_or_touch_other_users_progress(self, api, other_api, library):
        put(api, DISCRIMINANT, read_status="read", mistakes=[{"exercise_id": "x"}])
        theirs = other_api.get(URL.format(DISCRIMINANT)).json()
        assert theirs["read_status"] == "not_started"
        assert other_api.get("/api/v1/me/progress/").json() == []
        assert other_api.get("/api/v1/me/results/").json()["counts"]["review"] == 0
        put(other_api, DISCRIMINANT, read_status="in_progress")
        assert api.get(URL.format(DISCRIMINANT)).json()["read_status"] == "read"
        assert TopicProgress.objects.count() == 2


class TestList:
    def test_filters(self, api, library):
        put(api, DISCRIMINANT, read_status="read", mistakes=[{"exercise_id": "x"}])
        put(api, VIYET, read_status="in_progress")
        put(api, PIFAGOR, exercise_status="in_progress")

        def keys(**params):
            return {i["topic_id"] for i in api.get("/api/v1/me/progress/", params).json()}

        assert keys() == {DISCRIMINANT, VIYET, PIFAGOR}
        assert keys(book="algebra-9") == {DISCRIMINANT, VIYET}
        assert keys(topic=VIYET) == {VIYET}
        assert keys(read_status="read") == {DISCRIMINANT}
        assert keys(exercise_status="in_progress") == {PIFAGOR}
        assert keys(needs_review="true") == {DISCRIMINANT}

    def test_no_n_plus_one(self, api, library, django_assert_max_num_queries):
        for key in (DISCRIMINANT, VIYET, PIFAGOR):
            put(api, key, read_status="read")
        with django_assert_max_num_queries(4):
            assert len(api.get("/api/v1/me/progress/").json()) == 3


class TestEvents:
    def event(self, api, **body):
        return api.post("/api/v1/me/events/", body, format="json")

    def test_opened_starts_reading_and_records_recent(self, api, library):
        body = self.event(api, type="topic_opened", topic_id=DISCRIMINANT).json()
        assert body["read_status"] == "in_progress"
        assert body["first_opened_at"]
        assert RecentView.objects.filter(topic__slug="diskriminant").count() == 1
        # qayta ochish: tartib yangilanadi, dublikat yo'q
        self.event(api, type="topic_opened", topic_id=VIYET)
        self.event(api, type="topic_opened", topic_id=DISCRIMINANT)
        recent = api.get("/api/v1/me/recent/").json()
        assert [r["topic_id"] for r in recent] == [DISCRIMINANT, VIYET]

    def test_opened_never_lowers_read(self, api, library):
        self.event(api, type="topic_read", topic_id=DISCRIMINANT, last_block_id="summary")
        body = self.event(api, type="topic_opened", topic_id=DISCRIMINANT).json()
        assert body["read_status"] == "read"
        assert body["last_block_id"] == "summary"

    def test_read_sets_read_at_only_once(self, api, library):
        first = self.event(api, type="topic_read", topic_id=DISCRIMINANT).json()
        second = self.event(api, type="topic_read", topic_id=DISCRIMINANT).json()
        assert first["read_at"] == second["read_at"]
        assert second["exercise_status"] == "not_started"

    def test_answers_track_mistakes_and_pass(self, api, library):
        def answer(exercise, correct, attempt=1):
            return self.event(
                api,
                type="exercise_answered",
                topic_id=DISCRIMINANT,
                exercise_id=exercise,
                correct=correct,
                attempt=attempt,
            ).json()

        body = answer(EXERCISES[0], False)
        assert body["exercise_status"] == "in_progress"
        assert [m["exercise_id"] for m in body["mistakes"]] == [EXERCISES[0]]

        body = answer(EXERCISES[0], False, 2)
        assert body["mistakes"][0]["attempts"] == 2

        # xato qilib keyin to'g'rilash xatoni o'chirmaydi (birinchi urinish emas)
        body = answer(EXERCISES[0], True, 3)
        assert len(body["mistakes"]) == 1
        assert EXERCISES[0] in body["exercise_stats"]["solved"]

        for exercise in EXERCISES[1:3]:
            body = answer(exercise, True)
        assert body["exercise_status"] == "in_progress"
        body = answer(EXERCISES[3], True)
        assert body["exercise_status"] == "passed"
        assert body["passed_at"]
        assert body["read_status"] == "not_started"  # "o'qidim" alohida

    def test_first_attempt_correct_clears_mistake(self, api, library):
        put(api, DISCRIMINANT, mistakes=[{"exercise_id": EXERCISES[0]}])
        body = self.event(
            api,
            type="exercise_answered",
            topic_id=DISCRIMINANT,
            exercise_id=EXERCISES[0],
            correct=True,
        ).json()
        assert body["mistakes"] == []

    def test_unknown_exercise_rejected(self, api, library):
        response = self.event(
            api, type="exercise_answered", topic_id=DISCRIMINANT, exercise_id="yo'q", correct=True
        )
        assert response.status_code == 400
        assert response.json()["code"] == "unknown_exercise"

    def test_answer_requires_exercise_and_correct(self, api, library):
        response = self.event(api, type="exercise_answered", topic_id=DISCRIMINANT)
        assert response.status_code == 400
        assert set(response.json()["details"]) == {"exercise_id", "correct"}

    def test_unknown_topic_404(self, api, library):
        assert self.event(api, type="topic_opened", topic_id="yoq").status_code == 404

    def test_recent_keeps_only_last_20(self, api, library):
        topic = TopicProgress  # noqa: F841 — faqat o'qilishi uchun
        from apps.content.models import Topic

        base = Topic.objects.get(slug="diskriminant")
        chapter = base.chapter
        for i in range(RECENT_LIMIT + 5):
            Topic.objects.create(
                chapter=chapter,
                slug=f"extra-{i}",
                order=10 + i,
                status="published",
                title={"uz": "x"},
                summary={"uz": "x"},
                blocks=base.blocks,
            )
            self.event(api, type="topic_opened", topic_id=f"algebra-9-extra-{i}")
        recent = api.get("/api/v1/me/recent/").json()
        assert len(recent) == RECENT_LIMIT
        assert recent[0]["topic_id"] == f"algebra-9-extra-{RECENT_LIMIT + 4}"
