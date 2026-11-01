"""Kutubxona turlari, birlashgan admin ro'yxat, yuklab olish va o'qish URL'i himoyasi."""

import io

import pytest
import structlog
from django.core.files.base import ContentFile
from django.core.files.storage import default_storage
from django.db import connection
from django.db.migrations.executor import MigrationExecutor
from PIL import Image
from rest_framework.test import APIClient

from apps.books.models import TEXTBOOK_TYPE_SLUG, Book, BookType
from apps.content.tests.conftest import catalog  # noqa: F401
from apps.content.tests.test_admin_api import client_as

from .conftest import blank_pdf
from .test_books import make_book, ready_book

pytestmark = pytest.mark.django_db

ADMIN = "/api/v1/admin"
PUBLIC = "/api/v1"


def png(width=1200, height=1800) -> bytes:
    out = io.BytesIO()
    Image.new("RGB", (width, height), "navy").save(out, format="PNG")
    return out.getvalue()


def with_file(book: Book) -> Book:
    book.source_file = default_storage.save("book-sources/x.pdf", ContentFile(blank_pdf()))
    book.save()
    return book


# --- Turlar ---


def test_seeded_types_exist_and_textbook_is_system():
    slugs = set(BookType.objects.values_list("slug", flat=True))
    assert {TEXTBOOK_TYPE_SLUG, "badiiy-kitoblar", "boshqa"} <= slugs
    assert BookType.objects.get(slug=TEXTBOOK_TYPE_SLUG).is_system


def test_book_without_type_goes_to_other():
    book = make_book()
    assert book.book_type.slug == "boshqa" and book.slug


def test_type_crud_rules():
    editor, admin = client_as("editor"), client_as("admin")
    created = editor.post(
        f"{ADMIN}/book-types/", {"name": {"uz": "Ilmiy-ommabop"}, "order": 30}, format="json"
    )
    assert created.status_code == 201, created.content
    body = created.json()
    assert body["slug"] == "ilmiy-ommabop" and body["is_active"] and not body["is_system"]

    renamed = editor.patch(
        f"{ADMIN}/book-types/{body['id']}/", {"name": {"uz": "Ilmiy"}}, format="json"
    )
    assert renamed.status_code == 200 and renamed.json()["slug"] == "ilmiy-ommabop"
    bad_slug = editor.patch(f"{ADMIN}/book-types/{body['id']}/", {"slug": "x"}, format="json")
    assert bad_slug.status_code == 400

    assert client_as("student").delete(f"{ADMIN}/book-types/{body['id']}/").status_code == 403
    assert editor.delete(f"{ADMIN}/book-types/{body['id']}/").status_code == 403
    assert admin.delete(f"{ADMIN}/book-types/{body['id']}/").status_code == 204


def test_system_and_non_empty_types_are_not_deletable():
    admin = client_as("admin")
    system = BookType.objects.get(slug=TEXTBOOK_TYPE_SLUG)
    resp = admin.delete(f"{ADMIN}/book-types/{system.pk}/")
    assert resp.status_code == 409 and resp.json()["code"] == "system_type"
    off = admin.patch(f"{ADMIN}/book-types/{system.pk}/", {"is_active": False}, format="json")
    assert off.status_code == 400

    other = BookType.objects.get(slug="boshqa")
    make_book(book_type=other)
    resp = admin.delete(f"{ADMIN}/book-types/{other.pk}/")
    assert resp.status_code == 409 and resp.json()["code"] == "has_dependents"


def test_inactive_type_cannot_be_assigned_and_is_hidden_publicly():
    admin = client_as("admin")
    hidden = BookType.objects.create(name={"uz": "Yashirin"}, slug="yashirin", is_active=False)
    resp = admin.post(f"{ADMIN}/books/", {"title": "A", "book_type": str(hidden.pk)}, format="json")
    assert resp.status_code == 400 and "book_type" in resp.json()["details"]
    slugs = [t["slug"] for t in APIClient().get(f"{PUBLIC}/book-types/").json()]
    assert "yashirin" not in slugs


def test_public_types_count_and_filter_by_type_slug():
    novel = BookType.objects.get(slug="badiiy-kitoblar")
    ready_book(title="Roman", book_type=novel)
    make_book(title="Qoralama", book_type=novel)  # nashr qilinmagan: sanalmaydi
    anon = APIClient()
    counts = {t["slug"]: t["book_count"] for t in anon.get(f"{PUBLIC}/book-types/").json()}
    assert counts["badiiy-kitoblar"] == 1 and counts["boshqa"] == 0
    books = anon.get(f"{PUBLIC}/books/?type=badiiy-kitoblar").json()["results"]
    assert [b["title"] for b in books] == ["Roman"]
    assert books[0]["book_type"]["slug"] == "badiiy-kitoblar"


def test_book_by_slug():
    book = ready_book(title="O'tkan kunlar")
    anon = APIClient()
    assert book.slug == "otkan-kunlar"
    assert anon.get(f"{PUBLIC}/books/by-slug/{book.slug}/").json()["id"] == str(book.pk)
    assert anon.get(f"{PUBLIC}/books/by-slug/yoq/").status_code == 404
    draft = make_book(title="Qoralama")
    assert anon.get(f"{PUBLIC}/books/by-slug/{draft.slug}/").status_code == 404
    assert client_as("editor").get(f"{PUBLIC}/books/by-slug/{draft.slug}/").status_code == 200


def test_slugs_are_unique_and_cyrillic_is_transliterated():
    first, second = make_book(title="Алгебра"), make_book(title="Алгебра")
    assert first.slug == "algebra" and second.slug == "algebra-2"


# --- Birlashgan admin ro'yxat ---


def test_admin_library_merges_textbooks_and_books(catalog):  # noqa: F811
    catalog.pdf_book(catalog.subject("algebra"), title={"uz": "Algebra 9"})
    ready_book(title="Roman")
    admin = client_as("admin")
    rows = admin.get(f"{ADMIN}/library/").json()["results"]
    assert {r["kind"] for r in rows} == {"book", "textbook"}
    only_books = admin.get(f"{ADMIN}/library/?type=boshqa").json()["results"]
    assert {r["kind"] for r in only_books} == {"book"}
    only_text = admin.get(f"{ADMIN}/library/?type={TEXTBOOK_TYPE_SLUG}").json()["results"]
    assert [r["title"] for r in only_text] == ["Algebra 9"]
    assert client_as("student").get(f"{ADMIN}/library/").status_code == 403
    assert APIClient().get(f"{ADMIN}/library/").status_code == 401


# --- Yuklab olish: faqat admin ---


def test_pdf_and_cover_download_are_admin_only():
    book = with_file(make_book())
    book.cover_image.save("c.png", ContentFile(png()), save=True)
    clients = {role: client_as(role) for role in (None, "student", "teacher", "editor", "admin")}
    for suffix in ("download", "cover-download"):
        url = f"{ADMIN}/books/{book.pk}/{suffix}/"
        for role in (None, "student", "teacher", "editor"):
            assert clients[role].get(url).status_code in (401, 403), (suffix, role)
        assert clients["admin"].get(url).status_code == 200
    cover = clients["admin"].get(f"{ADMIN}/books/{book.pk}/cover-download/")
    assert cover["Content-Disposition"].startswith("attachment")


def test_public_api_never_offers_download_and_serves_small_cover():
    book = ready_book(title="Muqovali")
    book.cover_image.save("big.png", ContentFile(png(1200, 1800)), save=True)
    book.refresh_from_db()
    assert book.cover_small and book.cover_small.name != book.cover_image.name
    with book.cover_small.open("rb") as handle:
        assert Image.open(handle).width <= 400
    data = APIClient().get(f"{PUBLIC}/books/{book.pk}/").json()
    assert "-s-" in data["cover"] and not any("download" in key for key in data)
    for path in (f"{PUBLIC}/books/{book.pk}/download/", f"{PUBLIC}/pdf-books/{book.pk}/download/"):
        assert APIClient().get(path).status_code == 404


def test_reading_url_is_inline_never_attachment():
    book = with_file(ready_book(title="Ochiq"))
    anon = APIClient()
    info = anon.get(f"{PUBLIC}/books/{book.pk}/file-url/")
    assert info.status_code == 200 and info.json()["expires_in"] == 600
    served = anon.get(info.json()["url"])
    assert served.status_code == 200
    assert served["Content-Disposition"] == "inline"


# --- O'qish URL'i himoyasi ---


def _rates(settings, **override):
    from rest_framework.settings import api_settings

    rates = {**api_settings.DEFAULT_THROTTLE_RATES, **override}
    settings.REST_FRAMEWORK = {**settings.REST_FRAMEWORK, "DEFAULT_THROTTLE_RATES": rates}


def test_file_url_rate_limit_per_ip_and_per_user(settings):
    _rates(settings, file_url_ip="3/min")
    book = with_file(ready_book(title="Cheklangan"))
    url = f"{PUBLIC}/books/{book.pk}/file-url/"
    anon = APIClient()
    assert [anon.get(url).status_code for _ in range(4)] == [200, 200, 200, 429]

    _rates(settings, file_url_ip="1000/min", file_url_user="2/min")
    user = client_as("student")
    assert [user.get(url).status_code for _ in range(3)] == [200, 200, 429]


def test_foreign_origin_is_rejected_but_site_origin_and_server_calls_pass(settings):
    settings.CORS_ALLOWED_ORIGINS = ["https://www.darslik365.uz"]
    book = with_file(ready_book(title="Hotlink"))
    url = f"{PUBLIC}/books/{book.pk}/file-url/"
    anon = APIClient()
    bad = anon.get(url, HTTP_ORIGIN="https://evil.example")
    assert bad.status_code == 403 and bad.json()["code"] == "origin_not_allowed"
    assert anon.get(url, HTTP_REFERER="https://evil.example/page").status_code == 403
    assert anon.get(url, HTTP_ORIGIN="https://www.darslik365.uz").status_code == 200
    assert anon.get(url).status_code == 200  # Next serveri (origin sarlavhasiz)


def test_bursts_are_logged_as_warning(settings):
    settings.FILE_URL_BURST_LOG = 2
    book = with_file(ready_book(title="Burst"))
    url = f"{PUBLIC}/books/{book.pk}/file-url/"
    anon = APIClient()
    with structlog.testing.capture_logs() as logs:
        for _ in range(4):
            anon.get(url)
    events = [(row["event"], row["log_level"]) for row in logs if "file_url" in row["event"]]
    assert ("file_url_burst", "warning") in events
    assert ("file_url_issued", "info") in events


# --- Migratsiya: ma'lumotni saqlaydi va orqaga qaytariladi ---


@pytest.mark.django_db(transaction=True)
def test_migration_splits_old_type_and_reverses():
    target = ("books", "0006_books_modes")
    executor = MigrationExecutor(connection)
    executor.migrate([target])
    old_apps = executor.loader.project_state([target]).apps
    old_book = old_apps.get_model("books", "Book")
    ids = {
        kind: old_book.objects.create(title=f"K {kind}", type=kind).pk
        for kind in ("textbook", "fiction", "math", "test", "other")
    }

    executor = MigrationExecutor(connection)
    executor.migrate([("books", "0007_book_types")])
    got = {b.title: b for b in Book.objects.select_related("book_type")}
    assert got["K textbook"].book_type.slug == TEXTBOOK_TYPE_SLUG
    assert got["K textbook"].reading_mode == "standard"
    assert got["K fiction"].book_type.slug == "badiiy-kitoblar"
    assert (got["K math"].reading_mode, got["K math"].book_type.slug) == ("math", "boshqa")
    assert got["K test"].reading_mode == "test"
    assert all(b.slug for b in got.values()) and len({b.slug for b in got.values()}) == 5

    executor = MigrationExecutor(connection)
    executor.migrate([target])
    old_apps = executor.loader.project_state([target]).apps
    old_book = old_apps.get_model("books", "Book")
    back = {pk: old_book.objects.get(pk=pk).type for pk in ids.values()}
    assert back == {ids[kind]: kind for kind in ids}

    executor = MigrationExecutor(connection)
    executor.migrate(executor.loader.graph.leaf_nodes())
