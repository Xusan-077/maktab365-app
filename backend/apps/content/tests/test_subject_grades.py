import pytest
from django.core.exceptions import ValidationError
from django.core.management import call_command
from django.db import connection
from django.db.migrations.executor import MigrationExecutor

from apps.content.management.commands.seed_subjects import GRADES, SUBJECTS
from apps.content.models import ALL_GRADES, PdfBook, Subject, validate_grades

from .test_admin_api import client_as, subject_payload

ADMIN = "/api/v1/admin"
PUBLIC = "/api/v1/pdf-books"


@pytest.fixture
def editor(db):
    return client_as("editor")


def test_model_default_is_all_grades(db):
    assert Subject.objects.create(slug="x", title={"uz": "X"}).grades == ALL_GRADES


@pytest.mark.parametrize(
    ("value", "code"),
    [
        ([], "grades_required"),
        ([0, 3], "grades_invalid"),
        ([12], "grades_invalid"),
        ([5, 5], "grades_duplicate"),
    ],
)
def test_model_validator(value, code):
    with pytest.raises(ValidationError) as exc:
        validate_grades(value)
    assert exc.value.code == code


def test_create_defaults_to_all_grades_and_sorts(editor):
    default = editor.post(f"{ADMIN}/subjects/", subject_payload(), "json")
    assert default.status_code == 201 and default.data["grades"] == ALL_GRADES
    custom = editor.post(
        f"{ADMIN}/subjects/", subject_payload(slug="adabiyot", grades=[11, 5, 7]), "json"
    )
    assert custom.data["grades"] == [5, 7, 11]


@pytest.mark.parametrize(
    ("grades", "code"),
    [
        ([], "grades_required"),
        ([0], "grades_invalid"),
        ([12], "grades_invalid"),
        ([5, 5], "grades_duplicate"),
    ],
)
def test_admin_validates_grades(editor, grades, code):
    resp = editor.post(f"{ADMIN}/subjects/", subject_payload(grades=grades), "json")
    assert resp.status_code == 400 and code in resp.data["details"]["grades"]


def test_removing_grade_with_books_is_409_and_keeps_books(editor, catalog):
    subject = catalog.subject("fizika", grades=[7, 8, 9])
    catalog.pdf_book(subject, 7)
    catalog.pdf_book(subject, 7, status="draft")
    catalog.pdf_book(subject, 9)

    resp = editor.patch(f"{ADMIN}/subjects/{subject.pk}/", {"grades": [8, 9]}, "json")

    assert resp.status_code == 409 and resp.data["code"] == "grade_has_books"
    assert resp.data["details"] == {"conflicts": ["7:2"]}
    subject.refresh_from_db()
    assert subject.grades == [7, 8, 9] and PdfBook.objects.count() == 3


def test_removing_empty_grade_and_adding_grades_is_ok(editor, catalog):
    subject = catalog.subject("fizika", grades=[7, 8, 9])
    catalog.pdf_book(subject, 9)
    ok = editor.patch(f"{ADMIN}/subjects/{subject.pk}/", {"grades": [9, 10]}, "json")
    assert ok.status_code == 200 and ok.data["grades"] == [9, 10]


def test_admin_subjects_grade_filter(editor, catalog):
    catalog.subject("fizika", grades=[7, 8])
    catalog.subject("tarix", grades=[5, 6])
    rows = editor.get(f"{ADMIN}/subjects/", {"grade": 7}).data["results"]
    assert [r["slug"] for r in rows] == ["fizika"]


def test_book_subject_must_belong_to_grade(editor, catalog):
    catalog.subject("fizika", grades=[7, 8])
    body = {"title": {"uz": "F"}, "grade": 5, "subject": "fizika"}
    resp = editor.post(f"{ADMIN}/pdf-books/", body, "json")
    assert resp.status_code == 400
    assert resp.data["code"] == "validation_error"
    assert resp.data["details"]["subject"] == ["subject_not_in_grade"]

    book = editor.post(f"{ADMIN}/pdf-books/", {**body, "grade": 7}, "json")
    assert book.status_code == 201
    url = f"{ADMIN}/pdf-books/{book.data['id']}/"
    assert editor.patch(url, {"grade": 11}, "json").status_code == 400  # sinf o'zgardi
    catalog.subject("tarix", grades=[5])
    assert editor.patch(url, {"subject": "tarix"}, "json").status_code == 400  # fan o'zgardi
    assert editor.patch(url, {"title": {"uz": "Yangi"}}, "json").status_code == 200


def test_legacy_book_outside_grades_stays_editable(editor, catalog):
    """Sinflar keyin o'zgargan eski kitob: sinf/fanga tegilmaydigan tahrir buzilmaydi."""
    subject = catalog.subject("fizika")
    book = catalog.pdf_book(subject, 3)
    Subject.objects.filter(pk=subject.pk).update(grades=[7])
    resp = editor.patch(f"{ADMIN}/pdf-books/{book.pk}/", {"title": {"uz": "Yangi"}}, "json")
    assert resp.status_code == 200


def test_public_subjects_filtered_by_grade_and_expose_grades(catalog):
    from rest_framework.test import APIClient

    anon = APIClient()
    fizika = catalog.subject("fizika", grades=[7, 8])
    tarix = catalog.subject("tarix", grades=[5, 6])
    catalog.subject("kimyo", grades=[7])  # kitobi yo'q: ochiq katalogda ko'rinmaydi
    catalog.pdf_book(fizika, 7)
    catalog.pdf_book(tarix, 5)

    seven = anon.get(f"{PUBLIC}/subjects/", {"grade": 7}).json()
    five = anon.get(f"{PUBLIC}/subjects/", {"grade": 5}).json()

    assert [s["slug"] for s in seven] == ["fizika"] and seven[0]["grades"] == [7, 8]
    assert [s["slug"] for s in five] == ["tarix"]


def test_seed_assigns_grades_and_keeps_manual_edits(db):
    assert set(GRADES) == set(SUBJECTS)
    call_command("seed_subjects")
    assert Subject.objects.get(slug="algebra").grades == GRADES["algebra"]
    Subject.objects.filter(slug="algebra").update(grades=[10])
    call_command("seed_subjects")
    assert Subject.objects.get(slug="algebra").grades == [10]
    call_command("seed_subjects", "--force")
    assert Subject.objects.get(slug="algebra").grades == GRADES["algebra"]


@pytest.mark.django_db(transaction=True)
def test_migration_fills_existing_subjects_with_all_grades():
    executor = MigrationExecutor(connection)
    executor.migrate([("content", "0011_pdfbook_slug_unique")])
    old = executor.loader.project_state([("content", "0011_pdfbook_slug_unique")]).apps
    OldSubject, OldBook = old.get_model("content", "Subject"), old.get_model("content", "PdfBook")
    subject = OldSubject.objects.create(slug="eski", title={"uz": "Eski"})
    book = OldBook.objects.create(title={"uz": "K"}, grade=2, subject=subject, slug="2-sinf-eski")

    executor = MigrationExecutor(connection)
    executor.loader.build_graph()
    executor.migrate(executor.loader.graph.leaf_nodes())

    assert Subject.objects.get(slug="eski").grades == ALL_GRADES
    assert PdfBook.objects.filter(pk=book.pk).exists()
