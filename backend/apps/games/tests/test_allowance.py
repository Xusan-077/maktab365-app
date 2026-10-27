import uuid
from datetime import UTC, datetime
from unittest import mock

import pytest
from rest_framework.test import APIClient

from apps.accounts import services as account_services
from apps.games import services
from apps.games.models import CoinTransaction, CoinWallet, GameSession

from .conftest import client_as

pytestmark = pytest.mark.django_db

SESSIONS = "/api/v1/games/sessions/"
ALLOWANCE = "/api/v1/games/allowance/"
FINISH = {
    "teams": [{"name": "Qizillar", "score": 120, "correct": 6, "total": 8}],
    "duration_seconds": 95,
}


@pytest.fixture(autouse=True)
def _limits(settings):
    settings.GAMES_FREE_PER_MONTH = 10
    settings.GAMES_MONTHLY_COINS = 20
    settings.GAMES_COIN_COST = 5


def start(client, **body):
    return client.post(SESSIONS, {"game_type": "quiz", **body}, format="json")


def at(year, month, day=15):
    return mock.patch(
        "apps.games.services.timezone.now", return_value=datetime(year, month, day, 12, tzinfo=UTC)
    )


def test_anonymous_cannot_start(db):
    assert start(APIClient()).status_code == 401
    assert APIClient().get(ALLOWANCE).status_code == 401


def test_allowance_grants_monthly_bonus_once(student):
    first = student.get(ALLOWANCE).json()
    second = student.get(ALLOWANCE).json()
    assert first == second
    assert first["free_games_limit"] == 10
    assert first["free_games_left"] == 10
    assert first["coins"] == 20
    assert first["game_cost_coins"] == 5
    assert CoinTransaction.objects.filter(reason="monthly_bonus").count() == 1


def test_ten_free_then_coins_then_limit(student):
    for n in range(10):
        response = start(student)
        assert response.status_code == 201
        assert response.json()["paid_with"] == "free"
        assert response.json()["allowance"]["free_games_left"] == 9 - n
    # 20 tanga / 5 = yana 4 o'yin.
    for left in (15, 10, 5, 0):
        response = start(student)
        assert response.json()["paid_with"] == "coins"
        assert response.json()["allowance"]["coins"] == left
    response = start(student)
    assert response.status_code == 403
    assert response.json()["code"] == "game_limit_reached"
    assert GameSession.objects.count() == 14


def test_new_month_resets_free_and_adds_bonus(student):
    with at(2026, 10):
        for _ in range(11):
            start(student)  # 10 bepul + 1 tangali → 15 tanga
        assert student.get(ALLOWANCE).json()["coins"] == 15
    with at(2026, 11):
        data = student.get(ALLOWANCE).json()
        assert data["month"] == "2026-11-01"
        assert data["free_games_left"] == 10
        assert data["coins"] == 35  # tangalar yig'iladi
        assert start(student).json()["paid_with"] == "free"


def test_month_uses_local_time_zone(student):
    # 31-oktabr 21:00 UTC = 1-noyabr 02:00 Toshkent.
    with mock.patch(
        "apps.games.services.timezone.now", return_value=datetime(2026, 10, 31, 21, tzinfo=UTC)
    ):
        assert student.get(ALLOWANCE).json()["month"] == "2026-11-01"


def test_limits_are_per_user(student, db):
    other = client_as("student", email="other@example.com")
    for _ in range(10):
        start(student)
    assert start(other).json()["paid_with"] == "free"


def test_start_with_topic(student, topics):
    topic = topics.playable()
    response = start(student, topic=services.topic_slug(topic))
    assert response.status_code == 201
    assert GameSession.objects.get().topic == topic


@pytest.mark.parametrize(
    ("body", "field"),
    [({"topic": "yoq-000000000000"}, "topic"), ({"game_type": "Bad Type!"}, "game_type")],
)
def test_start_validation_spends_nothing(student, body, field):
    response = student.post(SESSIONS, {"game_type": "quiz", **body}, format="json")
    assert response.status_code == 400
    assert field in response.json()["details"]
    assert student.get(ALLOWANCE).json()["free_games_used"] == 0


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
    assert not CoinWallet.objects.exists()
    assert not CoinTransaction.objects.exists()


def test_export_includes_games(student):
    start(student)
    data = student.get("/api/v1/me/export/").json()
    assert data["games"]["coins"] == 20
    assert len(data["games"]["sessions"]) == 1
