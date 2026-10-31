import uuid

import pytest

from apps.accounts.models import AuditLog
from apps.games.models import Question

from .conftest import client_as, make_question, question_payload

pytestmark = pytest.mark.django_db

BASE = "/api/v1/admin"


def url(topic):
    return f"{BASE}/topics/{topic.pk}/questions/"


@pytest.mark.parametrize(
    ("role", "expected"),
    [(None, 401), ("student", 403), ("teacher", 403), ("editor", 200), ("admin", 200)],
)
def test_list_permission_matrix(topics, role, expected):
    assert client_as(role).get(url(topics.chapter())).status_code == expected


def test_list_includes_inactive_in_order(editor, topics):
    topic = topics.chapter()
    make_question(topic, 1)
    make_question(topic, 0, active=False)
    data = editor.get(url(topic)).json()
    assert [q["text"]["uz"] for q in data] == ["Savol 0", "Savol 1"]
    assert data[0]["is_active"] is False
    assert [o["order"] for o in data[0]["options"]] == [0, 1, 2, 3]


def test_draft_book_topic_is_editable(editor, topics):
    topic = topics.chapter(status="draft")
    assert editor.post(url(topic), question_payload(), format="json").status_code == 201


def test_unknown_topic_404(editor, db):
    assert editor.get(f"{BASE}/topics/{uuid.uuid4()}/questions/").status_code == 404


def test_create_appends_and_audits(editor, topics):
    topic = topics.chapter()
    make_question(topic, 0)
    response = editor.post(url(topic), question_payload(), format="json")
    assert response.status_code == 201, response.json()
    body = response.json()
    assert body["order"] == 1
    assert body["image_url"] is None
    assert [o["is_correct"] for o in body["options"]] == [False, True, False, False]
    assert AuditLog.objects.filter(action="create", target_type="question").exists()


@pytest.mark.parametrize(
    ("options", "code"),
    [
        ([{"text": {"uz": "a"}, "is_correct": True}] * 3, "options_count"),
        ([{"text": {"uz": "a"}, "is_correct": False}] * 4, "options_one_correct"),
        ([{"text": {"uz": "a"}, "is_correct": True}] * 2 + [{"text": {"uz": "b"}}] * 2,
         "options_one_correct"),
    ],
)  # fmt: skip
def test_create_validates_options(editor, topics, options, code):
    response = editor.post(url(topics.chapter()), question_payload(options=options), format="json")
    assert response.status_code == 400
    assert code in response.json()["details"]["options"]
    assert not Question.objects.exists()


def test_create_requires_uz_text(editor, topics):
    response = editor.post(
        url(topics.chapter()), question_payload(text={"ru": "Вопрос"}), format="json"
    )
    assert response.status_code == 400
    assert "text" in response.json()["details"]


@pytest.fixture
def local_storage(settings, tmp_path):
    settings.STORAGES = {
        **settings.STORAGES,
        "covers": {
            "BACKEND": "django.core.files.storage.FileSystemStorage",
            "OPTIONS": {"location": str(tmp_path), "base_url": "/m/"},
        },
    }
    return tmp_path


def test_image_uploaded_path(editor, topics, local_storage):
    (local_storage / "images").mkdir()
    (local_storage / "images" / "a.png").write_bytes(b"x")
    response = editor.post(
        url(topics.chapter()), question_payload(image="images/a.png"), format="json"
    )
    assert response.status_code == 201, response.json()
    assert response.json()["image_url"].endswith("/images/a.png")


def test_image_must_be_uploaded_path(editor, topics, local_storage):
    response = editor.post(
        url(topics.chapter()), question_payload(image="images/missing.png"), format="json"
    )
    assert response.status_code == 400
    assert response.json()["details"]["image"] == ["invalid_file"]


def test_update_moves_correct_answer_keeps_option_ids(editor, topics):
    question = make_question(topics.chapter(), correct=0)
    ids = list(question.options.values_list("pk", flat=True))
    payload = question_payload()  # to'g'ri javob — B
    response = editor.patch(f"{BASE}/questions/{question.pk}/", payload, format="json")
    assert response.status_code == 200, response.json()
    question.refresh_from_db()
    assert list(question.options.values_list("pk", flat=True)) == ids
    flags = list(question.options.values_list("is_correct", flat=True))
    assert flags == [False, True, False, False]
    question.full_clean()


def test_toggle_active(editor, topics):
    question = make_question(topics.chapter())
    response = editor.patch(f"{BASE}/questions/{question.pk}/", {"is_active": False}, format="json")
    assert response.status_code == 200
    question.refresh_from_db()
    assert question.is_active is False


def test_delete_only_admin(editor, admin, topics):
    question = make_question(topics.chapter())
    assert editor.delete(f"{BASE}/questions/{question.pk}/").status_code == 403
    assert admin.delete(f"{BASE}/questions/{question.pk}/").status_code == 204
    assert not Question.objects.exists()


def test_reorder(editor, topics):
    topic = topics.chapter()
    a, b, c = (make_question(topic, n) for n in range(3))
    response = editor.post(
        f"{url(topic)}reorder/", {"ids": [str(c.pk), str(a.pk), str(b.pk)]}, format="json"
    )
    assert response.status_code == 200
    assert [q["id"] for q in response.json()] == [str(c.pk), str(a.pk), str(b.pk)]


@pytest.mark.parametrize("variant", ["missing", "duplicate", "foreign"])
def test_reorder_requires_exact_set(editor, topics, variant):
    topic = topics.chapter()
    a, b = make_question(topic, 0), make_question(topic, 1)
    ids = {
        "missing": [a.pk],
        "duplicate": [a.pk, a.pk, b.pk],
        "foreign": [a.pk, b.pk, uuid.uuid4()],
    }[variant]
    response = editor.post(f"{url(topic)}reorder/", {"ids": [str(i) for i in ids]}, format="json")
    assert response.status_code == 400
    assert response.json()["details"]["ids"] == ["ids_mismatch"]


def test_import_dry_run_saves_nothing(editor, topics):
    topic = topics.chapter()
    body = {"questions": [question_payload(), question_payload()], "dry_run": True}
    response = editor.post(f"{url(topic)}import/", body, format="json")
    assert response.json() == {"created": 2, "dry_run": True}
    assert not Question.objects.exists()


def test_import_creates_all_after_existing(editor, topics):
    topic = topics.chapter()
    make_question(topic, 0)
    body = {"questions": [question_payload(), question_payload(difficulty="hard")]}
    response = editor.post(f"{url(topic)}import/", body, format="json")
    assert response.json() == {"created": 2, "dry_run": False}
    assert list(topic.questions.order_by("order").values_list("order", flat=True)) == [0, 1, 2]
    for question in topic.questions.all():
        question.full_clean()


def test_import_is_all_or_nothing_with_row_errors(editor, topics):
    topic = topics.chapter()
    bad = question_payload(options=question_payload()["options"][:3])
    response = editor.post(
        f"{url(topic)}import/", {"questions": [question_payload(), bad]}, format="json"
    )
    assert response.status_code == 400
    rows = response.json()["details"]["questions"]
    # Xatolar qator indeksi bo'yicha (faqat xatoli qatorlar).
    assert rows == {"1": {"options": ["options_count"]}}
    assert not Question.objects.exists()
