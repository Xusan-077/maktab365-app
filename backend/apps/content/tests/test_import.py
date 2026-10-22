import json
from io import StringIO
from pathlib import Path

import pytest
from django.core.exceptions import ValidationError
from django.core.management import CommandError, call_command

from apps.content.models import REVISION_LIMIT, Book, Chapter, Subject, Topic, TopicRevision

pytestmark = pytest.mark.django_db

FIXTURES = Path(__file__).resolve().parents[4] / "contracts" / "fixtures"


def topic_data(**over):
    data = json.loads((FIXTURES / "topic-valid.json").read_text(encoding="utf-8"))
    data.pop("notes")
    data.update(over)
    return data


def write(root, key, data):
    path = root / f"{key}.json"
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")


@pytest.fixture
def tree(tmp_path):
    write(tmp_path, "algebra/algebra-9/kvadrat/chapter", {"order": 1, "title": {"uz": "Bob"}})
    write(tmp_path, "algebra/algebra-9/kvadrat/diskriminant", topic_data())
    write(tmp_path, "algebra/algebra-9/kvadrat/viyet", topic_data(order=2))
    return tmp_path


def run(root, *args):
    out = StringIO()
    call_command("import_content", str(root), *args, stdout=out)
    return out.getvalue()


def test_import_creates_catalog(tree):
    run(tree)
    book = Book.objects.get(slug="algebra-9")
    assert (Subject.objects.count(), Chapter.objects.count(), Topic.objects.count()) == (1, 1, 2)
    assert book.subject.slug == "algebra"
    assert book.grade == 9
    assert book.is_published and book.topics_ready
    topic = Topic.objects.get(book=book, slug="diskriminant")
    assert topic.summary == {"uz": "Maqsad"}
    assert topic.book_id == book.id
    assert topic.revisions.count() == 1


def test_import_is_idempotent(tree):
    run(tree)
    snapshot = list(Topic.objects.order_by("slug").values("id", "updated_at"))
    out = run(tree)
    assert "0 yangi, 0 yangilandi, 2 o'zgarmadi" in out
    assert list(Topic.objects.order_by("slug").values("id", "updated_at")) == snapshot
    assert TopicRevision.objects.count() == 2


def test_dry_run_writes_nothing(tree):
    out = run(tree, "--dry-run")
    assert "DRY-RUN" in out and "2 yangi" in out
    assert Subject.objects.count() == 0 and Topic.objects.count() == 0


def test_update_changes_content_and_makes_revision(tree):
    run(tree)
    write(tree, "algebra/algebra-9/kvadrat/diskriminant", topic_data(title={"uz": "Yangi"}))
    out = run(tree)
    assert "1 yangilandi, 1 o'zgarmadi" in out
    topic = Topic.objects.get(slug="diskriminant")
    assert topic.title == {"uz": "Yangi"}
    assert topic.revisions.count() == 2
    assert topic.revisions.first().comment == "import"


def test_status_is_preserved(tree):
    run(tree)
    Topic.objects.filter(slug="diskriminant").update(status="published")
    write(tree, "algebra/algebra-9/kvadrat/diskriminant", topic_data(title={"uz": "Yangi"}))
    run(tree)
    assert Topic.objects.get(slug="diskriminant").status == "published"
    # Fayldagi yuqoriroq status ko'tariladi.
    write(tree, "algebra/algebra-9/kvadrat/viyet", topic_data(order=2, status="reviewed"))
    run(tree)
    viyet = Topic.objects.get(slug="viyet")
    assert viyet.status == "reviewed" and viyet.reviewed_at


def test_invalid_file_aborts_everything(tree, capsys):
    write(
        tree,
        "algebra/algebra-9/kvadrat/buzuq",
        topic_data(order=3, blocks=topic_data()["blocks"][:2]),
    )
    with pytest.raises(CommandError):
        run(tree)
    assert Subject.objects.count() == 0
    assert "algebra/algebra-9/kvadrat/buzuq" in capsys.readouterr().err


def test_missing_chapter_file_is_reported(tmp_path):
    write(tmp_path, "algebra/algebra-9/kvadrat/diskriminant", topic_data())
    with pytest.raises(CommandError):
        run(tmp_path)


def test_reorder_swap_does_not_violate_unique_order(tree):
    run(tree)
    write(tree, "algebra/algebra-9/kvadrat/diskriminant", topic_data(order=2))
    write(tree, "algebra/algebra-9/kvadrat/viyet", topic_data(order=1))
    run(tree)
    assert Topic.objects.get(slug="diskriminant").order == 2


def test_revisions_keep_last_fifty(tree):
    run(tree)
    topic = Topic.objects.get(slug="diskriminant")
    for number in range(REVISION_LIMIT + 5):
        topic.title = {"uz": f"Nom {number}"}
        topic.save()
    assert topic.revisions.count() == REVISION_LIMIT
    assert topic.revisions.order_by("-created_at").first().title == {"uz": "Nom 54"}


def test_revision_records_author(tree, django_user_model):
    run(tree)
    user = django_user_model.objects.create_user(email="editor@example.com", password="x")
    topic = Topic.objects.get(slug="diskriminant")
    topic.title = {"uz": "Tahrir"}
    topic.revision_author = user
    topic.revision_comment = "admin"
    topic.save()
    last = topic.revisions.order_by("-created_at").first()
    assert (last.author, last.comment, last.blocks) == (user, "admin", topic.blocks)


def test_unchanged_save_makes_no_revision(tree):
    run(tree)
    topic = Topic.objects.get(slug="diskriminant")
    topic.save()
    assert topic.revisions.count() == 1


def test_topic_full_clean_rejects_bad_blocks(tree):
    run(tree)
    topic = Topic.objects.get(slug="diskriminant")
    topic.blocks = [{"id": "x", "type": "goal"}]
    with pytest.raises(ValidationError) as error:
        topic.full_clean()
    assert "blocks[0].text" in str(error.value)


def test_slug_unique_per_book_only(tree):
    run(tree)
    other_subject = Subject.objects.create(slug="x", title={"uz": "X"})
    book = Book.objects.create(
        slug="x-9",
        subject=other_subject,
        grade=9,
        title={"uz": "X"},
        author={"uz": "A"},
        edition={"uz": "1"},
        year=2020,
    )
    chapter = Chapter.objects.create(book=book, slug="c", title={"uz": "C"}, order=1)
    Topic.objects.create(
        chapter=chapter,
        slug="diskriminant",
        title={"uz": "T"},
        summary={"uz": "S"},
        blocks=topic_data()["blocks"],
        order=1,
    )
    assert Topic.objects.filter(slug="diskriminant").count() == 2
