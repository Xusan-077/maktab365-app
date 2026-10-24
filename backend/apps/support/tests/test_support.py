import json
from pathlib import Path

import pytest
from django.core import mail
from django.core.cache import cache
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.content.tests.conftest import Catalog
from apps.core.tests.passwords import TEST_PASSWORD
from apps.support import quality
from apps.support.models import Kind, Status, SupportMessage

pytestmark = pytest.mark.django_db

URL = "/api/v1/support/"
CONTRACT = (
    Path(__file__).resolve().parents[4] / "contracts" / "fixtures" / "support-message-quality.json"
)
PAYLOAD = {
    "kind": "bug",
    "email": "ali@example.com",
    "message": "Mavzu sahifasida rasm ochilmayapti, iltimos tekshiring.",
}


@pytest.fixture(autouse=True)
def _clear_cache():
    cache.clear()
    yield
    cache.clear()


@pytest.fixture
def api():
    return APIClient()


@pytest.fixture
def send(api, django_capture_on_commit_callbacks):
    def _send(data=None, client=None, **extra):
        with django_capture_on_commit_callbacks(execute=True):
            return (client or api).post(URL, data or PAYLOAD, format="json", **extra)

    return _send


class TestCreate:
    def test_anonymous_message_is_stored(self, send):
        response = send(
            {**PAYLOAD, "name": "Ali", "topic": "algebra-1", "page_url": "https://x.uz/uz/a"},
            HTTP_USER_AGENT="pytest-agent",
        )
        assert response.status_code == 201
        assert response.json() == {"ok": True}
        msg = SupportMessage.objects.get()
        assert msg.user is None
        assert (msg.kind, msg.status) == (Kind.BUG, Status.NEW)
        assert msg.email == "ali@example.com"
        assert msg.topic == "algebra-1"
        assert msg.page_url == "https://x.uz/uz/a"
        assert msg.user_agent == "pytest-agent"

    def test_authenticated_user_is_attached_and_email_falls_back(self, api, send):
        user = User.objects.create_user(email="stud@example.com", password=TEST_PASSWORD)
        api.force_authenticate(user)
        response = send({"kind": "question", "message": "Qanday qilib natijani ko'raman?"})
        assert response.status_code == 201
        msg = SupportMessage.objects.get()
        assert msg.user == user
        assert msg.email == "stud@example.com"

    def test_anonymous_requires_email(self, send):
        response = send({"kind": "question", "message": "Email yo'q, lekin xabar uzun."})
        assert response.status_code == 400
        assert response.json()["code"] == "validation_error"
        assert "email" in response.json()["details"]

    @pytest.mark.parametrize(
        "patch",
        [
            {"message": "qisqa"},
            {"message": "x" * 2001},
            {"kind": "nonsense"},
            {"email": "not-an-email"},
            {"name": "n" * 101},
        ],
    )
    def test_validation_limits(self, send, patch):
        response = send({**PAYLOAD, **patch})
        assert response.status_code == 400
        assert not SupportMessage.objects.exists()


class TestAbuse:
    def test_honeypot_pretends_success_but_stores_nothing(self, send):
        response = send({**PAYLOAD, "website": "http://bot.example"})
        assert response.status_code == 201
        assert not SupportMessage.objects.exists()
        assert mail.outbox == []

    @pytest.mark.parametrize(
        "text",
        [
            "Visit http://a.example http://b.example http://c.example now please",
            "Best CASINO bonus for you, click here please",
        ],
    )
    def test_spam_is_marked_and_not_notified(self, send, text):
        response = send({**PAYLOAD, "message": text})
        assert response.status_code == 201
        assert SupportMessage.objects.get().status == Status.SPAM
        assert mail.outbox == []

    def test_throttle_per_ip(self, send, settings):
        settings.REST_FRAMEWORK = {
            **settings.REST_FRAMEWORK,
            "DEFAULT_THROTTLE_RATES": {
                **settings.REST_FRAMEWORK["DEFAULT_THROTTLE_RATES"],
                "support": "5/hour",
                "support_burst": "100/min",  # bu test soatlik chegarani tekshiradi
            },
        }
        for _ in range(5):
            assert send().status_code == 201
        throttled = send()
        assert throttled.status_code == 429
        assert throttled.json()["code"] == "throttled"
        assert SupportMessage.objects.count() == 5
        # Boshqa IP ta'sirlanmaydi.
        other = send(REMOTE_ADDR="203.0.113.9")
        assert other.status_code == 201


class TestStaffNotification:
    def test_staff_gets_email(self, send):
        send({**PAYLOAD, "topic": "algebra-1"})
        assert len(mail.outbox) == 1
        message = mail.outbox[0]
        assert message.to == ["staff@example.com"]
        assert "bug" in message.subject
        assert "ali@example.com" in message.body
        assert "algebra-1" in message.body

    def test_no_recipients_no_email(self, send, settings):
        settings.SUPPORT_NOTIFY_EMAILS = []
        assert send().status_code == 201
        assert mail.outbox == []

    def test_subject_has_no_newlines(self, send):
        send({**PAYLOAD, "message": "Birinchi qator\nBcc: evil@example.com\nuchinchi"})
        assert "\n" not in mail.outbox[0].subject


class TestMine:
    def test_requires_auth(self, api):
        assert api.get("/api/v1/me/support/").status_code in (401, 403)

    def test_lists_only_own_messages_with_status(self, api, send):
        alice = User.objects.create_user(email="a@example.com", password=TEST_PASSWORD)
        bob = User.objects.create_user(email="b@example.com", password=TEST_PASSWORD)
        api.force_authenticate(alice)
        send({"kind": "question", "message": "Alice savoli, uzunroq matn."})
        api.force_authenticate(bob)
        send({"kind": "bug", "message": "Bob xatosi haqida uzun matn."})
        SupportMessage.objects.filter(user=alice).update(
            status=Status.RESOLVED, staff_note="ichki izoh"
        )
        api.force_authenticate(alice)
        body = api.get("/api/v1/me/support/").json()
        assert body["count"] == 1
        item = body["results"][0]
        assert item["status"] == "resolved"
        assert item["message"] == "Alice savoli, uzunroq matn."
        assert "staff_note" not in item
        assert "email" not in item

    def test_spam_is_hidden_from_the_author(self, api, send):
        user = User.objects.create_user(email="a@example.com", password=TEST_PASSWORD)
        api.force_authenticate(user)
        send({"kind": "question", "message": "Best CASINO bonus for you, click here please"})
        send({"kind": "question", "message": "Oddiy savol: natijalar qayerda ko'rinadi?"})
        assert SupportMessage.objects.filter(user=user).count() == 2
        body = api.get("/api/v1/me/support/").json()
        assert [item["status"] for item in body["results"]] == ["new"]


class TestQuality:
    """Juda qisqa yoki ma'nosiz xabar saqlanmaydi (400), kontrakt — frontend bilan bir xil."""

    @pytest.mark.parametrize("text", ["Dnxdnxdnxdnx", "asdasdasdasdasdasd", "qwrt psdf ghjk lzxc"])
    def test_meaningless_message_is_rejected(self, send, text):
        response = send({**PAYLOAD, "message": text})
        assert response.status_code == 400
        assert response.json()["details"]["message"] == ["message_meaningless"]
        assert not SupportMessage.objects.exists()

    def test_too_short_message_is_rejected(self, send):
        response = send({**PAYLOAD, "message": "Xato bor ekan"})  # 13 belgi
        assert response.status_code == 400
        assert "message" in response.json()["details"]

    def test_shared_contract(self):
        contract = json.loads(CONTRACT.read_text(encoding="utf-8"))
        assert contract["min_length"] == quality.MIN_MESSAGE_LENGTH
        for case in contract["cases"]:
            assert quality.is_meaningless(case["text"]) is case["meaningless"], case["text"]

    def test_burst_throttle(self, send, settings):
        settings.REST_FRAMEWORK = {
            **settings.REST_FRAMEWORK,
            "DEFAULT_THROTTLE_RATES": {
                **settings.REST_FRAMEWORK["DEFAULT_THROTTLE_RATES"],
                "support": "100/hour",
                "support_burst": "2/min",
            },
        }
        assert send().status_code == 201
        assert send().status_code == 201
        assert send().status_code == 429


class TestBookAndPage:
    @pytest.fixture
    def book(self, db):
        catalog = Catalog()
        return catalog.pdf_book(catalog.subject("algebra"), 9, pages=200)

    def test_explicit_book_and_page(self, send, book):
        send({**PAYLOAD, "pdf_book": str(book.pk), "page": 45})
        msg = SupportMessage.objects.get()
        assert (msg.pdf_book, msg.page) == (book, 45)

    def test_old_client_book_from_topic_and_page_from_url(self, send, book):
        url = f"https://x.uz/uz/darsliklar/9/{book.slug}/oqish?page=12&find=x"
        send({**PAYLOAD, "topic": str(book.pk), "page_url": url})
        msg = SupportMessage.objects.get()
        assert (msg.pdf_book, msg.page) == (book, 12)

    def test_unknown_book_is_ignored(self, send):
        send({**PAYLOAD, "topic": "00000000-0000-4000-8000-000000000000"})
        msg = SupportMessage.objects.get()
        assert (msg.pdf_book, msg.page) == (None, None)
