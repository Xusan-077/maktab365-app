"""Admin "Xabarlar": ro'yxat va filtrlar, holat/izoh (audit), yangi xabarlar soni."""

import pytest
from rest_framework.test import APIClient

from apps.accounts.models import AuditLog
from apps.content.tests.conftest import Catalog
from apps.content.tests.test_admin_api import client_as
from apps.support.models import Kind, Status, SupportMessage

pytestmark = pytest.mark.django_db

BASE = "/api/v1/admin/support"


@pytest.fixture
def book():
    catalog = Catalog()
    return catalog.pdf_book(catalog.subject("algebra"), 9, title={"uz": "Algebra 9"})


@pytest.fixture
def messages(book):
    make = SupportMessage.objects.create
    return {
        "error": make(
            kind=Kind.CONTENT_ERROR, message="45-betdagi formulada xato bor", pdf_book=book, page=45
        ),
        "question": make(kind=Kind.QUESTION, message="Qanday qilib yuklab olaman?"),
        "seen": make(kind=Kind.BUG, message="Sahifa sekin ochilyapti", status=Status.IN_PROGRESS),
        "spam": make(kind=Kind.QUESTION, message="casino casino", status=Status.SPAM),
    }


def ids(response):
    return {row["id"] for row in response.json()["results"]}


@pytest.mark.parametrize(("role", "expected"), [(None, 401), ("student", 403), ("editor", 200)])
def test_permissions(role, expected):
    client = client_as(role) if role else APIClient()
    assert client.get(f"{BASE}/").status_code == expected


def test_list_hides_spam_and_filters(messages, book):
    editor = client_as("editor")
    every = {str(m.pk) for key, m in messages.items() if key != "spam"}

    assert ids(editor.get(f"{BASE}/")) == every
    assert ids(editor.get(f"{BASE}/", {"status": "spam"})) == {str(messages["spam"].pk)}
    assert ids(editor.get(f"{BASE}/", {"status": "new"})) == {
        str(messages["error"].pk),
        str(messages["question"].pk),
    }
    assert ids(editor.get(f"{BASE}/", {"kind": "content_error"})) == {str(messages["error"].pk)}
    assert ids(editor.get(f"{BASE}/", {"pdf_book": str(book.pk)})) == {str(messages["error"].pk)}
    assert editor.get(f"{BASE}/", {"status": "nope"}).status_code == 400


def test_row_has_book_and_page(messages, book):
    rows = client_as("editor").get(f"{BASE}/").json()["results"]
    row = next(r for r in rows if r["page"] == 45)
    assert row["pdf_book"] == {
        "id": str(book.pk),
        "slug": book.slug,
        "grade": 9,
        "title": {"uz": "Algebra 9"},
    }


def test_status_and_note_are_saved_and_audited(messages):
    editor = client_as("editor")
    target = messages["error"]

    response = editor.patch(
        f"{BASE}/{target.pk}/", {"status": "resolved", "staff_note": "Tuzatildi"}, "json"
    )

    assert response.status_code == 200
    target.refresh_from_db()
    assert (target.status, target.staff_note) == (Status.RESOLVED, "Tuzatildi")
    log = AuditLog.objects.get(action="update", target_type="support_message")
    assert log.after["status"] == "resolved"
    # Xabar matni va turi o'zgarmaydi; o'chirib bo'lmaydi.
    editor.patch(f"{BASE}/{target.pk}/", {"message": "boshqa", "kind": "bug"}, "json")
    target.refresh_from_db()
    assert target.message.startswith("45-betdagi") and target.kind == Kind.CONTENT_ERROR
    assert client_as("admin").delete(f"{BASE}/{target.pk}/").status_code == 405


def test_summary_counts_new_and_books(messages, book):
    body = client_as("editor").get(f"{BASE}/summary/").json()

    assert body["new"] == 2  # spam va "ko'rildi" sanalmaydi
    assert body["books"] == [
        {"id": str(book.pk), "title": {"uz": "Algebra 9"}, "grade": 9, "count": 1}
    ]
