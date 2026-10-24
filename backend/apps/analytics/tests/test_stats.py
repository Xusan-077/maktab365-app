from datetime import timedelta

import pytest
from django.core.management import call_command
from rest_framework.test import APIClient

from apps.analytics import services
from apps.analytics.models import BookDailyStat, PageDailyStat
from apps.content.tests.test_admin_api import client_as

EVENT = "/api/v1/pdf-books/{}/stats/"
ADMIN = "/api/v1/admin/stats/"


@pytest.fixture
def book(catalog):
    return catalog.pdf_book(catalog.subject("algebra"), pages=50)


def test_anonymous_events_count_open_and_pages(book):
    api = APIClient()
    for _ in range(2):
        assert api.post(EVENT.format(book.pk), {"kind": "open"}, "json").status_code == 204
    for page in (3, 3, 7):
        assert (
            api.post(EVENT.format(book.pk), {"kind": "page", "page": page}, "json").status_code
            == 204
        )

    today = BookDailyStat.objects.get(book=book)
    assert today.opens == 2 and today.downloads == 0
    assert {s.page: s.views for s in PageDailyStat.objects.filter(book=book)} == {3: 2, 7: 1}


def test_events_ignore_drafts_unknown_books_and_pages_out_of_range(catalog, book):
    draft = catalog.pdf_book(catalog.subject("fizika"), status="draft")
    api = APIClient()
    assert api.post(EVENT.format(draft.pk), {"kind": "open"}, "json").status_code == 204
    assert (
        api.post(
            EVENT.format("3f1c3a52-9d63-4b6f-8d1b-2a6f7d0f9e11"), {"kind": "open"}, "json"
        ).status_code
        == 204
    )
    assert api.post(EVENT.format(book.pk), {"kind": "page", "page": 51}, "json").status_code == 204
    assert not BookDailyStat.objects.exists() and not PageDailyStat.objects.exists()


def test_event_validation(book):
    api = APIClient()
    assert api.post(EVENT.format(book.pk), {"kind": "x"}, "json").status_code == 400
    assert api.post(EVENT.format(book.pk), {"kind": "page"}, "json").status_code == 400
    assert api.post(EVENT.format(book.pk), {"kind": "page", "page": 0}, "json").status_code == 400


def test_download_endpoint_counts_download(book):
    APIClient().get(f"/api/v1/pdf-books/{book.pk}/download/")
    assert BookDailyStat.objects.get(book=book).downloads == 1


def test_summary_windows_and_no_personal_data(book):
    old = services._today() - timedelta(days=20)
    BookDailyStat.objects.create(book=book, day=old, opens=5, downloads=1)
    PageDailyStat.objects.create(book=book, day=old, page=9, views=4)
    services.record_open(book.pk)
    services.record_page(book.pk, 2)

    week = services.summary(7)
    assert week["totals"] == {"opens": 1, "downloads": 0}
    assert [p["page"] for p in week["top_pages"]] == [2]
    assert len(week["daily"]) == 7 and week["daily"][-1]["opens"] == 1

    month = services.summary(30)
    assert month["totals"] == {"opens": 6, "downloads": 1}
    assert month["top_pages"][0]["page"] == 9 and month["top_pages"][0]["views"] == 4
    assert month["books"][0]["opens"] == 6
    assert set(month["books"][0]) == {"id", "slug", "grade", "title", "opens", "downloads"}


@pytest.mark.parametrize(
    ("role", "expected"),
    [("anon", 401), ("student", 403), ("teacher", 403), ("editor", 200), ("admin", 200)],
)
def test_admin_stats_permissions(book, role, expected):
    client = APIClient() if role == "anon" else client_as(role)
    assert client.get(ADMIN).status_code == expected


def test_admin_stats_payload_and_period_param(book):
    services.record_open(book.pk)
    admin = client_as("admin")
    data = admin.get(ADMIN, {"days": 30}).json()
    assert data["days"] == 30 and data["totals"]["opens"] == 1 and len(data["daily"]) == 30
    assert admin.get(ADMIN, {"days": 99}).json()["days"] == 7


def test_purge_removes_old_rows(book):
    BookDailyStat.objects.create(book=book, day=services._today() - timedelta(days=400), opens=1)
    services.record_open(book.pk)
    call_command("purge_stats")
    assert BookDailyStat.objects.count() == 1
