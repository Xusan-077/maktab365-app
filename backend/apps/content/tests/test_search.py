import json
from pathlib import Path

import pytest
from rest_framework.test import APIClient

from apps.content.models import Chapter, Topic
from apps.content.search import make_snippet, query_terms
from apps.core.translit import cyrillic_to_latin, normalize_search_text

pytestmark = pytest.mark.django_db

TRANSLIT = json.loads(
    (Path(__file__).resolve().parents[4] / "contracts" / "fixtures" / "translit.json").read_text(
        encoding="utf-8"
    )
)


@pytest.mark.parametrize(("cyrillic", "latin"), TRANSLIT["cyrillicToLatin"])
def test_cyrillic_to_latin_vectors(cyrillic, latin):
    assert cyrillic_to_latin(cyrillic) == latin


@pytest.mark.parametrize(("raw", "normalized"), TRANSLIT["searchNormalize"])
def test_search_normalize_vectors(raw, normalized):
    assert normalize_search_text(raw) == normalized


def search(api, q, **params):
    response = api.get("/api/v1/search/", {"q": q, **params})
    assert response.status_code == 200
    return response.json()


@pytest.fixture
def api():
    return APIClient()


@pytest.fixture
def uzbek(catalog):
    subject = catalog.subject("tarix")
    book = catalog.book(subject, "history-9", 9)
    chapter = catalog.chapter(book)
    catalog.topic(
        chapter,
        "mustaqillik",
        1,
        title={"uz": "O'zbekiston mustaqilligi", "ru": "Независимость Узбекистана"},
        summary={"uz": "Mustaqillik bayonoti qabul qilindi"},
        blocks=[
            {"id": "goal", "type": "goal", "text": {"uz": "Maqsad: davlat ramzlarini bilish"}},
            {
                "id": "s",
                "type": "summary",
                "points": [{"uz": "Konstitutsiya 1992-yilda qabul qilingan"}],
            },
        ],
    )
    catalog.topic(chapter, "valyuta", 2, title={"uz": "Milliy valyuta: so'm"})
    return catalog


def test_latin_query(api, uzbek):
    data = search(api, "mustaqillik")
    assert data["count"] == 1
    result = data["results"][0]
    assert result["topic"]["slug"] == "mustaqillik"
    assert result["book"] == {
        "slug": "history-9",
        "title": {"uz": "Tarix. 9-sinf"},
        "grade": 9,
        "subject": "tarix",
    }
    assert result["chapter_title"] == {"uz": "bob-1"}
    assert result["chapter_order"] == 1


def test_prefix_and_case_insensitive(api, uzbek):
    assert search(api, "MUSTAQ")["count"] == 1


def test_apostrophe_variants_match(api, uzbek):
    for query in ("O'zbekiston", "Oʻzbekiston", "ozbekiston", "o‘zbekiston"):
        assert search(api, query)["count"] == 1, query


def test_cyrillic_query_matches_latin_content(api, uzbek):
    assert search(api, "мустақиллик")["count"] == 1
    assert search(api, "Ўзбекистон")["count"] == 1
    assert search(api, "конституция")["count"] == 1


def test_cyrillic_content_matches_latin_query(api, uzbek):
    # `ru` sarlavhasi: "Независимость Узбекистана"
    assert search(api, "nezavisimost")["count"] == 1
    assert search(api, "независимость")["count"] == 1


def test_all_terms_required(api, uzbek):
    assert search(api, "milliy valyuta")["count"] == 1
    assert search(api, "milliy mustaqillik")["count"] == 0


def test_title_ranks_above_body(api, catalog):
    subject = catalog.subject("algebra")
    chapter = catalog.chapter(catalog.book(subject))
    catalog.topic(
        chapter,
        "tanada",
        1,
        title={"uz": "Boshqa mavzu"},
        blocks=[{"id": "g", "type": "goal", "text": {"uz": "Kvadrat haqida"}}],
    )
    catalog.topic(chapter, "sarlavhada", 2, title={"uz": "Kvadrat"})
    results = search(APIClient(), "kvadrat")["results"]
    assert [r["topic"]["slug"] for r in results] == ["sarlavhada", "tanada"]


def test_snippet_marks_matches_in_original_text(api, uzbek):
    snippet = search(api, "konstitutsiya")["results"][0]["snippet"]
    assert "⟦Konstitutsiya⟧" in snippet
    assert "qabul" in snippet


def test_snippet_for_cyrillic_query_keeps_original_script(api, uzbek):
    snippet = search(api, "ўзбекистон", locale="ru")["results"][0]["snippet"]
    assert snippet  # ru matni yo'q: uz snippet'ga qaytadi
    assert "Maqsad" in snippet or "⟦" in snippet


def test_empty_and_symbol_queries(api, uzbek):
    assert search(api, "")["count"] == 0
    assert search(api, "   ")["count"] == 0
    assert search(api, "!!! ???")["results"] == []


def test_query_injection_is_harmless(api, uzbek):
    for query in ("a:* | b", "'; DROP TABLE content_topic; --", "(((", "a & !b"):
        assert api.get("/api/v1/search/", {"q": query}).status_code == 200


def test_filters_grade_and_subject(api, uzbek, catalog):
    algebra = catalog.subject("algebra")
    chapter = catalog.chapter(catalog.book(algebra, "algebra-8", 8))
    catalog.topic(chapter, "mustaqil-ish", 1, title={"uz": "Mustaqil ish"})
    assert search(api, "mustaq")["count"] == 2
    assert search(api, "mustaq", grade=8)["count"] == 1
    assert search(api, "mustaq", subject="tarix")["count"] == 1
    assert search(api, "mustaq", grade=9, subject="algebra")["count"] == 0
    assert search(api, "mustaq", book="history-9")["count"] == 1


def test_only_published_found(api, uzbek, catalog, settings):
    settings.SHOW_DRAFTS_PUBLICLY = False
    chapter = Chapter.objects.get()
    catalog.topic(chapter, "yashirin", 3, status="draft", title={"uz": "Yashirin mustaqil"})
    assert search(api, "yashirin")["count"] == 0
    settings.SHOW_DRAFTS_PUBLICLY = True
    found = search(api, "yashirin")
    assert found["count"] == 1 and found["results"][0]["topic"]["unverified"] is True


def test_limit_and_count(api, catalog):
    chapter = catalog.chapter(catalog.book(catalog.subject()))
    for number in range(1, 6):
        catalog.topic(chapter, f"nazariya-{number}", number, title={"uz": f"Nazariya {number}"})
    data = search(api, "nazariya", limit=2)
    assert (data["count"], len(data["results"])) == (5, 2)


def test_search_updates_when_topic_changes(api, uzbek):

    topic = Topic.objects.get(slug="valyuta")
    topic.title = {"uz": "Pul birligi"}
    topic.save()
    api = APIClient()
    assert search(api, "valyuta")["count"] == 0
    assert search(api, "pul")["count"] == 1


def test_locale_from_accept_language_picks_snippet_text(api, catalog):
    chapter = catalog.chapter(catalog.book(catalog.subject()))
    topic = catalog.topic(
        chapter,
        "ikki-til",
        1,
        title={"uz": "Tenglama"},
        summary={"uz": "Tenglama haqida", "ru": "Про уравнение тенглама"},
        blocks=[],
    )
    assert topic
    uz = APIClient().get("/api/v1/search/", {"q": "tenglama"}).json()["results"][0]["snippet"]
    ru = (
        APIClient()
        .get("/api/v1/search/", {"q": "tenglama"}, HTTP_ACCEPT_LANGUAGE="ru-RU,ru;q=0.9")
        .json()["results"][0]["snippet"]
    )
    assert "⟦Tenglama⟧" in uz
    assert "уравнение" in ru and "⟦тенглама⟧" in ru


def test_make_snippet_without_hits_returns_start(uzbek):

    topic = Topic.objects.get(slug="mustaqillik")
    snippet = make_snippet(topic, query_terms("qqqq"), "uz")
    assert snippet.startswith("Mustaqillik") and "⟦" not in snippet
