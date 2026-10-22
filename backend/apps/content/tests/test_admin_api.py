import pytest
from django.core.cache import cache
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework.test import APIClient

from apps.accounts.models import AuditLog, User
from apps.content.cache import content_version
from apps.content.models import Subject
from apps.core.tests.passwords import TEST_PASSWORD
from apps.support.models import SupportMessage

BASE = "/api/v1/admin"
PNG = b"\x89PNG\r\n\x1a\n" + b"\x00" * 32
PDF = b"%PDF-1.4\n" + b"0" * 32
ROLES = ["student", "teacher", "editor", "admin"]


def client_as(role=None):
    client = APIClient()
    if role:
        user = User.objects.create_user(email=f"{role}@example.com", password=TEST_PASSWORD)
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


def subject_payload(**over):
    return {"slug": "fizika", "title": {"uz": "Fizika", "ru": "Физика"}, "order": 5, **over}


# --- Ruxsat matritsasi ---------------------------------------------------------------------

READ_ENDPOINTS = ["dashboard/", "subjects/", "pdf-books/"]


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
def test_subject_create_permission_matrix(db, role, expected):
    response = client_as(role).post(f"{BASE}/subjects/", subject_payload(), "json")
    assert response.status_code == expected


@pytest.mark.parametrize(
    ("role", "expected"),
    [(None, 401), ("student", 403), ("teacher", 403), ("editor", 403), ("admin", 204)],
)
def test_subject_delete_permission_matrix(db, role, expected):
    subject = Subject.objects.create(slug="fizika", title={"uz": "Fizika"})
    assert client_as(role).delete(f"{BASE}/subjects/{subject.pk}/").status_code == expected


@pytest.mark.parametrize(
    ("role", "expected"),
    [(None, 401), ("student", 403), ("teacher", 403), ("editor", 201), ("admin", 201)],
)
def test_upload_permissions(db, role, expected):
    upload = client_as(role).post(
        f"{BASE}/uploads/",
        {"kind": "cover", "file": SimpleUploadedFile("a.png", PNG, "image/png")},
        format="multipart",
    )
    assert upload.status_code == expected


# --- Fanlar --------------------------------------------------------------------------------


def test_subject_crud_audit_and_cache(editor, django_capture_on_commit_callbacks):
    cache.clear()
    before = content_version()
    with django_capture_on_commit_callbacks(execute=True):
        created = editor.post(f"{BASE}/subjects/", subject_payload(), "json")
    assert created.status_code == 201, created.data
    assert created.data["slug"] == "fizika" and created.data["pdf_books_count"] == 0
    assert content_version() != before  # ochiq API keshi tozalandi
    assert AuditLog.objects.filter(action="create", target_type="subject").count() == 1

    url = f"{BASE}/subjects/{created.data['id']}/"
    updated = editor.patch(url, {"title": {"uz": "Fizika fani"}}, "json")
    assert updated.status_code == 200 and updated.data["title"] == {"uz": "Fizika fani"}
    log = AuditLog.objects.filter(action="update", target_type="subject").get()
    assert log.before["title"] == {"uz": "Fizika", "ru": "Физика"}


def test_subject_validation_and_immutable_slug(editor):
    editor.post(f"{BASE}/subjects/", subject_payload(), "json")
    subject = Subject.objects.get(slug="fizika")

    duplicate = editor.post(f"{BASE}/subjects/", subject_payload(), "json")
    assert duplicate.status_code == 400 and duplicate.data["code"] == "validation_error"
    no_uz = editor.post(f"{BASE}/subjects/", subject_payload(slug="x", title={"ru": "Икс"}), "json")
    assert no_uz.status_code == 400
    moved = editor.patch(f"{BASE}/subjects/{subject.pk}/", {"slug": "boshqa"}, "json")
    assert moved.status_code == 400 and "slug_immutable" in moved.data["details"]["slug"]


def test_subject_with_pdf_books_cannot_be_deleted(admin, catalog):
    subject = catalog.subject("algebra")
    catalog.pdf_book(subject, 9)

    resp = admin.delete(f"{BASE}/subjects/{subject.pk}/")

    assert resp.status_code == 409 and resp.data["code"] == "has_dependents"
    assert not AuditLog.objects.filter(action="delete").exists()
    assert Subject.objects.filter(pk=subject.pk).exists()


def test_empty_subject_is_deleted_with_audit(admin):
    subject = Subject.objects.create(slug="fizika", title={"uz": "Fizika"})

    assert admin.delete(f"{BASE}/subjects/{subject.pk}/").status_code == 204
    assert AuditLog.objects.filter(action="delete", target_type="subject").count() == 1


def test_subject_list_reports_pdf_book_counts(editor, catalog):
    algebra = catalog.subject("algebra")
    catalog.pdf_book(algebra, 9)
    catalog.pdf_book(algebra, 8, "draft")

    rows = editor.get(f"{BASE}/subjects/").data["results"]

    assert [(row["slug"], row["pdf_books_count"]) for row in rows] == [("algebra", 2)]


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


def test_dashboard_numbers_and_queries(editor, catalog, django_assert_max_num_queries):
    algebra = catalog.subject("algebra")
    catalog.pdf_book(algebra, 9)
    catalog.pdf_book(algebra, 8, "draft")
    SupportMessage.objects.create(message="Savol matni yetarli", email="a@b.co")
    SupportMessage.objects.create(message="Spam xabar matni", status="spam")
    editor.post(f"{BASE}/subjects/", subject_payload(), "json")
    with django_assert_max_num_queries(8):
        data = editor.get(f"{BASE}/dashboard/").data
    assert data["pdf_books"] == {"total": 2, "published": 1, "draft": 1}
    assert data["subjects_count"] == 2
    assert "books" not in data and "topics" not in data
    assert data["new_messages"] == 1 and len(data["recent_messages"]) == 1
    assert data["recent_activity"][0]["action"] == "create"


def test_users_list_filters(admin, editor):
    resp = admin.get(f"{BASE}/users/", {"role": "editor"})
    assert [u["email"] for u in resp.data["results"]] == ["editor@example.com"]
    assert "password" not in resp.data["results"][0]
