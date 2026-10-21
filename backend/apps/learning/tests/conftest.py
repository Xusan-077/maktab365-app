import pytest
from rest_framework.test import APIClient

from apps.accounts.models import Profile, User
from apps.content.tests.conftest import Catalog, clear_cache  # noqa: F401 — autouse fixture

DISCRIMINANT = "algebra-9-diskriminant"
VIYET = "algebra-9-viyet"
CHISIQLI = "algebra-9-chiziqli"
PIFAGOR = "geometry-8-pifagor"
DRAFT = "algebra-9-qoralama"
# topic-valid.json dagi mashq bloklari
EXERCISES = ["exercise-choice", "exercise-input", "exercise-truefalse", "exercise-order"]


@pytest.fixture
def library(db):
    """Algebra-9 (3 published + 1 draft mavzu, 2 bob) va Geometriya-8 (1 mavzu)."""
    catalog = Catalog()
    algebra = catalog.subject("algebra")
    geometry = catalog.subject("geometriya")
    book = catalog.book(algebra, "algebra-9", 9)
    other = catalog.book(geometry, "geometry-8", 8)
    ch1 = catalog.chapter(book, "kvadrat", 1)
    ch2 = catalog.chapter(book, "tengsizliklar", 2)
    catalog.topic(ch1, "diskriminant", 1)
    catalog.topic(ch1, "viyet", 2)
    catalog.topic(ch2, "chiziqli", 1)
    catalog.topic(ch2, "qoralama", 2, status="draft")
    catalog.topic(catalog.chapter(other, "uchburchak", 1), "pifagor", 1)
    return {"book": book, "other": other}


def make_user(email, **profile):
    user = User.objects.create_user(email=email, password="s3cret-pass-1")
    if profile:
        Profile.objects.update_or_create(user=user, defaults=profile)
    return user


def client_for(user):
    client = APIClient()
    client.force_authenticate(user)
    return client


@pytest.fixture
def user(db):
    return make_user("ali@example.com")


@pytest.fixture
def api(user):
    return client_for(user)


@pytest.fixture
def other_api(db):
    return client_for(make_user("vali@example.com"))
