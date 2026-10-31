import pytest
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.core.tests.passwords import TEST_PASSWORD
from apps.quizzes.models import Quiz, QuizAttempt, QuizCategory

pytestmark = pytest.mark.django_db


def client_as(role=None, email=None):
    client = APIClient()
    if role:
        user = User.objects.create_user(
            email=email or f"{role}@example.com", password=TEST_PASSWORD
        )
        user.role = role
        user.save()
        client.force_authenticate(user)
        client.user = user
    return client


def payload(**over):
    return {
        "title": "Zakovat 1",
        "description": "Yengil test",
        "visibility": "private",
        "time_per_question": 15,
        "shuffle_questions": True,
        "shuffle_options": False,
        "questions": [
            {
                "text": "2 + 2?",
                "options": [
                    {"text": "3", "is_correct": False},
                    {"text": "4", "is_correct": True},
                ],
            },
            {
                "text": "Poytaxt?",
                "options": [
                    {"text": "Toshkent", "is_correct": True},
                    {"text": "Samarqand", "is_correct": False},
                    {"text": "Buxoro", "is_correct": False},
                ],
            },
        ],
        **over,
    }


@pytest.fixture
def teacher():
    return client_as("teacher")


def create(client, **over):
    response = client.post("/api/v1/quizzes/", payload(**over), format="json")
    assert response.status_code == 201, response.data
    return response.data


def test_permissions():
    assert client_as().get("/api/v1/quizzes/").status_code in (401, 403)
    assert client_as("student").get("/api/v1/quizzes/").status_code == 403


def test_create_nested_and_list(teacher):
    quiz = create(teacher)
    assert len(quiz["questions"]) == 2
    assert quiz["questions"][0]["options"][1]["is_correct"] is True
    items = teacher.get("/api/v1/quizzes/").data
    assert items[0]["question_count"] == 2
    assert items[0]["best_percent"] is None


@pytest.mark.parametrize(
    ("questions", "code"),
    [
        ([], "questions_required"),
        (
            [{"text": "?", "options": [{"text": "a", "is_correct": True}]}],
            "options_count",
        ),
        (
            [
                {
                    "text": "?",
                    "options": [
                        {"text": "a", "is_correct": True},
                        {"text": "b", "is_correct": True},
                    ],
                }
            ],
            "options_one_correct",
        ),
    ],
)
def test_validation_codes(teacher, questions, code):
    response = teacher.post("/api/v1/quizzes/", payload(questions=questions), format="json")
    assert response.status_code == 400
    assert code in str(response.data)


def test_ownership(teacher):
    quiz = create(teacher)
    other = client_as("teacher", "other@example.com")
    assert other.get(f"/api/v1/quizzes/{quiz['id']}/").status_code == 404
    assert other.delete(f"/api/v1/quizzes/{quiz['id']}/").status_code == 404
    assert other.get("/api/v1/quizzes/").data == []


def test_update_keeps_ids_and_replaces_correct(teacher):
    quiz = create(teacher)
    body = payload(title="Yangi")
    first = quiz["questions"][0]
    body["questions"] = [
        {
            "id": first["id"],
            "text": first["text"],
            "options": [
                {"id": first["options"][0]["id"], "text": "3", "is_correct": True},
                {"id": first["options"][1]["id"], "text": "4", "is_correct": False},
            ],
        }
    ]
    response = teacher.put(f"/api/v1/quizzes/{quiz['id']}/", body, format="json")
    assert response.status_code == 200, response.data
    assert response.data["title"] == "Yangi"
    assert len(response.data["questions"]) == 1
    assert response.data["questions"][0]["id"] == first["id"]
    assert response.data["questions"][0]["options"][0]["is_correct"] is True


def test_categories(teacher):
    names = [c["name"] for c in teacher.get("/api/v1/quizzes/categories/").data]
    assert names[:2] == ["Zakovat", "IQ"]
    assert teacher.post("/api/v1/quizzes/categories/", {"name": "Kino"}).status_code == 201
    assert teacher.post("/api/v1/quizzes/categories/", {"name": "kino"}).status_code == 400
    other = client_as("teacher", "other@example.com")
    assert "Kino" not in [c["name"] for c in other.get("/api/v1/quizzes/categories/").data]


def test_foreign_category_rejected(teacher):
    other = client_as("teacher", "other@example.com")
    foreign = QuizCategory.objects.create(name="Mening", teacher=other.user)
    response = teacher.post("/api/v1/quizzes/", payload(category_id=str(foreign.pk)), format="json")
    assert response.status_code == 400


def test_attempt_graded_on_server(teacher):
    quiz = create(teacher)
    q1, q2 = quiz["questions"]
    answers = [
        {"question_id": q1["id"], "option_id": q1["options"][1]["id"]},
        {"question_id": q2["id"], "option_id": q2["options"][1]["id"]},
    ]
    response = teacher.post(
        f"/api/v1/quizzes/{quiz['id']}/attempts/",
        {"answers": answers, "time_spent": 42},
        format="json",
    )
    assert response.status_code == 201, response.data
    assert (response.data["score"], response.data["total"]) == (1, 2)
    assert response.data["answers"][1]["correct_option_text"] == "Toshkent"
    listed = teacher.get("/api/v1/quizzes/").data[0]
    assert listed["best_percent"] == 50
    assert len(teacher.get(f"/api/v1/quizzes/{quiz['id']}/attempts/").data) == 1


def test_attempt_rejects_foreign_option_and_unanswered_is_wrong(teacher):
    quiz = create(teacher)
    q1, q2 = quiz["questions"]
    bad = teacher.post(
        f"/api/v1/quizzes/{quiz['id']}/attempts/",
        {
            "answers": [{"question_id": q1["id"], "option_id": q2["options"][0]["id"]}],
            "time_spent": 1,
        },
        format="json",
    )
    assert bad.status_code == 400
    empty = teacher.post(
        f"/api/v1/quizzes/{quiz['id']}/attempts/", {"answers": [], "time_spent": 1}, format="json"
    )
    assert empty.data["score"] == 0
    assert QuizAttempt.objects.count() == 1


def test_duplicate_is_private_copy(teacher):
    quiz = create(teacher, visibility="public")
    response = teacher.post(f"/api/v1/quizzes/{quiz['id']}/duplicate/")
    assert response.status_code == 201
    assert response.data["visibility"] == "private"
    assert response.data["id"] != quiz["id"]
    assert len(response.data["questions"]) == 2
    assert Quiz.objects.count() == 2


def test_public_quiz_hides_answers_and_checks(teacher):
    quiz = create(teacher, visibility="public")
    anon = client_as()
    response = anon.get(f"/api/v1/quizzes/public/{quiz['id']}/")
    assert response.status_code == 200
    assert "is_correct" not in str(response.data)
    question = response.data["questions"][0]
    right = quiz["questions"][0]["options"][1]["id"]
    wrong = quiz["questions"][0]["options"][0]["id"]
    url = f"/api/v1/quizzes/public/{quiz['id']}/check/"
    ok = anon.post(url, {"question_id": question["id"], "option_id": right}, format="json")
    assert ok.data["correct"] is True
    bad = anon.post(url, {"question_id": question["id"], "option_id": wrong}, format="json")
    assert bad.data == {"correct": False, "correct_option_id": right}
    assert QuizAttempt.objects.count() == 0


def test_private_quiz_not_public(teacher):
    quiz = create(teacher)
    anon = client_as()
    assert anon.get(f"/api/v1/quizzes/public/{quiz['id']}/").status_code == 404


def test_list_is_newest_first_even_with_annotations(teacher):
    first = create(teacher, title="Birinchi")
    second = create(teacher, title="Ikkinchi")
    assert [q["title"] for q in teacher.get("/api/v1/quizzes/").data] == ["Ikkinchi", "Birinchi"]
    # Tahrirlangan test yuqoriga chiqadi.
    teacher.put(f"/api/v1/quizzes/{first['id']}/", payload(title="Birinchi*"), format="json")
    assert teacher.get("/api/v1/quizzes/").data[0]["id"] == first["id"]
    copy = teacher.post(f"/api/v1/quizzes/{second['id']}/duplicate/")
    assert teacher.get("/api/v1/quizzes/").data[0]["id"] == copy.data["id"]
