"""Shaxsiy rejalar: CRUD, egalik, cheklov, akkaunt ma'lumoti."""

import pytest
from rest_framework.test import APIClient

from apps.learning.models import StudyGoal
from apps.learning.services.goals import GOALS_LIMIT

from .conftest import Catalog

pytestmark = pytest.mark.django_db

GOALS = "/api/v1/me/goals/"


@pytest.fixture
def book(db):
    catalog = Catalog()
    return catalog.pdf_book(catalog.subject("algebra"), 9, pages=20)


def create(api, **body):
    return api.post(GOALS, {"title": "Algebra 1-bob", **body}, "json")


def test_requires_login():
    assert APIClient().get(GOALS).status_code == 401
    assert APIClient().post(GOALS, {"title": "x"}, "json").status_code == 401


def test_create_list_and_shape(api, book):
    resp = create(api, pdf_book_id=str(book.pk), due_date="2026-12-01")

    assert resp.status_code == 201
    body = resp.json()
    assert body["title"] == "Algebra 1-bob" and body["done"] is False
    assert body["book"]["id"] == str(book.pk) and body["due_date"] == "2026-12-01"
    assert [g["id"] for g in api.get(GOALS).json()] == [body["id"]]


def test_create_without_book_or_due_date(api):
    body = create(api).json()

    assert body["book"] is None and body["due_date"] is None


@pytest.mark.parametrize("title", ["", "   "])
def test_blank_title_rejected(api, title):
    assert api.post(GOALS, {"title": title}, "json").status_code == 400
    assert not StudyGoal.objects.exists()


def test_hidden_book_rejected(api, book):
    draft = Catalog().pdf_book(book.subject, 9, "draft")

    assert create(api, pdf_book_id=str(draft.pk)).status_code == 404
    assert not StudyGoal.objects.exists()


def test_done_is_idempotent_and_reversible(api):
    goal_id = create(api).json()["id"]
    url = f"{GOALS}{goal_id}/"

    first = api.patch(url, {"done": True}, "json").json()
    second = api.patch(url, {"done": True}, "json").json()
    assert first["done"] is True and first["done_at"] == second["done_at"]

    assert api.patch(url, {"done": False}, "json").json()["done_at"] is None


def test_done_goals_sort_after_open(api):
    first = create(api, title="a").json()["id"]
    create(api, title="b")
    api.patch(f"{GOALS}{first}/", {"done": True}, "json")

    assert [g["title"] for g in api.get(GOALS).json()] == ["b", "a"]


def test_patch_updates_fields(api, book):
    goal_id = create(api).json()["id"]

    body = api.patch(
        f"{GOALS}{goal_id}/", {"title": "Yangi", "pdf_book_id": str(book.pk)}, "json"
    ).json()

    assert body["title"] == "Yangi" and body["book"]["id"] == str(book.pk)
    cleared = api.patch(f"{GOALS}{goal_id}/", {"pdf_book_id": None}, "json").json()
    assert cleared["book"] is None


def test_other_users_goal_is_invisible(api, other_api):
    goal_id = create(api).json()["id"]
    url = f"{GOALS}{goal_id}/"

    assert other_api.get(url).status_code == 404
    assert other_api.patch(url, {"done": True}, "json").status_code == 404
    assert other_api.delete(url).status_code == 204  # idempotent, lekin hech narsa o'chmaydi
    assert other_api.get(GOALS).json() == []
    assert StudyGoal.objects.filter(pk=goal_id, done_at__isnull=True).exists()


def test_delete_is_idempotent(api):
    goal_id = create(api).json()["id"]
    url = f"{GOALS}{goal_id}/"

    assert api.delete(url).status_code == 204
    assert api.delete(url).status_code == 204
    assert api.get(url).status_code == 404
    assert api.get(f"{GOALS}not-a-uuid/").status_code == 404


def test_goals_limit(api, user):
    StudyGoal.objects.bulk_create(StudyGoal(user=user, title=str(i)) for i in range(GOALS_LIMIT))

    resp = create(api)

    assert resp.status_code == 409 and resp.json()["code"] == "goals_limit_reached"


def test_book_deletion_keeps_goal(api, book):
    goal_id = create(api, pdf_book_id=str(book.pk)).json()["id"]

    book.delete()

    assert api.get(f"{GOALS}{goal_id}/").json()["book"] is None


def test_account_export_and_delete_cover_goals(api, other_api):
    create(api)
    create(other_api)

    assert len(api.get("/api/v1/me/export/").json()["learning"]["goals"]) == 1
    assert api.delete("/api/v1/me/").status_code == 204
    assert StudyGoal.objects.count() == 1
