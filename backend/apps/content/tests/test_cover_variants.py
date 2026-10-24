import io

import pytest
from django.core.files.base import ContentFile
from django.core.files.storage import default_storage
from django.core.management import call_command
from PIL import Image
from rest_framework.test import APIClient

from apps.content import cover_variants
from apps.content.models import CoverMode, PdfBook
from apps.content.pdf_services import delete_book

from .test_admin_api import client_as

BASE = "/api/v1/admin/pdf-books"
PUBLIC = "/api/v1/pdf-books"


@pytest.fixture(autouse=True)
def local_storage(settings, tmp_path):
    settings.AWS_STORAGE_BUCKET_NAME = ""
    settings.MEDIA_ROOT = tmp_path


def image_bytes(width=800, height=1000, fmt="PNG", mode="RGB") -> bytes:
    out = io.BytesIO()
    Image.new(mode, (width, height), (21, 84, 209) if mode == "RGB" else 0).save(out, format=fmt)
    return out.getvalue()


def stored_image(key: str, **kwargs) -> str:
    return default_storage.save(key, ContentFile(image_bytes(**kwargs)))


def size_of(key: str) -> tuple[int, int]:
    with default_storage.open(key, "rb") as handle:
        image = Image.open(handle)
        assert image.format == "WEBP"
        return image.size


@pytest.fixture
def book(catalog):
    subject = catalog.subject("algebra")
    return catalog.pdf_book(subject, cover_mode=CoverMode.CUSTOM, cover="")


def test_generates_300_and_600_webp_keeping_aspect(book):
    book.cover = stored_image("covers/a.png")
    book.save()

    assert cover_variants.generate_variants(book) is True

    book.refresh_from_db()
    assert size_of(book.cover_small.name) == (300, 375)
    assert size_of(book.cover_large.name) == (600, 750)
    assert book.cover.name == "covers/a.png"  # asl rasm zaxira sifatida qoladi


def test_small_source_is_not_upscaled(book):
    book.cover = stored_image("covers/s.png", width=200, height=260)
    book.save()

    cover_variants.generate_variants(book)

    book.refresh_from_db()
    assert size_of(book.cover_small.name) == (200, 260)
    assert size_of(book.cover_large.name) == (200, 260)


def test_transparent_and_palette_images_are_supported(book):
    book.cover = stored_image("covers/t.png", mode="RGBA")
    book.save()
    assert cover_variants.generate_variants(book) is True


def test_unreadable_cover_keeps_fallback_without_error(book):
    book.cover = default_storage.save("covers/bad.png", ContentFile(b"not an image"))
    book.save()

    assert cover_variants.generate_variants(book) is False

    book.refresh_from_db()
    assert not book.cover_small and not book.cover_large


def test_regenerating_replaces_and_deletes_old_variants(book):
    book.cover = stored_image("covers/a.png")
    book.save()
    cover_variants.generate_variants(book)
    book.refresh_from_db()
    old = [book.cover_small.name, book.cover_large.name]

    book.cover = stored_image("covers/b.png")
    book.save()
    cover_variants.generate_variants(book)

    book.refresh_from_db()
    assert book.cover_small.name not in old and book.cover_large.name not in old
    assert not any(default_storage.exists(key) for key in old)


def test_auto_mode_clears_variants(book):
    book.cover = stored_image("covers/a.png")
    book.save()
    cover_variants.generate_variants(book)
    book.refresh_from_db()
    keys = [book.cover_small.name, book.cover_large.name]

    book.cover_mode = CoverMode.AUTO
    book.cover = ""
    book.save()
    assert cover_variants.generate_variants(book) is False

    book.refresh_from_db()
    assert not book.cover_small and not book.cover_large
    assert not any(default_storage.exists(key) for key in keys)


def test_public_api_list_small_detail_large_and_language(book):
    book.cover = stored_image("covers/a.png")
    book.language = "ru"
    book.save()
    cover_variants.generate_variants(book)
    api = APIClient()

    listed = api.get(f"{PUBLIC}/").json()["results"][0]
    detail = api.get(f"{PUBLIC}/{book.pk}/").json()

    assert listed["language"] == "ru" and detail["language"] == "ru"
    assert listed["cover_small"].endswith("-300.webp")
    assert "cover_large" not in listed
    assert detail["cover_large"].endswith("-600.webp")
    assert detail["cover"].endswith("a.png")  # zaxira maydon saqlanadi


def test_public_api_falls_back_to_null_variants(book):
    book.cover = stored_image("covers/a.png")
    book.save()  # variantlar hali yo'q (mavjud kitoblar)

    listed = APIClient().get(f"{PUBLIC}/").json()["results"][0]

    assert listed["cover"].endswith("a.png") and listed["cover_small"] is None


def test_list_query_count_does_not_grow_with_language(catalog, django_assert_max_num_queries):
    subject = catalog.subject("algebra")
    for grade in range(1, 6):
        catalog.pdf_book(subject, grade=grade)
    api = APIClient()
    api.get(f"{PUBLIC}/")  # keshni qizdirish
    with django_assert_max_num_queries(8):
        assert api.get(f"{PUBLIC}/?page_size=100").status_code == 200


def test_admin_patch_cover_generates_variants(book, django_capture_on_commit_callbacks):
    admin = client_as("admin")
    path = admin.post(
        "/api/v1/admin/uploads/",
        {"kind": "cover", "file": ContentFile(image_bytes(), name="c.png")},
        format="multipart",
    ).json()["path"]

    with django_capture_on_commit_callbacks(execute=True):
        resp = admin.patch(f"{BASE}/{book.pk}/", {"cover": path, "cover_mode": "custom"}, "json")

    assert resp.status_code == 200
    book.refresh_from_db()
    assert size_of(book.cover_small.name) == (300, 375)


def test_delete_book_removes_variants(book):
    book.cover = stored_image("covers/a.png")
    book.save()
    cover_variants.generate_variants(book)
    book.refresh_from_db()
    keys = [book.cover.name, book.cover_small.name, book.cover_large.name]

    delete_book(book)

    assert not any(default_storage.exists(key) for key in keys)


def test_command_missing_only_skips_books_with_variants(catalog):
    subject = catalog.subject("fizika")
    done = catalog.pdf_book(subject, grade=8, cover_mode=CoverMode.CUSTOM)
    done.cover = stored_image("covers/done.png")
    done.save()
    cover_variants.generate_variants(done)
    done.refresh_from_db()
    before = done.cover_small.name
    todo = catalog.pdf_book(subject, grade=9, cover_mode=CoverMode.FIRST_PAGE)
    todo.cover = stored_image("covers/todo.png")
    todo.save()
    auto = catalog.pdf_book(subject, grade=7)  # auto: muqovasi yo'q

    out = io.StringIO()
    call_command("generate_covers", "--missing-only", stdout=out)

    done.refresh_from_db(), todo.refresh_from_db(), auto.refresh_from_db()
    assert done.cover_small.name == before  # tegilmadi
    assert todo.cover_small and todo.cover_large
    assert not auto.cover_small
    assert "Tayyor: 1" in out.getvalue()


def test_command_dry_run_changes_nothing(catalog):
    subject = catalog.subject("fizika")
    book = catalog.pdf_book(subject, cover_mode=CoverMode.CUSTOM)
    book.cover = stored_image("covers/x.png")
    book.save()

    call_command("generate_covers", "--dry-run", stdout=io.StringIO())

    assert not PdfBook.objects.get(pk=book.pk).cover_small
