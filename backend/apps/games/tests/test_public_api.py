import pytest
from django.core import signing
from rest_framework.test import APIClient

from apps.content.models import Subject
from apps.games import services
from apps.games.models import Option

from .conftest import make_question

pytestmark = pytest.mark.django_db

TOPICS = "/api/v1/games/topics/"
CHECK = "/api/v1/games/check/"


@pytest.fixture
def anon():
    return APIClient()


def results(response):
    assert response.status_code == 200, response.json()
    return response.json()["results"]


def test_topics_require_enough_active_questions(anon, topics):
    ready = topics.playable(8)
    topics.playable(7, title="Kam savolli")
    almost = topics.playable(8, title="Nofaol bilan")
    almost.questions.filter(order=0).update(is_active=False)
    rows = results(anon.get(TOPICS))
    assert [row["id"] for row in rows] == [str(ready.pk)]
    row = rows[0]
    assert row["question_count"] == 8
    assert row["grade"] == 9
    assert row["subject"]["slug"] == "algebra"
    assert row["textbook"]["title"]["uz"] == "Algebra 9"
    assert row["slug"] == services.topic_slug(ready)
    assert row["slug"].startswith("kvadrat-tenglamalar-")


def test_topics_hide_draft_books(anon, topics):
    topics.playable(status="draft")
    assert results(anon.get(TOPICS)) == []


def test_topics_paginated(anon, topics):
    data = anon.get(TOPICS).json()
    assert set(data) >= {"count", "results"}


@pytest.mark.parametrize(
    "query",
    ["kvadrat", "KVADRAT", "Алгебра", "algebra 9", "квадрат", "Fizika", "Физика", "Physics"],
)
def test_search_all_fields_and_languages(anon, topics, catalog, query):
    physics = Subject.objects.create(
        slug="fizika", title={"uz": "Fizika", "ru": "Физика", "en": "Physics"}
    )
    topics.playable(title="Kvadrat tenglamalar")
    other = topics.playable(title="Harakat", subject=physics, book_title={"uz": "Mexanika"})
    rows = results(anon.get(TOPICS, {"q": query}))
    ids = {row["id"] for row in rows}
    if query.lower() in {"fizika", "физика", "physics"}:
        assert ids == {str(other.pk)}
    else:
        assert str(other.pk) not in ids and len(ids) == 1


def test_filters_grade_and_subject(anon, topics, catalog):
    physics = catalog.subject("fizika")
    a = topics.playable(grade=9)
    b = topics.playable(grade=7, subject=physics)
    assert [r["id"] for r in results(anon.get(TOPICS, {"grade": 7}))] == [str(b.pk)]
    assert [r["id"] for r in results(anon.get(TOPICS, {"subject": "algebra"}))] == [str(a.pk)]
    assert anon.get(TOPICS, {"grade": "x"}).status_code == 400


def test_questions_random_without_correct_flag(anon, topics):
    topic = topics.playable(20)
    slug = services.topic_slug(topic)
    response = anon.get(f"{TOPICS}{slug}/questions/", {"count": 16})
    assert response.status_code == 200
    assert response["Cache-Control"] == "private, no-store"
    data = response.json()
    assert data["topic"]["id"] == str(topic.pk)
    questions = data["questions"]
    assert len(questions) == 16
    assert len({q["id"] for q in questions}) == 16
    assert "is_correct" not in str(data)
    for question in questions:
        assert len(question["options"]) == 4
        assert set(question["options"][0]) == {"id", "text"}
        assert question["answer_token"]


def test_questions_count_clamped_and_capped(anon, topics):
    topic = topics.playable(10)
    slug = services.topic_slug(topic)
    assert len(anon.get(f"{TOPICS}{slug}/questions/", {"count": 1}).json()["questions"]) == 4
    assert len(anon.get(f"{TOPICS}{slug}/questions/").json()["questions"]) == 10


def test_questions_are_shuffled(anon, topics):
    topic = topics.playable(12)
    slug = services.topic_slug(topic)
    orders = {
        tuple(q["id"] for q in anon.get(f"{TOPICS}{slug}/questions/").json()["questions"])
        for _ in range(10)
    }
    assert len(orders) > 1


def test_questions_slug_title_part_is_cosmetic(anon, topics):
    topic = topics.playable()
    short = topic.pk.hex[:12]
    assert anon.get(f"{TOPICS}boshqa-nom-{short}/questions/").status_code == 200
    assert anon.get(f"{TOPICS}{short}/questions/").status_code == 200


@pytest.mark.parametrize("slug", ["yoq", "nom-000000000000", "nom-zzzzzzzzzzzz"])
def test_questions_unknown_slug_404(anon, topics, slug):
    topics.playable()
    assert anon.get(f"{TOPICS}{slug}/questions/").status_code == 404


def test_questions_not_enough_404(anon, topics):
    topic = topics.playable(7)
    assert anon.get(f"{TOPICS}{services.topic_slug(topic)}/questions/").status_code == 404


def test_check_answer(anon, topics):
    topic = topics.playable()
    slug = services.topic_slug(topic)
    question = anon.get(f"{TOPICS}{slug}/questions/").json()["questions"][0]
    correct = Option.objects.get(question_id=question["id"], is_correct=True)
    wrong = Option.objects.filter(question_id=question["id"], is_correct=False).first()
    token = question["answer_token"]

    ok = anon.post(CHECK, {"answer_token": token, "option_id": str(correct.pk)}, format="json")
    assert ok.json() == {"correct": True, "correct_option_id": str(correct.pk)}
    bad = anon.post(CHECK, {"answer_token": token, "option_id": str(wrong.pk)}, format="json")
    assert bad.json() == {"correct": False, "correct_option_id": str(correct.pk)}


def test_token_does_not_reveal_answer(topics):
    question = make_question(topics.chapter(), correct=2)
    payload = signing.loads(services.answer_token(question), salt=services.ANSWER_TOKEN_SALT)
    assert payload == {"q": question.pk.hex}


@pytest.mark.parametrize("case", ["tampered", "foreign_option", "expired", "garbage"])
def test_check_rejects_bad_tokens(anon, topics, settings, case):
    a = make_question(topics.chapter(), 0)
    b = make_question(topics.chapter(title="Boshqa"), 1)
    token = services.answer_token(a)
    option = a.options.first().pk
    if case == "tampered":
        token = services.answer_token(b)[:-2] + "xx"
    elif case == "foreign_option":
        option = b.options.first().pk
    elif case == "expired":
        settings.GAMES_ANSWER_TOKEN_MAX_AGE = -1
    else:
        token = "nonsense"
    response = anon.post(CHECK, {"answer_token": token, "option_id": str(option)}, format="json")
    assert response.status_code == 400
    assert response.json()["code"] == "invalid_answer_token"


def test_check_unknown_option_validation(anon):
    response = anon.post(CHECK, {"answer_token": "x", "option_id": "nope"}, format="json")
    assert response.status_code == 400
    assert response.json()["code"] == "validation_error"
