import pytest
from django.core.management import CommandError, call_command

from apps.content.management.commands.seed_demo_books import DEMO_MARKER, DEMOS
from apps.content.models import PdfBook, PdfBookStatus

pytestmark = pytest.mark.django_db


@pytest.fixture(autouse=True)
def local_storage(settings, tmp_path):
    settings.AWS_STORAGE_BUCKET_NAME = ""
    settings.MEDIA_ROOT = tmp_path
    settings.DEBUG = True


def test_creates_published_books_with_covers_and_is_idempotent():
    call_command("seed_demo_books")
    books = PdfBook.objects.filter(description=DEMO_MARKER)
    assert books.count() == len(DEMOS) == 12
    assert set(books.values_list("status", flat=True)) == {PdfBookStatus.PUBLISHED}
    assert len({b.language for b in books}) == 3
    assert books.exclude(cover_small="").count() == 3
    assert all(b.page_count > 1 and b.size_bytes > 0 for b in books)

    call_command("seed_demo_books")
    assert PdfBook.objects.filter(description=DEMO_MARKER).count() == 12


def test_reset_recreates():
    call_command("seed_demo_books")
    call_command("seed_demo_books", "--reset")
    assert PdfBook.objects.filter(description=DEMO_MARKER).count() == 12


def test_refuses_outside_debug(settings):
    settings.DEBUG = False
    with pytest.raises(CommandError):
        call_command("seed_demo_books")
    assert not PdfBook.objects.exists()
