import pytest
from django.core.management import call_command
from django.core.management.base import CommandError

from apps.content.models import PdfBook, Subject

pytestmark = pytest.mark.django_db


def run(*args, **kwargs):
    call_command("merge_subjects", *args, **kwargs)


def test_dry_run_changes_nothing(catalog, capsys):
    good = catalog.subject("algebra")
    old = catalog.subject("algebra-2")
    book = catalog.pdf_book(old, grade=9)

    run("--dry-run")

    assert Subject.objects.filter(pk=old.pk).exists()
    book.refresh_from_db()
    assert book.subject_id == old.pk
    assert str(good.pk) in capsys.readouterr().out


def test_apply_moves_books_then_deletes_duplicate(catalog, tmp_path):
    good = catalog.subject("algebra")
    old = catalog.subject("algebra-2")
    book = catalog.pdf_book(old, grade=9)
    other = catalog.pdf_book(good, grade=8)

    run("--yes", backup=str(tmp_path / "b.json"))

    assert not Subject.objects.filter(pk=old.pk).exists()
    assert PdfBook.objects.count() == 2
    book.refresh_from_db()
    other.refresh_from_db()
    assert book.subject_id == good.pk
    assert other.subject_id == good.pk
    assert (tmp_path / "b.json").exists()


def test_requires_yes(catalog, tmp_path):
    catalog.subject("algebra")
    old = catalog.subject("algebra-2")
    with pytest.raises(CommandError):
        run(backup=str(tmp_path / "b.json"))
    assert Subject.objects.filter(pk=old.pk).exists()


def test_title_duplicate_with_other_slug(catalog, tmp_path):
    good = catalog.subject("fizika")
    old = Subject.objects.create(slug="physics-old", title={"uz": "Fizika"}, order=2)
    book = catalog.pdf_book(old, grade=7)

    run("--yes", backup=str(tmp_path / "b.json"))

    book.refresh_from_db()
    assert book.subject_id == good.pk
    assert not Subject.objects.filter(pk=old.pk).exists()


def test_grade_mismatch_aborts_without_extend(catalog, tmp_path):
    good = catalog.subject("algebra", grades=[7, 8])
    old = catalog.subject("algebra-2")
    catalog.pdf_book(old, grade=11)

    with pytest.raises(CommandError):
        run("--yes", backup=str(tmp_path / "b.json"))
    assert Subject.objects.filter(pk=old.pk).exists()

    run("--yes", "--extend-grades", backup=str(tmp_path / "c.json"))
    good.refresh_from_db()
    assert 11 in good.grades
    assert not Subject.objects.filter(pk=old.pk).exists()


def test_prune_unknown_requires_map_when_it_has_books(catalog, tmp_path):
    catalog.subject("algebra")
    legacy = catalog.subject("eski-fan")
    book = catalog.pdf_book(legacy, grade=9)

    with pytest.raises(CommandError):
        run("--prune-unknown", "--yes", backup=str(tmp_path / "b.json"))
    assert Subject.objects.filter(pk=legacy.pk).exists()

    run("--prune-unknown", "--map", "eski-fan=algebra", "--yes", backup=str(tmp_path / "c.json"))
    book.refresh_from_db()
    assert book.subject.slug == "algebra"
    assert not Subject.objects.filter(pk=legacy.pk).exists()
