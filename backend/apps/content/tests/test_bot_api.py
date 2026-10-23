import pytest
from rest_framework.test import APIClient

URL = "/api/v1/bot/books/"
TOKEN = "bot-secret-token"


@pytest.fixture
def bot(settings):
    settings.BOT_API_TOKEN = TOKEN
    client = APIClient()
    client.credentials(HTTP_X_BOT_TOKEN=TOKEN)
    return client


def test_disabled_without_token_setting(settings, catalog):
    settings.BOT_API_TOKEN = ""
    client = APIClient()
    client.credentials(HTTP_X_BOT_TOKEN="x")
    assert client.get(URL).status_code == 404


def test_token_required_and_checked(settings, catalog):
    settings.BOT_API_TOKEN = TOKEN
    assert APIClient().get(URL).status_code == 401
    wrong = APIClient()
    wrong.credentials(HTTP_X_BOT_TOKEN="nope")
    resp = wrong.get(URL)
    assert resp.status_code == 401 and resp.json()["code"] == "bot_token_invalid"


def test_search_returns_links_in_requested_language(bot, catalog):
    algebra = catalog.subject("algebra")
    algebra.title = {"uz": "Algebra", "ru": "Алгебра"}
    algebra.save()
    book = catalog.pdf_book(algebra, grade=9, title={"uz": "Algebra 9", "ru": "Алгебра 9"})
    catalog.pdf_book(catalog.subject("fizika"), grade=8, title={"uz": "Fizika 8"})
    catalog.pdf_book(
        catalog.subject("tarix"), grade=9, status="draft", title={"uz": "Algebra qoralama"}
    )

    resp = bot.get(URL, {"q": "algebra", "lang": "ru"})
    assert resp.status_code == 200 and resp["Cache-Control"] == "private, no-store"
    [item] = resp.json()
    assert (
        item["id"] == str(book.pk) and item["title"] == "Алгебра 9" and item["subject"] == "Алгебра"
    )
    assert item["url"] == "http://frontend.test/ru/darsliklar/9/9-sinf-algebra"
    assert item["read_url"].endswith("/9-sinf-algebra/oqish")


def test_filters_limit_and_short_query(bot, catalog):
    subject = catalog.subject("algebra")
    for grade in range(1, 8):
        catalog.pdf_book(subject, grade=grade)
    assert len(bot.get(URL).json()) == 5  # default limit
    assert len(bot.get(URL, {"limit": "100"}).json()) == 7
    assert len(bot.get(URL, {"limit": "2"}).json()) == 2
    assert [b["grade"] for b in bot.get(URL, {"grade": "3"}).json()] == [3]
    assert bot.get(URL, {"q": "a"}).json() == []  # 2 belgidan kam: bo'sh
