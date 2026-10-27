import pytest
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.content.models import PdfBookChapter, Subject
from apps.content.tests.conftest import Catalog, clear_cache  # noqa: F401 — autouse fixture
from apps.core.tests.passwords import TEST_PASSWORD
from apps.games.models import Option, Question


def client_as(role=None, email=None):
    client = APIClient()
    if role:
        email = email or f"{role}@example.com"
        user = User.objects.create_user(email=email, password=TEST_PASSWORD)
        user.role = role
        user.save()
        client.force_authenticate(user)
        client.user = user
    return client


def make_question(topic, n=0, correct=0, active=True, **over):
    question = Question.objects.create(
        topic=topic,
        text=over.pop("text", {"uz": f"Savol {n}", "ru": f"Вопрос {n}"}),
        order=n,
        is_active=active,
        **over,
    )
    for order in range(4):
        Option.objects.create(
            question=question,
            text={"uz": f"Variant {n}.{order}"},
            is_correct=order == correct,
            order=order,
        )
    return question


def question_payload(**over):
    return {
        "text": {"uz": "2 + 2 nechaga teng?", "ru": "Сколько будет 2 + 2?"},
        "difficulty": "easy",
        "options": [
            {"text": {"uz": "3"}, "is_correct": False},
            {"text": {"uz": "4"}, "is_correct": True},
            {"text": {"uz": "5"}, "is_correct": False},
            {"text": {"uz": "22"}, "is_correct": False},
        ],
        **over,
    }


class Topics:
    def __init__(self, catalog):
        self.catalog = catalog

    def chapter(self, book=None, title="Kvadrat tenglamalar", page=3, status="published", **over):
        if book is None:
            subject = (
                over.pop("subject", None)
                or Subject.objects.filter(slug="algebra").first()
                or self.catalog.subject("algebra")
            )
            title_ = over.pop("book_title", None) or {"uz": "Algebra 9", "ru": "Алгебра 9"}
            book = self.catalog.pdf_book(
                subject, grade=over.pop("grade", 9), status=status, title=title_
            )
        return PdfBookChapter.objects.create(book=book, title=title, page=page, **over)

    def playable(self, questions=8, **over):
        topic = self.chapter(**over)
        for n in range(questions):
            make_question(topic, n, correct=n % 4)
        return topic


@pytest.fixture
def catalog(db):
    return Catalog()


@pytest.fixture
def topics(catalog):
    return Topics(catalog)


@pytest.fixture
def editor(db):
    return client_as("editor")


@pytest.fixture
def admin(db):
    return client_as("admin")


@pytest.fixture
def student(db):
    return client_as("student")
