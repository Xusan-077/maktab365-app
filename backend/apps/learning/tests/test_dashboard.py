from datetime import timedelta

import pytest
from django.utils import timezone

from apps.accounts.models import Role
from apps.learning.models import TopicProgress

from .conftest import (
    CHISIQLI,
    DISCRIMINANT,
    PIFAGOR,
    VIYET,
    client_for,
    make_user,
)

pytestmark = pytest.mark.django_db

DASHBOARD = "/api/v1/me/dashboard/"
RESULTS = "/api/v1/me/results/"
TEACHER = "/api/v1/me/teacher/dashboard/"


def put(api, key, **body):
    return api.put(f"/api/v1/me/progress/{key}/", body, format="json")


def mistake(exercise_id="x", attempts=1):
    return {"exercise_id": exercise_id, "attempts": attempts}


class TestDashboard:
    def test_shape_for_new_user(self, api, library):
        body = api.get(DASHBOARD).json()
        assert set(body) == {
            "continue",
            "has_progress",
            "subjects",
            "review",
            "weekly",
            "saved_count",
        }
        assert body["continue"] is None
        assert body["has_progress"] is False
        assert body["subjects"] == []  # sinf belgilanmagan
        assert body["review"] == {"count": 0, "items": []}
        assert body["weekly"]["active"] == 0
        assert set(body["weekly"]) == {
            "since",
            "finished",
            "read",
            "exercises_passed",
            "mistakes",
            "active",
        }
        assert body["saved_count"] == 0

    def test_continue_is_latest_unfinished(self, api, library):
        put(api, DISCRIMINANT, read_status="read", exercise_status="passed")  # tugagan
        put(api, VIYET, read_status="in_progress", last_block_id="rule")
        body = api.get(DASHBOARD).json()
        assert body["continue"]["topic_id"] == VIYET
        assert body["continue"]["last_block_id"] == "rule"

    def test_finished_with_mistakes_still_continues(self, api, library):
        put(api, DISCRIMINANT, read_status="read", exercise_status="passed", mistakes=[mistake()])
        assert api.get(DASHBOARD).json()["continue"]["topic_id"] == DISCRIMINANT

    def test_continue_none_when_everything_finished(self, api, library):
        put(api, DISCRIMINANT, read_status="read", exercise_status="passed")
        body = api.get(DASHBOARD).json()
        assert body["continue"] is None
        assert body["has_progress"] is True  # "hammasi tugagan", "boshlanmagan" emas

    def test_review_is_sorted_and_counted(self, api, library):
        put(api, DISCRIMINANT, mistakes=[mistake("a")])
        put(api, VIYET, mistakes=[mistake("a"), mistake("b")])
        put(api, CHISIQLI, mistakes=[mistake("a")])
        put(api, PIFAGOR, read_status="read")
        review = api.get(DASHBOARD).json()["review"]
        assert review["count"] == 3
        assert [i["topic_id"] for i in review["items"]][0] == VIYET  # eng ko'p xato
        assert [i["topic_id"] for i in review["items"]][1:] == [CHISIQLI, DISCRIMINANT]  # yangisi

    def test_subjects_follow_profile_grade(self, library):
        user = make_user("student9@example.com", grade=9)
        api = client_for(user)
        put(api, DISCRIMINANT, read_status="read", exercise_status="passed")
        put(api, VIYET, read_status="read")
        put(api, PIFAGOR, read_status="read")  # boshqa sinf kitobi
        subjects = api.get(DASHBOARD).json()["subjects"]
        assert subjects == [
            {
                "book_id": "algebra-9",
                "subject_id": "algebra",
                "grade": 9,
                "topics_total": 3,  # draft sanalmaydi
                "topics_read": 2,
                "topics_passed": 1,
            }
        ]

    def test_weekly_counts_only_last_7_days(self, api, user, library):
        put(api, DISCRIMINANT, read_status="read", exercise_status="passed")
        put(api, VIYET, read_status="read", mistakes=[mistake("a"), mistake("b")])
        old = put(api, CHISIQLI, read_status="read", mistakes=[mistake("a")])
        assert old.status_code == 200
        long_ago = timezone.now() - timedelta(days=10)
        TopicProgress.objects.filter(topic__slug="chiziqli").update(
            updated_at=long_ago, read_at=long_ago
        )
        weekly = api.get(DASHBOARD).json()["weekly"]
        assert weekly["active"] == 2
        assert weekly["finished"] == 1
        assert weekly["read"] == 2
        assert weekly["exercises_passed"] == 1
        assert weekly["mistakes"] == 2

    def test_saved_count(self, api, library):
        api.post("/api/v1/me/bookmarks/", {"kind": "topic", "topic_id": VIYET}, format="json")
        api.post("/api/v1/me/bookmarks/", {"kind": "book", "book_id": "algebra-9"}, format="json")
        assert api.get(DASHBOARD).json()["saved_count"] == 1  # faqat mavzular

    def test_query_budget(self, library, django_assert_max_num_queries):
        user = make_user("budget@example.com", grade=9)
        api = client_for(user)
        for key in (DISCRIMINANT, VIYET, CHISIQLI):
            put(api, key, read_status="in_progress", mistakes=[mistake()])
        with django_assert_max_num_queries(14):
            assert api.get(DASHBOARD).status_code == 200


class TestResults:
    def test_groups_by_topic_with_separate_statuses(self, api, library):
        put(api, DISCRIMINANT, read_status="read", exercise_status="passed")  # o'zlashtirilgan
        put(api, VIYET, read_status="read", exercise_status="in_progress", mistakes=[mistake()])
        put(api, CHISIQLI, read_status="in_progress")
        put(api, PIFAGOR, exercise_status="passed")  # o'qimasdan mashqdan o'tgan
        body = api.get(RESULTS).json()
        assert body["counts"] == {"mastered": 2, "review": 1, "in_progress": 1}
        assert {i["topic_id"] for i in body["mastered"]} == {DISCRIMINANT, PIFAGOR}
        assert [i["topic_id"] for i in body["review"]] == [VIYET]
        assert [i["topic_id"] for i in body["in_progress"]] == [CHISIQLI]
        pifagor = next(i for i in body["mastered"] if i["topic_id"] == PIFAGOR)
        assert (pifagor["read_status"], pifagor["exercise_status"]) == (
            "not_started",
            "passed",
        )

    def test_empty(self, api, library):
        body = api.get(RESULTS).json()
        assert body["counts"] == {"mastered": 0, "review": 0, "in_progress": 0}
        assert body["mastered"] == body["review"] == body["in_progress"] == []

    def test_cleared_mistakes_move_topic_out_of_review(self, api, library):
        put(api, VIYET, exercise_status="passed", mistakes=[mistake()])
        assert api.get(RESULTS).json()["counts"]["review"] == 1
        put(api, VIYET, mistakes=[], updated_at=timezone.now().isoformat())
        counts = api.get(RESULTS).json()["counts"]
        assert counts["review"] == 0 and counts["mastered"] == 1


class TestTeacherDashboard:
    def test_students_are_forbidden(self, api, library):
        assert api.get(TEACHER).status_code == 403

    def test_shape(self, library):
        teacher = make_user("ustoz@example.com")
        teacher.role = Role.TEACHER
        teacher.save()
        api = client_for(teacher)
        api.post("/api/v1/me/events/", {"type": "topic_opened", "topic_id": VIYET}, format="json")
        api.post("/api/v1/me/bookmarks/", {"kind": "topic", "topic_id": VIYET}, format="json")
        api.post("/api/v1/me/bookmarks/", {"kind": "book", "book_id": "algebra-9"}, format="json")
        body = api.get(TEACHER).json()
        assert [r["topic_id"] for r in body["recent"]] == [VIYET]
        assert [b["topic_id"] for b in body["saved_topics"]] == [VIYET]
        assert [b["book_id"] for b in body["saved_books"]] == ["algebra-9"]
        assert body["saved_topics_count"] == 1 and body["saved_books_count"] == 1
