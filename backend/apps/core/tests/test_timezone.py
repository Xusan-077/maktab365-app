"""Vaqt: API doim UTC ISO (`...Z`) qaytaradi; mahalliy (Toshkent) kun faqat kunlik sanagichlarda."""

from datetime import UTC, date, datetime

import pytest
from django.conf import settings
from django.utils import timezone
from rest_framework.test import APIClient

from apps.analytics import services as stats
from apps.content.tests.conftest import Catalog

pytestmark = pytest.mark.django_db


def test_settings_store_and_serialize_in_utc():
    assert settings.USE_TZ is True
    assert settings.TIME_ZONE == "UTC"
    assert settings.LOCAL_TIME_ZONE == "Asia/Tashkent"


def test_public_api_returns_utc_iso_datetimes():
    catalog = Catalog()
    book = catalog.pdf_book(catalog.subject("algebra"), 9)
    published_at = datetime(2026, 10, 24, 18, 3, 10, tzinfo=UTC)
    type(book).objects.filter(pk=book.pk).update(published_at=published_at)

    body = APIClient().get(f"/api/v1/pdf-books/{book.pk}/").json()

    assert body["published_at"] == "2026-10-24T18:03:10Z"


def test_daily_stats_use_the_tashkent_day(monkeypatch):
    # 20:30 UTC = ertasi kuni 01:30 Toshkentda: sanagich mahalliy kunga yoziladi.
    monkeypatch.setattr(timezone, "now", lambda: datetime(2026, 10, 24, 20, 30, tzinfo=UTC))

    assert stats._today() == date(2026, 10, 25)
