import uuid

import pytest
from rest_framework.test import APIClient

from apps.accounts import services as account_services
from apps.games import services
from apps.games.models import GameSession

from .conftest import client_as

pytestmark = pytest.mark.django_db

SESSIONS = "/api/v1/games/sessions/"
FINISH = {
    "teams": [{"name": "Qizillar", "score": 120, "correct": 6, "total": 8}],
    "duration_seconds": 95,
}


def start(client, **body):
    return client.post(SESSIONS, {"game_type": "quiz", **body}, format="json")


def test_anonymous_cannot_start(db):
    assert start(APIClient()).status_code == 401


def test_start_is_never_blocked(student):
    """Istalgancha o'yin: boshlash hech qachon 403 bermaydi va hech narsa sarflamaydi."""
    for _ in range(50):
        response = start(student)
        assert response.status_code == 201
        assert set(response.json()) == {"session_id"}
    assert GameSession.objects.count() == 50


def test_allowance_endpoint_is_gone(student):
    assert student.get("/api/v1/games/allowance/").status_code == 404


def test_start_with_topic(student, topics):
    topic = topics.playable()
    response = start(student, topic=services.topic_slug(topic))
    assert response.status_code == 201
    assert GameSession.objects.get().topic == topic


@pytest.mark.parametrize(
    ("body", "field"),
    [({"topic": "yoq-000000000000"}, "topic"), ({"game_type": "Bad Type!"}, "game_type")],
)
def test_start_validation_creates_nothing(student, body, field):
    response = student.post(SESSIONS, {"game_type": "quiz", **body}, format="json")
    assert response.status_code == 400
    assert field in response.json()["details"]
    assert not GameSession.objects.exists()


def test_finish_saves_result_once(student, topics):
    topic = topics.playable()
    session_id = start(student).json()["session_id"]
    body = {**FINISH, "game_type": "jeopardy", "topic": services.topic_slug(topic)}
    response = student.post(f"{SESSIONS}{session_id}/finish/", body, format="json")
    assert response.status_code == 200, response.json()
    data = response.json()
    assert data["game_type"] == "jeopardy"
    assert data["topic"] == services.topic_slug(topic)
    assert data["teams"] == FINISH["teams"]
    assert data["duration_seconds"] == 95
    assert data["finished_at"]
    assert "paid_with" not in data
    assert "coins_spent" not in data

    again = student.post(f"{SESSIONS}{session_id}/finish/", FINISH, format="json")
    assert again.status_code == 409
    assert again.json()["code"] == "session_finished"


def test_finish_foreign_or_unknown_session_404(student, db):
    session_id = start(student).json()["session_id"]
    other = client_as("student", email="other@example.com")
    assert other.post(f"{SESSIONS}{session_id}/finish/", FINISH, format="json").status_code == 404
    unknown = f"{SESSIONS}{uuid.uuid4()}/finish/"
    assert student.post(unknown, FINISH, format="json").status_code == 404


@pytest.mark.parametrize(
    "body",
    [
        {**FINISH, "teams": []},
        {**FINISH, "teams": [{"name": "A", "score": 1, "correct": 5, "total": 4}]},
        {**FINISH, "teams": [{"name": "A", "score": -1, "correct": 0, "total": 0}]},
        {**FINISH, "teams": FINISH["teams"] * 9},
        {**FINISH, "duration_seconds": -1},
    ],
)
def test_finish_validation(student, body):
    session_id = start(student).json()["session_id"]
    response = student.post(f"{SESSIONS}{session_id}/finish/", body, format="json")
    assert response.status_code == 400
    assert GameSession.objects.get().finished_at is None


def test_delete_account_removes_game_data(student):
    start(student)
    account_services.delete_account(student.user)
    assert not GameSession.objects.exists()


def test_export_includes_games(student):
    start(student)
    data = student.get("/api/v1/me/export/").json()
    assert "coins" not in data["games"]
    assert len(data["games"]["sessions"]) == 1
