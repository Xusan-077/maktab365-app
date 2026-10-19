import pytest
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
from django.db import IntegrityError, transaction
from rest_framework.exceptions import PermissionDenied
from rest_framework.test import APIClient

from apps.accounts import services
from apps.accounts.models import AuthEvent, Identity, Profile, Role, User

pytestmark = pytest.mark.django_db


@pytest.fixture
def user():
    return User.objects.create_user(email="Ali@Example.com", password="s3cret-pass-1")


@pytest.fixture
def api(user):
    client = APIClient()
    client.force_authenticate(user)
    return client


# --- modellar ---


class TestModels:
    def test_email_is_normalized_and_case_insensitive_unique(self, user):
        assert user.email == "ali@example.com"
        with pytest.raises(IntegrityError), transaction.atomic():
            User.objects.create_user(email="ALI@example.com")

    def test_multiple_users_without_email(self):
        User.objects.create_user(email=None)
        User.objects.create_user(email="")
        assert User.objects.filter(email__isnull=True).count() == 2

    def test_passwordless_account(self):
        passwordless = User.objects.create_user(email="a@b.uz")
        assert not passwordless.has_usable_password()

    def test_defaults(self, user):
        assert user.role == Role.STUDENT
        assert user.is_active and not user.is_staff
        assert user.email_verified_at is None

    def test_superuser_is_admin(self):
        admin = User.objects.create_superuser(email="root@b.uz", password="s3cret-pass-1")
        assert admin.role == Role.ADMIN and admin.is_staff and admin.is_superuser

    def test_natural_key_by_email_case_insensitive(self, user):
        assert User.objects.get_by_natural_key("ALI@example.com") == user

    def test_password_uses_argon2_first(self, settings):
        from config.settings import base

        assert base.PASSWORD_HASHERS[0].endswith("Argon2PasswordHasher")

    @pytest.mark.parametrize("password", ["short1", "password", "12345678912"])
    def test_password_validators_reject_weak(self, password):
        with pytest.raises(ValidationError):
            validate_password(password)

    def test_password_validators_accept_strong(self):
        validate_password("kuchli-parol-2026")

    def test_identity_unique_per_provider_uid(self, user):
        Identity.objects.create(user=user, provider="google", provider_uid="g-1")
        with pytest.raises(IntegrityError), transaction.atomic():
            Identity.objects.create(user=user, provider="google", provider_uid="g-1")
        Identity.objects.create(user=user, provider="telegram", provider_uid="g-1")

    def test_profile_grade_range(self, user):
        with pytest.raises(IntegrityError), transaction.atomic():
            Profile.objects.create(user=user, grade=12)


# --- rol qoidalari ---


class TestRoleRules:
    def test_student_teacher_switch(self, user):
        services.change_role(user, Role.TEACHER)
        user.refresh_from_db()
        assert user.role == Role.TEACHER
        services.change_role(user, Role.STUDENT)
        user.refresh_from_db()
        assert user.role == Role.STUDENT

    @pytest.mark.parametrize("role", [Role.EDITOR, Role.ADMIN])
    def test_user_cannot_self_promote(self, user, role):
        with pytest.raises(PermissionDenied):
            services.change_role(user, role)
        user.refresh_from_db()
        assert user.role == Role.STUDENT

    def test_admin_can_assign_any_role(self, user):
        admin = User.objects.create_user(email="adm@b.uz", role=Role.ADMIN)
        services.change_role(user, Role.EDITOR, actor=admin)
        user.refresh_from_db()
        assert user.role == Role.EDITOR

    def test_editor_cannot_assign_admin(self, user):
        editor = User.objects.create_user(email="ed@b.uz", role=Role.EDITOR)
        with pytest.raises(PermissionDenied):
            services.change_role(user, Role.ADMIN, actor=editor)

    def test_editor_cannot_switch_own_role_via_self_service(self):
        editor = User.objects.create_user(email="ed@b.uz", role=Role.EDITOR)
        with pytest.raises(PermissionDenied):
            services.change_role(editor, Role.STUDENT)

    def test_role_change_is_audited(self, user):
        services.change_role(user, Role.TEACHER)
        event = AuthEvent.objects.get(user=user, type="role_changed")
        assert event.meta == {"old": "student", "new": "teacher"}

    def test_api_role_patch(self, api):
        response = api.patch("/api/v1/me/role/", {"role": "teacher"}, format="json")
        assert response.status_code == 200
        assert response.json()["role"] == "teacher"

    def test_api_role_forbidden(self, api):
        response = api.patch("/api/v1/me/role/", {"role": "admin"}, format="json")
        assert response.status_code == 403
        assert response.json()["code"] == "role_forbidden"

    def test_api_role_invalid(self, api):
        response = api.patch("/api/v1/me/role/", {"role": "king"}, format="json")
        assert response.status_code == 400
        assert response.json()["code"] == "validation_error"


# --- /me/ ---


class TestMe:
    def test_requires_auth(self):
        response = APIClient().get("/api/v1/me/")
        assert response.status_code in (401, 403)

    def test_get_creates_empty_profile(self, api):
        body = api.get("/api/v1/me/").json()
        assert body["email"] == "ali@example.com"
        assert body["email_verified"] is False
        assert body["role"] == "student"
        assert body["profile"]["onboarded_at"] is None
        assert body["profile"]["locale"] == "uz"

    def test_patch_profile(self, api):
        response = api.patch(
            "/api/v1/me/",
            {"display_name": "Ali", "locale": "ru", "grade": 7, "subjects": ["math", "math"]},
            format="json",
        )
        assert response.status_code == 200
        profile = response.json()["profile"]
        assert profile["display_name"] == "Ali"
        assert profile["locale"] == "ru"
        assert profile["grade"] == 7
        assert profile["subjects"] == ["math"]

    @pytest.mark.parametrize(
        "payload", [{"grade": 12}, {"locale": "de"}, {"display_name": "x" * 61}, {"grades": [0]}]
    )
    def test_patch_validation(self, api, payload):
        response = api.patch("/api/v1/me/", payload, format="json")
        assert response.status_code == 400
        assert response.json()["code"] == "validation_error"

    def test_patch_cannot_change_role_or_email(self, api, user):
        api.patch("/api/v1/me/", {"role": "admin", "email": "x@y.uz"}, format="json")
        user.refresh_from_db()
        assert user.role == Role.STUDENT and user.email == "ali@example.com"


# --- onboarding ---


class TestOnboarding:
    def test_student(self, api):
        response = api.post(
            "/api/v1/me/onboarding/",
            {"role": "student", "display_name": "Ali", "grade": 5},
            format="json",
        )
        assert response.status_code == 200
        body = response.json()
        assert body["role"] == "student"
        assert body["profile"]["grade"] == 5
        assert body["profile"]["onboarded_at"] is not None

    def test_teacher(self, api):
        response = api.post(
            "/api/v1/me/onboarding/",
            {"role": "teacher", "display_name": "Vali", "subjects": ["math"], "grades": [6, 5]},
            format="json",
        )
        assert response.status_code == 200
        body = response.json()
        assert body["role"] == "teacher"
        assert body["profile"]["subjects"] == ["math"]
        assert body["profile"]["grades"] == [5, 6]
        assert body["profile"]["grade"] is None

    @pytest.mark.parametrize(
        ("payload", "field"),
        [
            ({"role": "student", "display_name": "Ali"}, "grade"),
            ({"role": "teacher", "display_name": "V", "grades": [5]}, "subjects"),
            ({"role": "teacher", "display_name": "V", "subjects": ["math"]}, "grades"),
            ({"role": "student", "grade": 5}, "display_name"),
        ],
    )
    def test_missing_fields(self, api, payload, field):
        response = api.post("/api/v1/me/onboarding/", payload, format="json")
        assert response.status_code == 400
        assert field in response.json()["details"]

    @pytest.mark.parametrize("role", ["admin", "editor"])
    def test_cannot_onboard_as_privileged_role(self, api, role):
        response = api.post(
            "/api/v1/me/onboarding/",
            {"role": role, "display_name": "A", "grade": 5},
            format="json",
        )
        assert response.status_code == 400

    def test_repeat_keeps_first_onboarded_at_and_switches_role(self, api, user):
        payload = {"role": "student", "display_name": "Ali", "grade": 5}
        api.post("/api/v1/me/onboarding/", payload, format="json")
        first = Profile.objects.get(user=user).onboarded_at
        api.post(
            "/api/v1/me/onboarding/",
            {"role": "teacher", "display_name": "Ali", "subjects": ["math"], "grades": [5]},
            format="json",
        )
        profile = Profile.objects.get(user=user)
        user.refresh_from_db()
        assert profile.onboarded_at == first
        assert user.role == Role.TEACHER
        assert AuthEvent.objects.filter(user=user, type="onboarded").count() == 1


# --- o'chirish va anonimlashtirish ---


class TestDeletion:
    def test_delete_anonymizes(self, api, user):
        Identity.objects.create(user=user, provider="google", provider_uid="g-1", email="a@b.uz")
        api.post(
            "/api/v1/me/onboarding/",
            {"role": "student", "display_name": "Ali", "grade": 5},
            format="json",
        )
        response = api.delete("/api/v1/me/")
        assert response.status_code == 204

        assert not User.objects.filter(pk=user.pk).exists()
        gone = User.all_objects.get(pk=user.pk)
        assert gone.deleted_at is not None
        assert gone.email is None
        assert gone.is_active is False
        assert not gone.has_usable_password()
        assert not Identity.objects.filter(user=gone).exists()
        profile = Profile.objects.get(user=gone)
        assert profile.display_name == "" and profile.grade is None
        assert profile.onboarded_at is None
        assert AuthEvent.objects.filter(user=gone, type="account_deleted").exists()
        assert not AuthEvent.objects.filter(user=gone).exclude(ip=None).exists()

    def test_email_is_free_after_deletion(self, api):
        api.delete("/api/v1/me/")
        User.objects.create_user(email="ali@example.com")

    def test_deleted_user_cannot_authenticate(self, user):
        services.delete_account(user)
        assert not User.objects.filter(pk=user.pk).exists()


# --- eksport ---


class TestExport:
    def test_export(self, api, user):
        Identity.objects.create(user=user, provider="google", provider_uid="g-1", email="a@b.uz")
        api.post(
            "/api/v1/me/onboarding/",
            {"role": "student", "display_name": "Ali", "grade": 5},
            format="json",
        )
        response = api.get("/api/v1/me/export/")
        assert response.status_code == 200
        assert "attachment" in response["Content-Disposition"]
        body = response.json()
        assert body["user"]["email"] == "ali@example.com"
        assert body["user"]["id"] == str(user.pk)
        assert body["profile"]["display_name"] == "Ali"
        assert body["identities"][0]["provider"] == "google"
        assert {e["type"] for e in body["auth_events"]} >= {"onboarded"}
        assert "password" not in str(body)

    def test_export_requires_auth(self):
        assert APIClient().get("/api/v1/me/export/").status_code in (401, 403)

    def test_export_contains_only_own_data(self, api):
        other = User.objects.create_user(email="other@example.com")
        Identity.objects.create(user=other, provider="google", provider_uid="o-1")
        body = api.get("/api/v1/me/export/").json()
        assert body["identities"] == []
        assert "other@example.com" not in str(body)
