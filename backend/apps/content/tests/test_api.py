import pytest
from django.core.cache import cache
from rest_framework.test import APIClient

from apps.content.cache import content_version
from apps.content.models import Topic

pytestmark = pytest.mark.django_db


@pytest.fixture
def api():
    return APIClient()


def get(api, url, **params):
    return api.get(url, params)


def slugs(response, key="results"):
    data = response.json()
    return [item["slug"] for item in (data[key] if key else data)]


def test_grades_list_all_eleven(api, library):
    data = get(api, "/api/v1/grades/").json()
    assert [item["grade"] for item in data] == list(range(1, 12))
    assert {item["grade"]: item["books_count"] for item in data if item["books_count"]} == {
        8: 1,
        9: 1,
    }


def test_subjects_filter_by_grade(api, library):
    assert slugs(get(api, "/api/v1/subjects/"), None) == ["algebra", "geometriya"]
    assert slugs(get(api, "/api/v1/subjects/", grade=8), None) == ["geometriya"]
    assert get(api, "/api/v1/subjects/", grade=3).json() == []


def test_subjects_hide_unpublished_books(api, library, catalog):
    library["book"].delete()
    catalog.book(library["algebra"], "algebra-10", 10, published=False)
    assert slugs(get(api, "/api/v1/subjects/"), None) == ["geometriya"]


def test_bad_grade_is_validation_error(api, library):
    response = get(api, "/api/v1/subjects/", grade="x")
    assert response.status_code == 400
    assert response.json()["code"] == "validation_error"


def test_books_filters(api, library, settings):
    settings.SHOW_DRAFTS_PUBLICLY = False
    assert slugs(get(api, "/api/v1/books/")) == ["geometry-8", "algebra-9"]
    assert slugs(get(api, "/api/v1/books/", grade=9)) == ["algebra-9"]
    assert slugs(get(api, "/api/v1/books/", subject="geometriya")) == ["geometry-8"]
    assert slugs(get(api, "/api/v1/books/", q="algebra")) == ["algebra-9"]
    assert slugs(get(api, "/api/v1/books/", q="ALGEBRA")) == ["algebra-9"]
    assert slugs(get(api, "/api/v1/books/", topics_ready="true")) == ["geometry-8", "algebra-9"]
    assert get(api, "/api/v1/books/", grade=9, subject="geometriya").json()["count"] == 0


def test_books_topics_ready_reflects_published_topics(api, library, catalog):
    empty = catalog.book(library["algebra"], "algebra-8", 8)
    data = get(api, "/api/v1/books/", grade=8, subject="algebra").json()
    assert [(b["slug"], b["topics_ready"], b["topics_count"]) for b in data["results"]] == [
        (empty.slug, False, 0)
    ]
    assert slugs(get(api, "/api/v1/books/", topics_ready="false")) == ["algebra-8"]


def test_books_are_paginated(api, library):
    data = get(api, "/api/v1/books/", page_size=1).json()
    assert (data["count"], len(data["results"]), data["next"] is not None) == (2, 1, True)


def test_unpublished_book_is_hidden(api, library):
    library["book"].is_published = False
    library["book"].save()
    assert get(api, "/api/v1/books/algebra-9/").status_code == 404
    assert get(api, "/api/v1/books/algebra-9/topics/viyet/").status_code == 404
    assert "algebra-9" not in slugs(get(api, "/api/v1/books/"))


def test_book_detail_lists_chapters_and_published_topics_only(api, library):
    data = get(api, "/api/v1/books/algebra-9/").json()
    assert data["topics_count"] == 3 and data["topics_ready"] is True
    assert [c["slug"] for c in data["chapters"]] == ["kvadrat", "tengsizliklar"]
    assert [t["slug"] for t in data["chapters"][0]["topics"]] == ["diskriminant", "viyet"]
    assert [t["slug"] for t in data["chapters"][1]["topics"]] == ["chiziqli"]
    assert all("blocks" not in t for c in data["chapters"] for t in c["topics"])
    assert data["chapters"][0]["topics"][0]["title"]["ru"] == "Дискриминант"
    assert get(api, "/api/v1/books/yoq/").status_code == 404


def test_topic_detail(api, library):
    response = get(api, "/api/v1/books/algebra-9/topics/viyet/")
    data = response.json()
    assert response.status_code == 200
    assert len(data["blocks"]) == 13 and data["unverified"] is False
    assert data["previous"]["slug"] == "diskriminant"
    assert data["next"]["slug"] == "chiziqli"
    assert data["breadcrumb"]["subject"]["slug"] == "algebra"
    assert data["breadcrumb"]["chapter"]["order"] == 1
    assert data["breadcrumb"]["book"] == {
        "slug": "algebra-9",
        "title": {"uz": "Algebra. 9-sinf"},
        "grade": 9,
    }


def test_topic_neighbours_skip_hidden_and_stop_at_ends(api, library):
    first = get(api, "/api/v1/books/algebra-9/topics/diskriminant/").json()
    last = get(api, "/api/v1/books/algebra-9/topics/chiziqli/").json()
    assert first["previous"] is None
    assert last["next"] is None  # `qoralama` (draft) ko'rinmaydi


def test_only_published_by_default(api, library, settings):
    settings.SHOW_DRAFTS_PUBLICLY = False
    assert get(api, "/api/v1/books/algebra-9/topics/qoralama/").status_code == 404
    assert get(api, "/api/v1/search/", q="qoralama").json()["count"] == 0


def test_drafts_show_with_unverified_flag(api, library, settings):
    settings.SHOW_DRAFTS_PUBLICLY = True
    data = get(api, "/api/v1/books/algebra-9/topics/qoralama/").json()
    assert data["unverified"] is True and data["status"] == "draft"
    book = get(api, "/api/v1/books/algebra-9/").json()
    flags = {t["slug"]: t["unverified"] for c in book["chapters"] for t in c["topics"]}
    assert flags == {
        "diskriminant": False,
        "viyet": False,
        "chiziqli": False,
        "qoralama": True,
    }
    assert book["topics_count"] == 4


def test_draft_only_book_is_not_ready_without_setting(api, library, catalog, settings):
    settings.SHOW_DRAFTS_PUBLICLY = False
    book = catalog.book(library["algebra"], "algebra-7", 7)
    catalog.topic(catalog.chapter(book, "c", 1), "hali-yoq", 1, status="reviewed")
    data = get(api, "/api/v1/books/algebra-7/").json()
    assert data["topics_ready"] is False and data["chapters"][0]["topics"] == []


def test_staff_sees_drafts_and_response_is_private(api, library, settings, django_user_model):
    settings.SHOW_DRAFTS_PUBLICLY = False
    editor = django_user_model.objects.create_user(email="e@example.com", password="x")
    editor.role = "editor"
    editor.save()
    api.force_authenticate(editor)
    response = get(api, "/api/v1/books/algebra-9/topics/qoralama/")
    assert response.status_code == 200 and response.json()["unverified"] is True
    assert response["Cache-Control"] == "private, no-store"
    assert "ETag" not in response


def test_student_does_not_see_drafts(api, library, settings, django_user_model):
    settings.SHOW_DRAFTS_PUBLICLY = False
    student = django_user_model.objects.create_user(email="s@example.com", password="x")
    api.force_authenticate(student)
    assert get(api, "/api/v1/books/algebra-9/topics/qoralama/").status_code == 404


def test_cache_headers_and_etag(api, library):
    response = get(api, "/api/v1/books/algebra-9/")
    assert response["Cache-Control"] == "public, max-age=60"
    etag = response["ETag"]
    again = api.get("/api/v1/books/algebra-9/", HTTP_IF_NONE_MATCH=etag)
    assert again.status_code == 304 and again["ETag"] == etag and again.content == b""
    stale = api.get("/api/v1/books/algebra-9/", HTTP_IF_NONE_MATCH='"other"')
    assert stale.status_code == 200


def test_cached_response_uses_no_queries(api, library, django_assert_num_queries):
    get(api, "/api/v1/books/algebra-9/topics/viyet/")
    with django_assert_num_queries(0):
        assert get(api, "/api/v1/books/algebra-9/topics/viyet/").status_code == 200


def test_cache_is_keyed_by_query(api, library):
    assert slugs(get(api, "/api/v1/books/", grade=9)) == ["algebra-9"]
    assert slugs(get(api, "/api/v1/books/", grade=8)) == ["geometry-8"]


def test_publish_invalidates_cache(api, library, django_capture_on_commit_callbacks):
    topic = Topic.objects.get(slug="qoralama")
    before = get(api, "/api/v1/books/algebra-9/").json()
    assert before["topics_count"] == 3
    version = content_version()
    with django_capture_on_commit_callbacks(execute=True):
        topic.status = "published"
        topic.save()
    assert content_version() != version
    after = get(api, "/api/v1/books/algebra-9/").json()
    assert after["topics_count"] == 4
    assert get(api, "/api/v1/books/algebra-9/topics/qoralama/").json()["unverified"] is False


def test_edit_invalidates_cache(api, library, django_capture_on_commit_callbacks):
    topic = Topic.objects.get(slug="viyet")
    assert get(api, "/api/v1/books/algebra-9/topics/viyet/").json()["title"] == {"uz": "Viyet"}
    with django_capture_on_commit_callbacks(execute=True):
        topic.title = {"uz": "Yangi nom"}
        topic.save()
    assert get(api, "/api/v1/books/algebra-9/topics/viyet/").json()["title"] == {"uz": "Yangi nom"}


def test_cache_version_survives_eviction(api, library):
    get(api, "/api/v1/grades/")
    cache.delete("content:version")
    assert get(api, "/api/v1/grades/").status_code == 200


def test_no_login_required_and_errors_use_standard_format(api, library):
    response = get(api, "/api/v1/books/algebra-9/topics/yoq/")
    assert response.status_code == 404
    assert set(response.json()) >= {"code", "message"}


# --- N+1 ---


@pytest.fixture
def big_library(catalog):
    subject = catalog.subject("algebra")
    for number in range(1, 6):
        book = catalog.book(subject, f"algebra-{number}", number)
        for chapter_order in range(1, 4):
            chapter = catalog.chapter(book, f"bob-{chapter_order}", chapter_order)
            for topic_order in range(1, 4):
                catalog.topic(chapter, f"mavzu-{chapter_order}-{topic_order}", topic_order)
    return subject


def test_book_list_query_count_is_constant(api, big_library, django_assert_max_num_queries):
    with django_assert_max_num_queries(3):
        assert get(api, "/api/v1/books/").json()["count"] == 5


def test_book_detail_query_count_is_constant(api, big_library, django_assert_max_num_queries):
    with django_assert_max_num_queries(4):
        assert len(get(api, "/api/v1/books/algebra-1/").json()["chapters"]) == 3


def test_topic_detail_query_count_is_constant(api, big_library, django_assert_max_num_queries):
    with django_assert_max_num_queries(3):
        assert get(api, "/api/v1/books/algebra-1/topics/mavzu-2-2/").status_code == 200


def test_search_query_count_is_constant(api, big_library, django_assert_max_num_queries):
    with django_assert_max_num_queries(3):
        assert get(api, "/api/v1/search/", q="mavzu").json()["count"] == 45


def test_grades_and_subjects_query_counts(api, big_library, django_assert_max_num_queries):
    with django_assert_max_num_queries(1):
        get(api, "/api/v1/grades/")
    with django_assert_max_num_queries(1):
        get(api, "/api/v1/subjects/")
