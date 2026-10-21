import pytest
from django.core.cache import cache
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework.test import APIClient

from apps.accounts.models import AuditLog, User
from apps.content.cache import content_version
from apps.content.models import Book, Chapter, Subject, Topic
from apps.support.models import SupportMessage

BASE = "/api/v1/admin"
PNG = b"\x89PNG\r\n\x1a\n" + b"\x00" * 32
PDF = b"%PDF-1.4\n" + b"0" * 32
ROLES = ["student", "teacher", "editor", "admin"]


def client_as(role=None):
    client = APIClient()
    if role:
        user = User.objects.create_user(email=f"{role}@example.com", password="s3cret-pass-1")
        user.role = role
        user.save()
        client.force_authenticate(user)
        client.user = user
    return client


@pytest.fixture
def editor(db):
    return client_as("editor")


@pytest.fixture
def admin(db):
    return client_as("admin")


@pytest.fixture
def shelf(library):
    """`library` + tez havolalar."""
    book = Book.objects.get(slug="algebra-9")
    chapters = list(book.chapters.order_by("order"))
    return {"book": book, "ch1": chapters[0], "ch2": chapters[1]}


def book_payload(**over):
    return {
        "slug": "fizika-7",
        "subject": "algebra",
        "grade": 7,
        "title": {"uz": "Fizika"},
        "author": {"uz": "Mualliflar"},
        "edition": {"uz": "1-nashr"},
        "year": 2022,
        **over,
    }


# --- Ruxsat matritsasi ---------------------------------------------------------------------


READ_ENDPOINTS = ["dashboard/", "subjects/", "books/", "chapters/", "topics/"]


@pytest.mark.parametrize("path", READ_ENDPOINTS)
@pytest.mark.parametrize(
    ("role", "expected"),
    [(None, 401), ("student", 403), ("teacher", 403), ("editor", 200), ("admin", 200)],
)
def test_read_permission_matrix(db, path, role, expected):
    assert client_as(role).get(f"{BASE}/{path}").status_code == expected


@pytest.mark.parametrize(
    ("role", "expected"),
    [(None, 401), ("student", 403), ("teacher", 403), ("editor", 403), ("admin", 200)],
)
def test_users_list_is_admin_only(db, role, expected):
    assert client_as(role).get(f"{BASE}/users/").status_code == expected


@pytest.mark.parametrize(
    ("role", "expected"),
    [(None, 401), ("student", 403), ("teacher", 403), ("editor", 201), ("admin", 201)],
)
def test_create_permission_matrix(db, role, expected):
    Subject.objects.create(slug="algebra", title={"uz": "Algebra"})
    assert client_as(role).post(f"{BASE}/books/", book_payload(), "json").status_code == expected


@pytest.mark.parametrize(
    ("role", "expected"),
    [(None, 401), ("student", 403), ("teacher", 403), ("editor", 403), ("admin", 204)],
)
def test_delete_permission_matrix(shelf, role, expected):
    topic = Topic.objects.filter(slug="viyet").get()
    assert client_as(role).delete(f"{BASE}/topics/{topic.pk}/").status_code == expected


@pytest.mark.parametrize(
    ("role", "expected"),
    [(None, 401), ("student", 403), ("teacher", 403), ("editor", 200), ("admin", 200)],
)
def test_reorder_and_upload_permissions(shelf, role, expected):
    client = client_as(role)
    ids = [str(shelf["ch2"].pk), str(shelf["ch1"].pk)]
    url = f"{BASE}/books/{shelf['book'].pk}/reorder/"
    assert client.post(url, {"chapters": ids}, "json").status_code == expected
    upload = client.post(
        f"{BASE}/uploads/",
        {"kind": "cover", "file": SimpleUploadedFile("a.png", PNG, "image/png")},
        format="multipart",
    )
    assert upload.status_code == (201 if expected == 200 else expected)


# --- CRUD, filtr, qidiruv ------------------------------------------------------------------


def test_lists_show_drafts_and_filter(editor, shelf):
    resp = editor.get(f"{BASE}/topics/", {"book": shelf["book"].pk, "status": "draft"})
    assert [t["slug"] for t in resp.data["results"]] == ["qoralama"]
    assert "blocks" not in resp.data["results"][0]

    resp = editor.get(f"{BASE}/books/", {"grade": 8})
    assert [b["slug"] for b in resp.data["results"]] == ["geometry-8"]
    resp = editor.get(
        f"{BASE}/books/", {"subject": "algebra", "search": "algebra", "status": "published"}
    )
    assert [b["slug"] for b in resp.data["results"]] == ["algebra-9"]
    book = editor.get(f"{BASE}/books/", {"ordering": "-grade"}).data["results"][0]
    assert book["slug"] == "algebra-9"
    assert (book["chapters_count"], book["topics_count"], book["published_topics_count"]) == (
        2,
        4,
        3,
    )


def test_book_crud_audit_and_cache(editor, shelf, django_capture_on_commit_callbacks):
    version = content_version()
    with django_capture_on_commit_callbacks(execute=True):
        resp = editor.post(f"{BASE}/books/", book_payload(), "json")
    assert resp.status_code == 201
    book_id = resp.data["id"]
    log = AuditLog.objects.get(action="create", target_type="book")
    assert log.actor_label == "editor@example.com"
    assert log.after["slug"] == "fizika-7"

    with django_capture_on_commit_callbacks(execute=True):
        resp = editor.patch(
            f"{BASE}/books/{book_id}/", {"is_published": True, "year": 2023}, "json"
        )
    assert resp.status_code == 200
    log = AuditLog.objects.get(action="update", target_type="book")
    assert log.before["is_published"] is False
    assert log.after["is_published"] is True
    assert content_version() != version  # ochiq kesh tozalandi (signals)


def test_book_validation_errors(editor, shelf):
    resp = editor.post(f"{BASE}/books/", book_payload(slug="algebra-9"), "json")
    assert resp.status_code == 400
    assert resp.data["code"] == "validation_error"
    assert "slug" in resp.data["details"]
    resp = editor.post(f"{BASE}/books/", book_payload(title={"ru": "x"}), "json")
    assert "title" in resp.data["details"]
    resp = editor.patch(f"{BASE}/books/{shelf['book'].pk}/", {"slug": "boshqa"}, "json")
    assert resp.data["details"]["slug"] == ["slug_immutable"]


def test_book_files_by_path_only(editor, shelf):
    url = f"{BASE}/books/{shelf['book'].pk}/"
    assert editor.patch(url, {"cover": "../../etc/passwd"}, "json").status_code == 400
    assert editor.patch(url, {"cover": "covers/yoq.png"}, "json").status_code == 400
    uploaded = editor.post(
        f"{BASE}/uploads/",
        {"kind": "cover", "file": SimpleUploadedFile("a.png", PNG, "image/png")},
        format="multipart",
    ).data
    resp = editor.patch(url, {"cover": uploaded["path"]}, "json")
    assert resp.status_code == 200
    assert resp.data["cover"] == uploaded["path"]
    assert resp.data["cover_url"]
    assert editor.patch(url, {"cover": ""}, "json").data["cover_url"] is None


def test_subject_with_books_cannot_be_deleted(admin, shelf):
    subject = Subject.objects.get(slug="algebra")
    resp = admin.delete(f"{BASE}/subjects/{subject.pk}/")
    assert resp.status_code == 409
    assert resp.data["code"] == "has_dependents"
    assert not AuditLog.objects.filter(action="delete").exists()


def test_chapter_and_topic_get_next_order(editor, shelf):
    resp = editor.post(
        f"{BASE}/chapters/",
        {"book": str(shelf["book"].pk), "slug": "yangi", "title": {"uz": "Yangi bob"}},
        "json",
    )
    assert (resp.status_code, resp.data["order"]) == (201, 3)
    topic = editor.post(
        f"{BASE}/topics/",
        {"chapter": resp.data["id"], "slug": "birinchi", "title": {"uz": "Birinchi"}},
        "json",
    )
    assert (topic.status_code, topic.data["status"], topic.data["order"]) == (201, "draft", 1)
    assert topic.data["allowed_transitions"] == ["reviewed"]
    # slug kitob ichida noyob (boshqa bobda ham)
    dup = editor.post(
        f"{BASE}/topics/",
        {"chapter": str(shelf["ch1"].pk), "slug": "birinchi", "title": {"uz": "x"}},
        "json",
    )
    assert dup.data["details"]["slug"] == ["slug_taken"]


def test_topic_edit_validates_blocks_and_ignores_status(editor, shelf):
    topic = Topic.objects.get(slug="qoralama")
    url = f"{BASE}/topics/{topic.pk}/"
    bad = editor.patch(url, {"blocks": [{"type": "nope"}]}, "json")
    assert bad.status_code == 400 and "blocks" in bad.data["details"]
    resp = editor.patch(url, {"title": {"uz": "Yangi"}, "status": "published"}, "json")
    assert resp.status_code == 200
    topic.refresh_from_db()
    assert topic.status == "draft" and topic.title["uz"] == "Yangi"
    assert topic.revisions.order_by("-created_at").first().author_id == editor.user.pk


# --- Nashr oqimi ---------------------------------------------------------------------------


def go(client, topic, to):
    return client.post(f"{BASE}/topics/{topic.pk}/transition/", {"to": to}, "json")


def test_publish_flow_sets_fields_and_clears_cache(
    editor, shelf, django_capture_on_commit_callbacks
):
    topic = Topic.objects.get(slug="qoralama")
    public = APIClient()
    url = "/api/v1/books/algebra-9/topics/qoralama/"
    assert public.get(url).status_code == 404

    version = content_version()
    resp = go(editor, topic, "reviewed")
    assert resp.status_code == 200 and resp.data["status"] == "reviewed"
    assert resp.data["reviewed_by_email"] == "editor@example.com"
    assert resp.data["allowed_transitions"] == ["published"]
    assert public.get(url).status_code == 404

    with django_capture_on_commit_callbacks(execute=True):
        resp = go(editor, topic, "published")
    assert resp.data["status"] == "published" and resp.data["published_at"]
    assert content_version() != version
    assert public.get(url).status_code == 200
    log = AuditLog.objects.filter(action="transition").first()
    assert (log.before["status"], log.after["status"]) == ("reviewed", "published")


def test_transition_rules(editor, admin, shelf):
    draft = Topic.objects.get(slug="qoralama")
    published = Topic.objects.get(slug="viyet")
    assert go(editor, draft, "published").data["code"] == "invalid_transition"
    assert go(editor, draft, "draft").status_code == 400
    assert go(editor, published, "reviewed").status_code == 400
    assert go(editor, published, "draft").data["code"] == "transition_forbidden"
    assert go(editor, published, "draft").status_code == 403

    resp = go(admin, published, "draft")
    assert resp.status_code == 200 and resp.data["status"] == "draft"
    published.refresh_from_db()
    assert published.published_at is None and published.reviewed_by is None
    assert (
        editor.post(f"{BASE}/topics/{draft.pk}/transition/", {"to": "bogus"}, "json").status_code
        == 400
    )
    for role in ("student", "teacher"):
        assert go(client_as(role), draft, "reviewed").status_code == 403
    assert go(client_as(), draft, "reviewed").status_code == 401


# --- Tartiblash ----------------------------------------------------------------------------


@pytest.mark.django_db(transaction=True)
def test_reorder_chapters_and_move_topic(editor, library):
    book = Book.objects.get(slug="algebra-9")
    ch1, ch2 = book.chapters.order_by("order")
    t1, t2 = ch1.topics.order_by("order")
    c1, c2 = ch2.topics.order_by("order")
    body = {
        "chapters": [str(ch2.pk), str(ch1.pk)],
        # t1 ikkinchi bobga ko'chadi, birinchi bobda faqat t2 qoladi
        "topics": {str(ch1.pk): [str(t2.pk)], str(ch2.pk): [str(c2.pk), str(t1.pk), str(c1.pk)]},
    }
    resp = editor.post(f"{BASE}/books/{book.pk}/reorder/", body, "json")
    assert resp.status_code == 200, resp.data
    assert [c.slug for c in book.chapters.order_by("order")] == ["tengsizliklar", "kvadrat"]
    assert [t.slug for t in Topic.objects.filter(chapter=ch2).order_by("order")] == [
        c2.slug,
        t1.slug,
        c1.slug,
    ]
    assert Topic.objects.get(pk=t1.pk).chapter_id == ch2.pk
    assert AuditLog.objects.filter(action="reorder").count() == 1
    cache.clear()


def test_reorder_validation(editor, shelf):
    book, ch1 = shelf["book"], shelf["ch1"]
    url = f"{BASE}/books/{book.pk}/reorder/"
    assert editor.post(url, {}, "json").status_code == 400
    assert editor.post(url, {"chapters": [str(ch1.pk)]}, "json").status_code == 400  # to'liq emas
    other = Chapter.objects.exclude(book=book).get()
    resp = editor.post(url, {"chapters": [str(other.pk), str(ch1.pk)]}, "json")
    assert resp.data["details"]["chapters"] == ["must_list_all_chapters"]
    foreign = Topic.objects.exclude(book=book).get()
    resp = editor.post(url, {"topics": {str(ch1.pk): [str(foreign.pk)]}}, "json")
    assert resp.data["details"]["topics"] == ["unknown_or_duplicate_topic"]
    # birinchi bobning mavzusi ro'yxatdan tushib qolgan
    partial = [str(ch1.topics.order_by("order").first().pk)]
    resp = editor.post(url, {"topics": {str(ch1.pk): partial}}, "json")
    assert resp.data["details"]["topics"] == ["must_list_all_topics"]
    resp = editor.post(url, {"topics": {str(other.pk): []}}, "json")
    assert resp.data["details"]["topics"] == ["unknown_chapter"]


# --- Yuklash -------------------------------------------------------------------------------


def upload(client, name, content, ctype, kind):
    return client.post(
        f"{BASE}/uploads/",
        {"kind": kind, "file": SimpleUploadedFile(name, content, ctype)},
        format="multipart",
    )


def test_upload_accepts_valid_and_sanitizes_name(editor, tmp_path, settings):
    settings.STORAGES = {
        **settings.STORAGES,
        "default": {
            "BACKEND": "django.core.files.storage.FileSystemStorage",
            "OPTIONS": {"location": str(tmp_path), "base_url": "/m/"},
        },
    }
    resp = upload(editor, "../../Muqova Ä! 1.PNG", PNG, "image/png", "cover")
    assert resp.status_code == 201, resp.data
    assert resp.data["path"].startswith("covers/muqova-") and resp.data["path"].endswith(".png")
    assert ".." not in resp.data["path"] and resp.data["url"].startswith("/m/covers/")
    assert (tmp_path / resp.data["path"]).read_bytes() == PNG
    assert (
        upload(editor, "kitob.pdf", PDF, "application/pdf", "pdf").data["path"].startswith("pdf/")
    )
    assert AuditLog.objects.filter(action="upload").count() == 2


@pytest.mark.parametrize(
    ("name", "content", "ctype", "kind", "status", "code"),
    [
        ("a.png", PNG, "image/png", "pdf", 415, "unsupported_type"),
        ("a.pdf", PDF, "application/pdf", "cover", 415, "unsupported_type"),
        ("a.png", b"GIF89a" + b"0" * 20, "image/png", "cover", 415, "unsupported_type"),  # soxta
        (
            "a.png",
            PNG,
            "application/pdf",
            "cover",
            415,
            "unsupported_type",
        ),  # Content-Type mos emas
        ("a.svg", b"<svg onload=alert(1)>", "image/svg+xml", "cover", 415, "unsupported_type"),
        ("a.png", b"", "image/png", "cover", 400, "validation_error"),
    ],
)
def test_upload_rejects(editor, name, content, ctype, kind, status, code):
    resp = upload(editor, name, content, ctype, kind)
    assert (resp.status_code, resp.data["code"]) == (status, code)


def test_upload_size_limit_and_missing_file(editor, settings):
    settings.ADMIN_UPLOAD_MAX_IMAGE_BYTES = 40
    resp = upload(editor, "a.png", PNG + b"0" * 40, "image/png", "cover")
    assert resp.status_code == 413
    assert editor.post(f"{BASE}/uploads/", {"kind": "cover"}, format="multipart").status_code == 400
    assert upload(editor, "a.png", PNG, "image/png", "script").status_code == 400


# --- Dashboard -----------------------------------------------------------------------------


def test_dashboard_numbers_and_queries(editor, shelf, django_assert_max_num_queries):
    SupportMessage.objects.create(message="Savol matni yetarli", email="a@b.co")
    SupportMessage.objects.create(message="Spam xabar matni", status="spam")
    editor.post(f"{BASE}/books/", book_payload(), "json")
    with django_assert_max_num_queries(8):
        data = editor.get(f"{BASE}/dashboard/").data
    assert data["books"] == {"total": 3, "published": 2, "draft": 1}
    assert data["topics"] == {"total": 5, "draft": 1, "reviewed": 0, "published": 4}
    assert data["new_messages"] == 1 and len(data["recent_messages"]) == 1
    assert data["recent_activity"][0]["action"] == "create"


def test_users_list_filters(admin, editor):
    resp = admin.get(f"{BASE}/users/", {"role": "editor"})
    assert [u["email"] for u in resp.data["results"]] == ["editor@example.com"]
    assert "password" not in resp.data["results"][0]
