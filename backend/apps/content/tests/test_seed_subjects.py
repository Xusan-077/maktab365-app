from io import StringIO

import pytest
from django.core.management import call_command

from apps.content.catalog_seed import subject_fields
from apps.content.management.commands.seed_subjects import SUBJECTS
from apps.content.models import Subject

pytestmark = pytest.mark.django_db


def run() -> str:
    out = StringIO()
    call_command("seed_subjects", stdout=out)
    return out.getvalue()


def test_creates_all_subjects_with_required_uz_title():
    assert f"fan: {len(SUBJECTS)} yangi, 0 mavjud" in run()
    assert Subject.objects.count() == len(SUBJECTS)
    assert all(s.title["uz"] for s in Subject.objects.all())
    assert {"matematika", "fizika", "kimyo", "informatika"} <= set(
        Subject.objects.values_list("slug", flat=True)
    )


def test_is_idempotent():
    run()
    assert f"0 yangi, {len(SUBJECTS)} mavjud" in run()
    assert Subject.objects.count() == len(SUBJECTS)


def test_keeps_admin_edits():
    run()
    Subject.objects.filter(slug="fizika").update(title={"uz": "Fizika (tahrir)"}, order=99)
    run()
    subject = Subject.objects.get(slug="fizika")
    assert subject.title["uz"] == "Fizika (tahrir)"
    assert subject.order == 99


def test_orders_are_unique():
    orders = [meta["order"] for meta in SUBJECTS.values()]
    assert len(orders) == len(set(orders))


def test_covers_the_four_core_content_subjects():
    for slug in ("algebra", "geometriya", "ingliz-tili", "tarix"):
        assert subject_fields(slug)["title"] == SUBJECTS[slug]["title"]
