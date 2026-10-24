"""Admin va muharrir ham o'quvchi kabi o'qiydi: `/me/*` o'qish API'lari ularga ham ochiq."""

import pytest

from apps.accounts.models import Role, User
from apps.core.tests.passwords import TEST_PASSWORD

from .conftest import Catalog, client_for

pytestmark = pytest.mark.django_db


@pytest.fixture
def book(db):
    catalog = Catalog()
    return catalog.pdf_book(catalog.subject("algebra"), 9, pages=20)


@pytest.fixture(params=[Role.EDITOR, Role.ADMIN])
def staff_api(request):
    user = User.objects.create_user(
        email=f"{request.param}@example.com", password=TEST_PASSWORD, role=request.param
    )
    return client_for(user)


def test_staff_can_save_and_read_progress(staff_api, book):
    url = f"/api/v1/me/pdf-progress/{book.pk}/"
    assert staff_api.put(url, {"last_page": 4}, "json").status_code == 200
    assert staff_api.get(url).json()["last_page"] == 4


def test_staff_can_list_bookmarks_and_annotations(staff_api, book):
    assert staff_api.get("/api/v1/me/pdf-bookmarks/").status_code == 200
    annotations = staff_api.get("/api/v1/me/pdf-annotations/", {"pdf_book": str(book.pk)})
    assert annotations.status_code == 200


def test_staff_can_merge_guest_data(staff_api):
    assert staff_api.post("/api/v1/me/merge-guest-data/", {}, "json").status_code == 200
